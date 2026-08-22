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
    vozTexto: "Excelente dia, Jé! Que alegria ter você aqui hoje! Vamos com tudo que seu turno vai ser maravilhoso!",
    tipo: "sandbox_ia",
  },
  {
    id: "checkin_humor",
    titulo: "Check-in de Humor",
    categoria: "Experiência Ponto Batido",
    icone: "🎭",
    vozTexto: "Olá Jéssica! Como você está se sentindo hoje? Selecione uma opção para o seu dia!",
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
    id: "entrada_jessica",
    titulo: "Entrada: Jéssica Ferreira",
    categoria: "Ponto Registrado",
    icone: "🌅",
    vozTexto: "Excelente dia, Jé! Um ótimo trabalho e um turno abençoado pra você!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Jéssica Ferreira",
      tipo: "Entrada",
      hora: "08:01:20",
      data: "22/08/2026",
      mensagem: "Excelente dia, Jé!",
    },
  },
  {
    id: "almoco_julliana",
    titulo: "Almoço: Julliana",
    categoria: "Ponto Registrado",
    icone: "🥪",
    vozTexto: "Excelente almoço e bom descanso, Ju! Aproveite sua refeição!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Julliana",
      tipo: "Saída Almoço",
      hora: "12:02:10",
      data: "22/08/2026",
      mensagem: "Excelente almoço, Ju!",
    },
  },
  {
    id: "retorno_arthur",
    titulo: "Retorno: Arthur Gabriel",
    categoria: "Ponto Registrado",
    icone: "⚡",
    vozTexto: "Excelente retorno ao trabalho, Arthur! Foco total na sua tarde de criação!",
    tipo: "ponto_batido",
    dadosPonto: {
      nome: "Arthur Gabriel",
      tipo: "Retorno Almoço",
      hora: "13:05:42",
      data: "22/08/2026",
      mensagem: "Excelente retorno, Arthur!",
    },
  },
  {
    id: "sextou_jessica",
    titulo: "Sextou! (Final de Semana)",
    categoria: "Ponto Registrado",
    icone: "🎉",
    vozTexto: "Sextou com sucesso, Jé! Dever cumprido! Excelente final de semana pra você!",
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
    id: "diag_julliana",
    titulo: "Verificação: Esqueceu Entrada (Julliana)",
    categoria: "Diálogo Inteligente",
    icone: "❓",
    vozTexto: "Olá, Julliana! Notamos que você ainda não registrou sua entrada hoje. Você está chegando agora ou saindo para o almoço?",
    tipo: "dialogo",
    dadosDialogo: {
      nome: "Julliana",
      diagnostico: {
        tipo: "PERGUNTA_ENTRADA_OU_ALMOCO",
        horariosGrade: { entrada: "08:30", saidaAlmoco: "12:30", retornoAlmoco: "13:30", saida: "18:30" },
        registrosHoje: [],
        proximoTipoSugerido: "Entrada",
        horariosSugeridos: { horaChegada: "08:30" },
      },
    },
  },
  {
    id: "diag_arthur",
    titulo: "Verificação: Esqueceu Almoço (Arthur)",
    categoria: "Diálogo Inteligente",
    icone: "❓",
    vozTexto: "Olá, Arthur! Notamos que você não registrou o almoço hoje. Você está saindo para o almoço agora ou finalizando seu expediente?",
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
]

export function ShowcaseCarrossel() {
  const [slideAtual, setSlideAtual] = useState(0)
  const [funcionarios, setFuncionarios] = useState<FuncionarioSimulacao[]>(FUNCIONARIOS_REAIS_BASE)

  // Estados do Simulador de IA
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

  // Carrega funcionários reais do banco se disponível
  useEffect(() => {
    buscarFuncionarios()
      .then((lista) => {
        if (lista && lista.length > 0) {
          const map = lista.map((f) => ({
            id: f.id,
            nome: f.nome,
            apelidoPrincipal: f.nome.split(" ")[0],
          }))
          // Garante que Arthur, Jéssica e Julliana estejam sempre presentes
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
        origem: res.origem,
        tempoMs,
      })

      reproduzirVozSaudacao(res.voz)
    } catch {
      // Fallback automático
    } finally {
      setSandboxGerando(false)
    }
  }, [sandboxNome, sandboxTipo, sandboxDia, sandboxSabado, sandboxHumor])

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-[#050811] text-white select-none overflow-hidden flex flex-col justify-between">
      {/* 1. BARRA SUPERIOR ELEGANTE E LIMPA */}
      <header className="relative z-50 bg-slate-950/85 backdrop-blur-2xl border-b border-white/10 px-4 py-3 shrink-0 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          {/* Logo e Voltar para Dashboard */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-xs font-semibold border border-white/15"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Painel</span>
            </Link>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-bold text-amber-300">Showcase:</span>
              <span className="text-xs text-white/80 font-medium">{current.titulo}</span>
            </div>
          </div>

          {/* Controles de Navegação e Ouvir Voz */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={falarSlideAtual}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 transition-all active:scale-95 cursor-pointer"
              title="Ouvir saudação em áudio"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Ouvir Voz</span>
            </button>

            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => setSlideAtual((prev) => (prev - 1 + totalSlides) % totalSlides)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
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
                className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Próximo"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ABAS / PILLS DE NAVEGAÇÃO RÁPIDA DIRETA */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-7xl mx-auto w-full scrollbar-none">
          {SLIDES_BASE.map((slide, idx) => {
            const isAtivo = slideAtual === idx
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setSlideAtual(idx)}
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

      {/* 2. ÁREA CENTRAL DE CONTEÚDO */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
        {/* SLIDE 0: SIMULADOR DE IA COM COLABORADORES REAIS (ARTHUR, JÉSSICA, JULLIANA) */}
        {current.tipo === "sandbox_ia" && (
          <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-10 right-10 w-[500px] h-[500px] rounded-full bg-[#c69e6b] blur-[140px] opacity-40 animate-pulse" />
              <div className="absolute bottom-10 left-10 w-[450px] h-[450px] rounded-full bg-[#14b8a6] blur-[130px] opacity-35" />
            </div>

            <div className="relative z-10 max-w-4xl w-full backdrop-blur-[50px] bg-slate-900/60 rounded-3xl border border-white/15 p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Header do Simulador */}
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Simulador de Voz & IA</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                    Groq Llama 3.3 70B
                  </span>
                </h2>
                <p className="text-xs text-white/70 mt-0.5">
                  Simulação com os colaboradores reais da empresa respeitando a cultura <strong>"Excelente..."</strong>
                </p>
              </div>

              {/* Controles de Simulação */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Colaborador Real */}
                <div className="space-y-1.5">
                  <label className="text-white/70 font-semibold uppercase tracking-wider text-[10px]">Colaborador Real</label>
                  <select
                    value={sandboxNome}
                    onChange={(e) => setSandboxNome(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-amber-400 outline-none cursor-pointer"
                  >
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.nome} className="bg-slate-900 text-white">
                        {f.nome} ({f.apelidoPrincipal})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Ponto */}
                <div className="space-y-1.5">
                  <label className="text-white/70 font-semibold uppercase tracking-wider text-[10px]">Tipo de Registro</label>
                  <select
                    value={sandboxTipo}
                    onChange={(e) => setSandboxTipo(e.target.value as any)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-amber-400 outline-none cursor-pointer"
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
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-amber-400 outline-none cursor-pointer"
                  >
                    <option value="Sexta" className="bg-slate-900 text-white">🎉 Sexta-feira (Sextou!)</option>
                    <option value="Segunda" className="bg-slate-900 text-white">🚀 Segunda-feira (Início)</option>
                    <option value="Quarta" className="bg-slate-900 text-white">⚡ Quarta-feira</option>
                    <option value="Sábado" className="bg-slate-900 text-white">📅 Sábado</option>
                  </select>
                </div>

                {/* Trabalha no Sábado */}
                <div className="space-y-1.5">
                  <label className="text-white/70 font-semibold uppercase tracking-wider text-[10px]">Trabalha Sábado?</label>
                  <button
                    type="button"
                    onClick={() => setSandboxSabado(!sandboxSabado)}
                    className={`w-full py-2 px-3 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                      sandboxSabado
                        ? "bg-amber-400/20 border-amber-300 text-amber-200"
                        : "bg-white/10 border-white/20 text-white/70"
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
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-[#c69e6b] to-amber-500 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-extrabold text-base shadow-[0_0_30px_rgba(198,158,107,0.5)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {sandboxGerando ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Gerando com IA & Sintetizando Voz...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 fill-slate-950" />
                      <span>Gerar Fala Inteligente com IA do Groq</span>
                    </>
                  )}
                </button>
              </div>

              {/* Resultado */}
              {sandboxResultado ? (
                <div className="p-5 rounded-2xl bg-white/[0.08] border border-amber-300/30 space-y-2.5 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300">
                      Fala Gerada ({sandboxResultado.origem === "groq_ia" ? "Groq Llama 3.3 70B" : "Catálogo Inteligente"})
                    </span>
                    <span className="text-white/60 font-mono">Latência: {sandboxResultado.tempoMs}ms</span>
                  </div>

                  <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
                    "{sandboxResultado.voz}"
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                    <span className="text-white/70">
                      Na tela: <strong className="text-amber-200">{sandboxResultado.visual}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => reproduzirVozSaudacao(sandboxResultado.voz)}
                      className="text-amber-300 hover:text-amber-200 font-bold underline flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Repetir Áudio
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white/5 border border-dashed border-white/15 text-center text-xs text-white/60">
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
              duracaoSegundos={25}
            />
          </div>
        )}

        {/* SLIDES DE PONTO BATIDO COM COLABORADORES REAIS */}
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

      {/* 3. ONDA LUMINOSA AZUL NA BORDA BOTTOM ENQUANTO A VOZ ESTIVER FALANDO */}
      <AnimacaoVozIa />
    </div>
  )
}
