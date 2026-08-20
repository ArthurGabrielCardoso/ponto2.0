import { NextRequest, NextResponse } from "next/server"
import { atualizarDescritoresFuncionario, buscarFuncionarioPorId } from "@/lib/supabase"
import {
  ERRO_CONTRATO_ANTIGO,
  TAMANHO_DESCRITOR,
  usandoContratoAntigo,
  validarDescritores,
} from "@/lib/descritores"

export const runtime = "nodejs"

/**
 * Acrescenta descritores faciais a um funcionário já cadastrado.
 *
 * Mesma migração da rota add-person: a extração saiu do servidor (que dependia
 * do `canvas` nativo, quebrado no serverless) e foi para o worker do navegador.
 * Aqui a rota valida, mescla com o que já existe e grava.
 */

type CorpoAtualizacao = {
  funcionarioId?: unknown
  descritores?: unknown
  fotos?: unknown
}

function falha(erro: string, status: number) {
  return NextResponse.json({ success: false, error: erro }, { status })
}

export async function POST(request: NextRequest) {
  let body: CorpoAtualizacao
  try {
    body = await request.json()
  } catch {
    return falha("O corpo da requisição não é um JSON válido.", 400)
  }

  const funcionarioId =
    typeof body.funcionarioId === "string" ? body.funcionarioId.trim() : ""
  if (!funcionarioId) {
    return falha("O campo 'funcionarioId' é obrigatório.", 400)
  }

  if (usandoContratoAntigo(body)) {
    return falha(ERRO_CONTRATO_ANTIGO, 400)
  }

  const validacao = validarDescritores(body.descritores)
  if (!validacao.ok) {
    return falha(validacao.erro, validacao.status)
  }
  const novosDescritores = validacao.descritores

  try {
    const funcionario = await buscarFuncionarioPorId(funcionarioId)
    if (!funcionario) {
      return falha(`Funcionário ${funcionarioId} não encontrado.`, 404)
    }

    // Descarta descritores legados de outra dimensão que possam estar no banco:
    // misturá-los com os 128D faria o FaceMatcher lançar erro no reconhecimento.
    const existentes = (funcionario.descritores || []).filter(
      (d) => Array.isArray(d) && d.length === TAMANHO_DESCRITOR,
    )
    const todos = [...existentes, ...novosDescritores]

    await atualizarDescritoresFuncionario(funcionarioId, todos)

    console.log(
      `[update-person] ${funcionarioId}: +${novosDescritores.length} descritor(es), total ${todos.length}`,
    )

    return NextResponse.json({
      success: true,
      message: "Fotos adicionadas com sucesso!",
      funcionarioId,
      descritoresAdicionados: novosDescritores.length,
      descritoresTotais: todos.length,
    })
  } catch (erro) {
    console.error("[update-person] falha ao gravar no Supabase:", erro)
    return falha(
      erro instanceof Error ? erro.message : "Erro ao atualizar funcionário.",
      500,
    )
  }
}
