"use client"

import React, { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { IlustracaoPontoAnimada } from "@/components/ilustracoes-ponto-animadas"
import { AnimacaoVozIa } from "@/components/animacao-voz-ia"

interface TelaPontoSucessoProps {
  nome: string
  tipo: string
  hora: string
  data: string
  mensagem?: string
  falaVoz?: string
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
  falaVoz,
  durationMs = 30000,
  onVoltar,
  modoDemonstracao = false,
}: TelaPontoSucessoProps) {
  // Fases da coreografia:
  // 1. "centro": Ícone centralizado (0 a 800ms)
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

  // Configuração dos 4 Cenários em MODO LIGHT GLASSMORPHISM com cores corporativas
  const getCenario = () => {
    const t = (tipo || "").toLowerCase().trim()

    // 1. RETORNO ALMOÇO - Light Glassmorphism Teal Signature
    if (t.includes("retorno")) {
      return {
        baseBg: "bg-teal-50/40",
        orb1: "bg-[#14b8a6]",
        orb2: "bg-[#0d9488]",
        orb3: "bg-[#2dd4bf]",
        glassTint: "bg-white/60",
        cardClass: "bg-white/90 backdrop-blur-xl border border-teal-200/80 shadow-md text-slate-900",
        cardDivider: "border-slate-200",
        cardLabel: "text-teal-800/80",
        timeText: "text-slate-900",
        dateText: "text-slate-700",
        tagClass: "bg-teal-100 text-teal-900 border border-teal-300",
        greetingColor: "#0f766e",
        trackBg: "bg-slate-200",
        statusDot: "bg-teal-600",
        btnGrad: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
        textMuted: "text-slate-600",
      }
    }

    // 2. ENTRADA / DIA - Light Glassmorphism DOURADO NOBRE PURO
    if (t.includes("entrada")) {
      return {
        baseBg: "bg-amber-50/30",
        orb1: "bg-[#f59e0b]",
        orb2: "bg-[#c69e6b]",
        orb3: "bg-[#fde68a]",
        glassTint: "bg-white/60",
        cardClass: "bg-white/90 backdrop-blur-xl border border-amber-200/90 shadow-md text-slate-900",
        cardDivider: "border-slate-200",
        cardLabel: "text-amber-900/80",
        timeText: "text-slate-900",
        dateText: "text-slate-700",
        tagClass: "bg-amber-100 text-amber-900 border border-amber-300",
        greetingColor: "#b45309",
        trackBg: "bg-slate-200",
        statusDot: "bg-[#c69e6b]",
        btnGrad: "linear-gradient(135deg, #c69e6b 0%, #b38850 100%)",
        textMuted: "text-slate-600",
      }
    }

    // 3. SAÍDA ALMOÇO - Light Glassmorphism Âmbar Gastronômico
    if (t.includes("almoço") || t.includes("almoco")) {
      return {
        baseBg: "bg-orange-50/40",
        orb1: "bg-[#f97316]",
        orb2: "bg-[#ea580c]",
        orb3: "bg-[#fed7aa]",
        glassTint: "bg-white/60",
        cardClass: "bg-white/90 backdrop-blur-xl border border-orange-200/80 shadow-md text-slate-900",
        cardDivider: "border-slate-200",
        cardLabel: "text-orange-900/80",
        timeText: "text-slate-900",
        dateText: "text-slate-700",
        tagClass: "bg-orange-100 text-orange-900 border border-orange-300",
        greetingColor: "#c2410c",
        trackBg: "bg-slate-200",
        statusDot: "bg-orange-600",
        btnGrad: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        textMuted: "text-slate-600",
      }
    }

    // 4. NOITE / FIM DE EXPEDIENTE - Light Glassmorphism Azul com Dourado
    return {
      baseBg: "bg-slate-100",
      orb1: "bg-[#93c5fd]",
      orb2: "bg-[#60a5fa]",
      orb3: "bg-[#c69e6b]",
      glassTint: "bg-white/70",
      cardClass: "bg-white/90 backdrop-blur-xl border border-slate-200/90 shadow-md text-slate-900",
      cardDivider: "border-slate-200",
      cardLabel: "text-slate-600",
      timeText: "text-slate-900",
      dateText: "text-slate-700",
      tagClass: "bg-blue-100 text-blue-900 border border-blue-300",
      greetingColor: "#1e3a8a",
      trackBg: "bg-slate-200",
      statusDot: "bg-blue-600",
      btnGrad: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
      textMuted: "text-slate-600",
    }
  }

  const cenario = getCenario()

  return (
    <div className={`absolute inset-0 z-40 h-screen w-full select-none overflow-hidden ${cenario.baseBg}`}>
      {/* 1. CAMADA DE LUZES / ESFERAS AMBIENTES COLORIDAS NO FUNDO */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-24 right-0 w-[550px] h-[550px] rounded-full ${cenario.orb1} blur-[130px] opacity-35 animate-pulse`} />
        <div className={`absolute bottom-0 left-0 w-[450px] h-[450px] rounded-full ${cenario.orb2} blur-[120px] opacity-30`} />
        <div className={`absolute top-1/3 left-1/3 w-[380px] h-[380px] rounded-full ${cenario.orb3} blur-[110px] opacity-25`} />
      </div>

      {/* 2. SUPERFÍCIE DE GLASSMORPHISM LIGHT DE TELA INTEIRA */}
      <div
        className={`absolute inset-0 w-full h-full backdrop-blur-[45px] backdrop-saturate-[160%] ${cenario.glassTint} border-none flex flex-col justify-between p-4 sm:p-8 lg:p-10 transition-all duration-700`}
      >
        {/* TOPO: Logo e Indicador de "Ponto Registrado" */}
        <div
          className={`relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto shrink-0 transition-opacity duration-500 ease-out ${
            conteudoVisivel ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Image src="/logo.png" alt="Logo" width={150} height={75} priority style={{ height: "auto" }} />
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 bg-white/80 border border-slate-200/80 px-3 py-1 rounded-md shadow-xs">
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
            {/* Saudação com Nome e Fala da IA */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-slate-900">
                <span style={{ color: cenario.greetingColor }}>
                  {mensagem || `Excelente dia, ${nome.split(" ")[0]}!`}
                </span>
              </h1>
              {falaVoz && (
                <div className="bg-white/80 border border-slate-200/90 rounded-md p-3 shadow-xs">
                  <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                    "{falaVoz}"
                  </p>
                </div>
              )}
            </div>

            {/* Card de Informações Retangular com Bordas Quadradas */}
            <div className={`rounded-lg p-5 sm:p-6 space-y-3.5 ${cenario.cardClass}`}>
              <div className={`flex items-center justify-between border-b pb-2.5 ${cenario.cardDivider}`}>
                <span className={`text-xs uppercase font-bold tracking-wider ${cenario.cardLabel}`}>Tipo</span>
                <span className={`font-bold text-xs px-3 py-1 rounded-md ${cenario.tagClass}`}>
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
                    background: "linear-gradient(90deg, #c69e6b 0%, #14b8a6 100%)",
                  }}
                />
              </div>
              <div className={`flex items-center justify-between text-xs ${cenario.textMuted}`}>
                <button
                  onClick={() => onVoltarRef.current()}
                  className="px-4 py-2 rounded-md font-bold text-white transition-all shadow-sm active:scale-95 text-xs sm:text-sm cursor-pointer"
                  style={{ background: cenario.btnGrad }}
                >
                  Voltar ao Início
                </button>
                <span className="font-medium text-slate-500">Retornando em {timeLeft}s...</span>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: Ícone Animado Gigante */}
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

      {/* Onda luminosa azul sutil na base */}
      <AnimacaoVozIa />
    </div>
  )
}
