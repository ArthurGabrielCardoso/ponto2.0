export type TipoPeriodoPonto = "Entrada" | "Saída Almoço" | "Retorno Almoço" | "Saída" | "Aviso"

export interface ContextoSaudacao {
  nome: string
  tipoPonto: string
  dataHora?: Date
  trabalhaSabado?: boolean
  humor?: string // ex: "cafe", "animado", "excelente", "bem", "sono"
}

// Mapeamento e motor inteligente de apelidos carinhosos
const APELIDOS_CONHECIDOS: Record<string, string[]> = {
  jessica: ["Jé", "Jéssica"],
  jessyca: ["Jé", "Jéssyca"],
  arthur: ["Artur", "Tu", "Arthur"],
  artur: ["Artur", "Tu"],
  gabriel: ["Gabi", "Biel", "Gabriel"],
  gabriela: ["Gabi", "Gabi", "Gabriela"],
  gabriele: ["Gabi", "Gabriela"],
  rafael: ["Rafa", "Rafael"],
  rafaela: ["Rafa", "Rafaela"],
  guilherme: ["Gui", "Guilherme"],
  gustavo: ["Gus", "Gu", "Gustavo"],
  danielle: ["Dani", "Danielle"],
  daniela: ["Dani", "Daniela"],
  daniel: ["Dani", "Daniel"],
  juliana: ["Ju", "Juli", "Juliana"],
  julliana: ["Ju", "Juli", "Julliana"],
  julio: ["Ju", "Julio"],
  juliano: ["Ju", "Juliano"],
  leonardo: ["Léo", "Leonardo"],
  lucas: ["Lu", "Lucas"],
  luana: ["Lu", "Luana"],
  luiza: ["Lu", "Luiza"],
  luiz: ["Lu", "Luiz"],
  luis: ["Lu", "Luis"],
  beatriz: ["Bia", "Beatriz"],
  nathalia: ["Nati", "Nathalia"],
  natalia: ["Nati", "Natalia"],
  cristiane: ["Cris", "Cristiane"],
  cristiano: ["Cris", "Cristiano"],
  mariana: ["Mari", "Mariana"],
  maria: ["Mari", "Maria"],
  marina: ["Mari", "Marina"],
  felipe: ["Lipe", "Fê", "Felipe"],
  fernando: ["Fê", "Nando", "Fernando"],
  fernanda: ["Fê", "Nanda", "Fernanda"],
  matheus: ["Theus", "Matheus"],
  mateus: ["Theus", "Mateus"],
  bruno: ["Bru", "Bruno"],
  bruna: ["Bruna", "Bru"],
  camila: ["Cami", "Mila", "Camila"],
  carolina: ["Carol", "Carolina"],
  caroline: ["Carol", "Caroline"],
  patricia: ["Pati", "Patricia"],
  rodrigo: ["Rô", "Digão", "Rodrigo"],
  paulo: ["Paulinho", "Paulo"],
  paula: ["Paulinha", "Paula"],
  thiago: ["Thi", "Thiago"],
  tiago: ["Ti", "Tiago"],
  vanessa: ["Vane", "Nessa", "Vanessa"],
  vitoria: ["Vih", "Vitória"],
  victor: ["Vini", "Victor"],
  vinicius: ["Vini", "Vinicius"],
  amanda: ["Manda", "Amanda"],
  samara: ["Sam", "Samara"],
  sabrina: ["Sá", "Sabrina"],
}

/**
 * Obtém uma variação de apelido ou nome carinhoso para a pessoa
 */
export function obterApelidoCarinhoso(nomeCompleto: string): { nome: string; apelido: string } {
  const primeiroNome = (nomeCompleto || "Colega").split(" ")[0].trim()
  const normalizado = primeiroNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  const opcoes = APELIDOS_CONHECIDOS[normalizado]
  if (opcoes && opcoes.length > 0) {
    const sorteado = opcoes[Math.floor(Math.random() * opcoes.length)]
    return { nome: primeiroNome, apelido: sorteado }
  }

  // Fallback: se o nome for longo (> 6 letras), pode usar as 2 primeiras sílabas se soar natural
  if (primeiroNome.length > 6) {
    const abreviado = primeiroNome.slice(0, 4)
    return { nome: primeiroNome, apelido: abreviado }
  }

  return { nome: primeiroNome, apelido: primeiroNome }
}

// Normaliza o tipo de ponto
export function normalizarTipoPonto(t?: string): TipoPeriodoPonto {
  const tl = (t || "").toLowerCase().trim()
  if (tl.includes("entrada")) return "Entrada"
  if (tl.includes("saída") && tl.includes("almoço")) return "Saída Almoço"
  if (tl.includes("retorno")) return "Retorno Almoço"
  if (tl.includes("saída") || tl.includes("saida")) return "Saída"
  return "Entrada"
}

// -------------------------------------------------------------
// CATÁLOGO LOCAL DE 120+ FRASES (100% CULTURA "EXCELENTE...")
// -------------------------------------------------------------

export interface BancoFrasesPonto {
  entrada: {
    segunda: string[]
    meioSemana: string[]
    quarta: string[]
    quinta: string[]
    sexta: string[]
    sabado: string[]
    geral: string[]
  }
  saidaAlmoco: {
    segunda: string[]
    meioSemana: string[]
    sexta: string[]
    sabado: string[]
    geral: string[]
  }
  retornoAlmoco: {
    segunda: string[]
    meioSemana: string[]
    quinta: string[]
    sexta: string[]
    sabado: string[]
    geral: string[]
  }
  saidaFinal: {
    diasNormais: string[]
    sextaSemSabado: string[]
    sextaComSabado: string[]
    sabadoFim: string[]
  }
  humorRespostas: Record<string, string[]>
}

export const BANCO_FRASES: BancoFrasesPonto = {
  entrada: {
    segunda: [
      "Excelente dia, {nome}! Semana novinha começando, vamos com tudo!",
      "Excelente dia, {apelido}! Bora começar essa semana com chave de ouro e muita energia!",
      "Excelente dia, {nome}! Segunda-feira abençoada e uma semana incrível pra você!",
      "Oi {apelido}! Tudo bem? Excelente início de semana! Vamo que vamo!",
      "Excelente início de semana, {nome}! Que seja leve, muito produtivo e cheio de conquistas!",
      "Excelente dia, {apelido}! Bateria 100% recarregada no fim de semana? Bora fazer acontecer!",
    ],
    meioSemana: [
      "Excelente dia, {nome}! Tenha uma jornada super produtiva e cheia de realizações!",
      "Oi {apelido}! Excelente dia! Tudo bem com você? Que seu turno seja maravilhoso!",
      "Excelente dia, {nome}! Pronta pra arrasar hoje? Excelente trabalho!",
      "Fala, {apelido}! Excelente dia pra você! Bora colocar a mão na massa!",
      "Excelente dia, {nome}! Um ótimo foco e muito sucesso no seu trabalho!",
      "Excelente dia, {apelido}! Que a sua jornada seja tão brilhante quanto a sua dedicação!",
      "Excelente dia, {nome}! Foco total e uma jornada super produtiva pra você!",
      "Oi {apelido}! Excelente dia! Café tomado, energia no alto? Vamos nessa!",
      "Excelente dia, {nome}! Seu ponto foi registrado com sucesso. Excelente trabalho!",
      "Excelente dia, {apelido}! Mais uma oportunidade para brilhar e fazer a diferença!",
      "Excelente dia, {nome}! Tudo bem? Que hoje todas as metas sejam superadas!",
      "Oi {apelido}! Excelente dia pra você! Alegria, entusiasmo e bora pra cima!",
    ],
    quarta: [
      "Excelente dia, {nome}! Quarta-feira, metade da semana vencida com sucesso!",
      "Oi {apelido}! Excelente dia! Meio de semana e o ritmo segue impecável!",
    ],
    quinta: [
      "Excelente dia, {apelido}! Quinta-feira no capricho! Falta pouco pro sextou, vamo com foco!",
      "Excelente dia, {nome}! Quinta-feira com energia total e grandes conquistas!",
    ],
    sexta: [
      "🎶 Sextoou, {apelido}! Excelente dia e um último gás nessa semana maravilhosa!",
      "Excelente dia, {nome}! Sexta-feira com alegria e energia lá em cima!",
      "Oi {apelido}! Sexta-feira chegou! Excelente dia de trabalho pra você!",
      "Excelente dia, {nome}! Hoje o dia passa voando! Excelente trabalho e viva a sexta!",
      "Excelente dia, {apelido}! Sorriso no rosto que hoje é sexta-feira! Vamo que vamo!",
      "Excelente dia, {nome}! Último dia da semana útil, bora fechar com chave de ouro!",
    ],
    sabado: [
      "Excelente sábado, {nome}! Excelente dia de trabalho e que o turno passe rapidinho!",
      "Oi {apelido}! Excelente sábado! Força e foco que a folga já tá logo ali!",
      "Excelente dia, {nome}! Sábado com energia e muita produtividade!",
      "Excelente dia, {apelido}! Um excelente sábado de trabalho pra você!",
    ],
    geral: [
      "Excelente dia, {nome}! Tenha uma excelente jornada de trabalho!",
      "Oi {apelido}! Excelente dia! Vamo que vamo com energia e dedicação!",
      "Excelente dia, {nome}! Que seja um dia leve, alegre e muito produtivo!",
    ],
  },

  saidaAlmoco: {
    segunda: [
      "Excelente almoço de segunda, {nome}! Refeição reforçada pra dar gás na semana toda!",
      "Oi {apelido}! Primeira pausa da semana! Excelente almoço e excelente descanso!",
      "Excelente almoço, {nome}! Segunda-feira em andamento e você tá mandando muito bem!",
    ],
    meioSemana: [
      "Excelente almoço de quarta, {nome}! Metade da semana já foi, excelente intervalo!",
      "Oi {apelido}! Almoço de quinta é quase almoço de sexta! Excelente descanso!",
      "Excelente almoço, {nome}! Recarrega a bateria que a tarde vai render bastante!",
      "Oi {apelido}! Saboreie o almoço com calma. Excelente descanso!",
    ],
    sexta: [
      "Almoço de sexta tem outro sabor, né {apelido}? Excelente almoço pra você!",
      "Excelente almoço, {nome}! Sextou até no cardápio! Aproveite seu descanso!",
      "Oi {apelido}! Almoço de sexta-feira liberado com louvor! Excelente descanso!",
      "Excelente almoço, {nome}! Já dá pra sentir o cheirinho do fim de semana!",
      "🎶 Sextou no almoço, {apelido}! Excelente refeição e aproveite o descanso!",
    ],
    sabado: [
      "Excelente almoço de sábado, {nome}! Excelente apetite e um ótimo descanso!",
      "Oi {apelido}! Almoço de sábado é sagrado! Aproveite sua refeição!",
      "Excelente almoço, {nome}! Logo logo o expediente de sábado termina, excelente descanso!",
    ],
    geral: [
      "Excelente almoço, {nome}! Aproveite seu descanso e excelente apetite!",
      "Oi {apelido}! Hora do almoço! Excelente refeição e saboreie bem o seu descanso!",
      "Excelente almoço, {nome}! Descanse bastante e recarregue as energias!",
      "Pausa mais que merecida, {apelido}! Excelente almoço e excelente descanso!",
      "Excelente almoço, {nome}! Aproveite cada minuto do seu intervalo!",
      "Oi {apelido}! Hora de relaxar e comer aquela comidinha gostosa. Excelente almoço!",
      "Excelente almoço, {nome}! Desconecta um pouco e aproveita o seu momento!",
      "Excelente almoço, {apelido}! Te esperamos com energia renovada no retorno!",
      "Excelente almoço, {nome}! Comida boa e descanso garantido pra você!",
      "Oi {apelido}! Almoço liberado! Excelente refeição e aproveite esse tempinho!",
      "Excelente almoço, {nome}! Respira fundo, se alimente bem e renove as forças!",
      "Bateu aquela fome, né {apelido}? Excelente almoço e ótimo descanso!",
      "Excelente almoço, {nome}! Um momento perfeito pra você renovar o ânimo!",
      "Oi {apelido}! Hora do almoço! Comidinha saborosa e muita paz!",
      "Excelente almoço, {nome}! Ponto de almoço registrado. Excelente descanso!",
    ],
  },

  retornoAlmoco: {
    segunda: [
      "Excelente retorno, {nome}! Primeira tarde da semana começando com força total!",
      "Oi {apelido}! Segunda-feira à tarde: foco total que a semana começou incrível!",
      "Excelente retorno, {nome}! Vamos fazer essa segunda-feira valer muito a pena!",
    ],
    meioSemana: [
      "Excelente retorno, {nome}! Tarde de quarta-feira, falta pouco pra meta semanal!",
      "Oi {apelido}! Tarde de quinta-feira, o fim de semana já tá batendo na porta!",
      "Excelente retorno, {nome}! Mais uma tarde de grandes conquistas pra você!",
      "Oi {apelido}! Reta final da quinta-feira, bora manter o excelente ritmo!",
    ],
    quinta: [
      "Oi {apelido}! Tarde de quinta-feira, o fim de semana já tá batendo na porta!",
      "Excelente retorno, {nome}! Mais uma tarde de grandes conquistas pra você!",
    ],
    sexta: [
      "Excelente retorno, {nome}! Último turno da semana! A contagem regressiva começou!",
      "Oi {apelido}! Última tarde antes do fim de semana! Reta final com alegria!",
      "Excelente retorno, {nome}! Últimas horinhas da semana, foco total no sextou!",
      "Oi {apelido}! Mais algumas horas e o fim de semana é todo seu! Excelente tarde!",
      "🎶 Reta final de sexta, {apelido}! Excelente retorno e vamos fechar a semana!",
    ],
    sabado: [
      "Excelente retorno, {nome}! Último gás do sábado, já já tem folga!",
      "Oi {apelido}! Reta final do sábado de trabalho, excelente tarde!",
      "Excelente retorno, {nome}! Falta pouquinho pra curtir o merecido descanso!",
    ],
    geral: [
      "Excelente retorno ao trabalho, {nome}! Excelente foco no seu turno da tarde!",
      "Oi {apelido}! Almoço renovou as energias? Excelente tarde de trabalho!",
      "Excelente retorno, {nome}! Bateria 100% recarregada, vamos com tudo!",
      "Excelente retorno, {apelido}! Reta final do dia, foco total!",
      "Excelente retorno ao trabalho, {nome}! Que sua tarde seja leve e muito produtiva!",
      "Oi {apelido}! Excelente retorno! Força total nesse segundo tempo do dia!",
      "Excelente retorno, {nome}! Prontinho(a) pra fechar a tarde com chave de ouro!",
      "Oi {apelido}! Excelente retorno ao trabalho! Café na mão e produtividade no topo!",
      "Excelente retorno, {nome}! Ponto registrado com sucesso. Excelente tarde!",
      "Oi {apelido}! Agora é o sprint final do dia! Vamo que vamo!",
      "Excelente retorno ao trabalho, {nome}! Vamos fazer essa tarde render bastante!",
      "Excelente retorno, {apelido}! Ânimo renovado e mãos à obra!",
      "Excelente retorno, {nome}! Tudo pronto pra mais uma etapa vitoriosa hoje!",
      "Oi {apelido}! Excelente retorno! Que a tarde passe rápido e com muito resultado!",
      "Excelente retorno ao trabalho, {nome}! Foco, determinação e excelente trabalho!",
    ],
  },

  saidaFinal: {
    diasNormais: [
      "Excelente noite e excelente descanso, {nome}! Dever cumprido, até amanhã!",
      "Oi {apelido}! Missão cumprida por hoje! Descanse bastante e até amanhã!",
      "Excelente noite, {nome}! Parabéns pela dedicação de hoje. Até amanhã!",
      "Partiu descanso, {apelido}! Foi uma jornada produtiva. Excelente noite e até amanhã!",
      "Excelente noite, {nome}! Ponto registrado com sucesso. Excelente descanso e até amanhã!",
      "Oi {apelido}! Dia finalizado com sucesso! Agora é hora de relaxar. Até amanhã!",
      "Excelente noite, {nome}! Excelente descanso pra você e sua família! Até amanhã!",
      "Tudo entregue hoje, {apelido}! Uma noite tranquila e revigorante pra você! Até amanhã!",
      "Excelente noite, {nome}! Dia vencido com maestria. Excelente descanso e até amanhã!",
      "Oi {apelido}! Hora de curtir sua noite e recarregar as energias. Até amanhã!",
      "Excelente noite, {nome}! Parabéns pelo empenho de hoje. Até amanhã cedo!",
      "Fim de expediente, {apelido}! Vá descansar que você merece. Até amanhã!",
    ],
    sextaSemSabado: [
      "🎶 Sextoou com sucesso, {apelido}! Dever cumprido! Excelente final de semana pra você!",
      "Excelente final de semana, {nome}! Semana encerrada com chave de ouro! Curta bastante sua folga!",
      "Oi {apelido}! Fim de expediente na sexta, que delícia! Excelente fim de semana e excelente descanso!",
      "Excelente noite e um maravilhoso final de semana, {nome}! Aproveite cada segundo do seu descanso!",
      "🎶 Sextou, {apelido}! Partiu descansar porque guerreira também folga! Excelente fim de semana!",
      "Excelente final de semana, {nome}! Semana impecável! Segunda-feira a gente se vê de novo!",
      "Oi {apelido}! Parabéns pela semana maravilhosa! Desligue a mente e tenha um excelente fim de semana!",
      "Excelente final de semana, {nome}! Ponto de sexta registrado! Aproveite seus dias de folga!",
      "Partiu fim de semana, {apelido}! Você brilhou a semana toda! Excelente descanso!",
      "Excelente fim de semana, {nome}! Que seja repleto de alegria, paz e descanso!",
    ],
    sextaComSabado: [
      "Excelente noite de sexta, {nome}! Excelente descanso hoje e até amanhã no sábado!",
      "Oi {apelido}! Sexta finalizada! Descanse bem hoje e até amanhã!",
      "Excelente noite, {nome}! Amanhã tem o sprint final da semana. Excelente descanso e até amanhã!",
    ],
    sabadoFim: [
      "Excelente final de semana, {nome}! Sábado vencido com sucesso! Agora sim, excelente descanso e ótimo domingo!",
      "Missão de sábado cumprida, {apelido}! Curta muito seu domingo de folga! Excelente fim de semana!",
      "Excelente noite e excelente descanso, {nome}! Semana completa! Aproveite o domingo!",
      "Oi {apelido}! Fim de expediente no sábado! Descanse bastante e tenha um excelente domingo!",
      "Excelente final de semana, {nome}! Parabéns pelo esforço no sábado. Até a próxima semana!",
    ],
  },

  humorRespostas: {
    cafe: [
      "Café na caneca e força total, {apelido}! Um cafezinho reforçado resolve tudo! Excelente dia!",
      "Toma aquele café quentinho, {nome}! Vai dar tudo certo hoje! Excelente trabalho!",
    ],
    sono: [
      "Força, {apelido}! Respira fundo, alonga o corpo que logo logo a energia volta! Excelente trabalho!",
      "Com calma e foco, {nome}! O dia vai ser maravilhoso. Excelente jornada pra você!",
    ],
    excelente: [
      "Que energia incrível, {apelido}! Contagia todo mundo com essa alegria! Excelente dia!",
      "Maravilha ver você tão radiante hoje, {nome}! Vamos fazer um dia extraordinário!",
    ],
    animado: [
      "Adoramos essa disposição, {apelido}! Foco, garra e excelentes conquistas hoje!",
      "Com essa energia não tem pra ninguém, {nome}! Excelente trabalho pra você!",
    ],
    bem: [
      "Que ótimo, {apelido}! Que seu dia continue leve, produtivo e abençoado! Excelente trabalho!",
      "Tudo em paz, {nome}! Uma jornada excelente e cheia de boas realizações!",
    ],
  },
}

function sortearItem(lista: string[]): string {
  if (!lista || lista.length === 0) return ""
  const idx = Math.floor(Math.random() * lista.length)
  return lista[idx]
}

function aplicarNomes(template: string, nome: string, apelido: string): string {
  return template.replace(/\{nome\}/g, nome).replace(/\{apelido\}/g, apelido)
}

function primeiroNome(n: string): string {
  return (n || "Colega").split(" ")[0].trim()
}

/**
 * Gera a saudação visual curta e a locução de voz longa/rica localmente
 */
export function gerarSaudacaoLocal(ctx: ContextoSaudacao): { visual: string; voz: string } {
  const { nome, apelido } = obterApelidoCarinhoso(ctx.nome)
  const agora = ctx.dataHora || new Date()
  const diaSemana = agora.getDay() // 0: Dom, 1: Seg, 2: Ter, 3: Qua, 4: Qui, 5: Sex, 6: Sab
  const tipo = normalizarTipoPonto(ctx.tipoPonto)
  const trabalhaSabado = !!ctx.trabalhaSabado

  let templateVoz = ""
  let textoVisual = ""

  // Se houver resposta de humor recente selecionada
  if (ctx.humor && BANCO_FRASES.humorRespostas[ctx.humor]) {
    templateVoz = sortearItem(BANCO_FRASES.humorRespostas[ctx.humor])
    textoVisual = `Excelente dia, ${primeiroNome(ctx.nome)}!`
    return {
      visual: textoVisual,
      voz: aplicarNomes(templateVoz, nome, apelido),
    }
  }

  // --- 1. ENTRADA ---
  if (tipo === "Entrada") {
    if (diaSemana === 1) {
      // Segunda
      templateVoz = sortearItem(BANCO_FRASES.entrada.segunda)
      textoVisual = Math.random() > 0.5 ? `Excelente início de semana, ${apelido}!` : `Excelente dia, ${nome}!`
    } else if (diaSemana === 3) {
      // Quarta
      templateVoz = Math.random() > 0.5 ? sortearItem(BANCO_FRASES.entrada.quarta) : sortearItem(BANCO_FRASES.entrada.meioSemana)
      textoVisual = `Excelente dia, ${nome}!`
    } else if (diaSemana === 4) {
      // Quinta
      templateVoz = Math.random() > 0.5 ? sortearItem(BANCO_FRASES.entrada.quinta) : sortearItem(BANCO_FRASES.entrada.meioSemana)
      textoVisual = `Excelente dia, ${apelido}!`
    } else if (diaSemana === 5) {
      // Sexta
      templateVoz = sortearItem(BANCO_FRASES.entrada.sexta)
      textoVisual = Math.random() > 0.5 ? `Sextou! Excelente dia, ${apelido}!` : `Excelente dia, ${nome}!`
    } else if (diaSemana === 6) {
      // Sábado
      templateVoz = sortearItem(BANCO_FRASES.entrada.sabado)
      textoVisual = `Excelente sábado, ${nome}!`
    } else {
      // Geral / Terça / Domingo
      templateVoz = sortearItem(BANCO_FRASES.entrada.meioSemana)
      textoVisual = `Excelente dia, ${nome}!`
    }
  }

  // --- 2. SAÍDA ALMOÇO ---
  else if (tipo === "Saída Almoço") {
    if (diaSemana === 1) {
      templateVoz = sortearItem(BANCO_FRASES.saidaAlmoco.segunda)
    } else if (diaSemana === 5) {
      templateVoz = sortearItem(BANCO_FRASES.saidaAlmoco.sexta)
    } else if (diaSemana === 6) {
      templateVoz = sortearItem(BANCO_FRASES.saidaAlmoco.sabado)
    } else {
      templateVoz = Math.random() > 0.4 ? sortearItem(BANCO_FRASES.saidaAlmoco.geral) : sortearItem(BANCO_FRASES.saidaAlmoco.meioSemana)
    }
    textoVisual = `Excelente almoço, ${nome}!`
  }

  // --- 3. RETORNO ALMOÇO ---
  else if (tipo === "Retorno Almoço") {
    if (diaSemana === 1) {
      templateVoz = sortearItem(BANCO_FRASES.retornoAlmoco.segunda)
    } else if (diaSemana === 4) {
      templateVoz = sortearItem(BANCO_FRASES.retornoAlmoco.quinta)
    } else if (diaSemana === 5) {
      templateVoz = sortearItem(BANCO_FRASES.retornoAlmoco.sexta)
    } else if (diaSemana === 6) {
      templateVoz = sortearItem(BANCO_FRASES.retornoAlmoco.sabado)
    } else {
      templateVoz = Math.random() > 0.4 ? sortearItem(BANCO_FRASES.retornoAlmoco.geral) : sortearItem(BANCO_FRASES.retornoAlmoco.meioSemana)
    }
    textoVisual = `Excelente retorno ao trabalho, ${nome}!`
  }

  // --- 4. SAÍDA FINAL ---
  else {
    if (diaSemana === 5) {
      // Sexta-feira
      if (!trabalhaSabado) {
        // NÃO trabalha sábado -> NUNCA falar até amanhã!
        templateVoz = sortearItem(BANCO_FRASES.saidaFinal.sextaSemSabado)
        textoVisual = `Excelente final de semana, ${nome}!`
      } else {
        // Trabalha sábado -> Fala até amanhã
        templateVoz = sortearItem(BANCO_FRASES.saidaFinal.sextaComSabado)
        textoVisual = `Excelente noite, ${nome}!`
      }
    } else if (diaSemana === 6) {
      // Sábado encerramento
      templateVoz = sortearItem(BANCO_FRASES.saidaFinal.sabadoFim)
      textoVisual = `Excelente final de semana, ${nome}!`
    } else {
      // Seg a Qui
      templateVoz = sortearItem(BANCO_FRASES.saidaFinal.diasNormais)
      textoVisual = `Excelente noite, ${nome}!`
    }
  }

  const vozBruta = aplicarNomes(templateVoz, nome, apelido)
  const vozLimpa = vozBruta
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu, "")
    .replace(/[🎶🎵🎸🎤🎹🎷🎺✨⭐🌟💫🔥⚡🚀🎉🎊👏❤️💖]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  return {
    visual: textoVisual,
    voz: vozLimpa,
  }
}
