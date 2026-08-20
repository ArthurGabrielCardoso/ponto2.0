"use client"

import {
  extractDescriptorFromBase64,
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

/**
 * Extrai o descritor de cada foto, reportando progresso real via `onLog`.
 *
 * Fotos sem rosto são puladas com aviso no log, não abortam o lote — numa
 * captura de 5 poses é comum uma sair borrada. Só lança se nenhuma prestar.
 */
export async function extrairDescritores(
  fotos: string[],
  onLog: (logs: string[]) => void,
): Promise<number[][]> {
  const logs: string[] = ["🧠 Carregando modelos de reconhecimento facial..."]
  onLog([...logs])

  await initModels()

  logs.push("✅ Modelos carregados com sucesso!")
  onLog([...logs])

  const descritores: number[][] = []

  for (let i = 0; i < fotos.length; i++) {
    logs.push(`📸 Processando foto ${i + 1}/${fotos.length}...`)
    onLog([...logs])

    try {
      const resultado = await extractDescriptorFromBase64(fotos[i])
      if (resultado) {
        descritores.push(resultado.descriptor)
        const confianca = Math.round(resultado.confidence * 10) / 10
        logs.push(`✅ Foto ${i + 1} processada! Confiança: ${confianca}%`)
      } else {
        logs.push(`❌ Foto ${i + 1}: nenhum rosto detectado`)
      }
    } catch (erro) {
      logs.push(
        `❌ Foto ${i + 1}: ${erro instanceof Error ? erro.message : String(erro)}`,
      )
    }
    onLog([...logs])
  }

  if (descritores.length === 0) {
    throw new Error(
      "Nenhum rosto foi detectado nas fotos. Refaça a captura com o rosto centralizado, olhando para a câmera e com boa iluminação.",
    )
  }

  logs.push(`📊 ${descritores.length}/${fotos.length} foto(s) aproveitada(s)`)
  onLog([...logs])

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
