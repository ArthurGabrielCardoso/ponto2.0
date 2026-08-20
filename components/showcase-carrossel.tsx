"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Volume2, LayoutDashboard } from "lucide-react"
import { reproduzirVozSaudacao } from "@/lib/tts-audio"
import { DialogoPontoInteligente } from "@/components/dialogo-ponto-inteligente"
import { TelaPontoSucesso } from "@/components/tela-ponto-sucesso"
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
      mensagem: "Excelente noite, Arthur!",
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

  const falarSlideAtual = useCallback(() => {
    setFalando(true)
    reproduzirVozSaudacao(current.vozTexto)
    setTimeout(() => setFalando(false), 4000)
  }, [current.vozTexto])

  useEffect(() => {
    falarSlideAtual()
    setTempoRestante(15)
  }, [slideAtual, falarSlideAtual])

  // Temporizador de 15 segundos para avançar automaticamente
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

  // Gestos de Swipe
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

  const handleScreenClick = (e: React.MouseEvent) => {
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
      {/* BARRA SUPERIOR FLUTUANTE DE CONTROLE E PROGRESSO */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-auto">
        <div className="w-full h-1.5 bg-gray-200/80 overflow-hidden">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${(tempoRestante / 15) * 100}%`,
              background: "linear-gradient(90deg, #c69e6b 0%, #1db9b3 100%)",
            }}
          />
        </div>

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

      {/* CONTEÚDO DO SLIDE */}
      <div className="w-full h-full pt-10">
        {current.tipo === "ponto_batido" && current.dadosPonto && (
          <TelaPontoSucesso
            key={current.id}
            nome={current.dadosPonto.nome}
            tipo={current.dadosPonto.tipo}
            hora={current.dadosPonto.hora}
            data={current.dadosPonto.data}
            mensagem={current.dadosPonto.mensagem}
            durationMs={15000}
            onVoltar={() => setSlideAtual((prev) => (prev + 1) % totalSlides)}
            modoDemonstracao={true}
          />
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
