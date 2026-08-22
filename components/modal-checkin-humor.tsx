"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { Sparkles, Heart, ArrowRight, X, Bot } from "lucide-react"
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

export const OPCOES_HUMOR_DETALHADAS: OpcaoHumorCompleta[] = [
  {
    id: "animado",
    emoji: "🚀",
    titulo: "A todo vapor!",
    subtitulo: "Energia no topo, pronta pra fazer acontecer",
    corGradiente: "from-amber-500/30 to-yellow-600/20",
    bordaAtiva: "border-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.6)]",
  },
  {
    id: "excelente",
    emoji: "😄",
    titulo: "Excelente!",
    subtitulo: "Radiante, feliz e em paz com a vida",
    corGradiente: "from-emerald-500/30 to-teal-600/20",
    bordaAtiva: "border-emerald-300 shadow-[0_0_25px_rgba(52,211,153,0.6)]",
  },
  {
    id: "bem",
    emoji: "🙂",
    titulo: "Tudo bem!",
    subtitulo: "Tranquilidade, foco e muita dedicação",
    corGradiente: "from-blue-500/30 to-indigo-600/20",
    bordaAtiva: "border-blue-300 shadow-[0_0_25px_rgba(96,165,250,0.6)]",
  },
  {
    id: "cafe",
    emoji: "☕",
    titulo: "Preciso de café!",
    subtitulo: "Aquele cafezinho reforçado pra dar o gás",
    corGradiente: "from-orange-500/30 to-amber-700/20",
    bordaAtiva: "border-orange-300 shadow-[0_0_25px_rgba(251,146,60,0.6)]",
  },
  {
    id: "sono",
    emoji: "😴",
    titulo: "Com soninho!",
    subtitulo: "No ritmo certo a energia vai voltando",
    corGradiente: "from-purple-500/30 to-pink-600/20",
    bordaAtiva: "border-purple-300 shadow-[0_0_25px_rgba(192,132,252,0.6)]",
  },
]

interface ModalCheckinHumorProps {
  nome: string
  onConfirmar?: (humorId: string, label: string) => void
  onFechar: () => void
  duracaoSegundos?: number
}

export function ModalCheckinHumor({
  nome,
  onConfirmar,
  onFechar,
  duracaoSegundos = 15,
}: ModalCheckinHumorProps) {
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [respostaIaTexto, setRespostaIaTexto] = useState<string | null>(null)
  const [tempoRestante, setTempoRestante] = useState(duracaoSegundos)
  const primeiroNome = (nome || "Colega").split(" ")[0]

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
        setRespostaIaTexto(resp.voz)
        reproduzirVozSaudacao(resp.voz)
      }
    } catch {
      const falaFallback = `Que ótimo, ${primeiroNome}! Excelente jornada de trabalho e vamo que vamo!`
      setRespostaIaTexto(falaFallback)
      reproduzirVozSaudacao(falaFallback)
    }

    // Deixa tocar a voz e fecha após 4.5 segundos
    setTimeout(() => {
      onFechar()
    }, 4500)
  }

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen select-none overflow-hidden transition-all duration-700 bg-[#070b14] flex items-center justify-center">
      {/* 1. CAMADA DE LUZES / ESFERAS AMBIENTES NO FUNDO */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 right-0 w-[550px] h-[550px] rounded-full bg-[#c69e6b] blur-[130px] opacity-65 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[450px] h-[450px] rounded-full bg-[#14b8a6] blur-[120px] opacity-55" />
        <div className="absolute top-1/3 left-1/3 w-[380px] h-[380px] rounded-full bg-[#3b82f6] blur-[110px] opacity-40" />
      </div>

      {/* 2. SUPERFÍCIE DE GLASSMORPHISM DE TELA INTEIRA (100% LARGURA/ALTURA, SEM BORDAS) */}
      <div className="absolute inset-0 w-full h-full backdrop-blur-[60px] backdrop-saturate-[180%] bg-slate-950/50 border-none flex flex-col justify-between p-4 sm:p-8 lg:p-10 transition-all duration-700">
        {/* TOPO: Logo limpa, Badge de Status e Timer */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto shrink-0">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={140} height={70} priority style={{ height: "auto" }} />
            <div className="hidden sm:block h-6 w-px bg-white/20" />
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-md backdrop-blur-md border text-amber-300 bg-amber-400/15 border-amber-400/30">
              <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "4s" }} />
              <span>Check-in de Energia & Humor</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <AnimacaoVozIa variante="badge" />
            <span className="text-xs text-white/70 font-medium">Auto-retorno: {tempoRestante}s</span>
          </div>
        </div>

        {/* ÁREA CENTRAL: Cards dos 5 Emojis no Padrão de Ponto Batido */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full px-2 my-auto">
          {/* Saudação e Pergunta de Entrada */}
          <div className="space-y-1 text-center md:text-left mb-6">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white drop-shadow-sm">
              Como está sua energia hoje, <span style={{ color: "#c69e6b" }}>{primeiroNome}</span>?
            </h1>
            <p className="text-sm sm:text-base text-white/80 font-medium">
              Conte para a sua assistente e receba uma mensagem especial da IA para turbinar seu dia!
            </p>
          </div>

          {/* Grid dos 5 Grandes Cards nobres com Glassmorphism */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {OPCOES_HUMOR_DETALHADAS.map((opcao) => {
              const isAtivo = selecionado === opcao.id
              return (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => handleEscolher(opcao)}
                  className={`p-4 sm:p-5 rounded-2xl text-left transition-all duration-300 flex flex-col justify-between h-44 sm:h-52 relative backdrop-blur-2xl border cursor-pointer group active:scale-95 ${
                    isAtivo
                      ? `bg-gradient-to-b ${opcao.corGradiente} ${opcao.bordaAtiva} scale-105`
                      : "bg-white/[0.08] hover:bg-white/[0.14] border-white/20 hover:border-amber-300/60 shadow-lg hover:shadow-2xl"
                  }`}
                >
                  {/* Ícone e Badge */}
                  <div className="flex items-center justify-between w-full">
                    <span className="text-4xl sm:text-5xl transition-transform duration-300 group-hover:scale-125 filter drop-shadow">
                      {opcao.emoji}
                    </span>
                    {isAtivo && (
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-950 text-xs font-bold shadow-md">
                        ✓
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight group-hover:text-amber-200 transition-colors">
                      {opcao.titulo}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-white/70 leading-snug line-clamp-2">
                      {opcao.subtitulo}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Resposta Falada da IA em Destaque */}
          {respostaIaTexto && (
            <div className="mt-6 p-4 rounded-2xl bg-amber-500/20 backdrop-blur-xl border border-amber-300/40 shadow-xl flex items-center justify-between gap-4 max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-3 duration-400">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-400/30 flex items-center justify-center shrink-0 border border-amber-300">
                  <Bot className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300 block">Resposta da Assistente IA</span>
                  <p className="text-sm sm:text-base font-semibold text-white tracking-tight leading-snug">
                    "{respostaIaTexto}"
                  </p>
                </div>
              </div>
              <AnimacaoVozIa variante="ondas" />
            </div>
          )}
        </div>

        {/* RODAPÉ: Botão de Pular / Voltar */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto pt-2 shrink-0">
          <button
            type="button"
            onClick={onFechar}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all cursor-pointer active:scale-95"
          >
            <span>Pular e ir para a tela de ponto</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <span className="text-xs text-white/50">Toque em qualquer opção para ouvir a IA</span>
        </div>
      </div>
    </div>
  )
}
