"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Camera, UserRound } from "lucide-react"
import { CascaVitall } from "@/components/casca-vitall"
import type { PessoaManual } from "@/lib/ponto-manual"

/**
 * Batida manual, primeira metade: "quem vai bater o ponto?" e a foto.
 *
 * É o plano B para quando o reconhecimento facial não está funcionando. A
 * pessoa escolhe o próprio nome, uma foto é tirada e guardada, e a tela
 * entrega o resultado para a página seguir com a pergunta do tipo da batida
 * (Entrada, Saída Almoço...) e o registro de sempre.
 *
 * A foto é a prova — e a camada de segurança do atalho: escolher um nome é
 * trivial, então o que impede o abuso é a foto ficar guardada e ser comparada
 * depois com o cadastro (ver lib/ponto-manual.ts).
 *
 * Se a câmera é justamente o que falhou, dá para seguir sem foto: perder a
 * foto é melhor do que perder o ponto. A batida fica marcada "sem foto" para
 * revisão.
 */

export interface EscolhaManual {
  pessoa: PessoaManual
  foto: Blob | null
}

interface Props {
  pessoas: PessoaManual[]
  /** O vídeo da câmera que a página já mantém aberta. */
  videoRef: React.RefObject<HTMLVideoElement | null>
  onPronto: (escolha: EscolhaManual) => void
  onCancelar: () => void
}

const TEMPO_OCIOSO_S = 60
const CONTAGEM_S = 3
const LARGURA_FOTO = 640

/**
 * Tira o quadro atual do vídeo e devolve um JPEG. `null` se a câmera não deu
 * imagem utilizável (sem vídeo, ou imagem preta).
 *
 * Desenha o quadro CRU, sem espelhar e sem os filtros de beleza que a tela
 * aplica por CSS: a prova tem que mostrar o que a câmera viu.
 */
async function capturarFoto(video: HTMLVideoElement | null): Promise<Blob | null> {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null

  const escala = Math.min(1, LARGURA_FOTO / video.videoWidth)
  const w = Math.round(video.videoWidth * escala)
  const h = Math.round(video.videoHeight * escala)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, w, h)

  // Câmera congelada ou tapada entrega um quadro preto: não vale como prova.
  try {
    const amostra = ctx.getImageData(0, 0, w, h)
    let soma = 0
    let n = 0
    for (let i = 0; i < amostra.data.length; i += 4 * 97) {
      soma += (amostra.data[i] + amostra.data[i + 1] + amostra.data[i + 2]) / 3
      n++
    }
    if (n > 0 && soma / n < 6) return null
  } catch {
    /* sem getImageData: segue com o que tem */
  }

  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.75))
}

export function PontoManual({ pessoas, videoRef, onPronto, onCancelar }: Props) {
  const [etapa, setEtapa] = useState<"pessoa" | "foto">("pessoa")
  const [pessoa, setPessoa] = useState<PessoaManual | null>(null)
  const [contagem, setContagem] = useState<number | null>(null)
  const [falhouFoto, setFalhouFoto] = useState(false)
  const [ocioso, setOcioso] = useState(TEMPO_OCIOSO_S)
  const previaRef = useRef<HTMLVideoElement>(null)
  const emAndamento = useRef(false)

  // Inatividade: quem abriu sem querer não deixa a tela aberta para sempre.
  useEffect(() => {
    const id = window.setInterval(() => setOcioso((s) => s - 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    if (ocioso <= 0) onCancelar()
  }, [ocioso, onCancelar])
  const tocou = () => setOcioso(TEMPO_OCIOSO_S)

  // Prévia: o mesmo fluxo de câmera da página, num segundo <video>. Não para as
  // trilhas ao sair — a câmera é da página, não nossa.
  useEffect(() => {
    if (etapa !== "foto") return
    const origem = videoRef.current?.srcObject as MediaStream | null
    const previa = previaRef.current
    if (previa && origem) {
      previa.srcObject = origem
      void previa.play().catch(() => {})
    }
    return () => {
      if (previa) previa.srcObject = null
    }
  }, [etapa, videoRef])

  const escolherPessoa = (p: PessoaManual) => {
    tocou()
    setPessoa(p)
    setFalhouFoto(false)
    setEtapa("foto")
  }

  const concluir = useCallback(
    (foto: Blob | null) => {
      if (!pessoa) return
      onPronto({ pessoa, foto })
    },
    [pessoa, onPronto]
  )

  const tirarFoto = async () => {
    if (emAndamento.current) return
    emAndamento.current = true
    tocou()
    setFalhouFoto(false)
    for (let n = CONTAGEM_S; n >= 1; n--) {
      setContagem(n)
      await new Promise((r) => setTimeout(r, 1000))
    }
    setContagem(null)
    const foto = await capturarFoto(videoRef.current)
    emAndamento.current = false
    if (!foto) {
      setFalhouFoto(true)
      return
    }
    concluir(foto)
  }

  const primeiroNome = pessoa?.nome.split(" ")[0] ?? ""

  return (
    <CascaVitall
      ariaLabel="Bater ponto manualmente"
      restante={ocioso}
      rotuloSair="Fechar"
      onSair={onCancelar}
      onPointerDown={tocou}
    >
      {etapa === "pessoa" ? (
        <div className="w-full text-white">
          <div className="mb-6 space-y-1.5 text-center md:text-left">
            <h1 className="text-3xl font-bold tracking-tight drop-shadow-sm sm:text-4xl lg:text-5xl">
              Quem vai bater o <span style={{ color: "#c69e6b" }}>ponto</span>?
            </h1>
            <p className="text-sm font-medium text-white/80 sm:text-base">
              Toque no seu nome. Uma foto sua será guardada como confirmação.
            </p>
          </div>
          {pessoas.length === 0 ? (
            <p className="rounded-2xl border border-white/20 bg-white/[0.08] p-6 text-center text-lg backdrop-blur-2xl">
              A lista de funcionários ainda não foi carregada neste tablet. Conecte à internet uma vez e tente de novo.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {[...pessoas]
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => escolherPessoa(p)}
                    className="group flex h-44 cursor-pointer flex-col justify-between rounded-2xl border border-white/20 bg-white/[0.08] p-4 text-left shadow-lg backdrop-blur-2xl transition-all hover:scale-[1.03] hover:border-[#c69e6b]/60 hover:bg-white/[0.14] active:scale-95 sm:h-52 sm:p-5"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#c69e6b]/25 text-[#ecdcc3]">
                      <UserRound className="h-6 w-6" />
                    </span>
                    <span className="text-lg font-bold leading-tight tracking-tight transition-colors group-hover:text-[#ecdcc3] sm:text-xl">
                      {p.nome}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto w-full max-w-xl text-center text-white">
          <h1 className="text-3xl font-bold tracking-tight drop-shadow sm:text-4xl">Olá, <span style={{ color: "#c69e6b" }}>{primeiroNome}</span>!</h1>
          <p className="mt-1.5 text-lg text-[#ecdcc3]">Olhe para a câmera e toque em “Tirar foto”.</p>

          <div className="relative mx-auto mt-4 aspect-[4/3] w-full max-w-sm overflow-hidden rounded-3xl border border-white/30 bg-black/40">
            <video
              ref={previaRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {contagem !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <span className="text-8xl font-black text-white drop-shadow-lg">{contagem}</span>
              </div>
            )}
          </div>

          {falhouFoto && (
            <p role="alert" className="mt-3 rounded-2xl border border-[#c69e6b]/60 bg-[#c69e6b]/15 px-4 py-2 text-base text-[#f3e6d0]">
              A câmera não deu uma imagem. Tente de novo, ou continue sem foto (o ponto fica marcado para revisão).
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => {
                tocou()
                setEtapa("pessoa")
              }}
              disabled={contagem !== null}
              className="flex min-h-[60px] items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/5 px-5 text-lg font-semibold transition active:scale-[0.97] disabled:opacity-40"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </button>
            <button
              type="button"
              onClick={tirarFoto}
              disabled={contagem !== null}
              className="flex min-h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-xl font-bold text-[#2e1a0c] transition active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #d6b184 0%, #c69e6b 50%, #a67c4e 100%)" }}
            >
              <Camera className="h-6 w-6" />
              {contagem !== null ? "Fique parado…" : "Tirar foto"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => concluir(null)}
            disabled={contagem !== null}
            className="mt-4 text-base text-white/70 underline underline-offset-4 transition active:scale-95 disabled:opacity-40"
          >
            Continuar sem foto
          </button>
        </div>
      )}
    </CascaVitall>
  )
}
