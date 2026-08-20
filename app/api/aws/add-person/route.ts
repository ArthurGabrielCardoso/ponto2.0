import { NextRequest, NextResponse } from "next/server"
import { indexFace } from "@/lib/face-api-server"
import { cadastrarFuncionario } from "@/lib/supabase"
import type { HorariosSemana } from "@/lib/types"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nome, fotos, horarios, cargaHorariaDiaria = 480 } = body as {
      nome: string
      fotos: string[]
      horarios?: HorariosSemana
      cargaHorariaDiaria?: number
    }

    if (!nome || !fotos || fotos.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nome e fotos são obrigatórios" },
        { status: 400 }
      )
    }

    console.log(`📸 Cadastrando funcionário: ${nome}`)
    console.log(`📊 Total de fotos: ${fotos.length}`)

    // Extrair descritores faciais de cada foto usando face-api.js
    const faceIds: string[] = []
    const descritores: number[][] = []
    const resultadosFotos: { foto: number; confianca: number; sucesso: boolean }[] = []
    let fotosAdicionadas = 0
    const errosIndexacao: string[] = []

    // Gerar um ID temporário para indexação
    const tempId = `temp_${Date.now()}`

    for (let i = 0; i < fotos.length; i++) {
      try {
        console.log(`📸 Processando foto ${i + 1}/${fotos.length}... (tamanho base64: ${fotos[i].length} chars)`)

        const result = await indexFace(fotos[i], tempId)

        faceIds.push(result.faceId)
        descritores.push(result.descriptor)
        fotosAdicionadas++

        resultadosFotos.push({ foto: i + 1, confianca: Math.round(result.confidence * 10) / 10, sucesso: true })
        console.log(`✅ Foto ${i + 1} processada! Confiança: ${result.confidence.toFixed(1)}%`)
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        const errName = error instanceof Error ? error.name : 'Unknown'
        console.error(`❌ Erro ao processar foto ${i + 1}: [${errName}] ${errMsg}`)
        errosIndexacao.push(`Foto ${i + 1}: [${errName}] ${errMsg}`)
        resultadosFotos.push({ foto: i + 1, confianca: 0, sucesso: false })
      }
    }

    if (fotosAdicionadas === 0) {
      const detalheErros = errosIndexacao.join(' | ')
      throw new Error(`Nenhuma foto pôde ser processada. Erros: ${detalheErros}`)
    }

    // Cadastrar funcionário no Supabase com os descritores extraídos
    await cadastrarFuncionario(nome, descritores, horarios, cargaHorariaDiaria)

    // Buscar o funcionário recém-criado para obter o ID
    const { buscarFuncionarios } = await import("@/lib/supabase")
    const funcionarios = await buscarFuncionarios()
    const funcionario = funcionarios.find((f) => f.nome === nome)

    if (!funcionario) {
      throw new Error("Funcionário não encontrado após criação")
    }

    const funcionarioId = funcionario.id
    console.log(`✅ Funcionário ${nome} cadastrado com sucesso!`)
    console.log(`📊 Fotos processadas: ${fotosAdicionadas}/${fotos.length}`)

    return NextResponse.json({
      success: true,
      message: `Funcionário ${nome} cadastrado com sucesso!`,
      funcionarioId: funcionarioId,
      fotosAdicionadas,
      fotosTotais: fotos.length,
      faceIds,
      resultadosFotos,
    })
  } catch (error) {
    console.error("Erro ao cadastrar funcionário:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao cadastrar funcionário",
      },
      { status: 500 }
    )
  }
}
