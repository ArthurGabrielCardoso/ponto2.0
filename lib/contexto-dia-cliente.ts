"use client"

import type { InfoClima } from "./clima"
import type { ContextoFeriados } from "./feriados"

/**
 * Cache no navegador do contexto do dia (clima + feriados).
 *
 * A tela de ponto aquece isto ao abrir e revalida de meia em meia hora, então
 * na hora da batida o dado já está em memória. Nada aqui pode bloquear a
 * batida: quem lê usa a versão síncrona e segue a vida se ainda não chegou.
 *
 * `import type` acima é de propósito — os módulos de clima e feriados são de
 * servidor (o date-holidays é pesado), e só os tipos atravessam para cá.
 */

export interface ContextoDia {
  clima: InfoClima | null
  feriados: ContextoFeriados | null
}

const VALIDADE_MS = 30 * 60 * 1000

let cache: { dados: ContextoDia; ts: number } | null = null
let buscaEmVoo: Promise<ContextoDia | null> | null = null

async function buscar(): Promise<ContextoDia | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch("/api/contexto-dia", { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const json = await res.json()
    return { clima: json?.clima ?? null, feriados: json?.feriados ?? null }
  } catch {
    return null
  }
}

/**
 * Dispara a atualização em segundo plano. Chamar ao montar a tela de ponto e
 * de tempos em tempos. Nunca lança.
 */
export function aquecerContextoDia(): void {
  if (cache && Date.now() - cache.ts < VALIDADE_MS) return
  if (buscaEmVoo) return

  buscaEmVoo = buscar().finally(() => {
    buscaEmVoo = null
  })

  buscaEmVoo
    .then((dados) => {
      if (dados) cache = { dados, ts: Date.now() }
    })
    .catch(() => {})
}

/**
 * Contexto já carregado, sem esperar nada. É o que o caminho da batida usa.
 * Devolve null enquanto a primeira busca não voltou.
 */
export function obterContextoDiaEmCache(): ContextoDia | null {
  return cache?.dados ?? null
}
