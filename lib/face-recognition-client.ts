"use client"

/**
 * Reconhecimento facial CLIENT-SIDE via Web Worker.
 *
 * Este arquivo roda na main thread e atua como proxy para o worker
 * (lib/face-worker.ts), que faz todo o trabalho pesado de inferência.
 *
 * Vantagem: a UI não trava durante detecção/reconhecimento, mesmo em tablets
 * fracos, porque face-api.js roda num thread separado.
 *
 * Fluxo:
 *  - initModels() → dispara 'init' no worker (carrega modelos + warmup)
 *  - loadDescriptors() → busca funcionários no Supabase e envia pro worker
 *  - detectFaceFast / recognizeFace / detectSmileOnly → captura frame do video
 *    como ImageBitmap, transfere pro worker (zero-copy), aguarda resposta
 */

import type { Funcionario } from "@/lib/types"
import { logar } from "@/lib/log-tablet"

let worker: Worker | null = null
let nextMsgId = 0
const pending = new Map<
  number,
  { resolve: (v: any) => void; reject: (e: Error) => void }
>()

let modelsLoaded = false
let modelsLoading: Promise<void> | null = null
let descriptorCount = 0
let tfBackend = ""
let funcionariosCarregados: Funcionario[] = []
/** Último payload enviado ao worker, para repovoar um worker novo sem ir ao Supabase. */
let payloadDescritores: { id: string; nome: string; descritores: number[][] }[] | null = null

// Duas resoluções de captura, casadas com os dois passes do worker.
//
// O passe de identificação é raro e precisa de pixels: o recorte do rosto vai
// para a rede de descritor 128D, e frame pequeno demais gera descritor pobre —
// que é o que fazia o reconhecimento falhar com a pessoa parada na frente da
// câmera. O passe de sorriso roda o tempo todo e só precisa da expressão,
// então segue barato.
const CAPTURA_RECONHECIMENTO = { largura: 256, altura: 192 }
const CAPTURA_SORRISO = { largura: 192, altura: 144 }
// Depois de uma queda de GPU, o resto da sessão roda em WASM.
let backendForcado: "wasm" | "cpu" | undefined

/**
 * Escolhe o backend na mão, antes de `initModels()`.
 *
 * Existe para um experimento que não dá para decidir na teoria: neste tablet,
 * o WebGL passa por um driver Mali dentro de um WebView do Android. Em GPU
 * fraca com driver ruim, WASM+SIMD às vezes GANHA do WebGL — os modelos são
 * pequenos, e o custo de empurrar textura para a GPU e trazer resultado de
 * volta pode passar do custo de simplesmente calcular na CPU.
 *
 * "Às vezes" é o problema: depende do aparelho, e a única resposta honesta vem
 * de rodar dos dois jeitos NO tablet e comparar `ms_passe_completo_p50`. Como
 * o backend ativo já vai gravado em cada linha da telemetria, a comparação sai
 * sozinha do banco depois.
 *
 * Inerte por padrão: sem `?backend=` na URL, nada muda.
 */
export function definirBackendManual(b: "wasm" | "cpu" | null) {
  if (modelsLoaded || modelsLoading) {
    console.warn("[face-client] backend já inicializado; ?backend= ignorado")
    return
  }
  backendForcado = b ?? undefined
}

export interface RecognitionResult {
  id: string
  nome: string
  similarity: number
  isUnknown?: boolean
  isSmiling: boolean
  smileConfidence: number
  /**
   * Distância euclidiana crua entre o descritor do rosto na câmera e o melhor
   * candidato cadastrado. Vem preenchida mesmo quando NÃO bateu — é ela que
   * diz se a rejeição foi por pouco ou por muito, e é o número que a
   * telemetria usa para descobrir onde o limiar deveria estar.
   */
  distancia?: number
  /** Limiar em vigor no momento da comparação, para ler a distância acima. */
  limiar?: number
}

/**
 * Cria (ou retorna) o worker singleton.
 * O URL é resolvido em tempo de build pelo Next/Turbopack.
 */
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./face-worker.ts", import.meta.url), {
      type: "module",
    })

    worker.onmessage = (e: MessageEvent) => {
      // Eventos espontâneos do worker (erro tardio, GPU perdida...) vão
      // direto para a caixa-preta; não são resposta a nenhuma chamada.
      if (e.data?.tipo === "log") {
        const d = e.data
        logar(d.nivel, d.evento, d.mensagem, d.detalhe)
        if (d.evento === "webgl_contexto_perdido") {
          void reiniciarWorker("contexto WebGL perdido no worker", true)
        }
        return
      }
      const { id, ok, result, error } = e.data
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      if (ok) {
        p.resolve(result)
      } else {
        p.reject(new Error(error || "Erro no worker"))
      }
    }

    worker.onerror = (e) => {
      console.error("[face-client] erro no worker:", e)
      logar("erro", "worker_onerror", e.message, { arquivo: String(e.filename || "").slice(0, 160), linha: e.lineno })
    }
    worker.onmessageerror = () => {
      logar("erro", "worker_mensagem_ilegivel")
    }
  }
  return worker
}

/**
 * Envia mensagem pro worker e aguarda resposta.
 * `transfer` permite passar ImageBitmap sem cópia.
 */
function call<T>(
  type: string,
  payload?: any,
  transfer?: Transferable[],
  timeoutMs = 30000
): Promise<T> {
  const w = getWorker()
  const id = ++nextMsgId
  return new Promise<T>((resolve, reject) => {
    // Rede de segurança: se o worker morrer de vez (contexto WebGL perdido
    // derruba a thread inteira em alguns drivers), nenhuma resposta volta e a
    // promise fica pendurada. Sem isto a tela trava em "Cadastrando..." e o
    // usuário não tem como saber o que houve.
    const timer = setTimeout(() => {
      if (!pending.has(id)) return
      pending.delete(id)
      reject(
        new Error(
          `O reconhecimento facial não respondeu em ${Math.round(timeoutMs / 1000)}s (etapa: ${type}).`
        )
      )
    }, timeoutMs)

    pending.set(id, {
      resolve: (v: any) => {
        clearTimeout(timer)
        resolve(v)
      },
      reject: (e: Error) => {
        clearTimeout(timer)
        reject(e)
      },
    })

    try {
      w.postMessage({ id, type, payload }, transfer || [])
    } catch (err) {
      clearTimeout(timer)
      pending.delete(id)
      reject(err as Error)
    }
  })
}

/**
 * Mata o worker e limpa o estado, para que a próxima chamada recrie tudo.
 * Usado quando a GPU cai: um contexto WebGL perdido não se recupera.
 */
function destruirWorker(motivo: string) {
  console.warn(`[face-client] reiniciando worker: ${motivo}`)
  for (const [, p] of pending) p.reject(new Error(motivo))
  pending.clear()
  if (worker) {
    worker.terminate()
    worker = null
  }
  modelsLoaded = false
  modelsLoading = null
  descriptorCount = 0
}

/**
 * Erros que indicam GPU/WebGL morta — vale reiniciar no backend WASM.
 */
function ehFalhaDeGpu(erro: unknown): boolean {
  const msg = String((erro as any)?.message || erro || "").toLowerCase()
  return (
    msg.includes("webgl") ||
    msg.includes("context") ||
    msg.includes("shader") ||
    msg.includes("out_of_memory") ||
    msg.includes("out of memory") ||
    msg.includes("não respondeu")
  )
}

// ============================================================
// VIGIA DO WORKER
// ============================================================
//
// O QUE ESTAVA FALTANDO: quando a GPU do tablet perde o contexto WebGL, ou o
// worker morre, as chamadas de reconhecimento falham (ou estouram o prazo) e
// quem chamava só recebia `null` — indistinguível de "ninguém na frente da
// câmera". Nada reiniciava o worker. A tela seguia viva, os olhos do robô
// paravam, nenhuma onda dourada aparecia, e só recarregar a página resolvia.
// Só o cadastro tinha recuperação; o ponto, que é o que importa, não.
//
// Agora há três redes de proteção, da mais rápida à mais lenta:
//
//   1. Falha explícita de GPU (WebGL/shader/OOM/contexto) ou worker que não
//      responde dentro do prazo → reinicia na hora, com um worker novo e,
//      portanto, um contexto WebGL novo (que costuma voltar a funcionar).
//      Se a GPU continuar falhando — o terceiro reinício em 10 minutos — o
//      worker passa a rodar em CPU, que é lento mas não morre. Depois de 20
//      minutos em CPU, tenta voltar ao WebGL.
//
//      Não existe degrau intermediário em WASM: o face-api.js carrega o
//      tfjs-core 1.7 embutido e o backend WASM instalado é o 4.22, então
//      `fa.tf.setBackend("wasm")` nunca consegue registrar (o teste mostrou
//      "tf.getAsync is not a function") e sempre cai em CPU de qualquer jeito.
//   2. Três falhas seguidas de qualquer tipo → reinicia.
//   3. Sonda de saúde a cada 30 s (uma conta na GPU + retrato da memória do
//      TFJS). Pega a morte silenciosa: worker vivo, contexto perdido, nenhuma
//      chamada em andamento para falhar em voz alta.
//
// E um freio: no máximo 5 reinícios em 10 minutos. Passou disso, desiste por 5
// minutos e grita no log — reiniciar em loop num aparelho sem GPU só piora.
//
// Tudo é gravado em `log_tablet`, inclusive o que NÃO deu em reinício.

type TipoChamada = "detectFast" | "recognize" | "smileOnly" | "warmup"

interface Estatistica {
  n: number
  nulos: number
  erros: number
  msSoma: number
  msMax: number
}

const estatisticas = new Map<string, Estatistica>()
let falhasDeCaptura = 0
let falhasSeguidas = 0
let reiniciando: Promise<void> | null = null
const reiniciosRecentes: number[] = []
let reiniciosTotal = 0
let ultimoReinicioEm = 0
let desistiuAte = 0
/** Quando o vigia mandou o worker para CPU (para tentar voltar ao WebGL depois). */
let cpuPeloVigiaDesde = 0
let jaCarregouUmaVez = false
let vigiaId: number | null = null
let ultimaSonda: (Record<string, unknown> & { em: number }) | null = null
let sondaInicial: Record<string, unknown> | null = null
let ultimoAvisoVazamento = 0

const MAX_REINICIOS_EM_10MIN = 5
const JANELA_REINICIOS_MS = 10 * 60_000
const INTERVALO_MINIMO_REINICIO_MS = 15_000
const TEMPO_EM_CPU_ANTES_DE_TENTAR_WEBGL_MS = 20 * 60_000
const PRAZO_SONDA_MS = 15_000

function estatistica(tipo: string): Estatistica {
  let e = estatisticas.get(tipo)
  if (!e) {
    e = { n: 0, nulos: 0, erros: 0, msSoma: 0, msMax: 0 }
    estatisticas.set(tipo, e)
  }
  return e
}

/** GPU morta de verdade (não é mero atraso): vale pular o WebGL. */
function ehErroExplicitoDeGpu(erro: unknown): boolean {
  const msg = String((erro as any)?.message || erro || "").toLowerCase()
  return ehFalhaDeGpu(erro) && !msg.includes("não respondeu")
}

/**
 * Toda chamada de reconhecimento passa por aqui: mede, conta e, se o worker
 * está doente, manda reiniciar. Relança o erro — quem chamou decide o que
 * devolver à tela.
 */
async function chamarComVigia<T>(
  tipo: TipoChamada,
  payload: any,
  transfer?: Transferable[],
  timeoutMs = 30000
): Promise<T> {
  const t0 = performance.now()
  const est = estatistica(tipo)
  try {
    const r = await call<T>(tipo, payload, transfer, timeoutMs)
    const ms = performance.now() - t0
    est.n += 1
    est.msSoma += ms
    if (ms > est.msMax) est.msMax = ms
    if (r === null) est.nulos += 1
    falhasSeguidas = 0
    if (ms > 5000) {
      logar("aviso", "chamada_lenta", `${tipo} levou ${Math.round(ms)} ms`, {
        tipo,
        ms: Math.round(ms),
        backend: tfBackend,
      })
    }
    return r
  } catch (erro) {
    // Reinício em curso rejeita as chamadas pendentes de propósito; contar
    // isso como falha novas faria o vigia se reiniciar em cascata.
    if (reiniciando) throw erro
    est.erros += 1
    falhasSeguidas += 1
    const msg = String((erro as any)?.message || erro)
    logar("erro", "chamada_falhou", msg, {
      tipo,
      ms: Math.round(performance.now() - t0),
      falhas_seguidas: falhasSeguidas,
      backend: tfBackend,
      pendentes: pending.size,
    })
    if (ehFalhaDeGpu(erro) || falhasSeguidas >= 3) {
      void reiniciarWorker(`${tipo}: ${msg}`, ehErroExplicitoDeGpu(erro))
    }
    throw erro
  }
}

function registrarFalhaDeCaptura(video: HTMLVideoElement, erro: unknown) {
  falhasDeCaptura += 1
  logar("aviso", "captura_falhou", (erro as any)?.message || erro, {
    readyState: video.readyState,
    largura: video.videoWidth,
    altura: video.videoHeight,
    pausado: video.paused,
    terminou: video.ended,
  })
}

/**
 * Derruba o worker sem recriá-lo. Usado pela página quando a carga inicial
 * falha e ela precisa tentar de novo do zero.
 */
export function descartarWorker(motivo: string) {
  destruirWorker(motivo)
}

/**
 * Recria o worker, recarrega os modelos e repopula os descritores a partir da
 * memória (sem ir ao Supabase — o app precisa voltar a funcionar justamente
 * quando algo está falhando, inclusive a rede).
 *
 * `gpu`: a causa foi uma falha explícita da GPU (só registrado no log; o
 * critério para cair em CPU é a reincidência, não a causa).
 */
export function reiniciarWorker(motivo: string, gpu = false): Promise<void> {
  if (reiniciando) return reiniciando
  const agora = Date.now()
  while (reiniciosRecentes.length && agora - reiniciosRecentes[0] > JANELA_REINICIOS_MS) {
    reiniciosRecentes.shift()
  }
  if (agora < desistiuAte) return Promise.resolve()
  if (agora - ultimoReinicioEm < INTERVALO_MINIMO_REINICIO_MS) return Promise.resolve()
  if (reiniciosRecentes.length >= MAX_REINICIOS_EM_10MIN) {
    desistiuAte = agora + 5 * 60_000
    logar("fatal", "watchdog_desistiu", `${reiniciosRecentes.length} reinícios em 10 min; pausando 5 min`, {
      motivo,
      backend: tfBackend,
    })
    return Promise.resolve()
  }

  // Terceiro reinício na janela: o WebGL novo também não se sustenta.
  const escalarParaCpu = reiniciosRecentes.length >= 2 && backendForcado !== "cpu"
  reiniciosRecentes.push(agora)
  reiniciosTotal += 1
  ultimoReinicioEm = agora
  const t0 = performance.now()
  logar("erro", "worker_reiniciando", motivo, {
    gpu,
    vai_para_cpu: escalarParaCpu,
    backend_antes: tfBackend,
    reinicios_em_10min: reiniciosRecentes.length,
    reinicios_total: reiniciosTotal,
  })

  reiniciando = (async () => {
    destruirWorker(motivo)
    if (escalarParaCpu) {
      backendForcado = "cpu"
      cpuPeloVigiaDesde = Date.now()
      logar("fatal", "worker_em_cpu", "a GPU não se sustentou; reconhecimento em CPU (lento)", {
        reinicios_em_10min: reiniciosRecentes.length,
      })
    }
    await initModels()
    if (payloadDescritores) {
      descriptorCount = await call<number>("loadDescriptors", payloadDescritores)
    }
    falhasSeguidas = 0
    sondaInicial = null
    logar("aviso", "worker_reiniciado", null, {
      ms: Math.round(performance.now() - t0),
      backend: tfBackend,
      descritores: descriptorCount,
    })
  })()
    .catch((e) => {
      logar("fatal", "worker_reinicio_falhou", (e as any)?.message || e, {
        ms: Math.round(performance.now() - t0),
      })
    })
    .finally(() => {
      reiniciando = null
    })
  return reiniciando
}

/** Uma sonda de saúde. Chamada pelo vigia; não deve ser usada no caminho crítico. */
async function sondar() {
  if (reiniciando) return
  if (!modelsLoaded) {
    // Já esteve pronto e deixou de estar, sem ninguém reiniciando: o worker
    // caiu e a recuperação anterior falhou. Tenta de novo.
    if (!modelsLoading && jaCarregouUmaVez) void reiniciarWorker("vigia: worker sem modelos", false)
    return
  }
  // Em CPU por causa do vigia há um bom tempo: a GPU pode ter se recuperado.
  // Se falhar de novo, o vigia volta para CPU sozinho (3 reinícios na janela).
  if (
    backendForcado === "cpu" &&
    cpuPeloVigiaDesde &&
    Date.now() - cpuPeloVigiaDesde > TEMPO_EM_CPU_ANTES_DE_TENTAR_WEBGL_MS
  ) {
    cpuPeloVigiaDesde = 0
    backendForcado = undefined
    logar("aviso", "tentando_voltar_ao_webgl", "20 min em CPU; testando a GPU de novo")
    void reiniciarWorker("tentando voltar ao WebGL", false)
    return
  }
  // A sonda NÃO pula quando há chamada em andamento: o worker é de uma thread
  // só, então ela entra na fila atrás da chamada. Se a chamada travou, a sonda
  // estoura os 15 s antes do prazo de 30 s da chamada e o reinício vem antes.
  // (Uma versão anterior pulava nesse caso e, com o laço de detecção rodando
  // sem parar, quase nunca achava a fila vazia: a sonda não rodava.)
  try {
    const r = await call<Record<string, any>>("saude", {}, undefined, PRAZO_SONDA_MS)
    ultimaSonda = { ...r, em: Date.now() }
    if (!sondaInicial && r?.pronto) sondaInicial = { tensores: r.tensores, bytes: r.bytes, bytesGpu: r.bytesGpu }

    if (r && r.pronto === false) {
      logar("erro", "sonda_worker_sem_modelos", "o worker respondeu, mas perdeu os modelos")
      void reiniciarWorker("sonda: worker sem modelos", false)
      return
    }
    if (r?.sondaOk === false || r?.contextoPerdido === true) {
      logar("fatal", "sonda_reprovada", r.erro || "contexto WebGL perdido", r)
      void reiniciarWorker(`sonda reprovada: ${r.erro || "contexto perdido"}`, true)
      return
    }
    // Vazamento: tensores que só crescem. Avisa no máximo de 30 em 30 min.
    const base = Number((sondaInicial as any)?.tensores ?? 0)
    const atual = Number(r?.tensores ?? 0)
    if (atual > base + 300 && Date.now() - ultimoAvisoVazamento > 30 * 60_000) {
      ultimoAvisoVazamento = Date.now()
      logar("aviso", "possivel_vazamento_de_tensores", `${base} → ${atual} tensores`, { base, atual, bytes: r.bytes, bytesGpu: r.bytesGpu })
    }
    if (r?.sondaMs > 2000) {
      logar("aviso", "sonda_lenta", `${r.sondaMs} ms para uma conta de 8x8`, r)
    }
  } catch (erro) {
    const msg = String((erro as any)?.message || erro)
    ultimaSonda = { erro: msg, em: Date.now() }
    logar("erro", "sonda_sem_resposta", msg, { pendentes: pending.size, backend: tfBackend })
    void reiniciarWorker(`sonda de saúde: ${msg}`, ehErroExplicitoDeGpu(erro))
  }
}

/** Liga a sonda de saúde. Idempotente. A página chama uma vez, depois do boot. */
export function iniciarVigiaDoWorker() {
  if (vigiaId !== null || typeof window === "undefined") return
  vigiaId = window.setInterval(() => void sondar(), 30_000)
}

/**
 * Retrato do reconhecimento para o batimento da caixa-preta. Zera os
 * contadores: cada batimento descreve só os últimos 2 minutos.
 */
export function coletarSaudeDoWorker() {
  const janela: Record<string, unknown> = {}
  for (const [tipo, e] of estatisticas) {
    janela[tipo] = {
      n: e.n,
      sem_rosto_ou_nulo: e.nulos,
      erros: e.erros,
      ms_medio: e.n ? Math.round(e.msSoma / e.n) : null,
      ms_max: Math.round(e.msMax),
    }
  }
  estatisticas.clear()
  const capturas = falhasDeCaptura
  falhasDeCaptura = 0
  return {
    carregado: modelsLoaded,
    carregando: !!modelsLoading && !modelsLoaded,
    reiniciando: !!reiniciando,
    backend: tfBackend,
    backend_forcado: backendForcado ?? null,
    descritores: descriptorCount,
    pendentes: pending.size,
    falhas_seguidas: falhasSeguidas,
    reinicios_10min: reiniciosRecentes.length,
    reinicios_total: reiniciosTotal,
    falhas_de_captura: capturas,
    sonda: ultimaSonda ? { ...ultimaSonda, ha_ms: Date.now() - ultimaSonda.em } : null,
    sonda_inicial: sondaInicial,
    janela,
  }
}

/**
 * Telas de captura reaproveitadas, uma por tamanho pedido.
 *
 * Alocar OffscreenCanvas a cada quadro devolveria ao coletor de lixo alguns
 * megabytes por segundo — num tablet fraco isso sozinho vira engasgo. São dois
 * tamanhos no total (sorriso e reconhecimento), então o mapa nunca cresce.
 */
const telasDeCaptura = new Map<string, OffscreenCanvas>()

/** Quanto tempo a última captura levou, em ms. Lido pela telemetria. */
let ultimaCapturaMs = 0

/**
 * Quanto a última captura de frame custou, em ms.
 *
 * Existe porque a primeira telemetria real levantou uma suspeita que não dá
 * para resolver no olho: o passe BARATO — só o detector minúsculo, que tem
 * ~190 mil parâmetros — levou 648 ms no tablet. Um modelo desse tamanho não
 * justifica 648 ms nem em hardware ruim. Ou seja: uma parte grande do tempo
 * pode não estar na rede neural, e sim no caminho até ela. Medindo a captura
 * separado, o próximo dia de uso diz qual das duas é.
 */
export function getUltimaCapturaMs(): number {
  return ultimaCapturaMs
}

/**
 * Captura um frame do vídeo como ImageBitmap (transferível).
 *
 * ANTES: `createImageBitmap(video, { resizeWidth, resizeHeight })`. A API é
 * mais direta e a intenção era deixar o browser redimensionar em código
 * nativo. O problema é que, no Chromium do Android, o quadro do vídeo vive
 * numa textura da GPU, e pedir resize nessa chamada pode forçar o caminho
 * lento: trazer o quadro para a CPU e redimensionar em software. É justamente
 * o tipo de custo que aparece como "o tablet é lento" sem ser culpa do modelo.
 *
 * AGORA: desenhar o vídeo num canvas do tamanho final — `drawImage` escala na
 * GPU — e entregar o resultado com `transferToImageBitmap`, que é uma troca de
 * posse, sem cópia.
 *
 * Isto é uma HIPÓTESE, não um fato medido neste tablet: por isso a captura
 * passou a ser cronometrada separadamente. Se `ms_captura_p50` vier baixo e o
 * passe continuar caro, a suspeita morre e o problema é mesmo a rede neural.
 */
async function videoToBitmap(
  video: HTMLVideoElement,
  largura: number,
  altura: number
): Promise<ImageBitmap> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    throw new Error("Vídeo não está pronto para captura")
  }

  const t0 = performance.now()
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const chave = `${largura}x${altura}`
      let tela = telasDeCaptura.get(chave)
      if (!tela) {
        tela = new OffscreenCanvas(largura, altura)
        telasDeCaptura.set(chave, tela)
      }
      const ctx = tela.getContext("2d", { alpha: false, willReadFrequently: false })
      if (ctx) {
        ctx.drawImage(video, 0, 0, largura, altura)
        const bitmap = tela.transferToImageBitmap()
        ultimaCapturaMs = performance.now() - t0
        return bitmap
      }
    }

    // Sem OffscreenCanvas: o caminho antigo continua valendo.
    const bitmap = await createImageBitmap(video, {
      resizeWidth: largura,
      resizeHeight: altura,
      resizeQuality: "low",
    } as ImageBitmapOptions)
    ultimaCapturaMs = performance.now() - t0
    return bitmap
  } catch {
    const bitmap = await createImageBitmap(video)
    ultimaCapturaMs = performance.now() - t0
    return bitmap
  }
}

/**
 * Inicializa modelos no worker (idempotente).
 */
export async function initModels(): Promise<void> {
  if (modelsLoaded) return
  if (modelsLoading) return modelsLoading

  const tInicio = performance.now()
  modelsLoading = (async () => {
    try {
      console.log("🧠 Inicializando worker de reconhecimento...")
      const initResult = await call<{ backend: string }>(
        "init",
        { forcarBackend: backendForcado },
        undefined,
        120000 // carregar 4 modelos + warmup é lento em máquina fraca
      )
      tfBackend = initResult?.backend || "unknown"
      modelsLoaded = true
      jaCarregouUmaVez = true
      console.log(`✅ Worker pronto (backend: ${tfBackend})`)
      logar("info", "modelos_carregados", tfBackend, {
        ms: Math.round(performance.now() - tInicio),
        backend: tfBackend,
        forcado: backendForcado ?? null,
      })
    } catch (error) {
      modelsLoading = null
      logar("erro", "modelos_falharam", (error as any)?.message || error, {
        ms: Math.round(performance.now() - tInicio),
        forcado: backendForcado ?? null,
      })
      throw error
    }
  })()

  return modelsLoading
}

/**
 * Carrega descritores dos funcionários do Supabase e envia pro worker.
 */
export async function loadDescriptors(): Promise<number> {
  if (!modelsLoaded) {
    throw new Error("Modelos não carregados. Chame initModels() primeiro.")
  }

  const { buscarFuncionarios } = await import("@/lib/supabase")
  const funcionarios = await buscarFuncionarios()
  funcionariosCarregados = funcionarios

  const payload = funcionarios.map((f) => ({
    id: f.id,
    nome: f.nome,
    descritores: (f.descritores || []) as number[][],
  }))

  payloadDescritores = payload
  const count = await call<number>("loadDescriptors", payload)
  descriptorCount = count
  console.log(`📋 ${count} funcionário(s) com descritores carregados (worker)`)
  return count
}

/**
 * Detecção rápida (só bounding box). Muito barata.
 */
export interface RostoDetectado {
  x: number
  y: number
  width: number
  height: number
  /** Centro do rosto no frame, de 0 a 1. */
  centroX: number
  centroY: number
}

export async function detectFaceFast(
  video: HTMLVideoElement
): Promise<RostoDetectado | null> {
  if (!modelsLoaded) return null
  let bitmap: ImageBitmap
  try {
    bitmap = await videoToBitmap(video, CAPTURA_SORRISO.largura, CAPTURA_SORRISO.altura)
  } catch (e) {
    registrarFalhaDeCaptura(video, e)
    return null
  }
  try {
    return await chamarComVigia<RostoDetectado | null>("detectFast", { bitmap }, [bitmap])
  } catch (e) {
    console.error("[face-client] detectFaceFast erro:", e)
    return null
  }
}

/**
 * Alias pra compatibilidade com código antigo (retorna boolean).
 */
export async function detectFaceOnly(video: HTMLVideoElement): Promise<boolean> {
  const box = await detectFaceFast(video)
  return box !== null
}

/**
 * Reconhecimento completo: identificação + sorriso. Usar 1x após detecção estável.
 */
export async function recognizeFace(
  video: HTMLVideoElement,
  smileThreshold = 0.40
): Promise<RecognitionResult | null> {
  if (!modelsLoaded) return null
  let bitmap: ImageBitmap
  try {
    bitmap = await videoToBitmap(
      video,
      CAPTURA_RECONHECIMENTO.largura,
      CAPTURA_RECONHECIMENTO.altura
    )
  } catch (e) {
    registrarFalhaDeCaptura(video, e)
    return null
  }
  try {
    return await chamarComVigia<RecognitionResult | null>("recognize", { bitmap, smileThreshold }, [bitmap])
  } catch (e) {
    console.error("[face-client] recognizeFace erro:", e)
    return null
  }
}

/**
 * Mantém as quatro redes acordadas, sem depender de haver rosto na frente.
 *
 * Isto existe porque o aquecimento anterior não aquecia. Ele chamava
 * `recognizeFace` com a câmera vazia, e a corrente da face-api pula tudo
 * quando o detector não acha rosto — então as três redes caras nunca rodavam.
 * O aquecimento periódico roda justamente quando não há ninguém, ou seja,
 * errava sempre. Ver o comentário de `aquecerTudo` em `lib/face-worker.ts`.
 *
 * Não precisa da câmera: o worker aquece com um canvas próprio.
 */
export async function aquecerModelos(): Promise<void> {
  if (!modelsLoaded) return
  try {
    await chamarComVigia("warmup", {})
  } catch (e) {
    console.warn("[face-client] aquecimento falhou (não crítico):", e)
  }
}

/**
 * Checagem leve de sorriso (pós-identificação).
 */
export async function detectSmileOnly(
  video: HTMLVideoElement,
  smileThreshold = 0.40
): Promise<{ isSmiling: boolean; confidence: number } | null> {
  if (!modelsLoaded) return null
  let bitmap: ImageBitmap
  try {
    bitmap = await videoToBitmap(video, CAPTURA_SORRISO.largura, CAPTURA_SORRISO.altura)
  } catch (e) {
    registrarFalhaDeCaptura(video, e)
    return null
  }
  try {
    return await chamarComVigia<{ isSmiling: boolean; confidence: number } | null>("smileOnly", { bitmap, smileThreshold }, [bitmap])
  } catch (e) {
    console.error("[face-client] detectSmileOnly erro:", e)
    return null
  }
}

export interface DescriptorExtraction {
  descriptor: number[]
  confidence: number
}

/**
 * Converte um JPEG base64 (com ou sem prefixo data:) em ImageBitmap transferível.
 */
async function base64ToBitmap(imageBase64: string): Promise<ImageBitmap> {
  const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, "")
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }))
}

/**
 * Extrai o descritor 128D de uma foto de cadastro, no navegador.
 *
 * É o caminho de cadastro: o servidor nunca vê a imagem, só o vetor.
 * Não depende de loadDescriptors() — cadastrar não precisa do FaceMatcher.
 *
 * Retorna null quando não há rosto na foto (resposta esperada, não erro).
 */
export async function extractDescriptorFromBase64(
  imageBase64: string
): Promise<DescriptorExtraction | null> {
  await initModels()

  const tentar = async () => {
    // Um ImageBitmap só pode ser transferido uma vez — recriar a cada tentativa.
    const bitmap = await base64ToBitmap(imageBase64)
    return await call<DescriptorExtraction | null>(
      "extractDescriptor",
      { bitmap },
      [bitmap],
      45000
    )
  }

  try {
    return await tentar()
  } catch (erro) {
    if (!ehFalhaDeGpu(erro) || backendForcado === "wasm") throw erro

    // A GPU caiu (típico de Intel integrada: o compilador HLSL estoura ao
    // montar shaders novos). Contexto WebGL perdido não volta — recria o
    // worker em WASM, que é mais lento porém não depende de driver gráfico.
    destruirWorker("falha de GPU no cadastro, migrando para WASM")
    backendForcado = "wasm"
    await initModels()
    return await tentar()
  }
}

/**
 * Funcionários da última chamada de loadDescriptors().
 *
 * É a mesma lista que alimentou o FaceMatcher e já traz a grade de horários de
 * cada um — o suficiente para diagnosticar o ponto sem ir ao banco na hora da
 * batida.
 */
export function getFuncionariosCarregados(): Funcionario[] {
  return funcionariosCarregados
}

export function isReady(): boolean {
  return modelsLoaded && descriptorCount > 0
}

export function getBackend(): string {
  return tfBackend
}
