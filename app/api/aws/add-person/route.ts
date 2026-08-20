import { NextRequest, NextResponse } from "next/server"
import { cadastrarFuncionario, buscarFuncionarios } from "@/lib/supabase"
import {
  ERRO_CONTRATO_ANTIGO,
  usandoContratoAntigo,
  validarDescritores,
} from "@/lib/descritores"
import type { HorariosSemana } from "@/lib/types"

export const runtime = "nodejs"

/**
 * Cadastra um funcionário a partir de descritores faciais extraídos no navegador.
 *
 * Antes esta rota recebia as fotos em base64 e rodava face-api.js aqui no
 * servidor, o que exigia o pacote `canvas` — módulo nativo (Cairo/Pango) que não
 * carrega no runtime serverless da Vercel. Toda tentativa de cadastro caía no
 * catch genérico e virava um 500 sem explicação.
 *
 * Agora o trabalho pesado acontece no worker do browser (lib/face-worker.ts),
 * que já tem os modelos carregados para o reconhecimento. Aqui só resta validar
 * e persistir — sem dependência nativa, sem custo de CPU, e a imagem do rosto
 * nunca sai do dispositivo.
 */

type CorpoCadastro = {
  nome?: unknown
  descritores?: unknown
  fotos?: unknown
  horarios?: HorariosSemana
  cargaHorariaDiaria?: unknown
}

const CARGA_HORARIA_PADRAO = 480 // 8 horas

function falha(erro: string, status: number) {
  return NextResponse.json({ success: false, error: erro }, { status })
}

export async function POST(request: NextRequest) {
  let body: CorpoCadastro
  try {
    body = await request.json()
  } catch {
    return falha("O corpo da requisição não é um JSON válido.", 400)
  }

  const nome = typeof body.nome === "string" ? body.nome.trim() : ""
  if (!nome) {
    return falha("O campo 'nome' é obrigatório.", 400)
  }

  if (usandoContratoAntigo(body)) {
    return falha(ERRO_CONTRATO_ANTIGO, 400)
  }

  const validacao = validarDescritores(body.descritores)
  if (!validacao.ok) {
    return falha(validacao.erro, validacao.status)
  }
  const { descritores } = validacao

  const cargaHorariaDiaria =
    typeof body.cargaHorariaDiaria === "number" &&
    Number.isFinite(body.cargaHorariaDiaria) &&
    body.cargaHorariaDiaria > 0
      ? body.cargaHorariaDiaria
      : CARGA_HORARIA_PADRAO

  try {
    await cadastrarFuncionario(nome, descritores, body.horarios, cargaHorariaDiaria)

    // Releitura só para devolver o id ao cliente. O funcionário já está gravado
    // neste ponto, então uma falha aqui não invalida o cadastro: devolve null.
    let funcionarioId: string | null = null
    try {
      const funcionarios = await buscarFuncionarios()
      funcionarioId = funcionarios.find((f) => f.nome === nome)?.id ?? null
    } catch (erro) {
      console.error("[add-person] cadastro gravado, mas a releitura do id falhou:", erro)
    }

    console.log(`[add-person] ${nome} cadastrado com ${descritores.length} descritor(es)`)

    return NextResponse.json({
      success: true,
      message: `Funcionário ${nome} cadastrado com sucesso!`,
      funcionarioId,
      descritoresSalvos: descritores.length,
    })
  } catch (erro) {
    // Aqui só chega falha real de servidor: Supabase fora, credencial errada,
    // violação de constraint. Nada que o usuário possa corrigir refazendo a foto.
    console.error("[add-person] falha ao gravar no Supabase:", erro)
    return falha(
      erro instanceof Error ? erro.message : "Erro ao cadastrar funcionário.",
      500,
    )
  }
}
