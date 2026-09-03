"use client"

import { ContextoSaudacao, gerarSaudacaoLocal } from "./gerador-falas"
import { obterContextoDiaEmCache } from "./contexto-dia-cliente"
import type { ContextoFeriados } from "./feriados"

export interface RespostaSaudacao {
  visual: string
  voz: string
  origem?: string
}

/**
 * Transforma o contexto de feriados em uma frase que a IA (ou o catálogo local)
 * consegue usar sem inventar data.
 */
function resumirFeriados(f: ContextoFeriados | null): string | undefined {
  if (!f) return undefined

  if (f.hoje && f.hoje.classe === "feriado") {
    return `Hoje é feriado ${f.hoje.escopo}: ${f.hoje.nome}.`
  }
  if (f.hoje) {
    return `Hoje é ${f.hoje.nome}.`
  }
  if (f.amanha && f.amanha.classe === "feriado") {
    return `Amanhã é feriado ${f.amanha.escopo}: ${f.amanha.nome}.`
  }
  if (f.proximo && f.proximo.emDias <= 10) {
    const dias = f.proximo.emDias
    const quando = dias === 1 ? "amanhã" : `em ${dias} dias`
    return `O próximo feriado é ${f.proximo.feriado.nome}, ${quando}.`
  }
  return undefined
}

/**
 * Junta ao contexto do ponto o que já sabemos do dia: clima de Mogi das Cruzes
 * e feriados por perto. Tudo vem do cache em memória — nada é buscado aqui,
 * porque esta função roda no caminho da batida.
 */
function enriquecerComContextoDoDia(ctx: ContextoSaudacao): ContextoSaudacao {
  const dia = obterContextoDiaEmCache()
  if (!dia) return ctx

  return {
    ...ctx,
    climaResumo: dia.clima?.resumo,
    climaFrase: dia.clima?.frase,
    climaEmoji: dia.clima?.emoji,
    feriadoResumo: resumirFeriados(dia.feriados),
  }
}

/**
 * Saudação instantânea do catálogo local, já temperada com clima e feriado do
 * cache. É o caminho usado quando não deu tempo de pedir para a IA — sem rede,
 * sem espera.
 */
export function gerarSaudacaoLocalDoDia(ctx: ContextoSaudacao): RespostaSaudacao {
  return gerarSaudacaoLocal(enriquecerComContextoDoDia(ctx))
}

/**
 * Obtém a saudação visual e por voz mais inteligente para o colaborador.
 * Tenta a IA do Groq com timeout rápido e fallback transparente para o catálogo local.
 */
export async function obterSaudacaoInteligente(
  ctxOriginal: ContextoSaudacao
): Promise<RespostaSaudacao> {
  const ctx = enriquecerComContextoDoDia(ctxOriginal)

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
        climaResumo: ctx.climaResumo,
        climaFrase: ctx.climaFrase,
        climaEmoji: ctx.climaEmoji,
        feriadoResumo: ctx.feriadoResumo,
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
