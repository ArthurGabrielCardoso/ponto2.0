"use client"

import * as tf from "@tensorflow/tfjs"
import * as blazeface from "@tensorflow-models/blazeface"
import type { BlazeFaceModel, NormalizedFace } from "@tensorflow-models/blazeface"

export interface LoadedVisionModels {
    blazefaceModel: BlazeFaceModel
}

export interface DetectionResult {
    bbox: [number, number, number, number] // [x, y, w, h]
    landmarks?: number[][]
}

export interface QualityMetrics {
    illumination: number // 0-1, mais alto = melhor iluminação
    faceSize: number // 0-1, mais alto = rosto maior
    pose: number // 0-1, mais alto = pose mais frontal
    sharpness: number // 0-1, mais alto = mais nítido
    overall: number // 0-1, qualidade geral combinada
}

export async function initializeVision(): Promise<LoadedVisionModels> {
    // TFJS backend
    if (tf.getBackend() !== "webgl") {
        try {
            await tf.setBackend("webgl")
        } catch {
            await tf.setBackend("cpu")
        }
    }
    await tf.ready()

    const blazefaceModel = await blazeface.load()

    return { blazefaceModel }
}

export async function detectSingleFace(
    video: HTMLVideoElement,
    model: BlazeFaceModel,
): Promise<DetectionResult | null> {
    const faces = (await model.estimateFaces(video, false)) as NormalizedFace[]
    if (!faces || faces.length === 0) return null
    // Selecionar o rosto com maior área
    const best = faces.reduce((acc, f) => {
        const [x, y] = f.topLeft as [number, number]
        const [x2, y2] = f.bottomRight as [number, number]
        const area = Math.max(0, x2 - x) * Math.max(0, y2 - y)
        if (!acc || area > acc.area) return { face: f, area }
        return acc
    }, null as null | { face: NormalizedFace; area: number })
    if (!best) return null
    const f = best.face
    const [x, y] = f.topLeft as [number, number]
    const [x2, y2] = f.bottomRight as [number, number]
    const w = Math.max(1, x2 - x)
    const h = Math.max(1, y2 - y)
    return { bbox: [x, y, w, h], landmarks: (f.landmarks as number[][]) || undefined }
}

export function assessImageQuality(
    video: HTMLVideoElement,
    bbox: [number, number, number, number],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    landmarks?: number[][]
): QualityMetrics {
    const [bx, by, bw, bh] = bbox
    const fallbackDims = video as unknown as { width?: number; height?: number }
    const videoW = video.videoWidth || fallbackDims.width || 1280
    const videoH = video.videoHeight || fallbackDims.height || 720

    // 1. Tamanho do rosto (maior = melhor)
    const faceArea = bw * bh
    const totalArea = videoW * videoH
    const faceRatio = faceArea / totalArea
    const faceSize = Math.min(1, faceRatio * 20) // normalizado para ~5% ser score 1.0

    // 2. Posição do rosto (centralizado = melhor)
    const centerX = bx + bw / 2
    const centerY = by + bh / 2
    const videoCenterX = videoW / 2
    const videoCenterY = videoH / 2
    const offsetX = Math.abs(centerX - videoCenterX) / videoW
    const offsetY = Math.abs(centerY - videoCenterY) / videoH
    const pose = Math.max(0, 1 - (offsetX + offsetY) * 2)

    // 3. Iluminação básica (usando amostragem de pixels)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    canvas.width = Math.min(100, bw)
    canvas.height = Math.min(100, bh)

    ctx.drawImage(video, bx, by, bw, bh, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    let brightness = 0
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i]
        const g = imageData.data[i + 1]
        const b = imageData.data[i + 2]
        brightness += (r + g + b) / 3
    }
    brightness /= (imageData.data.length / 4)

    // Normalizar iluminação (ideal ~120-180, muito escuro <60, muito claro >220)
    const illumination = brightness < 60 ? brightness / 60 * 0.5 :
                        brightness > 220 ? Math.max(0, 1 - (brightness - 220) / 35) :
                        Math.min(1, (brightness - 60) / 60 * 0.5 + 0.5)

    // 4. Nitidez simples (variância de gradientes)
    let sharpness = 0.7 // valor padrão conservador
    if (canvas.width > 20 && canvas.height > 20) {
        let variance = 0
        let count = 0
        for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < canvas.width - 1; x++) {
                const idx = (y * canvas.width + x) * 4
                const current = imageData.data[idx]
                const right = imageData.data[idx + 4]
                const bottom = imageData.data[(y + 1) * canvas.width * 4 + x * 4]
                const gradX = Math.abs(current - right)
                const gradY = Math.abs(current - bottom)
                variance += gradX + gradY
                count++
            }
        }
        if (count > 0) {
            const avgGrad = variance / count
            sharpness = Math.min(1, avgGrad / 50) // normalizado
        }
    }

    // 5. Qualidade geral (média ponderada)
    const overall = (faceSize * 0.3 + pose * 0.2 + illumination * 0.3 + sharpness * 0.2)

    return {
        illumination,
        faceSize,
        pose,
        sharpness,
        overall
    }
}
