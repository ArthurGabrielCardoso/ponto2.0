"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clock, CheckCircle2, AlertCircle, ArrowLeft, Sun, Coffee, Briefcase, Moon, Sparkles, Volume2 } from "lucide-react"
import type { DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"
import { horaParaMinutos, minutosParaHoraStr } from "@/lib/logica-ponto-inteligente"
import { formatarHora } from "@/lib/utils-ponto"
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

export function DialogoPontoInteligente({
  nome,
  diagnostico,
  onConfirmar,
  onCancelar,
  modoDemonstracao = false,
}: DialogoPontoInteligenteProps) {
  const primeiroNome = nome.split(" ")[0]
  const { tipo, horariosGrade, horariosSugeridos, registrosHoje } = diagnostico

  // Estados locais para inputs de horário esquecido
  const [horaChegada, setHoraChegada] = useState(horariosSugeridos?.horaChegada || horariosGrade.entrada || "08:00")
  const [horaSaidaAlmoco, setHoraSaidaAlmoco] = useState(horariosSugeridos?.horaSaidaAlmoco || horariosGrade.saidaAlmoco || "12:00")
  const [horaRetornoAlmoco, setHoraRetornoAlmoco] = useState(horariosSugeridos?.horaRetornoAlmoco || horariosGrade.retornoAlmoco || "13:00")
  const [etapaAjuste, setEtapaAjuste] = useState<"escolha" | "ajuste_chegada" | "ajuste_almoco" | "ajuste_retorno">("escolha")
  const [tempoRestante, setTempoRestante] = useState(45)

  // Gerar e reproduzir voz explicativa com Google Cloud TTS
  const getTextoVoz = (): string => {
    switch (tipo) {
      case "PERGUNTA_ENTRADA_OU_ALMOCO":
        return `Olá, ${primeiroNome}! Notamos que você ainda não registrou sua entrada hoje. Você está entrando agora ou saindo para o almoço?`
      case "PERGUNTA_ALMOCO_OU_SAIDA":
        return `Olá, ${primeiroNome}! Você não registrou o almoço hoje. Você está saindo para o almoço agora ou encerrando seu expediente?`
      case "PERGUNTA_RETORNO_OU_SAIDA":
        return `Olá, ${primeiroNome}! Parece que você esqueceu de registrar o retorno do seu almoço. Que horas você voltou?`
      default:
        return `Olá, ${primeiroNome}! Por favor, confirme seu registro de ponto.`
    }
  }

  useEffect(() => {
    const textoVoz = getTextoVoz()
    if (textoVoz) {
      reproduzirVozSaudacao(textoVoz)
    }
  }, [tipo, primeiroNome])

  // Auto-cancelar por inatividade (apenas se não estiver no modo demonstração)
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

  // Cria ISO Date com horário específico hoje
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

  // Handlers
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

  const handleRetornoAlmocoNormalAgora = () => {
    const agora = new Date().toISOString()
    onConfirmar(
      [{ tipo: "Retorno Almoço", dataHoraIso: agora }],
      "Retorno Almoço",
      `Excelente retorno ao trabalho, ${primeiroNome}! Bom trabalho nesta tarde!`
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

  const getLadoDireito = () => {
    switch (tipo) {
      case "PERGUNTA_ENTRADA_OU_ALMOCO":
        return {
          gradient: "linear-gradient(135deg, #c69e6b 0%, #b88d57 50%, #8c5e28 100%)",
          frase: "Vamos garantir que suas horas de hoje fiquem perfeitamente registradas!",
        }
      case "PERGUNTA_ALMOCO_OU_SAIDA":
        return {
          gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #9a3412 100%)",
          frase: "Cuidamos de tudo para manter sua jornada diária 100% precisa!",
        }
      case "PERGUNTA_RETORNO_OU_SAIDA":
        return {
          gradient: "linear-gradient(135deg, #1db9b3 0%, #16918d 50%, #0d8488 100%)",
          frase: "Esqueceu de bater o retorno do almoço? Nós regularizamos com você em 1 toque!",
        }
      default:
        return {
          gradient: "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)",
          frase: "Sistema Inteligente de Controle de Ponto Vitall",
        }
    }
  }

  const ladoDireito = getLadoDireito()

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-white flex flex-col md:flex-row overflow-hidden select-none animate-in fade-in duration-300">
      {/* LADO ESQUERDO - Formulário e Escolhas em Dourado e Glassmorphism */}
      <div className="w-full md:w-[58%] h-full flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative bg-gradient-to-b from-white via-amber-50/15 to-white overflow-y-auto">
        {/* Topo */}
        <div className="flex items-center justify-between">
          <Image src="/logo.png" alt="Logo" width={150} height={75} priority style={{ height: "auto" }} />
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-200/80 px-3.5 py-1.5 rounded-full shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Verificação Inteligente</span>
          </div>
        </div>

        {/* Centro */}
        <div className="my-auto max-w-lg mx-auto w-full py-6 space-y-6">
          <div className="space-y-1 text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "#c69e6b" }}>
              Olá, {primeiroNome}!
            </h1>
            <p className="text-gray-600 text-sm sm:text-base font-medium">
              {tipo === "PERGUNTA_ENTRADA_OU_ALMOCO" && "Você ainda não registrou sua entrada hoje. O que você gostaria de fazer?"}
              {tipo === "PERGUNTA_ALMOCO_OU_SAIDA" && "Identificamos que não houve registro de almoço hoje."}
              {tipo === "PERGUNTA_RETORNO_OU_SAIDA" && "Identificamos sua saída de almoço, mas não o retorno."}
            </p>
          </div>

          {/* =================== CENÁRIO 1: 0 BATIDAS =================== */}
          {tipo === "PERGUNTA_ENTRADA_OU_ALMOCO" && (
            <div className="space-y-4">
              {etapaAjuste === "escolha" ? (
                <>
                  <button
                    onClick={handleEntradaNormalAgora}
                    className="w-full text-left p-5 rounded-2xl border-2 border-emerald-300/80 bg-emerald-50/60 hover:bg-emerald-100/70 hover:border-emerald-400 transition-all duration-200 shadow-sm flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xl shadow-md">
                        🌤️
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-base">Estou chegando agora</div>
                        <div className="text-xs text-gray-600 mt-0.5">Registrar minha Entrada agora ({new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})</div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-700 bg-white px-3 py-1 rounded-lg border border-emerald-200 shadow-sm">1 Toque</span>
                  </button>

                  <button
                    onClick={() => setEtapaAjuste("ajuste_chegada")}
                    className="w-full text-left p-5 rounded-2xl border-2 border-amber-300/80 bg-amber-50/60 hover:bg-amber-100/70 hover:border-amber-400 transition-all duration-200 shadow-sm flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-md">
                        🍽️
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-base">Já trabalhei e estou saindo pro almoço</div>
                        <div className="text-xs text-gray-600 mt-0.5">Esqueci a entrada da manhã e quero registrar ambos</div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-amber-800 bg-white px-3 py-1 rounded-lg border border-amber-200 shadow-sm">Ajustar</span>
                  </button>
                </>
              ) : (
                <div className="space-y-4 p-5 bg-white rounded-2xl border border-gray-200 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800 text-sm">Que horas você chegou hoje?</span>
                    <button onClick={() => setEtapaAjuste("escolha")} className="text-xs text-gray-500 hover:text-gray-800 font-medium">Voltar</button>
                  </div>
                  <div className="flex items-center justify-center gap-3 py-2">
                    <button onClick={() => setHoraChegada(ajustarMinutos(horaChegada, -15))} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold">-15m</button>
                    <Input type="time" value={horaChegada} onChange={(e) => setHoraChegada(e.target.value)} className="w-32 text-center text-2xl font-bold font-mono h-12" />
                    <button onClick={() => setHoraChegada(ajustarMinutos(horaChegada, +15))} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold">+15m</button>
                  </div>
                  <Button onClick={handleConfirmarEntradaRetroativaESaidaAlmoco} className="w-full text-white font-bold h-12 rounded-xl" style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}>
                    Confirmar Entrada ({horaChegada}) + Saída Almoço ({new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* =================== CENÁRIO 2: 1 BATIDA =================== */}
          {tipo === "PERGUNTA_ALMOCO_OU_SAIDA" && (
            <div className="space-y-4">
              <button
                onClick={handleSaidaAlmocoNormalAgora}
                className="w-full text-left p-5 rounded-2xl border-2 border-amber-300/80 bg-amber-50/60 hover:bg-amber-100/70 hover:border-amber-400 transition-all duration-200 shadow-sm flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-md">🍽️</div>
                  <div>
                    <div className="font-bold text-gray-900 text-base">Saindo para o almoço agora</div>
                    <div className="text-xs text-gray-600 mt-0.5">Registrar Saída Almoço às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
                <span className="text-sm font-bold text-amber-800 bg-white px-3 py-1 rounded-lg border border-amber-200 shadow-sm">1 Toque</span>
              </button>

              <button
                onClick={() => handleConfirmarAlmocoPadraoESaida(horariosGrade.saidaAlmoco || "12:00", horariosGrade.retornoAlmoco || "13:00")}
                className="w-full text-left p-5 rounded-2xl border-2 border-indigo-300/80 bg-indigo-50/60 hover:bg-indigo-100/70 hover:border-indigo-400 transition-all duration-200 shadow-sm flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-md">🌙</div>
                  <div>
                    <div className="font-bold text-gray-900 text-base">Encerrando meu expediente agora</div>
                    <div className="text-xs text-gray-600 mt-0.5">Almocei no horário padrão ({horariosGrade.saidaAlmoco || "12:00"} às {horariosGrade.retornoAlmoco || "13:00"}) e estou saindo</div>
                  </div>
                </div>
                <span className="text-sm font-bold text-indigo-800 bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-sm">Regularizar</span>
              </button>
            </div>
          )}

          {/* =================== CENÁRIO 3: 2 BATIDAS (CASO JÉSSICA) =================== */}
          {tipo === "PERGUNTA_RETORNO_OU_SAIDA" && (
            <div className="space-y-4">
              {etapaAjuste === "escolha" ? (
                <>
                  <button
                    onClick={() => setEtapaAjuste("ajuste_retorno")}
                    className="w-full text-left p-5 rounded-2xl border-2 border-emerald-400 bg-emerald-50/80 hover:bg-emerald-100/90 transition-all duration-200 shadow-md flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-md">🌙</div>
                      <div>
                        <div className="font-bold text-gray-900 text-base">Estou saindo agora (Fim do Expediente)</div>
                        <div className="text-xs text-gray-600 mt-0.5">Voltei do almoço por volta das {horaRetornoAlmoco} e estou saindo agora</div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-800 bg-white px-3 py-1 rounded-lg border border-emerald-200 shadow-sm">Recomendado</span>
                  </button>

                  <button
                    onClick={handleRetornoAlmocoNormalAgora}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all duration-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💼</span>
                      <div className="text-xs font-semibold text-gray-700">Apenas registrando retorno do almoço agora ({new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})</div>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Continuar Almoço</span>
                  </button>
                </>
              ) : (
                <div className="space-y-4 p-5 bg-white rounded-2xl border border-gray-200 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800 text-sm">Que horas você voltou do almoço?</span>
                    <button onClick={() => setEtapaAjuste("escolha")} className="text-xs text-gray-500 hover:text-gray-800 font-medium">Voltar</button>
                  </div>
                  <div className="flex items-center justify-center gap-3 py-2">
                    <button onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, -15))} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold">-15m</button>
                    <Input type="time" value={horaRetornoAlmoco} onChange={(e) => setHoraRetornoAlmoco(e.target.value)} className="w-32 text-center text-2xl font-bold font-mono h-12" />
                    <button onClick={() => setHoraRetornoAlmoco(ajustarMinutos(horaRetornoAlmoco, +15))} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold">+15m</button>
                  </div>
                  <Button onClick={handleConfirmarRetornoRetroativoESaida} className="w-full text-white font-bold h-12 rounded-xl" style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}>
                    Confirmar Retorno ({horaRetornoAlmoco}) + Saída ({new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={onCancelar}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline uppercase tracking-wider"
          >
            Cancelar
          </button>
          {!modoDemonstracao && (
            <span className="text-xs text-gray-400 font-medium">
              Auto-cancelando em {tempoRestante}s...
            </span>
          )}
        </div>
      </div>

      {/* LADO DIREITO - Gradiente Temático com Logo e Mensagem */}
      <div
        className="hidden md:flex md:w-[42%] h-full flex-col items-center justify-center p-10 text-white text-center relative overflow-hidden"
        style={{ background: ladoDireito.gradient }}
      >
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-black/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6 max-w-sm">
          <div className="p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl inline-block">
            <Image src="/logo.png" alt="Logo" width={400} height={180} priority style={{ height: "auto" }} />
          </div>
          <p className="text-white/95 text-xl font-light leading-relaxed">
            {ladoDireito.frase}
          </p>
        </div>
      </div>
    </div>
  )
}
