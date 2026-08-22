"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Volume2,
  LayoutDashboard,
  Sparkles,
  Bot,
  RefreshCw,
  Zap,
  Play,
  Smile,
} from "lucide-react"
import { reproduzirVozSaudacao, useVozAtiva } from "@/lib/tts-audio"
import { DialogoPontoInteligente } from "@/components/dialogo-ponto-inteligente"
import { TelaPontoSucesso } from "@/components/tela-ponto-sucesso"
import { ModalCheckinHumor } from "@/components/modal-checkin-humor"
import { AnimacaoVozIa } from "@/components/animacao-voz-ia"
import { obterSaudacaoInteligente } from "@/lib/ia-saudacao"
import type { DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"

interface SlideItem {
  id: string
  titulo: string
  categoria: string
  icone: string
  vozTexto: string
  tipo: "sandbox_ia" | "checkin_humor" | "ponto_batido" | "dialogo"
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
    id: "sandbox_ia",
    titulo: "Laboratório IA Groq & Voz",
    categoria: "Motor Inteligente",
    icone: "🤖",
    vozTexto: "Excelente dia, Jé! Que alegria ter você aqui hoje! Vamos com tudo que seu turno vai ser maravilhoso!",
    tipo: "sandbox_ia",
  },
  {
    id: "checkin_humor",
    titulo: "Check-in de Humor & Energia",
    categoria: "Experiência Ponto Batido",
    icone: "🎭",
    vozTexto: "Olá Jéssica! Como está sua energia hoje? Toque em uma opção para receber uma resposta personalizada!",
    tipo: "checkin_humor",
    dadosPonto: {
      nome: "Jéssica Ferreira",
      tipo: "Entrada",
      hora: "08:00:00",
      data: "22/08/2026",
      mensagem: "Excelente dia, Jéssica!",
    },
  },
  {
    id: "saida_sextou",
    titulo: "Sextou! (Final de Semana)",
    categoria: "Design Ponto Registrado",
    icone: "🎉",
    vozTexto: "🎶 Sextoou com sucesso, Jé! Dever cumprido! Excelente final de semana pra você!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Jéssica Ferreira",
      tipo: "Saída",
      hora: "18:00:00",
      data: "22/08/2026",
      mensagem: "Excelente final de semana, Jéssica!",
    },
  },
  {
    id: "entrada",
    titulo: "Ponto Batido: Entrada",
    categoria: "Design Ponto Registrado",
    icone: "🌅",
    vozTexto: "Excelente dia e um ótimo trabalho, Arthur! Seu ponto foi registrado com sucesso.",
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
    icone: "🥪",
    vozTexto: "Excelente almoço e bom apetite, Arthur! Aproveite seu descanso.",
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
    icone: "⚡",
    vozTexto: "Excelente retorno ao trabalho, Arthur! Bom foco no seu turno da tarde.",
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
    titulo: "Ponto Batido: Saída Noturna",
    categoria: "Design Ponto Registrado",
    icone: "🌙",
    vozTexto: "Excelente noite e excelente descanso, Arthur! Dever cumprido, até amanhã!",
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
    titulo: "Verificação: Esqueceu Entrada",
    categoria: "Diálogo Inteligente",
    icone: "❓",
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
    icone: "❓",
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
    titulo: "Verificação: Esqueceu Retorno",
    categoria: "Diálogo Inteligente",
    icone: "❓",
    vozTexto: "Olá, Jéssica! Parece que você esqueceu de registrar o retorno do seu almoço. Que horas você voltou?",
    tipo: "dialogo",
    dadosDialogo: {
      nome: "Jéssica Ferreira",
      diagnostico: {
        tipo: "PERGUNTA_RETORNO_OU_SAIDA",
        horariosGrade: { entrada: "08:00", saidaAlmoco: "13:00", retornoAlmoco: "14:00", saida: "18:00" },
        registrosHoje: [
          { id: "1", funcionario_id: "2", nome_funcionario: "Jéssica Ferreira", data_hora: "2026-08-20T08:00:00", tipo: "Entrada", created_at: "2026-08-20T08:00:00" },
          { id: "2", funcionario_id: "2", nome_funcionario: "Jéssica Ferreira", data_hora: "2026-08-20T13:00:00", tipo: "Saída Almoço", created_at: "2026-08-20T13:00:00" },
        ],
        proximoTipoSugerido: "Saída",
        horariosSugeridos: { horaRetornoAlmoco: "14:00" },
      },
    },
  },
]

export function ShowcaseCarrossel() {
  const [slideAtual, setSlideAtual] = useState(0)
  const [tempoRestante, setTempoRestante] = useState(20)
  const [autoAvanco, setAutoAvanco] = useState(false)
  const [audioDesbloqueado, setAudioDesbloqueado] = useState(false)
  const vozAtiva = useVozAtiva()

  // Estados da Sandbox de IA
  const [sandboxNome, setSandboxNome] = useState("Jéssica Ferreira")
  const [sandboxTipo, setSandboxTipo] = useState<"Entrada" | "Saída Almoço" | "Retorno Almoço" | "Saída">("Entrada")
  const [sandboxDia, setSandboxDia] = useState<"Sexta" | "Segunda" | "Quarta" | "Sábado">("Sexta")
  const [sandboxSabado, setSandboxSabado] = useState(false)
  const [sandboxHumor, setSandboxHumor] = useState<string>("animado")
  const [sandboxGerando, setSandboxGerando] = useState(false)
  const [sandboxResultado, setSandboxResultado] = useState<{
    visual: string
    voz: string
    origem?: string
    tempoMs: number
  } | null>(null)

  const totalSlides = SLIDES.length
  const current = SLIDES[slideAtual]

  const avancarSlide = useCallback(() => {
    setSlideAtual((prev) => (prev + 1) % totalSlides)
  }, [totalSlides])

  const falarSlideAtual = useCallback(() => {
    setAudioDesbloqueado(true)
    const textoParaFalar = current.tipo === "sandbox_ia" && sandboxResultado ? sandboxResultado.voz : current.vozTexto
    reproduzirVozSaudacao(textoParaFalar)
  }, [current, sandboxResultado])

  // Executa geração na Sandbox de IA
  const executarGeracaoIa = useCallback(async () => {
    setAudioDesbloqueado(true)
    setSandboxGerando(true)
    const inicio = performance.now()

    // Simula data baseada no dia da semana escolhido
    const agora = new Date()
    const mapaDias: Record<string, number> = { Segunda: 1, Quarta: 3, Sexta: 5, Sábado: 6 }
    const targetDay = mapaDias[sandboxDia] ?? 5
    const diff = targetDay - agora.getDay()
    const dataSimulada = new Date(agora)
    dataSimulada.setDate(agora.getDate() + diff)

    if (sandboxTipo === "Entrada") dataSimulada.setHours(8, 0, 0)
    else if (sandboxTipo === "Saída Almoço") dataSimulada.setHours(12, 0, 0)
    else if (sandboxTipo === "Retorno Almoço") dataSimulada.setHours(13, 0, 0)
    else dataSimulada.setHours(18, 0, 0)

    try {
      const res = await obterSaudacaoInteligente({
        nome: sandboxNome,
        tipoPonto: sandboxTipo,
        dataHora: dataSimulada,
        trabalhaSabado: sandboxSabado,
        humor: sandboxHumor,
      })

      const fim = performance.now()
      const tempoMs = Math.round(fim - inicio)

      setSandboxResultado({
        visual: res.visual,
        voz: res.voz,
        origem: res.origem,
        tempoMs,
      })

      // Toca a fala sintetizada da IA
      reproduzirVozSaudacao(res.voz)
    } catch {
      // Fallback
    } finally {
      setSandboxGerando(false)
    }
  }, [sandboxNome, sandboxTipo, sandboxDia, sandboxSabado, sandboxHumor])

  // Temporizador opcional de auto-avanço
  useEffect(() => {
    if (!autoAvanco) return
    const timer = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          setSlideAtual((idx) => (idx + 1) % totalSlides)
          return 20
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [autoAvanco, totalSlides])

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-[#050811] text-white select-none overflow-hidden flex flex-col justify-between">
      {/* 1. BARRA SUPERIOR ELEGANTE COM TABS DE ACESSO DIRETO */}
      <header className="relative z-50 bg-slate-950/80 backdrop-blur-2xl border-b border-white/10 px-4 py-3 shrink-0 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          {/* Logo e Dashboard */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-xs font-semibold border border-white/15"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Painel</span>
            </Link>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-bold text-amber-300">Showcase Ponto 2.0:</span>
              <span className="text-xs text-white/80 font-medium">{current.titulo}</span>
            </div>
          </div>

          {/* Status da Voz da IA e Controles */}
          <div className="flex items-center gap-3">
            <AnimacaoVozIa variante="badge" />

            <button
              type="button"
              onClick={falarSlideAtual}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                vozAtiva
                  ? "bg-amber-400 text-slate-950 animate-pulse ring-2 ring-amber-300"
                  : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40"
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{vozAtiva ? "Assistente Falando..." : "Ouvir Voz"}</span>
            </button>

            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => setSlideAtual((prev) => (prev - 1 + totalSlides) % totalSlides)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
                title="Anterior"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-xs px-2 font-bold text-amber-200">
                {slideAtual + 1} / {totalSlides}
              </span>
              <button
                type="button"
                onClick={() => setSlideAtual((prev) => (prev + 1) % totalSlides)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
                title="Próximo"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* PILLS DE NAVEGAÇÃO RÁPIDA (ACESSO DIRETO COM 1 CLIQUE) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-7xl mx-auto w-full scrollbar-none">
          {SLIDES.map((slide, idx) => {
            const isAtivo = slideAtual === idx
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => {
                  setSlideAtual(idx)
                  setAudioDesbloqueado(true)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isAtivo
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105"
                    : "bg-white/10 hover:bg-white/20 text-white/80 border border-white/10"
                }`}
              >
                <span>{slide.icone}</span>
                <span>{slide.titulo}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* 2. ÁREA CENTRAL DE CONTEÚDO (FULL-SCREEN SEM SCROLL) */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
        {/* SLIDE 0: LABORATÓRIO INTERATIVO DA IA GROQ */}
        {current.tipo === "sandbox_ia" && (
          <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8">
            {/* Esferas de luz de fundo */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-10 right-10 w-[500px] h-[500px] rounded-full bg-[#c69e6b] blur-[140px] opacity-40 animate-pulse" />
              <div className="absolute bottom-10 left-10 w-[450px] h-[450px] rounded-full bg-[#14b8a6] blur-[130px] opacity-35" />
            </div>

            <div className="relative z-10 max-w-4xl w-full backdrop-blur-[50px] bg-slate-900/60 rounded-3xl border border-white/15 p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Header da Sandbox */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                      <span>Assistente IA do Ponto</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                        Llama 3.3 70B Versatile
                      </span>
                    </h2>
                    <p className="text-xs text-white/70">
                      Geração de falas inteligentes em tempo real respeitando a cultura <strong>"Excelente..."</strong>
                    </p>
                  </div>
                </div>

                <AnimacaoVozIa variante="completo" />
              </div>

              {/* Controles da Simulação */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Colaborador */}
                <div className="space-y-1.5">
                  <label className="text-white/70 font-semibold uppercase tracking-wider text-[10px]">Colaborador (Apelido)</label>
                  <select
                    value={sandboxNome}
                    onChange={(e) => setSandboxNome(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  >
                    <option value="Jéssica Ferreira" className="bg-slate-900 text-white">Jéssica (Jé)</option>
                    <option value="Arthur Gabriel" className="bg-slate-900 text-white">Arthur (Tu / Artur)</option>
                    <option value="Danielle Rocha" className="bg-slate-900 text-white">Danielle (Dani)</option>
                    <option value="Rafael Silva" className="bg-slate-900 text-white">Rafael (Rafa)</option>
                    <option value="Gabriel Santos" className="bg-slate-900 text-white">Gabriel (Gabi / Biel)</option>
                  </select>
                </div>

                {/* Tipo de Ponto */}
                <div className="space-y-1.5">
                  <label className="text-white/70 font-semibold uppercase tracking-wider text-[10px]">Tipo de Registro</label>
                  <select
                    value={sandboxTipo}
                    onChange={(e) => setSandboxTipo(e.target.value as any)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  >
                    <option value="Entrada" className="bg-slate-900 text-white">🌅 Entrada</option>
                    <option value="Saída Almoço" className="bg-slate-900 text-white">🥪 Saída Almoço</option>
                    <option value="Retorno Almoço" className="bg-slate-900 text-white">⚡ Retorno Almoço</option>
                    <option value="Saída" className="bg-slate-900 text-white">🌙 Saída Fim</option>
                  </select>
                </div>

                {/* Dia da Semana */}
                <div className="space-y-1.5">
                  <label className="text-white/70 font-semibold uppercase tracking-wider text-[10px]">Dia da Semana</label>
                  <select
                    value={sandboxDia}
                    onChange={(e) => setSandboxDia(e.target.value as any)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-amber-400 outline-none"
                  >
                    <option value="Sexta" className="bg-slate-900 text-white">🎉 Sexta-feira (Sextou!)</option>
                    <option value="Segunda" className="bg-slate-900 text-white">🚀 Segunda-feira (Início)</option>
                    <option value="Quarta" className="bg-slate-900 text-white">⚡ Quarta-feira</option>
                    <option value="Sábado" className="bg-slate-900 text-white">📅 Sábado</option>
                  </select>
                </div>

                {/* Trabalha Sábado? */}
                <div className="space-y-1.5">
                  <label className="text-white/70 font-semibold uppercase tracking-wider text-[10px]">Trabalha no Sábado?</label>
                  <button
                    type="button"
                    onClick={() => setSandboxSabado(!sandboxSabado)}
                    className={`w-full py-2 px-3 rounded-xl font-bold border transition-all text-center ${
                      sandboxSabado
                        ? "bg-amber-400/20 border-amber-300 text-amber-200"
                        : "bg-white/10 border-white/20 text-white/70"
                    }`}
                  >
                    {sandboxSabado ? "✅ Sim (Fala: 'até amanhã')" : "❌ Não (Fala: 'bom fds')"}
                  </button>
                </div>
              </div>

              {/* Botão de Disparo da IA */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={executarGeracaoIa}
                  disabled={sandboxGerando}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-[#c69e6b] to-amber-500 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-extrabold text-base shadow-[0_0_30px_rgba(198,158,107,0.5)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {sandboxGerando ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Consultando IA do Groq & Sintetizando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 fill-slate-950" />
                      <span>✨ Gerar com IA do Groq & Falar em Alta Definição</span>
                    </>
                  )}
                </button>
              </div>

              {/* Resultado Gerado pela IA */}
              {sandboxResultado ? (
                <div className="p-5 rounded-2xl bg-white/[0.08] border border-amber-300/30 space-y-3 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <Bot className="w-4 h-4" />
                      Fala Gerada ({sandboxResultado.origem === "groq_ia" ? "Groq Llama 3.3 70B" : "Catálogo Inteligente"})
                    </span>
                    <span className="text-white/60 font-mono">Latência: {sandboxResultado.tempoMs}ms</span>
                  </div>

                  <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
                    "{sandboxResultado.voz}"
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                    <span className="text-white/70">Texto exibido na tela: <strong className="text-amber-200">{sandboxResultado.visual}</strong></span>
                    <button
                      type="button"
                      onClick={() => reproduzirVozSaudacao(sandboxResultado.voz)}
                      className="text-amber-300 hover:text-amber-200 font-bold underline flex items-center gap-1"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Repetir Áudio
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white/5 border border-dashed border-white/15 text-center text-xs text-white/60">
                  💡 Clique no botão dourado acima para testar a geração ao vivo com IA do Groq!
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 1: CHECK-IN DE HUMOR INTERATIVO */}
        {current.tipo === "checkin_humor" && (
          <div className="w-full h-full">
            <ModalCheckinHumor
              key="showcase-humor-modal"
              nome={current.dadosPonto?.nome || "Jéssica Ferreira"}
              onConfirmar={() => {}}
              onFechar={avancarSlide}
              duracaoSegundos={25}
            />
          </div>
        )}

        {/* SLIDES DE PONTO BATIDO */}
        {current.tipo === "ponto_batido" && current.dadosPonto && (
          <TelaPontoSucesso
            key={current.id}
            nome={current.dadosPonto.nome}
            tipo={current.dadosPonto.tipo}
            hora={current.dadosPonto.hora}
            data={current.dadosPonto.data}
            mensagem={current.dadosPonto.mensagem}
            durationMs={20000}
            onVoltar={avancarSlide}
            modoDemonstracao={true}
          />
        )}

        {/* SLIDES DE DIÁLOGO INTELIGENTE */}
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
      </main>
    </div>
  )
}
