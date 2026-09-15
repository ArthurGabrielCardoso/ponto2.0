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
      console.log(`✅ Worker pronto (backend: ${tfBackend})`)
    } catch (error) {
      modelsLoading = null
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
  try {
    const bitmap = await videoToBitmap(video, CAPTURA_SORRISO.largura, CAPTURA_SORRISO.altura)
    return await call("detectFast", { bitmap }, [bitmap])
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
  try {
    const bitmap = await videoToBitmap(
      video,
      CAPTURA_RECONHECIMENTO.largura,
      CAPTURA_RECONHECIMENTO.altura
    )
    return await call("recognize", { bitmap, smileThreshold }, [bitmap])
  } catch (e) {
    console.error("[face-client] recognizeFace erro:", e)
    return null
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
  try {
    const bitmap = await videoToBitmap(video, CAPTURA_SORRISO.largura, CAPTURA_SORRISO.altura)
    return await call("smileOnly", { bitmap, smileThreshold }, [bitmap])
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
