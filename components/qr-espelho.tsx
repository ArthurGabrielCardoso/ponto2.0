"use client"

import React, { useEffect, useState } from "react"
import QRCode from "qrcode"

interface QrEspelhoProps {
  funcionarioId: string
  nome: string
  /** Chamado quando o QR é aberto ou fechado, para pausar o retorno automático. */
  onAbrirFechar?: (aberto: boolean) => void
}

/**
 * QR que leva a pessoa ao próprio ponto, no celular dela.
 *
 * Fica pequeno num canto porque a tela de sucesso já é cheia e porque quem só
 * quer bater o ponto não deveria ter que desviar dele. Tocar amplia — e é o
 * toque que pausa o retorno automático de 15s, já que sacar o celular,
 * desbloquear e abrir a câmera não cabe nesse tempo.
 *
 * O token é assinado no servidor e vale um turno — tempo suficiente para a
 * pessoa consultar o contador de almoço depois de subir para comer. Se
 * ESPELHO_SECRET não estiver configurado no ambiente, o componente simplesmente
 * não aparece.
 */
export function QrEspelho({ funcionarioId, nome, onAbrirFechar }: QrEspelhoProps) {
  const [imagem, setImagem] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    let cancelado = false

    const gerar = async () => {
      try {
        const res = await fetch("/api/espelho-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ funcionarioId, nome }),
        })
        if (!res.ok) return
        const dados = await res.json()
        if (cancelado || !dados?.configurado || !dados?.token) return

        const url = `${window.location.origin}/meu-ponto/${dados.token}`
        const png = await QRCode.toDataURL(url, {
          margin: 1,
          width: 320,
          color: { dark: "#0f172a", light: "#ffffff" },
        })
        if (!cancelado) setImagem(png)
      } catch {
        // Sem QR a tela segue exatamente como era.
      }
    }

    void gerar()
    return () => {
      cancelado = true
    }
  }, [funcionarioId, nome])

  if (!imagem) return null

  const alternar = () => {
    const novo = !aberto
    setAberto(novo)
    onAbrirFechar?.(novo)
  }

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-xl border border-white/25 bg-black/40 p-2 backdrop-blur-md transition-all hover:bg-black/60 active:scale-95"
        aria-label="Ver o meu ponto no celular"
      >
        <img src={imagem} alt="" className="h-14 w-14 rounded-md bg-white p-0.5" />
        <span className="pr-1 text-left text-[11px] font-medium leading-tight text-white/80">
          Meu ponto
          <br />
          no celular
        </span>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={alternar}
        >
          <div
            className="mx-4 flex flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={imagem} alt="QR para abrir o seu ponto no celular" className="h-64 w-64" />
            <div className="text-center">
              <p className="text-base font-bold text-slate-900">Aponte a câmera do celular</p>
              <p className="mt-1 text-xs text-slate-500">
                O link é pessoal e vale até o fim do seu turno.
              </p>
            </div>
            <button
              type="button"
              onClick={alternar}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
