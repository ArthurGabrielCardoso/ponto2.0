"use client"

import React, { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Sparkles, ArrowRight } from "lucide-react"
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
    corGradiente: "from-amber-500/30 to-yellow-600/20",
    bordaAtiva: "border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.7)]",
  },
  {
    id: "excelente",
    emoji: "😄",
    titulo: "Excelente!",
    subtitulo: "Radiante, feliz e em paz com a vida",
    corGradiente: "from-emerald-500/30 to-teal-600/20",
    bordaAtiva: "border-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.7)]",
  },
  {
    id: "energia",
    emoji: "⚡",
    titulo: "100% Energia!",
    subtitulo: "Foco total para bater todas as metas",
    corGradiente: "from-cyan-500/30 to-blue-600/20",
    bordaAtiva: "border-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.7)]",
  },
  {
    id: "leao",
    emoji: "🦁",
    titulo: "Modo Fera!",
    subtitulo: "Garra, determinação e foco absoluto",
    corGradiente: "from-orange-500/30 to-amber-600/20",
    bordaAtiva: "border-orange-300 shadow-[0_0_30px_rgba(251,146,60,0.7)]",
  },
  {
    id: "foco",
    emoji: "🎯",
    titulo: "Foco Total!",
    subtitulo: "Concentração máxima e muita produtividade",
    corGradiente: "from-rose-500/30 to-red-600/20",
    bordaAtiva: "border-rose-300 shadow-[0_0_30px_rgba(244,63,94,0.7)]",
  },
  {
    id: "bem",
    emoji: "🙂",
    titulo: "Tudo bem!",
    subtitulo: "Tranquilidade, foco e muita dedicação",
    corGradiente: "from-blue-500/30 to-indigo-600/20",
    bordaAtiva: "border-blue-300 shadow-[0_0_30px_rgba(96,165,250,0.7)]",
  },
  {
    id: "cafe",
    emoji: "☕",
    titulo: "Preciso de café!",
    subtitulo: "Aquele cafezinho reforçado pra dar o gás",
    corGradiente: "from-amber-600/30 to-yellow-800/20",
    bordaAtiva: "border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.7)]",
  },
  {
    id: "almoco",
    emoji: "🥪",
    titulo: "Pensando no rango!",
    subtitulo: "Contando os minutos pro almoço gostoso",
    corGradiente: "from-yellow-500/30 to-orange-600/20",
    bordaAtiva: "border-yellow-300 shadow-[0_0_30px_rgba(253,224,71,0.7)]",
  },
  {
    id: "zen",
    emoji: "🧘",
    titulo: "Modo Zen!",
    subtitulo: "Paz de espírito, equilíbrio e serenidade",
    corGradiente: "from-teal-500/30 to-emerald-600/20",
    bordaAtiva: "border-teal-300 shadow-[0_0_30px_rgba(45,212,191,0.7)]",
  },
  {
    id: "brilhando",
    emoji: "🌟",
    titulo: "Radiante!",
    subtitulo: "Pronta pra brilhar em cada detalhe",
    corGradiente: "from-yellow-400/30 to-amber-500/20",
    bordaAtiva: "border-yellow-300 shadow-[0_0_30px_rgba(253,224,71,0.7)]",
  },
  {
    id: "sono",
    emoji: "😴",
    titulo: "Com soninho!",
    subtitulo: "No ritmo certo a energia vai voltando",
    corGradiente: "from-purple-500/30 to-pink-600/20",
    bordaAtiva: "border-purple-300 shadow-[0_0_30px_rgba(192,132,252,0.7)]",
  },
  {
    id: "recarregando",
    emoji: "🔋",
    titulo: "Recarregando!",
    subtitulo: "Bateria subindo a cada minuto do dia",
    corGradiente: "from-lime-500/30 to-emerald-600/20",
    bordaAtiva: "border-lime-300 shadow-[0_0_30px_rgba(163,230,53,0.7)]",
  },
  {
    id: "animadasso",
    emoji: "🥳",
    titulo: "Vibe lá em cima!",
    subtitulo: "Alegria contagiante e alto astral",
    corGradiente: "from-fuchsia-500/30 to-purple-600/20",
    bordaAtiva: "border-fuchsia-300 shadow-[0_0_30px_rgba(232,121,249,0.7)]",
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
  const [opcaoEscolhida, setOpcaoEscolhida] = useState<OpcaoHumorCompleta | null>(null)
  const [respostaVisual, setRespostaVisual] = useState<string | null>(null)
  const [tempoRestante, setTempoRestante] = useState(duracaoSegundos)
  const primeiroNome = (nome || "Colega").split(" ")[0]

  // Sorteia 5 opções variadas sempre que abrir para nunca ser repetitivo
  const opcoesExibidas = useMemo(() => {
    const embaralhado = [...BANCO_OPCOES_HUMOR].sort(() => 0.5 - Math.random())
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
    setOpcaoEscolhida(opcao)
    if (onConfirmar) onConfirmar(opcao.id, opcao.titulo)

    try {
      const resp = await obterSaudacaoInteligente({
        nome: nome || "Colaborador",
        tipoPonto: "Entrada",
        dataHora: new Date(),
        humor: opcao.id,
      })
      if (resp?.voz) {
        setRespostaVisual(resp.visual)
        reproduzirVozSaudacao(resp.voz)
      }
    } catch {
      const falaFallback = `Excelente dia, ${primeiroNome}! Um ótimo turno de trabalho pra você!`
      setRespostaVisual(`Excelente dia, ${primeiroNome}!`)
      reproduzirVozSaudacao(falaFallback)
    }

    // Aguarda o emoji subir suavemente e a voz iniciar antes de fechar
    setTimeout(() => {
      onFechar()
    }, 3200)
  }

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen select-none overflow-hidden transition-all duration-700 bg-[#070b14] flex items-center justify-center">
      {/* 1. LUZES AMBIENTES NO FUNDO */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 right-0 w-[550px] h-[550px] rounded-full bg-[#c69e6b] blur-[140px] opacity-60 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[450px] h-[450px] rounded-full bg-[#14b8a6] blur-[130px] opacity-50" />
        <div className="absolute top-1/3 left-1/3 w-[380px] h-[380px] rounded-full bg-[#3b82f6] blur-[120px] opacity-35" />
      </div>

      {/* 2. SUPERFÍCIE GLASSMORPHISM DE TELA INTEIRA */}
      <div className="absolute inset-0 w-full h-full backdrop-blur-[60px] backdrop-saturate-[180%] bg-slate-950/50 border-none flex flex-col justify-between p-4 sm:p-8 lg:p-10 transition-all duration-700">
        {/* TOPO: Logo limpa e Indicador de Tempo */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto shrink-0">
          <Image src="/logo.png" alt="Logo" width={140} height={70} priority style={{ height: "auto" }} />
          <span className="text-xs text-white/60 font-medium">Tempo: {tempoRestante}s</span>
        </div>

        {/* ÁREA CENTRAL: Pergunta e Cards dos Emojis */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full px-2 my-auto">
          {/* Título e Subtítulo Limpos (Sem menção a robô/assistente) */}
          <div className={`space-y-1.5 text-center md:text-left mb-6 transition-all duration-500 ${selecionado ? "opacity-30" : "opacity-100"}`}>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white drop-shadow-sm">
              Como você está se sentindo hoje, <span style={{ color: "#c69e6b" }}>{primeiroNome}</span>?
            </h1>
            <p className="text-sm sm:text-base text-white/80 font-medium">
              Selecione seu humor para começar seu turno com a melhor energia!
            </p>
          </div>

          {/* Grid dos 5 Cards de Humor */}
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
                  className={`p-4 sm:p-5 rounded-2xl text-left flex flex-col justify-between h-44 sm:h-52 relative backdrop-blur-2xl border cursor-pointer group transition-all duration-700 ${
                    isAtivo
                      ? `bg-gradient-to-b ${opcao.corGradiente} ${opcao.bordaAtiva} z-30 scale-105 shadow-2xl`
                      : outroSelecionado
                      ? "opacity-20 scale-90 blur-[1px] pointer-events-none"
                      : "bg-white/[0.08] hover:bg-white/[0.14] border-white/20 hover:border-amber-300/60 shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-95"
                  }`}
                >
                  {/* Ícone Emoji — Sobe e flutua suavemente ao ser selecionado */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-4xl sm:text-5xl transition-all duration-700 filter drop-shadow inline-block ${
                        isAtivo
                          ? "scale-[1.8] -translate-y-6 sm:-translate-y-8 animate-bounce"
                          : "group-hover:scale-125"
                      }`}
                      style={isAtivo ? { animationDuration: "1.5s" } : undefined}
                    >
                      {opcao.emoji}
                    </span>
                    {isAtivo && (
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-950 text-xs font-bold shadow-md animate-in zoom-in duration-300">
                        ✓
                      </span>
                    )}
                  </div>

                  <div className={`space-y-1 transition-all duration-500 ${isAtivo ? "opacity-100" : ""}`}>
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

          {/* Confirmação e Saudação Elegante após a subida do emoji */}
          {opcaoEscolhida && (
            <div className="mt-8 text-center space-y-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <span className="text-sm sm:text-base font-bold text-amber-300 drop-shadow">
                {respostaVisual || `Excelente dia, ${primeiroNome}!`}
              </span>
              <p className="text-xs text-white/70">Registrando seu ponto e ajustando a melhor energia...</p>
            </div>
          )}
        </div>

        {/* RODAPÉ: Botão de Pular Limpo */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto pt-2 shrink-0">
          <button
            type="button"
            onClick={onFechar}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all cursor-pointer active:scale-95"
          >
            <span>Pular</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <span className="text-xs text-white/50">Toque em qualquer opção para registrar</span>
        </div>
      </div>

      {/* 3. ONDA LUMINOSA AZUL NA BORDA BOTTOM ENQUANTO A VOZ ESTIVER FALANDO */}
      <AnimacaoVozIa />
    </div>
  )
}
