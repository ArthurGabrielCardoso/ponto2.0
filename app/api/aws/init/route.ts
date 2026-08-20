import { NextResponse } from "next/server"
import { isAWSConfigured, initializeCollection, listFaces } from "@/lib/face-api-server"

export const runtime = "nodejs"

export async function GET() {
  try {
    // Verificar se face-api.js está configurado
    if (!isAWSConfigured()) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          message: "Reconhecimento facial não configurado.",
        },
        { status: 500 }
      )
    }

    // Inicializar Collection
    const initResult = await initializeCollection()

    if (!initResult.success) {
      return NextResponse.json(
        {
          success: false,
          configured: true,
          message: initResult.message,
        },
        { status: 500 }
      )
    }

    // Listar rostos cadastrados
    const faces = await listFaces()

    return NextResponse.json({
      success: true,
      configured: true,
      message: initResult.message,
      totalFaces: faces.length,
      collectionId: "face-api-local",
    })
  } catch (error) {
    console.error("Erro ao inicializar face-api.js:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}
