"use client"

// Cache em memoria de audio sintetizado por texto (0ms de latencia para frases repetidas)
const cacheAudioBlobs = new Map<string, string>()

// Instancia de Audio ativa para evitar sobreposicao de falas
let audioAtual: HTMLAudioElement | null = null

/**
 * Fallback nativo: usa a API de fala do navegador caso o Google TTS esteja sem chave ou offline
 */
function falarComNavegador(texto: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return

  try {
    window.speechSynthesis.cancel() // Cancela falas anteriores
    const utterance = new SpeechSynthesisUtterance(texto)
    utterance.lang = "pt-BR"
    utterance.rate = 1.05 // Levemente mais agil e natural
    utterance.pitch = 1.0

    // Tentar selecionar uma voz de qualidade em portugues se disponivel
    const vozes = window.speechSynthesis.getVoices()
    const vozPt =
      vozes.find((v) => v.lang === "pt-BR" && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Luciana"))) ||
      vozes.find((v) => v.lang.startsWith("pt"))

    if (vozPt) {
      utterance.voice = vozPt
    }

    window.speechSynthesis.speak(utterance)
  } catch (err) {
    console.warn("Falha no fallback de voz do navegador:", err)
  }
}

/**
 * Reproduz a saudacao de voz com alta fidelidade via Google Cloud TTS.
 * Possui cache automatico e fallback nativo transparente.
 */
export async function reproduzirVozSaudacao(texto?: string): Promise<void> {
  if (!texto || typeof window === "undefined") return

  const textoLimpo = texto.trim()
  if (!textoLimpo) return

  // Parar áudio anterior se estiver tocando
  if (audioAtual) {
    try {
      audioAtual.pause()
      audioAtual.currentTime = 0
    } catch {}
    audioAtual = null
  }

  // 1. Verificar se ja temos o audio em cache local
  const urlEmCache = cacheAudioBlobs.get(textoLimpo)
  if (urlEmCache) {
    try {
      const audio = new Audio(urlEmCache)
      audioAtual = audio
      await audio.play()
      return
    } catch {
      // Se o play falhar por permissao de auto-play, tenta via navegador
      falarComNavegador(textoLimpo)
      return
    }
  }

  // 2. Chamar o endpoint /api/tts
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: textoLimpo }),
    })

    const contentType = res.headers.get("content-type") || ""

    // Se retornou audio MP3 com sucesso
    if (res.ok && contentType.includes("audio/mpeg")) {
      const blob = await res.blob()
      const audioUrl = URL.createObjectURL(blob)
      cacheAudioBlobs.set(textoLimpo, audioUrl)

      const audio = new Audio(audioUrl)
      audioAtual = audio
      await audio.play()
      return
    }

    // Se o backend indicou fallback (ex: sem chave de API ainda)
    const json = await res.json().catch(() => null)
    if (json?.fallback) {
      falarComNavegador(textoLimpo)
      return
    }

    // Qualquer outro caso
    falarComNavegador(textoLimpo)
  } catch (error) {
    console.warn("[TTS] Erro ao carregar voz do servidor, usando sintese local:", error)
    falarComNavegador(textoLimpo)
  }
}
