/**
 * API Route: Detectar sorriso na imagem
 * POST /api/aws/detect-smile
 */

import { NextRequest, NextResponse } from "next/server"
import { detectEmotions, isAWSConfigured } from "@/lib/face-api-server"

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

    // Detectar emoções
    const result = await detectEmotions(imageBase64, smileThreshold)

    return NextResponse.json({
      success: true,
      smiling: result.smiling,
      smileConfidence: result.smileConfidence,
      emotions: result.emotions,
    })
  } catch (error) {
    console.error("❌ Erro na detecção de sorriso:", error)

    // Verificar se é erro de "nenhum rosto detectado"
    if (error instanceof Error && error.message.includes("Nenhum rosto detectado")) {
      return NextResponse.json(
        {
          success: false,
          faceDetected: false,
          error: error.message,
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
