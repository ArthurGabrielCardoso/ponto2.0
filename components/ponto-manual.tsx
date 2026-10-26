"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Camera, Delete, Lock, UserRound, X } from "lucide-react"
import type { PessoaManual, PinSituacao } from "@/lib/ponto-manual"
import {
  PIN_MAX,
  bloqueioRestanteMs,
  conferirPin,
  hashDisponivel,
  pessoaTemPin,
  tamanhoDoPin,
} from "@/lib/pin-manual"

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
  pinSituacao: PinSituacao
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
  const [etapa, setEtapa] = useState<"pessoa" | "pin" | "foto">("pessoa")
  const [pin, setPin] = useState("")
  const [erroPin, setErroPin] = useState<string | null>(null)
  const [conferindo, setConferindo] = useState(false)
  const [pinSituacao, setPinSituacao] = useState<PinSituacao>("validado")
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

  const textoBloqueio = (ms: number) => {
    const min = Math.ceil(ms / 60000)
    return `Muitas tentativas erradas. Tente de novo em ${min} ${min === 1 ? "minuto" : "minutos"}.`
  }

  const escolherPessoa = (p: PessoaManual) => {
    tocou()
    setPessoa(p)
    setFalhouFoto(false)
    setPin("")
    setErroPin(null)
    if (!hashDisponivel()) {
      // Sem HTTPS o navegador não calcula o hash: libera, mas fica marcado.
      setPinSituacao("indisponivel")
      setEtapa("foto")
    } else if (pessoaTemPin(p.id)) {
      // Já travada (ou travada antes de recarregar a página): avisa de cara,
      // em vez de deixar a pessoa digitar para o nada.
      const travada = bloqueioRestanteMs(p.id)
      if (travada > 0) setErroPin(textoBloqueio(travada))
      setEtapa("pin")
    } else {
      // Sem PIN cadastrado ainda: libera (senão ninguém bate durante a
      // implantação), mas a batida fica marcada para revisão.
      setPinSituacao("pessoa_sem_pin")
      setEtapa("foto")
    }
  }

  /** Confere o PIN quando completa o tamanho cadastrado (ou ao tocar em OK). */
  const confirmarPin = async (digitado: string) => {
    if (!pessoa || conferindo || digitado.length === 0) return
    setConferindo(true)
    try {
      const r = await conferirPin(pessoa.id, digitado)
      if (r.ok) {
        setPinSituacao("validado")
        setPin("")
        setErroPin(null)
        setEtapa("foto")
        return
      }
      setPin("")
      setErroPin(
        r.bloqueadoMs > 0
          ? textoBloqueio(r.bloqueadoMs)
          : `PIN incorreto. ${r.restantes === 1 ? "Resta 1 tentativa" : `Restam ${r.restantes} tentativas`}.`
      )
    } finally {
      setConferindo(false)
    }
  }

  const digitar = (d: string) => {
    tocou()
    if (conferindo || !pessoa) return
    const travada = bloqueioRestanteMs(pessoa.id)
    if (travada > 0) {
      setErroPin(textoBloqueio(travada))
      return
    }
    setErroPin(null)
    const novo = (pin + d).slice(0, PIN_MAX)
    setPin(novo)
    if (novo.length === tamanhoDoPin(pessoa.id)) void confirmarPin(novo)
  }

  const concluir = useCallback(
    (foto: Blob | null) => {
      if (!pessoa) return
      onPronto({ pessoa, foto, pinSituacao })
    },
    [pessoa, onPronto, pinSituacao]
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
    <div
      className="fixed inset-0 z-[56] flex items-center justify-center overflow-y-auto p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Bater ponto manualmente"
      onPointerDown={tocou}
      style={{
        background:
          "linear-gradient(135deg, rgba(10, 70, 72, 0.94) 0%, rgba(13, 100, 104, 0.95) 50%, rgba(8, 60, 66, 0.97) 100%)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <button
        type="button"
        onClick={onCancelar}
        aria-label="Fechar"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition active:scale-95"
      >
        <X className="h-5 w-5" />
      </button>

      {etapa === "pessoa" ? (
        <div className="w-full max-w-3xl text-white">
          <div className="mb-5 text-center">
            <h1 className="text-3xl font-bold tracking-tight drop-shadow sm:text-4xl">Quem vai bater o ponto?</h1>
            <p className="mt-1.5 text-base text-amber-100/90 sm:text-lg">
              Toque no seu nome. Uma foto sua será guardada como confirmação.
            </p>
          </div>
          {pessoas.length === 0 ? (
            <p className="rounded-2xl border border-white/25 bg-white/10 p-6 text-center text-lg">
              A lista de funcionários ainda não foi carregada neste tablet. Conecte à internet uma vez e tente de novo.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[...pessoas]
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => escolherPessoa(p)}
                    className="flex min-h-[84px] items-center gap-4 rounded-3xl border border-white/25 bg-white/10 px-5 text-left transition active:scale-[0.98]"
                    style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
                      <UserRound className="h-6 w-6" />
                    </span>
                    <span className="text-xl font-bold leading-tight sm:text-2xl">{p.nome}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : etapa === "pin" ? (
        <div className="w-full max-w-sm text-center text-white">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight drop-shadow">Olá, {primeiroNome}!</h1>
          <p className="mt-1 text-lg text-amber-100/90">Digite o seu PIN</p>

          <div className="mt-5 flex justify-center gap-3" aria-label="PIN digitado">
            {Array.from({ length: tamanhoDoPin(pessoa?.id ?? "") || 4 }).map((_, i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full border-2 border-white/70 transition ${i < pin.length ? "bg-white" : "bg-transparent"}`}
              />
            ))}
          </div>
          <p role="alert" className={`mt-3 min-h-[44px] text-base ${erroPin ? "text-amber-200" : "text-transparent"}`}>
            {erroPin ?? "."}
          </p>

          <div className="mx-auto mt-2 grid max-w-[280px] grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => digitar(d)}
                className="min-h-[68px] rounded-2xl border border-white/25 bg-white/10 text-3xl font-bold transition active:scale-95 active:bg-white/25"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                tocou()
                setPin((p) => p.slice(0, -1))
                setErroPin(null)
              }}
              aria-label="Apagar"
              className="flex min-h-[68px] items-center justify-center rounded-2xl border border-white/25 bg-white/5 transition active:scale-95"
            >
              <Delete className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={() => digitar("0")}
              className="min-h-[68px] rounded-2xl border border-white/25 bg-white/10 text-3xl font-bold transition active:scale-95 active:bg-white/25"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => void confirmarPin(pin)}
              disabled={pin.length < 4 || conferindo}
              className="min-h-[68px] rounded-2xl text-xl font-bold text-amber-950 transition active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)" }}
            >
              OK
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              tocou()
              setEtapa("pessoa")
            }}
            className="mt-5 flex items-center justify-center gap-2 text-base text-white/70 underline underline-offset-4 mx-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Não sou {primeiroNome}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xl text-center text-white">
          <h1 className="text-3xl font-bold tracking-tight drop-shadow sm:text-4xl">Olá, {primeiroNome}!</h1>
          <p className="mt-1.5 text-lg text-amber-100/90">Olhe para a câmera e toque em “Tirar foto”.</p>
          {pinSituacao === "pessoa_sem_pin" && (
            <p className="mx-auto mt-2 max-w-md rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-sm text-amber-100">
              Você ainda não tem PIN. Peça ao responsável para cadastrar um.
            </p>
          )}

          <div className="relative mx-auto mt-5 aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/30 bg-black/40">
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
            <p role="alert" className="mt-3 rounded-2xl border border-amber-300/50 bg-amber-300/15 px-4 py-2 text-base text-amber-100">
              A câmera não deu uma imagem. Tente de novo, ou continue sem foto (o ponto fica marcado para revisão).
            </p>
          )}

          <div className="mt-5 flex gap-3">
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
              className="flex min-h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-xl font-bold text-amber-950 transition active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)" }}
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
    </div>
  )
}
