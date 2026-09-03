export type TipoPeriodoPonto = "Entrada" | "Saída Almoço" | "Retorno Almoço" | "Saída" | "Aviso"

export interface ContextoSaudacao {
  nome: string
  tipoPonto: string
  dataHora?: Date
  trabalhaSabado?: boolean
  humor?: string // ex: "cafe", "animado", "excelente", "bem", "sono"
  /** Resumo cheio de números, para o prompt da IA. Ex: "19°C agora em Mogi das Cruzes, ..." */
  climaResumo?: string
  /** Frase curta e falável do tempo. Ex: "Faz 19 graus agora, com céu nublado." */
  climaFrase?: string
  /** Emoji do tempo de hoje, para a mensagem visual. Ex: "🌧️" */
  climaEmoji?: string
  /** INSTRUÇÃO para a IA, nunca falada literalmente. Ex: "Amanhã é feriado (X). Deseje..." */
  feriadoResumo?: string
  /** Frase pronta e natural, essa sim para o catálogo local falar. */
  feriadoFrase?: string
  /** Amanhã é feriado — o catálogo local não pode se despedir com "até amanhã". */
  vesperaDeFeriado?: boolean
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
  julliana: ["Ju", "Julliana"],
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
      "Excelente dia, {nome}! Semana novinha começando, vamos com toda energia fazer acontecer!",
      "Excelente dia, {apelido}! Bora começar essa semana com determinação e muito foco!",
      "Excelente dia, {nome}! Segunda-feira abençoada e uma semana cheia de conquistas pra você!",
      "Oi {apelido}! Tudo bem? Excelente início de semana! Foco total nas metas!",
      "Excelente início de semana, {nome}! Que seja altamente produtivo e cheio de realizações!",
      "Excelente dia, {apelido}! Energia renovada para construir uma semana brilhante!",
    ],
    meioSemana: [
      "Excelente dia, {nome}! Tenha uma jornada super produtiva e cheia de realizações!",
      "Oi {apelido}! Excelente dia! Tudo bem com você? Que seu turno seja maravilhoso!",
      "Excelente dia, {nome}! Pronta pra arrasar hoje? Excelente trabalho!",
      "Fala, {apelido}! Excelente dia pra você! Bora colocar a mão na massa com determinação!",
      "Excelente dia, {nome}! Um ótimo foco e muito sucesso no seu trabalho!",
      "Excelente dia, {apelido}! Que a sua jornada seja tão brilhante quanto a sua dedicação!",
      "Excelente dia, {nome}! Foco total e uma jornada super produtiva pra você!",
      "Oi {apelido}! Excelente dia! Café tomado, energia no alto? Vamos fazer a diferença!",
      "Excelente dia, {nome}! Seu ponto foi registrado com sucesso. Excelente trabalho!",
      "Excelente dia, {apelido}! Mais uma oportunidade para brilhar e entregar o melhor!",
      "Excelente dia, {nome}! Tudo bem? Que hoje todas as metas sejam superadas!",
      "Oi {apelido}! Excelente dia pra você! Alegria, entusiasmo e foco nos resultados!",
    ],
    quarta: [
      "Excelente dia, {nome}! Quarta-feira com força total e ritmo acelerado de trabalho!",
      "Oi {apelido}! Excelente dia! Meio de semana e a produtividade segue impecável!",
    ],
    quinta: [
      "Excelente dia, {apelido}! Quinta-feira de muito foco, entrega e grandes realizações!",
      "Excelente dia, {nome}! Quinta-feira com energia total e excelência no trabalho!",
    ],
    sexta: [
      "Sextou com muita energia, {apelido}! Excelente dia de trabalho e foco nas entregas!",
      "Excelente dia, {nome}! Sexta-feira com alegria, determinação e foco nos resultados!",
      "Oi {apelido}! Sexta-feira chegou! Excelente dia de trabalho e dedicação pra você!",
      "Excelente dia, {nome}! Foco total para fechar a semana com chave de ouro e muito sucesso!",
      "Excelente dia, {apelido}! Sorriso no rosto, entusiasmo e excelência no seu trabalho!",
      "Excelente dia, {nome}! Dia de celebrar as conquistas e produzir com excelência!",
    ],
    sabado: [
      "Excelente sábado, {nome}! Excelente dia de trabalho, foco e dedicação total!",
      "Oi {apelido}! Excelente sábado! Força, foco e muito sucesso no seu trabalho hoje!",
      "Excelente dia, {nome}! Sábado com energia, garra e alta produtividade!",
      "Excelente dia, {apelido}! Um excelente sábado de trabalho e ótimos resultados pra você!",
    ],
    geral: [
      "Excelente dia, {nome}! Tenha uma excelente jornada de trabalho e muito sucesso!",
      "Oi {apelido}! Excelente dia! Vamos com energia, foco e dedicação!",
      "Excelente dia, {nome}! Que seja um dia inspirador, alegre e muito produtivo!",
    ],
  },

  saidaAlmoco: {
    segunda: [
      "Excelente almoço de segunda, {nome}! Refeição reforçada pra dar gás na semana toda!",
      "Oi {apelido}! Primeira pausa da semana! Excelente almoço e excelente descanso!",
      "Excelente almoço, {nome}! Segunda-feira em andamento e você tá mandando muito bem!",
    ],
    meioSemana: [
      "Excelente almoço de quarta, {nome}! Metade da semana com ótimos resultados, excelente intervalo!",
      "Oi {apelido}! Almoço reforçado para manter a alta produtividade! Excelente descanso!",
      "Excelente almoço, {nome}! Recarrega a bateria que a tarde vai render bastante!",
      "Oi {apelido}! Saboreie o almoço com calma. Excelente descanso!",
    ],
    sexta: [
      "Almoço de sexta com muita alegria, {apelido}! Excelente refeição pra você!",
      "Excelente almoço, {nome}! Pausa merecida para recarregar as energias da tarde!",
      "Oi {apelido}! Almoço de sexta-feira liberado com louvor! Excelente descanso!",
      "Excelente almoço, {nome}! Bom apetite e uma ótima pausa para renovar o ânimo!",
      "Excelente almoço, {apelido}! Excelente refeição e aproveite o descanso!",
    ],
    sabado: [
      "Excelente almoço de sábado, {nome}! Excelente apetite e um ótimo descanso!",
      "Oi {apelido}! Almoço de sábado com energia renovada! Aproveite sua refeição!",
      "Excelente almoço, {nome}! Excelente intervalo para recarregar as energias!",
    ],
    geral: [
      "Excelente almoço, {nome}! Aproveite seu descanso e excelente apetite!",
      "Oi {apelido}! Hora do almoço! Excelente refeição e saboreie bem o seu descanso!",
      "Excelente almoço, {nome}! Descanse bastante e recarregue as energias!",
      "Pausa merecida, {apelido}! Excelente almoço e excelente descanso!",
      "Excelente almoço, {nome}! Aproveite cada minuto do seu intervalo!",
      "Oi {apelido}! Hora de relaxar e comer aquela comidinha gostosa. Excelente almoço!",
      "Excelente almoço, {nome}! Desconecta um pouco e aproveita o seu momento!",
      "Excelente almoço, {apelido}! Te esperamos com energia renovada no retorno!",
      "Excelente almoço, {nome}! Comida boa e descanso garantido pra você!",
      "Oi {apelido}! Almoço liberado! Excelente refeição e aproveite esse tempinho!",
      "Excelente almoço, {nome}! Respira fundo, se alimente bem e renove as forças!",
      "Excelente almoço, {apelido}! Excelente refeição e ótimo descanso!",
      "Excelente almoço, {nome}! Um momento perfeito pra você renovar o ânimo!",
      "Oi {apelido}! Hora do almoço! Comidinha saborosa e muita paz!",
      "Excelente almoço, {nome}! Ponto de almoço registrado. Excelente descanso!",
    ],
  },

  retornoAlmoco: {
    segunda: [
      "Excelente retorno, {nome}! Tarde de segunda-feira começando com força total!",
      "Oi {apelido}! Segunda-feira à tarde: foco total para produzir muito!",
      "Excelente retorno, {nome}! Vamos fazer essa tarde valer muito a pena!",
    ],
    meioSemana: [
      "Excelente retorno, {nome}! Tarde de quarta-feira, foco total na excelência das entregas!",
      "Oi {apelido}! Tarde de quinta-feira com energia renovada e muito resultado!",
      "Excelente retorno, {nome}! Mais uma tarde de grandes conquistas e trabalho brilhante!",
      "Oi {apelido}! Tarde de quinta-feira, bora manter o excelente ritmo de trabalho!",
    ],
    quinta: [
      "Oi {apelido}! Tarde de quinta-feira com energia renovada e muito resultado!",
      "Excelente retorno, {nome}! Mais uma tarde de grandes conquistas pra você!",
    ],
    sexta: [
      "Excelente retorno, {nome}! Tarde de sexta-feira com determinação e foco total!",
      "Oi {apelido}! Reta final com alegria e foco na entrega com excelência!",
      "Excelente retorno, {nome}! Tarde de sexta com motivação e ótimos resultados!",
      "Oi {apelido}! Tarde produtiva e com muita energia positiva pra você!",
      "Excelente retorno, {apelido}! Foco e determinação para fechar a semana com maestria!",
    ],
    sabado: [
      "Excelente retorno, {nome}! Vamos com tudo fazer uma tarde de sábado brilhante!",
      "Oi {apelido}! Tarde de sábado com muita produtividade e foco!",
      "Excelente retorno, {nome}! Foco total para concluir as tarefas com excelência!",
    ],
    geral: [
      "Excelente retorno ao trabalho, {nome}! Excelente foco no seu turno da tarde!",
      "Oi {apelido}! Almoço renovou as energias? Excelente tarde de trabalho!",
      "Excelente retorno, {nome}! Bateria 100% recarregada, vamos com tudo!",
      "Excelente retorno, {apelido}! Foco total e muita produtividade!",
      "Excelente retorno ao trabalho, {nome}! Que sua tarde seja muito produtiva e cheia de realizações!",
      "Oi {apelido}! Excelente retorno! Força total nesse segundo tempo do dia!",
      "Excelente retorno, {nome}! Prontinho(a) pra fechar a tarde com chave de ouro!",
      "Oi {apelido}! Excelente retorno ao trabalho! Café na mão e produtividade no topo!",
      "Excelente retorno, {nome}! Ponto registrado com sucesso. Excelente tarde!",
      "Oi {apelido}! Mãos à obra com energia e entusiasmo!",
      "Excelente retorno ao trabalho, {nome}! Vamos fazer essa tarde render bastante!",
      "Excelente retorno, {apelido}! Ânimo renovado e mãos à obra!",
      "Excelente retorno, {nome}! Tudo pronto pra mais uma etapa vitoriosa hoje!",
      "Oi {apelido}! Excelente retorno! Que a tarde seja altamente produtiva e cheia de conquistas!",
      "Excelente retorno ao trabalho, {nome}! Foco, determinação e excelente trabalho!",
    ],
  },

  saidaFinal: {
    diasNormais: [
      "Excelente noite e excelente descanso, {nome}! Missão cumprida com maestria, até amanhã!",
      "Oi {apelido}! Jornada finalizada com sucesso! Descanse bastante e até amanhã!",
      "Excelente noite, {nome}! Parabéns pela dedicação e excelente trabalho de hoje. Até amanhã!",
      "Excelente noite, {apelido}! Foi uma jornada muito produtiva. Excelente descanso e até amanhã!",
      "Excelente noite, {nome}! Ponto registrado com sucesso. Parabéns pela entrega e até amanhã!",
      "Oi {apelido}! Dia concluído com excelência! Agora é hora de relaxar. Até amanhã!",
      "Excelente noite, {nome}! Excelente descanso pra você e sua família! Até amanhã!",
      "Tudo entregue hoje com maestria, {apelido}! Uma noite tranquila e revigorante pra você! Até amanhã!",
      "Excelente noite, {nome}! Dia vencido com dedicação. Excelente descanso e até amanhã!",
      "Oi {apelido}! Hora de curtir sua noite e recarregar as energias. Até amanhã!",
      "Excelente noite, {nome}! Parabéns pelo empenho e dedicação de hoje. Até amanhã!",
      "Fim de expediente, {apelido}! Excelente descanso e até amanhã!",
    ],
    sextaSemSabado: [
      "Sextou com sucesso, {apelido}! Dever cumprido com maestria! Excelente final de semana pra você!",
      "Excelente final de semana, {nome}! Semana encerrada com chave de ouro e grandes conquistas! Excelente descanso!",
      "Oi {apelido}! Parabéns pela semana produtiva e impecável! Excelente fim de semana e excelente descanso!",
      "Excelente noite e um maravilhoso final de semana, {nome}! Aproveite cada momento com alegria!",
      "Sextou com louvor, {apelido}! Parabéns por toda a dedicação na semana! Excelente fim de semana!",
      "Excelente final de semana, {nome}! Semana brilhante! Segunda-feira a gente se vê de novo!",
      "Oi {apelido}! Parabéns pelas metas batidas na semana! Tenha um excelente fim de semana!",
      "Excelente final de semana, {nome}! Ponto de sexta registrado! Parabéns pela dedicação!",
      "Excelente final de semana, {apelido}! Você brilhou a semana toda! Excelente descanso!",
      "Excelente fim de semana, {nome}! Que seja repleto de alegria, paz e descanso!",
    ],
    sextaComSabado: [
      "Excelente noite de sexta, {nome}! Excelente descanso hoje e até amanhã no sábado!",
      "Oi {apelido}! Sexta finalizada com sucesso! Descanse bem hoje e até amanhã!",
      "Excelente noite, {nome}! Parabéns pela dedicação de hoje. Excelente descanso e até amanhã!",
    ],
    sabadoFim: [
      "Excelente final de semana, {nome}! Sábado vencido com sucesso e dedicação! Excelente descanso e ótimo domingo!",
      "Missão de sábado cumprida com louvor, {apelido}! Excelente descanso e um ótimo domingo!",
      "Excelente noite e excelente descanso, {nome}! Semana completa com muito sucesso! Aproveite o domingo!",
      "Oi {apelido}! Fim de expediente no sábado! Parabéns pela entrega e tenha um excelente domingo!",
      "Excelente final de semana, {nome}! Parabéns pelo trabalho e dedicação no sábado. Até a próxima semana!",
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

  // Tempero do dia: no máximo UM assunto por saudação. Clima e feriado já
  // chegam aqui filtrados — o clima só quando merece comentário, o feriado só
  // na véspera e no retorno. Se veio, é porque vale falar.
  // feriadoFrase, não feriadoResumo: o resumo é a instrução que vai para a IA e
  // sairia falada ao pé da letra ("Deseje um excelente feriado ao se despedir").
  const tempero = ctx.feriadoFrase || ctx.climaFrase
  if (tempero) {
    templateVoz = `${templateVoz} ${tempero}`
  }

  // A mensagem visual SEMPRE termina com emoji: são eles que sobem animados na
  // tela quando a IA fala. Sem emoji na frase, não há nada para subir.
  const EMOJIS_POR_TIPO: Record<string, string[]> = {
    Entrada: ["☀️", "🚀", "💪", "✨", "🌤️", "😄", "⭐"],
    "Saída Almoço": ["🍽️", "😋", "🥗", "☕", "🍴"],
    "Retorno Almoço": ["💼", "⚡", "🔥", "💪", "🎯"],
    Saída: ["🌙", "⭐", "👏", "🎉", "❤️", "✨"],
  }
  const paleta = EMOJIS_POR_TIPO[tipo] || ["✨", "💪", "🎉"]
  const sorteados = new Set<string>()
  sorteados.add(sortearItem(paleta))
  if (Math.random() < 0.6) sorteados.add(sortearItem(paleta))
  // O emoji do tempo só entra se o clima foi de fato o assunto da fala. Quando
  // o feriado ganha a vez, uma nuvem solta na tela não quer dizer nada.
  if (ctx.climaEmoji && tempero && tempero === ctx.climaFrase) {
    sorteados.add(ctx.climaEmoji)
  }

  textoVisual = `${textoVisual} ${[...sorteados].join("")}`

  // Véspera de feriado: "até amanhã" seguido de "amanhã é feriado" se contradiz.
  if (ctx.vesperaDeFeriado) {
    // Sem \b no fim: "ã" não é caractere de palavra em regex JS, então a borda
    // nunca casaria e a despedida contraditória passava batido.
    templateVoz = templateVoz
      .replace(/[,\s]*\be\s+at[ée]\s+amanh[ãa]\s*[!.]?/gi, "!")
      .replace(/\s*,?\s*at[ée]\s+amanh[ãa]\s*[!.]?/gi, "")
      .replace(/\s+/g, " ")
      .replace(/[\s,;]+$/, "")
      .trim()
    // Tirar a despedida pode deixar a frase sem pontuação no fim.
    if (templateVoz && !/[!?.]$/.test(templateVoz)) templateVoz += "!"
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
