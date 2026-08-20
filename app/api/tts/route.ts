import { NextRequest, NextResponse } from "next/server"

const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize"
const DEFAULT_LANGUAGE = "pt-BR"
// Voz Chirp 3 HD Aoede: Voz generativa ultra-realista humana do Google Cloud (mesma do daily-briefing)
const DEFAULT_VOICE = process.env.TTS_VOICE || process.env.GOOGLE_TTS_VOICE || "pt-BR-Chirp3-HD-Aoede"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, voice = DEFAULT_VOICE } = body || {}

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Texto obrigatorio para sintese" }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY

    // Se a chave nao estiver configurada no ambiente, avisa para usar o fallback local do browser
    if (!apiKey) {
      return NextResponse.json(
        {
          fallback: true,
          message: "GOOGLE_TTS_API_KEY nao configurada no servidor. Usando sintese nativa do navegador.",
        },
        { status: 200 }
      )
    }

    const payload = {
      input: { text: text.trim() },
      voice: {
        languageCode: DEFAULT_LANGUAGE,
        name: voice,
      },
      audioConfig: {
        audioEncoding: "MP3",
        sampleRateHertz: 24000,
      },
    }

    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.warn(`[Google TTS API] Falha na sintese (${res.status}):`, errorText.slice(0, 200))
      return NextResponse.json(
        {
          fallback: true,
          error: `Google TTS retornou status ${res.status}`,
        },
        { status: 200 }
      )
    }

    const data = await res.json()
    if (!data.audioContent) {
      return NextResponse.json(
        { fallback: true, error: "Resposta sem audioContent" },
        { status: 200 }
      )
    }

    const audioBuffer = Buffer.from(data.audioContent, "base64")

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    })
  } catch (error) {
    console.error("[TTS Route] Erro interno:", error)
    return NextResponse.json(
      { fallback: true, error: error instanceof Error ? error.message : String(error) },
      { status: 200 }
    )
  }
}
