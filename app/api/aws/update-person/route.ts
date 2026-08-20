import { NextRequest, NextResponse } from "next/server"
import { indexFace } from "@/lib/face-api-server"
import { atualizarDescritoresFuncionario, buscarFuncionarioPorId } from "@/lib/supabase"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { funcionarioId, fotos } = body as {
      funcionarioId: string
      fotos: string[]
    }

    if (!funcionarioId || !fotos || fotos.length === 0) {
      return NextResponse.json(
        { success: false, error: "funcionarioId e fotos são obrigatórios" },
        { status: 400 }
      )
    }

    console.log(`📸 Atualizando funcionário: ${funcionarioId}`)
    console.log(`📊 Total de novas fotos: ${fotos.length}`)

    // Buscar descritores existentes do funcionário
    const funcionario = await buscarFuncionarioPorId(funcionarioId)
    const descritoresExistentes = funcionario?.descritores || []

    // Extrair descritores das novas fotos com face-api.js
    const faceIds: string[] = []
    const novosDescritores: number[][] = []
    const resultadosFotos: { foto: number; confianca: number; sucesso: boolean }[] = []
    let fotosAdicionadas = 0

    for (let i = 0; i < fotos.length; i++) {
      try {
        console.log(`📸 Processando foto ${i + 1}/${fotos.length}...`)

        const result = await indexFace(fotos[i], funcionarioId)

        faceIds.push(result.faceId)
        novosDescritores.push(result.descriptor)
        fotosAdicionadas++

        resultadosFotos.push({ foto: i + 1, confianca: Math.round(result.confidence * 10) / 10, sucesso: true })
        console.log(`✅ Foto ${i + 1} processada! Confiança: ${result.confidence.toFixed(1)}%`)
      } catch (error) {
        console.error(`❌ Erro ao processar foto ${i + 1}:`, error)
        resultadosFotos.push({ foto: i + 1, confianca: 0, sucesso: false })
      }
    }

    if (fotosAdicionadas === 0) {
      throw new Error("Nenhuma foto pôde ser processada")
    }

    // Combinar descritores existentes (128D) com novos
    const descritoresValidos = descritoresExistentes.filter(d => d.length === 128)
    const todosDescritores = [...descritoresValidos, ...novosDescritores]

    // Salvar no Supabase
    await atualizarDescritoresFuncionario(funcionarioId, todosDescritores)

    console.log(`✅ Funcionário atualizado com sucesso!`)
    console.log(`📊 Fotos adicionadas: ${fotosAdicionadas}/${fotos.length}`)

    return NextResponse.json({
      success: true,
      message: `Fotos adicionadas com sucesso!`,
      funcionarioId: funcionarioId,
      fotosAdicionadas,
      fotosTotais: fotos.length,
      faceIds,
      resultadosFotos,
    })
  } catch (error) {
    console.error("Erro ao atualizar funcionário:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao atualizar funcionário",
      },
      { status: 500 }
    )
  }
}
