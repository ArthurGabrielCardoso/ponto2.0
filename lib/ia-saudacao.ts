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
 * Feriado só vira assunto em dois momentos, e em nenhum outro:
 *
 *  - na ÚLTIMA batida do dia, quando amanhã é feriado — aí cabe desejar bom feriado;
 *  - na PRIMEIRA batida depois do feriado — aí cabe perguntar como foi.
 *
 * Fora disso a IA fica quieta. Anunciar "o próximo feriado é em 4 dias" em toda
 * batida cansa em dois dias de uso.
 *
 * Devolve duas coisas diferentes de propósito: `instrucao` é o que vai no prompt
 * da IA, e `frase` é o que o catálogo local fala. Misturar as duas faz o sistema
 * dizer em voz alta "Deseje um excelente feriado ao se despedir".
 */
export function resumirFeriados(
  f: ContextoFeriados | null,
  tipoPonto: string
): { instrucao?: string; frase?: string; vespera?: boolean } {
  if (!f) return {}

  const tipo = (tipoPonto || "").toLowerCase()
  const ehUltimaBatida = tipo.includes("saída") && !tipo.includes("almoço")
  const ehPrimeiraBatida = tipo.includes("entrada")

  if (ehUltimaBatida && f.amanha && f.amanha.classe === "feriado") {
    const frases = [
      `Amanhã é ${f.amanha.nome}, então excelente feriado para você!`,
      `E amanhã é feriado de ${f.amanha.nome}. Aproveite muito!`,
      `Amanhã tem feriado, ${f.amanha.nome}. Excelente descanso!`,
    ]
    return {
      instrucao: `Amanhã é feriado (${f.amanha.nome}). Deseje um excelente feriado ao se despedir, em poucas palavras.`,
      frase: frases[Math.floor(Math.random() * frases.length)],
      vespera: true,
    }
  }

  if (ehPrimeiraBatida && f.ontem && f.ontem.classe === "feriado") {
    const frases = [
      `E aí, como foi o feriado?`,
      `Espero que o feriado de ontem tenha sido excelente!`,
      `Como foi o feriado de ontem? Bora retomar com tudo!`,
    ]
    return {
      instrucao: `Ontem foi feriado (${f.ontem.nome}). Pergunte de forma leve e rápida como foi o feriado.`,
      frase: frases[Math.floor(Math.random() * frases.length)],
    }
  }

  return {}
}

/**
 * Junta ao contexto do ponto o que já sabemos do dia: clima de Mogi das Cruzes
 * e feriados por perto. Tudo vem do cache em memória — nada é buscado aqui,
 * porque esta função roda no caminho da batida.
 */
function enriquecerComContextoDoDia(ctx: ContextoSaudacao): ContextoSaudacao {
  const dia = obterContextoDiaEmCache()
  if (!dia) return ctx

  // O tempo só entra quando merece comentário (chuva forte, frio ou calor), e
  // mesmo assim não em toda batida: variar é o que impede a fala de virar
  // jingle repetido. Nas batidas de almoço ele não entra nunca — quem sai para
  // comer e volta em uma hora não precisa de previsão do tempo.
  const tipo = (ctx.tipoPonto || "").toLowerCase()
  const ehAlmoco = tipo.includes("almoço") || tipo.includes("almoco")
  const climaVale = !ehAlmoco && !!dia.clima?.relevante && Math.random() < 0.5
  const feriado = resumirFeriados(dia.feriados, ctx.tipoPonto)

  return {
    ...ctx,
    climaResumo: climaVale ? dia.clima?.resumo : undefined,
    climaFrase: climaVale ? dia.clima?.frase ?? undefined : undefined,
    climaEmoji: climaVale ? dia.clima?.emoji : undefined,
    feriadoResumo: feriado.instrucao,
    feriadoFrase: feriado.frase,
    vesperaDeFeriado: feriado.vespera,
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
        feriadoFrase: ctx.feriadoFrase,
        vesperaDeFeriado: ctx.vesperaDeFeriado,
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
