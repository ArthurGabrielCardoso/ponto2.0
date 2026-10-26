"use client"

import { supabase } from "@/lib/supabase"
import { logar } from "@/lib/log-tablet"

/**
 * Batidas DECLARADAS: o horário não veio do relógio.
 *
 * Quando alguém aparece às 15:23 sem ter batido a entrada nem o almoço, o
 * sistema pergunta e grava essas batidas com o horário da grade (ou o que a
 * pessoa ajustou). Em `registros_ponto` elas ficam iguais a qualquer outra — e
 * quem confere o dia depois não tem como saber o que foi medido e o que foi
 * declarado. Esta lista guarda isso, ligada à batida pelo par
 * (funcionario_id, data_hora).
 *
 * Como a evidência da batida manual, é independente do ponto: se a tabela não
 * existir ou a rede cair, a batida já foi registrada e a lista sobe depois.
 * O horário vai para o `localStorage` na hora (síncrono) e é reenviado até dar.
 */

const TABELA = "pontos_declarados"
const CHAVE_FILA = "vitall_declaradas_fila"
const MAX_FILA = 100

export type OrigemDeclarada = "grade" | "ajustado" | "sem_almoco"

export interface Declarada {
  funcionarioId: string
  nome: string
  /** Entrada | Saída Almoço | Retorno Almoço | Saída | "Sem almoço". */
  tipo: string
  /** O mesmo horário gravado em registros_ponto. */
  dataHoraIso: string
  origem: OrigemDeclarada
  /** A batida medida pelo relógio que motivou a declaração. */
  batidaRealIso: string
}

interface Item extends Declarada {
  id: string
}

let enviando = false
let pausadoAte = 0

function ler(): Item[] {
  try {
    const l = JSON.parse(localStorage.getItem(CHAVE_FILA) || "[]")
    return Array.isArray(l) ? (l as Item[]) : []
  } catch {
    return []
  }
}

function gravar(l: Item[]) {
  try {
    localStorage.setItem(CHAVE_FILA, JSON.stringify(l.slice(-MAX_FILA)))
  } catch {
    /* sem localStorage: só tenta uma vez */
  }
}

const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`

/** Guarda e tenta enviar. Nunca lança, nunca espera. */
export function registrarDeclaradas(itens: Declarada[]) {
  if (itens.length === 0) return
  gravar([...ler(), ...itens.map((i) => ({ ...i, id: novoId() }))])
  logar("info", "declaradas_enfileiradas", null, {
    quantidade: itens.length,
    origens: itens.map((i) => i.origem),
  })
  void sincronizarDeclaradas()
}

export function contarDeclaradasPendentes(): number {
  return ler().length
}

export async function sincronizarDeclaradas(): Promise<void> {
  if (enviando || !supabase || Date.now() < pausadoAte) return
  if (typeof navigator !== "undefined" && navigator.onLine === false) return
  const fila = ler()
  if (fila.length === 0) return

  enviando = true
  try {
    const { error } = await supabase.from(TABELA).upsert(
      fila.map((i) => ({
        id: i.id,
        funcionario_id: i.funcionarioId,
        nome_funcionario: i.nome,
        tipo: i.tipo,
        data_hora: i.dataHoraIso,
        origem: i.origem,
        batida_real_em: i.batidaRealIso,
        dispositivo: (navigator.userAgent || "").slice(0, 200),
      })) as never,
      { onConflict: "id", ignoreDuplicates: true }
    )
    if (error) {
      // Tabela ainda não criada, ou sem rede: tenta de novo mais tarde.
      pausadoAte = Date.now() + 5 * 60_000
      logar("aviso", "declaradas_nao_gravadas", (error as Error).message)
      return
    }
    const enviados = new Set(fila.map((i) => i.id))
    gravar(ler().filter((i) => !enviados.has(i.id)))
  } catch {
    pausadoAte = Date.now() + 5 * 60_000
  } finally {
    enviando = false
  }
}
