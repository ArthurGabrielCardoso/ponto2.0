"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addMonths, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Printer, ArrowDown, ArrowUp } from "lucide-react"
import type { RegistroPonto, ResumoHoras, HorariosSemana, HorarioDia } from "@/lib/types"
import { agruparRegistrosPorDia, calcularHorasPorDia, minutosParaHoras } from "@/lib/utils-ponto"
import { buscarFuncionarioPorId } from "@/lib/supabase"
import Holidays from "date-holidays"

interface CalendarioDetalhadoProps {
  registros: RegistroPonto[]
  onSelectDay: (data: string, resumo: ResumoHoras) => void
  funcionarioNome?: string
  funcionarioId?: string
}

export function CalendarioDetalhado({
  registros,
  onSelectDay,
  funcionarioNome = "",
  funcionarioId = "",
}: CalendarioDetalhadoProps) {
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diasDoMes, setDiasDoMes] = useState<Date[]>([])
  // removido estado não utilizado de registros por dia
  const [resumosPorDia, setResumosPorDia] = useState<Record<string, ResumoHoras>>({})
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const [feriados, setFeriados] = useState<Record<string, string>>({})
  const [totalHorasTrabalhadas, setTotalHorasTrabalhadas] = useState(0)
  const [saldoMes, setSaldoMes] = useState(0)
  const [saldoTotal, setSaldoTotal] = useState(0)
  const [horariosFuncionario, setHorariosFuncionario] = useState<HorariosSemana | null>(null)
  const [cargaHorariaDiaria, setCargaHorariaDiaria] = useState<number>(540) // 9 horas por padrão (em minutos)
  const [saldoAcumuladoSnapshot, setSaldoAcumuladoSnapshot] = useState<number>(0)
  const [saldoDataReferencia, setSaldoDataReferencia] = useState<string | null>(null)
  const calendarioRef = useRef<HTMLDivElement>(null)

  // Buscar horários do funcionário
  useEffect(() => {
    const buscarHorarios = async () => {
      if (!funcionarioId) return

      try {
        console.log("Buscando horários para funcionário ID:", funcionarioId)
        const funcionario = await buscarFuncionarioPorId(funcionarioId)
        console.log("Funcionário carregado:", funcionario)
        console.log("Horários do funcionário:", funcionario.horarios)

        if (funcionario.horarios) {
          setHorariosFuncionario(funcionario.horarios)
        } else {
          console.log("Funcionário não tem horários cadastrados")
          setHorariosFuncionario(null)
        }

        // Se tiver carga horária cadastrada, usar ela
        if (funcionario.carga_horaria_diaria_minutos) {
          console.log("Carga horária cadastrada:", funcionario.carga_horaria_diaria_minutos)
          setCargaHorariaDiaria(funcionario.carga_horaria_diaria_minutos)
        } else {
          console.log("Usando carga horária padrão de 480 minutos (8 horas)")
          setCargaHorariaDiaria(480)
        }

        // Guardar snapshot de saldo acumulado
        setSaldoAcumuladoSnapshot(funcionario.saldo_acumulado_minutos ?? 0)
        setSaldoDataReferencia(funcionario.saldo_data_referencia ?? null)
      } catch { }
    }

    if (funcionarioId) {
      buscarHorarios()
    }
  }, [funcionarioId])

  // Configurar feriados brasileiros
  useEffect(() => {
    const hd = new Holidays("BR")
    const ano = mesAtual.getFullYear()
    const feriadosAno = hd.getHolidays(ano)

    const feriadosFormatados: Record<string, string> = {}
    feriadosAno.forEach((feriado) => {
      const data = new Date(feriado.date)
      const dataFormatada = format(data, "dd/MM/yyyy")
      feriadosFormatados[dataFormatada] = feriado.name
    })

    setFeriados(feriadosFormatados)
  }, [mesAtual])

  // Atualizar dias do mês quando o mês atual mudar
  useEffect(() => {
    const inicio = startOfMonth(mesAtual)
    const fim = endOfMonth(mesAtual)
    const dias = eachDayOfInterval({ start: inicio, end: fim })
    setDiasDoMes(dias)
  }, [mesAtual])

  // Função para calcular horas de um dia com base nos horários cadastrados
  const calcularHorasDia = useCallback((horarioDia: HorarioDia): number => {
    if (!horarioDia || !horarioDia.ativo) return 0

    try {
      // Converter horários para minutos desde meia-noite
      const [horaEntrada, minEntrada] = horarioDia.entrada.split(":").map(Number)
      const [horaSaidaAlmoco, minSaidaAlmoco] = horarioDia.saida_almoco.split(":").map(Number)
      const [horaRetornoAlmoco, minRetornoAlmoco] = horarioDia.retorno_almoco.split(":").map(Number)
      const [horaSaida, minSaida] = horarioDia.saida.split(":").map(Number)

      const entradaMinutos = horaEntrada * 60 + minEntrada
      const saidaAlmocoMinutos = horaSaidaAlmoco * 60 + minSaidaAlmoco
      const retornoAlmocoMinutos = horaRetornoAlmoco * 60 + minRetornoAlmoco
      const saidaMinutos = horaSaida * 60 + minSaida

      // Calcular tempo total usando a fórmula: (Saída - Entrada) - (Tempo de Almoço)
      const tempoTotal = saidaMinutos - entradaMinutos - (retornoAlmocoMinutos - saidaAlmocoMinutos)

      console.log(`Horário calculado para ${JSON.stringify(horarioDia)}: ${tempoTotal} minutos`)
      return tempoTotal
    } catch (error) {
      console.error("Erro ao calcular horas do dia:", error)
      return cargaHorariaDiaria // Valor padrão em caso de erro
    }
  }, [cargaHorariaDiaria])

  // Calcular horas esperadas para um dia específico
  const calcularHorasEsperadasDia = useCallback((dia: Date): number => {
    if (!horariosFuncionario) return cargaHorariaDiaria

    // Se for final de semana, verificar se o funcionário trabalha
    const diaSemana = dia.getDay()
    if (diaSemana === 0) {
      // Domingo
      return horariosFuncionario.domingo?.ativo ? calcularHorasDia(horariosFuncionario.domingo) : 0
    } else if (diaSemana === 6) {
      // Sábado
      return horariosFuncionario.sabado?.ativo ? calcularHorasDia(horariosFuncionario.sabado) : 0
    }

    // Dias da semana
    switch (diaSemana) {
      case 1: // Segunda
        return horariosFuncionario.segunda?.ativo ? calcularHorasDia(horariosFuncionario.segunda) : cargaHorariaDiaria
      case 2: // Terça
        return horariosFuncionario.terca?.ativo ? calcularHorasDia(horariosFuncionario.terca) : cargaHorariaDiaria
      case 3: // Quarta
        return horariosFuncionario.quarta?.ativo ? calcularHorasDia(horariosFuncionario.quarta) : cargaHorariaDiaria
      case 4: // Quinta
        return horariosFuncionario.quinta?.ativo ? calcularHorasDia(horariosFuncionario.quinta) : cargaHorariaDiaria
      case 5: // Sexta
        return horariosFuncionario.sexta?.ativo ? calcularHorasDia(horariosFuncionario.sexta) : cargaHorariaDiaria
      default:
        return cargaHorariaDiaria
    }
  }, [horariosFuncionario, cargaHorariaDiaria, calcularHorasDia])

  // (definição removida — movida acima de calcularHorasEsperadasDia)

  // Processar registros quando eles mudarem
  useEffect(() => {
    const registrosPorDiaMap = agruparRegistrosPorDia(registros)

    // Calcular resumos por dia
    const resumos: Record<string, ResumoHoras> = {}
    let totalHoras = 0
    let totalSaldo = 0

    Object.entries(registrosPorDiaMap).forEach(([data, registrosDoDia]) => {
      // Converter a data para objeto Date para calcular o dia da semana
      const [dia, mes, ano] = data.split("/").map(Number)
      const dataObj = new Date(ano, mes - 1, dia)

      // Calcular horas esperadas com base no dia da semana
      const horasEsperadas = calcularHorasEsperadasDia(dataObj)

      const resumo = calcularHorasPorDia(registrosDoDia, horasEsperadas)
      resumos[data] = resumo
      totalHoras += resumo.horasTrabalhadas
      totalSaldo += resumo.saldoDia
    })

    setResumosPorDia(resumos)
    setTotalHorasTrabalhadas(totalHoras)
    setSaldoMes(totalSaldo)

    // Calcular saldo total com snapshot se disponível
    if (saldoDataReferencia) {
      let saldoDesdeRef = 0
      Object.entries(resumos).forEach(([data, resumo]) => {
        const [d, m, y] = data.split('/').map(Number)
        const dataISO = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        if (dataISO >= saldoDataReferencia) {
          saldoDesdeRef += resumo.saldoDia
        }
      })
      setSaldoTotal(saldoAcumuladoSnapshot + saldoDesdeRef)
    } else {
      setSaldoTotal(totalSaldo)
    }
  }, [registros, horariosFuncionario, cargaHorariaDiaria, calcularHorasEsperadasDia, saldoAcumuladoSnapshot, saldoDataReferencia])

  // Navegar para o mês anterior
  const mesAnterior = () => {
    setMesAtual(subMonths(mesAtual, 1))
  }

  // Navegar para o próximo mês
  const proximoMes = () => {
    setMesAtual(addMonths(mesAtual, 1))
  }

  // Selecionar um dia
  const selecionarDia = (dia: Date) => {
    const dataFormatada = format(dia, "dd/MM/yyyy")
    setDiaSelecionado(dataFormatada)

    // Se houver registros para este dia, chamar o callback
    if (resumosPorDia[dataFormatada]) {
      onSelectDay(dataFormatada, resumosPorDia[dataFormatada])
    } else {
      // Criar um resumo vazio para dias sem registros
      const horasEsperadas = calcularHorasEsperadasDia(dia)
      const resumoVazio: ResumoHoras = {
        data: dataFormatada,
        horasTrabalhadas: 0,
        horasExtras: 0,
        horasEsperadas: horasEsperadas,
        saldoDia: -horasEsperadas,
        ehDiaUtil: !isWeekend(dia) && !ehFeriado(dataFormatada),
      }
      onSelectDay(dataFormatada, resumoVazio)
    }
  }

  // Verificar se um dia é feriado
  const ehFeriado = (dataFormatada: string): boolean => {
    return !!feriados[dataFormatada]
  }

  // (remoção) função não necessária

  // Obter registros de um dia específico
  const getRegistrosDia = (dia: Date): { hora: string; tipo: string; entrada: boolean }[] => {
    const dataFormatada = format(dia, "dd/MM/yyyy")
    const resumo = resumosPorDia[dataFormatada]

    // Se temos resumo com pares, usar os pares
    if (resumo && resumo.paresPontos && resumo.paresPontos.length > 0) {
      const result: { hora: string; tipo: string; entrada: boolean }[] = []

      resumo.paresPontos.forEach((par) => {
        if (par.entrada) {
          result.push({ hora: par.entrada, tipo: "Entrada", entrada: true })
        }
        if (par.saida) {
          result.push({ hora: par.saida, tipo: "Saída", entrada: false })
        }
      })

      return result
    }

    return []
  }

  // Imprimir calendário
  const imprimirCalendario = () => {
    // Criar um estilo para impressão
    const style = document.createElement("style")
    style.type = "text/css"
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #calendario-para-impressao, #calendario-para-impressao * {
          visibility: visible;
        }
        #calendario-para-impressao {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .no-print {
          display: none !important;
        }
        @page {
          size: landscape;
          margin: 10mm;
        }
        
        /* Forçar impressão de cores de fundo */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* Garantir que as cores específicas sejam preservadas */
        .bg-primary, [class*="bg-primary"] {
          background-color: #1db9b3 !important;
          color: white !important;
          print-color-adjust: exact !important;
        }
        
        .bg-secondary, [class*="bg-secondary"] {
          background-color: #c89d68 !important;
          print-color-adjust: exact !important;
        }
        
        .bg-red-50 {
          background-color: #fef2f2 !important;
          print-color-adjust: exact !important;
        }
        
        .bg-amber-50 {
          background-color: #fffbeb !important;
          print-color-adjust: exact !important;
        }
        
        .bg-green-50 {
          background-color: #f0fdf4 !important;
          print-color-adjust: exact !important;
        }
        
        .bg-blue-50 {
          background-color: #eff6ff !important;
          print-color-adjust: exact !important;
        }
        
        .bg-purple-50 {
          background-color: #faf5ff !important;
          print-color-adjust: exact !important;
        }
        
        /* Ocultar indicação de dia atual e dia selecionado na impressão */
        .dia-atual, .dia-selecionado {
          background-color: transparent !important;
          border-color: #e5e7eb !important;
        }
        
        /* Garantir que as cores dos saldos sejam impressas corretamente */
        .text-green-600 {
          color: #059669 !important;
        }
        
        .text-red-600 {
          color: #dc2626 !important;
        }
      }
    `
    document.head.appendChild(style)

    // Chamar a função de impressão do navegador
    window.print()

    // Remover o estilo após a impressão
    setTimeout(() => {
      document.head.removeChild(style)
    }, 1000)
  }

  // Dias da semana
  const diasDaSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  return (
    <Card className="w-full rounded-none" id="calendario-detalhado">
      <CardHeader className="flex flex-row items-center justify-between bg-primary text-white p-4">
        <Button variant="ghost" size="sm" onClick={mesAnterior} className="text-white hover:bg-white/10 no-print">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <CardTitle className="text-lg font-semibold">{format(mesAtual, "MMMM yyyy", { locale: ptBR })}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={imprimirCalendario}
            className="text-white hover:bg-white/10 no-print"
            data-export-calendar
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={proximoMes} className="text-white hover:bg-white/10 no-print">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4" id="calendario-para-impressao" ref={calendarioRef}>
        {/* Cabeçalho para impressão */}
        <div className="hidden print:flex print:items-center print:justify-between print:mb-6 print:pb-4 print:border-b">
          <div className="flex-shrink-0 mr-4">
            <div className="h-16 w-auto">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1000091091-removebg-preview-78PWiX8hJ2A7bEDUpjkdxRrB79cKsz.png"
                alt="Vitall Check-Up"
                className="h-full w-auto"
              />
            </div>
          </div>
          <div className="flex-grow text-center">
            <h1 className="text-xl font-bold text-secondary uppercase">
              REGISTRO DE PONTO {funcionarioNome ? funcionarioNome.toUpperCase() : ""}
            </h1>
            <div className="h-4"></div> {/* Espaçamento adicional entre os textos */}
            <h2 className="text-lg font-bold text-secondary uppercase">
              {format(mesAtual, "MMMM yyyy", { locale: ptBR }).toUpperCase()}
            </h2>
          </div>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {diasDaSemana.map((dia) => (
            <div key={dia} className="text-center text-sm font-medium text-white bg-primary p-2 rounded-t-md">
              {dia}
            </div>
          ))}
        </div>

        {/* Dias do mês */}
        <div className="grid grid-cols-7 gap-1">
          {/* Espaços vazios para alinhar o primeiro dia */}
          {Array.from({ length: diasDoMes[0]?.getDay() || 0 }).map((_, i) => (
            <div key={`empty-${i}`} className="h-32 bg-gray-50 rounded-md"></div>
          ))}

          {/* Dias do mês */}
          {diasDoMes.map((dia) => {
            const dataFormatada = format(dia, "dd/MM/yyyy")
            const hoje = format(new Date(), "dd/MM/yyyy")
            const ehHoje = dataFormatada === hoje
            // checagem indica se o dia tem algum registro (não usada nas classes)
            const selecionado = dataFormatada === diaSelecionado
            const diaDaSemana = dia.getDay()
            const ehDomingo = diaDaSemana === 0
            const ehSabado = diaDaSemana === 6
            const diaFeriado = ehFeriado(dataFormatada)
            const resumo = resumosPorDia[dataFormatada]

            // Obter registros do dia
            const registrosDia = getRegistrosDia(dia)

            // Definir classes CSS baseadas nas condições
            let bgClass = "bg-white"
            if (diaFeriado) bgClass = "bg-green-50"
            else if (ehDomingo) bgClass = "bg-amber-50"
            else if (ehSabado) bgClass = "bg-amber-50"

            // Classes adicionais para dia atual e dia selecionado
            let classesAdicionais = ""
            if (selecionado) classesAdicionais += " dia-selecionado bg-primary/10 border-primary"
            if (ehHoje) classesAdicionais += " dia-atual bg-primary/20"

            return (
              <div
                key={dia.toISOString()}
                className={`h-32 ${bgClass} ${classesAdicionais} rounded-md border p-1 cursor-pointer hover:border-primary transition-colors`}
                onClick={() => selecionarDia(dia)}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`text-sm font-medium ${ehDomingo ? "text-amber-600" : ehSabado ? "text-amber-600" : ""}`}
                  >
                    {dia.getDate()}
                  </span>
                  <span className="text-xs text-gray-400">{format(dia, "MMM", { locale: ptBR })}</span>
                </div>

                {/* Indicador de feriado */}
                {diaFeriado && (
                  <div className="mt-1 text-xs text-green-600 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                    <span className="truncate">Feriado</span>
                  </div>
                )}

                {/* Registros de ponto - Mostrar apenas os primeiros 4 registros para não sobrecarregar */}
                <div className="mt-1 space-y-1 text-xs">
                  {resumo && resumo.paresPontos && resumo.paresPontos.length > 0 ? (
                    <>
                      {/* Mostrar apenas o primeiro par completo */}
                      <div className="flex items-center text-green-600">
                        <ArrowDown className="h-3 w-3 mr-1 text-green-600" />
                        <span>{resumo.paresPontos[0].entrada}</span>
                      </div>
                      {resumo.paresPontos[0].saida && (
                        <div className="flex items-center text-red-600">
                          <ArrowUp className="h-3 w-3 mr-1 text-red-600" />
                          <span>{resumo.paresPontos[0].saida}</span>
                        </div>
                      )}
                      {/* Indicar se há mais pares */}
                      {resumo.paresPontos.length > 1 && (
                        <div className="text-xs text-gray-500 text-center">
                          + {resumo.paresPontos.length - 1} {resumo.paresPontos.length === 2 ? "par" : "pares"}
                        </div>
                      )}
                    </>
                  ) : (
                    registrosDia.slice(0, 4).map((registro, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center ${registro.entrada ? "text-green-600" : "text-red-600"}`}
                      >
                        {registro.entrada ? (
                          <ArrowDown className="h-3 w-3 mr-1 text-green-600" />
                        ) : (
                          <ArrowUp className="h-3 w-3 mr-1 text-red-600" />
                        )}
                        <span>{registro.hora}</span>
                      </div>
                    ))
                  )}
                  {registrosDia.length > 4 && (
                    <div className="text-xs text-gray-500 text-center">+ {registrosDia.length - 4} mais</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Resumo do mês - Versão melhorada */}
        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500 mb-1">Horas Trabalhadas:</div>
            <div className="text-xl font-semibold text-primary">
              {minutosParaHoras(totalHorasTrabalhadas)}
              <span className="text-sm text-gray-500 ml-1">
                ({Math.floor(totalHorasTrabalhadas / 60)} horas e {totalHorasTrabalhadas % 60} min)
              </span>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500 mb-1">Saldo do Mês:</div>
            <div className={`text-xl font-semibold ${saldoMes >= 0 ? "text-green-600" : "text-red-600"}`}>
              {saldoMes >= 0 ? "+" : "-"}
              {minutosParaHoras(Math.abs(saldoMes))}
              <span className="text-sm text-gray-500 ml-1">
                ({Math.floor(Math.abs(saldoMes) / 60)} horas e {Math.abs(saldoMes) % 60} min)
              </span>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-500 mb-1">Saldo Total:</div>
            <div className={`text-xl font-semibold ${saldoTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
              {saldoTotal >= 0 ? "+" : "-"}
              {minutosParaHoras(Math.abs(saldoTotal))}
              <span className="text-sm text-gray-500 ml-1">
                ({Math.floor(Math.abs(saldoTotal) / 60)} horas e {Math.abs(saldoTotal) % 60} min)
              </span>
            </div>
            {saldoDataReferencia && (
              <div className="text-xs text-gray-400 mt-1">
                (desde {saldoDataReferencia.split('-').reverse().join('/')})
              </div>
            )}
          </div>
        </div>

        {/* Área de assinaturas - visível apenas na impressão */}
        <div className="hidden print:block mt-20">
          {/* Área de assinaturas */}
          <div className="flex justify-between">
            {/* Assinatura do funcionário */}
            <div className="w-5/12">
              <div className="border-t border-black pt-2">
                <p className="font-medium">{funcionarioNome}</p>
                <p className="text-sm text-gray-600">
                  {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Assinatura da CEO */}
            <div className="w-5/12">
              <div className="border-t border-black pt-2">
                <p className="font-medium">Ana Maria Cardoso de Oliveira</p>
                <p className="text-sm text-gray-600">
                  {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-gray-500">
            <p>Documento gerado em {format(new Date(), "dd/MM/yyyy HH:mm")} - Vitall Check-Up</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
