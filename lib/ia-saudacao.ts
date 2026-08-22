"use client"

import { ContextoSaudacao, gerarSaudacaoLocal } from "./gerador-falas"

export interface RespostaSaudacao {
  visual: string
  voz: string
  origem?: string
}

/**
 * Obtém a saudação visual e por voz mais inteligente para o colaborador.
 * Tenta a IA do Groq com timeout rápido e fallback transparente para o catálogo local.
 */
export async function obterSaudacaoInteligente(ctx: ContextoSaudacao): Promise<RespostaSaudacao> {
  if (typeof window === "undefined") {
    return gerarSaudacaoLocal(ctx)
  }

  try {
    const controller = new AbortController()
    // 1.8 segundos de limite total do cliente para a experiência ser ultra ágil
    const timeoutId = setTimeout(() => controller.abort(), 1800)

    const res = await fetch("/api/groq-saudacao", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nome: ctx.nome,
        tipoPonto: ctx.tipoPonto,
        dataHora: (ctx.dataHora || new Date()).toISOString(),
        trabalhaSabado: ctx.trabalhaSabado,
        humor: ctx.humor,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (data.visual && data.voz) {
        return {
          visual: data.visual,
          voz: data.voz,
          origem: data.origem || "groq_ia",
        }
      }
    }

    return gerarSaudacaoLocal(ctx)
  } catch {
    // Em caso de falha de rede ou timeout, catálogo local instantâneo
    return gerarSaudacaoLocal(ctx)
  }
}
