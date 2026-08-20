"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clock, CheckCircle2, AlertCircle, ArrowLeft, Sun, Coffee, Briefcase, Moon, Sparkles } from "lucide-react"
import type { DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"
import { horaParaMinutos, minutosParaHoraStr } from "@/lib/logica-ponto-inteligente"
import { formatarHora } from "@/lib/utils-ponto"
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
}

export function DialogoPontoInteligente({
  nome,
  diagnostico,
  onConfirmar,
  onCancelar,
}: DialogoPontoInteligenteProps) {
  const primeiroNome = nome.split(" ")[0]
  const { tipo, horariosGrade, horariosSugeridos, registrosHoje } = diagnostico

  // Estados locais para inputs de horário esquecido
  const [horaChegada, setHoraChegada] = useState(horariosSugeridos?.horaChegada || horariosGrade.entrada || "08:00")
  const [horaSaidaAlmoco, setHoraSaidaAlmoco] = useState(horariosSugeridos?.horaSaidaAlmoco || horariosGrade.saidaAlmoco || "12:00")
  const [horaRetornoAlmoco, setHoraRetornoAlmoco] = useState(horariosSugeridos?.horaRetornoAlmoco || horariosGrade.retornoAlmoco || "13:00")
  const [etapaAjuste, setEtapaAjuste] = useState<"escolha" | "ajuste_chegada" | "ajuste_almoco" | "ajuste_retorno">("escolha")
  const [tempoRestante, setTempoRestante] = useState(45) // 45s countdown

  // Auto-cancelar por inatividade
  useEffect(() => {
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
  }, [onCancelar])

  // Cria ISO Date com horário específico hoje
  const criarIsoHoje = (horaStr: string): string => {
    const d = new Date()
    const [h, m] = horaStr.split(":").map(Number)
    d.setHours(h || 0, m || 0, 0, 0)
    return d.toISOString()
  }

  // Ajustador rápido de minutos
  const ajustarMinutos = (horaAtual: string, deltaMin: number): string => {
    const m = horaParaMinutos(horaAtual) + deltaMin
    return minutosParaHoraStr(m)
  }

  // =========================================================================
  // HANDLERS PARA CADA CENÁRIO
  // =========================================================================

  // Cenário 1: 0 batidas perto do almoço
  const handleEntradaNormalAgora = () => {
    const agora = new Date().toISOString()
    onConfirmar(
      [{ tipo: "Entrada", dataHoraIso: agora }],
      "Entrada",
      `Excelente dia e bom trabalho, ${primeiroNome}!`
    )
  }

  const handleConfirmarEntradaRetroativaESaidaAlmoco = () => {
    const isoChegada = criarIsoHoje(horaChegada)
    const agora = new Date().toISOString()
    onConfirmar(
      [
        { tipo: "Entrada", dataHoraIso: isoChegada },
        { tipo: "Saída Almoço", dataHoraIso: agora },
      ],
      "Saída Almoço",
      `Excelente almoço, ${primeiroNome}! Aproveite seu almoço e bom descanso!`
    )
  }

  // Cenário 2: 1 batida e já é fim de tarde
  const handleSaidaAlmocoNormalAgora = () => {
    const agora = new Date().toISOString()
    onConfirmar(
      [{ tipo: "Saída Almoço", dataHoraIso: agora }],
      "Saída Almoço",
      `Excelente almoço, ${primeiroNome}! Aproveite seu almoço e bom descanso!`
    )
  }

  const handleConfirmarAlmocoPadraoESaida = (saidaAlm: string, retAlm: string) => {
    const isoSaidaAlm = criarIsoHoje(saidaAlm)
    const isoRetAlm = criarIsoHoje(retAlm)
    const agora = new Date().toISOString()
    onConfirmar(
      [
        { tipo: "Saída Almoço", dataHoraIso: isoSaidaAlm },
        { tipo: "Retorno Almoço", dataHoraIso: isoRetAlm },
        { tipo: "Saída", dataHoraIso: agora },
      ],
      "Saída",
      `Excelente noite e bom descanso, ${primeiroNome}!`
    )
  }

  // Cenário 3: 2 batidas e já é fim de tarde (Jéssica)
  const handleRetornoAlmocoNormalAgora = () => {
    const agora = new Date().toISOString()
    onConfirmar(
      [{ tipo: "Retorno Almoço", dataHoraIso: agora }],
      "Retorno Almoço",
      `Excelente retorno ao trabalho, ${primeiroNome}!`
    )
  }

  const handleConfirmarRetornoRetroativoESaida = () => {
    const isoRetorno = criarIsoHoje(horaRetornoAlmoco)
    const agora = new Date().toISOString()
    onConfirmar(
      [
        { tipo: "Retorno Almoço", dataHoraIso: isoRetorno },
        { tipo: "Saída", dataHoraIso: agora },
      ],
      "Saída",
      `Excelente noite e bom descanso, ${primeiroNome}!`
    )
  }

  // Gradiente e frase da coluna direita baseados no cenário
  const getLadoDireito = () => {
    switch (tipo) {
      case "PERGUNTA_ENTRADA_OU_ALMOCO":
        return {
          gradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
          frase: "Vamos garantir que suas horas de hoje fiquem perfeitamente registradas!",
        }
      case "PERGUNTA_ALMOCO_OU_SAIDA":
        return {
          gradient: "linear-gradient(135deg, #1db9b3 0%, #16918d 50%, #0d8488 100%)",
          frase: "Cuidamos de tudo para manter sua jornada diária 100% precisa!",
        }
      case "PERGUNTA_RETORNO_OU_SAIDA":
        return {
          gradient: "linear-gradient(135deg, #2d3561 0%, #1e215d 50%, #0b0c2a 100%)",
          frase: "Esqueceu de bater o retorno do almoço? Nós regularizamos com você num toque!",
        }
      case "DIA_COMPLETO":
        return {
          gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          frase: "Seu expediente de hoje foi totalmente registrado com sucesso!",
        }
      default:
        return {
          gradient: "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)",
          frase: "Sistema Inteligente de Controle de Ponto",
        }
    }
  }

  const ladoDireito = getLadoDireito()

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-white ponto-batido-container overflow-hidden">
      {/* LADO ESQUERDO - Form e Decisões */}
      <div className="ponto-batido-form-section relative flex flex-col justify-between p-8 sm:p-12 overflow-y-auto">
        {/* Topo: Logo */}
        <div className="w-full max-w-xl mx-auto flex items-center justify-between pt-2">
          <Image
            src="/logo.png"
            alt="Logo"
            width={140}
            height={70}
            priority
            style={{ height: "auto" }}
          />
          <div className="flex items-center gap-1.5 text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Verificação Inteligente</span>
          </div>
        </div>

        {/* Centro: Conteúdo Principal */}
        <div className="w-full max-w-xl mx-auto my-auto py-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "#c69e6b" }}>
                Olá, {primeiroNome}!
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Verificação da sua grade semanal de trabalho
              </p>
            </div>

            {/* ================================================================= */}
            {/* CASO: DIA COMPLETO (4 REGISTROS) */}
            {/* ================================================================= */}
            {tipo === "DIA_COMPLETO" && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                  <p className="text-sm font-medium">
                    Todos os 4 registros do seu expediente de hoje já foram preenchidos com sucesso:
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {registrosHoje.map((r, i) => (
                    <div key={r.id || i} className="rounded-xl bg-gray-50 border p-3.5 shadow-sm">
                      <span className="text-xs text-gray-500 font-medium block">{r.tipo || `Registro ${i + 1}`}</span>
                      <span className="text-lg font-bold text-teal-700">{formatarHora(r.data_hora)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <Button
                    onClick={onCancelar}
                    className="w-full bg-primary hover:bg-primary/90 text-white py-4 rounded-xl font-semibold text-base shadow-lg transition-all"
                  >
                    Entendido / Voltar
                  </Button>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* CASO 1: PERGUNTA ENTRADA OU ALMOÇO */}
            {/* ================================================================= */}
            {tipo === "PERGUNTA_ENTRADA_OU_ALMOCO" && (
              <>
                {etapaAjuste === "escolha" && (
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                      <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm">
                        Não identifiquei sua entrada pela manhã e já estamos próximos ao horário de almoço ({horariosGrade.saidaAlmoco}). Como deseja registrar?
                      </p>
                    </div>

                    <div className="grid gap-3.5">
                      <button
                        onClick={handleEntradaNormalAgora}
                        className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 border-teal-200 bg-teal-50/50 hover:bg-teal-100 hover:border-teal-400 text-left transition-all group shadow-sm active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="text-3xl p-2 rounded-xl bg-white shadow-sm">🌤️</div>
                          <div>
                            <p className="font-bold text-gray-900 text-base group-hover:text-teal-900">Iniciar Trabalho Agora</p>
                            <p className="text-xs text-gray-500 mt-0.5">Estou chegando para iniciar meu expediente neste momento</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-teal-600 text-white px-3 py-1.5 rounded-lg shadow-sm">Entrada</span>
                      </button>

                      <button
                        onClick={() => setEtapaAjuste("ajuste_chegada")}
                        className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 border-orange-200 bg-orange-50/50 hover:bg-orange-100 hover:border-orange-400 text-left transition-all group shadow-sm active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="text-3xl p-2 rounded-xl bg-white shadow-sm">🍽️</div>
                          <div>
                            <p className="font-bold text-gray-900 text-base group-hover:text-orange-900">Saindo para o Almoço</p>
                            <p className="text-xs text-gray-500 mt-0.5">Cheguei de manhã, esqueci a entrada e estou saindo para almoçar</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-orange-600 text-white px-3 py-1.5 rounded-lg shadow-sm">Almoço + Entrada</span>
                      </button>
                    </div>
                  </div>
                )}

                {etapaAjuste === "ajuste_chegada" && (
                  <div className="space-y-5">
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-bold text-gray-900">Que horas você chegou hoje de manhã?</h3>
                      <p className="text-sm text-gray-500">Horário previsto na sua grade: <span className="font-semibold text-teal-700">{horariosGrade.entrada}</span></p>
                    </div>

                    <div className="flex items-center justify-center gap-3 py-4">
                      <Button variant="outline" className="h-12 px-4 text-sm font-semibold rounded-xl" onClick={() => setHoraChegada(ajustarMinutos(horaChegada, -15))}>-15 min</Button>
                      <Input
                        type="time"
                        value={horaChegada}
                        onChange={(e) => setHoraChegada(e.target.value)}
                        className="w-40 text-center text-3xl font-extrabold h-14 rounded-2xl border-2 border-teal-500 shadow-sm"
                      />
                      <Button variant="outline" className="h-12 px-4 text-sm font-semibold rounded-xl" onClick={() => setHoraChegada(ajustarMinutos(horaChegada, 15))}>+15 min</Button>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setEtapaAjuste("escolha")} className="flex-1 py-4 h-auto text-base rounded-xl">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                      </Button>
                      <Button onClick={handleConfirmarEntradaRetroativaESaidaAlmoco} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-4 h-auto text-base font-semibold rounded-xl shadow-md">
                        Confirmar e Almoçar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ================================================================= */}
            {/* CASO 2: PERGUNTA ALMOÇO OU SAÍDA (TINHA APENAS ENTRADA) */}
            {/* ================================================================= */}
            {tipo === "PERGUNTA_ALMOCO_OU_SAIDA" && (
              <>
                {etapaAjuste === "escolha" && (
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                      <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm">
                        Só registrei sua entrada hoje cedo e já estamos no fim da tarde. Você está saindo para o almoço ou finalizando o expediente?
                      </p>
                    </div>

                    <div className="grid gap-3.5">
                      <button
                        onClick={handleSaidaAlmocoNormalAgora}
                        className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 border-orange-200 bg-orange-50/50 hover:bg-orange-100 hover:border-orange-400 text-left transition-all group shadow-sm active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="text-3xl p-2 rounded-xl bg-white shadow-sm">🍽️</div>
                          <div>
                            <p className="font-bold text-gray-900 text-base group-hover:text-orange-900">Saindo para o Almoço Agora</p>
                            <p className="text-xs text-gray-500 mt-0.5">Estou indo almoçar neste momento</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-orange-600 text-white px-3 py-1.5 rounded-lg shadow-sm">Saída Almoço</span>
                      </button>

                      <button
                        onClick={() => setEtapaAjuste("ajuste_almoco")}
                        className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 hover:border-indigo-400 text-left transition-all group shadow-sm active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="text-3xl p-2 rounded-xl bg-white shadow-sm">🌙</div>
                          <div>
                            <p className="font-bold text-gray-900 text-base group-hover:text-indigo-900">Finalizando o Expediente (Indo Embora)</p>
                            <p className="text-xs text-gray-500 mt-0.5">Já almocei mais cedo e estou indo para casa</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-sm">Saída</span>
                      </button>
                    </div>
                  </div>
                )}

                {etapaAjuste === "ajuste_almoco" && (
                  <div className="space-y-5">
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-bold text-gray-900">Confirmação do Intervalo de Almoço</h3>
                      <p className="text-sm text-gray-500">
                        Horário previsto na sua grade: <span className="font-semibold text-teal-700">{horariosGrade.saidaAlmoco} às {horariosGrade.retornoAlmoco}</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-600">Saída Almoço</Label>
                        <Input
                          type="time"
                          value={horaSaidaAlmoco}
                          onChange={(e) => setHoraSaidaAlmoco(e.target.value)}
                          className="text-center text-xl font-bold h-12 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-600">Retorno Almoço</Label>
                        <Input
                          type="time"
                          value={horaRetornoAlmoco}
                          onChange={(e) => setHoraRetornoAlmoco(e.target.value)}
                          className="text-center text-xl font-bold h-12 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setEtapaAjuste("escolha")} className="flex-1 py-4 h-auto text-base rounded-xl">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                      </Button>
                      <Button
                        onClick={() => handleConfirmarAlmocoPadraoESaida(horaSaidaAlmoco, horaRetornoAlmoco)}
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-4 h-auto text-base font-semibold rounded-xl shadow-md"
                      >
                        Confirmar e Finalizar Dia
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ================================================================= */}
            {/* CASO 3: PERGUNTA RETORNO OU SAÍDA (CASO JÉSSICA) */}
            {/* ================================================================= */}
            {tipo === "PERGUNTA_RETORNO_OU_SAIDA" && (
              <>
                {etapaAjuste === "escolha" && (
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                      <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm">
                        Acredito que você esqueceu de registrar o retorno do almoço mais cedo. Você está voltando do almoço agora ou já está finalizando seu expediente?
                      </p>
                    </div>

                    <div className="grid gap-3.5">
                      <button
                        onClick={handleRetornoAlmocoNormalAgora}
                        className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 border-teal-200 bg-teal-50/50 hover:bg-teal-100 hover:border-teal-400 text-left transition-all group shadow-sm active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="text-3xl p-2 rounded-xl bg-white shadow-sm">💼</div>
                          <div>
                            <p className="font-bold text-gray-900 text-base group-hover:text-teal-900">Voltando do Almoço Agora</p>
                            <p className="text-xs text-gray-500 mt-0.5">Estou retornando ao trabalho neste momento</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-teal-600 text-white px-3 py-1.5 rounded-lg shadow-sm">Retorno</span>
                      </button>

                      <button
                        onClick={() => setEtapaAjuste("ajuste_retorno")}
                        className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 hover:border-indigo-400 text-left transition-all group shadow-sm active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="text-3xl p-2 rounded-xl bg-white shadow-sm">🌙</div>
                          <div>
                            <p className="font-bold text-gray-900 text-base group-hover:text-indigo-900">Finalizando o Expediente (Indo Embora)</p>
                            <p className="text-xs text-gray-500 mt-0.5">Retornei do almoço mais cedo e agora estou indo para casa</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-sm">Retorno + Saída</span>
                      </button>
                    </div>
                  </div>
                )}

                {etapaAjuste === "ajuste_retorno" && (
                  <div className="space-y-5">
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-bold text-gray-900">Que horas você retornou do almoço?</h3>
                      <p className="text-sm text-gray-500">Horário previsto na sua grade: <span className="font-semibold text-teal-700">{horariosGrade.retornoAlmoco}</span></p>
                    </div>

                    <div className="flex items-center justify-center gap-3 py-4">
                      <Button variant="outline" className="h-12 px-4 text-sm font-semibold rounded-xl" onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, -15))}>-15 min</Button>
                      <Input
                        type="time"
                        value={horaRetornoAlmoco}
                        onChange={(e) => setHoraRetornoAlmoco(e.target.value)}
                        className="w-40 text-center text-3xl font-extrabold h-14 rounded-2xl border-2 border-teal-500 shadow-sm"
                      />
                      <Button variant="outline" className="h-12 px-4 text-sm font-semibold rounded-xl" onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, 15))}>+15 min</Button>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setEtapaAjuste("escolha")} className="flex-1 py-4 h-auto text-base rounded-xl">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                      </Button>
                      <Button onClick={handleConfirmarRetornoRetroativoESaida} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-4 h-auto text-base font-semibold rounded-xl shadow-md">
                        Confirmar e Finalizar Dia
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Barra de Progresso do Auto-retorno */}
            <div className="pt-2">
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-teal-600 h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(tempoRestante / 45) * 100}%` }}
                />
              </div>
              <p className="text-right text-[11px] text-gray-400 mt-1 font-mono">{tempoRestante}s restantes</p>
            </div>
          </div>
        </div>

        {/* Rodapé: Botão Voltar */}
        <div className="w-full max-w-xl mx-auto pt-2 pb-1">
          <Button
            variant="ghost"
            onClick={onCancelar}
            className="text-gray-500 hover:text-gray-900 text-sm font-medium"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Cancelar e Voltar
          </Button>
        </div>
      </div>

      {/* LADO DIREITO - Gradiente Elegante & Logo */}
      <div
        className="ponto-batido-image-section"
        style={{ background: ladoDireito.gradient }}
      >
        <div className="text-center p-8">
          <Image
            src="/logo.png"
            alt="Logo"
            width={500}
            height={200}
            priority
            style={{ height: "auto" }}
          />
          <p className="text-white/80 text-lg mt-6 font-light max-w-sm mx-auto leading-relaxed">
            {ladoDireito.frase}
          </p>
        </div>
      </div>
    </div>
  )
}
