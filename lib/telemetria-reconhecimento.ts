"use client"

import { supabase } from "@/lib/supabase"

/**
 * Telemetria do reconhecimento facial no tablet.
 *
 * Por que existe: as queixas sobre o reconhecimento — "às vezes é lento", "de
 * três em três horas demora", "mexo a cabeça e desreconhece" — são todas
 * anedóticas, e ajustar número no escuro é chute. Isto grava o que de fato
 * acontece em cada tentativa, no uso real, ao longo do dia.
 *
 * TRÊS REGRAS QUE NÃO SE QUEBRAM AQUI:
 *
 * 1. NUNCA atrasa a batida. Tudo é disparado e esquecido, fora do caminho
 *    crítico. Um ponto jamais espera por telemetria.
 * 2. NUNCA derruba nada. Todo erro é engolido. Se o Supabase estiver fora, a
 *    medição se perde — e só.
 * 3. NUNCA guarda biometria. Nada de descritor, foto, landmark ou localização.
 *    Só tempos, contadores e a distância numérica da comparação. Nada aqui
 *    reconstrói um rosto.
 *
 * Uma linha por TENTATIVA, não por quadro. O loop roda a ~5-10 quadros por
 * segundo; gravar quadro a quadro encheria a tabela e deixaria o tablet mais
 * lento justamente enquanto mede lentidão.
 */

export type Desfecho = "ponto_batido" | "desistiu" | "nao_identificado"

interface Medida {
  inicio: number
  identificadoEm?: number
  sorriuEm?: number
  telaSucessoEm?: number

  passesBaratos: number[]
  passesCompletos: number[]
  msConsultaRegistros?: number
  msSaudacaoIa?: number

  /** Ms que a rede pesada passou parada antes desta tentativa. */
  msOcioso?: number | null
  /** Ms desde a última batida concluída neste tablet. */
  msDesdeUltimoPonto?: number | null

  falhasDesconhecido: number
  perdasIdentidade: number
  menorDistancia?: number
  maiorDistanciaAceita?: number
  limiar?: number

  funcionarioId?: string
  tipoPonto?: string
}

let atual: Medida | null = null
let ambiente: { backend: string; gpu: string; userAgent: string } | null = null

/**
 * Instante da última batida concluída, para medir o intervalo entre uma e
 * outra. Existe por uma queixa específica: duas batidas seguidas são
 * instantâneas, mas a primeira depois de horas parada demora. Sem gravar esse
 * intervalo, "estava parado há muito tempo" continua sendo impressão; com ele,
 * dá para cruzar o intervalo contra o tempo do passe e ver se a relação é real.
 */
let ultimoPontoEm: number | null = null

/** Mediana. Resistente ao primeiro quadro, que é sempre o mais lento. */
function p50(v: number[]): number | null {
  if (v.length === 0) return null
  const o = [...v].sort((a, b) => a - b)
  return Math.round(o[Math.floor(o.length / 2)])
}

/**
 * Nome da GPU via WebGL. Serve para separar os tablets uns dos outros quando
 * houver mais de um, e para saber se o driver é o mesmo do problema.
 */
function descobrirGpu(): string {
  try {
    const c = document.createElement("canvas")
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null
    if (!gl) return "sem-webgl"
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).slice(0, 120) : "renderer-oculto"
  } catch {
    return "desconhecida"
  }
}

export function iniciarAmbiente(backend: string) {
  ambiente = {
    backend: backend || "desconhecido",
    gpu: descobrirGpu(),
    userAgent: (navigator.userAgent || "").slice(0, 200),
  }
}

/** Um rosto apareceu na frente do tablet: começa a cronometrar. */
export function iniciarTentativa() {
  if (atual) return // já há uma em andamento
  atual = {
    inicio: performance.now(),
    msDesdeUltimoPonto:
      ultimoPontoEm === null ? null : Math.round(performance.now() - ultimoPontoEm),
    passesBaratos: [],
    passesCompletos: [],
    falhasDesconhecido: 0,
    perdasIdentidade: 0,
  }
}

/** Quanto tempo a rede pesada ficou sem rodar antes desta tentativa. */
export function registrarOciosidade(ms: number | null) {
  if (atual) atual.msOcioso = ms === null ? null : Math.round(ms)
}

export function registrarPasseBarato(ms: number) {
  if (atual && atual.passesBaratos.length < 400) atual.passesBaratos.push(ms)
}

export function registrarPasseCompleto(ms: number) {
  if (atual && atual.passesCompletos.length < 400) atual.passesCompletos.push(ms)
}

/**
 * Resultado de um passe completo. `distancia` vem mesmo quando não bateu — é
 * justamente o caso interessante: uma rejeição a 0.47 com limiar 0.45 diz que
 * o corte está apertado; a 0.9 diz que era outra pessoa mesmo.
 */
export function registrarComparacao(bateu: boolean, distancia?: number, limiar?: number) {
  if (!atual) return
  if (limiar !== undefined) atual.limiar = limiar
  if (distancia === undefined) return
  if (atual.menorDistancia === undefined || distancia < atual.menorDistancia) {
    atual.menorDistancia = distancia
  }
  if (bateu) {
    if (atual.maiorDistanciaAceita === undefined || distancia > atual.maiorDistanciaAceita) {
      atual.maiorDistanciaAceita = distancia
    }
  } else {
    atual.falhasDesconhecido += 1
  }
}

export function registrarPerdaDeIdentidade() {
  if (atual) atual.perdasIdentidade += 1
}

export function registrarIdentificacao(funcionarioId: string) {
  if (!atual) return
  atual.funcionarioId = funcionarioId
  if (atual.identificadoEm === undefined) atual.identificadoEm = performance.now()
}

export function registrarSorriso() {
  if (atual && atual.sorriuEm === undefined) atual.sorriuEm = performance.now()
}

export function registrarConsultaRegistros(ms: number) {
  if (atual) atual.msConsultaRegistros = Math.round(ms)
}

export function registrarSaudacaoIa(ms: number) {
  if (atual) atual.msSaudacaoIa = Math.round(ms)
}

export function registrarTelaSucesso(tipoPonto: string) {
  if (!atual) return
  atual.tipoPonto = tipoPonto
  atual.telaSucessoEm = performance.now()
}

/**
 * Fecha a tentativa e manda para o Supabase sem esperar resposta.
 *
 * `void` no insert é deliberado: quem chama segue a vida no mesmo instante.
 */
export function encerrarTentativa(desfecho: Desfecho, modoTeste = false) {
  const m = atual
  atual = null
  if (!m) return

  // Tentativa sem nenhum passe completo é ruído — rosto que passou de raspão
  // na frente da câmera. Não vale uma linha.
  if (m.passesCompletos.length === 0 && desfecho !== "ponto_batido") return

  const fim = performance.now()
  if (desfecho === "ponto_batido") ultimoPontoEm = fim
  const ms = (de?: number, ate?: number) =>
    de !== undefined && ate !== undefined ? Math.round(ate - de) : null

  const linha = {
    funcionario_id: m.funcionarioId ?? null,
    tipo_ponto: m.tipoPonto ?? null,
    desfecho,
    backend: ambiente?.backend ?? null,
    gpu: ambiente?.gpu ?? null,
    user_agent: ambiente?.userAgent ?? null,
    modo_teste: modoTeste,
    ms_ate_identificar: ms(m.inicio, m.identificadoEm),
    ms_ate_sorrir: ms(m.identificadoEm, m.sorriuEm),
    ms_ate_tela_sucesso: ms(m.sorriuEm, m.telaSucessoEm),
    ms_total: Math.round(fim - m.inicio),
    ms_passe_barato_p50: p50(m.passesBaratos),
    ms_passe_completo_p50: p50(m.passesCompletos),
    // O primeiro passe separado da mediana é o que distingue "a GPU estava
    // fria e o primeiro olhar pagou a conta" de "este tablet é lento o tempo
    // todo". Só com a mediana os dois casos têm a mesma cara.
    ms_primeiro_passe_completo:
      m.passesCompletos.length > 0 ? Math.round(m.passesCompletos[0]) : null,
    ms_ocioso_antes: m.msOcioso ?? null,
    ms_desde_ultimo_ponto: m.msDesdeUltimoPonto ?? null,
    ms_consulta_registros: m.msConsultaRegistros ?? null,
    ms_saudacao_ia: m.msSaudacaoIa ?? null,
    passes_baratos: m.passesBaratos.length,
    passes_completos: m.passesCompletos.length,
    falhas_desconhecido: m.falhasDesconhecido,
    perdas_identidade: m.perdasIdentidade,
    menor_distancia: m.menorDistancia ?? null,
    maior_distancia_aceita: m.maiorDistanciaAceita ?? null,
    limiar_usado: m.limiar ?? null,
  }

  try {
    if (!supabase) return
    void supabase
      .from("diagnostico_reconhecimento")
      .insert(linha)
      .then(undefined, () => {
        /* telemetria nunca reclama: se falhou, a medição se perde e pronto */
      })
  } catch {
    /* idem */
  }
}

/** Descarta a tentativa em curso sem gravar nada. */
export function abandonarTentativa() {
  atual = null
}
