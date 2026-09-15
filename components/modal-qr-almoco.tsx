"use client"

import React, { useEffect, useState } from "react"
import QRCode from "qrcode"
import { OlhosRobo } from "@/components/olhos-robo"

export interface InfoAlmocoModal {
  funcionarioId: string
  primeiroNome: string
  nomeCompleto?: string
  horaSaida: string
  horaRetornoPrevista: string
  retornoPrevistoMs: number
}

interface ModalQRAlmocoProps {
  funcionario: InfoAlmocoModal
  pessoaNaCamera: { id: string; nome: string } | null
  onClose: () => void
}

export function ModalQRAlmoco({
  funcionario,
  pessoaNaCamera,
  onClose,
}: ModalQRAlmocoProps) {
  const [segundos, setSegundos] = useState(45)
  const [status, setStatus] = useState<"checando" | "sucesso" | "outro">("checando")
  const [nomeOutro, setNomeOutro] = useState("")
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [tempoRestanteStr, setTempoRestanteStr] = useState("")
  const [passouDoTempo, setPassouDoTempo] = useState(false)

  // 1. Contador regressivo de 45 segundos para fechamento automático
  useEffect(() => {
    const timer = setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) {
          clearInterval(timer)
          onClose()
          return 0
        }
        return s - 1
      });
    }, 1000)
    return () => clearInterval(timer)
  }, [onClose])

  // 2. Cálculo do tempo restante de almoço ao vivo
  useEffect(() => {
    const calcular = () => {
      const agora = Date.now()
      const diffMs = funcionario.retornoPrevistoMs - agora
      const totalSeg = Math.floor(Math.abs(diffMs) / 1000)
      const horas = Math.floor(totalSeg / 3600)
      const min = Math.floor((totalSeg % 3600) / 60)
      const seg = totalSeg % 60

      const formatado =
        horas > 0
          ? `${horas}h ${String(min).padStart(2, "0")}m ${String(seg).padStart(2, "0")}s`
          : `${String(min).padStart(2, "0")}m ${String(seg).padStart(2, "0")}s`

      if (diffMs >= 0) {
        setPassouDoTempo(false)
        setTempoRestanteStr(formatado)
      } else {
        setPassouDoTempo(true)
        setTempoRestanteStr(`+${formatado}`)
      }
    }

    calcular()
    const timer = setInterval(calcular, 1000)
    return () => clearInterval(timer)
  }, [funcionario.retornoPrevistoMs])

  // 3. Obtenção do token assinado e renderização do QR Code
  useEffect(() => {
    let cancelado = false

    const carregarToken = async () => {
      try {
        const res = await fetch("/api/espelho-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            funcionarioId: funcionario.funcionarioId,
            nome: funcionario.nomeCompleto || funcionario.primeiroNome,
          }),
        })

        if (!res.ok) return
        const dados = await res.json()
        if (cancelado || !dados?.configurado || !dados?.token) return

        const url = `${window.location.origin}/meu-ponto/${dados.token}`
        const png = await QRCode.toDataURL(url, {
          margin: 1,
          width: 320,
          color: { dark: "#090d16", light: "#ffffff" },
        })

        if (!cancelado) setQrCodeDataUrl(png)
      } catch {
        /* silencioso */
      }
    }

    void carregarToken()
    return () => {
      cancelado = true
    }
  }, [funcionario])

  // 4. Validação biométrica rápida da câmera
  useEffect(() => {
    if (!pessoaNaCamera) return

    const nomeCamera = (pessoaNaCamera.nome || "").toLowerCase().trim()
    const nomeAlvo = (funcionario.nomeCompleto || funcionario.primeiroNome || "").toLowerCase().trim()
    const primeiroAlvo = (funcionario.primeiroNome || "").toLowerCase().trim()

    const ehMesmaPessoa =
      pessoaNaCamera.id === funcionario.funcionarioId ||
      nomeCamera.includes(primeiroAlvo) ||
      nomeAlvo.includes(nomeCamera.split(" ")[0])

    if (ehMesmaPessoa) {
      setStatus("sucesso")
    } else {
      setNomeOutro(pessoaNaCamera.nome.split(" ")[0])
      setStatus("outro")
      const timeout = setTimeout(() => {
        onClose()
      }, 2600)
      return () => clearTimeout(timeout)
    }
  }, [pessoaNaCamera, funcionario, onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-[2rem] bg-slate-900/90 border border-white/15 p-6 text-center text-white shadow-2xl backdrop-blur-2xl"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo com contador de permanência e botão fechar */}
        <div className="flex items-center justify-between text-xs text-white/50 mb-5">
          <span className="font-mono">{segundos}s restantes</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Estado 1: Checando identidade */}
        {status === "checando" && (
          <div className="py-4 flex flex-col items-center gap-4">
            <div className="rounded-2xl bg-slate-950/60 p-4 border border-white/10 shadow-inner">
              <OlhosRobo largura={160} ocioso={false} piscar cor="#ffffff" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold tracking-tight text-white">
                Só confirmando que é você...
              </h3>
              <p className="text-xs text-white/60">
                Olhe para a câmera para liberar o contador de {funcionario.primeiroNome}
              </p>
            </div>
          </div>
        )}

        {/* Estado 2: Outra pessoa na câmera (amigável e leve) */}
        {status === "outro" && (
          <div className="py-6 flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-3xl border border-amber-400/30">
              🙂
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">
                Esse é o da {funcionario.primeiroNome} 🙂
              </h3>
              <p className="text-xs text-amber-200/70">
                {nomeOutro ? `Identificamos ${nomeOutro}.` : ""} Voltando para a tela inicial...
              </p>
            </div>
          </div>
        )}

        {/* Estado 3: Sucesso — Exibe o QR Code grande e o cronômetro */}
        {status === "sucesso" && (
          <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
            <div>
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold shadow-sm ${
                  passouDoTempo
                    ? "bg-red-500/25 text-red-200 border border-red-400/40 animate-pulse"
                    : "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
                }`}
              >
                <span>⏳</span>
                <span>{tempoRestanteStr} restantes</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white mt-2">
                Leve o contador pro seu celular
              </h2>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                Te aviso com alarme sonoro 5 min antes de acabar!
              </p>
            </div>

            {/* Imagem do QR Code */}
            <div className="rounded-2xl bg-white p-3 shadow-xl">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt={`QR Code para o espelho de ${funcionario.primeiroNome}`}
                  className="h-44 w-44 rounded-lg"
                />
              ) : (
                <div className="h-44 w-44 flex items-center justify-center text-xs text-slate-500">
                  Gerando QR Code...
                </div>
              )}
            </div>

            <p className="text-[11px] text-white/50">
              Aponte a câmera do seu celular para abrir o seu ponto
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
