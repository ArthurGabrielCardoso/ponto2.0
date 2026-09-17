"use client"

import { obterSaudacaoInteligente, gerarSaudacaoLocalDoDia, type RespostaSaudacao } from "./ia-saudacao"
import { prepararVozSaudacao, vozEstaPronta } from "./tts-audio"
import type { Funcionario } from "./types"

/**
 * DESPENSA DE SAUDAÇÕES
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * A voz às vezes não saía. A causa não era o áudio: era o RELÓGIO.
 *
 * Até aqui, a frase da saudação era escrita pela IA e convertida em MP3 no
 * instante da batida. Isso funcionava quando a batida levava 25 segundos —
 * sobrava tempo de rede dentro da própria espera. Com a batida em ~4 s, e em
 * ~1 s até a identificação, o pedido ao Google chega atrasado: a tela de
 * sucesso já entrou e o MP3 ainda está vindo.
 *
 * O caminho de escape era falar com a voz do navegador. Só que num WebView do
 * Fully Kiosk o `speechSynthesis` normalmente não tem nenhuma voz instalada —
 * `getVoices()` volta vazio, o pedido é engolido, e todo erro no caminho é
 * silencioso. Daí "às vezes não fala".
 *
 * A SAÍDA
 *
 * Parar de gerar na hora. Gerar MUITO antes, enquanto não há ninguém, e manter
 * um estoque pronto — frase e MP3 já baixado. Quando a pessoa bate o ponto,
 * não há nada a produzir: só escolher e tocar.
 *
 * A VARIEDADE NÃO SE PERDE
 *
 * Era a razão de existir da IA e continua sendo. A diferença é só QUANDO ela
 * escreve. Cada funcionária tem várias frases distintas guardadas por tipo de
 * ponto; cada batida consome uma, e quando o estoque baixa a despensa se
 * reabastece com frases novas. Quem bate o ponto cinco dias seguidos ouve
 * cinco frases diferentes, como hoje.
 *
 * POR QUE NÃO UM CRON NO SERVIDOR
 *
 * Foi considerado e não é necessário. O tablet fica ligado o dia inteiro — a
 * telemetria mostrou a mesma página de pé por 17 horas seguidas. Ele é o
 * próprio agendador, sem tabela nova, sem rota nova e sem segredo de cron para
 * configurar. Se o app reiniciar, a despensa se refaz em segundo plano em
 * poucos segundos, muito antes de a primeira pessoa chegar.
 *
 * O reabastecimento é periódico e não só no início do dia de propósito: a
 * saudação comenta o clima, e clima gerado às 5 da manhã não serve para a
 * saída das 18h.
 */

interface SaudacaoGuardada {
  visual: string
  voz: string
  /** Só entra na despensa depois que o MP3 está em memória. */
  audioPronto: boolean
  criadaEm: number
}

/** chave = `${funcionarioId}|${tipoPonto}` */
const despensa = new Map<string, SaudacaoGuardada[]>()

/**
 * Quantas frases guardar por pessoa por tipo de ponto.
 *
 * Três é o equilíbrio: cobre o dia de uma pessoa que bate o mesmo tipo mais de
 * uma vez (correções, testes) e mantém o custo baixo. Com 5 funcionárias e 4
 * tipos, são 60 frases — 60 chamadas ao TTS por reabastecimento, cerca de 2 MB
 * de MP3 na memória do tablet.
 */
const POR_COMBINACAO = 3

/**
 * Tipos de ponto que valem estoque.
 *
 * As strings têm que bater exatamente com as que `analisarSituacaoPonto`
 * devolve, senão a despensa enche de frases que ninguém procura.
 */
export const TIPOS_DE_PONTO = ["Entrada", "Saída Almoço", "Volta Almoço", "Saída"] as const

/**
 * Espera entre uma geração e outra.
 *
 * O abastecimento roda com a sala vazia, então não tem pressa nenhuma — e tem
 * um bom motivo para ir devagar: são dezenas de chamadas seguidas ao Groq e ao
 * Google TTS. Disparar todas de uma vez convida a limite de taxa, e o tablet
 * ainda está com a câmera e o reconhecimento rodando por baixo. 400 ms entre
 * uma e outra deixa 60 frases prontas em menos de um minuto, o que é
 * instantâneo na escala de "antes de alguém chegar".
 */
const INTERVALO_ENTRE_GERACOES_MS = 400

let abastecendo = false

function chave(funcionarioId: string, tipoPonto: string) {
  return `${funcionarioId}|${tipoPonto}`
}

/**
 * Pega uma saudação pronta e a consome.
 *
 * Devolve `null` quando não há nada guardado — e quem chama precisa tratar
 * isso, porque é o caso de o app ter acabado de abrir ou de o estoque daquela
 * combinação ter secado.
 *
 * Só entrega frase cujo MP3 esteja confirmadamente em memória. Entregar uma
 * frase sem áudio seria reintroduzir exatamente o problema que esta despensa
 * existe para resolver.
 */
export function pegarSaudacaoPronta(
  funcionarioId: string,
  tipoPonto: string
): RespostaSaudacao | null {
  const fila = despensa.get(chave(funcionarioId, tipoPonto))
  if (!fila || fila.length === 0) return null

  const i = fila.findIndex((s) => s.audioPronto && vozEstaPronta(s.voz))
  if (i === -1) return null

  const [escolhida] = fila.splice(i, 1)
  return { visual: escolhida.visual, voz: escolhida.voz, origem: "despensa" }
}

/** Quantas frases com áudio pronto existem agora, para log e telemetria. */
export function tamanhoDaDespensa(): number {
  let n = 0
  for (const fila of despensa.values()) n += fila.filter((s) => s.audioPronto).length
  return n
}

async function guardarUma(func: Funcionario, tipoPonto: string): Promise<boolean> {
  try {
    const ctx = {
      nome: func.nome,
      tipoPonto,
      dataHora: new Date(),
      trabalhaSabado: !!func.horarios?.sabado?.ativo,
    }

    // A IA escreve; se ela falhar ou demorar, o catálogo local assume. Aqui a
    // espera é barata — ninguém está na frente do tablet esperando.
    let saudacao: RespostaSaudacao
    try {
      saudacao = await obterSaudacaoInteligente(ctx)
    } catch {
      saudacao = gerarSaudacaoLocalDoDia(ctx)
    }
    if (!saudacao?.voz) return false

    // Frase repetida não vale estoque: seria a mesma voz duas vezes.
    const k = chave(func.id, tipoPonto)
    const fila = despensa.get(k) ?? []
    if (fila.some((s) => s.voz === saudacao.voz)) return false

    // O MP3 vem ANTES de a frase entrar na despensa. É esta ordem que garante
    // que toda frase entregue tenha voz.
    await prepararVozSaudacao(saudacao.voz)
    if (!vozEstaPronta(saudacao.voz)) return false

    fila.push({
      visual: saudacao.visual,
      voz: saudacao.voz,
      audioPronto: true,
      criadaEm: Date.now(),
    })
    despensa.set(k, fila)
    return true
  } catch {
    // Abastecer é adiantamento: falhar aqui não pode derrubar nada.
    return false
  }
}

/**
 * Repõe o estoque de quem estiver abaixo do mínimo.
 *
 * Roda em segundo plano e sem `await` de quem chama. Só uma execução por vez —
 * duas ao mesmo tempo gerariam frases repetidas e dobrariam as chamadas de
 * rede à toa.
 */
export async function abastecerDespensa(funcionarios: Funcionario[]): Promise<void> {
  if (abastecendo || funcionarios.length === 0) return
  abastecendo = true
  const t0 = Date.now()
  let geradas = 0

  try {
    for (const func of funcionarios) {
      for (const tipo of TIPOS_DE_PONTO) {
        const fila = despensa.get(chave(func.id, tipo)) ?? []
        const faltam = POR_COMBINACAO - fila.filter((s) => s.audioPronto).length
        for (let i = 0; i < faltam; i++) {
          if (await guardarUma(func, tipo)) geradas++
          await new Promise((r) => setTimeout(r, INTERVALO_ENTRE_GERACOES_MS))
        }
      }
    }
    if (geradas > 0) {
      console.log(
        `🗣️ Despensa: +${geradas} saudações com voz em ${Math.round((Date.now() - t0) / 1000)}s ` +
          `(total pronto: ${tamanhoDaDespensa()})`
      )
    }
  } finally {
    abastecendo = false
  }
}

/**
 * Descarta o que foi gerado em outro dia.
 *
 * Uma frase de ontem fala do clima de ontem e pode desejar bom feriado num dia
 * comum. O `URL.createObjectURL` do MP3 correspondente fica no cache do módulo
 * de voz, que é pequeno e some no próximo reload — não vale um mecanismo de
 * limpeza próprio.
 */
export function descartarSaudacoesDeOntem(): void {
  const hoje = new Date().toDateString()
  for (const [k, fila] of despensa) {
    const doDia = fila.filter((s) => new Date(s.criadaEm).toDateString() === hoje)
    if (doDia.length !== fila.length) despensa.set(k, doDia)
  }
}
