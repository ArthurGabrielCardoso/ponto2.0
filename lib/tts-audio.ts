"use client"

import { useState, useEffect } from "react"

// Cache em memória de áudio sintetizado por texto
const cacheAudioBlobs = new Map<string, string>()

// Instância de Audio ativa para evitar sobreposição de falas
let audioAtual: HTMLAudioElement | null = null

// Observadores de estado de voz para animações
type ListenerVoz = (falando: boolean) => void
const ouvintesVoz = new Set<ListenerVoz>()
let falandoAtual = false

function notificarEstadoVoz(falando: boolean) {
  falandoAtual = falando
  ouvintesVoz.forEach((cb) => {
    try {
      cb(falando)
    } catch {}
  })
}

/**
 * Remove emojis, notas musicais e caracteres especiais para que o Google TTS
 * não pronuncie palavras como "foguete", "nota musical", etc.
 */
export function limparTextoParaVoz(texto: string): string {
  if (!texto) return ""
  return (
    texto
      // Remove emojis e símbolos unicode
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/gu, "")
      // Remove notas musicais e caracteres gráficos
      .replace(/[🎶🎵🎸🎤🎹🎷🎺✨⭐🌟💫🔥⚡🚀🎉🎊👏❤️💖]/g, "")
      // Remove marcações markdown
      .replace(/[*_#`~[\]]/g, "")
      // Limpa pontuações repetidas e espaços excessivos
      .replace(/\s+/g, " ")
      .trim()
  )
}

/**
 * Hook React para componentes saberem em tempo real quando o áudio está tocando
 */
export function useVozAtiva(): boolean {
  const [estaFalando, setEstaFalando] = useState(falandoAtual)

  useEffect(() => {
    const handler = (f: boolean) => setEstaFalando(f)
    ouvintesVoz.add(handler)
    return () => {
      ouvintesVoz.delete(handler)
    }
  }, [])

  return estaFalando
}

/**
 * Fallback nativo: usa a API de fala do navegador caso o Google TTS esteja sem chave ou offline
 */
function falarComNavegador(texto: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return

  try {
    window.speechSynthesis.cancel() // Cancela falas anteriores
    const textoFalado = limparTextoParaVoz(texto)
    if (!textoFalado) return

    const utterance = new SpeechSynthesisUtterance(textoFalado)
    utterance.lang = "pt-BR"
    utterance.rate = 1.05
    utterance.pitch = 1.0

    utterance.onstart = () => notificarEstadoVoz(true)
    utterance.onend = () => notificarEstadoVoz(false)
    utterance.onerror = () => notificarEstadoVoz(false)

    const vozes = window.speechSynthesis.getVoices()
    const vozPt =
      vozes.find((v) => v.lang === "pt-BR" && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Luciana") || v.name.includes("Francisca"))) ||
      vozes.find((v) => v.lang.startsWith("pt"))

    if (vozPt) {
      utterance.voice = vozPt
    }

    window.speechSynthesis.speak(utterance)
  } catch (err) {
    notificarEstadoVoz(false)
    console.warn("Falha no fallback de voz do navegador:", err)
  }
}

function tocarElementoAudio(audio: HTMLAudioElement): Promise<void> {
  audio.onplay = () => notificarEstadoVoz(true)
  audio.onended = () => {
    notificarEstadoVoz(false)
    audioAtual = null
  }
  audio.onpause = () => notificarEstadoVoz(false)
  audio.onerror = () => {
    notificarEstadoVoz(false)
    audioAtual = null
  }
  audioAtual = audio
  return audio.play()
}

/**
 * Reproduz a saudação de voz com alta fidelidade via Google Cloud TTS.
 * Higieniza o texto para remover emojis e símbolos.
 */
export async function reproduzirVozSaudacao(texto?: string): Promise<void> {
  if (!texto || typeof window === "undefined") return

  const textoLimpo = limparTextoParaVoz(texto)
  if (!textoLimpo) return

  // Parar áudio anterior se estiver tocando
  if (audioAtual) {
    try {
      audioAtual.pause()
      audioAtual.currentTime = 0
    } catch {}
    audioAtual = null
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel()
  }
  notificarEstadoVoz(false)

  // 1. Verificar cache local
  const urlEmCache = cacheAudioBlobs.get(textoLimpo)
  if (urlEmCache) {
    try {
      const audio = new Audio(urlEmCache)
      await tocarElementoAudio(audio)
      return
    } catch {
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

    if (res.ok && contentType.includes("audio/mpeg")) {
      const blob = await res.blob()
      const audioUrl = URL.createObjectURL(blob)
      cacheAudioBlobs.set(textoLimpo, audioUrl)

      const audio = new Audio(audioUrl)
      await tocarElementoAudio(audio)
      return
    }

    const json = await res.json().catch(() => null)
    if (json?.fallback) {
      falarComNavegador(textoLimpo)
      return
    }

    falarComNavegador(textoLimpo)
  } catch (error) {
    console.warn("[TTS] Erro ao carregar voz do servidor, usando síntese local:", error)
    falarComNavegador(textoLimpo)
  }
}
