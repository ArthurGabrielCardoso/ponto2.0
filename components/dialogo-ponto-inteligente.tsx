"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle2, ArrowRight, ArrowLeft, Sun, Coffee, Briefcase, Moon, Sparkles, Check } from "lucide-react"
import type { DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"
import { horaParaMinutos, minutosParaHoraStr } from "@/lib/logica-ponto-inteligente"
import { reproduzirVozSaudacao } from "@/lib/tts-audio"
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

type OpcaoSelecionada = "entrada_agora" | "saida_almoco" | "encerrando_expediente"

export function DialogoPontoInteligente({
  nome,
  diagnostico,
  onConfirmar,
  onCancelar,
  modoDemonstracao = false,
}: DialogoPontoInteligenteProps) {
  const primeiroNome = nome.split(" ")[0]
  const { tipo, horariosGrade, horariosSugeridos } = diagnostico

  // Opção selecionada entre os 3 botões lado a lado
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<OpcaoSelecionada>(
    tipo === "PERGUNTA_ENTRADA_OU_ALMOCO" ? "saida_almoco" : "encerrando_expediente"
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
      textoVoz = `Olá, ${primeiroNome}! Você ainda não registrou sua entrada hoje. Você está entrando agora, saindo para o almoço ou encerrando seu dia?`
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

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen bg-gradient-to-b from-slate-900/90 via-slate-900/95 to-black backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-8 lg:p-10 select-none overflow-hidden animate-in fade-in duration-300">
      {/* TOPO: Logo e Badge */}
      <div className="flex items-center justify-between w-full max-w-5xl mx-auto shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-md">
            <Image src="/logo.png" alt="Logo" width={130} height={65} priority style={{ height: "auto" }} />
          </div>
          <div className="hidden sm:block h-6 w-px bg-white/20" />
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-300 bg-teal-500/15 border border-teal-400/30 px-3.5 py-1.5 rounded-md backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Verificação Inteligente</span>
          </div>
        </div>
        <span className="text-xs text-white/50 font-medium">Tempo: {tempoRestante}s</span>
      </div>

      {/* ÁREA CENTRAL: 100% Tela sem Scroll */}
      <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full px-2 my-auto">
        {/* Saudação */}
        <div className="space-y-1 text-center md:text-left mb-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Olá, <span style={{ color: "#c69e6b" }}>{primeiroNome}</span>!
          </h2>
          <p className="text-sm text-slate-300 font-medium">
            {etapa === "selecao" && "Identificamos inconsistências nos registros de hoje. Selecione o que você está fazendo agora:"}
            {etapa === "ajuste" && "Ajuste os horários da sua jornada para regularizarmos tudo com precisão:"}
            {etapa === "processando" && "Processando e validando seus registros de ponto..."}
          </p>
        </div>

        {/* ======================= ETAPA 1: OS 3 BOTÕES LADO A LADO ======================= */}
        {etapa === "selecao" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Opção 1: Chegando Agora */}
              <button
                type="button"
                onClick={() => setOpcaoSelecionada("entrada_agora")}
                className={`p-6 rounded-2xl text-left transition-all duration-200 flex flex-col justify-between h-48 relative ${
                  opcaoSelecionada === "entrada_agora"
                    ? "bg-teal-500/20 border-2 border-teal-400 text-white shadow-[0_10px_30px_-5px_rgba(20,184,166,0.4)] ring-2 ring-teal-400/30"
                    : "bg-white/10 border border-white/15 text-slate-200 hover:bg-white/15"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-4xl">🌤️</span>
                  {opcaoSelecionada === "entrada_agora" && (
                    <div className="w-7 h-7 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-md">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-lg text-white leading-tight">Chegando Agora</div>
                  <p className="text-xs text-slate-300">Registrar Entrada às {horaAtualStr}</p>
                </div>
              </button>

              {/* Opção 2: Saindo para o Almoço */}
              <button
                type="button"
                onClick={() => setOpcaoSelecionada("saida_almoco")}
                className={`p-6 rounded-2xl text-left transition-all duration-200 flex flex-col justify-between h-48 relative ${
                  opcaoSelecionada === "saida_almoco"
                    ? "bg-teal-500/20 border-2 border-teal-400 text-white shadow-[0_10px_30px_-5px_rgba(20,184,166,0.4)] ring-2 ring-teal-400/30"
                    : "bg-white/10 border border-white/15 text-slate-200 hover:bg-white/15"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-4xl">🍽️</span>
                  {opcaoSelecionada === "saida_almoco" && (
                    <div className="w-7 h-7 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-md">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-lg text-white leading-tight">Saindo p/ Almoço</div>
                  <p className="text-xs text-slate-300">Esqueci a entrada da manhã e quero ajustar</p>
                </div>
              </button>

              {/* Opção 3: Encerrando Expediente */}
              <button
                type="button"
                onClick={() => setOpcaoSelecionada("encerrando_expediente")}
                className={`p-6 rounded-2xl text-left transition-all duration-200 flex flex-col justify-between h-48 relative ${
                  opcaoSelecionada === "encerrando_expediente"
                    ? "bg-teal-500/20 border-2 border-teal-400 text-white shadow-[0_10px_30px_-5px_rgba(20,184,166,0.4)] ring-2 ring-teal-400/30"
                    : "bg-white/10 border border-white/15 text-slate-200 hover:bg-white/15"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-4xl">🌙</span>
                  {opcaoSelecionada === "encerrando_expediente" && (
                    <div className="w-7 h-7 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-md">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-lg text-white leading-tight">Indo Embora</div>
                  <p className="text-xs text-slate-300">Não bati ponto hoje e vou preencher tudo</p>
                </div>
              </button>
            </div>

            {/* Ações da Etapa 1 */}
            <div className="flex items-center justify-end gap-4 pt-2">
              <button
                onClick={onCancelar}
                className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <Button
                onClick={handleAvancarSelecao}
                className="px-8 py-3 h-12 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm"
                style={{ background: "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)" }}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/10 backdrop-blur-xl">
              {/* Entrada */}
              <div className="bg-black/30 p-4 rounded-xl border border-white/10 shadow-sm flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs uppercase font-bold text-amber-300 tracking-wider flex items-center gap-1.5">
                    <span>🌤️</span> Entrada Manhã
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Horário de chegada</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setHoraChegada(ajustarMinutos(horaChegada, -15))}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold"
                  >
                    -15m
                  </button>
                  <input
                    type="time"
                    value={horaChegada}
                    onChange={(e) => setHoraChegada(e.target.value)}
                    className="w-24 text-center text-lg font-bold font-mono py-1 px-1.5 rounded bg-white/15 text-white border border-white/20 outline-none"
                  />
                  <button
                    onClick={() => setHoraChegada(ajustarMinutos(horaChegada, +15))}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold"
                  >
                    +15m
                  </button>
                </div>
              </div>

              {/* Campos adicionais para encerrar dia completo */}
              {opcaoSelecionada === "encerrando_expediente" && (
                <>
                  <div className="bg-black/30 p-4 rounded-xl border border-white/10 shadow-sm flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs uppercase font-bold text-orange-300 tracking-wider flex items-center gap-1.5">
                        <span>🍽️</span> Saída Almoço
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Horário que almoçou</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setHoraSaidaAlmoco(ajustarMinutos(horaSaidaAlmoco, -15))}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold"
                      >
                        -15m
                      </button>
                      <input
                        type="time"
                        value={horaSaidaAlmoco}
                        onChange={(e) => setHoraSaidaAlmoco(e.target.value)}
                        className="w-24 text-center text-lg font-bold font-mono py-1 px-1.5 rounded bg-white/15 text-white border border-white/20 outline-none"
                      />
                      <button
                        onClick={() => setHoraSaidaAlmoco(ajustarMinutos(horaSaidaAlmoco, +15))}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold"
                      >
                        +15m
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/30 p-4 rounded-xl border border-white/10 shadow-sm flex items-center justify-between gap-3 sm:col-span-2">
                    <div>
                      <span className="text-xs uppercase font-bold text-teal-300 tracking-wider flex items-center gap-1.5">
                        <span>💼</span> Retorno do Almoço
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Horário que voltou do almoço</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, -15))}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold"
                      >
                        -15m
                      </button>
                      <input
                        type="time"
                        value={horaRetornoAlmoco}
                        onChange={(e) => setHoraRetornoAlmoco(e.target.value)}
                        className="w-24 text-center text-lg font-bold font-mono py-1 px-1.5 rounded bg-white/15 text-white border border-white/20 outline-none"
                      />
                      <button
                        onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, +15))}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold"
                      >
                        +15m
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Ações da Etapa 2 */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setEtapa("selecao")}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
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
            <div className="w-20 h-20 rounded-full bg-teal-500/20 text-teal-300 border-2 border-teal-400 flex items-center justify-center shadow-xl">
              <CheckCircle2 className="w-10 h-10 animate-pulse stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-white">Registrando Ponto...</h3>
              <p className="text-xs text-slate-300 font-medium">Validando jornada e direcionando para confirmação</p>
            </div>
          </div>
        )}
      </div>

      {/* RODAPÉ */}
      <div className="h-4 shrink-0" />
    </div>
  )
}
