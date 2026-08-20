"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isToday, isWeekend } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp, Printer, CalendarCheck, Edit, Plus, Trash2 } from "lucide-react"
import type { RegistroPonto, ResumoHoras, HorariosSemana } from "@/lib/types"
import { agruparRegistrosPorDia, minutosParaHoras, calcularSaldoDia, calcularCargaHorariaPorDia, formatarHora, obterHorasEsperadasParaData } from "@/lib/utils-ponto"
import { buscarFuncionarioPorId, buscarRegistrosPorPeriodo, atualizarRegistroPonto, deletarRegistroPonto, criarRegistroPonto, salvarAjusteSaldo, buscarAjusteSaldo, atualizarAjusteSaldo, verificarTabelaAjustesSaldo } from "@/lib/supabase"

interface CalendarioSemanalProps {
  registros: RegistroPonto[]
  onSelectDay: (data: string, resumo: ResumoHoras) => void
  funcionarioNome?: string
  funcionarioId?: string
  onRegistrosUpdated?: (novosRegistros: RegistroPonto[]) => void
}

export function CalendarioSemanal({
  registros,
  onSelectDay,
  funcionarioNome = "",
  funcionarioId = "",
  onRegistrosUpdated,
}: CalendarioSemanalProps) {
  const [semanaAtual, setSemanaAtual] = useState(new Date())
  const [diasDaSemana, setDiasDaSemana] = useState<Date[]>([])
  const [, setRegistrosPorDia] = useState<Record<string, RegistroPonto[]>>({})
  const [resumosPorDia, setResumosPorDia] = useState<Record<string, ResumoHoras>>({})
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const [horariosFuncionario, setHorariosFuncionario] = useState<HorariosSemana | null>(null)
  const [cargaHorariaDiaria, setCargaHorariaDiaria] = useState<number>(480) // 8 horas por padrão (em minutos)
  const [horasEsperadasPorDia, setHorasEsperadasPorDia] = useState<Record<string, number>>({})
  const calendarioRef = useRef<HTMLDivElement>(null)
  const [funcionarioCarregado, setFuncionarioCarregado] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [diaEditando, setDiaEditando] = useState<Date | null>(null)
  const [registrosEditando, setRegistrosEditando] = useState<RegistroPonto[]>([])
  const [dataFormatadaEditando, setDataFormatadaEditando] = useState<string>("")
  const [saldoDiaEditando, setSaldoDiaEditando] = useState<number>(0)
  const [saldoTotalEditando, setSaldoTotalEditando] = useState<number>(0)
  const [registrosAtualizados, setRegistrosAtualizados] = useState<RegistroPonto[]>([])
  const [forceUpdate, setForceUpdate] = useState(0)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  // Estado para armazenar ajustes de saldo
  const [ajustesSaldo, setAjustesSaldo] = useState<Record<string, {saldoDia: number, saldoTotal: number}>>({})
  const [tabelaAjustesExiste, setTabelaAjustesExiste] = useState<boolean>(true)
  const [saldoAcumuladoSnapshot, setSaldoAcumuladoSnapshot] = useState<number>(0)
  const [saldoDataReferencia, setSaldoDataReferencia] = useState<string | null>(null)

  // Função para aplicar ajustes de saldo aos resumos
  const aplicarAjustesSaldo = (resumoOriginal: ResumoHoras, dataFormatada: string): ResumoHoras => {
    const ajuste = ajustesSaldo[dataFormatada]
    if (ajuste) {
      return {
        ...resumoOriginal,
        saldoDia: ajuste.saldoDia
      }
    }
    return resumoOriginal
  }

  // Função para mostrar toast
  const mostrarToast = (mensagem: string, tipo: 'success' | 'error' = 'success') => {
    setToastMessage(mensagem)
    setToastType(tipo)
    setShowToast(true)
    
    // Auto-hide após 3 segundos
    setTimeout(() => {
      setShowToast(false)
    }, 3000)
  }

  // Função para calcular saldo total acumulado do mês
  const calcularSaldoTotalMes = (diaAtual: Date): number => {
    const inicioMes = new Date(diaAtual.getFullYear(), diaAtual.getMonth(), 1)
    let saldoTotal = 0

    // Lógica inteligente: se for sexta-feira e já tem 4 registros, incluir dia atual
    const ehSexta = diaAtual.getDay() === 5
    const dataFormatadaAtual = format(diaAtual, "dd/MM/yyyy")
    
    // Verificar se tem pelo menos 4 registros na sexta-feira
    let tem4RegistrosSexta = false
    if (ehSexta) {
      // Contar registros reais de todos os lugares disponíveis
      const registrosDiaSexta = [...registrosAtualizados, ...registros].filter(r => {
        try {
          const dataReg = format(parseISO(r.data_hora), "dd/MM/yyyy")
          return dataReg === dataFormatadaAtual
        } catch {
          return false
        }
      })
      
      // Remover duplicatas por ID (caso tenha o mesmo registro em ambas as listas)
      const registrosUnicos = registrosDiaSexta.filter((registro, index, arr) => 
        arr.findIndex(r => r.id === registro.id) === index
      )
      
      tem4RegistrosSexta = registrosUnicos.length >= 4
      console.log(`🔍 SEXTA-FEIRA - Registros únicos encontrados: ${registrosUnicos.length} >= 4? ${tem4RegistrosSexta}`)
      console.log(`📝 Detalhes dos registros:`, registrosUnicos.map(r => `${formatarHora(r.data_hora)} (${r.tipo})`))
    }
    
    // Determinar até qual dia calcular
    let diaLimite: Date
    if (tem4RegistrosSexta) {
      // Se é sexta com 4+ registros, incluir o dia atual
      diaLimite = new Date(diaAtual)
      console.log(`📅 INCLUINDO DIA ATUAL (sexta com ${tem4RegistrosSexta ? '4+' : '<4'} registros)`)
    } else {
      // Caso contrário, calcular até o dia anterior
      diaLimite = new Date(diaAtual)
      diaLimite.setDate(diaLimite.getDate() - 1)
      console.log(`📅 ATÉ DIA ANTERIOR: ${format(diaLimite, 'dd/MM/yyyy')}`)
    }
    
    // Se o dia limite for antes do início do mês, retornar 0
    if (diaLimite < inicioMes) {
      console.log(`⚠️ DIA LIMITE ANTES DO INÍCIO DO MÊS`)
      return 0
    }

    console.log(`📊 CALCULANDO SALDO DO MÊS: ${format(inicioMes, 'dd/MM/yyyy')} até ${format(diaLimite, 'dd/MM/yyyy')}`)

    // Iterar do primeiro dia do mês até o dia limite
    const dataIteracao = new Date(inicioMes)
    while (dataIteracao <= diaLimite) {
      const dataFormatada = format(dataIteracao, "dd/MM/yyyy")
      
      // Primeiro procurar no resumosPorDia
      let resumoDia = resumosPorDia[dataFormatada]
      
      // Se não encontrou, tentar calcular baseado nos registros existentes
      if (!resumoDia) {
        const registrosDoDia = [...registrosAtualizados, ...registros].filter(r => {
          try {
            const dataReg = format(parseISO(r.data_hora), "dd/MM/yyyy")
            return dataReg === dataFormatada
          } catch {
            return false
          }
        })
        
        if (registrosDoDia.length > 0) {
          // Calcular saldo para este dia usando os registros encontrados
          const resultado = calcularSaldoDia(registrosDoDia, dataIteracao, horariosFuncionario || cargaHorariaDiaria)
          resumoDia = {
            data: dataFormatada,
            saldoDia: resultado.saldoDia,
            horasTrabalhadas: resultado.horasTrabalhadas,
            horasEsperadas: resultado.horasEsperadas,
            horasExtras: Math.max(0, resultado.saldoDia),
            ehDiaUtil: resultado.horasEsperadas > 0,
            paresPontos: resultado.paresPontos
          }
          console.log(`🔄 CALCULADO SALDO PARA ${dataFormatada}: ${resultado.saldoDia}min`)
        }
      }
      
      if (resumoDia) {
        // Aplicar ajuste se existir
        const resumoComAjuste = aplicarAjustesSaldo(resumoDia, dataFormatada)
        saldoTotal += resumoComAjuste.saldoDia
        console.log(`➕ ${dataFormatada}: ${resumoComAjuste.saldoDia}min (total: ${saldoTotal}min)`)
      } else {
        // Se não há registros, considerar como falta (saldo negativo)
        const horasEsperadas = obterHorasEsperadasParaData(dataIteracao, horariosFuncionario, cargaHorariaDiaria)
        if (horasEsperadas > 0) { // Só subtrair se for dia útil
          saldoTotal -= horasEsperadas
          console.log(`➖ ${dataFormatada}: falta -${horasEsperadas}min (total: ${saldoTotal}min)`)
        }
      }
      
      dataIteracao.setDate(dataIteracao.getDate() + 1)
    }

    console.log(`✅ SALDO TOTAL DO MÊS: ${saldoTotal}min (${minutosParaHoras(saldoTotal)})`)
    return saldoTotal
  }

  // Função para calcular saldo da semana até o dia (aplicando mesma lógica inteligente)
  const calcularSaldoSemana = (diaAtual: Date): number => {
    let saldoSemana = 0
    
    // Mesma lógica inteligente da função do mês
    const ehSexta = diaAtual.getDay() === 5
    const dataFormatadaAtual = format(diaAtual, "dd/MM/yyyy")
    
    // Verificar se tem pelo menos 4 registros na sexta-feira
    let tem4RegistrosSexta = false
    if (ehSexta) {
      const registrosDiaSexta = [...registrosAtualizados, ...registros].filter(r => {
        try {
          const dataReg = format(parseISO(r.data_hora), "dd/MM/yyyy")
          return dataReg === dataFormatadaAtual
        } catch {
          return false
        }
      })
      
      const registrosUnicos = registrosDiaSexta.filter((registro, index, arr) => 
        arr.findIndex(r => r.id === registro.id) === index
      )
      
      tem4RegistrosSexta = registrosUnicos.length >= 4
      console.log(`🔍 SALDO SEMANA - SEXTA-FEIRA - Registros únicos: ${registrosUnicos.length} >= 4? ${tem4RegistrosSexta}`)
    }
    
    console.log(`📊 CALCULANDO SALDO DA SEMANA até ${format(diaAtual, 'dd/MM/yyyy')} (incluir atual? ${tem4RegistrosSexta})`)
    
    // Iterar pelos dias da semana atual
    diasDaSemana.forEach((dia) => {
      const dataFormatada = format(dia, "dd/MM/yyyy")
      const resumoDia = resumosPorDia[dataFormatada]
      
      // Decidir se incluir este dia baseado na lógica inteligente
      let incluirDia = false
      if (dia < diaAtual) {
        // Dias anteriores sempre incluir
        incluirDia = true
      } else if (dia.getTime() === diaAtual.getTime() && tem4RegistrosSexta) {
        // Dia atual apenas se for sexta com 4+ registros
        incluirDia = true
      }
      
      if (incluirDia && resumoDia) {
        // Aplicar ajuste se existir
        const resumoComAjuste = aplicarAjustesSaldo(resumoDia, dataFormatada)
        saldoSemana += resumoComAjuste.saldoDia
        console.log(`➕ SEMANA ${dataFormatada}: ${resumoComAjuste.saldoDia}min (total semana: ${saldoSemana}min)`)
      } else if (incluirDia) {
        console.log(`⏭️ SEMANA ${dataFormatada}: sem dados`)
      } else {
        console.log(`⏸️ SEMANA ${dataFormatada}: não incluído`)
      }
    })
    
    console.log(`✅ SALDO DA SEMANA: ${saldoSemana}min (${minutosParaHoras(saldoSemana)})`)
    return saldoSemana
  }

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

        setFuncionarioCarregado(true)
      } catch {
        setFuncionarioCarregado(true)
      }
    }

    if (funcionarioId) {
      setFuncionarioCarregado(false)
      buscarHorarios()
    }
  }, [funcionarioId])

  // Atualizar dias da semana quando a semana atual mudar
  useEffect(() => {
    try {
      // Definindo o início da semana como segunda-feira (1)
      const inicio = startOfWeek(semanaAtual, { weekStartsOn: 1 })
      const fim = endOfWeek(semanaAtual, { weekStartsOn: 1 })
      const dias = eachDayOfInterval({ start: inicio, end: fim })
      setDiasDaSemana(dias)
    } catch (error) {
      console.error("Erro ao calcular dias da semana:", error)
      setDiasDaSemana([])
    }
  }, [semanaAtual])


  const calcularHorasEsperadasDia = useCallback((dia: Date): number => {
    return obterHorasEsperadasParaData(dia, horariosFuncionario, cargaHorariaDiaria)
  }, [horariosFuncionario, cargaHorariaDiaria])

  // (definição duplicada removida)

  // Calcular e armazenar as horas esperadas para cada dia da semana
  useEffect(() => {
    if (!diasDaSemana.length || !funcionarioCarregado) return

    const horasEsperadas: Record<string, number> = {}

    diasDaSemana.forEach((dia) => {
      const dataFormatada = format(dia, "dd/MM/yyyy")
      const minutos = calcularHorasEsperadasDia(dia)
      horasEsperadas[dataFormatada] = minutos
      console.log(`Horas esperadas para ${dataFormatada}: ${minutos} minutos (${minutosParaHoras(minutos)})`)
    })

    setHorasEsperadasPorDia(horasEsperadas)
  }, [diasDaSemana, horariosFuncionario, cargaHorariaDiaria, funcionarioCarregado, calcularHorasEsperadasDia])

  // Processar registros quando eles mudarem
  useEffect(() => {
    if (diasDaSemana.length === 0 || !funcionarioCarregado) return

    // Usar registros atualizados se disponíveis, senão usar os originais
    const registrosParaUsar = registrosAtualizados.length > 0 ? registrosAtualizados : registros
    const registrosPorDiaMap = agruparRegistrosPorDia(registrosParaUsar)
    setRegistrosPorDia(registrosPorDiaMap)

    // Calcular resumos por dia
    const resumos: Record<string, ResumoHoras> = {}

    // Processar cada dia da semana
    diasDaSemana.forEach((dia) => {
      const dataFormatada = format(dia, "dd/MM/yyyy")
      const registrosDoDia = registrosPorDiaMap[dataFormatada] || []

      // Usar a nova função de cálculo de saldo
      const resultado = calcularSaldoDia(registrosDoDia, dia, horariosFuncionario || cargaHorariaDiaria)
      
      console.log(`Processando ${dataFormatada}:`, resultado)

      // Criar resumo usando os novos cálculos
      resumos[dataFormatada] = {
        data: dataFormatada,
        horasTrabalhadas: resultado.horasTrabalhadas,
        horasExtras: Math.max(0, resultado.saldoDia), // Extras são apenas saldo positivo
        horasEsperadas: resultado.horasEsperadas,
        saldoDia: resultado.saldoDia,
        ehDiaUtil: resultado.horasEsperadas > 0, // É dia útil se tem horas esperadas
        paresPontos: resultado.paresPontos
      }
    })

    // Preservar resumos existentes de outros dias ao recalcular
    setResumosPorDia(prevResumos => {
      const novosResumos = { ...prevResumos }
      
      // Atualizar apenas os dias da semana atual
      Object.entries(resumos).forEach(([data, resumo]) => {
        novosResumos[data] = resumo
      })
      
      console.log("🔄 Resumos recalculados para semana atual:", Object.keys(resumos))
      console.log("🔒 Total de resumos após preservação:", Object.keys(novosResumos).length)
      
      return novosResumos
    })
  }, [diasDaSemana, registros, registrosAtualizados, horasEsperadasPorDia, funcionarioCarregado, calcularHorasEsperadasDia, horariosFuncionario, forceUpdate])

  // Navegar para a semana anterior
  const semanaAnterior = () => {
    setSemanaAtual(subWeeks(semanaAtual, 1))
  }

  // Navegar para a próxima semana
  const proximaSemana = () => {
    setSemanaAtual(addWeeks(semanaAtual, 1))
  }

  // Selecionar um dia
  const selecionarDia = (dia: Date) => {
    const dataFormatada = format(dia, "dd/MM/yyyy")
    setDiaSelecionado(dataFormatada)

    // Se houver resumo para este dia, chamar o callback
    if (resumosPorDia[dataFormatada]) {
      onSelectDay(dataFormatada, resumosPorDia[dataFormatada])
    } else {
      // Criar um resumo vazio para dias sem registros
      const horasEsperadas = horasEsperadasPorDia[dataFormatada] || calcularHorasEsperadasDia(dia)
      const resumoVazio: ResumoHoras = {
        data: dataFormatada,
        horasTrabalhadas: 0,
        horasExtras: 0,
        horasEsperadas: horasEsperadas,
        saldoDia: -horasEsperadas,
        ehDiaUtil: Boolean(
          !isWeekend(dia) ||
          (!!horariosFuncionario &&
            ((dia.getDay() === 0 && !!horariosFuncionario.domingo?.ativo) ||
              (dia.getDay() === 6 && !!horariosFuncionario.sabado?.ativo)))
        ),
      }
      onSelectDay(dataFormatada, resumoVazio)
    }
  }

  // Obter resumo de um dia específico
  const getResumoDia = (dia: Date): ResumoHoras | null => {
    const dataFormatada = format(dia, "dd/MM/yyyy")
    return resumosPorDia[dataFormatada] || null
  }

  // Obter registros de um dia específico
  // Removido: função não utilizada

  // Formatar período da semana
  const formatarPeriodoSemana = () => {
    if (!diasDaSemana.length) {
      return "Carregando..."
    }
    const inicio = diasDaSemana[0]
    const fim = diasDaSemana[diasDaSemana.length - 1]
    return `${format(inicio, "dd", { locale: ptBR })} a ${format(fim, "dd 'de' MMMM", { locale: ptBR })}`
  }

  // Formatar período da semana para o cabeçalho de impressão
  const formatarPeriodoSemanaCompleto = () => {
    if (!diasDaSemana.length) {
      return ""
    }
    const inicio = diasDaSemana[0]
    const fim = diasDaSemana[diasDaSemana.length - 1]
    return `${format(inicio, "dd/MM/yyyy")} a ${format(fim, "dd/MM/yyyy")}`
  }

  // Calcular o total de horas da semana
  const calcularTotalSemana = (): { trabalhadas: number; esperadas: number; saldo: number } => {
    let trabalhadas = 0
    let esperadas = 0
    
    // Para o saldo da semana, usar a lógica inteligente até o dia anterior (ou atual se sexta com 4 registros)
    const hoje = new Date()
    const saldo = calcularSaldoSemana(hoje)
    
    // Para trabalhadas e esperadas, usar todos os resumos da semana
    diasDaSemana.forEach((dia) => {
      const dataFormatada = format(dia, "dd/MM/yyyy")
      const resumoDia = resumosPorDia[dataFormatada]
      if (resumoDia) {
        trabalhadas += resumoDia.horasTrabalhadas
        esperadas += resumoDia.horasEsperadas
      }
    })

    return { trabalhadas, esperadas, saldo }
  }

  // Obter horário esperado formatado para um dia específico
  const getHorarioEsperadoFormatado = (dia: Date): string => {
    const minutos = calcularCargaHorariaPorDia(dia)
    return minutosParaHoras(minutos)
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
        #calendario-semanal-para-impressao, #calendario-semanal-para-impressao * {
          visibility: visible;
        }
        #calendario-semanal-para-impressao {
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

        /* Ajustar espaçamentos para impressão */
        @page {
          margin-bottom: 0.5cm !important;
        }

        /* Reduzir espaçamentos na impressão */
        #calendario-semanal-para-impressao table {
          margin-bottom: 0.5cm !important;
        }

        /* Compactar a área de assinatura */
        #calendario-semanal-para-impressao .print\\:block {
          margin-top: 1.5rem !important;
        }

        #calendario-semanal-para-impressao .print\\:block p {
          margin: 0 !important;
          line-height: 1.2 !important;
        }
        
        /* Forçar impressão de cores de fundo */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* Garantir que todo o texto seja preto na impressão, EXCETO as cores específicas que queremos preservar */
        #calendario-semanal-para-impressao td, 
        #calendario-semanal-para-impressao th, 
        #calendario-semanal-para-impressao div, 
        #calendario-semanal-para-impressao span, 
        #calendario-semanal-para-impressao p {
          color: black !important;
        }
        
        /* IMPORTANTE: Preservar cores específicas para entradas e saídas */
        span[style*="color: #059669"], 
        span[style*="color: #dc2626"] {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* Sobrescrever qualquer regra que possa estar afetando as cores */
        #calendario-semanal-para-impressao span[style*="color"] {
          color: currentColor !important;
        }
        
        /* Garantir que as cores específicas sejam preservadas */
        .bg-primary, [class*="bg-primary"] {
          background-color: #1db9b3 !important;
          color: white !important;
          print-color-adjust: exact !important;
        }
        
        /* Garantir que o texto no cabeçalho da tabela seja branco */
        .print-table-header th {
          color: white !important;
          border: 2px solid black !important; /* Bordas menos espessas no cabeçalho */
          font-weight: bold !important;
        }
        
        .bg-secondary, [class*="bg-secondary"] {
          background-color: #c89d68 !important;
          print-color-adjust: exact !important;
          color: black !important;
        }
        
        .text-primary {
          color: #1db9b3 !important;
        }
        
        .text-secondary {
          color: #c89d68 !important;
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
        
        /* Cores alternadas para linhas da tabela - usando a cor RGB específica */
        .bg-primary\\/5 {
          background-color: rgb(165, 241, 237) !important;
          print-color-adjust: exact !important;
        }
        
        /* Cores para a tabela */
        .print-table-header {
          background-color: #1db9b3 !important;
          color: white !important;
        }
        
        /* Rodapé com fonte normal (não maior) */
        .print-table-footer {
          background-color: white !important;
          font-size: 1rem !important;
        }

        /* Células de total de horas trabalhadas, horas esperadas, saldo e saldo total com cor específica */
        .print-table-footer td:nth-child(3),
        .print-table-footer td:nth-child(4),
        .print-table-footer td:nth-child(5),
        .print-table-footer td:nth-child(6) {
          background-color: rgb(19, 123, 118) !important;
          color: white !important;
          print-color-adjust: exact !important;
          border: none !important;
        }

        /* Primeira célula do rodapé */
        .print-table-footer td:first-child {
          border-right: none !important;
          background-color: white !important;
          color: black !important;
        }

        /* Última célula do rodapé */
        .print-table-footer td:last-child {
          border-left: none !important;
        }

        /* Garantir que as bordas externas da linha de total sejam impressas corretamente */
        tfoot tr.print-table-footer {
          border: 2px solid black !important;
        }

        /* Remover todas as bordas internas da linha de total */
        tfoot tr.print-table-footer td + td {
          border-left: none !important;
        }

        /* Remover indicação de dia atual e dia selecionado na impressão */
        tr.bg-primary\\/10, tr.bg-primary\\/20 {
          background-color: transparent !important;
        }

        /* Manter apenas as cores alternadas na impressão */
        tr.bg-primary\\/5 {
          background-color: rgb(165, 241, 237) !important;
          print-color-adjust: exact !important;
        }

        /* Manter a cor de fundo para finais de semana */
        tr.bg-amber-50 {
          background-color: #fffbeb !important;
          print-color-adjust: exact !important;
        }
        
        /* Remover indicação de dia atual na impressão */
        tr.dia-atual {
          background-color: transparent !important;
        }
        tr.dia-atual td {
          background-color: transparent !important;
        }
        
        /* Garantir que os badges tenham cores corretas */
        .bg-green-100 {
          background-color: #dcfce7 !important;
          color: #166534 !important;
        }
        
        .text-green-800 {
          color: #166534 !important;
        }
        
        .bg-red-100 {
          background-color: #fee2e2 !important;
          color: #991b1b !important;
        }
        
        .text-red-800 {
          color: #991b1b !important;
        }
        
        /* Garantir que o texto no rodapé seja visível */
        tfoot tr td {
          color: black !important;
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

  const totalSemana = diasDaSemana.length ? calcularTotalSemana() : { trabalhadas: 0, esperadas: 0, saldo: 0 }

  // Calcular saldo total acumulado (snapshot + saldos desde a data de referência)
  const saldoTotalAcumulado = saldoDataReferencia ? (() => {
    let saldoDesdeRef = 0
    Object.entries(resumosPorDia).forEach(([data, resumo]) => {
      const [d, m, y] = data.split('/').map(Number)
      const dataISO = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (dataISO >= saldoDataReferencia) {
        const resumoComAjuste = aplicarAjustesSaldo(resumo, data)
        saldoDesdeRef += resumoComAjuste.saldoDia
      }
    })
    return saldoAcumuladoSnapshot + saldoDesdeRef
  })() : null

  // Formatar dia da semana com a primeira letra maiúscula
  const formatarDiaSemana = (data: Date): string => {
    const diaSemana = format(data, "EEEE", { locale: ptBR })
    return diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
  }

  // Função para abrir modal de edição de horário
  const abrirModalEdicao = async (dia: Date) => {
    const dataFormatada = format(dia, "dd/MM/yyyy")
    const diaSemana = dia.getDay()
    const ehSexta = diaSemana === 5
    
    console.log("🔍 ABRINDO MODAL PARA:", dataFormatada, ehSexta ? "(SEXTA-FEIRA)" : `(DIA ${diaSemana})`)
    
    if (!funcionarioId) {
      console.error("ID do funcionário não disponível")
      return
    }

    try {
      // Buscar registros de ponto deste dia específico
      const dataInicio = format(dia, "yyyy-MM-dd") + "T00:00:00.000Z"
      const dataFim = format(dia, "yyyy-MM-dd") + "T23:59:59.999Z"
      
      console.log("📅 Intervalo de busca:", dataInicio, "até", dataFim)
      console.log("👤 Funcionário ID:", funcionarioId)
      
      // Forçar uma nova busca sempre, especialmente para sexta-feira
      const registrosDoDia = await buscarRegistrosPorPeriodo(dataInicio, dataFim, funcionarioId)
      
      console.log("📊 REGISTROS ENCONTRADOS:", registrosDoDia.length)
      console.log("📋 DETALHES DOS REGISTROS:", registrosDoDia)
      
      // Para sexta-feira, vamos também tentar buscar do estado local como fallback
      if (ehSexta && registrosDoDia.length === 0) {
        console.log("⚠️ SEXTA SEM REGISTROS DO BANCO - VERIFICANDO ESTADO LOCAL")
        const registrosAtualizadosLocal = registrosAtualizados.filter(r => {
          try {
            const dataReg = format(parseISO(r.data_hora), "dd/MM/yyyy")
            return dataReg === dataFormatada
          } catch {
            return false
          }
        })
        console.log("🔍 REGISTROS NO ESTADO LOCAL:", registrosAtualizadosLocal.length, registrosAtualizadosLocal)
        
        if (registrosAtualizadosLocal.length > 0) {
          console.log("🔄 USANDO REGISTROS DO ESTADO LOCAL PARA SEXTA")
          registrosDoDia.push(...registrosAtualizadosLocal)
        }
      }
      
      // Verificar se existem registros no resumosPorDia também
      const resumoExistente = resumosPorDia[dataFormatada]
      console.log("🔄 RESUMO EXISTENTE NO ESTADO:", resumoExistente)
      
      if (ehSexta) {
        console.log("🔥 DEBUG SEXTA-FEIRA:")
      }
      
      // Se não há registros, criar um registro vazio para permitir adicionar  
      let registrosParaEditar = registrosDoDia.length > 0 ? [...registrosDoDia] : []
      
      // Verificação adicional para sexta-feira: se ainda não tem registros, tentar estado global
      if (ehSexta && registrosParaEditar.length === 0) {
        console.log("🔍 SEXTA SEM REGISTROS - VERIFICANDO TODOS OS ESTADOS:")
        
        // Tentar buscar nos registros originais também
        const registrosOriginais = registros.filter(r => {
          try {
            const dataReg = format(parseISO(r.data_hora), "dd/MM/yyyy")
            return dataReg === dataFormatada
          } catch {
            return false
          }
        })
        
        
        if (registrosOriginais.length > 0) {
          console.log("🎯 USANDO REGISTROS ORIGINAIS PARA MODAL")
          registrosParaEditar = [...registrosOriginais]
        }
      }
      
      console.log("✅ CARREGANDO MODAL COM", registrosParaEditar.length, "REGISTROS")
      
      // Calcular saldos atuais para inicializar os campos editáveis
      const resumoDoDia = resumosPorDia[dataFormatada]
      const saldoDiaCalculado = resumoDoDia ? resumoDoDia.saldoDia : 0
      const saldoTotalCalculado = calcularSaldoTotalMes(dia)
      
      // Verificar se já existem ajustes salvos para usar como valores iniciais
      const ajustesExistentes = ajustesSaldo[dataFormatada]
      const saldoDiaAtual = ajustesExistentes ? ajustesExistentes.saldoDia : saldoDiaCalculado
      const saldoTotalAtual = ajustesExistentes ? ajustesExistentes.saldoTotal : saldoTotalCalculado
      
      setDiaEditando(dia)
      setDataFormatadaEditando(dataFormatada)
      setRegistrosEditando(registrosParaEditar)
      setSaldoDiaEditando(saldoDiaAtual)
      setSaldoTotalEditando(saldoTotalAtual)
      setModalAberto(true)
      
    } catch (error) {
      console.error("Erro ao buscar registros do dia:", error)
      mostrarToast("Erro ao carregar horários do dia", 'error')
    }
  }

  // Função para salvar registros editados
  const salvarHorario = async () => {
    if (!diaEditando || !funcionarioId) return
    
    try {
      console.log("Salvando registros editados:", registrosEditando)
      
      // Buscar registros originais para comparar
      const dataInicio = format(diaEditando, "yyyy-MM-dd") + "T00:00:00.000Z"
      const dataFim = format(diaEditando, "yyyy-MM-dd") + "T23:59:59.999Z"
      const registrosOriginais = await buscarRegistrosPorPeriodo(dataInicio, dataFim, funcionarioId)
      
      console.log("📋 Registros originais do banco:", registrosOriginais.length)
      console.log("📝 Registros sendo editados:", registrosEditando.length)
      
      // Identificar registros para deletar (originais que não estão mais na lista editada)
      for (const registroOriginal of registrosOriginais) {
        const aindaExiste = registrosEditando.find(r => r.id === registroOriginal.id)
        if (!aindaExiste) {
          console.log("🗑️ Deletando registro:", registroOriginal.id)
          try {
            await deletarRegistroPonto(registroOriginal.id)
            console.log("✅ Registro deletado:", registroOriginal.id)
          } catch (error) {
            console.error("❌ Erro ao deletar registro:", error)
            throw error
          }
        } else {
          console.log("📌 Mantendo registro:", registroOriginal.id)
        }
      }
      
      // Processar registros editados
      for (const registro of registrosEditando) {
        console.log("Processando registro:", registro.id, registro.data_hora, registro.tipo)
        
        if (registro.id.startsWith('temp-')) {
          // Novo registro - criar
          console.log("Criando novo registro:", registro)
          try {
            const novoId = await criarRegistroPonto(
              registro.funcionario_id,
              registro.nome_funcionario,
              registro.data_hora,
              registro.tipo || "Entrada"
            )
            console.log("✅ Novo registro criado com ID:", novoId)
          } catch (error) {
            console.error("❌ Erro ao criar registro:", error)
            throw error
          }
        } else {
          // Registro existente - atualizar
          console.log("Atualizando registro existente:", registro.id)
          try {
            await atualizarRegistroPonto(
              registro.id,
              registro.data_hora,
              registro.tipo || "Entrada"
            )
            console.log("✅ Registro atualizado:", registro.id)
          } catch (error) {
            console.error("❌ Erro ao atualizar registro:", error)
            throw error
          }
        }
      }

      // Salvar ajustes de saldo se houver mudanças e se a tabela existir
      if (tabelaAjustesExiste) {
        try {
          const resumoDoDia = resumosPorDia[dataFormatadaEditando]
          const saldoDiaOriginal = resumoDoDia ? resumoDoDia.saldoDia : 0
          const saldoTotalOriginal = calcularSaldoTotalMes(diaEditando)
          
          // Verificar se há mudanças nos saldos
          if (saldoDiaEditando !== saldoDiaOriginal || saldoTotalEditando !== saldoTotalOriginal) {
            console.log("💾 Salvando ajustes de saldo...")
            
            // Verificar se já existe um ajuste para este dia
            const ajusteExistente = await buscarAjusteSaldo(funcionarioId, dataFormatadaEditando)
            
            if (ajusteExistente) {
              // Atualizar ajuste existente
              await atualizarAjusteSaldo(funcionarioId, dataFormatadaEditando, {
                saldo_dia_ajustado: saldoDiaEditando,
                saldo_total_ajustado: saldoTotalEditando,
                motivo: "Ajuste manual via interface"
              })
              console.log("✅ Ajuste de saldo atualizado")
            } else {
              // Criar novo ajuste
              const resultadoSalvar = await salvarAjusteSaldo({
                funcionario_id: funcionarioId,
                data: dataFormatadaEditando,
                saldo_dia_original: saldoDiaOriginal,
                saldo_dia_ajustado: saldoDiaEditando,
                saldo_total_original: saldoTotalOriginal,
                saldo_total_ajustado: saldoTotalEditando,
                motivo: "Ajuste manual via interface"
              })
              if (resultadoSalvar === "tabela_inexistente") {
                mostrarToast("Tabela de ajustes não existe. Contate o administrador.", 'error')
              } else {
                console.log("✅ Novo ajuste de saldo salvo")
              }
            }
          }
        } catch (error) {
          console.error("Erro ao salvar ajustes de saldo:", error)
          // Não falhar o salvamento dos registros por causa do ajuste
        }
      }
      
      // Fechar modal
      setModalAberto(false)
      setDiaEditando(null)
      setRegistrosEditando([])
      setDataFormatadaEditando("")
      setSaldoDiaEditando(0)
      setSaldoTotalEditando(0)
      
      console.log("Registros salvos com sucesso!")
      
      // Atualizar os registros locais sem refresh
      // Buscar registros atualizados do dia para verificar se salvaram
      console.log("🔍 Verificando registros salvos no banco...")
      const registrosAtualizadosDia = await buscarRegistrosPorPeriodo(dataInicio, dataFim, funcionarioId)
      console.log("📊 Registros encontrados após salvamento:", registrosAtualizadosDia.length, registrosAtualizadosDia)
      
      // Usar registros atualizados existentes como base, ou registros originais se for a primeira edição
      const registrosBase = registrosAtualizados.length > 0 ? registrosAtualizados : registros
      
      // Remover registros antigos APENAS deste dia específico
      const registrosFiltrados = registrosBase.filter(r => {
        try {
          const dataReg = format(parseISO(r.data_hora), "dd/MM/yyyy")
          return dataReg !== dataFormatadaEditando
        } catch {
          return true // Manter registros com formato inválido
        }
      })
      
      // Adicionar registros atualizados deste dia
      registrosFiltrados.push(...registrosAtualizadosDia)
      
      console.log("📈 Total de registros após merge:", registrosFiltrados.length)
      console.log("📅 Registros preservados de outros dias:", registrosFiltrados.filter(r => {
        try {
          const dataReg = format(parseISO(r.data_hora), "dd/MM/yyyy")
          return dataReg !== dataFormatadaEditando
        } catch {
          return false
        }
      }).length)
      
      // Atualizar estado local e forçar re-render
      setRegistrosAtualizados(registrosFiltrados)
      setForceUpdate(prev => prev + 1)
      
      // Forçar recálculo imediato dos resumos para o dia editado
      if (diaEditando) {
        console.log("🔄 Recalculando resumo para o dia editado...")
        const dataFormatada = format(diaEditando, "dd/MM/yyyy")
        const resultado = calcularSaldoDia(registrosAtualizadosDia, diaEditando)
        
        const novoResumo: ResumoHoras = {
          data: dataFormatada,
          horasTrabalhadas: resultado.horasTrabalhadas,
          horasExtras: Math.max(0, resultado.saldoDia),
          horasEsperadas: resultado.horasEsperadas,
          saldoDia: resultado.saldoDia,
          ehDiaUtil: resultado.horasEsperadas > 0,
          paresPontos: resultado.paresPontos
        }
        
        console.log("📊 Novo resumo calculado:", novoResumo)
        
        // Atualizar resumosPorDia preservando todos os resumos existentes
        setResumosPorDia(prevResumos => {
          const novosResumos = { ...prevResumos }
          novosResumos[dataFormatada] = novoResumo
          
          // Log para debug
          console.log("📊 Resumos antes da atualização:", Object.keys(prevResumos))
          console.log("📊 Resumos após atualização:", Object.keys(novosResumos))
          
          return novosResumos
        })
      }
      
      // Chamar callback do componente pai se disponível
      if (onRegistrosUpdated) {
        console.log("🔄 Chamando callback do componente pai")
        onRegistrosUpdated(registrosFiltrados)
      }
      
      // Verificação extra: validar se realmente salvou
      if (registrosAtualizadosDia.length === 0 && registrosEditando.length > 0) {
        console.warn("⚠️ ATENÇÃO: Nenhum registro encontrado após salvamento, mas havia registros para salvar!")
        console.warn("Registros que deveriam ter sido salvos:", registrosEditando)
        mostrarToast("Aviso: Os registros podem não ter sido salvos corretamente", 'error')
        return
      }
      
      console.log("✅ Dados atualizados localmente:", registrosAtualizadosDia.length, "registros do dia")
      console.log("🎉 Salvamento concluído com sucesso!")
      mostrarToast("Horários salvos com sucesso!")
      
    } catch (error) {
      console.error("Erro ao salvar registros:", error)
      mostrarToast("Erro ao salvar horários. Tente novamente.", 'error')
    }
  }

  // Função para cancelar edição
  const cancelarEdicao = () => {
    setModalAberto(false)
    setDiaEditando(null)
    setRegistrosEditando([])
    setDataFormatadaEditando("")
    setSaldoDiaEditando(0)
    setSaldoTotalEditando(0)
  }

  // Funções auxiliares para converter tempo
  const minutosParaHorasInput = (minutos: number): string => {
    const horas = Math.floor(Math.abs(minutos) / 60)
    const mins = Math.abs(minutos) % 60
    const sinal = minutos < 0 ? '-' : ''
    return `${sinal}${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const horasInputParaMinutos = (horasStr: string): number => {
    const sinal = horasStr.startsWith('-') ? -1 : 1
    const limpo = horasStr.replace('-', '')
    const [horas, minutos] = limpo.split(':').map(Number)
    return sinal * (horas * 60 + minutos)
  }

  // Verificar se a tabela de ajustes existe
  useEffect(() => {
    const verificarTabela = async () => {
      const existe = await verificarTabelaAjustesSaldo()
      setTabelaAjustesExiste(existe)
      if (!existe) {
        console.warn("⚠️ Tabela ajustes_saldo não existe. Funcionalidade de ajustes desabilitada.")
      }
    }
    verificarTabela()
  }, [])

  // Carregar ajustes de saldo para a semana atual
  useEffect(() => {
    if (!funcionarioId || !diasDaSemana.length || !tabelaAjustesExiste) return

    const carregarAjustesSaldo = async () => {
      try {
        const novosAjustes: Record<string, {saldoDia: number, saldoTotal: number}> = {}
        
        for (const dia of diasDaSemana) {
          const dataFormatada = format(dia, "dd/MM/yyyy")
          const ajuste = await buscarAjusteSaldo(funcionarioId, dataFormatada)
          
          if (ajuste) {
            novosAjustes[dataFormatada] = {
              saldoDia: ajuste.saldo_dia_ajustado,
              saldoTotal: ajuste.saldo_total_ajustado
            }
          }
        }
        
        setAjustesSaldo(novosAjustes)
        console.log("📊 Ajustes de saldo carregados:", Object.keys(novosAjustes).length)
      } catch (error) {
        console.error("Erro ao carregar ajustes de saldo:", error)
      }
    }

    carregarAjustesSaldo()
  }, [funcionarioId, diasDaSemana, forceUpdate, tabelaAjustesExiste])

  // Função para adicionar novo registro de ponto
  const adicionarRegistro = () => {
    if (!diaEditando || !funcionarioNome) return
    
    const novoRegistro: RegistroPonto = {
      id: `temp-${Date.now()}`, // ID temporário
      funcionario_id: funcionarioId,
      nome_funcionario: funcionarioNome,
      data_hora: format(diaEditando, "yyyy-MM-dd") + "T08:00:00.000Z",
      tipo: "Entrada",
      created_at: new Date().toISOString()
    }
    
    setRegistrosEditando([...registrosEditando, novoRegistro])
  }

  // Função para remover registro de ponto
  const removerRegistro = (index: number) => {
    const novosRegistros = registrosEditando.filter((_, i) => i !== index)
    setRegistrosEditando(novosRegistros)
  }

  // Função para atualizar registro específico
  const atualizarRegistro = (index: number, campo: 'data_hora' | 'tipo', valor: string) => {
    const novosRegistros = [...registrosEditando]
    if (campo === 'data_hora') {
      if (!diaEditando) return
      
      // Criar nova data/hora mantendo o dia correto e usando horário local
      // Criar data local sem conversão de fuso horário
      const [horas, minutos] = valor.split(':')
      const dataLocal = new Date(diaEditando)
      dataLocal.setHours(parseInt(horas), parseInt(minutos), 0, 0)
      const novaDataHora = dataLocal.toISOString()
      
      console.log(`Atualizando registro ${index}: ${valor} → ${novaDataHora}`)
      novosRegistros[index].data_hora = novaDataHora
    } else {
      novosRegistros[index].tipo = valor
    }
    setRegistrosEditando(novosRegistros)
  }

  // Função de debug para investigar problemas (disponível no console)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { debugCalendario: () => void }).debugCalendario = () => {
        
        const hoje = new Date()
        const hojeFormatado = format(hoje, "dd/MM/yyyy")
        
        // Debug do saldo total
        const saldoTotal = calcularSaldoTotalMes(hoje)
      }
    }
  }, [funcionarioId, diasDaSemana, registros, registrosAtualizados, resumosPorDia, calcularSaldoTotalMes])

  return (
    <Card className="w-full rounded-none">
      <CardHeader className="flex flex-row items-center justify-between bg-primary text-white p-4">
        <Button variant="ghost" size="sm" onClick={semanaAnterior} className="text-white hover:bg-white/10 no-print">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <CardTitle className="text-lg font-semibold flex items-center">
          <CalendarCheck className="h-6 w-6 mr-2" />
          {formatarPeriodoSemana()}
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={imprimirCalendario}
            className="text-white hover:bg-white/10 no-print"
            data-export-calendar-semanal
          >
            <Printer className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={proximaSemana} className="text-white hover:bg-white/10 no-print">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4" id="calendario-semanal-para-impressao" ref={calendarioRef}>
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
              REGISTRO DE PONTO SEMANAL - {funcionarioNome ? funcionarioNome.toUpperCase() : ""}
            </h1>
            <div className="h-4"></div> {/* Espaçamento adicional entre os textos */}
            <h2 className="text-lg font-bold text-secondary uppercase">PERÍODO: {formatarPeriodoSemanaCompleto()}</h2>
          </div>
        </div>

        {/* Tabela detalhada por dia */}
        {!diasDaSemana.length || !funcionarioCarregado ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando dados da semana...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-primary text-white print-table-header">
                  <th className="p-2 text-left border">Dia</th>
                  <th className="p-2 text-center border">Registros de Ponto</th>
                  <th className="p-2 text-center border">Horas Trabalhadas</th>
                  <th className="p-2 text-center border">Horas Esperadas</th>
                  <th className="p-2 text-center border">Saldo</th>
                  <th className="p-2 text-center border">Saldo Total</th>
                </tr>
              </thead>
              <tbody>
                {diasDaSemana.map((dia, index) => {
                  const dataFormatada = format(dia, "dd/MM/yyyy")
                  const diaSemana = format(dia, "EEEE", { locale: ptBR })
                  const ehHoje = isToday(dia)
                  const resumo = getResumoDia(dia)

                  // Verificar se é final de semana
                  const ehFinalDeSemana = dia.getDay() === 0 || dia.getDay() === 6

                  // Alternar cores de linha
                  const linhaAlternada = index % 2 === 0 ? "" : "bg-primary/5"

                  return (
                    <tr
                      key={dataFormatada}
                      className={`border hover:bg-gray-50 cursor-pointer ${ehHoje ? "bg-primary/10 dia-atual" : ehFinalDeSemana ? "bg-amber-50" : linhaAlternada
                        } ${dataFormatada === diaSelecionado ? "bg-primary/20 dia-selecionado" : ""}`}
                      onClick={() => selecionarDia(dia)}
                    >
                      <td className="p-2 border">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}</div>
                            <div className="text-xs text-gray-500">{format(dia, "dd/MM/yyyy")}</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              abrirModalEdicao(dia)
                            }}
                            className="h-6 w-6 p-0 no-print"
                            title="Editar horários"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="p-2 border">
                        {resumo && resumo.paresPontos && resumo.paresPontos.length > 0 ? (
                          <div className="space-y-1">
                            {resumo.paresPontos.map((par, idx) => (
                              <div key={idx} className="flex items-center justify-center gap-2 text-sm">
                                <span className="text-green-600">{par.entrada}</span>
                                <span className="text-gray-400">→</span>
                                <span className="text-red-600">{par.saida || "--:--"}</span>
                                {par.minutos > 0 && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    ({Math.floor(par.minutos / 60)}h{par.minutos % 60}m)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-gray-400">Sem registros</div>
                        )}
                      </td>
                      <td className="p-2 text-center border">
                        {resumo && (
                          <Badge variant="outline" className="bg-gray-50">
                            {minutosParaHoras(resumo.horasTrabalhadas)}
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-center border">
                        <Badge variant="outline" className="bg-white">
                          {getHorarioEsperadoFormatado(dia)}
                        </Badge>
                      </td>
                      <td className="p-2 text-center border">
                        {resumo && (() => {
                          const resumoComAjuste = aplicarAjustesSaldo(resumo, dataFormatada)
                          return (
                            <Badge
                              variant="outline"
                              className={
                                resumoComAjuste.saldoDia > 0 
                                  ? "bg-green-100 text-green-800 border-green-300" 
                                  : resumoComAjuste.saldoDia < 0 
                                    ? "bg-red-100 text-red-800 border-red-300"
                                    : "bg-gray-100 text-gray-800 border-gray-300"
                              }
                            >
                              {resumoComAjuste.saldoDia > 0 ? "+" : resumoComAjuste.saldoDia < 0 ? "-" : ""}
                              {minutosParaHoras(Math.abs(resumoComAjuste.saldoDia))}
                              {ajustesSaldo[dataFormatada] && (
                                <span className="ml-1 text-xs">*</span>
                              )}
                            </Badge>
                          )
                        })()}
                      </td>
                      <td className="p-2 text-center border">
                        {(() => {
                          // Não mostrar saldo total para sábado e domingo (finais de semana)
                          const ehFinalDeSemana = dia.getDay() === 0 || dia.getDay() === 6
                          if (ehFinalDeSemana) {
                            return <span className="text-gray-400">-</span>
                          }
                          
                          const saldoTotal = calcularSaldoTotalMes(dia)
                          return (
                            <Badge
                              variant="outline"
                              className={
                                saldoTotal > 0 
                                  ? "bg-green-100 text-green-800 border-green-300" 
                                  : saldoTotal < 0 
                                    ? "bg-red-100 text-red-800 border-red-300"
                                    : "bg-gray-100 text-gray-800 border-gray-300"
                              }
                            >
                              {saldoTotal > 0 ? "+" : saldoTotal < 0 ? "-" : ""}
                              {minutosParaHoras(Math.abs(saldoTotal))}
                            </Badge>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-white print-table-footer">
                  <td
                    className="p-2"
                    colSpan={2}
                    style={{
                      borderTop: "2px solid black",
                      borderBottom: "2px solid black",
                      borderLeft: "2px solid black",
                      borderRight: "none",
                      backgroundColor: "white",
                    }}
                  >
                    <span className="text-sm">Total da Semana</span>
                  </td>
                  <td
                    className="p-2 text-center"
                    style={{
                      borderTop: "2px solid black",
                      borderBottom: "2px solid black",
                      borderLeft: "none",
                      borderRight: "none",
                      backgroundColor: "rgb(19, 123, 118)",
                      color: "white",
                      fontSize: "0.875rem",
                    }}
                  >
                    {minutosParaHoras(totalSemana.trabalhadas)}
                  </td>
                  <td
                    className="p-2 text-center"
                    style={{
                      borderTop: "2px solid black",
                      borderBottom: "2px solid black",
                      borderLeft: "none",
                      borderRight: "none",
                      backgroundColor: "rgb(19, 123, 118)",
                      color: "white",
                      fontSize: "0.875rem",
                    }}
                  >
                    {minutosParaHoras(totalSemana.esperadas)}
                  </td>
                  <td
                    className="p-2 text-center"
                    style={{
                      borderTop: "2px solid black",
                      borderBottom: "2px solid black",
                      borderLeft: "none",
                      borderRight: "none",
                      backgroundColor: "rgb(19, 123, 118)",
                      color: "white",
                      fontSize: "0.875rem",
                    }}
                  >
                    <span style={{ color: "white" }}>
                      {totalSemana.saldo > 0 ? "+" : totalSemana.saldo < 0 ? "-" : ""}
                      {minutosParaHoras(Math.abs(totalSemana.saldo))}
                    </span>
                  </td>
                  <td className="p-2 text-center" style={{
                    borderTop: "2px solid black",
                    borderBottom: "2px solid black", 
                    borderRight: "2px solid black",
                    backgroundColor: "rgb(19, 123, 118)",
                    color: "white",
                    fontSize: "0.875rem",
                  }}>
                    {(() => {
                      // Calcular saldo total do mês até hoje (com lógica inteligente)
                      const hoje = new Date()
                      const saldoTotalMes = calcularSaldoTotalMes(hoje)
                      return (
                        <span style={{ color: "white" }}>
                          {saldoTotalMes > 0 ? "+" : saldoTotalMes < 0 ? "-" : ""}
                          {minutosParaHoras(Math.abs(saldoTotalMes))}
                        </span>
                      )
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Saldo Total Acumulado - só aparece se snapshot existir */}
        {saldoTotalAcumulado !== null && (
          <div className="mt-2 p-3 bg-gray-100 rounded-md flex items-center justify-between no-print">
            <span className="text-sm font-medium text-gray-600">
              Saldo Total Acumulado (desde {saldoDataReferencia!.split('-').reverse().join('/')})
            </span>
            <span className={`text-lg font-bold ${saldoTotalAcumulado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {saldoTotalAcumulado >= 0 ? '+' : '-'}{minutosParaHoras(Math.abs(saldoTotalAcumulado))}
            </span>
          </div>
        )}

        {/* Legenda - visível apenas na tela, não na impressão */}
        <div className="mt-4 text-sm text-gray-600 flex flex-wrap gap-4 no-print">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-primary/10 mr-1 border border-gray-300"></div>
            <span>Hoje</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-amber-50 mr-1 border border-gray-300"></div>
            <span>Final de Semana</span>
          </div>
          <div className="flex items-center">
            <ArrowDown className="h-4 w-4 text-green-600 mr-1" />
            <span>Entrada</span>
          </div>
          <div className="flex items-center">
            <ArrowUp className="h-4 w-4 text-red-600 mr-1" />
            <span>Saída</span>
          </div>
        </div>

        {/* Área de assinaturas - visível apenas na impressão */}
        <div className="hidden print:block mt-12">
          {/* Área de assinaturas */}
          <div className="flex justify-between">
            {/* Assinatura do funcionário */}
            <div className="w-5/12">
              <div className="border-t border-black pt-2">
                <p className="font-medium">{funcionarioNome}</p>
                <p className="text-sm text-gray-600">
                  {formatarDiaSemana(new Date())}, {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Assinatura da CEO */}
            <div className="w-5/12">
              <div className="border-t border-black pt-2">
                <p className="font-medium">Ana Maria Cardoso de Oliveira</p>
                <p className="text-sm text-gray-600">
                  {formatarDiaSemana(new Date())}, {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-gray-500">
            <p>Documento gerado em {format(new Date(), "dd/MM/yyyy HH:mm")} - Vitall Check-Up</p>
          </div>
        </div>

        {/* Modal de Edição de Horários */}
        {modalAberto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
            <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  Editar Registros de Ponto - {dataFormatadaEditando}
                </h2>
                <Button
                  onClick={adicionarRegistro}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Horário
                </Button>
              </div>
              
              <div className="space-y-4">
                {(() => {
                  return null
                })()}
                {registrosEditando.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nenhum registro de ponto neste dia.</p>
                    <p className="text-sm">Clique em &quot;Adicionar Horário&quot; para criar um novo registro.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {registrosEditando.map((registro, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-medium">Registro {index + 1}</Label>
                          <Button
                            onClick={() => removerRegistro(index)}
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`horario-${index}`} className="text-sm">Horário</Label>
                            <Input
                              id={`horario-${index}`}
                              type="time"
                              value={registro.data_hora ? (() => {
                                try {
                                  // Converter para data local e extrair horário
                                  const dataRegistro = new Date(registro.data_hora)
                                  if (isNaN(dataRegistro.getTime())) {
                                    console.error("Data inválida:", registro.data_hora)
                                    return "08:00"
                                  }
                                  
                                  // Formatatar como HH:MM local
                                  const horas = dataRegistro.getHours().toString().padStart(2, '0')
                                  const minutos = dataRegistro.getMinutes().toString().padStart(2, '0')
                                  const horaFormatada = `${horas}:${minutos}`
                                  
                                  console.log(`Exibindo hora: ${registro.data_hora} → ${horaFormatada}`)
                                  return horaFormatada
                                } catch (error) {
                                  console.error("Erro ao extrair hora no modal:", error, registro.data_hora)
                                  return "08:00"
                                }
                              })() : "08:00"}
                              onChange={(e) => atualizarRegistro(index, 'data_hora', e.target.value)}
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor={`tipo-${index}`} className="text-sm">Tipo</Label>
                            <select
                              id={`tipo-${index}`}
                              value={registro.tipo || "Entrada"}
                              onChange={(e) => atualizarRegistro(index, 'tipo', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                              <option value="Entrada">Entrada</option>
                              <option value="Saída Almoço">Saída Almoço</option>
                              <option value="Retorno Almoço">Retorno Almoço</option>
                              <option value="Saída">Saída</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-500">
                          {registro.id.startsWith('temp-') ? (
                            <span className="text-green-600">• Novo registro</span>
                          ) : (
                            <span>• ID: {registro.id}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Campos de edição de saldos - só exibir se a tabela existir */}
                {tabelaAjustesExiste ? (
                  <div className="mt-6 pt-4 border-t border-gray-200 space-y-4">
                    <h3 className="text-md font-semibold text-gray-700">Edição Manual de Saldos</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Campo para saldo do dia */}
                    <div>
                      <Label htmlFor="saldo-dia" className="text-sm font-medium">
                        Saldo do Dia 
                        <span className="text-xs text-gray-500 ml-1">(formato: ±HH:MM)</span>
                      </Label>
                      <Input
                        id="saldo-dia"
                        type="text"
                        placeholder="±00:00"
                        value={minutosParaHorasInput(saldoDiaEditando)}
                        onChange={(e) => {
                          try {
                            const minutos = horasInputParaMinutos(e.target.value)
                            setSaldoDiaEditando(minutos)
                          } catch {
                            // Ignore invalid inputs
                          }
                        }}
                        className="font-mono"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Atual: {saldoDiaEditando > 0 ? '+' : ''}{minutosParaHoras(saldoDiaEditando)}
                      </div>
                    </div>

                    {/* Campo para saldo total */}
                    <div>
                      <Label htmlFor="saldo-total" className="text-sm font-medium">
                        Saldo Total do Mês 
                        <span className="text-xs text-gray-500 ml-1">(formato: ±HH:MM)</span>
                      </Label>
                      <Input
                        id="saldo-total"
                        type="text"
                        placeholder="±00:00"
                        value={minutosParaHorasInput(saldoTotalEditando)}
                        onChange={(e) => {
                          try {
                            const minutos = horasInputParaMinutos(e.target.value)
                            setSaldoTotalEditando(minutos)
                          } catch {
                            // Ignore invalid inputs
                          }
                        }}
                        className="font-mono"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Atual: {saldoTotalEditando > 0 ? '+' : ''}{minutosParaHoras(saldoTotalEditando)}
                      </div>
                    </div>
                  </div>

                    <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-md">
                      <strong>Aviso:</strong> A edição manual de saldos sobrescreve os cálculos automáticos. 
                      Use com cuidado para correções pontuais.
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-md">
                      <strong>ℹ️ Funcionalidade Indisponível</strong>
                      <p className="mt-2">
                        A edição manual de saldos requer a criação da tabela <code className="bg-gray-200 px-1 rounded">ajustes_saldo</code> no banco de dados.
                      </p>
                      <p className="mt-1 text-xs">
                        Execute o script SQL em <code>scripts/create_ajustes_saldo_table.sql</code> para habilitar esta funcionalidade.
                      </p>
                    </div>
                  </div>
                )}

                {/* Botões do modal */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={salvarHorario} className="flex-1">
                    Salvar Alterações
                  </Button>
                  <Button onClick={cancelarEdicao} variant="outline" className="flex-1">
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast de Notificação */}
        {showToast && (
          <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-2 duration-300">
            <div className={`${
              toastType === 'success' ? 'bg-green-500' : 'bg-red-500'
            } text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-sm`}>
              <div className="flex-shrink-0">
                {toastType === 'success' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{toastMessage}</p>
              </div>
              <button
                onClick={() => setShowToast(false)}
                className={`flex-shrink-0 ${
                  toastType === 'success' ? 'text-green-200 hover:text-white' : 'text-red-200 hover:text-white'
                } transition-colors`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
