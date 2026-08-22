"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle2, ArrowRight, ArrowLeft, Sparkles, Check } from "lucide-react"
import type { DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"
import { horaParaMinutos, minutosParaHoraStr } from "@/lib/logica-ponto-inteligente"
import { reproduzirVozSaudacao } from "@/lib/tts-audio"
import { AnimacaoVozIa } from "@/components/animacao-voz-ia"
import "../app/ponto-registrado/ponto-batido.css"

export interface PontoRegularizacao {
  tipo: string
  dataHoraIso: string
}

interface DialogoPontoInteligenteProps {
  nome: string
  diagnostico: DiagnosticoPonto
  onConfirmar: (pontosParaRegistrar: PontoRegularizacao[], tipoExibicao: string, mensagemPersonalizada: string) => void
  onCancelar: () => void
  modoDemonstracao?: boolean
}

type OpcaoSelecionada = "entrada_agora" | "saida_almoco" | "retorno_almoco" | "encerrando_expediente"

export function DialogoPontoInteligente({
  nome,
  diagnostico,
  onConfirmar,
  onCancelar,
  modoDemonstracao = false,
}: DialogoPontoInteligenteProps) {
  const primeiroNome = nome.split(" ")[0]
  const { tipo, horariosGrade, horariosSugeridos } = diagnostico

  // Opção selecionada entre os 4 botões lado a lado
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<OpcaoSelecionada>(
    tipo === "PERGUNTA_ENTRADA_OU_ALMOCO"
      ? "saida_almoco"
      : tipo === "PERGUNTA_RETORNO_OU_SAIDA"
      ? "retorno_almoco"
      : "encerrando_expediente"
  )

  // Etapas do fluxo
  const [etapa, setEtapa] = useState<"selecao" | "ajuste" | "processando">("selecao")
  const [tempoRestante, setTempoRestante] = useState(45)

  // Horários retroativos
  const [horaChegada, setHoraChegada] = useState(horariosSugeridos?.horaChegada || horariosGrade.entrada || "08:00")
  const [horaSaidaAlmoco, setHoraSaidaAlmoco] = useState(horariosSugeridos?.horaSaidaAlmoco || horariosGrade.saidaAlmoco || "12:00")
  const [horaRetornoAlmoco, setHoraRetornoAlmoco] = useState(horariosSugeridos?.horaRetornoAlmoco || horariosGrade.retornoAlmoco || "13:00")

  const horaAtualStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  // Voz de instrução
  useEffect(() => {
    let textoVoz = `Olá, ${primeiroNome}! Notamos que sua jornada precisa de confirmação. Selecione uma opção na tela.`
    if (tipo === "PERGUNTA_ENTRADA_OU_ALMOCO") {
      textoVoz = `Olá, ${primeiroNome}! Você ainda não registrou sua entrada hoje. Você está entrando agora, saindo para o almoço, retornando ou encerrando seu dia?`
    } else if (tipo === "PERGUNTA_RETORNO_OU_SAIDA") {
      textoVoz = `Olá, ${primeiroNome}! Você esqueceu de bater o retorno do almoço? Que horas você retornou?`
    }
    reproduzirVozSaudacao(textoVoz)
  }, [tipo, primeiroNome])

  useEffect(() => {
    if (modoDemonstracao) return
    const timer = setInterval(() => {
      setTempoRestante((t) => {
        if (t <= 1) {
          clearInterval(timer)
          onCancelar()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onCancelar, modoDemonstracao])

  const criarIsoHoje = (horaStr: string): string => {
    const d = new Date()
    const [h, m] = horaStr.split(":").map(Number)
    d.setHours(h || 0, m || 0, 0, 0)
    return d.toISOString()
  }

  const ajustarMinutos = (horaAtual: string, deltaMin: number): string => {
    const m = horaParaMinutos(horaAtual) + deltaMin
    return minutosParaHoraStr(m)
  }

  const handleAvancarSelecao = () => {
    if (opcaoSelecionada === "entrada_agora") {
      setEtapa("processando")
      setTimeout(() => {
        const agora = new Date().toISOString()
        onConfirmar(
          [{ tipo: "Entrada", dataHoraIso: agora }],
          "Entrada",
          `Excelente dia, ${primeiroNome}!`
        )
      }, 650)
    } else {
      setEtapa("ajuste")
    }
  }

  const handleConfirmarAjustes = () => {
    setEtapa("processando")
    setTimeout(() => {
      const agora = new Date().toISOString()

      if (opcaoSelecionada === "saida_almoco") {
        const isoChegada = criarIsoHoje(horaChegada)
        onConfirmar(
          [
            { tipo: "Entrada", dataHoraIso: isoChegada },
            { tipo: "Saída Almoço", dataHoraIso: agora },
          ],
          "Saída Almoço",
          `Excelente almoço, ${primeiroNome}!`
        )
      } else if (opcaoSelecionada === "retorno_almoco") {
        const isoChegada = criarIsoHoje(horaChegada)
        const isoSaidaAlmoco = criarIsoHoje(horaSaidaAlmoco)
        onConfirmar(
          [
            { tipo: "Entrada", dataHoraIso: isoChegada },
            { tipo: "Saída Almoço", dataHoraIso: isoSaidaAlmoco },
            { tipo: "Retorno Almoço", dataHoraIso: agora },
          ],
          "Retorno Almoço",
          `Excelente retorno ao trabalho, ${primeiroNome}!`
        )
      } else if (opcaoSelecionada === "encerrando_expediente") {
        const isoChegada = criarIsoHoje(horaChegada)
        const isoSaidaAlmoco = criarIsoHoje(horaSaidaAlmoco)
        const isoRetornoAlmoco = criarIsoHoje(horaRetornoAlmoco)
        onConfirmar(
          [
            { tipo: "Entrada", dataHoraIso: isoChegada },
            { tipo: "Saída Almoço", dataHoraIso: isoSaidaAlmoco },
            { tipo: "Retorno Almoço", dataHoraIso: isoRetornoAlmoco },
            { tipo: "Saída", dataHoraIso: agora },
          ],
          "Saída",
          `Excelente noite, ${primeiroNome}!`
        )
      }
    }, 650)
  }

  // Fundo atmosférico dinâmico com Glassmorphism de Tela Inteira para as 4 Opções
  const getFundoDinamico = () => {
    switch (opcaoSelecionada) {
      case "entrada_agora":
        return {
          baseBg: "bg-[#0f0c05]",
          orb1: "bg-[#eab308]",
          orb2: "bg-[#ca8a04]",
          orb3: "bg-[#fef08a]",
          glassTint: "bg-yellow-950/30",
          badgeColor: "text-amber-100 bg-white/15 border-white/25",
        }
      case "saida_almoco":
        return {
          baseBg: "bg-[#1c0c05]",
          orb1: "bg-[#f97316]",
          orb2: "bg-[#ea580c]",
          orb3: "bg-[#fb923c]",
          glassTint: "bg-orange-950/40",
          badgeColor: "text-orange-100 bg-white/15 border-white/25",
        }
      case "retorno_almoco":
        return {
          baseBg: "bg-slate-950",
          orb1: "bg-[#14b8a6]",
          orb2: "bg-[#0d9488]",
          orb3: "bg-[#2dd4bf]",
          glassTint: "bg-teal-950/40",
          badgeColor: "text-teal-100 bg-white/15 border-white/25",
        }
      case "encerrando_expediente":
      default:
        return {
          baseBg: "bg-[#030712]",
          orb1: "bg-[#1e293b]",
          orb2: "bg-[#3b82f6]",
          orb3: "bg-[#c69e6b]",
          glassTint: "bg-slate-950/50",
          badgeColor: "text-amber-300 bg-amber-400/15 border-amber-400/30",
        }
    }
  }

  const fundo = getFundoDinamico()

  return (
    <div className={`fixed inset-0 z-50 h-screen w-screen select-none overflow-hidden transition-all duration-700 ${fundo.baseBg}`}>
      {/* 1. CAMADA DE LUZES / ESFERAS AMBIENTES NO FUNDO */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-24 right-0 w-[550px] h-[550px] rounded-full ${fundo.orb1} blur-[120px] opacity-75 animate-pulse`} />
        <div className={`absolute bottom-0 left-0 w-[450px] h-[450px] rounded-full ${fundo.orb2} blur-[110px] opacity-65`} />
        <div className={`absolute top-1/3 left-1/3 w-[380px] h-[380px] rounded-full ${fundo.orb3} blur-[100px] opacity-45`} />
      </div>

      {/* 2. SUPERFÍCIE DE GLASSMORPHISM DE TELA INTEIRA (100% LARGURA/ALTURA, SEM BORDAS) */}
      <div
        className={`absolute inset-0 w-full h-full backdrop-blur-[60px] backdrop-saturate-[180%] ${fundo.glassTint} border-none flex flex-col justify-between p-4 sm:p-8 lg:p-10 transition-all duration-700`}
      >
        {/* TOPO: Logo limpa e Badge */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto shrink-0">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={140} height={70} priority style={{ height: "auto" }} />
            <div className="hidden sm:block h-6 w-px bg-white/20" />
            <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-md backdrop-blur-md border ${fundo.badgeColor}`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Verificação Inteligente</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AnimacaoVozIa variante="badge" />
            <span className="text-xs text-white/60 font-medium">Tempo: {tempoRestante}s</span>
          </div>
        </div>

        {/* ÁREA CENTRAL: 100% Tela sem Scroll */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full px-2 my-auto">
          {/* Saudação */}
          <div className="space-y-1 text-center md:text-left mb-5">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-sm">
              Olá, <span style={{ color: "#c69e6b" }}>{primeiroNome}</span>!
            </h2>
            <p className="text-sm text-white/80 font-medium">
              {etapa === "selecao" && "Identificamos inconsistências nos registros de hoje. Selecione o que você está fazendo agora:"}
              {etapa === "ajuste" && "Ajuste os horários da sua jornada para regularizarmos tudo com precisão:"}
              {etapa === "processando" && "Processando e validando seus registros de ponto..."}
            </p>
          </div>

          {/* ======================= ETAPA 1: OS 4 BOTÕES LADO A LADO ======================= */}
          {etapa === "selecao" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {/* Opção 1: Chegando Agora */}
                <button
                  type="button"
                  onClick={() => setOpcaoSelecionada("entrada_agora")}
                  className={`p-4 sm:p-5 rounded-2xl text-left transition-all duration-300 flex flex-col justify-between h-44 sm:h-48 relative backdrop-blur-2xl ${
                    opcaoSelecionada === "entrada_agora"
                      ? "bg-white/[0.18] border-2 border-amber-300 text-white shadow-[0_12px_40px_-5px_rgba(245,158,11,0.4)] ring-2 ring-amber-300/40 scale-[1.02]"
                      : "bg-white/[0.07] border border-white/15 text-white/80 hover:bg-white/[0.12]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-3xl sm:text-4xl">🌤️</span>
                    {opcaoSelecionada === "entrada_agora" && (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 sm:space-y-1">
                    <div className="font-bold text-sm sm:text-base text-white leading-tight">Chegando Agora</div>
                    <p className="text-[11px] sm:text-xs text-white/70">Entrada às {horaAtualStr}</p>
                  </div>
                </button>

                {/* Opção 2: Saindo para o Almoço */}
                <button
                  type="button"
                  onClick={() => setOpcaoSelecionada("saida_almoco")}
                  className={`p-4 sm:p-5 rounded-2xl text-left transition-all duration-300 flex flex-col justify-between h-44 sm:h-48 relative backdrop-blur-2xl ${
                    opcaoSelecionada === "saida_almoco"
                      ? "bg-white/[0.18] border-2 border-orange-300 text-white shadow-[0_12px_40px_-5px_rgba(249,115,22,0.4)] ring-2 ring-orange-300/40 scale-[1.02]"
                      : "bg-white/[0.07] border border-white/15 text-white/80 hover:bg-white/[0.12]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-3xl sm:text-4xl">🍽️</span>
                    {opcaoSelecionada === "saida_almoco" && (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-400 text-white flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 sm:space-y-1">
                    <div className="font-bold text-sm sm:text-base text-white leading-tight">Saindo p/ Almoço</div>
                    <p className="text-[11px] sm:text-xs text-white/70">Ajustar entrada da manhã</p>
                  </div>
                </button>

                {/* Opção 3: Voltando do Almoço (NOVO BOTÃO!) */}
                <button
                  type="button"
                  onClick={() => setOpcaoSelecionada("retorno_almoco")}
                  className={`p-4 sm:p-5 rounded-2xl text-left transition-all duration-300 flex flex-col justify-between h-44 sm:h-48 relative backdrop-blur-2xl ${
                    opcaoSelecionada === "retorno_almoco"
                      ? "bg-white/[0.18] border-2 border-teal-300 text-white shadow-[0_12px_40px_-5px_rgba(20,184,166,0.4)] ring-2 ring-teal-300/40 scale-[1.02]"
                      : "bg-white/[0.07] border border-white/15 text-white/80 hover:bg-white/[0.12]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-3xl sm:text-4xl">💼</span>
                    {opcaoSelecionada === "retorno_almoco" && (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-teal-400 text-black flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 sm:space-y-1">
                    <div className="font-bold text-sm sm:text-base text-white leading-tight">Voltando Almoço</div>
                    <p className="text-[11px] sm:text-xs text-white/70">Ajustar entrada e almoço</p>
                  </div>
                </button>

                {/* Opção 4: Encerrando Expediente */}
                <button
                  type="button"
                  onClick={() => setOpcaoSelecionada("encerrando_expediente")}
                  className={`p-4 sm:p-5 rounded-2xl text-left transition-all duration-300 flex flex-col justify-between h-44 sm:h-48 relative backdrop-blur-2xl ${
                    opcaoSelecionada === "encerrando_expediente"
                      ? "bg-white/[0.18] border-2 border-amber-300 text-white shadow-[0_12px_40px_-5px_rgba(253,224,71,0.4)] ring-2 ring-amber-300/40 scale-[1.02]"
                      : "bg-white/[0.07] border border-white/15 text-white/80 hover:bg-white/[0.12]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-3xl sm:text-4xl">🌙</span>
                    {opcaoSelecionada === "encerrando_expediente" && (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 sm:space-y-1">
                    <div className="font-bold text-sm sm:text-base text-white leading-tight">Indo Embora</div>
                    <p className="text-[11px] sm:text-xs text-white/70">Preencher todo o dia</p>
                  </div>
                </button>
              </div>

              {/* Ações da Etapa 1 */}
              <div className="flex items-center justify-end gap-4 pt-2">
                <button
                  onClick={onCancelar}
                  className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <Button
                  onClick={handleAvancarSelecao}
                  className="px-8 py-3 h-12 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm"
                  style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
                >
                  <span>Avançar</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ======================= ETAPA 2: AJUSTE DE HORÁRIOS ======================= */}
          {etapa === "ajuste" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-white/[0.06] p-4 sm:p-5 rounded-2xl border border-white/15 backdrop-blur-2xl">
                {/* Entrada (Comum a todas as opções de ajuste) */}
                <div className="bg-black/30 p-3.5 rounded-xl border border-white/10 shadow-sm flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase font-bold text-amber-300 tracking-wider flex items-center gap-1.5">
                      <span>🌤️</span> Entrada Manhã
                    </span>
                    <p className="text-[11px] text-white/70 mt-0.5">Horário de chegada</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setHoraChegada(ajustarMinutos(horaChegada, -15))}
                      className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-bold"
                    >
                      -15m
                    </button>
                    <input
                      type="time"
                      value={horaChegada}
                      onChange={(e) => setHoraChegada(e.target.value)}
                      className="w-24 text-center text-lg font-bold font-mono py-1 px-1.5 rounded bg-white/20 text-white border border-white/25 outline-none"
                    />
                    <button
                      onClick={() => setHoraChegada(ajustarMinutos(horaChegada, +15))}
                      className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-bold"
                    >
                      +15m
                    </button>
                  </div>
                </div>

                {/* Saída Almoço (Para retorno do almoço ou fim do dia) */}
                {(opcaoSelecionada === "retorno_almoco" || opcaoSelecionada === "encerrando_expediente") && (
                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/10 shadow-sm flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs uppercase font-bold text-orange-300 tracking-wider flex items-center gap-1.5">
                        <span>🍽️</span> Saída Almoço
                      </span>
                      <p className="text-[11px] text-white/70 mt-0.5">Horário que almoçou</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setHoraSaidaAlmoco(ajustarMinutos(horaSaidaAlmoco, -15))}
                        className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-bold"
                      >
                        -15m
                      </button>
                      <input
                        type="time"
                        value={horaSaidaAlmoco}
                        onChange={(e) => setHoraSaidaAlmoco(e.target.value)}
                        className="w-24 text-center text-lg font-bold font-mono py-1 px-1.5 rounded bg-white/20 text-white border border-white/25 outline-none"
                      />
                      <button
                        onClick={() => setHoraSaidaAlmoco(ajustarMinutos(horaSaidaAlmoco, +15))}
                        className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-bold"
                      >
                        +15m
                      </button>
                    </div>
                  </div>
                )}

                {/* Retorno Almoço (Para fim de expediente) */}
                {opcaoSelecionada === "encerrando_expediente" && (
                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/10 shadow-sm flex items-center justify-between gap-3 sm:col-span-2">
                    <div>
                      <span className="text-xs uppercase font-bold text-teal-300 tracking-wider flex items-center gap-1.5">
                        <span>💼</span> Retorno do Almoço
                      </span>
                      <p className="text-[11px] text-white/70 mt-0.5">Horário que voltou do almoço</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, -15))}
                        className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-bold"
                      >
                        -15m
                      </button>
                      <input
                        type="time"
                        value={horaRetornoAlmoco}
                        onChange={(e) => setHoraRetornoAlmoco(e.target.value)}
                        className="w-24 text-center text-lg font-bold font-mono py-1 px-1.5 rounded bg-white/20 text-white border border-white/25 outline-none"
                      />
                      <button
                        onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, +15))}
                        className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-bold"
                      >
                        +15m
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Ações da Etapa 2 */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setEtapa("selecao")}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar às Opções</span>
                </button>
                <Button
                  onClick={handleConfirmarAjustes}
                  className="px-8 py-3 h-12 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all"
                  style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
                >
                  Confirmar e Registrar Ponto
                </Button>
              </div>
            </div>
          )}

          {/* ======================= ETAPA 3: PROCESSANDO ======================= */}
          {etapa === "processando" && (
            <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 rounded-full bg-white/20 text-white border-2 border-white/40 flex items-center justify-center shadow-xl backdrop-blur-md">
                <CheckCircle2 className="w-10 h-10 animate-pulse stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-white">Registrando Ponto...</h3>
                <p className="text-xs text-white/80 font-medium">Validando jornada e direcionando para confirmação</p>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        <div className="h-4 shrink-0" />
      </div>
    </div>
  )
}
