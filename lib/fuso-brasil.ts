/**
 * Formatacao de data e hora no fuso da clinica.
 *
 * Existe por um motivo especifico: as telas montadas no SERVIDOR. A Vercel roda
 * os containers em UTC, entao um `toLocaleTimeString("pt-BR")` sem fuso
 * explicito sai tres horas adiantado — uma batida das 15:30 aparece como 18:30.
 * No tablet isso nunca apareceu porque la quem formata e o navegador, que ja
 * esta no fuso certo.
 *
 * Toda pagina renderizada no servidor deve formatar por aqui, nunca pelo
 * toLocale* direto.
 */
export const FUSO_CLINICA = "America/Sao_Paulo"

export function horaDoDia(data: Date | string): string {
  return new Date(data).toLocaleTimeString("pt-BR", {
    timeZone: FUSO_CLINICA,
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function diaEMes(data: Date | string): string {
  return new Date(data).toLocaleDateString("pt-BR", {
    timeZone: FUSO_CLINICA,
    day: "2-digit",
    month: "2-digit",
  })
}

export function diaDaSemana(data: Date | string): string {
  return new Date(data).toLocaleDateString("pt-BR", {
    timeZone: FUSO_CLINICA,
    weekday: "long",
  })
}

export function mesEAno(data: Date | string): string {
  return new Date(data).toLocaleDateString("pt-BR", {
    timeZone: FUSO_CLINICA,
    month: "long",
    year: "numeric",
  })
}

/**
 * A data civil no fuso da clinica, como "2026-09-14".
 *
 * E com isto que se compara "e o mesmo dia?": comparar getDate() de dois
 * objetos Date usa o fuso do servidor, e uma batida das 22h em Mogi ja e o dia
 * seguinte em UTC — ela cairia no dia errado.
 */
export function diaCivil(data: Date | string): string {
  return new Date(data).toLocaleDateString("en-CA", { timeZone: FUSO_CLINICA })
}

export function ehMesmoDiaNaClinica(a: Date | string, b: Date | string): boolean {
  return diaCivil(a) === diaCivil(b)
}
