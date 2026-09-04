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

// ============================================================
// NÍVEL DE VOZ EM TEMPO REAL
// ============================================================
// A onda do rodapé cresce e encolhe junto com a voz. Para isso o áudio passa
// por um AnalyserNode da Web Audio API e viramos a amplitude num número 0..1.
//
// Quando a análise não é possível (fallback de speechSynthesis, que não tem
// elemento de áudio para grampear, ou navegador que recusa o grafo), caímos
// numa oscilação sintética: continua parecendo fala, sem depender de nada.
type ListenerNivel = (nivel: number) => void
const ouvintesNivel = new Set<ListenerNivel>()
let nivelAtual = 0

let audioCtx: AudioContext | null = null
let analisador: AnalyserNode | null = null
let fonteAtual: MediaElementAudioSourceNode | null = null
let bufferAnalise: Uint8Array | null = null
let loopNivelId: number | null = null
let inicioSintetico = 0
let usandoSintetico = false

function notificarNivel(nivel: number) {
  const arredondado = Math.round(nivel * 100) / 100
  if (Math.abs(arredondado - nivelAtual) < 0.03) return
  nivelAtual = arredondado
  ouvintesNivel.forEach((cb) => {
    try {
      cb(arredondado)
    } catch {}
  })
}

function pararMedicaoNivel() {
  if (loopNivelId !== null) {
    cancelAnimationFrame(loopNivelId)
    loopNivelId = null
  }
  usandoSintetico = false
  nivelAtual = -1 // força a notificação do zero abaixo
  notificarNivel(0)
}

function medirNivel() {
  loopNivelId = requestAnimationFrame(medirNivel)

  if (usandoSintetico || !analisador || !bufferAnalise) {
    // Oscilação suave e viva, em torno de um nível médio de fala.
    const t = (performance.now() - inicioSintetico) / 1000
    const onda = 0.5 + 0.28 * Math.sin(t * 7.5) + 0.16 * Math.sin(t * 3.1)
    notificarNivel(Math.min(1, Math.max(0.12, onda)))
    return
  }

  analisador.getByteTimeDomainData(bufferAnalise as Uint8Array<ArrayBuffer>)

  // RMS do sinal: 128 é o silêncio no domínio do tempo em 8 bits.
  let soma = 0
  for (let i = 0; i < bufferAnalise.length; i++) {
    const desvio = (bufferAnalise[i] - 128) / 128
    soma += desvio * desvio
  }
  const rms = Math.sqrt(soma / bufferAnalise.length)

  // Fala normalizada fica num RMS baixo; 3.2 abre a faixa sem estourar.
  notificarNivel(Math.min(1, rms * 3.2))
}

function iniciarMedicaoSintetica() {
  usandoSintetico = true
  inicioSintetico = performance.now()
  if (loopNivelId === null) medirNivel()
}

/**
 * Liga o analisador no elemento de áudio. Devolve false quando não dá — nesse
 * caso o áudio continua tocando normalmente, só sem medição real.
 */
function ligarAnalisador(audio: HTMLAudioElement): boolean {
  try {
    if (typeof window === "undefined") return false
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return false

    if (!audioCtx) audioCtx = new Ctor()
    if (audioCtx.state === "suspended") void audioCtx.resume()

    // Solta o grafo da fala anterior. Cada batida cria um elemento de áudio
    // novo, e sem isto os nós iriam se empilhando no contexto o dia inteiro.
    try {
      fonteAtual?.disconnect()
      analisador?.disconnect()
    } catch {}
    fonteAtual = null
    analisador = null

    // createMediaElementSource redireciona a saída do elemento para o grafo:
    // se ele for criado, é obrigatório conectar até o destination, senão o
    // áudio fica mudo. Por isso as duas conexões vêm logo em seguida.
    const fonte = audioCtx.createMediaElementSource(audio)
    const node = audioCtx.createAnalyser()
    node.fftSize = 256
    node.smoothingTimeConstant = 0.75
    fonte.connect(node)
    node.connect(audioCtx.destination)

    fonteAtual = fonte
    analisador = node
    bufferAnalise = new Uint8Array(node.frequencyBinCount)
    usandoSintetico = false
    return true
  } catch (e) {
    console.warn("[TTS] análise de áudio indisponível, usando oscilação sintética:", e)
    analisador = null
    bufferAnalise = null
    return false
  }
}

/**
 * Hook React com a intensidade da voz agora (0 = silêncio, 1 = pico).
 */
export function useNivelVoz(): number {
  const [nivel, setNivel] = useState(nivelAtual > 0 ? nivelAtual : 0)

  useEffect(() => {
    const handler = (n: number) => setNivel(n)
    ouvintesNivel.add(handler)
    return () => {
      ouvintesNivel.delete(handler)
    }
  }, [])

  return nivel
}

function notificarEstadoVoz(falando: boolean) {
  falandoAtual = falando
  ouvintesVoz.forEach((cb) => {
    try {
      cb(falando)
    } catch {}
  })

  if (!falando) pararMedicaoNivel()
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

    utterance.onstart = () => {
      notificarEstadoVoz(true)
      // speechSynthesis não expõe o áudio, então a onda usa oscilação sintética.
      iniciarMedicaoSintetica()
    }
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
  audio.onplay = () => {
    notificarEstadoVoz(true)
    if (ligarAnalisador(audio)) {
      if (loopNivelId === null) medirNivel()
    } else {
      iniciarMedicaoSintetica()
    }
  }
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
