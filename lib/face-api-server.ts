/**
 * Biblioteca de reconhecimento facial com face-api.js (Server-Side)
 * Substitui lib/aws-rekognition.ts - mesma interface, zero custo
 *
 * Usa require() para evitar que o Turbopack/Webpack processe os módulos
 * como código de browser, mantendo o contexto Node.js correto.
 */

import * as path from "path"

// Interfaces (mantidas iguais ao aws-rekognition.ts)
export interface AWSFaceDetectResult {
  faceId: string
  confidence: number
  boundingBox: {
    width: number
    height: number
    left: number
    top: number
  }
}

export interface AWSPersonIdentifyResult {
  faceId: string
  similarity: number
  externalImageId: string
}

export interface AWSEmotionResult {
  smiling: boolean
  smileConfidence: number
  emotions: {
    type: string
    confidence: number
  }[]
}

// Estado dos modelos
let modelsLoaded = false
let modelsLoading: Promise<void> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceapi: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let canvasModule: any = null

/**
 * Inicializa face-api.js e canvas usando require() para evitar bundling
 */
function initFaceApiModule() {
  if (faceapi) return

  // face-api.js já embute seu próprio @tensorflow/tfjs-core@1.7.0
  // NÃO carregar @tensorflow/tfjs externo - causa conflito de versão (forwardFunc error)

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  faceapi = require("face-api.js")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  canvasModule = require("canvas")

  // Configurar ambiente Node.js para face-api.js
  const { Canvas, Image, ImageData, createCanvas } = canvasModule
  faceapi.env.monkeyPatch({
    Canvas,
    Image,
    ImageData,
    createCanvasElement: () => createCanvas(1, 1),
    createImageElement: () => new Image(),
  })
}

/**
 * Carrega os modelos face-api.js (idempotente)
 */
async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return
  if (modelsLoading) return modelsLoading

  modelsLoading = (async () => {
    try {
      initFaceApiModule()

      const modelsPath = path.join(process.cwd(), "models")
      console.log(`🧠 Carregando modelos face-api.js de: ${modelsPath}`)

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
        faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
        faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath),
        faceapi.nets.faceExpressionNet.loadFromDisk(modelsPath),
      ])

      modelsLoaded = true
      console.log("✅ Modelos face-api.js carregados com sucesso!")
    } catch (error) {
      modelsLoading = null
      throw error
    }
  })()

  return modelsLoading
}

/**
 * Converte base64 para canvas do Node.js
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function base64ToCanvas(imageBase64: string): Promise<any> {
  initFaceApiModule()
  const { createCanvas, loadImage } = canvasModule

  // Remover prefixo data:image se existir
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")
  const buffer = Buffer.from(base64Data, "base64")

  const img = await loadImage(buffer)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext("2d")
  ctx.drawImage(img, 0, 0)

  return canvas
}

/**
 * Verifica se o face-api.js está configurado (sempre true, sem credenciais necessárias)
 */
export function isAWSConfigured(): boolean {
  return true
}

/**
 * Inicializa os modelos (equivalente a initializeCollection do AWS)
 */
export async function initializeCollection(): Promise<{ success: boolean; message: string }> {
  try {
    await ensureModelsLoaded()
    return { success: true, message: "Modelos face-api.js carregados com sucesso" }
  } catch (error) {
    console.error("Erro ao inicializar modelos:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

/**
 * Indexa um rosto - extrai descriptor 128D e retorna
 */
export async function indexFace(
  imageBase64: string,
  externalImageId: string
): Promise<{ faceId: string; confidence: number; descriptor: number[] }> {
  try {
    await ensureModelsLoaded()
    const canvas = await base64ToCanvas(imageBase64)

    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!detection) {
      throw new Error("Nenhum rosto detectado na imagem")
    }

    const descriptor = Array.from(detection.descriptor) as number[]
    const confidence = detection.detection.score * 100

    const faceId = `faceapi_${externalImageId}_${Date.now()}`

    return { faceId, confidence, descriptor }
  } catch (error) {
    console.error("Erro ao indexar rosto:", error)
    throw error
  }
}

/**
 * Busca rosto por imagem (single face)
 */
export async function searchFaceByImage(
  imageBase64: string,
  threshold = 80
): Promise<AWSPersonIdentifyResult | null> {
  try {
    await ensureModelsLoaded()
    const canvas = await base64ToCanvas(imageBase64)

   const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!detection) {
      return null
    }

    const { buscarFuncionarios } = await import("@/lib/supabase")
    const funcionarios = await buscarFuncionarios()

    const labeledDescriptors: InstanceType<typeof faceapi.LabeledFaceDescriptors>[] = []

    for (const func of funcionarios) {
      if (func.descritores && func.descritores.length > 0) {
        const validDescriptors = func.descritores
          .filter((d: number[]) => d.length === 128)
          .map((d: number[]) => new Float32Array(d))

        if (validDescriptors.length > 0) {
          labeledDescriptors.push(
            new faceapi.LabeledFaceDescriptors(func.id, validDescriptors)
          )
        }
      }
    }

    if (labeledDescriptors.length === 0) {
      return null
    }

    // threshold 80 → distância ~0.36, threshold 60 → distância ~0.52
    const distanceThreshold = Math.max(0.3, Math.min(0.8, 1 - threshold / 125))

    const matcher = new faceapi.FaceMatcher(labeledDescriptors, distanceThreshold)
    const bestMatch = matcher.findBestMatch(detection.descriptor)

    if (bestMatch.label === "unknown") {
      return null
    }

    const similarity = Math.max(0, (1 - bestMatch.distance) * 100)

    return {
      faceId: `match_${bestMatch.label}`,
      similarity,
      externalImageId: bestMatch.label,
    }
  } catch (error) {
    console.error("Erro ao buscar rosto:", error)
    throw error
  }
}

/**
 * Busca múltiplos rostos em uma imagem
 */
export async function searchMultipleFacesByImage(
  imageBase64: string,
  threshold = 80,
  maxFaces = 10
): Promise<AWSPersonIdentifyResult[]> {
  try {
    await ensureModelsLoaded()
    const canvas = await base64ToCanvas(imageBase64)

    const detections = await faceapi.detectAllFaces(canvas)
      .withFaceLandmarks()
      .withFaceDescriptors()

    if (!detections || detections.length === 0) {
      return []
    }

    const { buscarFuncionarios } = await import("@/lib/supabase")
    const funcionarios = await buscarFuncionarios()

    const labeledDescriptors: InstanceType<typeof faceapi.LabeledFaceDescriptors>[] = []

    for (const func of funcionarios) {
      if (func.descritores && func.descritores.length > 0) {
        const validDescriptors = func.descritores
          .filter((d: number[]) => d.length === 128)
          .map((d: number[]) => new Float32Array(d))

        if (validDescriptors.length > 0) {
          labeledDescriptors.push(
            new faceapi.LabeledFaceDescriptors(func.id, validDescriptors)
          )
        }
      }
    }

    if (labeledDescriptors.length === 0) {
      return []
    }

    const distanceThreshold = Math.max(0.3, Math.min(0.8, 1 - threshold / 125))
    const matcher = new faceapi.FaceMatcher(labeledDescriptors, distanceThreshold)

    const results: AWSPersonIdentifyResult[] = []
    const seenIds = new Set<string>()

    const facesToProcess = detections.slice(0, maxFaces)

    for (const detection of facesToProcess) {
      const bestMatch = matcher.findBestMatch(detection.descriptor)

      if (bestMatch.label !== "unknown" && !seenIds.has(bestMatch.label)) {
        seenIds.add(bestMatch.label)
        const similarity = Math.max(0, (1 - bestMatch.distance) * 100)

        results.push({
          faceId: `match_${bestMatch.label}`,
          similarity,
          externalImageId: bestMatch.label,
        })
      }
    }

    return results
  } catch (error) {
    console.error("Erro ao buscar múltiplos rostos:", error)
    throw error
  }
}

/**
 * Lista todos os funcionários com descritores (equivalente a listFaces)
 */
export async function listFaces(): Promise<{ faceId: string; externalImageId: string }[]> {
  try {
    const { buscarFuncionarios } = await import("@/lib/supabase")
    const funcionarios = await buscarFuncionarios()

    const faces: { faceId: string; externalImageId: string }[] = []

    for (const func of funcionarios) {
      if (func.descritores && func.descritores.length > 0) {
        for (let i = 0; i < func.descritores.length; i++) {
          faces.push({
            faceId: `faceapi_${func.id}_${i}`,
            externalImageId: func.id,
          })
        }
      }
    }

    return faces
  } catch (error) {
    console.error("Erro ao listar rostos:", error)
    throw error
  }
}

/**
 * Remove rostos (no face-api.js, os descritores ficam no Supabase)
 */
export async function deleteFaces(faceIds: string[]): Promise<void> {
  console.log(`Solicitação de remoção de ${faceIds.length} face(s) - gerenciado via Supabase`)
}

/**
 * Remove todos os rostos de um funcionário
 */
export async function deleteFacesByExternalId(externalImageId: string): Promise<number> {
  try {
    const { atualizarDescritoresFuncionario } = await import("@/lib/supabase")
    await atualizarDescritoresFuncionario(externalImageId, [])
    return 1
  } catch (error) {
    console.error("Erro ao deletar rostos por external ID:", error)
    throw error
  }
}

/**
 * Detecta emoções na imagem (incluindo sorriso) - single face
 */
export async function detectEmotions(
  imageBase64: string,
  smileThreshold = 80
): Promise<AWSEmotionResult> {
  try {
    await ensureModelsLoaded()
    const canvas = await base64ToCanvas(imageBase64)

    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceExpressions()

    if (!detection) {
      throw new Error("Nenhum rosto detectado na imagem")
    }

    const expressions = detection.expressions

    const emotionMap: { [key: string]: string } = {
      happy: "HAPPY",
      sad: "SAD",
      angry: "ANGRY",
      fearful: "FEAR",
      disgusted: "DISGUSTED",
      surprised: "SURPRISED",
      neutral: "CALM",
    }

    const emotions = Object.entries(expressions)
      .map(([key, value]) => ({
        type: emotionMap[key] || key.toUpperCase(),
        confidence: (value as number) * 100,
      }))
      .sort((a, b) => b.confidence - a.confidence)

    const smileConfidence = (expressions.happy as number) * 100
    const smiling = smileConfidence >= smileThreshold

    return {
      smiling,
      smileConfidence,
      emotions,
    }
  } catch (error) {
    console.error("Erro ao detectar emoções:", error)
    throw error
  }
}

/**
 * Detecta emoções de múltiplos rostos em uma imagem
 */
export async function detectMultipleEmotions(
  imageBase64: string,
  smileThreshold = 80
): Promise<AWSEmotionResult[]> {
  try {
    await ensureModelsLoaded()
    const canvas = await base64ToCanvas(imageBase64)

    const detections = await faceapi.detectAllFaces(canvas)
      .withFaceLandmarks()
      .withFaceExpressions()

    if (!detections || detections.length === 0) {
      return []
    }

    const emotionMap: { [key: string]: string } = {
      happy: "HAPPY",
      sad: "SAD",
      angry: "ANGRY",
      fearful: "FEAR",
      disgusted: "DISGUSTED",
      surprised: "SURPRISED",
      neutral: "CALM",
    }

    return detections.map((detection: { expressions: Record<string, number> }) => {
      const expressions = detection.expressions

      const emotions = Object.entries(expressions)
        .map(([key, value]) => ({
          type: emotionMap[key] || key.toUpperCase(),
          confidence: (value as number) * 100,
        }))
        .sort((a, b) => b.confidence - a.confidence)

      const smileConfidence = (expressions.happy as number) * 100
      const smiling = smileConfidence >= smileThreshold

      return {
        smiling,
        smileConfidence,
        emotions,
      }
    })
  } catch (error) {
    console.error("Erro ao detectar múltiplas emoções:", error)
    throw error
  }
}
