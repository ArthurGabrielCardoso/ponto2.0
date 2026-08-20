/**
 * Validação de descritores faciais recebidos do navegador.
 *
 * Desde a migração do reconhecimento para o browser, as rotas de cadastro
 * recebem vetores 128D em vez de imagens. O servidor não roda mais face-api.js
 * (dependia de `canvas`, módulo nativo que não carrega no serverless da Vercel),
 * então estes vetores chegam sem nenhuma validação prévia do lado do servidor:
 * precisam ser conferidos antes de ir para o banco.
 *
 * Um descritor corrompido gravado no Supabase não dá erro na hora — ele degrada
 * silenciosamente o reconhecimento daquele funcionário para sempre.
 */

export const TAMANHO_DESCRITOR = 128

export type ResultadoValidacao =
  | { ok: true; descritores: number[][] }
  | { ok: false; status: 400 | 422; erro: string }

/**
 * Confere que `valor` é uma lista não-vazia de vetores 128D de números finitos.
 *
 * Distingue os dois modos de falha que o chamador precisa separar:
 *  - 422: lista bem formada, porém vazia — o navegador rodou a detecção e não
 *    achou rosto em nenhuma foto. A requisição está certa; o conteúdo é que
 *    não dá para processar.
 *  - 400: a lista não é uma lista, ou algum vetor tem forma errada — quem
 *    chamou montou o payload errado.
 */
export function validarDescritores(valor: unknown): ResultadoValidacao {
  if (!Array.isArray(valor)) {
    return {
      ok: false,
      status: 400,
      erro: "O campo 'descritores' é obrigatório e deve ser uma lista de vetores 128D.",
    }
  }

  if (valor.length === 0) {
    return {
      ok: false,
      status: 422,
      erro:
        "Nenhum rosto foi detectado nas fotos. Refaça a captura com o rosto centralizado, " +
        "olhando para a câmera e com boa iluminação.",
    }
  }

  const descritores: number[][] = []

  for (let i = 0; i < valor.length; i++) {
    const d = valor[i]

    if (!Array.isArray(d) || d.length !== TAMANHO_DESCRITOR) {
      const tamanho = Array.isArray(d) ? `${d.length}` : typeof d
      return {
        ok: false,
        status: 400,
        erro: `Descritor ${i + 1} inválido: esperado um vetor de ${TAMANHO_DESCRITOR} números, recebido ${tamanho}.`,
      }
    }

    if (!d.every((n) => typeof n === "number" && Number.isFinite(n))) {
      return {
        ok: false,
        status: 400,
        erro: `Descritor ${i + 1} inválido: contém valores que não são números finitos.`,
      }
    }

    descritores.push(d as number[])
  }

  return { ok: true, descritores }
}

/**
 * Detecta cliente com bundle antigo em cache, que ainda manda `fotos` para o
 * servidor processar. Sem isso o usuário veria só "descritores é obrigatório",
 * sem pista de que o problema é a página velha.
 */
export function usandoContratoAntigo(body: {
  descritores?: unknown
  fotos?: unknown
}): boolean {
  return body.descritores === undefined && Array.isArray(body.fotos)
}

export const ERRO_CONTRATO_ANTIGO =
  "Esta rota não processa mais imagens — o descritor facial passou a ser extraído no navegador. " +
  "Sua página está numa versão antiga: recarregue com Ctrl+Shift+R (ou Cmd+Shift+R) e refaça o cadastro."
