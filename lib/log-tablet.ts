"use client"

import { supabase } from "@/lib/supabase"

/**
 * Caixa-preta do tablet.
 *
 * Por que existe: a telemetria de `diagnostico_reconhecimento` só grava
 * tentativas que chegaram a ter um passe completo. Quando o reconhecimento
 * morre (GPU perde o contexto, worker trava, câmera congela) não há tentativa
 * nenhuma — e o estado quebrado é exatamente o que fica sem rastro. Aqui o
 * registro é por EVENTO, e inclui o que acontece ao redor das tentativas.
 *
 * REGRAS (as mesmas da telemetria):
 *
 * 1. NUNCA atrasa nada. Tudo é enfileirado e enviado em lote, em segundo plano.
 * 2. NUNCA derruba nada. Todo erro daqui é engolido.
 * 3. NUNCA guarda biometria nem nome. Só tempos, contadores, estados e ids.
 *
 * O que sobrevive ao tablet morrer:
 *  - a fila não enviada é guardada no localStorage e sobe no próximo boot;
 *  - cada sessão deixa um retrato do último instante vivo. Se a próxima sessão
 *    abrir e o retrato anterior não foi marcado como "encerrado limpo", o
 *    WebView foi morto (memória, kiosk reiniciando, travamento) — e o log diz
 *    há quanto tempo e com que estado de memória/bateria isso aconteceu.
 */

export type Nivel = "info" | "aviso" | "erro" | "fatal"

interface Linha {
  cliente_em: string
  sessao: string
  seq: number
  nivel: Nivel
  evento: string
  mensagem: string | null
  detalhe: unknown
  contexto: unknown
}

type Coletor = () => unknown | Promise<unknown>

const TABELA = "log_tablet"
const CHAVE_FILA = "vitall_log_tablet_fila"
const CHAVE_SESSAO = "vitall_log_tablet_sessao"
const MAX_FILA = 400
const LOTE = 50
const ENVIO_MS = 15_000
const HEARTBEAT_MS = 120_000
const PRIMEIRO_HEARTBEAT_MS = 20_000
const PRAZO_COLETOR_MS = 8_000
const PERSISTE_SESSAO_MS = 10_000

const sessao =
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  ).slice(0, 36)

const inicioMs = typeof performance !== "undefined" ? performance.now() : 0
const consoleOriginal = {
  error: typeof console !== "undefined" ? console.error.bind(console) : () => {},
  warn: typeof console !== "undefined" ? console.warn.bind(console) : () => {},
}

let seq = 0
let fila: Linha[] = []
let iniciado = false
let enviando = false
let timerEnvio: number | null = null
let pausadoAte = 0
let avisouTabelaAusente = false
let bateria: { nivel: number; carregando: boolean } | null = null
const coletores = new Map<string, Coletor>()

/** Anti-enxurrada: o mesmo erro repetido vira contagem, não 500 linhas. */
const recentes = new Map<string, { em: number; suprimidos: number }>()
const JANELA_REPETIDO_MS = 30_000

/** Estatísticas da própria thread principal, entregues no batimento. */
const fluxo = { maiorAtrasoMs: 0, travadas: 0, tarefasLongas: 0, maiorTarefaLongaMs: 0, somaTarefasLongasMs: 0 }

function cortar(v: unknown, n = 600): string {
  const s = typeof v === "string" ? v : (() => { try { return JSON.stringify(v) } catch { return String(v) } })()
  return s.length > n ? s.slice(0, n) + "…" : s
}

function memoriaJs() {
  try {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number; totalJSHeapSize: number } }).memory
    if (!m) return null
    return {
      usadaMB: Math.round(m.usedJSHeapSize / 1048576),
      totalMB: Math.round(m.totalJSHeapSize / 1048576),
      limiteMB: Math.round(m.jsHeapSizeLimit / 1048576),
    }
  } catch {
    return null
  }
}

function retrato(): Record<string, unknown> {
  const nav = (typeof navigator !== "undefined" ? navigator : {}) as Navigator & {
    deviceMemory?: number
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }
  }
  return {
    up_ms: Math.round(performance.now() - inicioMs),
    visivel: typeof document !== "undefined" ? document.visibilityState : null,
    online: nav.onLine ?? null,
    memoria_js: memoriaJs(),
    memoria_aparelho_gb: nav.deviceMemory ?? null,
    nucleos: nav.hardwareConcurrency ?? null,
    bateria,
    rede: nav.connection
      ? { tipo: nav.connection.effectiveType, mbps: nav.connection.downlink, rtt: nav.connection.rtt }
      : null,
  }
}

function persistirFila() {
  try {
    localStorage.setItem(CHAVE_FILA, JSON.stringify(fila.slice(-MAX_FILA)))
  } catch {
    /* sem localStorage: a fila só vive em memória */
  }
}

function agendarEnvio(ms: number) {
  if (typeof window === "undefined") return
  if (timerEnvio !== null) {
    // Um erro quer sair já; não deixa um timer longo segurar.
    if (ms >= ENVIO_MS) return
    window.clearTimeout(timerEnvio)
  }
  timerEnvio = window.setTimeout(() => {
    timerEnvio = null
    void enviar()
  }, ms)
}

async function enviar() {
  if (enviando || fila.length === 0) return
  if (!supabase || Date.now() < pausadoAte) {
    agendarEnvio(ENVIO_MS * 2)
    return
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    agendarEnvio(ENVIO_MS * 2)
    return
  }
  enviando = true
  const lote = fila.slice(0, LOTE)
  try {
    const { error } = await supabase.from(TABELA).insert(lote as never)
    if (error) {
      const codigo = String((error as { code?: string }).code || "")
      const tabelaAusente = codigo === "42P01" || codigo === "PGRST205" || /does not exist|not find the table/i.test(error.message || "")
      if (tabelaAusente && !avisouTabelaAusente) {
        avisouTabelaAusente = true
        consoleOriginal.warn(
          "[log-tablet] a tabela log_tablet não existe. Rode scripts/create_log_tablet_table.sql no Supabase."
        )
      }
      // Tabela ausente: espera bastante. Outro erro: espera pouco.
      pausadoAte = Date.now() + (tabelaAusente ? 10 * 60_000 : 60_000)
      return
    }
    fila = fila.slice(lote.length)
    persistirFila()
    avisouTabelaAusente = false
  } catch {
    pausadoAte = Date.now() + 60_000
  } finally {
    enviando = false
    if (fila.length > 0) agendarEnvio(Date.now() < pausadoAte ? ENVIO_MS * 2 : 1_000)
  }
}

/**
 * Registra um evento. Nunca lança, nunca espera.
 *
 * `info` não é agrupado (cada toque, cada batida importa). `aviso` e `erro`
 * repetidos em 30 s viram uma linha com `repetido: N` na próxima ocorrência.
 */
export function logar(nivel: Nivel, evento: string, mensagem?: unknown, detalhe?: unknown) {
  try {
    if (typeof window === "undefined") return
    const msg = mensagem === undefined || mensagem === null ? null : cortar(mensagem, 500)

    let extra: Record<string, unknown> | null = null
    if (nivel !== "info") {
      const chave = `${evento}|${(msg || "").slice(0, 80)}`
      const agora = Date.now()
      const r = recentes.get(chave)
      if (r && agora - r.em < JANELA_REPETIDO_MS) {
        r.suprimidos += 1
        return
      }
      if (r && r.suprimidos > 0) extra = { repetido: r.suprimidos }
      recentes.set(chave, { em: agora, suprimidos: 0 })
      if (recentes.size > 200) recentes.clear()
    }

    const det =
      extra && detalhe && typeof detalhe === "object"
        ? { ...(detalhe as object), ...extra }
        : extra ?? detalhe ?? null

    const linha: Linha = {
      cliente_em: new Date().toISOString(),
      sessao,
      seq: ++seq,
      nivel,
      evento,
      mensagem: msg,
      detalhe: det,
      contexto: retrato(),
    }
    fila.push(linha)
    if (fila.length > MAX_FILA) fila = fila.slice(-MAX_FILA)

    if (nivel === "erro" || nivel === "fatal") {
      persistirFila()
      agendarEnvio(1_000)
    } else {
      agendarEnvio(ENVIO_MS)
    }
  } catch {
    /* log nunca reclama */
  }
}

/**
 * Cadastra uma fonte de estado que o batimento consulta a cada 2 minutos
 * (ex.: saúde do worker, estado da câmera, estado da tela). Quem demora mais
 * de 8 s para responder vira `{ erro: "sem resposta" }` — e isso por si só já
 * é um achado.
 */
export function registrarColetor(nome: string, fn: Coletor) {
  coletores.set(nome, fn)
}

export function removerColetor(nome: string) {
  coletores.delete(nome)
}

async function coletar(): Promise<Record<string, unknown>> {
  const saida: Record<string, unknown> = {}
  await Promise.all(
    Array.from(coletores.entries()).map(async ([nome, fn]) => {
      try {
        saida[nome] = await Promise.race([
          Promise.resolve().then(fn),
          new Promise((r) => setTimeout(() => r({ erro: "sem resposta" }), PRAZO_COLETOR_MS)),
        ])
      } catch (e) {
        saida[nome] = { erro: cortar((e as Error)?.message || e, 200) }
      }
    })
  )
  return saida
}

async function batimento() {
  try {
    const estado = await coletar()
    const f = { ...fluxo }
    fluxo.maiorAtrasoMs = 0
    fluxo.travadas = 0
    fluxo.tarefasLongas = 0
    fluxo.maiorTarefaLongaMs = 0
    fluxo.somaTarefasLongasMs = 0
    logar("info", "heartbeat", null, { ...estado, thread_principal: f })
  } catch {
    /* idem */
  }
}

function nomeDoErro(e: unknown) {
  const err = e as { name?: string; message?: string; stack?: string } | undefined
  return {
    nome: err?.name,
    mensagem: cortar(err?.message ?? e, 400),
    pilha: err?.stack ? cortar(err.stack, 900) : undefined,
  }
}

function lerSessaoAnterior(): { sessao: string; ts: number; limpa: boolean; ctx?: unknown } | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO)
    return bruto ? JSON.parse(bruto) : null
  } catch {
    return null
  }
}

function gravarSessao(limpa: boolean) {
  try {
    localStorage.setItem(
      CHAVE_SESSAO,
      JSON.stringify({ sessao, ts: Date.now(), limpa, ctx: retrato() })
    )
  } catch {
    /* sem localStorage */
  }
}

function descobrirGpu(): Record<string, unknown> {
  try {
    const c = document.createElement("canvas")
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null
    if (!gl) return { webgl: false }
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    return {
      webgl: true,
      gpu: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).slice(0, 120) : "renderer-oculto",
      texturaMax: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    }
  } catch {
    return { webgl: "erro" }
  }
}

/**
 * Liga a caixa-preta. Idempotente. Chamar uma vez, no boot da página.
 */
export function iniciarLogTablet() {
  if (iniciado || typeof window === "undefined") return
  iniciado = true

  try {
    // Fila que sobrou da sessão anterior (tablet offline ou fechado cedo).
    const salva = localStorage.getItem(CHAVE_FILA)
    if (salva) {
      const antigas = JSON.parse(salva) as Linha[]
      if (Array.isArray(antigas)) fila = antigas.slice(-MAX_FILA)
    }
  } catch {
    /* fila corrompida: segue sem ela */
  }

  // A sessão anterior terminou direito? Se não, o WebView foi morto.
  const anterior = lerSessaoAnterior()
  if (anterior && anterior.sessao !== sessao) {
    if (anterior.limpa) {
      logar("info", "sessao_anterior_encerrada", null, { sessao_anterior: anterior.sessao, ha_ms: Date.now() - anterior.ts })
    } else {
      logar("erro", "sessao_anterior_morreu_sem_aviso", "a página anterior não chegou a encerrar", {
        sessao_anterior: anterior.sessao,
        ultimo_sinal_ha_ms: Date.now() - anterior.ts,
        ultimo_retrato: anterior.ctx,
      })
    }
  }
  gravarSessao(false)

  logar("info", "boot", null, {
    user_agent: (navigator.userAgent || "").slice(0, 220),
    tela: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    url: window.location.pathname + window.location.search,
    versao: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null,
    ...descobrirGpu(),
  })

  // Bateria (nem todo WebView tem).
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (t: string, f: () => void) => void }> }
    void nav.getBattery?.().then((b) => {
      const ler = () => { bateria = { nivel: Math.round(b.level * 100), carregando: b.charging } }
      ler()
      b.addEventListener("levelchange", ler)
      b.addEventListener("chargingchange", ler)
    })
  } catch {
    /* sem API de bateria */
  }

  // --- Erros que ninguém tratou ---
  window.addEventListener("error", (ev) => {
    const alvo = ev.target as (HTMLElement & { src?: string; href?: string }) | null
    if (alvo && alvo !== (window as unknown as EventTarget) && (alvo.src || alvo.href)) {
      logar("erro", "recurso_falhou", alvo.src || alvo.href, { tag: alvo.tagName })
      return
    }
    logar("erro", "js_erro", ev.message, {
      arquivo: cortar(ev.filename, 160),
      linha: ev.lineno,
      coluna: ev.colno,
      ...nomeDoErro(ev.error),
    })
  }, true)

  window.addEventListener("unhandledrejection", (ev) => {
    logar("erro", "promessa_rejeitada", (ev.reason as Error)?.message ?? ev.reason, nomeDoErro(ev.reason))
  })

  // --- console.error / console.warn viram evento (com teto de volume) ---
  let consoleNoMinuto = 0
  let minutoAtual = 0
  const interceptar = (nivel: "erro" | "aviso", original: (...a: unknown[]) => void) =>
    (...args: unknown[]) => {
      original(...args)
      try {
        const agora = Math.floor(Date.now() / 60_000)
        if (agora !== minutoAtual) { minutoAtual = agora; consoleNoMinuto = 0 }
        if (++consoleNoMinuto > 30) return
        const texto = args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : cortar(a, 300))).join(" ")
        // O próprio logger não pode se alimentar.
        if (texto.startsWith("[log-tablet]")) return
        logar(nivel, nivel === "erro" ? "console_error" : "console_warn", texto)
      } catch {
        /* idem */
      }
    }
  console.error = interceptar("erro", consoleOriginal.error)
  console.warn = interceptar("aviso", consoleOriginal.warn)

  // --- Ciclo de vida da página ---
  window.addEventListener("online", () => logar("info", "rede_voltou"))
  window.addEventListener("offline", () => logar("aviso", "rede_caiu"))
  document.addEventListener("visibilitychange", () => logar("info", "visibilidade", document.visibilityState))
  document.addEventListener("freeze", () => logar("aviso", "pagina_congelada"))
  document.addEventListener("resume", () => logar("aviso", "pagina_retomada"))
  window.addEventListener("pagehide", (ev) => {
    logar("info", "pagehide", null, { bfcache: (ev as PageTransitionEvent).persisted })
    gravarSessao(true)
    persistirFila()
    void enviar()
  })

  // --- A thread principal está respirando? ---
  // Um timer de 1 s que chega com 3 s de atraso é o tablet sufocado: GPU
  // brigando com o vídeo, GC, ou o sistema limitando a aba. É a medida direta
  // de "o tablet não está aguentando".
  let esperado = performance.now() + 1000
  window.setInterval(() => {
    const agora = performance.now()
    const atraso = agora - esperado
    esperado = agora + 1000
    if (atraso > fluxo.maiorAtrasoMs) fluxo.maiorAtrasoMs = Math.round(atraso)
    if (atraso > 3000) {
      fluxo.travadas += 1
      logar("aviso", "thread_principal_travada", `${Math.round(atraso)} ms de atraso num timer de 1 s`, { atraso_ms: Math.round(atraso) })
    }
  }, 1000)

  try {
    const obs = new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) {
        fluxo.tarefasLongas += 1
        fluxo.somaTarefasLongasMs += Math.round(e.duration)
        if (e.duration > fluxo.maiorTarefaLongaMs) fluxo.maiorTarefaLongaMs = Math.round(e.duration)
        if (e.duration > 1500) logar("aviso", "tarefa_longa", `${Math.round(e.duration)} ms`, { ms: Math.round(e.duration) })
      }
    })
    obs.observe({ entryTypes: ["longtask"] })
  } catch {
    /* sem longtask neste WebView */
  }

  // O retrato da sessão é atualizado a cada 10 s: é ele que diz, no boot
  // seguinte, "o último sinal de vida foi há X, com tanta memória".
  window.setInterval(() => gravarSessao(false), PERSISTE_SESSAO_MS)

  window.setTimeout(() => void batimento(), PRIMEIRO_HEARTBEAT_MS)
  window.setInterval(() => void batimento(), HEARTBEAT_MS)

  agendarEnvio(3_000)
}

export function idDaSessao() {
  return sessao
}

export { nomeDoErro as descreverErro }
