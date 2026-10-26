/**
 * Os tipos de batida e o "Outro".
 *
 * O campo `registros_ponto.tipo` é texto livre, e o resto do sistema (saudação,
 * lembretes de almoço, cores, tela de sucesso) decide o que fazer procurando
 * palavras dentro dele — `includes("almoço")`, `includes("retorno")`. Isso
 * funciona para os quatro tipos fixos e quebra no instante em que a pessoa
 * pode escrever um motivo: "Outro: voltei do almoço do cliente" seria lido
 * como retorno de almoço.
 *
 * Por isso o "Outro" tem um prefixo próprio e TODO código que olha palavras no
 * tipo passa antes por `ehTipoOutro`. O motivo escrito nunca é interpretado.
 *
 * Formato gravado:
 *
 *     Outro - saindo: Banco
 *     Outro - voltando: Banco
 *
 * O cálculo de horas não olha o texto: pareia as batidas por posição
 * (entra/sai alternados). Uma saída para resolver algo e a volta depois
 * fecham um par como qualquer outro, sem nenhuma mudança nos relatórios.
 */

export const TIPOS_FIXOS = ["Entrada", "Saída Almoço", "Retorno Almoço", "Saída"] as const
export type TipoFixo = (typeof TIPOS_FIXOS)[number]

export type DirecaoOutro = "saindo" | "voltando"

const PREFIXO_OUTRO = "outro"
export const MOTIVO_MAX = 60

export function ehTipoOutro(tipo?: string | null): boolean {
  return (tipo || "").trim().toLowerCase().startsWith(PREFIXO_OUTRO)
}

/** Limpa o que a pessoa digitou: sem quebra de linha, sem excesso, sem espaços soltos. */
export function limparMotivo(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().slice(0, MOTIVO_MAX)
}

export function montarTipoOutro(direcao: DirecaoOutro, motivo: string): string {
  const m = limparMotivo(motivo)
  return m ? `Outro - ${direcao}: ${m}` : `Outro - ${direcao}`
}

export function direcaoDoOutro(tipo?: string | null): DirecaoOutro | null {
  if (!ehTipoOutro(tipo)) return null
  const t = (tipo || "").toLowerCase()
  // Só olha o trecho entre o prefixo e os dois-pontos, nunca o motivo.
  const cabeca = t.split(":")[0]
  if (cabeca.includes("voltando")) return "voltando"
  return "saindo"
}

export function motivoDoOutro(tipo?: string | null): string {
  if (!ehTipoOutro(tipo)) return ""
  const i = (tipo || "").indexOf(":")
  return i === -1 ? "" : (tipo || "").slice(i + 1).trim()
}

/**
 * O tipo que as telas devem usar para escolher cor, ilustração e frase.
 *
 * "Outro - voltando" se comporta como um retorno (tom de volta ao trabalho);
 * "Outro - saindo" cai no cenário padrão de despedida. Os quatro tipos fixos
 * passam sem alteração.
 */
export function tipoParaEstilo(tipo?: string | null): string {
  if (!ehTipoOutro(tipo)) return tipo || ""
  return direcaoDoOutro(tipo) === "voltando" ? "Retorno Almoço" : "Saída"
}
