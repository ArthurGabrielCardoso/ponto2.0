import { NextRequest, NextResponse } from "next/server"
import { gerarSaudacaoLocal, ContextoSaudacao } from "@/lib/gerador-falas"
import { obterClimaAtual } from "@/lib/clima"
import { obterContextoFeriados } from "@/lib/feriados"

export const dynamic = "force-dynamic"

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"

/**
 * Mesma regra do cliente, repetida aqui porque a rota precisa se virar sozinha
 * quando o cliente não manda nada. `instrucao` vai para o prompt da IA;
 * `frase` é o que o catálogo local fala, e as duas nunca se misturam.
 */
function resumirFeriadosServidor(
  referencia: Date,
  tipoPonto: string
): { instrucao?: string; frase?: string; vespera?: boolean } {
  try {
    const f = obterContextoFeriados(referencia)
    const tipo = (tipoPonto || "").toLowerCase()
    const ehUltimaBatida = tipo.includes("saída") && !tipo.includes("almoço")
    const ehPrimeiraBatida = tipo.includes("entrada")

    if (ehUltimaBatida && f.amanha && f.amanha.classe === "feriado") {
      return {
        instrucao: `Amanhã é feriado (${f.amanha.nome}). Deseje um excelente feriado ao se despedir, em poucas palavras.`,
        frase: `Amanhã é ${f.amanha.nome}, então excelente feriado para você!`,
        vespera: true,
      }
    }
    if (ehPrimeiraBatida && f.ontem && f.ontem.classe === "feriado") {
      return {
        instrucao: `Ontem foi feriado (${f.ontem.nome}). Pergunte de forma leve e rápida como foi o feriado.`,
        frase: `E aí, como foi o feriado?`,
      }
    }
  } catch {}
  return {}
}

export async function POST(req: NextRequest) {
  let ctx: ContextoSaudacao

  try {
    const body = await req.json()
    ctx = {
      nome: body.nome || "Colaborador",
      tipoPonto: body.tipoPonto || "Entrada",
      dataHora: body.dataHora ? new Date(body.dataHora) : new Date(),
      trabalhaSabado: !!body.trabalhaSabado,
      humor: body.humor,
      climaResumo: body.climaResumo,
      climaFrase: body.climaFrase,
      climaEmoji: body.climaEmoji,
      feriadoResumo: body.feriadoResumo,
      feriadoFrase: body.feriadoFrase,
      vesperaDeFeriado: body.vesperaDeFeriado,
    }
  } catch {
    ctx = { nome: "Colaborador", tipoPonto: "Entrada", dataHora: new Date(), trabalhaSabado: false }
  }

  // O cliente normalmente já manda o contexto do dia (ele mantém em cache).
  // Quando não manda, a rota busca — ambos vêm de cache em memória, então isso
  // não custa rede na maior parte das vezes.
  if (!ctx.feriadoResumo && !ctx.feriadoFrase) {
    const feriado = resumirFeriadosServidor(ctx.dataHora || new Date(), ctx.tipoPonto)
    ctx.feriadoResumo = feriado.instrucao
    ctx.feriadoFrase = feriado.frase
    ctx.vesperaDeFeriado = feriado.vespera
  }
  if (!ctx.climaResumo) {
    const clima = await obterClimaAtual().catch(() => null)
    // Só entra quando o tempo merece comentário — e nem sempre, senão a mesma
    // frase de agasalho sai em toda batida do dia inteiro.
    if (clima?.relevante && Math.random() < 0.5) {
      ctx.climaResumo = clima.resumo
      ctx.climaFrase = clima.frase ?? undefined
      ctx.climaEmoji = clima.emoji
    }
  }

  const groqApiKey = process.env.GROQ_API_KEY

  // Se não houver chave Groq configurada, retorna imediatamente a saudação local refinada
  if (!groqApiKey) {
    const local = gerarSaudacaoLocal(ctx)
    return NextResponse.json({ ...local, origem: "local_sem_chave" }, { status: 200 })
  }

  const agora = ctx.dataHora || new Date()
  const diasNomes = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]
  const diaSemanaNome = diasNomes[agora.getDay()]
  const horaFormatada = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  const systemPrompt = `Você é a IA assistente de voz do sistema de ponto da empresa. Sua função é gerar a saudação mais calorosa, empática, inteligente e de alto astral para o funcionário que acabou de bater o ponto.

REGRAS INEGOCIÁVEIS DA CULTURA DA EMPRESA:
1. CULTURA OBRIGATÓRIA: NUNCA, SOB HIPÓTESE ALGUMA, diga "Bom dia", "Boa tarde" ou "Boa noite". É OBRIGATÓRIO usar sempre variações como:
   - "Excelente dia" (na entrada pela manhã)
   - "Excelente tarde" (à tarde)
   - "Excelente noite" (ao sair à noite)
   - "Excelente início de semana" (na segunda-feira)
   - "Excelente almoço" / "Excelente refeição" (na saída para almoço)
   - "Excelente retorno" (na volta do almoço)
   - "Excelente descanso" / "Excelente final de semana" (no encerramento)
2. REGRA DE SEXTA-FEIRA À NOITE / SAÍDA:
   - Se hoje for Sexta-feira e o colaborador NÃO trabalha no sábado (trabalhaSabado = false): NUNCA diga "até amanhã"! É PROIBIDO dizer "até amanhã". Diga sempre "Excelente final de semana!", "Sextou com louvor!", "Bom descanso e um ótimo fim de semana!".
3. REGRA DE POSTURA, MOTIVAÇÃO E PRODUTIVIDADE (INEGOCIÁVEL):
   - É ESTRITAMENTE PROIBIDO dizer frases que desmotivem o trabalho ou sugiram que a pessoa queira que o dia termine logo.
   - NUNCA DIGA: "a folga tá logo aí", "o dia vai passar rapidinho", "falta pouco pra acabar", "logo é fim de semana", "já já tem folga", "aguenta firme que logo acaba", etc.
   - SEMPRE motive para o trabalho, a excelência, o foco, a energia, a produtividade e a superação de metas com entusiasmo real.
   - Seja caloroso(a), alegre e motivador(a). Se for sexta-feira, celebre a energia positiva, mas mantendo o foco em realizar um trabalho excelente.
   - Use o primeiro nome da pessoa ou apelidos carinhosos comuns em português (ex: Jéssica -> Jé, Arthur -> Artur / Tu, Julliana -> Ju, etc.).
   - Se um humor de check-in foi informado (ex: "cafe", "energia", "excelente"), encoraje com positividade e força de vontade.
4. CLIMA E FERIADOS (SÓ QUANDO O CONTEXTO TROUXER, NUNCA INVENTE):
   - O contexto só traz clima quando o tempo MERECE comentário (chuva forte, frio ou calor forte). Quando vier, comente em POUCAS PALAVRAS e de forma útil ("leva guarda-chuva", "capriche no agasalho", "bebe bastante água"). NUNCA invente temperatura, previsão ou chance de chuva: use SOMENTE os números do contexto.
   - Quando o contexto NÃO trouxer clima, é PROIBIDO falar do tempo. Dia ameno não é assunto.
   - O contexto só traz feriado em dois momentos: na despedida da véspera e no retorno depois dele. Siga exatamente a instrução que vier. NUNCA anuncie "o próximo feriado é em X dias" e NUNCA invente feriado ou data.
   - Use no MÁXIMO UM desses dois assuntos por saudação. A saudação tem que continuar curta: nunca vire boletim do tempo.
5. REGRA CRÍTICA DE VOZ (SEM EMOJIS):
   - O campo "voz" NUNCA DEVE CONTER EMOJIS OU SÍMBOLOS MUSICAIS (nada de 🎶, 🚀, 😄, etc.), pois o sintetizador de voz do Google lê os emojis como palavras ("nota musical", "foguete"). No campo "voz", use APENAS texto falado natural e melódico em português!
   - No campo "visual" é OBRIGATÓRIO usar de 1 a 3 emojis que combinem com a mensagem, o horário e o clima — eles sobem animados na tela do tablet. Escolha emojis expressivos e variados (❤️, 🚀, ☀️, 🌧️, ☕, 💪, 🎉, 🌙, ⭐, 🍽️, 🔥, 😄...), nunca sempre os mesmos.
6. FORMATO DE SAÍDA JSON OBRIGATÓRIO:
   Retorne estritamente um objeto JSON válido com dois campos:
   {
     "visual": "Texto curto e nobre com emoji para exibir na tela (ex: 'Excelente dia, Jé! 🚀' ou 'Excelente final de semana, Arthur! 🎉')",
     "voz": "Texto apenas em palavras naturais sem emoji para o sintetizador de voz falar (ex: 'Excelente dia, Jé! Foco total e muita energia para um dia produtivo!')"
   }`

  const userPrompt = `Contexto do Ponto:
- Colaborador: ${ctx.nome}
- Tipo de Batida: ${ctx.tipoPonto}
- Dia da Semana: ${diaSemanaNome}
- Horário: ${horaFormatada}
- Trabalha no Sábado: ${ctx.trabalhaSabado ? "Sim" : "Não"}
- Humor informado: ${ctx.humor || "Não informado"}
- Clima em Mogi das Cruzes: ${ctx.climaResumo || "Tempo sem nada digno de nota — NÃO fale sobre o tempo"}
- Feriados: ${ctx.feriadoResumo || "Nada a dizer sobre feriado — NÃO fale sobre feriado"}

Gere o JSON com "visual" e "voz" seguindo estritamente as regras da empresa.`

  try {
    // Timeout de 1.4s para garantir que o tablet nunca trave se a internet oscilar
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1400)

    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 150,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.warn(`[Groq API] Falha na resposta (${res.status}), usando catálogo local`)
      const local = gerarSaudacaoLocal(ctx)
      return NextResponse.json({ ...local, origem: "fallback_groq_status" }, { status: 200 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      const local = gerarSaudacaoLocal(ctx)
      return NextResponse.json({ ...local, origem: "fallback_groq_vazio" }, { status: 200 })
    }

    const parsed = JSON.parse(content)
    let voz = (parsed.voz || "").trim()
    let visual = (parsed.visual || "").trim()

    // Validação extra de segurança da cultura (remover acidentalmente "Bom dia/boa tarde/boa noite" se o LLM alucinar)
    voz = sanitizarCulturaEmpresa(voz, ctx)
    // Remove emojis e caracteres musicais para não serem soletrados pelo TTS
    voz = voz
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu, "")
      .replace(/[🎶🎵🎸🎤🎹🎷🎺✨⭐🌟💫🔥⚡🚀🎉🎊👏❤️💖]/g, "")
      .replace(/\s+/g, " ")
      .trim()
    visual = sanitizarCulturaEmpresa(visual, ctx)

    if (!voz) {
      const local = gerarSaudacaoLocal(ctx)
      return NextResponse.json({ ...local, origem: "fallback_groq_invalido" }, { status: 200 })
    }

    return NextResponse.json(
      {
        visual: visual || `Excelente dia, ${ctx.nome.split(" ")[0]}!`,
        voz,
        origem: "groq_ia",
        modelo: DEFAULT_MODEL,
      },
      { status: 200 }
    )
  } catch (err) {
    console.warn("[Groq API] Timeout ou erro de conexão, acionando gerador local instantâneo:", err)
    const local = gerarSaudacaoLocal(ctx)
    return NextResponse.json({ ...local, origem: "fallback_local_timeout" }, { status: 200 })
  }
}

/**
 * Garante que termos proibidos pela cultura ("bom dia", "boa tarde", "boa noite") sejam substituídos
 */
function sanitizarCulturaEmpresa(texto: string, ctx: ContextoSaudacao): string {
  if (!texto) return ""
  let t = texto
    .replace(/\bBom\s+dia\b/gi, "Excelente dia")
    .replace(/\bBoa\s+tarde\b/gi, "Excelente tarde")
    .replace(/\bBoa\s+noite\b/gi, "Excelente noite")

  // Se for sexta e não trabalha sábado, garante que não haja "até amanhã"
  const agora = ctx.dataHora || new Date()
  if (agora.getDay() === 5 && !ctx.trabalhaSabado) {
    t = t.replace(/\baté\s+amanhã\b/gi, "excelente final de semana")
    t = t.replace(/\bate\s+amanha\b/gi, "excelente final de semana")
  }

  return t
}
