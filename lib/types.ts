export interface Funcionario {
  id: string
  nome: string
  // Embeddings faciais persistidos no Supabase (cada embedding é um vetor numérico)
  descritores: number[][]
  // Embeddings específicos para sorriso (usados para detecção de sorriso personalizada)
  descritores_sorriso?: number[][]
  // ID da pessoa no AWS Rekognition (Collection)
  aws_face_ids?: string[]
  carga_horaria_diaria_minutos?: number
  created_at?: string
  horarios?: HorariosSemana
  saldo_acumulado_minutos?: number
  saldo_data_referencia?: string | null
}

export interface HorariosSemana {
  segunda?: HorarioDia
  terca?: HorarioDia
  quarta?: HorarioDia
  quinta?: HorarioDia
  sexta?: HorarioDia
  sabado?: HorarioDia
  domingo?: HorarioDia
}

export interface HorarioDia {
  entrada: string
  saida_almoco: string
  retorno_almoco: string
  saida: string
  ativo: boolean
}

export interface PeriodoTrabalho {
  id: string
  entrada: string
  saida: string
}

export interface HorarioDiaExtendido {
  ativo: boolean
  periodos: PeriodoTrabalho[]
}

export interface RegistroPonto {
  id: string
  funcionario_id: string
  nome_funcionario: string
  data_hora: string
  tipo?: string
  created_at: string
}

export interface ParPontos {
  entrada: string
  saida: string | null
  minutos: number
}

export interface ResumoHoras {
  data: string
  entrada?: string
  saida?: string
  saidaAlmoco?: string
  retornoAlmoco?: string
  horasTrabalhadas: number
  horasExtras: number
  horasEsperadas: number
  saldoDia: number
  inconsistencias?: string[]
  ehDiaUtil: boolean
  tipoAusencia?: "ferias" | "atestado" | "falta"
  paresPontos?: ParPontos[] // Novo campo para armazenar todos os pares de entrada/saída
}

export interface RelatorioPonto {
  funcionario: string
  funcionarioId: string
  periodo: string
  registros: ResumoHoras[]
  totalHorasTrabalhadas: number
  totalHorasExtras: number
  totalHorasEsperadas: number
  saldoMes: number
  diasTrabalhados: number
  diasUteis: number
  diasFaltas: number
  alertas: string[]
}

export interface AjusteSaldo {
  id: string
  funcionario_id: string
  data: string
  saldo_dia_original: number
  saldo_dia_ajustado: number
  saldo_total_original: number
  saldo_total_ajustado: number
  motivo?: string
  created_at: string
  updated_at: string
}
