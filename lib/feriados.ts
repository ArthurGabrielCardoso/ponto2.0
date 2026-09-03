/**
 * Feriados que valem para quem bate ponto em Mogi das Cruzes.
 *
 * Três camadas somadas:
 *  - nacionais e estaduais de SP, vindos do pacote `date-holidays` (BR-SP);
 *  - 20 de novembro, que a Lei 14.759/2023 tornou feriado nacional e o pacote
 *    ainda não devolve em todos os anos;
 *  - os municipais de Mogi, que nenhuma biblioteca genérica conhece.
 *
 * Módulo de servidor: `date-holidays` é pesado demais para ir no bundle do
 * tablet. Quem consome isto é a rota /api/contexto-dia.
 */

import Holidays from "date-holidays"

export type EscopoFeriado = "nacional" | "estadual" | "municipal"
export type ClasseFeriado = "feriado" | "ponto-facultativo" | "comemorativo"

export interface InfoFeriado {
  data: string // YYYY-MM-DD
  nome: string
  escopo: EscopoFeriado
  classe: ClasseFeriado
}

export interface ContextoFeriados {
  /** Feriado de hoje, se houver. */
  hoje: InfoFeriado | null
  /** Feriado de amanhã — serve para a IA desejar uma boa véspera. */
  amanha: InfoFeriado | null
  /** Próximo feriado à frente e a distância em dias. */
  proximo: { feriado: InfoFeriado; emDias: number } | null
}

/**
 * Feriados municipais de Mogi das Cruzes (datas fixas).
 * Sant'Ana é a padroeira (Lei Municipal 3.125/1986) e 1º de setembro é o
 * aniversário da cidade (Lei Municipal 1.585/1966).
 */
const MUNICIPAIS_MOGI: Array<{ mes: number; dia: number; nome: string }> = [
  { mes: 7, dia: 26, nome: "Sant'Ana, padroeira de Mogi das Cruzes" },
  { mes: 9, dia: 1, nome: "Aniversário de Mogi das Cruzes" },
]

function chaveData(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function classificar(tipo: string | undefined): ClasseFeriado {
  if (tipo === "public") return "feriado"
  if (tipo === "bank" || tipo === "optional") return "ponto-facultativo"
  return "comemorativo"
}

/**
 * Feriados estaduais de SP conhecidos, para marcar o escopo certo.
 * O `date-holidays` devolve tudo junto sem dizer o que é estadual.
 */
const NOMES_ESTADUAIS_SP = ["revolução constitucionalista", "revolucao constitucionalista"]

function escopoDe(nome: string): EscopoFeriado {
  const n = nome.toLowerCase()
  return NOMES_ESTADUAIS_SP.some((e) => n.includes(e)) ? "estadual" : "nacional"
}

/** Monta a lista completa de feriados de um ano, já ordenada por data. */
function listarAno(ano: number): InfoFeriado[] {
  const porData = new Map<string, InfoFeriado>()

  try {
    const hd = new Holidays("BR", "SP")
    for (const h of hd.getHolidays(ano) || []) {
      const data = String(h.date || "").slice(0, 10)
      if (!data) continue
      const nome = String(h.name || "").trim()
      if (!nome) continue
      porData.set(data, {
        data,
        nome,
        escopo: escopoDe(nome),
        classe: classificar(h.type as string),
      })
    }
  } catch (e) {
    console.warn("[feriados] date-holidays falhou, seguindo só com as datas fixas:", e)
  }

  // 20/11 virou feriado nacional pela Lei 14.759/2023; o pacote nem sempre traz.
  const consciencia = `${ano}-11-20`
  if (!porData.has(consciencia)) {
    porData.set(consciencia, {
      data: consciencia,
      nome: "Dia Nacional de Zumbi e da Consciência Negra",
      escopo: "nacional",
      classe: "feriado",
    })
  }

  // Municipais sobrescrevem: em Mogi eles são feriado, mesmo que a data já
  // apareça na lista genérica como simples data comemorativa.
  for (const m of MUNICIPAIS_MOGI) {
    const data = `${ano}-${String(m.mes).padStart(2, "0")}-${String(m.dia).padStart(2, "0")}`
    porData.set(data, {
      data,
      nome: m.nome,
      escopo: "municipal",
      classe: "feriado",
    })
  }

  return [...porData.values()].sort((a, b) => a.data.localeCompare(b.data))
}

const cachePorAno = new Map<number, InfoFeriado[]>()

function feriadosDoAno(ano: number): InfoFeriado[] {
  const emCache = cachePorAno.get(ano)
  if (emCache) return emCache
  const lista = listarAno(ano)
  cachePorAno.set(ano, lista)
  return lista
}

function somarDias(d: Date, dias: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + dias)
  return r
}

/**
 * Contexto de feriados para uma data — o que a IA precisa saber para falar
 * algo pertinente sem inventar.
 */
export function obterContextoFeriados(referencia: Date = new Date()): ContextoFeriados {
  const hojeStr = chaveData(referencia)
  const amanhaStr = chaveData(somarDias(referencia, 1))

  // Dois anos, para que em dezembro o "próximo feriado" ache o Ano Novo.
  const lista = [
    ...feriadosDoAno(referencia.getFullYear()),
    ...feriadosDoAno(referencia.getFullYear() + 1),
  ]

  const hoje = lista.find((f) => f.data === hojeStr) || null
  const amanha = lista.find((f) => f.data === amanhaStr) || null

  // Só feriados de verdade contam como "próximo" — data comemorativa não
  // interessa para quem quer saber quando folga.
  const futuros = lista.filter((f) => f.data > hojeStr && f.classe === "feriado")
  let proximo: ContextoFeriados["proximo"] = null

  if (futuros.length > 0) {
    const alvo = futuros[0]
    const [a, m, d] = alvo.data.split("-").map(Number)
    const dataAlvo = new Date(a, m - 1, d)
    const inicioHoje = new Date(
      referencia.getFullYear(),
      referencia.getMonth(),
      referencia.getDate()
    )
    const emDias = Math.round((dataAlvo.getTime() - inicioHoje.getTime()) / 86400000)
    proximo = { feriado: alvo, emDias }
  }

  return { hoje, amanha, proximo }
}
