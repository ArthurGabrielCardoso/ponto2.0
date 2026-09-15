import crypto from "crypto"

/**
 * Token de acesso ao espelho de ponto.
 *
 * O QR na tela de sucesso precisa levar a pessoa ao SEU espelho e a mais nenhum.
 * Mandar o id do funcionário em texto puro na URL resolveria em cinco minutos e
 * criaria um vazamento: qualquer um que fotografasse a tela — ou que trocasse um
 * dígito na URL — leria as horas de outra pessoa.
 *
 * Então o token é assinado com HMAC e tem validade curta. Não precisa de tabela
 * nova no banco nem de sessão: a própria assinatura prova quem é, e o prazo
 * limita o estrago de um QR fotografado.
 *
 * Módulo de servidor — o segredo nunca vai para o navegador.
 */

/**
 * Oito horas — um turno.
 *
 * Começou em 10 minutos, pensando só em limitar o estrago de um QR fotografado.
 * Mas o uso principal é o contador de almoço: a pessoa lê o QR ao sair, sobe
 * para comer e volta a olhar 40 minutos depois. Com 10 minutos o link morria no
 * meio do almoço, que é justamente quando ela precisa dele.
 *
 * O que se ganha em conveniência se paga em janela de exposição: quem
 * fotografar a tela no instante da batida consegue ver as horas daquela pessoa
 * até o fim do turno. Para um time pequeno onde só colegas estão perto do
 * tablet, é uma troca aceitável — mas é uma troca, e está aqui escrita.
 */
const VALIDADE_PADRAO_MS = 8 * 60 * 60 * 1000

export interface DadosEspelho {
  funcionarioId: string
  nome: string
  /** Expiração, em ms desde a época. */
  exp: number
}

function obterSegredo(): string | null {
  const segredo = process.env.ESPELHO_SECRET
  // Sem segredo configurado o recurso fica desligado, e não improvisamos com a
  // chave anônima do Supabase: ela é pública por definição e assinar com ela
  // seria o mesmo que não assinar.
  if (!segredo || segredo.length < 16) return null
  return segredo
}

export function espelhoEstaConfigurado(): boolean {
  return obterSegredo() !== null
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function deBase64url(txt: string): Buffer {
  const pad = txt.length % 4 === 0 ? "" : "=".repeat(4 - (txt.length % 4))
  return Buffer.from(txt.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64")
}

function assinar(corpo: string, segredo: string): string {
  return base64url(crypto.createHmac("sha256", segredo).update(corpo).digest())
}

/** Gera o token que vai dentro do QR. Devolve null se o recurso não está configurado. */
export function gerarTokenEspelho(
  funcionarioId: string,
  nome: string,
  validadeMs: number = VALIDADE_PADRAO_MS
): string | null {
  const segredo = obterSegredo()
  if (!segredo) return null

  const dados: DadosEspelho = {
    funcionarioId,
    nome,
    exp: Date.now() + validadeMs,
  }
  const corpo = base64url(Buffer.from(JSON.stringify(dados), "utf8"))
  return `${corpo}.${assinar(corpo, segredo)}`
}

/**
 * Valida o token. Devolve null para token adulterado, mal formado ou vencido —
 * a página do espelho trata os três casos da mesma forma, de propósito: dizer
 * qual foi o problema ajudaria quem está tentando adivinhar.
 */
export function validarTokenEspelho(token: string): DadosEspelho | null {
  const segredo = obterSegredo()
  if (!segredo || !token) return null

  const partes = token.split(".")
  if (partes.length !== 2) return null

  const [corpo, assinatura] = partes
  const esperada = assinar(corpo, segredo)

  // Comparação em tempo constante: comparar strings com === vaza, pelo tempo de
  // resposta, quantos caracteres iniciais o atacante acertou.
  const a = Buffer.from(assinatura)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const dados = JSON.parse(deBase64url(corpo).toString("utf8")) as DadosEspelho
    if (!dados?.funcionarioId || typeof dados.exp !== "number") return null
    if (Date.now() > dados.exp) return null
    return dados
  } catch {
    return null
  }
}
