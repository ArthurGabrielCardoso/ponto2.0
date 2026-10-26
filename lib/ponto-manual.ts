"use client"

import { supabase } from "@/lib/supabase"
import { logar } from "@/lib/log-tablet"
import { extractDescriptorFromBase64, getFuncionariosCarregados } from "@/lib/face-recognition-client"

/**
 * Batida manual: a pessoa escolhe o próprio nome quando o reconhecimento facial
 * não funciona, e uma foto fica guardada como prova.
 *
 * O PONTO em si não passa por aqui. Ele segue o caminho de sempre — fila
 * persistente de `lib/fila-pontos.ts`, depois `registros_ponto`. Este módulo
 * cuida só da EVIDÊNCIA, e de propósito é independente: se a tabela
 * `pontos_manuais`, o bucket ou a verificação do rosto falharem, a batida já
 * foi registrada. Perder a prova é ruim; perder o ponto seria pior.
 *
 * Duas camadas de armazenamento no tablet, cada uma pelo que faz bem:
 *
 *  - o MANIFESTO (quem, que tipo, quando) vai para o localStorage, que grava de
 *    forma síncrona. Mesmo que o tablet seja desligado no instante seguinte, o
 *    fato "houve uma batida manual" não se perde;
 *  - a FOTO (dezenas de KB) vai para o IndexedDB, que aguenta volume. Se ela
 *    não chegar a ser gravada, o manifesto sobrevive e a linha sobe como
 *    `sem_foto`, para revisão.
 *
 * Depois, em segundo plano, cada item: sobe a foto, compara o rosto com o
 * cadastro e grava a situação. Cada etapa é repetível e idempotente (o id do
 * item é o id da linha no banco), então queda de rede no meio não duplica nada.
 */

const BUCKET = "fotos-ponto-manual"
const TABELA = "pontos_manuais"
const CHAVE_FILA = "vitall_ponto_manual_fila"
const CHAVE_LISTA = "vitall_lista_manual"
const CHAVE_LIMPEZA = "vitall_ponto_manual_limpeza"
const IDB_NOME = "vitall-ponto-manual"
const IDB_STORE = "fotos"

/** Mesmo corte do reconhecimento (face-worker.ts). */
const LIMIAR_DISTANCIA = 0.6
const RETENCAO_DIAS = 90
/** Passou disso sem conseguir comparar o rosto, vira `nao_verificado`. */
const DESISTE_DE_VERIFICAR_MS = 7 * 24 * 3600 * 1000
const MAX_FILA = 60

export type SituacaoManual =
  | "pendente"
  | "confirmado"
  | "divergente"
  | "sem_rosto"
  | "sem_foto"
  | "nao_verificado"

/**
 * O que o PIN disse sobre a pessoa. Um PIN errado não chega aqui: a tela barra
 * antes e nenhuma batida é gerada.
 */
export type PinSituacao = "validado" | "pessoa_sem_pin" | "indisponivel"

interface ItemManual {
  /** Também é o id da linha em `pontos_manuais`: reenviar não duplica. */
  id: string
  funcionarioId: string
  nome: string
  tipo: string
  /** O MESMO instante gravado em registros_ponto. É a chave que liga as duas. */
  dataHoraIso: string
  temFoto: boolean
  fotoPath?: string
  pinSituacao: PinSituacao
  situacao: SituacaoManual
  detalhe?: Record<string, unknown>
  /** Última situação que o banco confirmou ter recebido. */
  situacaoGravada?: SituacaoManual
  criadoEmMs: number
}

// ---------------------------------------------------------------------------
// Lista de funcionários para escolher offline
// ---------------------------------------------------------------------------

export interface PessoaManual {
  id: string
  nome: string
}

/**
 * Guarda só id e nome. O cache de funcionários que já existe leva junto os
 * descritores faciais; para a tela de escolha basta o nome, e quanto menos
 * dado sensível espalhado, melhor.
 */
export function salvarListaManual(funcionarios: { id: string; nome: string }[]) {
  try {
    if (!funcionarios.length) return
    localStorage.setItem(
      CHAVE_LISTA,
      JSON.stringify(funcionarios.map((f) => ({ id: f.id, nome: f.nome })))
    )
  } catch {
    /* sem localStorage: a lista só existe enquanto o app tem os funcionários em memória */
  }
}

export function listarPessoasManual(): PessoaManual[] {
  try {
    const bruto = localStorage.getItem(CHAVE_LISTA)
    const lista = bruto ? JSON.parse(bruto) : []
    return Array.isArray(lista) ? (lista as PessoaManual[]) : []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Armazenamento local
// ---------------------------------------------------------------------------

function lerFila(): ItemManual[] {
  try {
    const bruto = localStorage.getItem(CHAVE_FILA)
    const lista = bruto ? JSON.parse(bruto) : []
    return Array.isArray(lista) ? (lista as ItemManual[]) : []
  } catch {
    return []
  }
}

function escreverFila(lista: ItemManual[]) {
  try {
    localStorage.setItem(CHAVE_FILA, JSON.stringify(lista.slice(-MAX_FILA)))
  } catch (e) {
    logar("erro", "manual_fila_nao_persistiu", (e as Error)?.message)
  }
}

function atualizarItem(id: string, mudancas: Partial<ItemManual>) {
  escreverFila(lerFila().map((i) => (i.id === id ? { ...i, ...mudancas } : i)))
}

function abrirIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NOME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrirIdb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, modo)
      const req = fn(tx.objectStore(IDB_STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

const guardarFoto = (id: string, blob: Blob) => idb("readwrite", (s) => s.put(blob, id))
const lerFoto = (id: string) => idb<Blob | undefined>("readonly", (s) => s.get(id))
const apagarFoto = (id: string) => idb("readwrite", (s) => s.delete(id))

// ---------------------------------------------------------------------------
// Entrada: registrar uma batida manual
// ---------------------------------------------------------------------------

export interface DadosManual {
  funcionarioId: string
  nome: string
  tipo: string
  /** O mesmo `toISOString()` que vai para registros_ponto. */
  dataHoraIso: string
  foto: Blob | null
  pinSituacao: PinSituacao
}

/**
 * Coloca a evidência na fila. Nunca lança.
 *
 * O manifesto entra de forma síncrona; a foto, logo depois. Quem chama não
 * precisa esperar a foto: `void enfileirarManual(...)`.
 */
export async function enfileirarManual(dados: DadosManual): Promise<string> {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`

  const temFoto = !!dados.foto
  const item: ItemManual = {
    id,
    funcionarioId: dados.funcionarioId,
    nome: dados.nome,
    tipo: dados.tipo,
    dataHoraIso: dados.dataHoraIso,
    pinSituacao: dados.pinSituacao,
    temFoto,
    // Sem foto, já nasce na situação final: não há o que comparar.
    situacao: temFoto ? "pendente" : "sem_foto",
    criadoEmMs: Date.now(),
  }
  escreverFila([...lerFila(), item])
  logar("info", "manual_enfileirado", null, { tipo_foto: temFoto ? "com_foto" : "sem_foto", funcionario_id: dados.funcionarioId })

  if (dados.foto) {
    try {
      await guardarFoto(id, dados.foto)
    } catch (e) {
      // O manifesto está salvo; a linha vai subir como sem_foto.
      atualizarItem(id, { temFoto: false, situacao: "sem_foto", detalhe: { motivo: "foto_nao_gravada" } })
      logar("erro", "manual_foto_nao_gravada", (e as Error)?.message)
    }
  }
  return id
}

// ---------------------------------------------------------------------------
// Verificação do rosto
// ---------------------------------------------------------------------------

function distancia(a: number[], b: number[]): number {
  let soma = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i]
    soma += d * d
  }
  return Math.sqrt(soma)
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/**
 * Compara o rosto da foto com o cadastro.
 *
 * `confirmado` exige duas coisas: a pessoa que disse ser está dentro do limiar
 * E nenhuma outra pessoa cadastrada parece mais com a foto. A segunda existe
 * por causa do caso que importa — alguém batendo no lugar de outra pessoa pode
 * ficar dentro do limiar do alvo e, mesmo assim, parecer mais com ele mesmo.
 *
 * Devolve `null` quando não deu para comparar agora (reconhecimento fora do ar):
 * o item fica `pendente` e tenta de novo depois.
 */
async function verificarFoto(
  item: ItemManual,
  blob: Blob
): Promise<{ situacao: SituacaoManual; detalhe: Record<string, unknown> } | null> {
  let extraido
  try {
    extraido = await extractDescriptorFromBase64(await blobParaDataUrl(blob))
  } catch (e) {
    logar("aviso", "manual_verificacao_adiada", (e as Error)?.message)
    return null
  }

  if (!extraido) return { situacao: "sem_rosto", detalhe: { motivo: "nenhum_rosto_na_foto" } }

  const todos = getFuncionariosCarregados()
  const melhorDe = (descritores: number[][] | undefined) =>
    (descritores || []).reduce((m, d) => Math.min(m, distancia(extraido.descriptor, d)), Infinity)

  const alvo = todos.find((f) => f.id === item.funcionarioId)
  const propria = alvo ? melhorDe(alvo.descritores) : Infinity
  if (!alvo || !Number.isFinite(propria)) {
    // Sem rosto cadastrado para comparar. Não é culpa da foto nem da pessoa.
    return { situacao: "nao_verificado", detalhe: { motivo: "funcionario_sem_rosto_cadastrado" } }
  }

  let outroId: string | null = null
  let outraDist = Infinity
  for (const f of todos) {
    if (f.id === item.funcionarioId) continue
    const d = melhorDe(f.descritores)
    if (d < outraDist) {
      outraDist = d
      outroId = f.id
    }
  }

  const arred = (n: number) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null)
  const detalhe: Record<string, unknown> = {
    distancia_propria: arred(propria),
    limiar: LIMIAR_DISTANCIA,
    qualidade_rosto: Math.round(extraido.confidence),
  }
  if (outroId) {
    detalhe.mais_parecido_outro_id = outroId
    detalhe.mais_parecido_outro_distancia = arred(outraDist)
  }

  const ehEle = propria <= LIMIAR_DISTANCIA && propria <= outraDist
  return { situacao: ehEle ? "confirmado" : "divergente", detalhe }
}

// ---------------------------------------------------------------------------
// Processamento em segundo plano
// ---------------------------------------------------------------------------

let processando = false

const jaExiste = (erro: { message?: string; statusCode?: string | number; error?: string } | null) =>
  !!erro && (/already exists|duplicate/i.test(erro.message || "") || String(erro.statusCode) === "409")

async function subirFoto(item: ItemManual, blob: Blob): Promise<string | null> {
  if (!supabase) return null
  const dia = item.dataHoraIso.slice(0, 10)
  const caminho = `${item.funcionarioId}/${dia}/${item.id}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, blob, {
    contentType: "image/jpeg",
    upsert: false,
  })
  // Um envio anterior pode ter chegado e a resposta se perdido na volta.
  if (error && !jaExiste(error as never)) {
    logar("aviso", "manual_upload_falhou", (error as Error).message, { caminho })
    return null
  }
  return caminho
}

async function gravarLinha(item: ItemManual): Promise<boolean> {
  if (!supabase) return false
  const final = item.situacao !== "pendente"
  const { error } = await supabase.from(TABELA).upsert(
    {
      id: item.id,
      funcionario_id: item.funcionarioId,
      nome_funcionario: item.nome,
      tipo: item.tipo,
      data_hora: item.dataHoraIso,
      foto_path: item.fotoPath ?? null,
      situacao: item.situacao,
      pin_situacao: item.pinSituacao ?? null,
      detalhe: item.detalhe ?? null,
      verificado_em: final ? new Date().toISOString() : null,
      dispositivo: (navigator.userAgent || "").slice(0, 200),
    } as never,
    { onConflict: "id" }
  )
  if (error) {
    logar("aviso", "manual_linha_nao_gravada", (error as Error).message, { situacao: item.situacao })
    return false
  }
  return true
}

/**
 * Tenta levar cada item até o fim: foto no bucket, rosto comparado, situação
 * gravada. Seguro para chamar a qualquer momento — chamadas concorrentes são
 * ignoradas.
 *
 * `podeVerificar`: a comparação do rosto usa o mesmo worker do reconhecimento,
 * então só roda quando ele está livre (tela de espera, sem ninguém batendo).
 * Subir a foto e gravar a linha não dependem disso e acontecem sempre.
 */
export async function processarFilaManual(opts: { podeVerificar: () => boolean }): Promise<void> {
  if (processando || !supabase) return
  if (typeof navigator !== "undefined" && navigator.onLine === false) return
  if (lerFila().length === 0) return

  processando = true
  try {
    for (const original of lerFila()) {
      let item = original
      try {
        // 1. Foto no bucket.
        let blob: Blob | undefined
        if (item.temFoto) {
          blob = await lerFoto(item.id).catch(() => undefined)
          if (!blob && !item.fotoPath) {
            // O manifesto sobreviveu e a foto não: sobe como sem_foto.
            item = { ...item, temFoto: false, situacao: "sem_foto", detalhe: { motivo: "foto_perdida" } }
            atualizarItem(item.id, item)
          }
        }
        if (item.temFoto && blob && !item.fotoPath) {
          const caminho = await subirFoto(item, blob)
          if (caminho) {
            item = { ...item, fotoPath: caminho }
            atualizarItem(item.id, { fotoPath: caminho })
          }
        }

        // 2. Rosto da foto contra o cadastro.
        if (item.temFoto && blob && item.situacao === "pendente" && opts.podeVerificar()) {
          const r = await verificarFoto(item, blob)
          if (r) {
            item = { ...item, situacao: r.situacao, detalhe: r.detalhe }
            atualizarItem(item.id, { situacao: r.situacao, detalhe: r.detalhe })
            logar(r.situacao === "confirmado" ? "info" : "aviso", "manual_verificada", r.situacao, {
              funcionario_id: item.funcionarioId,
              ...r.detalhe,
            })
          }
        }

        // 3. Muito tempo sem conseguir comparar: encerra como não verificado.
        if (item.situacao === "pendente" && Date.now() - item.criadoEmMs > DESISTE_DE_VERIFICAR_MS) {
          item = { ...item, situacao: "nao_verificado", detalhe: { motivo: "sem_resposta_em_7_dias" } }
          atualizarItem(item.id, { situacao: "nao_verificado", detalhe: item.detalhe })
        }

        // 4. A situação no banco. A foto precisa estar lá primeiro, senão a
        // linha apontaria para um arquivo que não existe.
        const fotoPronta = !item.temFoto || !!item.fotoPath
        if (fotoPronta && item.situacaoGravada !== item.situacao) {
          if (await gravarLinha(item)) {
            item = { ...item, situacaoGravada: item.situacao }
            atualizarItem(item.id, { situacaoGravada: item.situacao })
          }
        }

        // 5. Terminou: situação final no banco e foto já enviada.
        if (item.situacao !== "pendente" && item.situacaoGravada === item.situacao && fotoPronta) {
          escreverFila(lerFila().filter((i) => i.id !== item.id))
          await apagarFoto(item.id).catch(() => {})
        }
      } catch (e) {
        logar("aviso", "manual_item_falhou", (e as Error)?.message, { id: item.id })
      }
    }
  } finally {
    processando = false
  }
}

export function contarManuaisPendentes(): number {
  return lerFila().length
}

/**
 * Retenção: apaga do bucket as fotos com mais de 90 dias, no máximo uma vez
 * por dia. O tablet só consegue apagar o que já venceu (policy no SQL) e não
 * lê o bucket — por isso parte da tabela, que ele sabe consultar.
 */
export async function limparFotosAntigas(): Promise<void> {
  try {
    if (!supabase || navigator.onLine === false) return
    const hoje = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(CHAVE_LIMPEZA) === hoje) return

    const corte = new Date(Date.now() - RETENCAO_DIAS * 86400_000).toISOString()
    const { data, error } = await supabase
      .from(TABELA)
      .select("id, foto_path")
      .lt("criado_em", corte)
      .not("foto_path", "is", null)
      .limit(50)
    if (error) return // tabela ainda não existe, ou sem rede: tenta amanhã

    const linhas = (data || []) as unknown as { id: string; foto_path: string }[]
    if (linhas.length > 0) {
      const { error: errRemove } = await supabase.storage.from(BUCKET).remove(linhas.map((l) => l.foto_path))
      if (errRemove) {
        logar("aviso", "manual_retencao_falhou", (errRemove as Error).message)
        return
      }
      await supabase
        .from(TABELA)
        .update({ foto_path: null } as never)
        .in("id", linhas.map((l) => l.id))
      logar("info", "manual_fotos_vencidas_apagadas", null, { quantidade: linhas.length })
    }
    // Só marca o dia como feito quando não sobrou lote: se havia 50, volta amanhã com o resto.
    if (linhas.length < 50) localStorage.setItem(CHAVE_LIMPEZA, hoje)
  } catch {
    /* retenção nunca atrapalha nada */
  }
}
