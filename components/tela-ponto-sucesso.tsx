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

  // Configuração dos 4 Cenários de Glassmorphism com Dourado Puro e Ícones Ampliados
  const getCenario = () => {
    const t = (tipo || "").toLowerCase().trim()

    // 1. RETORNO ALMOÇO - Full-Screen Glassmorphism Teal Signature
    if (t.includes("retorno")) {
      return {
        baseBg: "bg-slate-950",
        orb1: "bg-[#14b8a6]",
        orb2: "bg-[#0d9488]",
        orb3: "bg-[#2dd4bf]",
        glassTint: "bg-teal-950/40",
        cardClass: "bg-white/[0.08] backdrop-blur-2xl border border-white/20 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.5)] text-white",
        cardDivider: "border-white/15",
        cardLabel: "text-teal-200/80",
        timeText: "text-white",
        dateText: "text-teal-100",
        tagClass: "bg-teal-300/25 text-teal-100 border border-teal-300/40",
        greetingColor: "#ffffff",
        trackBg: "bg-black/30",
        statusDot: "bg-teal-300",
        btnGrad: "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)",
        textMuted: "text-teal-200/80",
      }
    }

    // 2. ENTRADA / DIA - Full-Screen Glassmorphism DOURADO NOBRE PURO (Sem tons laranjas)
    if (t.includes("entrada")) {
      return {
        baseBg: "bg-[#0f0c05]",
        orb1: "bg-[#eab308]",
        orb2: "bg-[#ca8a04]",
        orb3: "bg-[#fef08a]",
        glassTint: "bg-yellow-950/30",
        cardClass: "bg-white/[0.08] backdrop-blur-2xl border border-amber-200/30 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.5)] text-white",
        cardDivider: "border-white/15",
        cardLabel: "text-amber-200/90",
        timeText: "text-white",
        dateText: "text-amber-100",
        tagClass: "bg-amber-400/25 text-amber-100 border border-amber-300/50",
        greetingColor: "#ffffff",
        trackBg: "bg-black/30",
        statusDot: "bg-amber-300",
        btnGrad: "linear-gradient(135deg, #eab308 0%, #ca8a04 100%)",
        textMuted: "text-amber-200/80",
      }
    }

    // 3. SAÍDA ALMOÇO - Full-Screen Glassmorphism Âmbar Gastronômico
    if (t.includes("almoço") || t.includes("almoco")) {
      return {
        baseBg: "bg-[#1c0c05]",
        orb1: "bg-[#f97316]",
        orb2: "bg-[#ea580c]",
        orb3: "bg-[#fb923c]",
        glassTint: "bg-orange-950/40",
        cardClass: "bg-white/[0.08] backdrop-blur-2xl border border-white/20 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.5)] text-white",
        cardDivider: "border-white/15",
        cardLabel: "text-orange-200/80",
        timeText: "text-white",
        dateText: "text-orange-100",
        tagClass: "bg-orange-300/25 text-orange-100 border border-orange-300/40",
        greetingColor: "#ffffff",
        trackBg: "bg-black/30",
        statusDot: "bg-orange-300",
        btnGrad: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        textMuted: "text-orange-200/80",
      }
    }

    // 4. NOITE / FIM DE EXPEDIENTE - Full-Screen Glassmorphism Azul Marinho com Dourado
    return {
      baseBg: "bg-[#030712]",
      orb1: "bg-[#1e293b]",
      orb2: "bg-[#3b82f6]",
      orb3: "bg-[#c69e6b]",
      glassTint: "bg-slate-950/50",
      cardClass: "bg-slate-900/60 backdrop-blur-2xl border border-amber-400/25 shadow-[0_16px_50px_-10px_rgba(0,0,0,0.7)] text-white",
      cardDivider: "border-slate-800/80",
      cardLabel: "text-slate-400",
      timeText: "text-amber-200",
      dateText: "text-slate-300",
      tagClass: "bg-amber-400/20 text-amber-300 border border-amber-400/40",
      greetingColor: "#c69e6b", // Dourado Signature
      trackBg: "bg-slate-800/80",
      statusDot: "bg-amber-400",
      btnGrad: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)",
      textMuted: "text-slate-400",
    }
  }

  const cenario = getCenario()

  return (
    <div className={`absolute inset-0 z-40 h-screen w-full select-none overflow-hidden ${cenario.baseBg}`}>
      {/* 1. CAMADA DE LUZES / ESFERAS AMBIENTES FLUIDAS NO FUNDO */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-24 right-0 w-[550px] h-[550px] rounded-full ${cenario.orb1} blur-[120px] opacity-75 animate-pulse`} />
        <div className={`absolute bottom-0 left-0 w-[450px] h-[450px] rounded-full ${cenario.orb2} blur-[110px] opacity-65`} />
        <div className={`absolute top-1/3 left-1/3 w-[380px] h-[380px] rounded-full ${cenario.orb3} blur-[100px] opacity-45`} />
      </div>

      {/* 2. SUPERFÍCIE DE GLASSMORPHISM DE TELA INTEIRA (100% LARGURA/ALTURA, SEM BORDAS) */}
      <div
        className={`absolute inset-0 w-full h-full backdrop-blur-[60px] backdrop-saturate-[180%] ${cenario.glassTint} border-none flex flex-col justify-between p-4 sm:p-8 lg:p-10 transition-all duration-700`}
      >
        {/* TOPO: Logo flutuante limpa e Texto "Ponto Registrado" flutuante */}
        <div
          className={`relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto shrink-0 transition-opacity duration-500 ease-out ${
            conteudoVisivel ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Image src="/logo.png" alt="Logo" width={150} height={75} priority style={{ height: "auto" }} />
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white drop-shadow-sm">
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${cenario.statusDot}`} />
            <span>Ponto Registrado</span>
          </div>
        </div>

        {/* ÁREA CENTRAL: Layout Dividido sem Scroll com Transição Cinematográfica */}
        <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-10 max-w-5xl mx-auto w-full my-auto px-2">
          {/* LADO ESQUERDO: Saudação e Card de Informações */}
          <div
            className={`w-full md:w-[46%] space-y-4 sm:space-y-5 text-center md:text-left transition-all duration-600 ease-out ${
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

            {/* Card de Informações Retangular */}
            <div className={`rounded-2xl p-5 sm:p-6 space-y-3.5 ${cenario.cardClass}`}>
              <div className={`flex items-center justify-between border-b pb-2.5 ${cenario.cardDivider}`}>
                <span className={`text-xs uppercase font-bold tracking-wider ${cenario.cardLabel}`}>Tipo</span>
                <span className={`font-bold text-sm px-3.5 py-1 rounded-md ${cenario.tagClass}`}>
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

          {/* LADO DIREITO: Ícone Animado Gigante Expandido */}
          <div
            className={`w-full md:w-[54%] flex items-center justify-center transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1) ${
              iconeAncorado
                ? "translate-x-0 scale-120 sm:scale-125"
                : "md:-translate-x-[45%] scale-140 sm:scale-155 md:scale-165"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <IlustracaoPontoAnimada tipo={tipo} className="w-72 h-72 sm:w-88 sm:h-88 md:w-[420px] md:h-[420px] lg:w-[480px] lg:h-[480px]" />
            </div>
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="relative z-10 h-4 shrink-0" />
      </div>
    </div>
  )
}
