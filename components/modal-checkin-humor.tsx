"use client"

import React, { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { AnimacaoVozIa } from "@/components/animacao-voz-ia"
import { EmojisFlutuantes } from "@/components/emojis-flutuantes"
import { OlhosRobo, type HumorOlhos } from "@/components/olhos-robo"
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
    id: "tranquilo",
    emoji: "☕",
    titulo: "Paz & Café",
    subtitulo: "Dia sereno, mente leve e passos firmes",
    corGradiente: "from-amber-600/30 to-stone-600/20",
    bordaAtiva: "border-amber-300 shadow-[0_0_30px_rgba(217,119,6,0.7)]",
  },
  {
    id: "vencedor",
    emoji: "🏆",
    titulo: "Imparável!",
    subtitulo: "Pronto para conquistar qualquer desafio",
    corGradiente: "from-yellow-500/30 to-amber-600/20",
    bordaAtiva: "border-yellow-300 shadow-[0_0_30px_rgba(234,179,8,0.7)]",
  },
  {
    id: "gratidao",
    emoji: "✨",
    titulo: "Gratidão!",
    subtitulo: "Mais uma oportunidade de brilhar hoje",
    corGradiente: "from-purple-500/30 to-indigo-600/20",
    bordaAtiva: "border-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.7)]",
  },
  {
    id: "zen",
    emoji: "🧘",
    titulo: "Equilíbrio",
    subtitulo: "Calma, serenidade e foco no processo",
    corGradiente: "from-teal-500/30 to-emerald-600/20",
    bordaAtiva: "border-teal-300 shadow-[0_0_30px_rgba(20,184,166,0.7)]",
  },
  {
    id: "inspirado",
    emoji: "💡",
    titulo: "Cheio de Ideias",
    subtitulo: "Mente criativa e muitas soluções na cabeça",
    corGradiente: "from-sky-500/30 to-cyan-600/20",
    bordaAtiva: "border-sky-300 shadow-[0_0_30px_rgba(14,165,233,0.7)]",
  },
  {
    id: "cafe",
    emoji: "☕",
    titulo: "Na base do Café",
    subtitulo: "Acordando aos poucos, mas pronto pro jogo",
    corGradiente: "from-amber-700/30 to-yellow-600/20",
    bordaAtiva: "border-amber-400 shadow-[0_0_30px_rgba(180,83,9,0.7)]",
  },
  {
    id: "superacao",
    emoji: "💪",
    titulo: "Superação!",
    subtitulo: "Nada vai me parar hoje, foco na vitória",
    corGradiente: "from-red-500/30 to-orange-600/20",
    bordaAtiva: "border-red-300 shadow-[0_0_30px_rgba(239,68,68,0.7)]",
  },
  {
    id: "sorriso",
    emoji: "🌟",
    titulo: "Alto Astral!",
    subtitulo: "Espalhando simpatia e bom humor a todos",
    corGradiente: "from-yellow-400/30 to-amber-500/20",
    bordaAtiva: "border-yellow-200 shadow-[0_0_30px_rgba(250,204,21,0.7)]",
  },
  {
    id: "coragem",
    emoji: "🔥",
    titulo: "Chama Acesa!",
    subtitulo: "Vontade de crescer e entregar o melhor",
    corGradiente: "from-orange-600/30 to-red-600/20",
    bordaAtiva: "border-orange-400 shadow-[0_0_30px_rgba(234,88,12,0.7)]",
  },
  {
    id: "resiliencia",
    emoji: "🛡️",
    titulo: "Firme e Forte",
    subtitulo: "Pronto para qualquer desafio que vier",
    corGradiente: "from-slate-600/30 to-zinc-700/20",
    bordaAtiva: "border-slate-300 shadow-[0_0_30px_rgba(203,213,225,0.7)]",
  },
]

interface ModalCheckinHumorProps {
  nome: string
  onConfirmar?: (humor: string, humorNome: string) => void
  onFechar: () => void
  duracaoSegundos?: number
}

export function ModalCheckinHumor({
  nome,
  onConfirmar,
  onFechar,
  // Dois minutos: tempo de a pessoa ler, pensar e escolher sem a tela sumir
  // debaixo do dedo dela.
  duracaoSegundos = 120,
}: ModalCheckinHumorProps) {
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [emojiEscolhido, setEmojiEscolhido] = useState<string>("")
  const [tempoRestante, setTempoRestante] = useState(duracaoSegundos)
  const primeiroNome = (nome || "Colega").split(" ")[0]

  // Cada opção do banco vira uma cara. Sem escolha, os olhos ficam neutros e
  // curiosos, olhando em volta enquanto esperam.
  const humorDosOlhos: HumorOlhos = !selecionado
    ? "padrao"
    : selecionado === "cafe"
    ? "cansado"
    : ["leao", "foco", "superacao", "coragem", "resiliencia"].includes(selecionado)
    ? "bravo" // olhar de determinação, não de raiva: é o "modo fera" da opção
    : "feliz"

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
    setEmojiEscolhido(opcao.emoji)
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
        {/* O rodapé foi todo para cá: a faixa do topo estava vazia à direita da
            logo, e o espaço que ele ocupava embaixo era o que faltava para os
            cards respirarem. */}
        <div className="relative z-10 flex items-center justify-between gap-4 w-full max-w-5xl mx-auto shrink-0">
          <Image src="/logo.png" alt="Logo" width={140} height={70} priority style={{ height: "auto" }} />

          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden text-xs text-white/50 sm:inline">
              Toque em qualquer opção para registrar
            </span>
            <span className="text-xs font-medium text-white/60">
              {`${Math.floor(tempoRestante / 60)}:${String(tempoRestante % 60).padStart(2, "0")}`}
            </span>
            <button
              type="button"
              onClick={onFechar}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition-all hover:bg-white/20 hover:text-white active:scale-95 sm:text-sm"
            >
              <span>Pular</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ÁREA CENTRAL: Pergunta e Cards dos Emojis */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full px-2 my-auto">
          {/* Olhos da IA espelhando o humor escolhido — é a tela onde eles
              mais fazem sentido: a pergunta é sobre como a pessoa está. */}
          <div className="mb-5 flex justify-center md:justify-start">
            <OlhosRobo
              humor={humorDosOlhos}
              largura={150}
              cor="#c69e6b"
              ocioso={!selecionado}
              piscar
              reagirAVoz
            />
          </div>

          {/* Título e Subtítulo Limpos */}
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
        </div>


      </div>

      {/* 3. EMOJI DA OPÇÃO ESCOLHIDA SUBINDO ENQUANTO A IA RESPONDE */}
      <EmojisFlutuantes texto={emojiEscolhido} quantidade={10} />

      {/* 4. ONDA LUMINOSA AZUL NA BORDA BOTTOM ENQUANTO A VOZ ESTIVER FALANDO */}
      <AnimacaoVozIa />
    </div>
  )
}
