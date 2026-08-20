"use client"

import { useState, useEffect } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { RegistroPonto, ResumoHoras } from "@/lib/types"
import { agruparRegistrosPorDia, calcularHorasPorDia } from "@/lib/utils-ponto"

interface CalendarioPontoProps {
  registros: RegistroPonto[]
  onSelectDay: (data: string, resumo: ResumoHoras) => void
}

export function CalendarioPonto({ registros, onSelectDay }: CalendarioPontoProps) {
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diasDoMes, setDiasDoMes] = useState<Date[]>([])
  const [registrosPorDia, setRegistrosPorDia] = useState<Record<string, RegistroPonto[]>>({})
  const [resumosPorDia, setResumosPorDia] = useState<Record<string, ResumoHoras>>({})
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  // Atualizar dias do mês quando o mês atual mudar
  useEffect(() => {
    const inicio = startOfMonth(mesAtual)
    const fim = endOfMonth(mesAtual)
    const dias = eachDayOfInterval({ start: inicio, end: fim })
    setDiasDoMes(dias)
  }, [mesAtual])

  // Processar registros quando eles mudarem
  useEffect(() => {
    const registrosPorDia = agruparRegistrosPorDia(registros)
    setRegistrosPorDia(registrosPorDia)

    // Calcular resumos por dia
    const resumos: Record<string, ResumoHoras> = {}

    Object.entries(registrosPorDia).forEach(([data, registrosDoDia]) => {
      // Calcular horas esperadas com base no dia da semana
      const horasEsperadas = 480 // 8 horas em minutos (padrão)

      const resumo = calcularHorasPorDia(registrosDoDia, horasEsperadas)
      resumos[data] = resumo
      // totais não usados aqui
    })

    setResumosPorDia(resumos)
    // valores totais não utilizados aqui
  }, [registros])

  // Navegar para o mês anterior
  const mesAnterior = () => {
    setMesAtual((prev) => {
      const novaData = new Date(prev)
      novaData.setMonth(novaData.getMonth() - 1)
      return novaData
    })
  }

  // Navegar para o próximo mês
  const proximoMes = () => {
    setMesAtual((prev) => {
      const novaData = new Date(prev)
      novaData.setMonth(novaData.getMonth() + 1)
      return novaData
    })
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
      const resumoVazio: ResumoHoras = {
        data: dataFormatada,
        horasTrabalhadas: 0,
        horasExtras: 0,
        horasEsperadas: 480,
        saldoDia: 0,
        ehDiaUtil: true,
      }
      onSelectDay(dataFormatada, resumoVazio)
    }
  }

  // Verificar se um dia tem registros
  const temRegistros = (dia: Date): boolean => {
    const dataFormatada = format(dia, "dd/MM/yyyy")
    return !!registrosPorDia[dataFormatada]
  }

  // Obter classe CSS para um dia
  const getClasseDia = (dia: Date): string => {
    const dataFormatada = format(dia, "dd/MM/yyyy")
    const hoje = format(new Date(), "dd/MM/yyyy")
    const ehHoje = dataFormatada === hoje
    const temRegistro = temRegistros(dia)
    const selecionado = dataFormatada === diaSelecionado

    let classes = "flex flex-col items-center justify-center h-12 w-12 rounded-full cursor-pointer "

    if (selecionado) {
      classes += "bg-primary text-white "
    } else if (ehHoje) {
      classes += "bg-blue-100 text-blue-800 "
    } else if (temRegistro) {
      classes += "bg-green-100 text-green-800 "
    } else {
      classes += "hover:bg-gray-100 "
    }

    return classes
  }

  // Dias da semana
  const diasDaSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        {/* Cabeçalho do calendário */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={mesAnterior}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">{format(mesAtual, "MMMM yyyy", { locale: ptBR })}</h2>
          <Button variant="outline" size="sm" onClick={proximoMes}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {diasDaSemana.map((dia) => (
            <div key={dia} className="text-center text-sm font-medium text-gray-500">
              {dia}
            </div>
          ))}
        </div>

        {/* Dias do mês */}
        {diasDoMes.map((dia) => {
          const dataFormatada = format(dia, "dd/MM/yyyy")
          const resumo = resumosPorDia[dataFormatada]

          return (
            <div key={dia.toISOString()} className={getClasseDia(dia)} onClick={() => selecionarDia(dia)}>
              <span>{dia.getDate()}</span>
              {temRegistros(dia) && resumo?.paresPontos && resumo.paresPontos.length > 0 && (
                <div className="text-xs mt-1">
                  {resumo.paresPontos[0].entrada?.substring(0, 5)}
                  {resumo.paresPontos.length > 1 && "..."}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
