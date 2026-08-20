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
  // 2. "deslizando": Ícone desliza majestosamente para o lado direito (800ms a 1400ms)
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

  // Configuração atmosférica por período (Cenários ricos e imersivos)
  const getCenario = () => {
    const t = (tipo || "").toLowerCase().trim()

    // 1. NOITE / FIM DE EXPEDIENTE - Céu Noturno Azul Marinho Profundo com Dourado
    if ((t.includes("saída") || t.includes("saida")) && !t.includes("almoço") && !t.includes("almoco")) {
      return {
        isDark: true,
        bgStyle: {
          background: "radial-gradient(circle at 75% 45%, #1e293b 0%, #0f172a 45%, #050811 100%)",
        },
        glowOrb: "radial-gradient(circle, rgba(253, 224, 71, 0.18) 0%, rgba(99, 102, 241, 0.12) 50%, transparent 70%)",
        cardClass: "bg-slate-900/85 backdrop-blur-xl border border-amber-400/25 shadow-[0_16px_50px_-10px_rgba(0,0,0,0.8)] text-white",
        cardDivider: "border-slate-800",
        cardLabel: "text-slate-400",
        timeText: "text-amber-200",
        dateText: "text-slate-300",
        tagClass: "bg-amber-400/15 text-amber-300 border border-amber-400/30",
        greetingColor: "#fde047",
        trackBg: "bg-slate-800",
        statusBadge: "bg-amber-500/15 text-amber-300 border border-amber-400/30",
        statusDot: "bg-amber-400",
        btnGrad: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)",
        textMuted: "text-slate-400",
      }
    }

    // 2. ENTRADA / MANHÃ - Amanhecer Radiante com Halo Solar e Fundo Dourado Suave
    if (t.includes("entrada")) {
      return {
        isDark: false,
        bgStyle: {
          background: "radial-gradient(circle at 75% 45%, #fef3c7 0%, #fffbeb 30%, #fcfbf9 70%, #f8f6f0 100%)",
        },
        glowOrb: "radial-gradient(circle, rgba(245, 158, 11, 0.28) 0%, rgba(251, 191, 36, 0.14) 50%, transparent 70%)",
        cardClass: "bg-white/90 backdrop-blur-xl border border-amber-200/70 shadow-[0_16px_40px_-8px_rgba(198,158,107,0.25)] text-gray-900",
        cardDivider: "border-amber-100",
        cardLabel: "text-gray-400",
        timeText: "text-gray-900",
        dateText: "text-gray-700",
        tagClass: "bg-amber-50 text-amber-900 border border-amber-200/80",
        greetingColor: "#c69e6b",
        trackBg: "bg-amber-100/60",
        statusBadge: "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
        statusDot: "bg-emerald-500",
        btnGrad: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)",
        textMuted: "text-gray-400",
      }
    }

    // 3. SAÍDA ALMOÇO - Âmbar Quente Gastronômico e Terracota
    if (t.includes("almoço") || t.includes("almoco")) {
      return {
        isDark: false,
        bgStyle: {
          background: "radial-gradient(circle at 75% 45%, #ffedd5 0%, #fff7ed 35%, #faf8f5 75%, #f4ede4 100%)",
        },
        glowOrb: "radial-gradient(circle, rgba(249, 115, 22, 0.25) 0%, rgba(251, 146, 60, 0.12) 50%, transparent 70%)",
        cardClass: "bg-white/90 backdrop-blur-xl border border-orange-200/70 shadow-[0_16px_40px_-8px_rgba(234,88,12,0.2)] text-gray-900",
        cardDivider: "border-orange-100",
        cardLabel: "text-gray-400",
        timeText: "text-gray-900",
        dateText: "text-gray-700",
        tagClass: "bg-orange-50 text-orange-950 border border-orange-200/80",
        greetingColor: "#c69e6b",
        trackBg: "bg-orange-100/60",
        statusBadge: "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
        statusDot: "bg-emerald-500",
        btnGrad: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
        textMuted: "text-gray-400",
      }
    }

    // 4. RETORNO ALMOÇO - Foco & Produtividade Teal Signature
    return {
      isDark: false,
      bgStyle: {
        background: "radial-gradient(circle at 75% 45%, #ccfbf1 0%, #f0fdfa 35%, #f6fbfb 75%, #ebf5f5 100%)",
      },
      glowOrb: "radial-gradient(circle, rgba(20, 184, 166, 0.25) 0%, rgba(45, 212, 191, 0.12) 50%, transparent 70%)",
      cardClass: "bg-white/90 backdrop-blur-xl border border-teal-200/70 shadow-[0_16px_40px_-8px_rgba(13,148,136,0.2)] text-gray-900",
      cardDivider: "border-teal-100",
      cardLabel: "text-gray-400",
      timeText: "text-gray-900",
      dateText: "text-gray-700",
      tagClass: "bg-teal-50 text-teal-950 border border-teal-200/80",
      greetingColor: "#0f766e",
      trackBg: "bg-teal-100/60",
      statusBadge: "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
      statusDot: "bg-emerald-500",
      btnGrad: "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)",
      textMuted: "text-gray-400",
    }
  }

  const cenario = getCenario()

  return (
    <div
      className="absolute inset-0 z-40 h-screen w-full flex flex-col justify-between p-4 sm:p-8 lg:p-10 overflow-hidden select-none transition-colors duration-700"
      style={cenario.bgStyle}
    >
      {/* Halo de Luz de Fundo */}
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
        <Image src="/logo.png" alt="Logo" width={150} height={75} priority style={{ height: "auto" }} />
        <span className={`text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-md shadow-sm flex items-center gap-1.5 ${cenario.statusBadge}`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${cenario.statusDot}`} />
          Ponto Registrado
        </span>
      </div>

      {/* ÁREA CENTRAL: Layout sem Scroll com Transição Cinematográfica */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-10 max-w-5xl mx-auto w-full my-auto px-2">
        {/* LADO ESQUERDO: Saudação Dourada e Card de Informações */}
        <div
          className={`w-full md:w-[52%] space-y-4 sm:space-y-5 text-center md:text-left transition-all duration-600 ease-out ${
            conteudoVisivel
              ? "opacity-100 translate-x-0 translate-y-0"
              : "opacity-0 -translate-x-6 md:-translate-y-2 pointer-events-none"
          }`}
        >
          {/* Saudação com Nome */}
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              <span style={{ color: cenario.greetingColor }}>
                {mensagem || `Excelente trabalho, ${nome.split(" ")[0]}!`}
              </span>
            </h1>
          </div>

          {/* Card de Informações Retangular */}
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
                className="px-5 py-2 rounded-lg font-bold text-white transition-all shadow-sm hover:shadow active:scale-95 text-xs sm:text-sm"
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
