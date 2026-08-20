import { createClient } from "@supabase/supabase-js"
import type { Funcionario, RegistroPonto, HorariosSemana, AjusteSaldo } from "./types"

// Inicializar o cliente Supabase com tratamento de erros aprimorado
let supabase: ReturnType<typeof createClient> | null = null

try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

  // Verificar se as credenciais estão presentes
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Credenciais do Supabase não encontradas. Usando modo de simulação.")
  } else {
    // Inicializar o cliente apenas se as credenciais estiverem disponíveis
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // Não persistir a sessão para evitar problemas de cache
      },
    })
    // Cliente Supabase inicializado
  }
} catch (error) {
  console.error("Erro ao inicializar cliente Supabase:", error)
  supabase = null
}

// Função para verificar se o cliente Supabase está disponível
function isSupabaseAvailable(): boolean {
  return !!supabase
}

// Buscar funcionários com tratamento de erros aprimorado
export async function buscarFuncionarios(): Promise<Funcionario[]> {
  try {
    type FuncionarioRow = {
      id: string
      nome: string
      descritores: number[][] | null
      descritores_sorriso?: number[][] | null
      aws_face_ids?: string[] | null
      carga_horaria_diaria_minutos?: number | null
      horarios?: HorariosSemana | null
    }

    // Verificar se o cliente Supabase está disponível
    if (!isSupabaseAvailable()) {
      console.error("Cliente Supabase não disponível. Verifique variáveis NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.")
      return []
    }

    const { data, error } = await supabase!
      .from("funcionarios")
      .select("*")
      .returns<FuncionarioRow[]>()
    if (error) {
      console.error("Erro ao buscar funcionários:", error)
      return []
    }

    const safeData: FuncionarioRow[] = Array.isArray(data) ? data : []
    const funcionarios: Funcionario[] = safeData.map((row) => ({
      id: row.id,
      nome: row.nome,
      descritores: Array.isArray(row.descritores) ? (row.descritores as number[][]) : [],
      descritores_sorriso: Array.isArray(row.descritores_sorriso) ? (row.descritores_sorriso as number[][]) : undefined,
      aws_face_ids: row.aws_face_ids ?? undefined,
      carga_horaria_diaria_minutos: row.carga_horaria_diaria_minutos ?? undefined,
      horarios: row.horarios ?? undefined,
    }))
    return funcionarios
  } catch (error) {
    console.error("Exceção ao buscar funcionários:", error)
    return []
  }
}

// Função para gerar dados simulados para desenvolvimento
function simulateFuncionarios(): Funcionario[] {
  console.log("Gerando dados simulados de funcionários para desenvolvimento")
  return [
    {
      id: "simulado-1",
      nome: "João Silva (Simulado)",
      descritores: [],
      carga_horaria_diaria_minutos: 480,
      horarios: {
        segunda: {
          entrada: "08:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "17:00",
          ativo: true,
        },
        terca: {
          entrada: "08:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "17:00",
          ativo: true,
        },
        quarta: {
          entrada: "08:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "17:00",
          ativo: true,
        },
        quinta: {
          entrada: "08:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "17:00",
          ativo: true,
        },
        sexta: {
          entrada: "08:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "17:00",
          ativo: true,
        },
        sabado: {
          entrada: "08:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "17:00",
          ativo: false,
        },
        domingo: {
          entrada: "08:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "17:00",
          ativo: false,
        },
      },
    },
    {
      id: "simulado-2",
      nome: "Maria Oliveira (Simulado)",
      descritores: [],
      carga_horaria_diaria_minutos: 540,
      horarios: {
        segunda: {
          entrada: "09:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "18:00",
          ativo: true,
        },
        terca: {
          entrada: "09:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "18:00",
          ativo: true,
        },
        quarta: {
          entrada: "09:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "18:00",
          ativo: true,
        },
        quinta: {
          entrada: "09:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "18:00",
          ativo: true,
        },
        sexta: {
          entrada: "09:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "18:00",
          ativo: true,
        },
        sabado: {
          entrada: "09:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "18:00",
          ativo: false,
        },
        domingo: {
          entrada: "09:00",
          saida_almoco: "12:00",
          retorno_almoco: "13:00",
          saida: "18:00",
          ativo: false,
        },
      },
    },
  ]
}

// Buscar funcionário por ID com tratamento de erros aprimorado
export async function buscarFuncionarioPorId(id: string): Promise<Funcionario> {
  try {
    // Buscar funcionário por ID

    // Verificar se o cliente Supabase está disponível
    if (!isSupabaseAvailable()) {
      console.error("Cliente Supabase não disponível.")
      throw new Error("Supabase indisponível")
    }

    type FuncionarioRow = {
      id: string
      nome: string
      descritores: number[][] | null
      descritores_sorriso?: number[][] | null
      aws_face_ids?: string[] | null
      carga_horaria_diaria_minutos?: number | null
      horarios?: HorariosSemana | null
      saldo_acumulado_minutos?: number | null
      saldo_data_referencia?: string | null
    }

    // Evitar .single() para não lançar quando 0 linhas
    const { data, error } = await supabase!
      .from("funcionarios")
      .select("*")
      .eq("id", id)
      .limit(1)
      .returns<FuncionarioRow[]>()
    if (error) {
      console.error("Erro ao buscar funcionário:", error)
      throw error
    }
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null
    if (!row) {
      throw new Error("Funcionário não encontrado")
    }
    // Funcionário encontrado

    return {
      id: row.id,
      nome: row.nome,
      descritores: Array.isArray(row.descritores) ? (row.descritores as number[][]) : [],
      descritores_sorriso: Array.isArray(row.descritores_sorriso) ? (row.descritores_sorriso as number[][]) : undefined,
      aws_face_ids: row.aws_face_ids ?? undefined,
      carga_horaria_diaria_minutos: row.carga_horaria_diaria_minutos ?? undefined,
      horarios: row.horarios ?? undefined,
      saldo_acumulado_minutos: row.saldo_acumulado_minutos ?? undefined,
      saldo_data_referencia: row.saldo_data_referencia ?? undefined,
    }
  } catch (error) {
    console.error("Erro ao buscar funcionário por ID:", error)
    throw error
  }
}

// (função de simulação removida - não utilizada)

// Atualizar carga horária do funcionário
export async function atualizarCargaHoraria(id: string, cargaHoraria: number): Promise<void> {
  try {
    // Verificar se o cliente Supabase está disponível
    if (!isSupabaseAvailable()) {
      console.warn("Cliente Supabase não disponível. Operação simulada.")
      return
    }

    const { error } = await supabase!
      .from("funcionarios")
      .update({ carga_horaria_diaria_minutos: cargaHoraria })
      .eq("id", id)

    if (error) {
      console.error("Erro ao atualizar carga horária:", error)
      throw error
    }
  } catch (error) {
    console.error("Erro ao atualizar carga horária (coluna pode não existir):", error)
    // Não propagar o erro para permitir que a aplicação continue funcionando
  }
}

// Cadastrar um novo funcionário
export async function cadastrarFuncionario(
  nome: string,
  descritores: number[][],
  horarios?: HorariosSemana,
  cargaHorariaDiaria = 480, // 8 horas por padrão
  descritoresSorriso?: number[][],
  azurePersonId?: string,
): Promise<void> {
  try {
    // Cadastrar funcionário

    // Verificar se o cliente Supabase está disponível
    if (!isSupabaseAvailable()) {
      console.error("Cliente Supabase não disponível.")
      throw new Error("Supabase indisponível")
    }

    // Criar objeto com os dados do funcionário
    const funcionarioData: {
      nome: string
      descritores: number[][]
      aws_face_ids?: string[]
      carga_horaria_diaria_minutos: number
      horarios: HorariosSemana | null
    } = {
      nome,
      descritores,
      aws_face_ids: azurePersonId ? [azurePersonId] : undefined, // Converter para compatibilidade temporária
      carga_horaria_diaria_minutos: cargaHorariaDiaria,
      horarios: horarios || null,
    }

    // Inserir dados no Supabase

    // Inserir funcionário com os campos disponíveis
    const { error } = await supabase!.from("funcionarios").insert([funcionarioData])

    if (error) {
      console.error("Erro ao cadastrar funcionário:", error)
      throw error
    }

    // Funcionário cadastrado com sucesso
  } catch (error) {
    console.error("Erro ao cadastrar funcionário:", error)
    throw error as Error
  }
}

// Atualizar descritores de um funcionário existente
export async function atualizarDescritoresFuncionario(id: string, descritores: number[][], descritoresSorriso?: number[][]): Promise<void> {
  try {
    if (!isSupabaseAvailable()) {
      throw new Error("Supabase indisponível")
    }
    const updateData: { descritores: number[][], descritores_sorriso?: number[][] } = { descritores }
    if (descritoresSorriso) {
      updateData.descritores_sorriso = descritoresSorriso
    }
    const { error } = await supabase!
      .from("funcionarios")
      .update(updateData)
      .eq("id", id)
    if (error) {
      console.error("Erro ao atualizar descritores:", error)
      throw error
    }
  } catch (error) {
    console.error("Exceção ao atualizar descritores:", error)
    throw error as Error
  }
}

// Excluir funcionário e seus registros relacionados
export async function deletarFuncionario(id: string): Promise<void> {
  try {
    if (!isSupabaseAvailable()) {
      throw new Error("Supabase indisponível")
    }
    // Excluir registros de ponto primeiro para evitar restrições de FK
    const delReg = await supabase!.from("registros_ponto").delete().eq("funcionario_id", id)
    if (delReg.error) {
      throw delReg.error
    }
    // Excluir funcionário
    const delFunc = await supabase!.from("funcionarios").delete().eq("id", id)
    if (delFunc.error) {
      throw delFunc.error
    }
  } catch (error) {
    console.error("Erro ao deletar funcionário:", error)
    throw error as Error
  }
}

// Buscar o último registro de ponto de um funcionário
export async function buscarUltimoRegistroPonto(funcionarioId: string): Promise<RegistroPonto | null> {
  try {
    // Verificar se o cliente Supabase está disponível
    if (!isSupabaseAvailable()) {
      console.error("Cliente Supabase não disponível.")
      return null
    }

    const res = (await supabase!
      .from("registros_ponto")
      .select("*")
      .eq("funcionario_id", funcionarioId)
      .order("data_hora", { ascending: false })
      .limit(1)) as { data: unknown[] | null; error: { message?: string } | null }
    const { data, error } = res

    if (error) {
      console.error("Erro ao buscar último registro de ponto:", error)
      return null
    }

    return data && data.length > 0 ? (data[0] as RegistroPonto) : null
  } catch (error) {
    console.error("Erro ao buscar último registro de ponto:", error)
    return null
  }
}

// Verificar se o funcionário está em cooldown (60 segundos desde último registro)
export async function verificarCooldown(funcionarioId: string): Promise<{ emCooldown: boolean; segundosRestantes: number; ultimoTipo: string | null }> {
  try {
    const ultimoRegistro = await buscarUltimoRegistroPonto(funcionarioId)

    if (!ultimoRegistro) {
      return { emCooldown: false, segundosRestantes: 0, ultimoTipo: null }
    }

    const agora = Date.now()
    const tsUltimo = new Date(ultimoRegistro.data_hora).getTime()
    const diferencaMs = Math.abs(agora - tsUltimo)
    const COOLDOWN_MS = 60 * 1000 // 60 segundos

    if (diferencaMs < COOLDOWN_MS) {
      const segundosRestantes = Math.ceil((COOLDOWN_MS - diferencaMs) / 1000)
      return {
        emCooldown: true,
        segundosRestantes,
        ultimoTipo: ultimoRegistro.tipo || null
      }
    }

    return { emCooldown: false, segundosRestantes: 0, ultimoTipo: ultimoRegistro.tipo || null }
  } catch (error) {
    console.error("Erro ao verificar cooldown:", error)
    return { emCooldown: false, segundosRestantes: 0, ultimoTipo: null }
  }
}

// Função para simular último registro de ponto (não utilizada)
/* istanbul ignore next */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function simularUltimoRegistroPonto(_funcionarioId: string): RegistroPonto | null {
  console.log("Simulando último registro de ponto para funcionário ID:", _funcionarioId)

  // Gerar um registro simulado com data recente
  const agora = new Date()
  agora.setHours(agora.getHours() - 1) // 1 hora atrás

  const funcionarios = simulateFuncionarios()
  const funcionario = funcionarios[0]
  if (!funcionario) return null

  return {
    id: `simulado-ultimo-${funcionario.id}`,
    funcionario_id: funcionario.id,
    nome_funcionario: funcionario.nome,
    data_hora: agora.toISOString(),
    tipo: "Entrada", // Simular que o último registro foi uma entrada
    created_at: agora.toISOString(),
  }
}

// Determinar próximo tipo de registro (pré-fetch, sem inserir)
export async function determinarProximoTipo(funcionarioId: string): Promise<string> {
  if (!isSupabaseAvailable()) return "Entrada"

  const hoje = new Date()
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0).toISOString()
  const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString()

  const { data } = await supabase!
    .from("registros_ponto")
    .select("id")
    .eq("funcionario_id", funcionarioId)
    .gte("data_hora", inicioDia)
    .lte("data_hora", fimDia)

  const count = data?.length || 0
  switch (count) {
    case 0: return "Entrada"
    case 1: return "Saída Almoço"
    case 2: return "Retorno Almoço"
    case 3: return "Saída"
    default: return "Limite atingido"
  }
}

// Registrar ponto de um funcionário
export async function registrarPonto(
  funcionarioId: string,
  nomeFuncionario: string,
  tipoForçado?: string,
): Promise<{ tipo: string }> {
  try {
    // Registrar ponto

    // Verificar se o cliente Supabase está disponível
    if (!isSupabaseAvailable()) {
      console.error("Cliente Supabase não disponível.")
      throw new Error("Supabase indisponível")
    }

    // Buscar o último registro do funcionário
    const ultimoRegistro = await buscarUltimoRegistroPonto(funcionarioId)

    // Guard server-side: BLOQUEAR duplicidade dentro de 60s (1 minuto)
    if (ultimoRegistro) {
      const agora = Date.now()
      const tsUltimo = new Date(ultimoRegistro.data_hora).getTime()
      if (Math.abs(agora - tsUltimo) < 60 * 1000) {
        console.warn("⚠️ BLOQUEADO: Tentativa de registrar em menos de 1 minuto. Ignorando inserção.")
        // Retornar o tipo do último registro para não causar erro na UI
        return { tipo: ultimoRegistro.tipo || "Entrada" }
      }
    }

    // Determinar o tipo de registro baseado na sequência do DIA
    let tipo = tipoForçado

    if (!tipo) {
      // Buscar TODOS os registros do dia atual
      const hoje = new Date()
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0).toISOString()
      const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString()

      const { data: registrosHoje } = await supabase!
        .from("registros_ponto")
        .select("*")
        .eq("funcionario_id", funcionarioId)
        .gte("data_hora", inicioDia)
        .lte("data_hora", fimDia)
        .order("data_hora", { ascending: true })

      const quantidadeHoje = (registrosHoje as unknown as RegistroPonto[])?.length || 0

      // Sequência FIXA: 1º = Entrada, 2º = Saída Almoço, 3º = Retorno Almoço, 4º = Saída
      switch (quantidadeHoje) {
        case 0:
          tipo = "Entrada"
          break
        case 1:
          tipo = "Saída Almoço"
          break
        case 2:
          tipo = "Retorno Almoço"
          break
        case 3:
          tipo = "Saída"
          break
        default:
          // Se já tem 4 ou mais registros no dia, não permitir mais
          console.warn("⚠️ BLOQUEADO: Limite de 4 registros por dia atingido.")
          throw new Error("Limite de registros por dia atingido (4 registros)")
      }
    }

    // Tipo de registro determinado
    const dataHora = new Date().toISOString()

    const { error } = await supabase!
      .from("registros_ponto")
      .insert([
        {
          funcionario_id: funcionarioId,
          nome_funcionario: nomeFuncionario,
          data_hora: dataHora,
          tipo: tipo,
        },
      ])

    if (error) {
      console.error("Erro ao registrar ponto:", error)
      throw error
    }

    console.log(`✅ Ponto registrado: ${tipo}`)
    return { tipo: tipo || "Entrada" }
  } catch (error) {
    console.error("Exceção ao registrar ponto:", error)
    throw error as Error
  }
}

// Função para simular registro de ponto (não utilizada)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function simularRegistroPonto(
  _funcionarioId: string,
  nomeFuncionario: string,
  tipoForçado?: string,
): Promise<{ tipo: string }> {
  console.log("Simulando registro de ponto para:", nomeFuncionario)

  // Determinar o tipo se não for fornecido
  const tipo = tipoForçado || "Entrada"

  // Simular um pequeno atraso para parecer mais realista
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ tipo })
    }, 500)
  })
}

// Buscar registros de ponto
export async function buscarRegistrosPonto(): Promise<RegistroPonto[]> {
  try {
    // Verificar se o cliente Supabase está disponível
    if (!isSupabaseAvailable()) {
      console.error("Cliente Supabase não disponível.")
      return []
    }

    const { data, error } = await supabase!
      .from("registros_ponto")
      .select("*")
      .order("data_hora", { ascending: false })

    if (error) {
      console.error("Erro ao buscar registros de ponto:", error)
      return []
    }

    return (data as unknown as RegistroPonto[]) || []
  } catch (error) {
    console.error("Erro ao buscar registros de ponto:", error)
    return []
  }
}

// Função para simular registros de ponto
/* istanbul ignore next */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function simularRegistrosPonto(): RegistroPonto[] {
  console.log("Gerando dados simulados de registros de ponto")

  const funcionarios = simulateFuncionarios()
  const registros: RegistroPonto[] = []

  // Gerar registros para os últimos 5 dias
  for (let i = 0; i < 5; i++) {
    const data = new Date()
    data.setDate(data.getDate() - i)

    for (const funcionario of funcionarios) {
      // Entrada
      const entrada = new Date(data)
      entrada.setHours(8, 0, 0)
      registros.push({
        id: `simulado-${funcionario.id}-entrada-${i}`,
        funcionario_id: funcionario.id,
        nome_funcionario: funcionario.nome,
        data_hora: entrada.toISOString(),
        tipo: "Entrada",
        created_at: entrada.toISOString(),
      })

      // Saída para almoço
      const saidaAlmoco = new Date(data)
      saidaAlmoco.setHours(12, 0, 0)
      registros.push({
        id: `simulado-${funcionario.id}-saida-almoco-${i}`,
        funcionario_id: funcionario.id,
        nome_funcionario: funcionario.nome,
        data_hora: saidaAlmoco.toISOString(),
        tipo: "Saída Almoço",
        created_at: saidaAlmoco.toISOString(),
      })

      // Retorno do almoço
      const retornoAlmoco = new Date(data)
      retornoAlmoco.setHours(13, 0, 0)
      registros.push({
        id: `simulado-${funcionario.id}-retorno-almoco-${i}`,
        funcionario_id: funcionario.id,
        nome_funcionario: funcionario.nome,
        data_hora: retornoAlmoco.toISOString(),
        tipo: "Retorno Almoço",
        created_at: retornoAlmoco.toISOString(),
      })

      // Saída
      const saida = new Date(data)
      saida.setHours(17, 0, 0)
      registros.push({
        id: `simulado-${funcionario.id}-saida-${i}`,
        funcionario_id: funcionario.id,
        nome_funcionario: funcionario.nome,
        data_hora: saida.toISOString(),
        tipo: "Saída",
        created_at: saida.toISOString(),
      })
    }
  }

  return registros
}

// Buscar registros de ponto por funcionário
export async function buscarRegistrosPorFuncionario(funcionarioId: string): Promise<RegistroPonto[]> {
  try {
    // Verificar se o cliente Supabase está disponível
    if (!isSupabaseAvailable()) {
      console.error("Cliente Supabase não disponível.")
      return []
    }

    const { data, error } = (await supabase!
      .from("registros_ponto")
      .select("*")
      .eq("funcionario_id", funcionarioId)
      .order("data_hora", { ascending: true })) as { data: RegistroPonto[] | null; error: { message?: string } | null }
    // tipar error como desconhecido

    if (error) {
      console.error("Erro ao buscar registros de ponto por funcionário:", error)
      return []
    }

    return (data as RegistroPonto[]) || []
  } catch (error) {
    console.error("Erro ao buscar registros de ponto por funcionário:", error)
    return []
  }
}

// Função para simular registros por funcionário
// função de simulação não utilizada

// Buscar registros de ponto por período
export async function buscarRegistrosPorPeriodo(
  dataInicio: string,
  dataFim: string,
  funcionarioId?: string,
): Promise<RegistroPonto[]> {
  try {
    console.log(`Buscando registros de ${dataInicio} até ${dataFim} para funcionário ID: ${funcionarioId || "todos"}`)

    // Verificar se o cliente Supabase está disponível
    if (!isSupabaseAvailable()) {
      console.error("Cliente Supabase não disponível.")
      return []
    }

    let query = supabase!
      .from("registros_ponto")
      .select("*")
      .gte("data_hora", dataInicio)
      .lte("data_hora", dataFim)
      .order("data_hora", { ascending: true })

    if (funcionarioId && funcionarioId !== "todos") {
      query = query.eq("funcionario_id", funcionarioId)
      console.log(`Filtro aplicado para funcionário ID: ${funcionarioId}`)
    }

    const { data, error } = (await query) as { data: RegistroPonto[] | null; error: { message?: string } | null }

    if (error) {
      console.error("Erro ao buscar registros de ponto por período:", error)
      return []
    }

    console.log(`${data?.length || 0} registros encontrados`)
    return (data as RegistroPonto[]) || []
  } catch (error) {
    console.error("Exceção ao buscar registros de ponto por período:", error)
    return []
  }
}

// Função para simular registros por período
// função de simulação não utilizada
/* istanbul ignore next */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function simularRegistrosPorPeriodo(dataInicio: string, dataFim: string, funcionarioId?: string): RegistroPonto[] {
  console.log("Gerando dados simulados de registros para o período:", dataInicio, "a", dataFim)

  // Converter as datas para objetos Date
  const inicio = new Date(dataInicio)
  const fim = new Date(dataFim)

  // Gerar registros simulados para o período
  const registros: RegistroPonto[] = []
  const funcionarios = simulateFuncionarios()

  // Filtrar funcionário se ID for fornecido
  const funcionariosAlvo =
    funcionarioId && funcionarioId !== "todos" ? funcionarios.filter((f) => f.id === funcionarioId) : funcionarios

  // Para cada dia no período
  for (let dia = new Date(inicio); dia <= fim; dia.setDate(dia.getDate() + 1)) {
    // Pular finais de semana
    const diaSemana = dia.getDay()
    if (diaSemana === 0 || diaSemana === 6) continue

    // Para cada funcionário
    for (const funcionario of funcionariosAlvo) {
      // Verificar se o funcionário trabalha neste dia da semana
      const diaTrabalho = obterDiaSemana(diaSemana)
      if (!funcionario.horarios?.[diaTrabalho]?.ativo) continue

      const horarios = funcionario.horarios?.[diaTrabalho]
      if (!horarios) continue

      // Criar registros para este dia
      const dataBase = new Date(dia)

      // Entrada
      if (horarios.entrada) {
        const [hora, minuto] = horarios.entrada.split(":").map(Number)
        const dataEntrada = new Date(dataBase)
        dataEntrada.setHours(hora, minuto, 0)

        registros.push({
          id: `simulado-${funcionario.id}-entrada-${dataEntrada.toISOString()}`,
          funcionario_id: funcionario.id,
          nome_funcionario: funcionario.nome,
          data_hora: dataEntrada.toISOString(),
          tipo: "Entrada",
          created_at: dataEntrada.toISOString(),
        })
      }

      // Saída para almoço
      if (horarios.saida_almoco) {
        const [hora, minuto] = horarios.saida_almoco.split(":").map(Number)
        const dataSaidaAlmoco = new Date(dataBase)
        dataSaidaAlmoco.setHours(hora, minuto, 0)

        registros.push({
          id: `simulado-${funcionario.id}-saida-almoco-${dataSaidaAlmoco.toISOString()}`,
          funcionario_id: funcionario.id,
          nome_funcionario: funcionario.nome,
          data_hora: dataSaidaAlmoco.toISOString(),
          tipo: "Saída Almoço",
          created_at: dataSaidaAlmoco.toISOString(),
        })
      }

      // Retorno do almoço
      if (horarios.retorno_almoco) {
        const [hora, minuto] = horarios.retorno_almoco.split(":").map(Number)
        const dataRetornoAlmoco = new Date(dataBase)
        dataRetornoAlmoco.setHours(hora, minuto, 0)

        registros.push({
          id: `simulado-${funcionario.id}-retorno-almoco-${dataRetornoAlmoco.toISOString()}`,
          funcionario_id: funcionario.id,
          nome_funcionario: funcionario.nome,
          data_hora: dataRetornoAlmoco.toISOString(),
          tipo: "Retorno Almoço",
          created_at: dataRetornoAlmoco.toISOString(),
        })
      }

      // Saída
      if (horarios.saida) {
        const [hora, minuto] = horarios.saida.split(":").map(Number)
        const dataSaida = new Date(dataBase)
        dataSaida.setHours(hora, minuto, 0)

        registros.push({
          id: `simulado-${funcionario.id}-saida-${dataSaida.toISOString()}`,
          funcionario_id: funcionario.id,
          nome_funcionario: funcionario.nome,
          data_hora: dataSaida.toISOString(),
          tipo: "Saída",
          created_at: dataSaida.toISOString(),
        })
      }
    }
  }

  return registros
}

// Função auxiliar para obter o dia da semana como string
function obterDiaSemana(dia: number): keyof HorariosSemana {
  switch (dia) {
    case 0:
      return "domingo"
    case 1:
      return "segunda"
    case 2:
      return "terca"
    case 3:
      return "quarta"
    case 4:
      return "quinta"
    case 5:
      return "sexta"
    case 6:
      return "sabado"
    default:
      return "segunda"
  }
}

// Atualizar horários de um funcionário
export async function atualizarHorariosFuncionario(id: string, horarios: HorariosSemana): Promise<void> {
  try {
    if (!isSupabaseAvailable()) {
      console.warn("Cliente Supabase não disponível. Operação simulada.")
      return
    }

    const { error } = await supabase!
      .from("funcionarios")
      .update({ horarios: horarios })
      .eq("id", id)

    if (error) {
      console.error("Erro ao atualizar horários:", error)
      throw error
    }

    console.log("Horários atualizados com sucesso para funcionário:", id)
  } catch (error) {
    console.error("Erro ao atualizar horários:", error)
    throw error as Error
  }
}

// Atualizar registro de ponto existente
export async function atualizarRegistroPonto(id: string, data_hora: string, tipo: string): Promise<void> {
  try {
    if (!isSupabaseAvailable()) {
      console.warn("Cliente Supabase não disponível. Operação simulada.")
      return
    }

    const { error } = await supabase!
      .from("registros_ponto")
      .update({ data_hora, tipo })
      .eq("id", id)

    if (error) {
      console.error("Erro ao atualizar registro de ponto:", error)
      throw error
    }

    console.log("Registro de ponto atualizado com sucesso:", id)
  } catch (error) {
    console.error("Erro ao atualizar registro de ponto:", error)
    throw error as Error
  }
}

// Deletar registro de ponto
export async function deletarRegistroPonto(id: string): Promise<void> {
  try {
    if (!isSupabaseAvailable()) {
      console.warn("Cliente Supabase não disponível. Operação simulada.")
      return
    }

    const { error } = await supabase!
      .from("registros_ponto")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Erro ao deletar registro de ponto:", error)
      throw error
    }

    console.log("Registro de ponto deletado com sucesso:", id)
  } catch (error) {
    console.error("Erro ao deletar registro de ponto:", error)
    throw error as Error
  }
}

// Criar novo registro de ponto (sem verificação de duplicatas para edição manual)
export async function criarRegistroPonto(funcionarioId: string, nomeFuncionario: string, dataHora: string, tipo: string): Promise<string> {
  try {
    if (!isSupabaseAvailable()) {
      console.warn("Cliente Supabase não disponível. Operação simulada.")
      return "simulado"
    }

    const { data, error } = await supabase!
      .from("registros_ponto")
      .insert([{
        funcionario_id: funcionarioId,
        nome_funcionario: nomeFuncionario,
        data_hora: dataHora,
        tipo: tipo
      }])
      .select()

    if (error) {
      console.error("Erro ao criar registro de ponto:", error)
      throw error
    }

    const novoId = Array.isArray(data) && data.length > 0 ? String(data[0].id) : "criado"
    console.log("Registro de ponto criado com sucesso:", novoId)
    return novoId
  } catch (error) {
    console.error("Erro ao criar registro de ponto:", error)
    throw error as Error
  }
}

// FUNÇÕES PARA AJUSTES DE SALDO

// Verificar se a tabela ajustes_saldo existe
export async function verificarTabelaAjustesSaldo(): Promise<boolean> {
  try {
    if (!isSupabaseAvailable()) {
      return false
    }

    // Tentar fazer uma consulta simples para verificar se a tabela existe
    const { error } = await supabase!
      .from("ajustes_saldo")
      .select("id")
      .limit(1)

    if (error && (error.code === '42P01' || error.message?.includes('relation'))) {
      return false // Tabela não existe
    }

    return true // Tabela existe
  } catch {
    return false
  }
}

// Salvar ajuste de saldo
export async function salvarAjusteSaldo(ajuste: Omit<AjusteSaldo, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
  try {
    if (!isSupabaseAvailable()) {
      console.warn("Cliente Supabase não disponível. Operação simulada.")
      return "simulado"
    }

    const { data, error } = await supabase!
      .from("ajustes_saldo")
      .insert([ajuste])
      .select()

    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('ajustes_saldo')) {
        // Tabela não existe
        console.warn("Tabela ajustes_saldo não existe. Execute o script SQL para criá-la.")
        return "tabela_inexistente"
      }
      console.error("Erro ao salvar ajuste de saldo:", error)
      throw error
    }

    const novoId = Array.isArray(data) && data.length > 0 ? String(data[0].id) : "criado"
    console.log("Ajuste de saldo salvo com sucesso:", novoId)
    return novoId
  } catch (error) {
    console.error("Erro ao salvar ajuste de saldo:", error)
    throw error as Error
  }
}

// Buscar ajuste de saldo por funcionário e data
export async function buscarAjusteSaldo(funcionarioId: string, data: string): Promise<AjusteSaldo | null> {
  try {
    if (!isSupabaseAvailable()) {
      console.warn("Cliente Supabase não disponível.")
      return null
    }

    const { data: ajuste, error } = await supabase!
      .from("ajustes_saldo")
      .select("*")
      .eq("funcionario_id", funcionarioId)
      .eq("data", data)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No data found - isso é esperado quando não há ajustes
        return null
      }
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('ajustes_saldo')) {
        // Tabela não existe - silenciosamente retornar null
        console.warn("Tabela ajustes_saldo não existe. Execute o script SQL para criá-la.")
        return null
      }
      console.error("Erro ao buscar ajuste de saldo:", error)
      return null
    }

    return ajuste as unknown as AjusteSaldo
  } catch (error) {
    console.error("Erro ao buscar ajuste de saldo:", error)
    return null
  }
}

// Atualizar ajuste de saldo existente
export async function atualizarAjusteSaldo(
  funcionarioId: string, 
  data: string, 
  ajuste: Pick<AjusteSaldo, 'saldo_dia_ajustado' | 'saldo_total_ajustado' | 'motivo'>
): Promise<boolean> {
  try {
    if (!isSupabaseAvailable()) {
      console.warn("Cliente Supabase não disponível. Operação simulada.")
      return true
    }

    const { error } = await supabase!
      .from("ajustes_saldo")
      .update({
        ...ajuste,
        updated_at: new Date().toISOString()
      })
      .eq("funcionario_id", funcionarioId)
      .eq("data", data)

    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('ajustes_saldo')) {
        // Tabela não existe
        console.warn("Tabela ajustes_saldo não existe. Execute o script SQL para criá-la.")
        return false
      }
      console.error("Erro ao atualizar ajuste de saldo:", error)
      return false
    }

    console.log("Ajuste de saldo atualizado com sucesso")
    return true
  } catch (error) {
    console.error("Erro ao atualizar ajuste de saldo:", error)
    return false
  }
}
