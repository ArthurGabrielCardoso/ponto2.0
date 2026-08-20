import { format, parseISO, differenceInMinutes, isWeekend, eachDayOfInterval } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { RegistroPonto, ResumoHoras, RelatorioPonto, ParPontos } from "./types"

// Constantes
const HORAS_NORMAIS_DIA = 8 * 60 // 8 horas em minutos por padrão
const LIMITE_JORNADA_CURTA = 4 * 60 // 4 horas em minutos (para alertas)
const LIMITE_JORNADA_LONGA = 12 * 60 // 12 horas em minutos (para alertas)

// Formatar data para exibição
export function formatarData(dataString: string): string {
  try {
    // Verificar se a string está no formato dd/MM/yyyyTHH:mm:00.000Z
    if (dataString.includes("/") && dataString.includes("T")) {
      // Converter para formato ISO
      const [dataParte, horaParte] = dataString.split("T")
      const [dia, mes, ano] = dataParte.split("/")
      dataString = `${ano}-${mes}-${dia}T${horaParte}`
    }

    const data = parseISO(dataString)

    // Verificar se a data é válida
    if (isNaN(data.getTime())) {
      console.error("Data inválida:", dataString)
      return "Data inválida"
    }

    return format(data, "dd/MM/yyyy", { locale: ptBR })
  } catch (error) {
    console.error("Erro ao formatar data:", error, "para a string:", dataString)
    return "Data inválida"
  }
}

// Formatar hora para exibição
export function formatarHora(dataString: string): string {
  try {
    // Verificar se a string está no formato dd/MM/yyyyTHH:mm:00.000Z
    if (dataString.includes("/") && dataString.includes("T")) {
      // Converter para formato ISO
      const [dataParte, horaParte] = dataString.split("T")
      const [dia, mes, ano] = dataParte.split("/")
      dataString = `${ano}-${mes}-${dia}T${horaParte}`
    }

    const data = parseISO(dataString)

    // Verificar se a data é válida
    if (isNaN(data.getTime())) {
      console.error("Hora inválida:", dataString)
      return "--:--"
    }

    return format(data, "HH:mm", { locale: ptBR })
  } catch (error) {
    console.error("Erro ao formatar hora:", error, "para a string:", dataString)
    return "--:--"
  }
}

// Verificar se é dia útil
export function ehDiaUtil(data: Date): boolean {
  return !isWeekend(data) // Simplificado - não considera feriados
}

// Agrupar registros por dia (deduplica registros com menos de 5 min de diferença)
export function agruparRegistrosPorDia(registros: RegistroPonto[]): Record<string, RegistroPonto[]> {
  const registrosPorDia: Record<string, RegistroPonto[]> = {}

  registros.forEach((registro) => {
    const data = formatarData(registro.data_hora)
    if (!registrosPorDia[data]) {
      registrosPorDia[data] = []
    }
    registrosPorDia[data].push(registro)
  })

  // Deduplicar: se dois registros consecutivos têm menos de 5 min de diferença, manter só o primeiro
  for (const data in registrosPorDia) {
    const regs = registrosPorDia[data].sort((a, b) => {
      const dA = parseISO(a.data_hora).getTime()
      const dB = parseISO(b.data_hora).getTime()
      return dA - dB
    })
    const deduped: RegistroPonto[] = []
    for (const reg of regs) {
      const last = deduped[deduped.length - 1]
      if (last) {
        const diff = Math.abs(parseISO(reg.data_hora).getTime() - parseISO(last.data_hora).getTime())
        if (diff < 5 * 60 * 1000) continue // menos de 5 min → duplicata
      }
      deduped.push(reg)
    }
    registrosPorDia[data] = deduped
  }

  return registrosPorDia
}

// Função para obter registros de almoço de um dia
export function obterRegistrosAlmoco(registrosDoDia: RegistroPonto[]): {
  saidaAlmoco?: string
  retornoAlmoco?: string
} {
  // Verificar se há registros suficientes
  if (!registrosDoDia || registrosDoDia.length < 3) {
    return { saidaAlmoco: undefined, retornoAlmoco: undefined }
  }

  try {
    // Ordenar registros por hora
    const registrosOrdenados = [...registrosDoDia].sort((a, b) => {
      try {
        const dataA = parseISO(a.data_hora)
        const dataB = parseISO(b.data_hora)

        // Verificar se as datas são válidas
        if (isNaN(dataA.getTime()) || isNaN(dataB.getTime())) {
          return 0
        }

        return dataA.getTime() - dataB.getTime()
      } catch (error) {
        console.error("Erro ao ordenar registros:", error)
        return 0
      }
    })

    // Procurar registros de almoço por tipo
    const saidaAlmoco = registrosOrdenados.find((r) => r.tipo === "Saída Almoço")
    const retornoAlmoco = registrosOrdenados.find((r) => r.tipo === "Retorno Almoço")

    // Se não encontrar por tipo, usar o segundo e terceiro registros
    if (!saidaAlmoco && !retornoAlmoco && registrosOrdenados.length >= 4) {
      try {
        const saidaHora = formatarHora(registrosOrdenados[1].data_hora)
        const retornoHora = formatarHora(registrosOrdenados[2].data_hora)

        return {
          saidaAlmoco: saidaHora !== "--:--" ? saidaHora : undefined,
          retornoAlmoco: retornoHora !== "--:--" ? retornoHora : undefined,
        }
      } catch (error) {
        console.error("Erro ao formatar horários de almoço:", error)
        return { saidaAlmoco: undefined, retornoAlmoco: undefined }
      }
    }

    return {
      saidaAlmoco: saidaAlmoco ? formatarHora(saidaAlmoco.data_hora) : undefined,
      retornoAlmoco: retornoAlmoco ? formatarHora(retornoAlmoco.data_hora) : undefined,
    }
  } catch (error) {
    console.error("Erro ao obter registros de almoço:", error)
    return { saidaAlmoco: undefined, retornoAlmoco: undefined }
  }
}

// Calcular horas trabalhadas e horas extras por dia
export function calcularHorasPorDia(
  registrosDoDia: RegistroPonto[],
  cargaHorariaDiaria: number = HORAS_NORMAIS_DIA,
): ResumoHoras {
  try {
    // Verificar se há registros
    if (!registrosDoDia || registrosDoDia.length === 0) {
      return {
        data: "Sem data",
        horasTrabalhadas: 0,
        horasExtras: 0,
        horasEsperadas: 0,
        saldoDia: 0,
        ehDiaUtil: false,
      }
    }

    // Ordenar registros por hora
    const registrosOrdenados = [...registrosDoDia].sort((a, b) => {
      try {
        const dataA = parseISO(a.data_hora)
        const dataB = parseISO(b.data_hora)
        return dataA.getTime() - dataB.getTime()
      } catch (error) {
        console.error("Erro ao ordenar registros:", error)
        return 0
      }
    })

    // Data do registro para verificar se é dia útil
    let dataRegistro
    try {
      dataRegistro = parseISO(registrosDoDia[0].data_hora)
      if (isNaN(dataRegistro.getTime())) {
        dataRegistro = new Date()
      }
    } catch (error) {
      console.error("Erro ao processar data do registro:", error)
      dataRegistro = new Date()
    }

    const diaEhUtil = ehDiaUtil(dataRegistro)
    const horasEsperadas = diaEhUtil ? cargaHorariaDiaria : 0

    // Agrupar registros em pares (entrada/saída)
    // Consideramos que registros alternados são entradas e saídas
    let totalMinutos = 0
    const pares: ParPontos[] = []

    // Criar pares de entrada/saída
    for (let i = 0; i < registrosOrdenados.length; i += 2) {
      const entrada = registrosOrdenados[i]
      const saida = i + 1 < registrosOrdenados.length ? registrosOrdenados[i + 1] : null

      if (entrada && saida) {
        const entradaDate = parseISO(entrada.data_hora)
        const saidaDate = parseISO(saida.data_hora)

        const minutos = differenceInMinutes(saidaDate, entradaDate)
        totalMinutos += minutos > 0 ? minutos : 0

        pares.push({
          entrada: formatarHora(entrada.data_hora),
          saida: formatarHora(saida.data_hora),
          minutos: minutos > 0 ? minutos : 0,
        })
      } else if (entrada) {
        // Caso tenha apenas entrada sem saída correspondente
        pares.push({
          entrada: formatarHora(entrada.data_hora),
          saida: null,
          minutos: 0,
        })
      }
    }

    const horasTrabalhadas = totalMinutos
    const horasExtras = diaEhUtil ? Math.max(0, horasTrabalhadas - cargaHorariaDiaria) : horasTrabalhadas
    const saldoDia = horasTrabalhadas - horasEsperadas

    // Verificar inconsistências
    const inconsistencias: string[] = []

    // Verificar número ímpar de registros (entrada sem saída)
    if (registrosOrdenados.length % 2 !== 0) {
      inconsistencias.push("Registro incompleto: entrada sem saída correspondente")
    }

    // Verificar jornada muito curta (em dia útil)
    if (diaEhUtil && horasTrabalhadas > 0 && horasTrabalhadas < LIMITE_JORNADA_CURTA) {
      inconsistencias.push(`Jornada muito curta (${minutosParaHoras(horasTrabalhadas)})`)
    }

    // Verificar jornada muito longa
    if (horasTrabalhadas > LIMITE_JORNADA_LONGA) {
      inconsistencias.push(`Jornada muito longa (${minutosParaHoras(horasTrabalhadas)})`)
    }

    // Obter a data formatada com segurança
    let dataFormatada
    try {
      dataFormatada = formatarData(registrosDoDia[0].data_hora)
    } catch (error) {
      console.error("Erro ao formatar data do resumo:", error)
      dataFormatada = "Data inválida"
    }

    // Obter primeiro e último registro para mostrar entrada e saída principal
    const entrada = registrosOrdenados.length > 0 ? formatarHora(registrosOrdenados[0].data_hora) : undefined
    const saida =
      registrosOrdenados.length > 1
        ? formatarHora(registrosOrdenados[registrosOrdenados.length - 1].data_hora)
        : undefined

    return {
      data: dataFormatada,
      entrada,
      saida,
      horasTrabalhadas,
      horasExtras,
      horasEsperadas,
      saldoDia,
      inconsistencias: inconsistencias.length > 0 ? inconsistencias : undefined,
      ehDiaUtil: diaEhUtil,
      paresPontos: pares, // Novo campo para armazenar todos os pares de entrada/saída
    }
  } catch (error) {
    console.error("Erro ao calcular horas por dia:", error)
    return {
      data: "Erro",
      horasTrabalhadas: 0,
      horasExtras: 0,
      horasEsperadas: 0,
      saldoDia: 0,
      ehDiaUtil: false,
      inconsistencias: ["Erro ao processar registros"],
    }
  }
}

// Gerar relatório de ponto
export function gerarRelatorioPonto(
  registros: RegistroPonto[],
  funcionario: string,
  funcionarioId: string,
  dataInicio: string,
  dataFim: string,
  cargaHorariaDiaria: number = HORAS_NORMAIS_DIA,
): RelatorioPonto {
  const registrosPorDia = agruparRegistrosPorDia(registros)
  const resumos: ResumoHoras[] = []
  const alertas: string[] = []

  // Obter todos os dias do período
  const inicio = parseISO(dataInicio)
  const fim = parseISO(dataFim)
  const diasDoPeriodo = eachDayOfInterval({ start: inicio, end: fim })

  // Contar dias úteis no período
  const diasUteis = diasDoPeriodo.filter((dia) => ehDiaUtil(dia)).length

  // Para cada dia com registros, calcular as horas
  Object.entries(registrosPorDia).forEach(([data, registrosDoDia]) => {
    const resumo = calcularHorasPorDia(registrosDoDia, cargaHorariaDiaria)
    resumos.push(resumo)

    // Adicionar inconsistências aos alertas
    if (resumo.inconsistencias && resumo.inconsistencias.length > 0) {
      resumo.inconsistencias.forEach((inconsistencia) => {
        alertas.push(`${data}: ${inconsistencia}`)
      })
    }
  })

  // Verificar dias úteis sem registro (faltas)
  const diasComRegistro = new Set(resumos.map((r) => r.data))
  const diasFalta = diasDoPeriodo.filter((dia) => {
    const dataFormatada = formatarData(dia.toISOString())
    return ehDiaUtil(dia) && !diasComRegistro.has(dataFormatada)
  })

  // Adicionar alertas para dias de falta
  diasFalta.forEach((dia) => {
    alertas.push(`${formatarData(dia.toISOString())}: Falta não justificada`)
  })

  // Calcular totais
  const totalHorasTrabalhadas = resumos.reduce((total, resumo) => total + resumo.horasTrabalhadas, 0)
  const totalHorasExtras = resumos.reduce((total, resumo) => total + resumo.horasExtras, 0)
  const totalHorasEsperadas = diasUteis * cargaHorariaDiaria
  const saldoMes = totalHorasTrabalhadas - totalHorasEsperadas
  const diasTrabalhados = resumos.filter((r) => r.horasTrabalhadas > 0).length
  const diasFaltas = diasUteis - diasTrabalhados

  return {
    funcionario,
    funcionarioId,
    periodo: `${formatarData(dataInicio)} a ${formatarData(dataFim)}`,
    registros: resumos,
    totalHorasTrabalhadas,
    totalHorasExtras,
    totalHorasEsperadas,
    saldoMes,
    diasTrabalhados,
    diasUteis,
    diasFaltas,
    alertas,
  }
}

// Converter minutos para formato de horas (HH:MM)
export function minutosParaHoras(minutos: number): string {
  const horas = Math.floor(Math.abs(minutos) / 60)
  const mins = Math.abs(minutos) % 60
  const sinal = minutos < 0 ? "-" : ""
  return `${sinal}${horas.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}

// Calcular carga horária esperada por dia da semana
export function calcularCargaHorariaPorDia(data: Date): number {
  const diaSemana = data.getDay()
  
  // Segunda a Quinta: 9 horas (540 minutos)
  // Sexta: 8 horas (480 minutos)
  // Sábado e Domingo: 0 horas (não trabalha)
  
  if (diaSemana >= 1 && diaSemana <= 4) { // Segunda a Quinta
    return 9 * 60 // 540 minutos = 9 horas
  } else if (diaSemana === 5) { // Sexta
    return 8 * 60 // 480 minutos = 8 horas
  } else { // Sábado e Domingo
    return 0
  }
}

// Calcular saldo de horas trabalhadas no dia (versão corrigida)
export function calcularSaldoDia(registrosDoDia: RegistroPonto[], data: Date): {
  horasTrabalhadas: number
  horasEsperadas: number
  saldoDia: number
  paresPontos: ParPontos[]
} {
  try {
    console.log("Calculando saldo para:", format(data, "dd/MM/yyyy"), "registros:", registrosDoDia.length)
    
    // Verificar se há registros
    if (!registrosDoDia || registrosDoDia.length === 0) {
      const horasEsperadas = calcularCargaHorariaPorDia(data)
      return {
        horasTrabalhadas: 0,
        horasEsperadas,
        saldoDia: -horasEsperadas, // Negativo se não trabalhou
        paresPontos: []
      }
    }

    // Ordenar registros por hora (ignorando segundos)
    const registrosOrdenados = [...registrosDoDia].sort((a, b) => {
      try {
        const dataA = parseISO(a.data_hora)
        const dataB = parseISO(b.data_hora)
        
        // Zerar segundos e milissegundos para comparação
        dataA.setSeconds(0, 0)
        dataB.setSeconds(0, 0)
        
        return dataA.getTime() - dataB.getTime()
      } catch (error) {
        console.error("Erro ao ordenar registros:", error)
        return 0
      }
    })

    console.log("Registros ordenados:", registrosOrdenados.map(r => `${formatarHora(r.data_hora)} (${r.tipo})`))

    // Calcular horas trabalhadas agrupando em pares entrada/saída
    let totalMinutosTrabalhados = 0
    const pares: ParPontos[] = []

    // Criar pares de entrada/saída
    for (let i = 0; i < registrosOrdenados.length; i += 2) {
      const entrada = registrosOrdenados[i]
      const saida = i + 1 < registrosOrdenados.length ? registrosOrdenados[i + 1] : null

      if (entrada && saida) {
        const entradaDate = parseISO(entrada.data_hora)
        const saidaDate = parseISO(saida.data_hora)
        
        // Zerar segundos para cálculo preciso
        entradaDate.setSeconds(0, 0)
        saidaDate.setSeconds(0, 0)

        const minutosTrabalhados = differenceInMinutes(saidaDate, entradaDate)
        
        if (minutosTrabalhados > 0) {
          totalMinutosTrabalhados += minutosTrabalhados
        }

        pares.push({
          entrada: formatarHora(entrada.data_hora),
          saida: formatarHora(saida.data_hora),
          minutos: minutosTrabalhados > 0 ? minutosTrabalhados : 0,
        })

        console.log(`Par ${i/2 + 1}: ${formatarHora(entrada.data_hora)} → ${formatarHora(saida.data_hora)} = ${minutosTrabalhados} minutos`)
      } else if (entrada) {
        // Entrada sem saída correspondente
        pares.push({
          entrada: formatarHora(entrada.data_hora),
          saida: null,
          minutos: 0,
        })
        console.log(`Entrada sem saída: ${formatarHora(entrada.data_hora)}`)
      }
    }

    // Calcular horas esperadas baseado no dia da semana
    const horasEsperadas = calcularCargaHorariaPorDia(data)
    
    // Calcular saldo (diferença entre trabalhado e esperado)
    const saldoDia = totalMinutosTrabalhados - horasEsperadas

    console.log(`Resultado: Trabalhado=${totalMinutosTrabalhados}min (${minutosParaHoras(totalMinutosTrabalhados)}), Esperado=${horasEsperadas}min (${minutosParaHoras(horasEsperadas)}), Saldo=${saldoDia}min (${minutosParaHoras(saldoDia)})`)

    return {
      horasTrabalhadas: totalMinutosTrabalhados,
      horasEsperadas,
      saldoDia,
      paresPontos: pares
    }

  } catch (error) {
    console.error("Erro ao calcular saldo do dia:", error)
    const horasEsperadas = calcularCargaHorariaPorDia(data)
    return {
      horasTrabalhadas: 0,
      horasEsperadas,
      saldoDia: -horasEsperadas,
      paresPontos: []
    }
  }
}
