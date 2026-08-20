/**
 * API Route: Detectar sorriso em múltiplos rostos
 * POST /api/aws/detect-multiple-smiles
 */

import { NextRequest, NextResponse } from "next/server"
import { detectMultipleEmotions, isAWSConfigured } from "@/lib/face-api-server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    // Verificar se face-api.js está configurado
    if (!isAWSConfigured()) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          error: "Reconhecimento facial não configurado.",
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { imageBase64, smileThreshold = 80 } = body

    if (!imageBase64) {
      return NextResponse.json(
        {
          success: false,
          error: "Imagem base64 é obrigatória",
        },
        { status: 400 }
      )
    }

    // Detectar emoções de múltiplos rostos
    const results = await detectMultipleEmotions(imageBase64, smileThreshold)

    if (results.length === 0) {
      return NextResponse.json(
        {
          success: false,
          faceDetected: false,
          error: "Nenhum rosto detectado na imagem",
          faces: []
        },
        { status: 400 }
      )
    }

    // Mapear resultados para cada rosto
    const faces = results.map((result, index) => ({
      faceIndex: index,
      smiling: result.smiling,
      smileConfidence: result.smileConfidence,
      emotions: result.emotions,
    }))

    // Verificar se todos estão sorrindo
    const allSmiling = faces.every(face => face.smiling)

    return NextResponse.json({
      success: true,
      facesDetected: faces.length,
      allSmiling,
      faces,
    })
  } catch (error) {
    console.error("❌ Erro na detecção de múltiplos sorrisos:", error)

    // Verificar se é erro de "nenhum rosto detectado"
    if (error instanceof Error && error.message.includes("Nenhum rosto detectado")) {
      return NextResponse.json(
        {
          success: false,
          faceDetected: false,
          error: error.message,
          faces: []
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao detectar emoções",
      },
      { status: 500 }
    )
  }
}
