"use client"

import { supabase } from "@/lib/supabase"
import { logar } from "@/lib/log-tablet"

/**
 * PIN da batida manual: a segunda camada, ao lado da foto.
 *
 * A foto prova DEPOIS (é comparada com o cadastro quando o reconhecimento
 * volta); o PIN barra NA HORA. Juntos: se a câmera falha, o PIN ainda
 * identifica quem bate; se alguém descobre o PIN de outra pessoa, a foto
 * denuncia.
 *
 * Guardamos só o HASH (PBKDF2-SHA256, salt próprio por pessoa) — o PIN em si
 * nunca sai do tablet nem da tela de cadastro. A conferência é local, porque o
 * caso de uso é justamente o sistema estar com problema ou sem internet: os
 * hashes são baixados quando há rede e ficam em cache.
 *
 * LIMITE HONESTO: PIN de 4 a 6 dígitos tem poucas combinações, e o hash precisa
 * ser legível pelo tablet. Quem tiver a chave pública do app e conhecimento
 * técnico consegue descobri-lo offline. O que isto barra de verdade é o colega
 * parado na frente do tablet — e para ele há o bloqueio por tentativas erradas.
 */

const TABELA = "pins_funcionarios"
const CHAVE_CACHE = "vitall_pins"
const CHAVE_ERROS = "vitall_pin_erros"
const ITERACOES = 100_000
export const PIN_MIN = 4
export const PIN_MAX = 6

/** Erros seguidos de uma pessoa até travar a escolha dela, e por quanto tempo. */
const ERROS_PARA_TRAVAR = 3
const TRAVAS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000]
/** Erros de qualquer pessoa, em 10 minutos, até travar a batida manual inteira. */
const ERROS_GLOBAIS = 6
const JANELA_GLOBAL_MS = 10 * 60_000
const TRAVA_GLOBAL_MS = 10 * 60_000

export interface PinGuardado {
  salt: string
  hash: string
  iteracoes: number
  tamanho: number
}

type Cache = Record<string, PinGuardado>

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

const paraHex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")

const deHex = (h: string) => new Uint8Array((h.match(/.{2}/g) || []).map((x) => parseInt(x, 16)))

/** `crypto.subtle` só existe em contexto seguro (HTTPS ou localhost). */
export function hashDisponivel(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle
}

async function derivar(pin: string, salt: string, iteracoes: number): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: deHex(salt).buffer as ArrayBuffer, iterations: iteracoes },
    chave,
    256
  )
  return paraHex(bits)
}

export function pinValido(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)
}

/** Cria o registro de um PIN novo (salt aleatório). Só o resultado vai para o banco. */
export async function criarPin(pin: string): Promise<PinGuardado> {
  if (!pinValido(pin)) throw new Error(`O PIN deve ter de ${PIN_MIN} a ${PIN_MAX} dígitos.`)
  if (!hashDisponivel()) throw new Error("Este navegador não permite calcular o PIN (precisa de HTTPS).")
  const salt = paraHex(crypto.getRandomValues(new Uint8Array(16)))
  return { salt, hash: await derivar(pin, salt, ITERACOES), iteracoes: ITERACOES, tamanho: pin.length }
}

// ---------------------------------------------------------------------------
// Cache dos hashes no tablet
// ---------------------------------------------------------------------------

function lerCache(): Cache {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE_CACHE) || "{}")
    return c && typeof c === "object" ? (c as Cache) : {}
  } catch {
    return {}
  }
}

export function pessoaTemPin(funcionarioId: string): boolean {
  return !!lerCache()[funcionarioId]
}

export function tamanhoDoPin(funcionarioId: string): number {
  return lerCache()[funcionarioId]?.tamanho ?? 0
}

/**
 * Baixa os hashes e substitui o cache. Se falhar (sem rede, tabela ainda não
 * criada), o cache antigo continua valendo — o tablet nunca perde um PIN só
 * porque a internet caiu.
 */
export async function sincronizarPins(): Promise<void> {
  try {
    if (!supabase || (typeof navigator !== "undefined" && navigator.onLine === false)) return
    const { data, error } = await supabase.from(TABELA).select("funcionario_id, salt, hash, iteracoes, tamanho")
    if (error || !Array.isArray(data)) return
    const novo: Cache = {}
    for (const r of data as unknown as (PinGuardado & { funcionario_id: string })[]) {
      novo[r.funcionario_id] = { salt: r.salt, hash: r.hash, iteracoes: r.iteracoes, tamanho: r.tamanho }
    }
    localStorage.setItem(CHAVE_CACHE, JSON.stringify(novo))
  } catch {
    /* mantém o cache */
  }
}

// ---------------------------------------------------------------------------
// Bloqueio por tentativas
// ---------------------------------------------------------------------------

interface Erros {
  porPessoa: Record<string, { seguidos: number; travas: number; travadoAte: number }>
  /** Instantes (ms) dos erros recentes, de qualquer pessoa. */
  recentes: number[]
  globalAte: number
}

function lerErros(): Erros {
  try {
    const e = JSON.parse(localStorage.getItem(CHAVE_ERROS) || "null")
    if (e && typeof e === "object") return { porPessoa: e.porPessoa || {}, recentes: e.recentes || [], globalAte: e.globalAte || 0 }
  } catch {
    /* zera */
  }
  return { porPessoa: {}, recentes: [], globalAte: 0 }
}

function gravarErros(e: Erros) {
  try {
    localStorage.setItem(CHAVE_ERROS, JSON.stringify(e))
  } catch {
    /* sem localStorage: o bloqueio vale só até recarregar */
  }
}

/** Quanto falta (ms) para a pessoa poder tentar de novo; 0 = liberada. */
export function bloqueioRestanteMs(funcionarioId: string): number {
  const e = lerErros()
  const agora = Date.now()
  return Math.max(e.globalAte - agora, (e.porPessoa[funcionarioId]?.travadoAte ?? 0) - agora, 0)
}

export function tentativasRestantes(funcionarioId: string): number {
  return Math.max(0, ERROS_PARA_TRAVAR - (lerErros().porPessoa[funcionarioId]?.seguidos ?? 0))
}

export type ResultadoPin =
  | { ok: true }
  | { ok: false; restantes: number; bloqueadoMs: number }

/**
 * Confere o PIN. Nunca registra o PIN digitado em lugar nenhum — nem no log.
 * O log só sabe que houve um erro e de quem.
 */
export async function conferirPin(funcionarioId: string, pin: string): Promise<ResultadoPin> {
  const bloqueado = bloqueioRestanteMs(funcionarioId)
  if (bloqueado > 0) return { ok: false, restantes: 0, bloqueadoMs: bloqueado }

  const guardado = lerCache()[funcionarioId]
  if (!guardado) return { ok: false, restantes: tentativasRestantes(funcionarioId), bloqueadoMs: 0 }

  const certo = (await derivar(pin, guardado.salt, guardado.iteracoes)) === guardado.hash
  const e = lerErros()

  if (certo) {
    delete e.porPessoa[funcionarioId]
    gravarErros(e)
    return { ok: true }
  }

  const agora = Date.now()
  const p = e.porPessoa[funcionarioId] ?? { seguidos: 0, travas: 0, travadoAte: 0 }
  p.seguidos += 1
  e.recentes = [...e.recentes.filter((t) => agora - t < JANELA_GLOBAL_MS), agora]

  let bloqueadoMs = 0
  if (p.seguidos >= ERROS_PARA_TRAVAR) {
    bloqueadoMs = TRAVAS_MS[Math.min(p.travas, TRAVAS_MS.length - 1)]
    p.travadoAte = agora + bloqueadoMs
    p.travas += 1
    p.seguidos = 0
    logar("erro", "manual_pin_pessoa_bloqueada", null, { funcionario_id: funcionarioId, minutos: Math.round(bloqueadoMs / 60000) })
  }
  if (e.recentes.length >= ERROS_GLOBAIS) {
    e.globalAte = agora + TRAVA_GLOBAL_MS
    e.recentes = []
    bloqueadoMs = Math.max(bloqueadoMs, TRAVA_GLOBAL_MS)
    logar("fatal", "manual_pin_batida_manual_bloqueada", `${ERROS_GLOBAIS} PINs errados em 10 min`, {})
  }
  e.porPessoa[funcionarioId] = p
  gravarErros(e)

  logar("aviso", "manual_pin_errado", null, { funcionario_id: funcionarioId, restantes: Math.max(0, ERROS_PARA_TRAVAR - p.seguidos) })
  return { ok: false, restantes: Math.max(0, ERROS_PARA_TRAVAR - p.seguidos), bloqueadoMs }
}
