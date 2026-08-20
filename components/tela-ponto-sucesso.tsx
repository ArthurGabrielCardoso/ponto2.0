"use client"

import React, { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { IlustracaoPontoAnimada } from "@/components/ilustracoes-ponto-animadas"

interface TelaPontoSucessoProps {
  nome: string
  tipo: string
  hora: string
  data: string
  mensagem?: string
  durationMs?: number
  onVoltar: () => void
  modoDemonstracao?: boolean
}

export function TelaPontoSucesso({
  nome,
  tipo,
  hora,
  data,
  mensagem,
  durationMs = 30000,
  onVoltar,
  modoDemonstracao = false,
}: TelaPontoSucessoProps) {
  // Fases da coreografia:
  // 1. "centro": Ícone gigante centralizado (0 a 800ms)
  // 2. "deslizando": Ícone desliza para o lado direito (800ms a 1400ms)
  // 3. "revelar": Ícone 100% ancorado -> surge a logo, badge e lado esquerdo (1500ms+)
  const [fase, setFase] = useState<"centro" | "deslizando" | "revelar">("centro")
  const [timeLeft, setTimeLeft] = useState(Math.round(durationMs / 1000))
  const onVoltarRef = useRef(onVoltar)

  useEffect(() => {
    onVoltarRef.current = onVoltar
  }, [onVoltar])

  useEffect(() => {
    setFase("centro")
    const tDeslizar = setTimeout(() => {
      setFase("deslizando")
    }, 800)

    const tRevelar = setTimeout(() => {
      setFase("revelar")
    }, 1500)

    return () => {
      clearTimeout(tDeslizar)
      clearTimeout(tRevelar)
    }
  }, [tipo, nome])

  useEffect(() => {
    setTimeLeft(Math.round(durationMs / 1000))
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onVoltarRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [durationMs, tipo, nome])

  const iconeAncorado = fase === "deslizando" || fase === "revelar"
  const conteudoVisivel = fase === "revelar"

  // Configuração dos 4 Cenários com Gradientes Suaves Glassmorphism
  const getCenario = () => {
    const t = (tipo || "").toLowerCase().trim()

    // 1. RETORNO ALMOÇO - Signature Teal Glassmorphism
    if (t.includes("retorno")) {
      return {
        bgStyle: {
          background: "radial-gradient(circle at 75% 45%, #14b8a6 0%, #0d9488 45%, #042f2e 100%)",
        },
        glowOrb: "radial-gradient(circle, rgba(94, 234, 212, 0.28) 0%, rgba(20, 184, 166, 0.12) 50%, transparent 70%)",
        cardClass: "bg-black/20 backdrop-blur-2xl border border-teal-200/35 shadow-[0_16px_50px_-10px_rgba(0,0,0,0.4)] text-white",
        cardDivider: "border-white/15",
        cardLabel: "text-teal-200/80",
        timeText: "text-white",
        dateText: "text-teal-100",
        tagClass: "bg-teal-300/20 text-teal-100 border border-teal-300/40",
        greetingColor: "#ffffff",
        trackBg: "bg-black/30",
        statusBadge: "bg-white/20 text-teal-100 border border-white/30",
        statusDot: "bg-teal-300",
        btnGrad: "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)",
        textMuted: "text-teal-200/80",
      }
    }

    // 2. ENTRADA / DIA - Dourado Nobre Suave (Signature Gold Glassmorphism)
    if (t.includes("entrada")) {
      return {
        bgStyle: {
          background: "radial-gradient(circle at 75% 45%, #c69e6b 0%, #a67c4e 45%, #4a3418 100%)",
        },
        glowOrb: "radial-gradient(circle, rgba(254, 240, 138, 0.25) 0%, rgba(245, 158, 11, 0.12) 50%, transparent 70%)",
        cardClass: "bg-black/20 backdrop-blur-2xl border border-amber-200/35 shadow-[0_16px_50px_-10px_rgba(0,0,0,0.4)] text-white",
        cardDivider: "border-white/15",
        cardLabel: "text-amber-200/80",
        timeText: "text-white",
        dateText: "text-amber-100",
        tagClass: "bg-amber-300/20 text-amber-100 border border-amber-300/40",
        greetingColor: "#ffffff",
        trackBg: "bg-black/30",
        statusBadge: "bg-white/20 text-amber-100 border border-white/30",
        statusDot: "bg-amber-300",
        btnGrad: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)",
        textMuted: "text-amber-200/80",
      }
    }

    // 3. SAÍDA ALMOÇO - Âmbar Suave Gastronômico (Glassmorphism Harmonioso)
    if (t.includes("almoço") || t.includes("almoco")) {
      return {
        bgStyle: {
          background: "radial-gradient(circle at 75% 45%, #f97316 0%, #c2410c 45%, #431407 100%)",
        },
        glowOrb: "radial-gradient(circle, rgba(254, 215, 170, 0.25) 0%, rgba(249, 115, 22, 0.12) 50%, transparent 70%)",
        cardClass: "bg-black/20 backdrop-blur-2xl border border-orange-200/35 shadow-[0_16px_50px_-10px_rgba(0,0,0,0.4)] text-white",
        cardDivider: "border-white/15",
        cardLabel: "text-orange-200/80",
        timeText: "text-white",
        dateText: "text-orange-100",
        tagClass: "bg-orange-300/20 text-orange-100 border border-orange-300/40",
        greetingColor: "#ffffff",
        trackBg: "bg-black/30",
        statusBadge: "bg-white/20 text-orange-100 border border-white/30",
        statusDot: "bg-orange-300",
        btnGrad: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        textMuted: "text-orange-200/80",
      }
    }

    // 4. NOITE / FIM DE EXPEDIENTE - Azul Marinho Noturno Profundo com Saudação em Dourado
    return {
      bgStyle: {
        background: "radial-gradient(circle at 75% 45%, #1e293b 0%, #0f172a 50%, #050811 100%)",
      },
      glowOrb: "radial-gradient(circle, rgba(198, 158, 107, 0.2) 0%, rgba(99, 102, 241, 0.12) 50%, transparent 70%)",
      cardClass: "bg-slate-900/80 backdrop-blur-2xl border border-amber-400/30 shadow-[0_16px_50px_-10px_rgba(0,0,0,0.8)] text-white",
      cardDivider: "border-slate-800/80",
      cardLabel: "text-slate-400",
      timeText: "text-amber-200",
      dateText: "text-slate-300",
      tagClass: "bg-amber-400/20 text-amber-300 border border-amber-400/40",
      greetingColor: "#c69e6b", // Dourado Signature solicitado pelo usuário!
      trackBg: "bg-slate-800/80",
      statusBadge: "bg-amber-400/15 text-amber-300 border border-amber-400/30",
      statusDot: "bg-amber-400",
      btnGrad: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)",
      textMuted: "text-slate-400",
    }
  }

  const cenario = getCenario()

  return (
    <div
      className="absolute inset-0 z-40 h-screen w-full flex flex-col justify-between p-4 sm:p-8 lg:p-10 overflow-hidden select-none transition-all duration-700"
      style={cenario.bgStyle}
    >
      {/* Halo de Luz Ambiente */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{ background: cenario.glowOrb }}
      />

      {/* TOPO: Logo e Badge "Ponto Registrado" — Surge na fase 'revelar' */}
      <div
        className={`relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto shrink-0 transition-opacity duration-500 ease-out ${
          conteudoVisivel ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/25 shadow-md inline-block">
          <Image src="/logo.png" alt="Logo" width={140} height={70} priority style={{ height: "auto" }} />
        </div>
        <span className={`text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-md shadow-sm flex items-center gap-1.5 backdrop-blur-md ${cenario.statusBadge}`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${cenario.statusDot}`} />
          Ponto Registrado
        </span>
      </div>

      {/* ÁREA CENTRAL: Layout Dividido sem Scroll com Transição Cinematográfica */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-10 max-w-5xl mx-auto w-full my-auto px-2">
        {/* LADO ESQUERDO: Saudação e Card de Informações */}
        <div
          className={`w-full md:w-[52%] space-y-4 sm:space-y-5 text-center md:text-left transition-all duration-600 ease-out ${
            conteudoVisivel
              ? "opacity-100 translate-x-0 translate-y-0"
              : "opacity-0 -translate-x-6 md:-translate-y-2 pointer-events-none"
          }`}
        >
          {/* Saudação com Nome */}
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight drop-shadow-sm">
              <span style={{ color: cenario.greetingColor }}>
                {mensagem || `Excelente trabalho, ${nome.split(" ")[0]}!`}
              </span>
            </h1>
          </div>

          {/* Card de Informações Retangular em Vidro Fosco Nobre */}
          <div className={`rounded-lg p-4 sm:p-5 space-y-3 ${cenario.cardClass}`}>
            <div className={`flex items-center justify-between border-b pb-2.5 ${cenario.cardDivider}`}>
              <span className={`text-xs uppercase font-bold tracking-wider ${cenario.cardLabel}`}>Tipo</span>
              <span className={`font-bold text-sm px-3 py-1 rounded-md ${cenario.tagClass}`}>
                {tipo}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className={`text-xs uppercase font-bold tracking-wider block ${cenario.cardLabel}`}>Horário Registrado</span>
                <span className={`text-2xl sm:text-3xl font-bold tracking-tight font-mono ${cenario.timeText}`}>{hora}</span>
              </div>
              <div className="text-right">
                <span className={`text-xs uppercase font-bold tracking-wider block ${cenario.cardLabel}`}>Data</span>
                <span className={`text-sm font-semibold ${cenario.dateText}`}>{data}</span>
              </div>
            </div>
          </div>

          {/* Barra de Progresso e Botão */}
          <div className="space-y-2 pt-1">
            <div className={`w-full rounded-full h-1.5 overflow-hidden ${cenario.trackBg}`}>
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${(timeLeft / Math.round(durationMs / 1000)) * 100}%`,
                  background: "linear-gradient(90deg, #c69e6b 0%, #1db9b3 100%)",
                }}
              />
            </div>
            <div className={`flex items-center justify-between text-xs ${cenario.textMuted}`}>
              <button
                onClick={() => onVoltarRef.current()}
                className="px-5 py-2 rounded-lg font-bold text-white transition-all shadow-md hover:shadow-lg active:scale-95 text-xs sm:text-sm"
                style={{ background: cenario.btnGrad }}
              >
                Voltar ao Início
              </button>
              <span>Retornando em {timeLeft}s...</span>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Ícone Animado Gigante (Centro grande -> Desliza para Direita) */}
        <div
          className={`w-full md:w-[48%] flex items-center justify-center transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1) ${
            iconeAncorado
              ? "translate-x-0 scale-100"
              : "md:-translate-x-[55%] scale-135 sm:scale-150 md:scale-165"
          }`}
        >
          <div className="relative">
            <IlustracaoPontoAnimada tipo={tipo} className="w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-[380px] lg:h-[380px]" />
          </div>
        </div>
      </div>

      {/* RODAPÉ: Espaço limpo */}
      <div className="relative z-10 h-4 shrink-0" />
    </div>
  )
}
