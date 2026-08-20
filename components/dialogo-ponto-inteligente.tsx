"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clock, CheckCircle2, AlertCircle, ArrowLeft, Sun, Coffee, Briefcase, Moon } from "lucide-react"
import type { DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"
import { horaParaMinutos, minutosParaHoraStr } from "@/lib/logica-ponto-inteligente"
import { formatarHora } from "@/lib/utils-ponto"

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
      `Excelente almoço, ${primeiroNome}!`
    )
  }

  // Cenário 2: 1 batida e já é fim de tarde
  const handleSaidaAlmocoNormalAgora = () => {
    const agora = new Date().toISOString()
    onConfirmar(
      [{ tipo: "Saída Almoço", dataHoraIso: agora }],
      "Saída Almoço",
      `Excelente almoço, ${primeiroNome}!`
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
      <Card className="w-full max-w-xl bg-white shadow-2xl rounded-2xl border-0 overflow-hidden text-gray-800">
        <CardHeader className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6 relative">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
              <Clock className="h-7 w-7 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Olá, {primeiroNome}!</CardTitle>
              <CardDescription className="text-teal-100 text-sm mt-0.5">
                Confirmação inteligente de horário
              </CardDescription>
            </div>
          </div>
          <div className="absolute top-4 right-4 text-xs font-mono bg-white/20 px-2.5 py-1 rounded-full text-white">
            {tempoRestante}s
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* ================================================================= */}
          {/* CASO: DIA COMPLETO (4 REGISTROS) */}
          {/* ================================================================= */}
          {tipo === "DIA_COMPLETO" && (
            <div className="space-y-4 text-center py-2">
              <div className="inline-flex p-3 rounded-full bg-green-100 text-green-600 mb-1">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Expediente de hoje concluído!</h3>
              <p className="text-gray-600 text-sm">
                Todos os 4 registros do seu dia já foram confirmados no sistema:
              </p>

              <div className="grid grid-cols-2 gap-2 max-w-md mx-auto pt-2">
                {registrosHoje.map((r, i) => (
                  <div key={r.id || i} className="rounded-lg bg-gray-50 border p-2.5 text-left">
                    <span className="text-xs text-gray-500 font-medium block">{r.tipo || `Registro ${i + 1}`}</span>
                    <span className="text-base font-bold text-teal-700">{formatarHora(r.data_hora)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Button onClick={onCancelar} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 font-semibold text-base rounded-xl">
                  Entendido
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
                <div className="space-y-4">
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-900 flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm">
                      Não identifiquei sua entrada pela manhã e já estamos próximos ao horário de almoço ({horariosGrade.saidaAlmoco}). Como deseja registrar?
                    </p>
                  </div>

                  <div className="grid gap-3 pt-2">
                    <button
                      onClick={handleEntradaNormalAgora}
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-teal-200 bg-teal-50/50 hover:bg-teal-100/70 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🌤️</span>
                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-teal-900">Iniciar Trabalho Agora</p>
                          <p className="text-xs text-gray-500">Estou chegando para iniciar meu expediente agora</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold bg-teal-600 text-white px-2.5 py-1 rounded-md">Entrada</span>
                    </button>

                    <button
                      onClick={() => setEtapaAjuste("ajuste_chegada")}
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-orange-200 bg-orange-50/50 hover:bg-orange-100/70 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🍽️</span>
                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-orange-900">Saindo para o Almoço</p>
                          <p className="text-xs text-gray-500">Esqueci de bater a entrada de manhã e estou saindo para almoçar</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold bg-orange-600 text-white px-2.5 py-1 rounded-md">Almoço + Entrada</span>
                    </button>
                  </div>
                </div>
              )}

              {etapaAjuste === "ajuste_chegada" && (
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <h3 className="font-semibold text-gray-900">Que horas você chegou hoje de manhã?</h3>
                    <p className="text-xs text-gray-500">Sugerido conforme sua grade: {horariosGrade.entrada}</p>
                  </div>

                  <div className="flex items-center justify-center gap-3 py-2">
                    <Button variant="outline" size="sm" onClick={() => setHoraChegada(ajustarMinutos(horaChegada, -15))}>-15 min</Button>
                    <Input
                      type="time"
                      value={horaChegada}
                      onChange={(e) => setHoraChegada(e.target.value)}
                      className="w-36 text-center text-2xl font-bold h-12 rounded-xl"
                    />
                    <Button variant="outline" size="sm" onClick={() => setHoraChegada(ajustarMinutos(horaChegada, 15))}>+15 min</Button>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <Button variant="outline" onClick={() => setEtapaAjuste("escolha")} className="flex-1">
                      <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                    </Button>
                    <Button onClick={handleConfirmarEntradaRetroativaESaidaAlmoco} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
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
                <div className="space-y-4">
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-900 flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm">
                      Só registrei sua entrada pela manhã e já estamos no fim da tarde. Você está saindo para o almoço ou finalizando o expediente?
                    </p>
                  </div>

                  <div className="grid gap-3 pt-2">
                    <button
                      onClick={handleSaidaAlmocoNormalAgora}
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-orange-200 bg-orange-50/50 hover:bg-orange-100/70 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🍽️</span>
                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-orange-900">Saindo para o Almoço Agora</p>
                          <p className="text-xs text-gray-500">Estou indo almoçar neste momento</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold bg-orange-600 text-white px-2.5 py-1 rounded-md">Saída Almoço</span>
                    </button>

                    <button
                      onClick={() => setEtapaAjuste("ajuste_almoco")}
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🌙</span>
                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-indigo-900">Indo Embora (Fim de Expediente)</p>
                          <p className="text-xs text-gray-500">Já almocei mais cedo e estou finalizando o dia</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold bg-indigo-600 text-white px-2.5 py-1 rounded-md">Saída</span>
                    </button>
                  </div>
                </div>
              )}

              {etapaAjuste === "ajuste_almoco" && (
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <h3 className="font-semibold text-gray-900">Confirmação do Intervalo de Almoço</h3>
                    <p className="text-xs text-gray-500">
                      Horário programado da sua grade: {horariosGrade.saidaAlmoco} às {horariosGrade.retornoAlmoco}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Saída Almoço</Label>
                      <Input
                        type="time"
                        value={horaSaidaAlmoco}
                        onChange={(e) => setHoraSaidaAlmoco(e.target.value)}
                        className="text-center text-lg font-bold h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Retorno Almoço</Label>
                      <Input
                        type="time"
                        value={horaRetornoAlmoco}
                        onChange={(e) => setHoraRetornoAlmoco(e.target.value)}
                        className="text-center text-lg font-bold h-10"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <Button variant="outline" onClick={() => setEtapaAjuste("escolha")} className="flex-1">
                      <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                    </Button>
                    <Button
                      onClick={() => handleConfirmarAlmocoPadraoESaida(horaSaidaAlmoco, horaRetornoAlmoco)}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
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
                <div className="space-y-4">
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-900 flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm">
                      Acredito que você esqueceu de registrar o retorno do almoço mais cedo. Você está voltando do almoço agora ou já está finalizando seu expediente?
                    </p>
                  </div>

                  <div className="grid gap-3 pt-2">
                    <button
                      onClick={handleRetornoAlmocoNormalAgora}
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-teal-200 bg-teal-50/50 hover:bg-teal-100/70 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">💼</span>
                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-teal-900">Voltando do Almoço Agora</p>
                          <p className="text-xs text-gray-500">Estou retornando ao trabalho neste momento</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold bg-teal-600 text-white px-2.5 py-1 rounded-md">Retorno</span>
                    </button>

                    <button
                      onClick={() => setEtapaAjuste("ajuste_retorno")}
                      className="flex items-center justify-between p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🌙</span>
                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-indigo-900">Finalizando o Expediente (Indo Embora)</p>
                          <p className="text-xs text-gray-500">Retornei do almoço mais cedo e agora estou indo embora</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold bg-indigo-600 text-white px-2.5 py-1 rounded-md">Retorno + Saída</span>
                    </button>
                  </div>
                </div>
              )}

              {etapaAjuste === "ajuste_retorno" && (
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <h3 className="font-semibold text-gray-900">Que horas você retornou do almoço?</h3>
                    <p className="text-xs text-gray-500">Horário previsto na sua grade: {horariosGrade.retornoAlmoco}</p>
                  </div>

                  <div className="flex items-center justify-center gap-3 py-2">
                    <Button variant="outline" size="sm" onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, -15))}>-15 min</Button>
                    <Input
                      type="time"
                      value={horaRetornoAlmoco}
                      onChange={(e) => setHoraRetornoAlmoco(e.target.value)}
                      className="w-36 text-center text-2xl font-bold h-12 rounded-xl"
                    />
                    <Button variant="outline" size="sm" onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, 15))}>+15 min</Button>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <Button variant="outline" onClick={() => setEtapaAjuste("escolha")} className="flex-1">
                      <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                    </Button>
                    <Button onClick={handleConfirmarRetornoRetroativoESaida} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                      Confirmar e Finalizar Dia
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
