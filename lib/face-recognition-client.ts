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

export interface RecognitionResult {
  id: string
  nome: string
  similarity: number
  isSmiling: boolean
  smileConfidence: number
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
  transfer?: Transferable[]
): Promise<T> {
  const w = getWorker()
  const id = ++nextMsgId
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    try {
      w.postMessage({ id, type, payload }, transfer || [])
    } catch (err) {
      pending.delete(id)
      reject(err as Error)
    }
  })
}

/**
 * Captura um frame do video como ImageBitmap (transferível).
 * Usa resizeWidth/Height quando suportado pra já vir downscaled do browser.
 */
async function videoToBitmap(video: HTMLVideoElement): Promise<ImageBitmap> {
  // Verificar se o vídeo está pronto
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    throw new Error("Vídeo não está pronto para captura")
  }

  try {
    // Opções de resize são nativas e rápidas (quando suportadas).
    return await createImageBitmap(video, {
      resizeWidth: 192,
      resizeHeight: 144,
      resizeQuality: "low",
    } as ImageBitmapOptions)
  } catch {
    // Fallback: sem resize, deixa o worker fazer
    return await createImageBitmap(video)
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
      const initResult = await call<{ backend: string }>("init")
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
export async function detectFaceFast(
  video: HTMLVideoElement
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  if (!modelsLoaded) return null
  try {
    const bitmap = await videoToBitmap(video)
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
  smileThreshold = 0.5
): Promise<RecognitionResult | null> {
  if (!modelsLoaded) return null
  try {
    const bitmap = await videoToBitmap(video)
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
  smileThreshold = 0.5
): Promise<{ isSmiling: boolean; confidence: number } | null> {
  if (!modelsLoaded) return null
  try {
    const bitmap = await videoToBitmap(video)
    return await call("smileOnly", { bitmap, smileThreshold }, [bitmap])
  } catch (e) {
    console.error("[face-client] detectSmileOnly erro:", e)
    return null
  }
}

export function isReady(): boolean {
  return modelsLoaded && descriptorCount > 0
}

export function getBackend(): string {
  return tfBackend
}
