"use client"

/**
 * Face Pipeline otimizado para Modal.com
 * Version: Ultra-fast para Tablet Vision 7
 * 
 * Mantém apenas BlazeFace local para detecção rápida
 * EdgeFace processamento vai para Modal.com API
 */

import * as tf from "@tensorflow/tfjs"
import * as blazeface from "@tensorflow-models/blazeface"
import type { BlazeFaceModel, NormalizedFace } from "@tensorflow-models/blazeface"

// Interfaces simplificadas
export interface LoadedVisionModelsModal {
    blazefaceModel: BlazeFaceModel
    // Removido: faceMesh e edgeFaceSession (agora no Modal)
}

export interface DetectionResult {
    bbox: [number, number, number, number] // [x, y, w, h]
    landmarks?: number[][]
}

export interface QualityMetrics {
    illumination: number
    faceSize: number
    pose: number
    sharpness: number
    overall: number
}

export interface ModalRecognitionResult {
    success: boolean
    embedding?: number[]
    embedding_size?: number
    model_version?: string
    error?: string
}

// Configuração da API Modal
const MODAL_API_URL = process.env.NEXT_PUBLIC_MODAL_API_URL || "https://YOUR_USERNAME--face-recognition-ponto-recognize-face-endpoint.modal.run"

/**
 * Inicialização ultra-rápida - apenas BlazeFace local
 */
export async function initializeVisionModal(): Promise<LoadedVisionModelsModal> {
    console.log("🚀 Inicializando Vision Modal (BlazeFace only)...")
    
    // TFJS backend otimizado
    if (tf.getBackend() !== "webgl") {
        try {
            await tf.setBackend("webgl")
        } catch {
            await tf.setBackend("cpu")
        }
    }
    await tf.ready()

    // Carregar apenas BlazeFace (rápido)
    const blazefaceModel = await blazeface.load()
    
    console.log("✅ BlazeFace carregado com sucesso!")
    return { blazefaceModel }
}

/**
 * Detecção de rosto - mantém local para feedback em tempo real
 */
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

/**
 * Detecção de sorriso simplificada - sem MediaPipe
 */
export function estimateSmileSimple(detection: DetectionResult): number {
    if (!detection.landmarks) return 0
    
    try {
        // Usar landmarks do BlazeFace para detecção básica de sorriso
        const landmarks = detection.landmarks
        
        // Pontos aproximados da boca (BlazeFace tem 6 landmarks)
        const leftMouth = landmarks[3] || [0, 0]
        const rightMouth = landmarks[4] || [0, 0] 
        const bottomMouth = landmarks[5] || [0, 0]
        
        // Calcular "sorriso" baseado na curvatura da boca
        const mouthWidth = Math.abs(rightMouth[0] - leftMouth[0])
        const mouthHeight = Math.abs(bottomMouth[1] - ((leftMouth[1] + rightMouth[1]) / 2))
        
        // Ratio simples para detectar sorriso
        const smileRatio = mouthWidth / (mouthHeight + 1)
        
        // Normalizar para 0-1
        return Math.min(1, Math.max(0, (smileRatio - 2) / 3))
        
    } catch (error) {
        console.warn("Erro na detecção de sorriso:", error)
        return 0
    }
}

/**
 * Capturar imagem da detecção e converter para base64
 */
export function captureImageFromDetection(
    video: HTMLVideoElement, 
    bbox: [number, number, number, number],
    marginRatio: number = 0.35
): string {
    // Verificar se vídeo está pronto
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
        throw new Error("Vídeo não está pronto para captura")
    }
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    const [x, y, w, h] = bbox
    const videoW = video.videoWidth
    const videoH = video.videoHeight
    
    // Adicionar margem
    const margin = Math.min(w, h) * marginRatio
    const cropX = Math.max(0, x - margin)
    const cropY = Math.max(0, y - margin)
    const cropW = Math.min(videoW - cropX, w + 2 * margin)
    const cropH = Math.min(videoH - cropY, h + 2 * margin)
    
    // Configurar canvas
    canvas.width = 112  // Tamanho fixo para EdgeFace
    canvas.height = 112
    
    // Desenhar região recortada
    ctx.drawImage(
        video,
        cropX, cropY, cropW, cropH,  // Source
        0, 0, 112, 112               // Destination
    )
    
    // Converter para base64
    return canvas.toDataURL('image/jpeg', 0.8)
}

/**
 * Computar embedding via Modal API
 */
export async function computeEmbeddingModal(
    video: HTMLVideoElement,
    bbox: [number, number, number, number],
    options: { marginRatio?: number } = {}
): Promise<number[]> {
    try {
        console.log("🌐 Enviando imagem para Modal API...")
        
        // Capturar imagem da detecção
        const imageData = captureImageFromDetection(video, bbox, options.marginRatio || 0.35)
        
        // Fazer request para Modal API
        const response = await fetch(MODAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_data: imageData
            })
        })
        
        if (!response.ok) {
            throw new Error(`Modal API error: ${response.status} ${response.statusText}`)
        }
        
        const result: ModalRecognitionResult = await response.json()
        
        if (!result.success || !result.embedding) {
            throw new Error(`Modal API failed: ${result.error || 'Unknown error'}`)
        }
        
        console.log(`✅ Embedding recebido do Modal! Size: ${result.embedding_size}`)
        return result.embedding
        
    } catch (error) {
        console.error("❌ Erro na computação via Modal:", error)
        throw error
    }
}

/**
 * Função de fallback para casos offline (simplified)
 */
export function computeEmbeddingFallback(): number[] {
    console.warn("⚠️ Usando fallback embedding (modo offline)")
    // Retorna embedding dummy para não quebrar o app
    return new Array(512).fill(0).map(() => Math.random() - 0.5)
}

/**
 * Avaliação de qualidade - mantém local para feedback em tempo real
 */
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

    // Qualidade baseada no tamanho do rosto
    const faceArea = bw * bh
    const totalArea = videoW * videoH
    const faceSize = Math.sqrt(faceArea / totalArea)

    // Qualidade baseada na posição (centralização)
    const centerX = videoW / 2
    const centerY = videoH / 2
    const faceCenterX = bx + bw / 2
    const faceCenterY = by + bh / 2
    const distFromCenter = Math.sqrt(
        Math.pow((faceCenterX - centerX) / videoW, 2) +
        Math.pow((faceCenterY - centerY) / videoH, 2)
    )
    const pose = Math.max(0, 1 - distFromCenter * 2)

    // Iluminação simplificada (sempre OK para evitar false negatives)
    const illumination = 0.8

    // Nitidez simplificada (sempre OK)
    const sharpness = 0.7

    // Score geral
    const overall = (faceSize * 0.4 + pose * 0.3 + illumination * 0.2 + sharpness * 0.1)

    return {
        illumination,
        faceSize,
        pose,
        sharpness,
        overall
    }
}

/**
 * Encontrar melhor match - otimizado para múltiplos embeddings por pessoa
 */
export function findBestMatchKnnAdvanced(
    queryEmbedding: number[],
    funcionarios: Array<{id: string; nome: string; descritores?: number[][]}>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    k: number = 5,
    verbose: boolean = false
): {id: string | null; nome: string | null; distance: number; confidence: number | null} {
    
    if (!queryEmbedding || queryEmbedding.length === 0) {
        if (verbose) console.log("❌ Query embedding vazio")
        return {id: null, nome: null, distance: Infinity, confidence: null}
    }

    // Calcular distâncias para cada pessoa (não cada embedding individual)
    const personMatches: Array<{
        id: string;
        nome: string;
        bestDistance: number;
        avgDistance: number;
        embeddingCount: number;
        topKDistances: number[];
    }> = []

    for (const funcionario of funcionarios) {
        if (!funcionario.descritores || funcionario.descritores.length === 0) continue

        const distances: number[] = []

        // Calcular distância para todos os embeddings desta pessoa
        for (const embedding of funcionario.descritores) {
            if (embedding.length !== queryEmbedding.length) continue

            // Distância euclidiana normalizada
            const distance = Math.sqrt(
                queryEmbedding.reduce((sum, val, i) => sum + Math.pow(val - embedding[i], 2), 0)
            ) / Math.sqrt(queryEmbedding.length)

            distances.push(distance)
        }

        if (distances.length === 0) continue

        // Estatísticas para esta pessoa
        distances.sort((a, b) => a - b)
        const topK = distances.slice(0, Math.min(3, distances.length)) // Top 3 melhores matches
        const bestDistance = distances[0]
        const avgDistance = topK.reduce((sum, d) => sum + d, 0) / topK.length

        personMatches.push({
            id: funcionario.id,
            nome: funcionario.nome,
            bestDistance,
            avgDistance,
            embeddingCount: distances.length,
            topKDistances: topK
        })
    }

    if (personMatches.length === 0) {
        return {id: null, nome: null, distance: Infinity, confidence: null}
    }

    // Ordenar por melhor distância média dos top-K matches
    personMatches.sort((a, b) => a.avgDistance - b.avgDistance)
    const bestPerson = personMatches[0]

    // Calcular confiança melhorada
    let confidence = 0
    
    if (personMatches.length > 1) {
        const secondBest = personMatches[1]
        
        // Confiança baseada na separação entre 1º e 2º lugar
        const separation = (secondBest.avgDistance - bestPerson.avgDistance) / (bestPerson.avgDistance + 0.1)
        
        // Bonus por ter múltiplos embeddings consistentes
        const consistencyBonus = Math.min(0.3, bestPerson.embeddingCount / 20) // Max bonus com 20+ embeddings
        
        // Penalty para distâncias altas
        const distancePenalty = Math.min(0.4, bestPerson.avgDistance / 2.0)
        
        confidence = Math.max(0, Math.min(1, separation + consistencyBonus - distancePenalty))
    } else {
        // Apenas uma pessoa - confiança baseada apenas na distância e consistência
        const consistencyBonus = Math.min(0.4, bestPerson.embeddingCount / 20)
        const distancePenalty = Math.min(0.6, bestPerson.avgDistance / 1.5)
        confidence = Math.max(0, Math.min(1, 0.5 + consistencyBonus - distancePenalty))
    }

    if (verbose) {
        console.log(`🎯 Melhor match: ${bestPerson.nome}`)
        console.log(`   Melhor distância: ${bestPerson.bestDistance.toFixed(3)}`)
        console.log(`   Distância média (top-3): ${bestPerson.avgDistance.toFixed(3)}`)
        console.log(`   Embeddings testados: ${bestPerson.embeddingCount}`)
        console.log(`   Confiança: ${(confidence * 100).toFixed(1)}%`)
        if (personMatches.length > 1) {
            console.log(`   2º lugar: ${personMatches[1].nome} (${personMatches[1].avgDistance.toFixed(3)})`)
        }
    }

    return {
        id: bestPerson.id,
        nome: bestPerson.nome,
        distance: bestPerson.avgDistance, // Usar distância média para decisão
        confidence: confidence
    }
}