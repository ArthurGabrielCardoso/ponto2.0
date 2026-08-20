"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import "../ponto-registrado/ponto-batido.css"

const TIPOS = [
  { tipo: "Entrada", label: "Excelente dia", icon: "🌤️", gradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)", frase: "Tenha um ótimo dia de trabalho!" },
  { tipo: "Saída Almoço", label: "Excelente almoço", icon: "🍽️", gradient: "linear-gradient(135deg, #ff9a56 0%, #ff6a3d 100%)", frase: "Aproveite seu almoço!" },
  { tipo: "Retorno Almoço", label: "Excelente trabalho", icon: "💼", gradient: "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)", frase: "Boa volta ao trabalho!" },
  { tipo: "Saída", label: "Excelente noite", icon: "🌙", gradient: "linear-gradient(135deg, #2d3561 0%, #1e215d 50%, #0b0c2a 100%)", frase: "Descanse bem, até amanhã!" },
]

function SuccessAnimation({ tipo }: { tipo: string }) {
  const [showCheck, setShowCheck] = useState(false)
  const tl = (tipo || "").toLowerCase()
  let icon: string
  if (tl.includes("entrada")) icon = "🌤️"
  else if (tl.includes("saída") && tl.includes("almoço")) icon = "🍽️"
  else if (tl.includes("retorno")) icon = "💼"
  else icon = "🌙"

  useEffect(() => {
    setShowCheck(false)
    const t = setTimeout(() => setShowCheck(true), 3500)
    return () => clearTimeout(t)
  }, [tipo])

  return (
    <div style={{ width: 200, height: 200, position: "relative" }}>
      {!showCheck ? (
        <>
          <style>{`
            @keyframes emojiIn { 0%{transform:scale(0) rotate(-20deg);opacity:0} 40%{transform:scale(1.2) rotate(5deg);opacity:1} 60%{transform:scale(0.95) rotate(-2deg)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
            @keyframes emojiFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
            .sa-emoji-wrap{display:flex;align-items:center;justify-content:center;width:100%;height:100%}
            .sa-emoji{font-size:110px;animation:emojiIn .8s ease-out forwards, emojiFloat 2s ease-in-out .8s infinite}
          `}</style>
          <div className="sa-emoji-wrap"><span className="sa-emoji">{icon}</span></div>
        </>
      ) : (
        <DotLottieReact
          src="https://lottie.host/8a95b3ad-f30a-4fb9-a55d-4153b3b92810/RPsps2O63O.lottie"
          loop={false}
          autoplay
        />
      )}
    </div>
  )
}

function ReturnProgress({ durationMs }: { durationMs: number }) {
  return (
    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-4">
      <style>{`@keyframes shrink{0%{width:100%}100%{width:0%}}`}</style>
      <div
        className="h-full bg-[#1db9b3] rounded-full"
        style={{ animation: `shrink ${durationMs}ms linear forwards` }}
      />
    </div>
  )
}

export default function AnimacaoPage() {
  const [index, setIndex] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [showFull, setShowFull] = useState(false)
  const current = TIPOS[index]

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % TIPOS.length)
    setRunKey((k) => k + 1)
  }, [])

  const showFullPreview = (i: number) => {
    setIndex(i)
    setRunKey((k) => k + 1)
    setShowFull(true)
  }

  if (showFull) {
    return (
      <div className="relative min-h-screen">
        <style>{`
          @keyframes slideUp{0%{opacity:0;transform:translateY(30px)}100%{opacity:1;transform:translateY(0)}}
          .su{animation:slideUp .5s ease-out both}
          .su-d1{animation-delay:.15s}
          .su-d2{animation-delay:.3s}
          .su-d3{animation-delay:.45s}
        `}</style>
        <div className="ponto-batido-container">
          <div className="ponto-batido-form-section relative">
            <div className="w-full max-w-md">
              <div className="text-center space-y-6 mt-20">
                <div className="flex justify-center su" key={runKey}>
                  <SuccessAnimation tipo={current.tipo} />
                </div>
                <h1 className="text-3xl font-bold su su-d1" style={{ color: "#c69e6b" }}>
                  {current.label}, Arthur!
                </h1>
                <div className="su su-d2 text-sm text-gray-600 bg-green-50 rounded-lg p-3 border border-green-200">
                  <span className="text-green-700 font-semibold">{current.tipo}</span>{" "}
                  registrada as{" "}
                  <span className="font-semibold">{new Date().toLocaleTimeString()}</span>
                </div>
                <div className="su su-d3">
                  <ReturnProgress durationMs={15000} />
                </div>
                <div className="flex gap-3 justify-center mt-4 su su-d3">
                  <button
                    onClick={() => setShowFull(false)}
                    className="bg-[#1db9b3] hover:bg-[#1db9b3]/90 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => { setIndex((i) => (i + 1) % TIPOS.length); setRunKey((k) => k + 1) }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Proximo
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="ponto-batido-image-section" style={{ background: current.gradient }}>
            <div className="text-center">
              <Image src="/logo.png" alt="Logo" width={500} height={200} priority style={{ height: "auto" }} />
              <p className="text-white/60 text-lg mt-6 font-light">{current.frase}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-2xl font-bold text-gray-800">Preview de Animacoes</h1>

      <div className="text-sm text-gray-500">
        {index + 1} de {TIPOS.length} &mdash; <strong>{current.tipo}</strong>
      </div>

      <div className="flex flex-col items-center gap-4 bg-gray-50 rounded-2xl p-10 shadow-sm border" key={runKey}>
        <SuccessAnimation tipo={current.tipo} />

        <h2 className="text-2xl font-bold" style={{ color: "#c69e6b" }}>
          {current.label}, Arthur!
        </h2>

        <div className="text-sm text-gray-600 bg-green-50 rounded-lg p-3 border border-green-200">
          <span className="text-green-700 font-semibold">{current.tipo}</span>{" "}
          registrada as{" "}
          <span className="font-semibold">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={next}
          className="bg-[#1db9b3] hover:bg-[#1db9b3]/90 text-white px-8 py-3 rounded-lg font-medium transition-colors text-lg"
        >
          Proximo ({TIPOS[(index + 1) % TIPOS.length].tipo})
        </button>

        <button
          onClick={() => setRunKey((k) => k + 1)}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Repetir
        </button>
      </div>

      <div className="flex gap-2 mt-2">
        {TIPOS.map((t, i) => (
          <button
            key={t.tipo}
            onClick={() => { setIndex(i); setRunKey((k) => k + 1) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              i === index ? "bg-[#1db9b3] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.icon} {t.tipo}
          </button>
        ))}
      </div>

      <div className="border-t pt-4 mt-2">
        <p className="text-sm text-gray-400 mb-3 text-center">Preview tela completa (com confetti + gradiente)</p>
        <div className="flex gap-2">
          {TIPOS.map((t, i) => (
            <button
              key={t.tipo}
              onClick={() => showFullPreview(i)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 transition-colors"
            >
              {t.icon} Tela cheia
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
