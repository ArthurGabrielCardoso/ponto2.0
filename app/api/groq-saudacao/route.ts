import { NextRequest, NextResponse } from "next/server"
import { gerarSaudacaoLocal, ContextoSaudacao } from "@/lib/gerador-falas"

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"

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
    }
  } catch {
    ctx = { nome: "Colaborador", tipoPonto: "Entrada", dataHora: new Date(), trabalhaSabado: false }
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
   - Se for Sexta-feira e ele trabalha no sábado (trabalhaSabado = true): pode dizer "Excelente descanso e até amanhã!".
3. DIVERSÃO E CARINHO:
   - Seja caloroso(a), alegre e bem-humorado(a).
   - Se for sexta-feira, pode brincar com "Sextou!", "🎶 Sextoou!", "Último gás!".
   - Use o primeiro nome da pessoa ou apelidos carinhosos comuns em português (ex: Jéssica -> Jé, Gabriel -> Gabi, Arthur -> Artur / Tu, Rafael -> Rafa, etc.).
   - Se um humor de check-in foi informado (ex: "cafe", "sono", "excelente"), comente de forma carinhosa e encorajadora.
4. TAMANHO DA RESPOSTA:
   - A locução de voz deve ter entre 1 e 2 frases curtas e fluidas (15 a 30 palavras), ideais para serem lidas por voz humana (Google TTS).
5. FORMATO DE SAÍDA JSON OBRIGATÓRIO:
   Retorne estritamente um objeto JSON válido com dois campos:
   {
     "visual": "Texto curto e nobre para exibir na tela (ex: 'Excelente dia, Jé!' ou 'Excelente final de semana, Arthur!')",
     "voz": "Texto completo, envolvente e natural que será falado por áudio (ex: '🎶 Sextoou, Jé! Excelente dia e um último gás nessa semana maravilhosa!')"
   }`

  const userPrompt = `Contexto do Ponto:
- Colaborador: ${ctx.nome}
- Tipo de Batida: ${ctx.tipoPonto}
- Dia da Semana: ${diaSemanaNome}
- Horário: ${horaFormatada}
- Trabalha no Sábado: ${ctx.trabalhaSabado ? "Sim" : "Não"}
- Humor informado: ${ctx.humor || "Não informado"}

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
