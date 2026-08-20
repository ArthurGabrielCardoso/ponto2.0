/// <reference lib="webworker" />

/**
 * Web Worker para reconhecimento facial com face-api.js.
 *
 * Roda toda a inferência neural fora da main thread, pra não travar a UI.
 * O worker:
 *  - Carrega face-api.js + modelos 1x
 *  - Mantém o FaceMatcher em memória
 *  - Recebe frames como ImageBitmap (transferíveis, zero-copy)
 *  - Responde com bounding box / identificação / sorriso
 *
 * face-api.js originalmente espera window/document. Em worker context não
 * existem, então fazemos monkeyPatch do env apontando pra OffscreenCanvas.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
declare const self: DedicatedWorkerGlobalScope

// ============================================================
// POLYFILL DE GLOBAIS DOM PRO WORKER CONTEXT
// ============================================================
// face-api.js usa `x instanceof HTMLImageElement` / HTMLVideoElement /
// HTMLCanvasElement em vários pontos internos. No worker essas classes
// não existem, então `instanceof undefined` joga TypeError.
//
// Solução: criar dummies ANTES do import do face-api. HTMLCanvasElement
// aponta pro OffscreenCanvas real pra que nossos canvases passem no
// instanceof check usado internamente pelo face-api.
if (typeof (self as any).HTMLImageElement === "undefined") {
  ;(self as any).HTMLImageElement = class HTMLImageElement {}
}
if (typeof (self as any).HTMLVideoElement === "undefined") {
  ;(self as any).HTMLVideoElement = class HTMLVideoElement {}
}
if (typeof (self as any).HTMLCanvasElement === "undefined") {
  ;(self as any).HTMLCanvasElement = OffscreenCanvas
}
if (typeof (self as any).document === "undefined") {
  ;(self as any).document = {
    createElement: (tag: string) => {
      if (tag === "canvas") return new OffscreenCanvas(1, 1)
      throw new Error(`document.createElement('${tag}') não suportado em worker`)
    },
  }
}

// IMPORTANTE: face-api.js é carregado via dynamic import DENTRO de handleInit,
// depois dos polyfills acima. Import estático seria hoisted antes dos polyfills,
// e face-api captura HTMLImageElement/etc em escopo de módulo no load.
let faceapi: typeof import("face-api.js") | null = null

async function loadFaceApi() {
  if (faceapi) return faceapi
  faceapi = await import("face-api.js")
  // Classe dummy pra que `input instanceof Video` não exploda.
  // Nunca vamos passar um HTMLVideoElement no worker (só OffscreenCanvas),
  // então o instanceof vai retornar false e cair no próximo check.
  class DummyVideo {}
  try {
    faceapi.env.setEnv({
      Canvas: OffscreenCanvas as any,
      CanvasRenderingContext2D: (self as any).OffscreenCanvasRenderingContext2D,
      Image: ImageBitmap as any,
      ImageData: ImageData,
      Video: DummyVideo as any,
      createCanvasElement: () => new OffscreenCanvas(1, 1) as any,
      createImageElement: () => {
        throw new Error("createImageElement não suportado em worker")
      },
      fetch: self.fetch.bind(self),
      readFile: () => {
        throw new Error("readFile não suportado em worker") as any
      },
    } as any)
  } catch (e) {
    console.warn("[face-worker] falha no monkeyPatch do env:", e)
  }
  return faceapi
}

const TINY_INPUT_SIZE = 96
const TINY_SCORE_THRESHOLD = 0.5
const WORK_WIDTH = 192
const WORK_HEIGHT = 144

let modelsLoaded = false
let faceMatcher: any = null
const employeeMap = new Map<string, string>() // id -> nome

function tinyOpts() {
  return new faceapi!.TinyFaceDetectorOptions({
    inputSize: TINY_INPUT_SIZE,
    scoreThreshold: TINY_SCORE_THRESHOLD,
  })
}

/**
 * Desenha um ImageBitmap num OffscreenCanvas 320x240 pra reduzir custo de inferência.
 * Libera o bitmap original após o draw.
 */
function bitmapToWorkCanvas(bitmap: ImageBitmap): OffscreenCanvas {
  const canvas = new OffscreenCanvas(WORK_WIDTH, WORK_HEIGHT)
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, WORK_WIDTH, WORK_HEIGHT)
  bitmap.close()
  return canvas
}

/**
 * Tenta ativar o melhor backend TFJS disponível: webgl → wasm (SIMD) → cpu.
 * WASM é bem mais rápido que CPU puro em tablets fracos sem WebGL performático.
 */
async function setupBestBackend(fa: typeof import("face-api.js")) {
  // 1. WebGL
  try {
    await fa.tf.setBackend("webgl")
    await fa.tf.ready()
    if (fa.tf.getBackend() === "webgl") {
      console.log("[face-worker] backend: webgl")
      return
    }
  } catch (e) {
    console.warn("[face-worker] webgl falhou:", e)
  }

  // 2. WASM com SIMD
  try {
    const wasm = await import("@tensorflow/tfjs-backend-wasm")
    wasm.setWasmPaths(`${self.location.origin}/tfjs-wasm/`)
    await fa.tf.setBackend("wasm")
    await fa.tf.ready()
    if (fa.tf.getBackend() === "wasm") {
      console.log("[face-worker] backend: wasm (SIMD)")
      return
    }
  } catch (e) {
    console.warn("[face-worker] wasm falhou:", e)
  }

  // 3. CPU (último recurso — lento)
  await fa.tf.setBackend("cpu")
  await fa.tf.ready()
  console.warn("[face-worker] backend: cpu (LENTO — nem webgl nem wasm disponíveis)")
}

async function handleInit() {
  if (modelsLoaded) return
  const fa = await loadFaceApi()

  await setupBestBackend(fa)

  // No worker, caminhos relativos (/models) podem não resolver dependendo
  // do bundler. Usamos URL absoluto pra garantir.
  const modelsBase = `${self.location.origin}/models`
  console.log(`[face-worker] carregando modelos de ${modelsBase}...`)
  await Promise.all([
    fa.nets.tinyFaceDetector.loadFromUri(modelsBase),
    fa.nets.faceLandmark68TinyNet.loadFromUri(modelsBase),
    fa.nets.faceRecognitionNet.loadFromUri(modelsBase),
    fa.nets.faceExpressionNet.loadFromUri(modelsBase),
  ])
  modelsLoaded = true
  console.log("[face-worker] modelos carregados. Warmup...")

  // Warmup — roda o pipeline completo uma vez pra compilar shaders/WASM ops
  try {
    const blank = new OffscreenCanvas(WORK_WIDTH, WORK_HEIGHT)
    const ctx = blank.getContext("2d")!
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, WORK_WIDTH, WORK_HEIGHT)
    await fa.detectSingleFace(blank as any, tinyOpts())
    await fa
      .detectSingleFace(blank as any, tinyOpts())
      .withFaceLandmarks(true)
      .withFaceDescriptor()
      .withFaceExpressions()
    console.log("[face-worker] warmup completo")
  } catch (e) {
    console.warn("[face-worker] warmup falhou (não crítico):", e)
  }
}

function handleLoadDescriptors(
  data: Array<{ id: string; nome: string; descritores: number[][] }>
): number {
  employeeMap.clear()
  const labeled: any[] = []

  for (const func of data) {
    if (!func.descritores || func.descritores.length === 0) continue
    const valid = func.descritores
      .filter((d) => d.length === 128)
      .map((d) => new Float32Array(d))

    if (valid.length > 0) {
      employeeMap.set(func.id, func.nome)
      labeled.push(new faceapi!.LabeledFaceDescriptors(func.id, valid))
    }
  }

  faceMatcher = labeled.length > 0 ? new faceapi!.FaceMatcher(labeled, 0.45) : null
  console.log(`[face-worker] ${employeeMap.size} funcionário(s) carregado(s)`)
  return employeeMap.size
}

async function handleDetectFast(bitmap: ImageBitmap) {
  if (!modelsLoaded) return null
  const canvas = bitmapToWorkCanvas(bitmap)
  const det = await faceapi!.detectSingleFace(canvas as any, tinyOpts())
  if (!det) return null
  return { x: det.box.x, y: det.box.y, width: det.box.width, height: det.box.height }
}

async function handleRecognize(bitmap: ImageBitmap, smileThreshold: number) {
  if (!modelsLoaded || !faceMatcher) {
    bitmap.close()
    return null
  }
  const canvas = bitmapToWorkCanvas(bitmap)
  // Expressions + descriptor juntos num único passe — evita um round-trip
  // inteiro no estágio 2 (smile) quando a pessoa já está sorrindo.
  const det = await faceapi!
    .detectSingleFace(canvas as any, tinyOpts())
    .withFaceLandmarks(true)
    .withFaceDescriptor()
    .withFaceExpressions()
  if (!det) return null

  const best = faceMatcher.findBestMatch(det.descriptor)
  if (best.label === "unknown") return null

  const nome = employeeMap.get(best.label)
  if (!nome) return null

  const similarity = Math.max(0, (1 - best.distance) * 100)
  const happy = det.expressions.happy ?? 0
  return {
    id: best.label,
    nome,
    similarity,
    isSmiling: happy >= smileThreshold,
    smileConfidence: happy * 100,
  }
}

async function handleSmileOnly(bitmap: ImageBitmap, smileThreshold: number) {
  if (!modelsLoaded) {
    bitmap.close()
    return null
  }
  const canvas = bitmapToWorkCanvas(bitmap)
  const det = await faceapi!
    .detectSingleFace(canvas as any, tinyOpts())
    .withFaceExpressions()
  if (!det) return null

  const happy = det.expressions.happy ?? 0
  return { isSmiling: happy >= smileThreshold, confidence: happy * 100 }
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data
  try {
    let result: any = null
    switch (type) {
      case "init":
        await handleInit()
        result = { backend: faceapi?.tf?.getBackend?.() || "unknown" }
        break
      case "loadDescriptors":
        result = handleLoadDescriptors(payload)
        break
      case "detectFast":
        result = await handleDetectFast(payload.bitmap)
        break
      case "recognize":
        result = await handleRecognize(payload.bitmap, payload.smileThreshold)
        break
      case "smileOnly":
        result = await handleSmileOnly(payload.bitmap, payload.smileThreshold)
        break
      default:
        throw new Error(`Mensagem desconhecida: ${type}`)
    }
    self.postMessage({ id, ok: true, result })
  } catch (error: any) {
    console.error("[face-worker] erro:", error)
    self.postMessage({ id, ok: false, error: error?.message || String(error) })
  }
}
