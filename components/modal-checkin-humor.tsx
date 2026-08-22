"use client"

import React, { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { AnimacaoVozIa } from "@/components/animacao-voz-ia"
import { obterSaudacaoInteligente } from "@/lib/ia-saudacao"
import { reproduzirVozSaudacao } from "@/lib/tts-audio"
import "../app/ponto-registrado/ponto-batido.css"

export interface OpcaoHumorCompleta {
  id: string
  emoji: string
  titulo: string
  subtitulo: string
  corGradiente: string
  bordaAtiva: string
}

// Pool completo de 15 opções variadas e divertidas para nunca ser sempre igual
export const BANCO_OPCOES_HUMOR: OpcaoHumorCompleta[] = [
  {
    id: "animado",
    emoji: "🚀",
    titulo: "A todo vapor!",
    subtitulo: "Energia no topo, pronta pra fazer acontecer",
    corGradiente: "from-amber-100 to-yellow-50",
    bordaAtiva: "border-amber-400 ring-2 ring-amber-400/40 shadow-lg",
  },
  {
    id: "excelente",
    emoji: "😄",
    titulo: "Excelente!",
    subtitulo: "Radiante, feliz e em paz com a vida",
    corGradiente: "from-emerald-100 to-teal-50",
    bordaAtiva: "border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg",
  },
  {
    id: "energia",
    emoji: "⚡",
    titulo: "100% Energia!",
    subtitulo: "Foco total para bater todas as metas",
    corGradiente: "from-cyan-100 to-blue-50",
    bordaAtiva: "border-cyan-400 ring-2 ring-cyan-400/40 shadow-lg",
  },
  {
    id: "leao",
    emoji: "🦁",
    titulo: "Modo Fera!",
    subtitulo: "Garra, determinação e foco absoluto",
    corGradiente: "from-orange-100 to-amber-50",
    bordaAtiva: "border-orange-400 ring-2 ring-orange-400/40 shadow-lg",
  },
  {
    id: "foco",
    emoji: "🎯",
    titulo: "Foco Total!",
    subtitulo: "Concentração máxima e muita produtividade",
    corGradiente: "from-rose-100 to-red-50",
    bordaAtiva: "border-rose-400 ring-2 ring-rose-400/40 shadow-lg",
  },
  {
    id: "tranquilo",
    emoji: "☕",
    titulo: "Paz & Café",
    subtitulo: "Dia sereno, mente leve e passos firmes",
    corGradiente: "from-amber-100 to-stone-50",
    bordaAtiva: "border-amber-400 ring-2 ring-amber-400/40 shadow-lg",
  },
  {
    id: "vencedor",
    emoji: "🏆",
    titulo: "Imparável!",
    subtitulo: "Pronto para conquistar qualquer desafio",
    corGradiente: "from-yellow-100 to-amber-50",
    bordaAtiva: "border-yellow-400 ring-2 ring-yellow-400/40 shadow-lg",
  },
  {
    id: "gratidao",
    emoji: "✨",
    titulo: "Gratidão!",
    subtitulo: "Mais uma oportunidade de brilhar hoje",
    corGradiente: "from-purple-100 to-indigo-50",
    bordaAtiva: "border-purple-400 ring-2 ring-purple-400/40 shadow-lg",
  },
  {
    id: "zen",
    emoji: "🧘",
    titulo: "Equilíbrio",
    subtitulo: "Calma, serenidade e foco no processo",
    corGradiente: "from-teal-100 to-emerald-50",
    bordaAtiva: "border-teal-400 ring-2 ring-teal-400/40 shadow-lg",
  },
  {
    id: "inspirado",
    emoji: "💡",
    titulo: "Cheio de Ideias",
    subtitulo: "Mente criativa e muitas soluções na cabeça",
    corGradiente: "from-sky-100 to-cyan-50",
    bordaAtiva: "border-sky-400 ring-2 ring-sky-400/40 shadow-lg",
  },
  {
    id: "cafe",
    emoji: "☕",
    titulo: "Na base do Café",
    subtitulo: "Acordando aos poucos, mas pronto pro jogo",
    corGradiente: "from-amber-100 to-yellow-50",
    bordaAtiva: "border-amber-400 ring-2 ring-amber-400/40 shadow-lg",
  },
  {
    id: "superacao",
    emoji: "💪",
    titulo: "Superação!",
    subtitulo: "Nada vai me parar hoje, foco na vitória",
    corGradiente: "from-red-100 to-orange-50",
    bordaAtiva: "border-red-400 ring-2 ring-red-400/40 shadow-lg",
  },
  {
    id: "sorriso",
    emoji: "🌟",
    titulo: "Alto Astral!",
    subtitulo: "Espalhando simpatia e bom humor a todos",
    corGradiente: "from-yellow-100 to-amber-50",
    bordaAtiva: "border-yellow-400 ring-2 ring-yellow-400/40 shadow-lg",
  },
  {
    id: "coragem",
    emoji: "🔥",
    titulo: "Chama Acesa!",
    subtitulo: "Vontade de crescer e entregar o melhor",
    corGradiente: "from-orange-100 to-red-50",
    bordaAtiva: "border-orange-400 ring-2 ring-orange-400/40 shadow-lg",
  },
  {
    id: "resiliencia",
    emoji: "🛡️",
    titulo: "Firme e Forte",
    subtitulo: "Pronto para qualquer desafio que vier",
    corGradiente: "from-slate-200 to-slate-100",
    bordaAtiva: "border-slate-500 ring-2 ring-slate-400/40 shadow-lg",
  },
]

interface ModalCheckinHumorProps {
  nome: string
  onConfirmar?: (humor: string, humorNome: string) => void
  onFechar: () => void
  duracaoSegundos?: number
}

export function ModalCheckinHumor({ nome, onConfirmar, onFechar, duracaoSegundos = 15 }: ModalCheckinHumorProps) {
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [tempoRestante, setTempoRestante] = useState(duracaoSegundos)

  const primeiroNome = nome ? nome.split(" ")[0] : "Colaborador"

  // Sorteia 5 opções aleatórias do banco de 15 opções a cada exibição
  const opcoesExibidas = useMemo(() => {
    const embaralhado = [...BANCO_OPCOES_HUMOR].sort(() => Math.random() - 0.5)
    return embaralhado.slice(0, 5)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setTempoRestante((t) => {
        if (t <= 1) {
          clearInterval(timer)
          onFechar()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onFechar])

  const handleEscolher = async (opcao: OpcaoHumorCompleta) => {
    if (selecionado) return // Evita duplo clique
    setSelecionado(opcao.id)
    if (onConfirmar) onConfirmar(opcao.id, opcao.titulo)

    try {
      const resp = await obterSaudacaoInteligente({
        nome: nome || "Colaborador",
        tipoPonto: "Entrada",
        dataHora: new Date(),
        humor: opcao.id,
      })
      if (resp?.voz) {
        reproduzirVozSaudacao(resp.voz)
      }
    } catch {
      const falaFallback = `Excelente dia, ${primeiroNome}! Um ótimo turno de trabalho pra você!`
      reproduzirVozSaudacao(falaFallback)
    }

    // Aguarda o emoji subir suavemente e a voz iniciar antes de fechar
    setTimeout(() => {
      onFechar()
    }, 2800)
  }

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen select-none overflow-hidden transition-all duration-500 bg-slate-100 flex items-center justify-center">
      {/* 1. LUZES AMBIENTES NO FUNDO */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 right-0 w-[550px] h-[550px] rounded-full bg-[#f59e0b] blur-[140px] opacity-25 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[450px] h-[450px] rounded-full bg-[#14b8a6] blur-[130px] opacity-20" />
        <div className="absolute top-1/3 left-1/3 w-[380px] h-[380px] rounded-full bg-[#3b82f6] blur-[120px] opacity-15" />
      </div>

      {/* 2. SUPERFÍCIE GLASSMORPHISM LIGHT DE TELA INTEIRA */}
      <div className="absolute inset-0 w-full h-full backdrop-blur-[40px] bg-white/65 border-none flex flex-col justify-between p-4 sm:p-8 lg:p-10 transition-all duration-500">
        {/* TOPO: Logo e Indicador de Tempo */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto shrink-0">
          <Image src="/logo.png" alt="Logo" width={140} height={70} priority style={{ height: "auto" }} />
          <span className="text-xs text-slate-500 font-semibold bg-white/80 border border-slate-200 px-3 py-1 rounded-md shadow-xs">
            Tempo: {tempoRestante}s
          </span>
        </div>

        {/* ÁREA CENTRAL: Pergunta e Cards dos Emojis */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full px-2 my-auto">
          {/* Título e Subtítulo Limpos */}
          <div className={`space-y-1.5 text-center md:text-left mb-6 transition-all duration-500 ${selecionado ? "opacity-30" : "opacity-100"}`}>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
              Como você está se sentindo hoje, <span style={{ color: "#c69e6b" }}>{primeiroNome}</span>?
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-medium">
              Selecione seu humor para começar seu turno com a melhor energia!
            </p>
          </div>

          {/* Grid dos 5 Cards de Humor com Bordas Quadradas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 relative">
            {opcoesExibidas.map((opcao) => {
              const isAtivo = selecionado === opcao.id
              const outroSelecionado = selecionado !== null && !isAtivo

              return (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => handleEscolher(opcao)}
                  disabled={selecionado !== null}
                  className={`p-4 sm:p-5 rounded-lg text-left flex flex-col justify-between h-44 sm:h-52 relative border cursor-pointer group transition-all duration-500 ${
                    isAtivo
                      ? `bg-gradient-to-b ${opcao.corGradiente} ${opcao.bordaAtiva} z-30 scale-105 shadow-md`
                      : outroSelecionado
                      ? "opacity-25 scale-95 blur-[0.5px] pointer-events-none"
                      : "bg-white/90 hover:bg-white border-slate-200/90 hover:border-amber-400 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95"
                  }`}
                >
                  {/* Ícone Emoji — Sobe suavemente ao ser selecionado */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-4xl sm:text-5xl transition-all duration-500 inline-block ${
                        isAtivo
                          ? "scale-[1.6] -translate-y-6 sm:-translate-y-7 animate-bounce"
                          : "group-hover:scale-115"
                      }`}
                      style={isAtivo ? { animationDuration: "1.4s" } : undefined}
                    >
                      {opcao.emoji}
                    </span>
                    {isAtivo && (
                      <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[#c69e6b] text-white text-xs font-bold shadow-xs animate-in zoom-in duration-300">
                        ✓
                      </span>
                    )}
                  </div>

                  <div className={`space-y-1 transition-all duration-500 ${isAtivo ? "opacity-100" : ""}`}>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight group-hover:text-[#a67c4e] transition-colors">
                      {opcao.titulo}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-snug line-clamp-2">
                      {opcao.subtitulo}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* RODAPÉ: Botão de Pular */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto pt-2 shrink-0">
          <button
            type="button"
            onClick={onFechar}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <span>Pular</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <span className="text-xs text-slate-500">Toque em qualquer opção para registrar</span>
        </div>
      </div>

      {/* 3. ONDA LUMINOSA SUAVE NA BORDA BOTTOM ENQUANTO A VOZ FALA */}
      <AnimacaoVozIa />
    </div>
  )
}
