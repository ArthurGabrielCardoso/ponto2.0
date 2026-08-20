"use client"

/**
 * Página de Registro de Ponto - RECONHECIMENTO LOCAL
 *
 * face-api.js roda 100% no navegador do tablet.
 * Modelos (~12MB) ficam no cache do browser após 1o carregamento.
 * Descritores dos funcionários ficam em memória.
 * Resultado: reconhecimento em ~1-2s ao invés de 10-14s.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import { registrarPonto, buscarRegistrosHoje, buscarFuncionarioPorId, registrarMultiplosPontos } from "@/lib/supabase"
import type { Funcionario } from "@/lib/types"
import { analisarSituacaoPonto, type DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"
import { DialogoPontoInteligente, type PontoRegularizacao } from "@/components/dialogo-ponto-inteligente"
import { reproduzirVozSaudacao } from "@/lib/tts-audio"
import "../ponto-registrado/ponto-batido.css"
import {
  initModels,
  loadDescriptors,
  recognizeFace,
  detectSmileOnly,
} from "@/lib/face-recognition-client"

// Animação temática: emoji por 3.5s → depois Lottie check original
function SuccessAnimation({ tipo }: { tipo: string }) {
  const [showCheck, setShowCheck] = useState(false)
  const tl = (tipo || "").toLowerCase()
  let icon: string
  if (tl.includes("entrada")) {
    icon = "🌤️"
  } else if (tl.includes("almoço") && (tl.includes("saída") || tl.includes("saida"))) {
    icon = "🍽️"
  } else if (tl.includes("retorno")) {
    icon = "💼"
  } else if (tl.includes("saída") || tl.includes("saida")) {
    icon = "🌙" // Lua aparece apenas na Saída (fim do expediente)
  } else if (tl.includes("extra")) {
    icon = "⭐"
  } else {
    icon = "💼"
  }

  useEffect(() => {
    const t = setTimeout(() => setShowCheck(true), 3500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ width: 200, height: 200, position: "relative" }}>
      {!showCheck ? (
        <>
          <style>{`
            @keyframes emojiIn { 0%{transform:scale(0) rotate(-20deg);opacity:0} 40%{transform:scale(1.2) rotate(5deg);opacity:1} 60%{transform:scale(0.95) rotate(-2deg)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
            @keyframes emojiFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
            .sa-emoji-wrap{display:flex;align-items:center;justify-content:center;width:100%;height:100%}
            .sa-emoji{font-size:110px;animation:emojiIn .8s ease-out forwards, emojiFloat 2s ease-in-out .8s infinite}
          `}</style>
          <div className="sa-emoji-wrap"><span className="sa-emoji">{icon}</span></div>
        </>
      ) : (
        <DotLottieReact
          src="https://lottie.host/8a95b3ad-f30a-4fb9-a55d-4153b3b92810/RPsps2O63O.lottie"
          loop={false}
          autoplay
        />
      )}
    </div>
  )
}
// Screensaver com relógio em tempo real e saudação dinâmica
function Screensaver({ onTap }: { onTap: () => void }) {
  const [time, setTime] = useState("")
  const [greeting, setGreeting] = useState("")

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
      const h = now.getHours()
      if (h < 12) setGreeting("Excelente dia!")
      else if (h < 18) setGreeting("Excelente tarde!")
      else setGreeting("Excelente noite!")
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer select-none"
      style={{ background: "linear-gradient(135deg, rgba(29,185,179,0.85) 0%, rgba(13,132,136,0.9) 100%)" }}
      onClick={onTap}
    >
      <style>{`
        @keyframes fadeUp{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.3}}
        .ss-fade{animation:fadeUp .6s ease-out both}
        .ss-fade-d1{animation-delay:.1s}
        .ss-fade-d2{animation-delay:.3s}
        .ss-fade-d3{animation-delay:.5s}
        .ss-colon{animation:pulse-dot 2s ease-in-out infinite}
      `}</style>
      <div className="text-center text-white">
        <div className="ss-fade mb-6">
          <Image src="/logo.png" alt="Logo" width={420} height={210} priority style={{ height: "auto" }} />
        </div>
        <p className="ss-fade ss-fade-d1 text-6xl font-light tracking-widest mb-4" style={{ fontVariantNumeric: "tabular-nums" }}>
          {time}
        </p>
        <p className="ss-fade ss-fade-d2 text-2xl font-light opacity-90 mb-8">{greeting}</p>
        <p className="ss-fade ss-fade-d3 text-lg opacity-60">Toque na tela para registrar o ponto</p>
      </div>
    </div>
  )
}

// Barra de progresso do auto-retorno
function ReturnProgress({ durationMs }: { durationMs: number }) {
  return (
    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-4">
      <style>{`
        @keyframes shrink{0%{width:100%}100%{width:0%}}
      `}</style>
      <div
        className="h-full bg-primary rounded-full"
        style={{ animation: `shrink ${durationMs}ms linear forwards` }}
      />
    </div>
  )
}



interface RecognizedPerson {
  id: string
  nome: string
  similarity: number
  isSmiling: boolean
  smileFrames: number
  registroCompleto: boolean
  tipo?: string
  hora?: string
  data?: string
  mensagem?: string
}

export default function RegistrarPonto() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [screensaver, setScreensaver] = useState(true)
  const screensaverRef = useRef(true)
  const rafRef = useRef<number | null>(null)
  const inactivityTimerRef = useRef<number | null>(null)
  const successTimeoutRef = useRef<number | null>(null)

  const [modelsReady, setModelsReady] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState("Carregando sistema...")
  const [recognizedPerson, setRecognizedPerson] = useState<RecognizedPerson | null>(null)
  const recognizedPersonRef = useRef<RecognizedPerson | null>(null)
  const [dialogoInteligente, setDialogoInteligente] = useState<{
    diagnostico: DiagnosticoPonto
    person: RecognizedPerson
  } | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const showSuccessRef = useRef(false)
  const isRegisteringRef = useRef(false)
  const isProcessingRef = useRef(false)
  const pendingTipoRef = useRef<string | null>(null)
  const pendingTipoPromiseRef = useRef<Promise<string> | null>(null)

  const SMILE_FRAMES_REQUIRED = 2 // 2 frames consecutivos sorrindo para confirmar

  // Prefetch da página de sucesso
  useEffect(() => {
    router.prefetch("/ponto-registrado")
  }, [router])

  useEffect(() => {
    screensaverRef.current = screensaver
  }, [screensaver])

  useEffect(() => {
    recognizedPersonRef.current = recognizedPerson
  }, [recognizedPerson])

  useEffect(() => {
    showSuccessRef.current = showSuccess
  }, [showSuccess])

  // Iniciar câmera + carregar modelos em paralelo
  useEffect(() => {
    let mounted = true

    const setup = async () => {
      // 1. Iniciar câmera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        })
        if (!mounted) return
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setCameraActive(true)
          console.log("📹 Câmera ativada!")
        }
      } catch (error) {
        console.error("Erro ao acessar câmera:", error)
      }

      // 2. Carregar modelos face-api.js (cached pelo browser após 1o load)
      try {
        if (mounted) setLoadingStatus("Carregando modelos de reconhecimento...")
        await initModels()

        // 3. Carregar descritores dos funcionários
        if (mounted) setLoadingStatus("Carregando funcionários...")
        const count = await loadDescriptors()

        if (mounted) {
          setModelsReady(true)
          setLoadingStatus(`Pronto! ${count} funcionário(s) carregado(s)`)
          console.log("🎥 Sistema de reconhecimento local pronto!")
          // Preload do Lottie check para transição instantânea
          fetch("https://lottie.host/8a95b3ad-f30a-4fb9-a55d-4153b3b92810/RPsps2O63O.lottie").catch(() => {})
        }
      } catch (error) {
        console.error("Erro ao carregar modelos:", error)
        if (mounted) setLoadingStatus("Erro ao carregar modelos")
      }
    }

    setup()

    return () => {
      mounted = false
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((t) => t.stop())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Iniciar loop de reconhecimento quando tudo estiver pronto
  useEffect(() => {
    if (modelsReady && cameraActive && !rafRef.current) {
      startLoop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsReady, cameraActive])

  // Loop de reconhecimento — back-to-back sem throttle, serializado pelo isProcessingRef.
  // Screensaver suspende o loop; só volta a rodar após clique na película.
  const startLoop = () => {
    if (!videoRef.current) return
    const video = videoRef.current

    const loop = async () => {
      rafRef.current = requestAnimationFrame(loop)

      if (showSuccessRef.current) return
      if (screensaverRef.current) return
      if (isProcessingRef.current || isRegisteringRef.current) return

      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        return
      }

      try {
        const current = recognizedPersonRef.current
        resetInactivityTimer()

        // === ESTÁGIO 1: Reconhecer (back-to-back até identificar) ===
        if (!current) {
          isProcessingRef.current = true
          try {
            const result = await recognizeFace(video, 0.5)
            if (result) {
              console.log(`✅ Identificado: ${result.nome} (${result.similarity.toFixed(0)}%)`)

              pendingTipoRef.current = null
              pendingTipoPromiseRef.current = null

              const person: RecognizedPerson = {
                id: result.id,
                nome: result.nome,
                similarity: result.similarity,
                isSmiling: result.isSmiling,
                smileFrames: result.isSmiling ? 1 : 0,
                registroCompleto: false,
              }
              setRecognizedPerson(person)

              if (person.smileFrames >= SMILE_FRAMES_REQUIRED) {
                await handleRegistro(person)
              }
            }
          } finally {
            isProcessingRef.current = false
          }
          return
        }

        // === ESTÁGIO 2: Esperar sorriso ===
        isProcessingRef.current = true
        try {
          const smile = await detectSmileOnly(video, 0.5)
          if (smile) {
            const newSmileFrames = smile.isSmiling ? current.smileFrames + 1 : 0
            const updated: RecognizedPerson = {
              ...current,
              isSmiling: smile.isSmiling,
              smileFrames: newSmileFrames,
            }
            setRecognizedPerson(updated)

            if (newSmileFrames >= SMILE_FRAMES_REQUIRED) {
              await handleRegistro(updated)
            }
          }
        } finally {
          isProcessingRef.current = false
        }
      } catch (e) {
        console.error("Erro no loop:", e)
        isProcessingRef.current = false
      }
    }

    rafRef.current = requestAnimationFrame(loop)
  }

  // Registrar ponto — transição INSTANTÂNEA
  // Mostra tela de sucesso imediatamente com tipo pré-carregado, insert roda em background
  const handleRegistro = async (person: RecognizedPerson) => {
    if (isRegisteringRef.current) return
    isRegisteringRef.current = true

    console.log(`🎯 ANALISANDO PONTO INTELIGENTE: ${person.nome}`)

    const now = new Date()
    const primeiroNome = person.nome.split(" ")[0]

    try {
      // Buscar funcionário para obter a grade de horários e os registros do dia
      const [funcionario, registrosHoje] = await Promise.all([
        buscarFuncionarioPorId(person.id).catch(() => null),
        buscarRegistrosHoje(person.id).catch(() => []),
      ])

      const funcObj: Funcionario = funcionario || {
        id: person.id,
        nome: person.nome,
        descritores: [],
      }

      // Analisar situação inteligente com base na grade
      const diag = analisarSituacaoPonto(funcObj, registrosHoje, now)

      if (diag.tipo !== "DIRETO") {
        // Exibir diálogo inteligente amigável
        setDialogoInteligente({ diagnostico: diag, person })
        return
      }

      // Fluxo Direto Normal
      const res = await registrarPonto(person.id, person.nome, diag.proximoTipoSugerido)
      const tipo = res.tipo || diag.proximoTipoSugerido

      const getMensagem = (t: string) => {
        const tl = t.toLowerCase().trim()
        if (tl.includes("entrada")) return `Excelente dia, ${primeiroNome}!`
        if (tl.includes("saída") && tl.includes("almoço")) return `Excelente almoço, ${primeiroNome}!`
        if (tl.includes("retorno")) return `Excelente retorno ao trabalho, ${primeiroNome}!`
        if (tl.includes("saída") || tl.includes("saida")) return `Excelente noite e bom descanso, ${primeiroNome}!`
        return `Excelente trabalho, ${primeiroNome}!`
      }

      const mensagem = res.emCooldown
        ? `Olá, ${primeiroNome}! Seu ponto (${tipo}) já foi registrado recentemente.`
        : getMensagem(tipo)

      const completed: RecognizedPerson = {
        ...person,
        registroCompleto: true,
        tipo,
        hora: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        data: now.toLocaleDateString(),
        mensagem,
      }

      setRecognizedPerson(completed)
      setShowSuccess(true)
      reproduzirVozSaudacao(completed.mensagem)

      // Auto-retorno em 15 segundos
      successTimeoutRef.current = window.setTimeout(() => {
        resetToInitialState()
      }, 15000)
    } catch (error) {
      console.error("Erro ao registrar ponto:", error)
      const completed: RecognizedPerson = {
        ...person,
        registroCompleto: true,
        tipo: "Aviso",
        hora: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        data: now.toLocaleDateString(),
        mensagem: error instanceof Error ? error.message : "Não foi possível registrar o ponto.",
      }
      setRecognizedPerson(completed)
      setShowSuccess(true)
      successTimeoutRef.current = window.setTimeout(() => {
        resetToInitialState()
      }, 8000)
    }
  }

  // Confirmação do diálogo inteligente (insere múltiplos pontos ou ponto específico)
  const handleConfirmarDialogoInteligente = async (
    pontos: PontoRegularizacao[],
    tipoExibicao: string,
    mensagemPersonalizada: string
  ) => {
    if (!dialogoInteligente) return
    const person = dialogoInteligente.person
    setDialogoInteligente(null)

    const now = new Date()

    try {
      await registrarMultiplosPontos(person.id, person.nome, pontos)

      const completed: RecognizedPerson = {
        ...person,
        registroCompleto: true,
        tipo: tipoExibicao,
        hora: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        data: now.toLocaleDateString(),
        mensagem: mensagemPersonalizada,
      }

      setRecognizedPerson(completed)
      setShowSuccess(true)
      reproduzirVozSaudacao(completed.mensagem)

      successTimeoutRef.current = window.setTimeout(() => {
        resetToInitialState()
      }, 15000)
    } catch (error) {
      console.error("Erro ao registrar regularização de ponto:", error)
      resetToInitialState()
    }
  }

  // Reset timer de inatividade
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = window.setTimeout(() => {
      setScreensaver(true)
      setRecognizedPerson(null)
      setDialogoInteligente(null)
    }, 5 * 60 * 1000) // 5 minutos
  }

  // Reset para estado inicial (SEM recarregar a página!)
  const resetToInitialState = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
      successTimeoutRef.current = null
    }
    isRegisteringRef.current = false
    setShowSuccess(false)
    setRecognizedPerson(null)
    setDialogoInteligente(null)
    isProcessingRef.current = false
    setScreensaver(true)
  }


  // Parar câmera
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((t) => t.stop())
      setCameraActive(false)
    }
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera()
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    }
  }, [stopCamera])

  const completedPerson = recognizedPerson?.registroCompleto ? recognizedPerson : null

  return (
    <div className="relative min-h-screen w-full bg-secondary">
      {/* Vídeo em tela cheia */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Logo no topo esquerdo */}
      <div className="absolute top-4 left-4 z-10">
        <Image
          src="/logo.png"
          alt="Logo"
          width={140}
          height={70}
          priority
          style={{ height: "auto" }}
        />
      </div>

      {/* Status inferior - Pessoa reconhecida */}
      {recognizedPerson && !recognizedPerson.registroCompleto && !showSuccess && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 py-6 px-4"
          style={{ backgroundColor: "rgba(29, 185, 179, 0.85)", backdropFilter: "blur(8px)" }}
        >
          <style>{`@keyframes nameIn{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:translateY(0)}}`}</style>
          <div className="text-white text-center" style={{ animation: "nameIn .4s ease-out" }}>
            <div className="text-2xl font-bold tracking-wide">{recognizedPerson.nome}</div>
            <div className="text-sm mt-1 opacity-90">
              {recognizedPerson.isSmiling
                ? "Sorriso detectado!"
                : "Sorria para registrar o ponto"}
            </div>
          </div>
        </div>
      )}

      {/* Indicador estável — mostra enquanto ainda não reconheceu ninguém */}
      {!screensaver && !showSuccess && !recognizedPerson && modelsReady && cameraActive && (
        <div className="absolute bottom-0 left-0 right-0 z-20 py-4 px-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}>
          <div className="text-white text-center text-sm opacity-80">
            Identificando...
          </div>
        </div>
      )}

      {/* Proteção de tela */}
      {screensaver && <Screensaver onTap={() => { setScreensaver(false); resetInactivityTimer() }} />}

      {/* Tela de sucesso */}
      {showSuccess && completedPerson && (
        <div className="absolute inset-0 z-40">
          <style>{`
            @keyframes slideUp{0%{opacity:0;transform:translateY(30px)}100%{opacity:1;transform:translateY(0)}}
            .su{animation:slideUp .5s ease-out both}
            .su-d1{animation-delay:.15s}
            .su-d2{animation-delay:.3s}
            .su-d3{animation-delay:.45s}
          `}</style>
          <div className="ponto-batido-container">
            {/* Lado esquerdo - texto */}
            <div className="ponto-batido-form-section relative">
              <div className="w-full max-w-md">
                <div className="text-center space-y-6 mt-20">
                  <div className="flex justify-center su">
                    <SuccessAnimation tipo={completedPerson.tipo || "Entrada"} />
                  </div>

                  <h1 className="text-3xl font-bold su su-d1" style={{ color: "#c69e6b" }}>
                    {completedPerson.mensagem}
                  </h1>

                  <div className="su su-d2 text-sm text-gray-600 bg-green-50 rounded-lg p-3 border border-green-200">
                    <span className="text-green-700 font-semibold">{completedPerson.tipo}</span>{" "}
                    registrada às{" "}
                    <span className="font-semibold">{completedPerson.hora}</span> em{" "}
                    {completedPerson.data}
                  </div>

                  <div className="su su-d3">
                    <ReturnProgress durationMs={30000} />
                  </div>

                  <div className="absolute bottom-4 left-4">
                    <button
                      onClick={resetToInitialState}
                      className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Lado direito - gradiente temático */}
            <div
              className="ponto-batido-image-section"
              style={{
                background: (() => {
                  const t = (completedPerson.tipo || "").toLowerCase()
                  if (t.includes("entrada")) return "linear-gradient(135deg, #f6d365 0%, #fda085 100%)"
                  if (t.includes("almoço") && (t.includes("saída") || t.includes("saida"))) return "linear-gradient(135deg, #ff9a56 0%, #ff6a3d 100%)"
                  if (t.includes("retorno")) return "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)"
                  if (t.includes("saída") || t.includes("saida")) return "linear-gradient(135deg, #2d3561 0%, #1e215d 50%, #0b0c2a 100%)"
                  return "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                })(),
              }}
            >
              <div className="text-center">
                <Image src="/logo.png" alt="Logo" width={500} height={200} priority style={{ height: "auto" }} />
                <p className="text-white/80 text-lg mt-6 font-light">
                  {(() => {
                    const t = (completedPerson.tipo || "").toLowerCase()
                    if (t.includes("entrada")) return "Tenha um ótimo dia de trabalho!"
                    if (t.includes("almoço") && (t.includes("saída") || t.includes("saida"))) return "Aproveite seu almoço e bom descanso!"
                    if (t.includes("retorno")) return "Boa volta ao trabalho!"
                    if (t.includes("saída") || t.includes("saida")) return "Descanse bem, até amanhã!"
                    return "Ponto registrado com sucesso!"
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
          {/* Diálogo Inteligente de Resolução de Horários */}
      {dialogoInteligente && (
        <DialogoPontoInteligente
          nome={dialogoInteligente.person.nome}
          diagnostico={dialogoInteligente.diagnostico}
          onConfirmar={handleConfirmarDialogoInteligente}
          onCancelar={() => {
            setDialogoInteligente(null)
            resetToInitialState()
          }}
        />
      )}
</div>
  )
}
