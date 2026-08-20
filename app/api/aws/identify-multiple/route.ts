import { NextRequest, NextResponse } from "next/server"
import { searchMultipleFacesByImage } from "@/lib/face-api-server"
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

    console.log("🔍 Buscando múltiplos rostos com face-api.js...")

    // Buscar múltiplos rostos na Collection
    const matches = await searchMultipleFacesByImage(imageBase64, threshold)

    if (!matches || matches.length === 0) {
      return NextResponse.json({
        success: false,
        faceDetected: true,
        error: "Nenhum funcionário reconhecido",
        funcionarios: []
      })
    }

    console.log(`✅ ${matches.length} rosto(s) encontrado(s)!`)

    // Filtrar duplicatas por externalImageId (mesma pessoa aparece múltiplas vezes)
    const uniqueMatches = Array.from(
      new Map(matches.map(m => [m.externalImageId, m])).values()
    )

    console.log(`✅ ${uniqueMatches.length} pessoa(s) única(s) identificada(s)!`)

    // Buscar funcionários no Supabase
    const funcionarios = await Promise.all(
      uniqueMatches.map(async (match) => {
        const funcionarioId = match.externalImageId
        try {
          const funcionario = await buscarFuncionarioPorId(funcionarioId)

          if (!funcionario) {
            console.warn(`⚠️ Funcionário ${funcionarioId} não encontrado no banco de dados`)
            return null
          }

          console.log(`✅ Funcionário encontrado: ${funcionario.nome} (${match.similarity}%)`)

          return {
            id: funcionario.id,
            nome: funcionario.nome,
            similarity: match.similarity,
            confidence: match.similarity / 100, // Normalizar para 0-1
          }
        } catch {
          console.warn(`⚠️ Funcionário ${funcionarioId} não encontrado no banco de dados (face sem registro no banco)`)
          return null
        }
      })
    )

    // Filtrar funcionários nulos (não encontrados no banco)
    const funcionariosValidos = funcionarios.filter((f) => f !== null)

    if (funcionariosValidos.length === 0) {
      return NextResponse.json({
        success: false,
        faceDetected: true,
        error: "Nenhum funcionário encontrado no banco de dados",
        funcionarios: []
      })
    }

    return NextResponse.json({
      success: true,
      faceDetected: true,
      funcionarios: funcionariosValidos,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const errName = error instanceof Error ? error.name : 'Unknown'
    console.error(`Erro ao identificar múltiplos funcionários: [${errName}] ${errMsg}`)
    return NextResponse.json(
      {
        success: false,
        error: `[${errName}] ${errMsg}`,
      },
      { status: 500 }
    )
  }
}
