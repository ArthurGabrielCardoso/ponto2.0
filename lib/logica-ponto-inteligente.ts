import type { Funcionario, RegistroPonto, HorariosSemana, HorarioDia } from "./types"

export type TipoDiagnostico =
  | "DIRETO"
  | "PERGUNTA_ENTRADA_OU_ALMOCO"
  | "PERGUNTA_ALMOCO_OU_SAIDA"
  | "PERGUNTA_RETORNO_OU_SAIDA"
  | "DIA_COMPLETO"

export interface DiagnosticoPonto {
  tipo: TipoDiagnostico
  proximoTipoSugerido: "Entrada" | "Saída Almoço" | "Retorno Almoço" | "Saída"
  mensagemPergunta?: string
  horariosGrade: {
    entrada: string
    saidaAlmoco: string
    retornoAlmoco: string
    saida: string
  }
  horariosSugeridos?: {
    horaChegada?: string
    horaSaidaAlmoco?: string
    horaRetornoAlmoco?: string
    horaSaida?: string
  }
  registrosHoje: RegistroPonto[]
}

const horarioPadrao: HorarioDia = {
  entrada: "08:00",
  saida_almoco: "12:00",
  retorno_almoco: "13:00",
  saida: "17:00",
  ativo: true,
}

// Converte string "HH:mm" em minutos do dia
export function horaParaMinutos(horaStr?: string): number {
  if (!horaStr) return 0
  const [h, m] = horaStr.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

// Converte minutos do dia em string "HH:mm"
export function minutosParaHoraStr(minutos: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutos)))
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

// Obtém a grade de horários configurada para o dia da semana atual
export function obterGradeDoDia(horarios?: HorariosSemana | null, data = new Date()): {
  entrada: string
  saidaAlmoco: string
  retornoAlmoco: string
  saida: string
  ativo: boolean
} {
  const diaSemana = data.getDay() // 0 = Dom, 1 = Seg, ..., 6 = Sab
  const mapaDias: Record<number, keyof HorariosSemana> = {
    0: "domingo",
    1: "segunda",
    2: "terca",
    3: "quarta",
    4: "quinta",
    5: "sexta",
    6: "sabado",
  }

  const chave = mapaDias[diaSemana]
  const config = horarios && chave ? horarios[chave] : null

  if (config && config.ativo) {
    return {
      entrada: config.entrada || "08:00",
      saidaAlmoco: config.saida_almoco || "12:00",
      retornoAlmoco: config.retorno_almoco || "13:00",
      saida: config.saida || "17:00",
      ativo: true,
    }
  }

  return {
    entrada: horarioPadrao.entrada || "08:00",
    saidaAlmoco: horarioPadrao.saida_almoco || "12:00",
    retornoAlmoco: horarioPadrao.retorno_almoco || "13:00",
    saida: horarioPadrao.saida || "17:00",
    ativo: diaSemana >= 1 && diaSemana <= 5,
  }
}

/**
 * Analisa o contexto da batida comparando os registros existentes no dia
 * com a grade de horários do funcionário e a hora atual.
 */
export function analisarSituacaoPonto(
  funcionario: Funcionario,
  registrosHoje: RegistroPonto[],
  agora = new Date()
): DiagnosticoPonto {
  const grade = obterGradeDoDia(funcionario.horarios, agora)
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes()
  const primeiroNome = funcionario.nome.split(" ")[0]

  const minutosEntrada = horaParaMinutos(grade.entrada)
  const minutosSaidaAlmoco = horaParaMinutos(grade.saidaAlmoco)
  const minutosRetornoAlmoco = horaParaMinutos(grade.retornoAlmoco)
  const minutosSaida = horaParaMinutos(grade.saida)

  const qtdRegistros = registrosHoje.length

  // === 1. JÁ TEM 4 OU MAIS REGISTROS HOJE ===
  if (qtdRegistros >= 4) {
    return {
      tipo: "DIA_COMPLETO",
      proximoTipoSugerido: "Saída",
      mensagemPergunta: `Olá, ${primeiroNome}! Todos os 4 registros do seu expediente de hoje já foram preenchidos com sucesso.`,
      horariosGrade: grade,
      registrosHoje,
    }
  }

  // === 2. NENHUM REGISTRO HOJE (0 batidas) ===
  if (qtdRegistros === 0) {
    // Se o horário atual já passou de (saída almoço - 30 min) ex: 11:30 em diante
    if (minutosAgora >= minutosSaidaAlmoco - 30) {
      return {
        tipo: "PERGUNTA_ENTRADA_OU_ALMOCO",
        proximoTipoSugerido: "Entrada",
        mensagemPergunta: `Olá, ${primeiroNome}! Não registrei sua entrada pela manhã e já estamos próximos ao horário de almoço.`,
        horariosGrade: grade,
        horariosSugeridos: {
          horaChegada: grade.entrada,
        },
        registrosHoje,
      }
    }

    // Horário normal matutino
    return {
      tipo: "DIRETO",
      proximoTipoSugerido: "Entrada",
      horariosGrade: grade,
      registrosHoje,
    }
  }

  // === 3. APENAS 1 REGISTRO HOJE (Tem "Entrada") ===
  if (qtdRegistros === 1) {
    // Se já é final da tarde / noite (ex: após retorno almoço + 2h30, ou >= 15:30)
    // O funcionário trabalhou o dia todo e esqueceu o almoço
    const limiteTarde = Math.max(minutosRetornoAlmoco + 150, 15 * 60 + 30)
    if (minutosAgora >= limiteTarde) {
      return {
        tipo: "PERGUNTA_ALMOCO_OU_SAIDA",
        proximoTipoSugerido: "Saída",
        mensagemPergunta: `Olá, ${primeiroNome}! Só registrei sua entrada hoje cedo e já estamos no fim do expediente.`,
        horariosGrade: grade,
        horariosSugeridos: {
          horaSaidaAlmoco: grade.saidaAlmoco,
          horaRetornoAlmoco: grade.retornoAlmoco,
        },
        registrosHoje,
      }
    }

    // Horário normal de saída para almoço
    return {
      tipo: "DIRETO",
      proximoTipoSugerido: "Saída Almoço",
      horariosGrade: grade,
      registrosHoje,
    }
  }

  // === 4. DOIS REGISTROS HOJE (Tem "Entrada" e "Saída Almoço") ===
  if (qtdRegistros === 2) {
    // Se já é final de tarde / saída (ex: passou de retorno_almoco + 2h, ex: >= 15:30 ou perto de saída)
    // O funcionário voltou do almoço, esqueceu de bater, e agora está indo embora
    const limiteFimExpediente = Math.max(minutosRetornoAlmoco + 120, minutosSaida - 90)
    if (minutosAgora >= limiteFimExpediente) {
      return {
        tipo: "PERGUNTA_RETORNO_OU_SAIDA",
        proximoTipoSugerido: "Saída",
        mensagemPergunta: `Olá, ${primeiroNome}! Acredito que você esqueceu de bater o retorno do almoço mais cedo.`,
        horariosGrade: grade,
        horariosSugeridos: {
          horaRetornoAlmoco: grade.retornoAlmoco,
        },
        registrosHoje,
      }
    }

    // Horário normal de retorno do almoço
    return {
      tipo: "DIRETO",
      proximoTipoSugerido: "Retorno Almoço",
      horariosGrade: grade,
      registrosHoje,
    }
  }

  // === 5. TRÊS REGISTROS HOJE (Falta apenas a "Saída") ===
  return {
    tipo: "DIRETO",
    proximoTipoSugerido: "Saída",
    horariosGrade: grade,
    registrosHoje,
  }
}
