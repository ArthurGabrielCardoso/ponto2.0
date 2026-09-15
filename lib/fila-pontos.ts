"use client"

import type { CoordenadasLocalizacao } from "./geolocation"

/**
 * Fila persistente de batidas ainda não gravadas no Supabase.
 *
 * Sem isto, uma queda de internet no momento da batida perde o registro: a
 * gravação roda em segundo plano, a tela já mostrou "Excelente dia" e não há
 * nada segurando o dado. O reconhecimento facial funciona 100% offline
 * (modelos em cache, descritores em memória), então o único elo frágil era
 * justamente a escrita.
 *
 * Guardamos em localStorage e não em IndexedDB de propósito. São poucos
 * registros por dia, cada um com algumas centenas de bytes, e a escrita
 * síncrona do localStorage já está comprometida quando a função retorna —
 * numa transação assíncrona do IndexedDB, um refresh ou o tablet sendo
 * desligado no meio derruba a gravação. Aqui, o que entrou, ficou.
 */

const CHAVE = "vitall_fila_pontos"

export interface PontoPendente {
  /** Id local, só para deduplicar dentro da fila. */
  id: string
  funcionarioId: string
  nomeFuncionario: string
  tipo: string
  /** Instante REAL da batida — nunca o instante do envio. */
  dataHoraIso: string
  localizacao: CoordenadasLocalizacao | null
  tentativas: number
  /** Momento da última tentativa, para espaçar as próximas. */
  ultimaTentativaMs: number
  criadoEmMs: number
}

function ler(): PontoPendente[] {
  if (typeof window === "undefined") return []
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return []
    const lista = JSON.parse(bruto)
    return Array.isArray(lista) ? (lista as PontoPendente[]) : []
  } catch {
    return []
  }
}

function escrever(lista: PontoPendente[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista))
  } catch (e) {
    console.error("[fila] não foi possível persistir a fila de pontos:", e)
  }
}

/** Coloca uma batida na fila. Devolve o id local. */
export function enfileirarPonto(
  dados: Omit<PontoPendente, "id" | "tentativas" | "ultimaTentativaMs" | "criadoEmMs">
): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const item: PontoPendente = {
    ...dados,
    id,
    tentativas: 0,
    ultimaTentativaMs: 0,
    criadoEmMs: Date.now(),
  }

  escrever([...ler(), item])
  return id
}

export function removerDaFila(id: string) {
  escrever(ler().filter((p) => p.id !== id))
}

export function listarPendentes(): PontoPendente[] {
  return ler()
}

export function contarPendentes(): number {
  return ler().length
}

function marcarTentativa(id: string) {
  escrever(
    ler().map((p) =>
      p.id === id ? { ...p, tentativas: p.tentativas + 1, ultimaTentativaMs: Date.now() } : p
    )
  )
}

/** Espera crescente entre tentativas, teto de 5 minutos. */
function prontoParaTentar(p: PontoPendente): boolean {
  if (p.tentativas === 0) return true
  const espera = Math.min(5 * 60 * 1000, 5000 * 2 ** (p.tentativas - 1))
  return Date.now() - p.ultimaTentativaMs >= espera
}

let sincronizando = false

/**
 * Tenta gravar tudo que está pendente. Seguro para chamar a qualquer momento —
 * chamadas concorrentes são ignoradas enquanto uma está em voo.
 *
 * Devolve quantas batidas saíram da fila.
 */
export async function sincronizarFila(): Promise<number> {
  if (sincronizando) return 0
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0

  const pendentes = ler().filter(prontoParaTentar)
  if (pendentes.length === 0) return 0

  sincronizando = true
  let gravados = 0

  try {
    const { registrarPonto, buscarRegistrosHoje } = await import("@/lib/supabase")

    for (const p of pendentes) {
      try {
        marcarTentativa(p.id)

        // Uma tentativa anterior pode ter chegado ao banco e a resposta ter se
        // perdido na volta. Antes de reenviar, procuramos o registro exato
        // (mesmo funcionário, mesmo instante) para não duplicar a batida.
        if (p.tentativas > 0) {
          const jaExiste = await buscarRegistrosHoje(p.funcionarioId)
            .then((regs) => regs.some((r) => r.data_hora === p.dataHoraIso))
            .catch(() => false)

          if (jaExiste) {
            removerDaFila(p.id)
            gravados++
            continue
          }
        }

        await registrarPonto(
          p.funcionarioId,
          p.nomeFuncionario,
          p.tipo,
          p.localizacao,
          // Lista vazia: o cooldown de 60s já foi decidido quando a batida
          // aconteceu. Reaplicá-lo aqui descartaria calado uma batida legítima
          // que só está atrasada porque a internet caiu.
          [],
          p.dataHoraIso
        )

        removerDaFila(p.id)
        gravados++
      } catch (erro) {
        console.warn(`[fila] batida ${p.id} segue pendente:`, erro)
      }
    }
  } catch (erro) {
    console.error("[fila] falha ao sincronizar:", erro)
  } finally {
    sincronizando = false
  }

  return gravados
}

/**
 * Liga a sincronização automática: ao voltar a internet, ao a aba reaparecer e
 * de tempos em tempos. Devolve a função de desligar.
 */
export function iniciarSincronizacaoAutomatica(
  aoMudar?: (pendentes: number) => void
): () => void {
  if (typeof window === "undefined") return () => {}

  const rodar = async () => {
    const n = await sincronizarFila()
    if (n > 0) console.log(`[fila] ${n} batida(s) atrasada(s) gravada(s)`)
    aoMudar?.(contarPendentes())
  }

  const aoVoltarOnline = () => void rodar()
  const aoVoltarAba = () => {
    if (document.visibilityState === "visible") void rodar()
  }

  window.addEventListener("online", aoVoltarOnline)
  document.addEventListener("visibilitychange", aoVoltarAba)
  const intervalo = window.setInterval(rodar, 30000)

  void rodar()

  return () => {
    window.removeEventListener("online", aoVoltarOnline)
    document.removeEventListener("visibilitychange", aoVoltarAba)
    clearInterval(intervalo)
  }
}
