"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Volume2, Sparkles, RefreshCw, LayoutDashboard } from "lucide-react"
import { reproduzirVozSaudacao } from "@/lib/tts-audio"
import { DialogoPontoInteligente } from "@/components/dialogo-ponto-inteligente"
import type { DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"

interface SlideItem {
  id: string
  titulo: string
  categoria: string
  vozTexto: string
  tipo: "ponto_batido" | "dialogo"
  dadosPonto?: {
    nome: string
    tipo: string
    hora: string
    data: string
    mensagem: string
    gradiente: string
    icone: string
    fraseDireita: string
  }
  dadosDialogo?: {
    nome: string
    diagnostico: DiagnosticoPonto
  }
}

const SLIDES: SlideItem[] = [
  {
    id: "entrada",
    titulo: "Ponto Batido: Entrada",
    categoria: "Design Ponto Registrado",
    vozTexto: "Excelente dia, Arthur! Tenha um ótimo e produtivo dia de trabalho!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Arthur Gabriel",
      tipo: "Entrada",
      hora: "08:02:15",
      data: "20/08/2026",
      mensagem: "Excelente dia, Arthur!",
      gradiente: "linear-gradient(135deg, #c69e6b 0%, #b88d57 50%, #8c5e28 100%)",
      icone: "🌤️",
      fraseDireita: "Tenha um excelente e produtivo dia de trabalho!",
    },
  },
  {
    id: "saida_almoco",
    titulo: "Ponto Batido: Saída Almoço",
    categoria: "Design Ponto Registrado",
    vozTexto: "Excelente almoço, Arthur! Aproveite seu almoço e bom descanso!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Arthur Gabriel",
      tipo: "Saída Almoço",
      hora: "12:04:30",
      data: "20/08/2026",
      mensagem: "Excelente almoço, Arthur!",
      gradiente: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #9a3412 100%)",
      icone: "🍽️",
      fraseDireita: "Aproveite seu almoço e tenha um ótimo descanso!",
    },
  },
  {
    id: "retorno_almoco",
    titulo: "Ponto Batido: Retorno Almoço",
    categoria: "Design Ponto Registrado",
    vozTexto: "Excelente retorno ao trabalho, Arthur! Bom trabalho nesta tarde!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Arthur Gabriel",
      tipo: "Retorno Almoço",
      hora: "13:05:42",
      data: "20/08/2026",
      mensagem: "Excelente retorno ao trabalho, Arthur!",
      gradiente: "linear-gradient(135deg, #1db9b3 0%, #16918d 50%, #0d8488 100%)",
      icone: "💼",
      fraseDireita: "Excelente retorno ao trabalho! Vamos em frente!",
    },
  },
  {
    id: "saida_fim",
    titulo: "Ponto Batido: Saída Fim de Expediente",
    categoria: "Design Ponto Registrado",
    vozTexto: "Excelente noite e bom descanso, Arthur! Dever cumprido, até amanhã!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Arthur Gabriel",
      tipo: "Saída",
      hora: "18:01:10",
      data: "20/08/2026",
      mensagem: "Excelente noite e bom descanso, Arthur!",
      gradiente: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
      icone: "🌙",
      fraseDireita: "Dever cumprido! Descanse bem e até amanhã!",
    },
  },
  {
    id: "diag_entrada",
    titulo: "Verificação: Esqueceu Entrada da Manhã",
    categoria: "Diálogo Inteligente",
    vozTexto: "Olá, Arthur! Notamos que você ainda não registrou sua entrada hoje. Você está entrando agora ou saindo para o almoço?",
    tipo: "dialogo",
    dadosDialogo: {
      nome: "Arthur Gabriel",
      diagnostico: {
        tipo: "PERGUNTA_ENTRADA_OU_ALMOCO",
        horariosGrade: { entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "13:00", saida: "18:00" },
        registrosHoje: [],
        proximoTipoSugerido: "Entrada",
        horariosSugeridos: { horaChegada: "08:00" },
      },
    },
  },
  {
    id: "diag_almoco",
    titulo: "Verificação: Esqueceu Almoço",
    categoria: "Diálogo Inteligente",
    vozTexto: "Olá, Arthur! Você não registrou o almoço hoje. Você está saindo para o almoço agora ou encerrando seu expediente?",
    tipo: "dialogo",
    dadosDialogo: {
      nome: "Arthur Gabriel",
      diagnostico: {
        tipo: "PERGUNTA_ALMOCO_OU_SAIDA",
        horariosGrade: { entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "13:00", saida: "18:00" },
        registrosHoje: [{ id: "1", funcionario_id: "1", nome_funcionario: "Arthur Gabriel", data_hora: new Date().toISOString(), tipo: "Entrada", created_at: new Date().toISOString() }],
        proximoTipoSugerido: "Saída Almoço",
        horariosSugeridos: { horaSaidaAlmoco: "12:00" },
      },
    },
  },
  {
    id: "diag_retorno",
    titulo: "Verificação: Esqueceu Retorno do Almoço (Caso Jéssica)",
    categoria: "Diálogo Inteligente",
    vozTexto: "Olá, Jéssica! Parece que você esqueceu de registrar o retorno do seu almoço. Que horas você voltou?",
    tipo: "dialogo",
    dadosDialogo: {
      nome: "Jéssica Ferreira",
      diagnostico: {
        tipo: "PERGUNTA_RETORNO_OU_SAIDA",
        horariosGrade: { entrada: "08:00", saidaAlmoco: "13:00", retornoAlmoco: "14:00", saida: "18:00" },
        registrosHoje: [
          { id: "1", funcionario_id: "2", nome_funcionario: "Jéssica Ferreira", data_hora: new Date().toISOString(), tipo: "Entrada", created_at: new Date().toISOString() },
          { id: "2", funcionario_id: "2", nome_funcionario: "Jéssica Ferreira", data_hora: new Date().toISOString(), tipo: "Saída Almoço", created_at: new Date().toISOString() },
        ],
        proximoTipoSugerido: "Saída",
        horariosSugeridos: { horaRetornoAlmoco: "14:00" },
      },
    },
  },
]

export function ShowcaseCarrossel() {
  const [slideAtual, setSlideAtual] = useState(0)
  const [tempoRestante, setTempoRestante] = useState(15)
  const [falando, setFalando] = useState(false)

  const touchStartXRef = useRef<number | null>(null)
  const mouseStartXRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)

  const totalSlides = SLIDES.length
  const current = SLIDES[slideAtual]

  // Falar o texto do slide atual
  const falarSlideAtual = useCallback(() => {
    setFalando(true)
    reproduzirVozSaudacao(current.vozTexto)
    setTimeout(() => setFalando(false), 4000)
  }, [current.vozTexto])

  // Tocar a voz ao mudar de slide
  useEffect(() => {
    falarSlideAtual()
    setTempoRestante(15)
  }, [slideAtual, falarSlideAtual])

  // Temporizador de rotação automática de 15 segundos para o próximo slide
  useEffect(() => {
    const timer = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          setSlideAtual((idx) => (idx + 1) % totalSlides)
          return 15
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [totalSlides])

  // Navegação por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setSlideAtual((prev) => (prev + 1) % totalSlides)
      } else if (e.key === "ArrowLeft") {
        setSlideAtual((prev) => (prev - 1 + totalSlides) % totalSlides)
      } else if (e.key === " " || e.key === "Enter") {
        falarSlideAtual()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [totalSlides, falarSlideAtual])

  // Gestos de Arrastar / Swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return
    const diff = touchStartXRef.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setSlideAtual((prev) => (prev + 1) % totalSlides)
      } else {
        setSlideAtual((prev) => (prev - 1 + totalSlides) % totalSlides)
      }
    }
    touchStartXRef.current = null
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStartXRef.current = e.clientX
    isDraggingRef.current = true
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || mouseStartXRef.current === null) return
    const diff = mouseStartXRef.current - e.clientX
    if (Math.abs(diff) > 60) {
      if (diff > 0) {
        setSlideAtual((prev) => (prev + 1) % totalSlides)
      } else {
        setSlideAtual((prev) => (prev - 1 + totalSlides) % totalSlides)
      }
    }
    isDraggingRef.current = false
    mouseStartXRef.current = null
  }

  // Ao clicar na tela, repete a voz
  const handleScreenClick = (e: React.MouseEvent) => {
    // Não aciona se clicou num botão ou link
    const target = e.target as HTMLElement
    if (target.closest("button") || target.closest("a") || target.closest("input")) return
    falarSlideAtual()
  }

  return (
    <div
      className="fixed inset-0 z-50 w-full h-full bg-white select-none overflow-hidden cursor-pointer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleScreenClick}
    >
      <style>{`
        @keyframes bounceBadge {
          0% { transform: scale(0.6) rotate(-10deg); opacity: 0; }
          50% { transform: scale(1.1) rotate(3deg); opacity: 1; }
          70% { transform: scale(0.96) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes pulseRing {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.18); opacity: 0.15; }
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .badge-pop { animation: bounceBadge 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .ring-pulse { animation: pulseRing 2.4s ease-in-out infinite; }
        .su-card { animation: fadeUp 0.5s ease-out 0.2s both; }
        .su-btn { animation: fadeUp 0.5s ease-out 0.35s both; }
      `}</style>

      {/* BARRA SUPERIOR FLUTUANTE DE CONTROLE E PROGRESSO */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-auto">
        {/* Barra de Progresso do Timer de 15s */}
        <div className="w-full h-1.5 bg-gray-200/80 overflow-hidden">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${(tempoRestante / 15) * 100}%`,
              background: "linear-gradient(90deg, #c69e6b 0%, #1db9b3 100%)",
            }}
          />
        </div>

        {/* Pílula de Navegação e Status */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3 bg-black/75 backdrop-blur-xl text-white shadow-lg border-b border-white/10 text-xs sm:text-sm">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors font-medium"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <span>{current.categoria}:</span>
              <span className="text-white font-bold">{current.titulo}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-block text-[11px] text-gray-300 mr-2">
              💡 Toque na tela para repetir a voz | Deslize para mudar ({tempoRestante}s)
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation()
                falarSlideAtual()
              }}
              className={`p-2 rounded-lg transition-colors ${falando ? "bg-amber-500 text-white animate-pulse" : "bg-white/15 hover:bg-white/25 text-white"}`}
              title="Repetir Voz"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                setSlideAtual((prev) => (prev - 1 + totalSlides) % totalSlides)
              }}
              className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
              title="Anterior"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <span className="font-mono text-xs px-2 font-bold text-amber-200">
              {slideAtual + 1} / {totalSlides}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation()
                setSlideAtual((prev) => (prev + 1) % totalSlides)
              }}
              className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
              title="Próximo"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* RENDERIZAÇÃO DO CONTEÚDO DO SLIDE */}
      <div className="w-full h-full pt-12">
        {current.tipo === "ponto_batido" && current.dadosPonto && (
          <div className="w-full h-full bg-white flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-300">
            {/* Lado Esquerdo */}
            <div className="w-full md:w-[58%] h-full flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative bg-gradient-to-b from-white via-amber-50/15 to-white overflow-y-auto pt-8">
              <div className="flex items-center justify-between">
                <Image src="/logo.png" alt="Logo" width={160} height={80} priority style={{ height: "auto" }} />
                <span className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Ponto Registrado
                </span>
              </div>

              <div className="my-auto max-w-lg mx-auto w-full text-center space-y-6 py-6">
                <div className="flex justify-center relative">
                  <div className="relative">
                    <div className="absolute -inset-3 rounded-full bg-emerald-400/20 ring-pulse blur-sm" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-xl badge-pop">
                      <svg className="w-12 h-12 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-lg">
                      {current.dadosPonto.icone}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight">
                    <span style={{ color: "#c69e6b" }}>{current.dadosPonto.mensagem}</span>
                  </h1>
                  <p className="text-sm text-gray-500 font-medium">Autenticação biométrica validada com sucesso</p>
                </div>

                <div className="su-card rounded-2xl p-5 bg-white border border-gray-100 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.06)] space-y-3.5 text-left">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">Tipo de Batida</span>
                    <span className="font-bold text-sm px-3.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80">
                      {current.dadosPonto.tipo}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block">Horário Registrado</span>
                      <span className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight font-mono">{current.dadosPonto.hora}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block">Data</span>
                      <span className="text-sm font-semibold text-gray-700">{current.dadosPonto.data}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 space-y-1.5">
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${(tempoRestante / 15) * 100}%`, background: "linear-gradient(90deg, #c69e6b 0%, #1db9b3 100%)" }} />
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium">Avançando para o próximo design em {tempoRestante}s...</p>
                </div>
              </div>

              <div className="su-btn flex items-center justify-between pt-4">
                <button
                  onClick={() => setSlideAtual((prev) => (prev + 1) % totalSlides)}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all shadow-md hover:shadow-lg"
                  style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
                >
                  Próximo Design
                </button>
                <span className="text-xs text-gray-400">Vitall Showcase</span>
              </div>
            </div>

            {/* Lado Direito */}
            <div className="hidden md:flex md:w-[42%] h-full flex-col items-center justify-center p-10 text-white text-center relative overflow-hidden" style={{ background: current.dadosPonto.gradiente }}>
              <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-black/10 blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-6 max-w-sm">
                <div className="p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl inline-block">
                  <Image src="/logo.png" alt="Logo" width={400} height={180} priority style={{ height: "auto" }} />
                </div>
                <p className="text-white/95 text-xl font-light leading-relaxed">{current.dadosPonto.fraseDireita}</p>
              </div>
            </div>
          </div>
        )}

        {current.tipo === "dialogo" && current.dadosDialogo && (
          <DialogoPontoInteligente
            key={current.id}
            nome={current.dadosDialogo.nome}
            diagnostico={current.dadosDialogo.diagnostico}
            onConfirmar={() => setSlideAtual((prev) => (prev + 1) % totalSlides)}
            onCancelar={() => setSlideAtual((prev) => (prev + 1) % totalSlides)}
            modoDemonstracao={true}
          />
        )}
      </div>
    </div>
  )
}
