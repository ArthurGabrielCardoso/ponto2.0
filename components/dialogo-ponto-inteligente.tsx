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

  // Etapa: "selecao" (3 botões) -> "ajuste" (seletor de horários) -> "processando" (check de confirmação)
  const [etapa, setEtapa] = useState<"selecao" | "ajuste" | "processando">("selecao")
  const [tempoRestante, setTempoRestante] = useState(45)

  // Horários para ajuste retroativo
  const [horaChegada, setHoraChegada] = useState(horariosSugeridos?.horaChegada || horariosGrade.entrada || "08:00")
  const [horaSaidaAlmoco, setHoraSaidaAlmoco] = useState(horariosSugeridos?.horaSaidaAlmoco || horariosGrade.saidaAlmoco || "12:00")
  const [horaRetornoAlmoco, setHoraRetornoAlmoco] = useState(horariosSugeridos?.horaRetornoAlmoco || horariosGrade.retornoAlmoco || "13:00")

  // Horário atual formatado HH:MM
  const horaAtualStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  // Voz de instrução
  useEffect(() => {
    let textoVoz = `Olá, ${primeiroNome}! Notamos que sua jornada de hoje precisa de confirmação. Por favor, selecione uma das opções na tela.`
    if (tipo === "PERGUNTA_ENTRADA_OU_ALMOCO") {
      textoVoz = `Olá, ${primeiroNome}! Você ainda não registrou sua entrada hoje. Você está entrando agora, saindo para o almoço ou encerrando seu dia?`
    } else if (tipo === "PERGUNTA_RETORNO_OU_SAIDA") {
      textoVoz = `Olá, ${primeiroNome}! Você esqueceu de bater o retorno do almoço? Que horas você retornou?`
    }
    reproduzirVozSaudacao(textoVoz)
  }, [tipo, primeiroNome])

  // Temporizador de auto-cancelamento
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

  // Avançar da seleção para o próximo passo
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
      }, 700)
    } else {
      setEtapa("ajuste")
    }
  }

  // Confirmar ajustes e registrar
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
    }, 700)
  }

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-300">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col justify-between max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-gray-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={130} height={65} priority style={{ height: "auto" }} />
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-md">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Verificação Inteligente</span>
            </div>
          </div>
          <span className="text-xs text-gray-400 font-medium">Tempo: {tempoRestante}s</span>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          {/* Saudação */}
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Olá, <span style={{ color: "#c69e6b" }}>{primeiroNome}</span>!
            </h2>
            <p className="text-sm text-gray-500 font-medium">
              {etapa === "selecao" && "Identificamos inconsistências nos registros de hoje. Selecione o que você está fazendo agora:"}
              {etapa === "ajuste" && "Ajuste os horários estimados da sua jornada para regularizarmos tudo com precisão:"}
              {etapa === "processando" && "Processando e validando seus registros de ponto..."}
            </p>
          </div>

          {/* ======================= ETAPA 1: OS 3 BOTÕES LADO A LADO ======================= */}
          {etapa === "selecao" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                {/* Opção 1: Chegando Agora */}
                <button
                  type="button"
                  onClick={() => setOpcaoSelecionada("entrada_agora")}
                  className={`p-5 rounded-xl text-left transition-all duration-200 flex flex-col justify-between h-44 relative ${
                    opcaoSelecionada === "entrada_agora"
                      ? "bg-teal-50 border-2 border-teal-600 text-teal-950 shadow-md ring-2 ring-teal-400/20"
                      : "bg-gray-100/90 border border-gray-200/80 text-gray-700 hover:bg-gray-200/70"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-3xl">🌤️</span>
                    {opcaoSelecionada === "entrada_agora" && (
                      <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-sm">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-base leading-tight">Chegando Agora</div>
                    <p className="text-xs opacity-75">Registrar minha Entrada agora ({horaAtualStr})</p>
                  </div>
                </button>

                {/* Opção 2: Saindo para o Almoço */}
                <button
                  type="button"
                  onClick={() => setOpcaoSelecionada("saida_almoco")}
                  className={`p-5 rounded-xl text-left transition-all duration-200 flex flex-col justify-between h-44 relative ${
                    opcaoSelecionada === "saida_almoco"
                      ? "bg-teal-50 border-2 border-teal-600 text-teal-950 shadow-md ring-2 ring-teal-400/20"
                      : "bg-gray-100/90 border border-gray-200/80 text-gray-700 hover:bg-gray-200/70"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-3xl">🍽️</span>
                    {opcaoSelecionada === "saida_almoco" && (
                      <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-sm">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-base leading-tight">Saindo p/ Almoço</div>
                    <p className="text-xs opacity-75">Esqueci a entrada da manhã e quero ajustar</p>
                  </div>
                </button>

                {/* Opção 3: Encerrando Expediente */}
                <button
                  type="button"
                  onClick={() => setOpcaoSelecionada("encerrando_expediente")}
                  className={`p-5 rounded-xl text-left transition-all duration-200 flex flex-col justify-between h-44 relative ${
                    opcaoSelecionada === "encerrando_expediente"
                      ? "bg-teal-50 border-2 border-teal-600 text-teal-950 shadow-md ring-2 ring-teal-400/20"
                      : "bg-gray-100/90 border border-gray-200/80 text-gray-700 hover:bg-gray-200/70"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-3xl">🌙</span>
                    {opcaoSelecionada === "encerrando_expediente" && (
                      <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-sm">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-base leading-tight">Indo Embora</div>
                    <p className="text-xs opacity-75">Não bati nenhum ponto hoje e vou preencher</p>
                  </div>
                </button>
              </div>

              {/* Botão de Ação: Avançar */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  onClick={onCancelar}
                  className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <Button
                  onClick={handleAvancarSelecao}
                  className="px-8 py-3 h-12 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm"
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
            <div className="space-y-5">
              <div className="space-y-4 bg-slate-50/80 p-5 rounded-2xl border border-gray-200">
                {/* Ajuste de Horário de Entrada */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase font-bold text-teal-800 tracking-wider flex items-center gap-1.5">
                      <span>🌤️</span> Horário de Entrada da Manhã
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">Que horas você chegou para trabalhar hoje?</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHoraChegada(ajustarMinutos(horaChegada, -15))}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                    >
                      -15m
                    </button>
                    <input
                      type="time"
                      value={horaChegada}
                      onChange={(e) => setHoraChegada(e.target.value)}
                      className="w-28 text-center text-xl font-bold font-mono py-1.5 px-2 rounded-lg border border-gray-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
                    />
                    <button
                      onClick={() => setHoraChegada(ajustarMinutos(horaChegada, +15))}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                    >
                      +15m
                    </button>
                  </div>
                </div>

                {/* Campos adicionais para o caso de encerrar o dia inteiro */}
                {opcaoSelecionada === "encerrando_expediente" && (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs uppercase font-bold text-amber-800 tracking-wider flex items-center gap-1.5">
                          <span>🍽️</span> Saída para o Almoço
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">Horário que saiu para almoçar</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setHoraSaidaAlmoco(ajustarMinutos(horaSaidaAlmoco, -15))}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                        >
                          -15m
                        </button>
                        <input
                          type="time"
                          value={horaSaidaAlmoco}
                          onChange={(e) => setHoraSaidaAlmoco(e.target.value)}
                          className="w-28 text-center text-xl font-bold font-mono py-1.5 px-2 rounded-lg border border-gray-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
                        />
                        <button
                          onClick={() => setHoraSaidaAlmoco(ajustarMinutos(horaSaidaAlmoco, +15))}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                        >
                          +15m
                        </button>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs uppercase font-bold text-teal-800 tracking-wider flex items-center gap-1.5">
                          <span>💼</span> Retorno do Almoço
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">Horário que voltou do almoço</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, -15))}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                        >
                          -15m
                        </button>
                        <input
                          type="time"
                          value={horaRetornoAlmoco}
                          onChange={(e) => setHoraRetornoAlmoco(e.target.value)}
                          className="w-28 text-center text-xl font-bold font-mono py-1.5 px-2 rounded-lg border border-gray-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
                        />
                        <button
                          onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, +15))}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                        >
                          +15m
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Botões de Ação do Ajuste */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => setEtapa("selecao")}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-800"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar às Opções</span>
                </button>
                <Button
                  onClick={handleConfirmarAjustes}
                  className="px-8 py-3 h-12 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all"
                  style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
                >
                  Confirmar e Registrar Ponto
                </Button>
              </div>
            </div>
          )}

          {/* ======================= ETAPA 3: PROCESSANDO COM CHECK ======================= */}
          {etapa === "processando" && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 rounded-full bg-teal-50 text-teal-600 border-2 border-teal-500 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-10 h-10 animate-pulse stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-gray-900">Registrando Ponto...</h3>
                <p className="text-xs text-gray-500 font-medium">Validando jornada e direcionando para confirmação</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
