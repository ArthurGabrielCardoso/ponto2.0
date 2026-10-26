import type { Funcionario, RegistroPonto, HorariosSemana, HorarioDia } from "./types"
import { ehTipoOutro, type TipoFixo } from "./tipos-ponto"

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

/**
 * Qual dos quatro tipos fixos um texto de `registros_ponto.tipo` representa.
 *
 * A tabela tem lixo histórico — "entrada", "saida_almoco", "Limite atingido" —
 * então a leitura é tolerante a caixa, acento e underscore, e devolve `null`
 * para o que não é nenhum dos quatro (incluindo "Outro - ..."). Diferente do
 * `normalizarTipoPonto` da saudação, que cai em "Entrada" para o desconhecido:
 * aqui isso faria uma linha de lixo contar como entrada já registrada.
 */
export function classificarTipoFixo(tipo?: string | null): TipoFixo | null {
  if (!tipo || ehTipoOutro(tipo)) return null
  const t = tipo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
  if (t.includes("entrada")) return "Entrada"
  if (t.includes("saida") && t.includes("almoco")) return "Saída Almoço"
  if (t.includes("retorno") || t.includes("volta")) return "Retorno Almoço"
  if (t.includes("saida")) return "Saída"
  return null
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

const ORDEM_DO_DIA: TipoFixo[] = ["Entrada", "Saída Almoço", "Retorno Almoço", "Saída"]

/**
 * Em que ponto da jornada o dia está, olhando os TIPOS que existem — não
 * quantos registros há.
 *
 * Contar registros quebrava de três jeitos: um "Outro - saindo: Banco" no meio
 * do dia empurrava a conta uma casa à frente (e a sugestão virava "Saída" às
 * 12h); um registro duplicado fazia o mesmo; e uma batida esquecida deslocava
 * todas as seguintes. Pelo tipo, 0 = nada ainda, 1 = tem Entrada, 2 = foi
 * almoçar, 3 = voltou, 4 = foi embora. Registros fora dos quatro tipos ("Outro",
 * lixo antigo) simplesmente não entram.
 */
export function etapaDoDia(registros: RegistroPonto[]): 0 | 1 | 2 | 3 | 4 {
  const tem = new Set(registros.map((r) => classificarTipoFixo(r.tipo)))
  if (tem.has("Saída")) return 4
  if (tem.has("Retorno Almoço")) return 3
  if (tem.has("Saída Almoço")) return 2
  if (tem.has("Entrada")) return 1
  return 0
}

/**
 * Analisa o contexto da batida comparando os registros existentes no dia
 * com a grade de horários do funcionário e a hora atual.
 *
 * O `proximoTipoSugerido` é só um destaque na tela de escolha ("Sugerido"): quem
 * decide o tipo é a pessoa. Mesmo assim ele precisa acertar o caso comum, e
 * "o dia ainda não tem nada" não é sempre "Entrada" — às 15h, quem aparece sem
 * nenhum ponto está voltando do almoço, não chegando.
 */
export function analisarSituacaoPonto(
  funcionario: Funcionario,
  registrosHoje: RegistroPonto[],
  agora = new Date()
): DiagnosticoPonto {
  const grade = obterGradeDoDia(funcionario.horarios, agora)
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes()
  const primeiroNome = funcionario.nome.split(" ")[0]

  const minutosSaidaAlmoco = horaParaMinutos(grade.saidaAlmoco)
  const minutosRetornoAlmoco = horaParaMinutos(grade.retornoAlmoco)
  const minutosSaida = horaParaMinutos(grade.saida)

  const etapa = etapaDoDia(registrosHoje)

  // === 1. JÁ FOI EMBORA (tem a Saída) ===
  if (etapa === 4) {
    return {
      tipo: "DIA_COMPLETO",
      proximoTipoSugerido: "Saída",
      mensagemPergunta: `Olá, ${primeiroNome}! Todos os registros do seu expediente de hoje já foram preenchidos com sucesso.`,
      horariosGrade: grade,
      registrosHoje,
    }
  }

  // === 2. NADA REGISTRADO HOJE ===
  if (etapa === 0) {
    // Pelo relógio: perto do fim do expediente, é a saída; depois do começo da
    // volta do almoço, é o retorno; antes disso, a chegada.
    const sugerido: DiagnosticoPonto["proximoTipoSugerido"] =
      minutosAgora >= minutosSaida - 90
        ? "Saída"
        : minutosAgora >= minutosRetornoAlmoco - 20
        ? "Retorno Almoço"
        : "Entrada"

    // Já passou de (saída almoço - 30 min), ex.: 11:30 em diante
    if (minutosAgora >= minutosSaidaAlmoco - 30) {
      return {
        tipo: "PERGUNTA_ENTRADA_OU_ALMOCO",
        proximoTipoSugerido: sugerido,
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

  // === 3. SÓ TEM A ENTRADA ===
  if (etapa === 1) {
    // Já é final da tarde / noite (ex: após retorno almoço + 2h30, ou >= 15:30)
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

    // Quem só tem a entrada e aparece na hora da volta do almoço provavelmente
    // esqueceu de bater a saída: está voltando.
    return {
      tipo: "DIRETO",
      proximoTipoSugerido: minutosAgora >= minutosRetornoAlmoco - 10 ? "Retorno Almoço" : "Saída Almoço",
      horariosGrade: grade,
      registrosHoje,
    }
  }

  // === 4. FOI ALMOÇAR (tem Entrada e Saída Almoço, falta o Retorno) ===
  if (etapa === 2) {
    // Já é final de tarde / saída (ex: passou de retorno_almoco + 2h)
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

  // === 5. JÁ VOLTOU DO ALMOÇO (falta só a Saída) ===
  return {
    tipo: "DIRETO",
    proximoTipoSugerido: "Saída",
    horariosGrade: grade,
    registrosHoje,
  }
}

/**
 * As batidas anteriores que FALTAM e que a escolha da pessoa pressupõe.
 *
 * O cálculo de horas pareia as batidas por posição (entra/sai alternados),
 * então uma batida que falta não é detalhe: ela inverte todos os pares
 * seguintes. Por isso o que a escolha pressupõe é perguntado SEMPRE, a qualquer
 * hora do dia:
 *
 *   - qualquer batida depois da Entrada pressupõe a Entrada;
 *   - Retorno do almoço pressupõe a Saída para o almoço;
 *   - Saída, com a Saída para o almoço já registrada, pressupõe o Retorno — a
 *     não ser que ainda seja cedo para a pessoa ter voltado (sair antes do
 *     horário de retorno é sair no meio do almoço, e aí o Retorno não falta).
 *
 * Um caso é só perguntado quando o diagnóstico do dia já desconfiava: Saída sem
 * NENHUMA batida de almoço. Quem trabalha meio período sai assim todo dia, e
 * perguntar do almoço dele sempre seria só chateação.
 */
export function pontosFaltantesAntesDe(
  tipo: TipoFixo,
  diag: DiagnosticoPonto,
  agora = new Date()
): TipoFixo[] {
  const tem = new Set(diag.registrosHoje.map((r) => classificarTipoFixo(r.tipo)))
  const faltam = (...ts: TipoFixo[]) => ts.filter((t) => !tem.has(t))
  const lacunaNoDia = diag.tipo.startsWith("PERGUNTA_")

  switch (tipo) {
    case "Entrada":
      return []
    case "Saída Almoço":
      return faltam("Entrada")
    case "Retorno Almoço":
      return faltam("Entrada", "Saída Almoço")
    case "Saída": {
      const f: TipoFixo[] = faltam("Entrada")
      const minutosAgora = agora.getHours() * 60 + agora.getMinutes()
      const jaDeviaTerVoltado = minutosAgora >= horaParaMinutos(diag.horariosGrade.retornoAlmoco)

      if (tem.has("Saída Almoço") && !tem.has("Retorno Almoço")) {
        if (jaDeviaTerVoltado || lacunaNoDia) f.push("Retorno Almoço")
      } else if (tem.has("Retorno Almoço") && !tem.has("Saída Almoço")) {
        f.push("Saída Almoço") // voltou sem ter saído: sempre inconsistente
      } else if (!tem.has("Saída Almoço") && !tem.has("Retorno Almoço") && lacunaNoDia) {
        f.push("Saída Almoço", "Retorno Almoço")
      }
      return f
    }
  }
}

// ---------------------------------------------------------------------------
// Horários informados para batidas esquecidas
// ---------------------------------------------------------------------------

const minutosDoRegistro = (r: RegistroPonto): number => {
  const d = new Date(r.data_hora)
  return d.getHours() * 60 + d.getMinutes()
}

/** Minutos do dia de cada tipo já registrado hoje (o primeiro de cada tipo). */
function minutosJaRegistrados(registros: RegistroPonto[]): Partial<Record<TipoFixo, number>> {
  const m: Partial<Record<TipoFixo, number>> = {}
  for (const r of [...registros].sort((a, b) => a.data_hora.localeCompare(b.data_hora))) {
    const t = classificarTipoFixo(r.tipo)
    if (t && m[t] === undefined) m[t] = minutosDoRegistro(r)
  }
  return m
}

/**
 * Os horários que o diálogo oferece de partida para as batidas esquecidas: os
 * da grade, mas sempre dentro do que é possível — depois do que já aconteceu
 * antes, antes do que já aconteceu depois, e antes de AGORA. Sem isso, quem
 * aparece às 11:50 com a grade de almoço às 12:00 receberia uma batida no futuro.
 */
export function padroesRetroativos(
  faltantes: TipoFixo[],
  diag: DiagnosticoPonto,
  agora = new Date()
): Partial<Record<TipoFixo, string>> {
  const existentes = minutosJaRegistrados(diag.registrosHoje)
  const g = diag.horariosGrade
  const grade: Record<TipoFixo, number> = {
    Entrada: horaParaMinutos(g.entrada),
    "Saída Almoço": horaParaMinutos(g.saidaAlmoco),
    "Retorno Almoço": horaParaMinutos(g.retornoAlmoco),
    Saída: horaParaMinutos(g.saida),
  }
  const teto = agora.getHours() * 60 + agora.getMinutes() - 1
  const escolhidos: Partial<Record<TipoFixo, number>> = {}
  const saida: Partial<Record<TipoFixo, string>> = {}

  ORDEM_DO_DIA.forEach((tipo, i) => {
    if (!faltantes.includes(tipo)) return
    const antes = ORDEM_DO_DIA.slice(0, i).map((t) => escolhidos[t] ?? existentes[t]).filter((v): v is number => v !== undefined)
    const depois = ORDEM_DO_DIA.slice(i + 1).map((t) => existentes[t]).filter((v): v is number => v !== undefined)
    const piso = antes.length ? Math.max(...antes) + 1 : 0
    const limite = Math.min(teto, depois.length ? Math.min(...depois) - 1 : teto)
    const valor = Math.max(piso, Math.min(grade[tipo], limite))
    escolhidos[tipo] = Math.min(valor, limite)
    saida[tipo] = minutosParaHoraStr(escolhidos[tipo]!)
  })
  return saida
}

const ROTULO: Record<TipoFixo, string> = {
  Entrada: "a entrada",
  "Saída Almoço": "a saída para o almoço",
  "Retorno Almoço": "o retorno do almoço",
  Saída: "a saída",
}

/**
 * Confere os horários que a pessoa informou. Devolve a mensagem do problema, ou
 * `null` se está tudo em ordem: cada batida depois da anterior, e todas antes
 * de agora. Sem isso um erro de digitação gravava um dia impossível (almoço
 * antes da entrada, retorno às 23h) e o cálculo de horas só mostrava o estrago
 * semanas depois.
 */
export function validarRetroativos(
  campos: { tipo: TipoFixo; hora: string }[],
  registros: RegistroPonto[],
  agora = new Date()
): string | null {
  const existentes = minutosJaRegistrados(registros)
  const digitados: Partial<Record<TipoFixo, number>> = {}
  for (const c of campos) {
    if (!/^\d{2}:\d{2}$/.test(c.hora)) return `Informe o horário d${ROTULO[c.tipo]}.`
    digitados[c.tipo] = horaParaMinutos(c.hora)
  }
  const nowMin = agora.getHours() * 60 + agora.getMinutes()
  const todos: Partial<Record<TipoFixo, number>> = { ...existentes, ...digitados }

  for (const c of campos) {
    if (digitados[c.tipo]! >= nowMin) return `O horário d${ROTULO[c.tipo]} precisa ser antes de agora.`
  }
  const sequencia = ORDEM_DO_DIA.filter((t) => todos[t] !== undefined)
  for (let i = 1; i < sequencia.length; i++) {
    const a = sequencia[i - 1]
    const b = sequencia[i]
    if (todos[b]! <= todos[a]!) {
      const emJogo = campos.some((c) => c.tipo === a || c.tipo === b)
      if (emJogo) return `${ROTULO[b][0].toUpperCase()}${ROTULO[b].slice(1)} precisa ser depois d${ROTULO[a]} (${minutosParaHoraStr(todos[a]!)}).`
    }
  }
  return null
}
