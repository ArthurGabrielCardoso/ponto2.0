"use client"

import {
  extractDescriptorFromBase64,
  getBackend,
  initModels,
} from "@/lib/face-recognition-client"

/**
 * Passo de cadastro que roda no navegador: fotos capturadas → descritores 128D.
 *
 * O servidor não extrai mais descritor nenhum. A rota antiga rodava face-api.js
 * no Node, o que exigia o pacote `canvas` (Cairo/Pango) — módulo nativo que não
 * carrega no runtime serverless da Vercel, então todo cadastro em produção caía
 * num 500 genérico. Aqui reusamos o worker que o reconhecimento já usa.
 *
 * Compartilhado por /cadastrar e /atualizar, que faziam a mesma coisa com
 * código diferente (e ambos com log falso).
 */

export type EstadoFoto = "pendente" | "processando" | "ok" | "falhou"

export interface ProgressoFoto {
  estado: EstadoFoto
  confianca?: number
  erro?: string
}

export type FaseCadastro =
  | "modelos"
  | "fotos"
  | "salvando"
  | "concluido"
  | "erro"

export interface ProgressoCadastro {
  fase: FaseCadastro
  fotos: ProgressoFoto[]
  /** Backend de inferência em uso: webgl, wasm ou cpu. */
  backend: string
  /** Preenchido quando fase === "erro". */
  mensagem?: string
}

export type ReportarProgresso = (p: ProgressoCadastro) => void

/**
 * Extrai o descritor de cada foto, reportando progresso estruturado.
 *
 * Fotos sem rosto são puladas com aviso, não abortam o lote — numa captura de
 * 5 poses é comum uma sair borrada. Só lança se nenhuma prestar.
 */
export async function extrairDescritores(
  fotos: string[],
  reportar: ReportarProgresso,
): Promise<number[][]> {
  const progresso: ProgressoFoto[] = fotos.map(() => ({ estado: "pendente" }))

  const emitir = (fase: FaseCadastro, mensagem?: string) =>
    reportar({
      fase,
      fotos: progresso.map((f) => ({ ...f })),
      backend: getBackend(),
      mensagem,
    })

  emitir("modelos")
  await initModels()

  emitir("fotos")

  const descritores: number[][] = []

  for (let i = 0; i < fotos.length; i++) {
    progresso[i].estado = "processando"
    emitir("fotos")

    try {
      const resultado = await extractDescriptorFromBase64(fotos[i])
      if (resultado) {
        descritores.push(resultado.descriptor)
        progresso[i] = {
          estado: "ok",
          confianca: Math.round(resultado.confidence * 10) / 10,
        }
      } else {
        progresso[i] = { estado: "falhou", erro: "nenhum rosto detectado" }
      }
    } catch (erro) {
      progresso[i] = {
        estado: "falhou",
        erro: erro instanceof Error ? erro.message : String(erro),
      }
    }

    emitir("fotos")
  }

  if (descritores.length === 0) {
    // Se todas falharam pelo mesmo motivo técnico, mostra esse motivo em vez
    // do texto genérico — "nenhum rosto" seria mentira se a GPU é que caiu.
    const errosTecnicos = progresso
      .map((f) => f.erro)
      .filter((e): e is string => !!e && e !== "nenhum rosto detectado")

    throw new Error(
      errosTecnicos.length > 0
        ? `Falha no reconhecimento facial: ${errosTecnicos[0]}`
        : "Nenhum rosto foi detectado nas fotos. Refaça a captura com o rosto centralizado, olhando para a câmera e com boa iluminação.",
    )
  }

  emitir("salvando")
  return descritores
}

/**
 * Lê a resposta da API tolerando corpo não-JSON (página de erro da Vercel,
 * timeout do gateway). O código antigo fazia response.json() direto, e o
 * SyntaxError do parse escondia o erro verdadeiro do usuário.
 */
export async function lerResposta(
  response: Response,
): Promise<{ success?: boolean; error?: string; [k: string]: unknown }> {
  const texto = await response.text()

  let corpo: { success?: boolean; error?: string } | null = null
  try {
    corpo = JSON.parse(texto)
  } catch {
    // corpo não é JSON — cai no erro genérico abaixo
  }

  if (!response.ok || !corpo?.success) {
    throw new Error(corpo?.error || `Falha na requisição (HTTP ${response.status})`)
  }

  return corpo
}
