import { NextRequest, NextResponse } from "next/server"
import { searchFaceByImage } from "@/lib/face-api-server"
import { buscarFuncionarioPorId } from "@/lib/supabase"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, threshold = 80 } = body

    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: "Imagem não fornecida" },
        { status: 400 }
      )
    }

    console.log("🔍 Buscando rosto com face-api.js...")

    // Buscar rosto na Collection
    const match = await searchFaceByImage(imageBase64, threshold)

    if (!match) {
      return NextResponse.json({
        success: false,
        faceDetected: true,
        error: "Nenhum funcionário reconhecido",
      })
    }

    console.log(`✅ Rosto encontrado! ExternalImageId: ${match.externalImageId}, Similaridade: ${match.similarity}%`)

    // Buscar funcionário no Supabase usando o externalImageId (que é o ID do funcionário)
    const funcionarioId = match.externalImageId
    const funcionario = await buscarFuncionarioPorId(funcionarioId)

    if (!funcionario) {
      return NextResponse.json({
        success: false,
        faceDetected: true,
        error: "Funcionário não encontrado no banco de dados",
      })
    }

    console.log(`✅ Funcionário encontrado: ${funcionario.nome}`)

    return NextResponse.json({
      success: true,
      faceDetected: true,
      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
        similarity: match.similarity,
        confidence: match.similarity / 100, // Normalizar para 0-1
      },
    })
  } catch (error) {
    console.error("Erro ao identificar funcionário:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao processar identificação",
      },
      { status: 500 }
    )
  }
}
