"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Volume2,
  LayoutDashboard,
  Sparkles,
  RefreshCw,
} from "lucide-react"
import { reproduzirVozSaudacao } from "@/lib/tts-audio"
import { DialogoPontoInteligente } from "@/components/dialogo-ponto-inteligente"
import { TelaPontoSucesso } from "@/components/tela-ponto-sucesso"
import { ModalCheckinHumor } from "@/components/modal-checkin-humor"
import { AnimacaoVozIa } from "@/components/animacao-voz-ia"
import { obterSaudacaoInteligente } from "@/lib/ia-saudacao"
import { buscarFuncionarios } from "@/lib/supabase"
import type { DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"

interface FuncionarioSimulacao {
  id: string
  nome: string
  apelidoPrincipal: string
  cargo?: string
}

const FUNCIONARIOS_REAIS_BASE: FuncionarioSimulacao[] = [
  { id: "1", nome: "Arthur Gabriel", apelidoPrincipal: "Tu", cargo: "Desenvolvimento" },
  { id: "2", nome: "Jéssica Ferreira", apelidoPrincipal: "Jé", cargo: "Operações" },
  { id: "3", nome: "Julliana", apelidoPrincipal: "Ju", cargo: "Gestão" },
]

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

const SLIDES_BASE: SlideItem[] = [
  {
    id: "sandbox_ia",
    titulo: "Simulador IA Real",
    categoria: "Motor Inteligente",
    icone: "⚡",
    vozTexto: "Excelente dia, Tu! Vamos com tudo produzir muito hoje!",
    tipo: "sandbox_ia",
  },
  {
    id: "checkin_humor_interativo",
    titulo: "Check-in de Humor",
    categoria: "Experiência de Entrada",
    icone: "😄",
    vozTexto: "Como você está se sentindo hoje?",
    tipo: "checkin_humor",
    dadosPonto: {
      nome: "Jéssica Ferreira",
      tipo: "Entrada",
      hora: "08:00",
      data: "Hoje",
      mensagem: "Como você está se sentindo hoje?",
    },
  },
  {
    id: "arthur_sexta_noite",
    titulo: "Arthur • Sexta Fim (Sem Sáb)",
    categoria: "Cultura & Fim de Semana",
    icone: "🎉",
    vozTexto: "Excelente final de semana e bom descanso, Tu! Aproveite bastante!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Arthur Gabriel",
      tipo: "Fim de Expediente",
      hora: "18:00",
      data: "Sexta-feira",
      mensagem: "Excelente final de semana, Arthur!",
    },
  },
  {
    id: "jessica_sexta_sabado",
    titulo: "Jéssica • Sexta Fim (Com Sáb)",
    categoria: "Jornada com Sábado",
    icone: "📅",
    vozTexto: "Excelente descanso e até amanhã, Jé! Nos vemos no sábado!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Jéssica Ferreira",
      tipo: "Fim de Expediente",
      hora: "18:00",
      data: "Sexta-feira",
      mensagem: "Excelente descanso e até amanhã, Jéssica!",
    },
  },
  {
    id: "julliana_entrada",
    titulo: "Julliana • Entrada com Energia",
    categoria: "Boas-vindas Nobres",
    icone: "🌅",
    vozTexto: "Excelente dia, Ju! Que seu turno seja muito produtivo e abençoado!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Julliana",
      tipo: "Entrada",
      hora: "08:02",
      data: "Segunda-feira",
      mensagem: "Excelente dia, Julliana!",
    },
  },
  {
    id: "jessica_almoco",
    titulo: "Jéssica • Saída Almoço",
    categoria: "Pausa de Almoço",
    icone: "🥪",
    vozTexto: "Excelente almoço e bom apetite, Jé! Recarregue as energias!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Jéssica Ferreira",
      tipo: "Saída para Almoço",
      hora: "12:00",
      data: "Quarta-feira",
      mensagem: "Excelente almoço, Jéssica!",
    },
  },
  {
    id: "arthur_retorno",
    titulo: "Arthur • Retorno Almoço",
    categoria: "Retorno da Tarde",
    icone: "⚡",
    vozTexto: "Excelente retorno, Tu! Bora fazer uma tarde brilhante!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Arthur Gabriel",
      tipo: "Retorno do Almoço",
      hora: "13:00",
      data: "Quarta-feira",
      mensagem: "Excelente retorno, Arthur!",
    },
  },
  {
    id: "dialogo_horario_incomum",
    titulo: "Diálogo Inteligente (Hora Incomum)",
    categoria: "IA & Tolerância",
    icone: "❓",
    vozTexto: "Excelente tarde, Jé! Notei que este horário é diferente da sua rotina habitual. Deseja confirmar?",
    tipo: "dialogo",
    dadosDialogo: {
      nome: "Jéssica Ferreira",
      diagnostico: {
        tipo: "PERGUNTA_ALMOCO_OU_SAIDA",
        proximoTipoSugerido: "Saída",
        mensagemPergunta: "Detectamos um horário próximo ao almoço e à saída. O que deseja registrar?",
        horariosGrade: {
          entrada: "08:00",
          saidaAlmoco: "12:00",
          retornoAlmoco: "13:00",
          saida: "18:00",
        },
        registrosHoje: [],
      },
    },
  },
]

export function ShowcaseCarrossel() {
  const [slideAtual, setSlideAtual] = useState(0)
  const [funcionarios, setFuncionarios] = useState<FuncionarioSimulacao[]>(FUNCIONARIOS_REAIS_BASE)

  // Estados do Simulador Interativo de IA (Slide 0)
  const [sandboxNome, setSandboxNome] = useState("Arthur Gabriel")
  const [sandboxTipo, setSandboxTipo] = useState<"Entrada" | "Saída Almoço" | "Retorno Almoço" | "Saída">("Saída")
  const [sandboxDia, setSandboxDia] = useState<"Sexta" | "Segunda" | "Quarta" | "Sábado">("Sexta")
  const [sandboxSabado, setSandboxSabado] = useState(false)
  const [sandboxHumor] = useState("excelente")
  const [sandboxGerando, setSandboxGerando] = useState(false)
  const [sandboxResultado, setSandboxResultado] = useState<{
    visual: string
    voz: string
    origem: string
    tempoMs: number
  } | null>(null)

  // Carrega funcionários reais do Supabase
  useEffect(() => {
    buscarFuncionarios()
      .then((lista) => {
        if (lista && lista.length > 0) {
          const map = lista.map((f) => ({
            id: f.id,
            nome: f.nome,
            apelidoPrincipal: f.nome.split(" ")[0],
          }))
          const nomesExistentes = new Set(map.map((m) => m.nome.toLowerCase()))
          FUNCIONARIOS_REAIS_BASE.forEach((fb) => {
            if (!nomesExistentes.has(fb.nome.toLowerCase())) {
              map.unshift(fb)
            }
          })
          setFuncionarios(map)
        }
      })
      .catch(() => {})
  }, [])

  const totalSlides = SLIDES_BASE.length
  const current = SLIDES_BASE[slideAtual]

  const avancarSlide = useCallback(() => {
    setSlideAtual((prev) => (prev + 1) % totalSlides)
  }, [totalSlides])

  const falarSlideAtual = useCallback(() => {
    const textoParaFalar = current.tipo === "sandbox_ia" && sandboxResultado ? sandboxResultado.voz : current.vozTexto
    reproduzirVozSaudacao(textoParaFalar)
  }, [current, sandboxResultado])

  // Executa geração na Sandbox de IA com dados reais
  const executarGeracaoIa = useCallback(async () => {
    setSandboxGerando(true)
    const inicio = performance.now()

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
        origem: res.origem || "groq_ia",
        tempoMs,
      })

      reproduzirVozSaudacao(res.voz)
    } catch {
      // Fallback
    } finally {
      setSandboxGerando(false)
    }
  }, [sandboxNome, sandboxTipo, sandboxDia, sandboxSabado, sandboxHumor])

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-slate-100 text-slate-900 select-none overflow-hidden flex flex-col justify-between">
      {/* 1. BARRA SUPERIOR EM MODO LIGHT */}
      <header className="relative z-50 bg-white border-b border-slate-200 px-4 py-3 shrink-0 flex flex-col gap-2 shadow-sm">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          {/* Logo e Voltar para Dashboard */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all text-xs font-semibold border border-slate-200"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Painel</span>
            </Link>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#a67c4e]">Showcase:</span>
              <span className="text-xs text-slate-700 font-bold">{current.titulo}</span>
            </div>
          </div>

          {/* Controles de Navegação e Ouvir Voz */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={falarSlideAtual}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-amber-50 hover:bg-amber-100 text-[#a67c4e] border border-amber-200 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Ouvir saudação em áudio"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#c69e6b]" />
              <span>Ouvir Voz</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setSlideAtual((prev) => (prev - 1 + totalSlides) % totalSlides)}
                className="p-1 rounded-sm hover:bg-white text-slate-700 transition-colors cursor-pointer"
                title="Anterior"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-xs px-2 font-bold text-slate-800">
                {slideAtual + 1} / {totalSlides}
              </span>
              <button
                type="button"
                onClick={() => setSlideAtual((prev) => (prev + 1) % totalSlides)}
                className="p-1 rounded-sm hover:bg-white text-slate-700 transition-colors cursor-pointer"
                title="Próximo"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ABAS DE NAVEGAÇÃO RÁPIDA */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-7xl mx-auto w-full scrollbar-none">
          {SLIDES_BASE.map((slide, idx) => {
            const isAtivo = slideAtual === idx
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setSlideAtual(idx)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isAtivo
                    ? "bg-[#c69e6b] text-white font-bold shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                <span>{slide.icone}</span>
                <span>{slide.titulo}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* 2. ÁREA CENTRAL DE CONTEÚDO */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
        {/* SLIDE 0: SIMULADOR DE IA COM COLABORADORES REAIS */}
        {current.tipo === "sandbox_ia" && (
          <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8">
            <div className="relative z-10 max-w-3xl w-full bg-white rounded-lg border border-slate-200 p-6 sm:p-8 shadow-md space-y-5">
              {/* Header do Simulador */}
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Simulador de Voz & IA</span>
                  <span className="text-xs px-2 py-0.5 rounded-sm bg-amber-50 text-[#a67c4e] border border-amber-200 font-mono">
                    Groq Llama 3.3 70B
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Simulação com os colaboradores reais da empresa respeitando a cultura <strong>"Excelente..."</strong>
                </p>
              </div>

              {/* Controles de Simulação */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Colaborador Real */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px]">Colaborador Real</label>
                  <select
                    value={sandboxNome}
                    onChange={(e) => setSandboxNome(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-medium focus:border-[#c69e6b] outline-none cursor-pointer"
                  >
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.nome} className="text-slate-900">
                        {f.nome} ({f.apelidoPrincipal})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Ponto */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px]">Tipo de Registro</label>
                  <select
                    value={sandboxTipo}
                    onChange={(e) => setSandboxTipo(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-medium focus:border-[#c69e6b] outline-none cursor-pointer"
                  >
                    <option value="Entrada">🌅 Entrada</option>
                    <option value="Saída Almoço">🥪 Saída Almoço</option>
                    <option value="Retorno Almoço">⚡ Retorno Almoço</option>
                    <option value="Saída">🌙 Saída Fim</option>
                  </select>
                </div>

                {/* Dia da Semana */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px]">Dia da Semana</label>
                  <select
                    value={sandboxDia}
                    onChange={(e) => setSandboxDia(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-medium focus:border-[#c69e6b] outline-none cursor-pointer"
                  >
                    <option value="Sexta">🎉 Sexta-feira (Sextou!)</option>
                    <option value="Segunda">🚀 Segunda-feira (Início)</option>
                    <option value="Quarta">⚡ Quarta-feira</option>
                    <option value="Sábado">📅 Sábado</option>
                  </select>
                </div>

                {/* Trabalha no Sábado */}
                <div className="space-y-1.5">
                  <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px]">Trabalha Sábado?</label>
                  <button
                    type="button"
                    onClick={() => setSandboxSabado(!sandboxSabado)}
                    className={`w-full py-2 px-3 rounded-md font-bold border transition-all text-center cursor-pointer ${
                      sandboxSabado
                        ? "bg-amber-50 border-amber-300 text-[#a67c4e]"
                        : "bg-slate-50 border-slate-300 text-slate-600"
                    }`}
                  >
                    {sandboxSabado ? "✅ Sim (até amanhã)" : "❌ Não (bom fds)"}
                  </button>
                </div>
              </div>

              {/* Botão de Disparo */}
              <div>
                <button
                  type="button"
                  onClick={executarGeracaoIa}
                  disabled={sandboxGerando}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-md bg-gradient-to-r from-[#c69e6b] to-[#b38850] hover:from-[#b38850] hover:to-[#9e7542] text-white font-bold text-sm shadow-sm active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                >
                  {sandboxGerando ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Gerando com IA & Sintetizando Voz...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Gerar Fala Inteligente com IA do Groq</span>
                    </>
                  )}
                </button>
              </div>

              {/* Resultado */}
              {sandboxResultado ? (
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#a67c4e]">
                      Fala Gerada ({sandboxResultado.origem === "groq_ia" ? "Groq Llama 3.3 70B" : "Catálogo Inteligente"})
                    </span>
                    <span className="text-slate-500 font-mono">Latência: {sandboxResultado.tempoMs}ms</span>
                  </div>

                  <p className="text-base font-bold text-slate-900 leading-relaxed">
                    "{sandboxResultado.voz}"
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className="text-slate-600">
                      Na tela: <strong className="text-slate-900">{sandboxResultado.visual}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => reproduzirVozSaudacao(sandboxResultado.voz)}
                      className="text-[#c69e6b] hover:text-[#a67c4e] font-bold underline flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Repetir Áudio
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-md bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  💡 Clique no botão dourado para gerar e ouvir a voz em tempo real!
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
            falaVoz={current.vozTexto}
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

      {/* 3. ONDA LUMINOSA NA BASE */}
      <AnimacaoVozIa />
    </div>
  )
}
