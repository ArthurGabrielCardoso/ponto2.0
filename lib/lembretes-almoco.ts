import type { Funcionario } from "./types"
import { obterGradeDoDia, horaParaMinutos } from "./logica-ponto-inteligente"
import { reproduzirVozSaudacao } from "./tts-audio"

interface SessaoAlmocoAtiva {
  funcionarioId: string
  nome: string
  primeiroNome: string
  dataHoraSaida: Date
  duracaoMinutos: number
  retornoPrevisto: Date
  timer10MinDepois?: NodeJS.Timeout | number
  timer10MinAntes?: NodeJS.Timeout | number
}

// Mapa de sessões ativas de almoço indexadas pelo ID do funcionário
const sessoesAtivas = new Map<string, SessaoAlmocoAtiva>()

// Variações carismáticas e meigas de encerramento com emojis falados
const EMOJIS_FALADOS = [
  "Emoji de coração azul e rostinho meigo!",
  "Emoji de coração azul e carinha sorridente!",
  "Emoji de rostinho carismático e coração azul!",
  "Emoji de piscadinha e coração azul!",
  "Emoji de carinha feliz e beijinho carinhoso!",
  "Coração azul e um abraço carinhoso!",
]

function sortearEmoji(): string {
  const idx = Math.floor(Math.random() * EMOJIS_FALADOS.length)
  return EMOJIS_FALADOS[idx]
}

// Formata hora em texto natural falado (ex: "13h02", "14h15")
export function formatarHoraTexto(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  return `${h}h${m}`
}

// Formata duração em texto natural (ex: "1 hora e 5 minutos", "50 minutos")
export function formatarDuracaoTexto(minutosTotais: number): string {
  const m = Math.max(0, Math.round(minutosTotais))
  const horas = Math.floor(m / 60)
  const minutos = m % 60

  if (horas > 0 && minutos > 0) {
    return `${horas} ${horas === 1 ? "hora" : "horas"} e ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`
  }
  if (horas > 0) {
    return `${horas} ${horas === 1 ? "hora" : "horas"}`
  }
  return `${minutos} ${minutos === 1 ? "minuto" : "minutos"}`
}

/**
 * Calcula a duração de almoço esperada em minutos para o funcionário hoje
 */
export function obterDuracaoAlmocoMinutos(funcionario: Funcionario, data = new Date()): number {
  const grade = obterGradeDoDia(funcionario.horarios, data)
  const minSaida = horaParaMinutos(grade.saidaAlmoco)
  const minRetorno = horaParaMinutos(grade.retornoAlmoco)
  const duracao = minRetorno - minSaida
  return duracao > 0 ? duracao : 60 // Padrão: 60 minutos (1 hora)
}

/**
 * Cancela quaisquer lembretes de almoço pendentes para o funcionário
 */
export function cancelarLembretesAlmoco(funcionarioId: string): void {
  const sessao = sessoesAtivas.get(funcionarioId)
  if (sessao) {
    if (sessao.timer10MinDepois) clearTimeout(sessao.timer10MinDepois)
    if (sessao.timer10MinAntes) clearTimeout(sessao.timer10MinAntes)
    sessoesAtivas.delete(funcionarioId)
    console.log(`🥪 Lembretes de almoço cancelados para ${sessao.primeiroNome} (retornou do almoço)`)
  }
}

/**
 * Agenda os lembretes de áudio para o intervalo de almoço:
 * 1. 10 minutos após a saída
 * 2. 10 minutos antes do retorno previsto
 */
export function agendarLembretesAlmoco(
  funcionario: Funcionario,
  dataHoraSaida: Date = new Date()
): void {
  // Cancela sessão anterior se houver
  cancelarLembretesAlmoco(funcionario.id)

  const primeiroNome = funcionario.nome.split(" ")[0]
  const duracaoMinutos = obterDuracaoAlmocoMinutos(funcionario, dataHoraSaida)
  const retornoPrevisto = new Date(dataHoraSaida.getTime() + duracaoMinutos * 60 * 1000)

  const horaSaidaStr = formatarHoraTexto(dataHoraSaida)
  const horaRetornoStr = formatarHoraTexto(retornoPrevisto)

  const sessao: SessaoAlmocoAtiva = {
    funcionarioId: funcionario.id,
    nome: funcionario.nome,
    primeiroNome,
    dataHoraSaida,
    duracaoMinutos,
    retornoPrevisto,
  }

  // --- 1. Lembrete: 10 minutos após bater a saída de almoço ---
  const ms10MinDepois = 10 * 60 * 1000
  sessao.timer10MinDepois = setTimeout(() => {
    // Calcular tempo restante atual
    const agora = new Date()
    const msRestantes = retornoPrevisto.getTime() - agora.getTime()
    const minRestantes = Math.max(0, Math.round(msRestantes / (60 * 1000)))
    const tempoRestanteStr = formatarDuracaoTexto(minRestantes)
    const emoji = sortearEmoji()

    const fala10Depois = `Olá ${primeiroNome}! Você bateu o ponto às ${horaSaidaStr} e seu retorno previsto é às ${horaRetornoStr}. Ainda resta ${tempoRestanteStr} de descanso! Excelente almoço! ${emoji}`

    console.log(`🥪 [Lembrete Almoço +10min] Reproduzindo para ${primeiroNome}:`, fala10Depois)
    reproduzirVozSaudacao(fala10Depois)
  }, ms10MinDepois)

  // --- 2. Lembrete: Faltando 10 minutos para o fim do almoço ---
  const msFaltando10Min = (duracaoMinutos - 10) * 60 * 1000
  if (msFaltando10Min > ms10MinDepois) {
    sessao.timer10MinAntes = setTimeout(() => {
      const emoji = sortearEmoji()
      const fala10Antes = `Atenção ${primeiroNome}! Faltam apenas 10 minutos para o fim do seu almoço. Você retorna às ${horaRetornoStr}. Te esperamos de volta com toda energia! Até já e excelente almoço! ${emoji}`

      console.log(`🥪 [Lembrete Almoço -10min] Reproduzindo para ${primeiroNome}:`, fala10Antes)
      reproduzirVozSaudacao(fala10Antes)
    }, msFaltando10Min)
  }

  sessoesAtivas.set(funcionario.id, sessao)
  console.log(
    `🥪 Lembretes de almoço agendados para ${primeiroNome} (Saída: ${horaSaidaStr}, Retorno Previsto: ${horaRetornoStr}, Duração: ${duracaoMinutos} min)`
  )
}
