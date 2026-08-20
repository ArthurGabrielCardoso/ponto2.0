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
import { registrarPonto, buscarRegistrosHoje, buscarFuncionarioPorId, registrarMultiplosPontos, buscarFuncionarios } from "@/lib/supabase"
import type { Funcionario } from "@/lib/types"
import { analisarSituacaoPonto, type DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"
import { DialogoPontoInteligente, type PontoRegularizacao } from "@/components/dialogo-ponto-inteligente"
import { reproduzirVozSaudacao } from "@/lib/tts-audio"
import { agendarLembretesAlmoco, cancelarLembretesAlmoco, sincronizarSessoesAlmocoDoDia, type InfoAlmocoAtivo } from "@/lib/lembretes-almoco"
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
// Efeito de moldura luminosa e cantos futuristas nas bordas da tela ao identificar pessoa
// Efeito de moldura luminosa com pulsação vibrante nas bordas ao identificar e sorrir
function ViewfinderBorder({ isSmiling }: { isSmiling: boolean }) {
  return (
    <>
      <style>{`
        @keyframes smilePulseIntense {
          0%, 100% {
            border-color: rgba(52, 211, 153, 0.95);
            box-shadow: inset 0 0 70px rgba(16, 185, 129, 0.55), 0 0 35px rgba(16, 185, 129, 0.4);
            transform: scale(1);
          }
          50% {
            border-color: rgba(16, 185, 129, 1);
            box-shadow: inset 0 0 130px rgba(16, 185, 129, 0.9), 0 0 80px rgba(52, 211, 153, 0.8);
            transform: scale(1.002);
          }
        }
        @keyframes identifyPulseGentle {
          0%, 100% {
            border-color: rgba(45, 212, 191, 0.75);
            box-shadow: inset 0 0 55px rgba(20, 184, 166, 0.3);
          }
          50% {
            border-color: rgba(20, 184, 166, 0.95);
            box-shadow: inset 0 0 80px rgba(20, 184, 166, 0.5);
          }
        }
        .smile-glow-pulse {
          animation: smilePulseIntense 0.5s ease-in-out infinite;
        }
        .identify-glow-pulse {
          animation: identifyPulseGentle 1.8s ease-in-out infinite;
        }
      `}</style>
      <div
        className={`fixed inset-0 pointer-events-none z-20 transition-all duration-300 ${
          isSmiling
            ? "border-[7px] sm:border-[8px] smile-glow-pulse"
            : "border-[5px] sm:border-[6px] identify-glow-pulse"
        }`}
      />
    </>
  )
}

// Componente individual com cronômetro regressivo ao vivo (Design Dourado e horizontal)
function BadgeAlmocoCronometro({ item }: { item: InfoAlmocoAtivo }) {
  const [tempoRestanteStr, setTempoRestanteStr] = useState("")
  const [passouDoTempo, setPassouDoTempo] = useState(false)

  useEffect(() => {
    const calcular = () => {
      const agora = Date.now()
      const diffMs = item.retornoPrevistoMs - agora
      const totalSeg = Math.floor(Math.abs(diffMs) / 1000)
      const horas = Math.floor(totalSeg / 3600)
      const min = Math.floor((totalSeg % 3600) / 60)
      const seg = totalSeg % 60

      const formatado =
        horas > 0
          ? `${horas}h ${String(min).padStart(2, "0")}m ${String(seg).padStart(2, "0")}s`
          : `${String(min).padStart(2, "0")}m ${String(seg).padStart(2, "0")}s`

      if (diffMs >= 0) {
        setPassouDoTempo(false)
        setTempoRestanteStr(formatado)
      } else {
        setPassouDoTempo(true)
        setTempoRestanteStr(`+${formatado}`)
      }
    }

    calcular()
    const timer = setInterval(calcular, 1000)
    return () => clearInterval(timer)
  }, [item.retornoPrevistoMs])

  return (
    <div className="flex items-center justify-between gap-3 bg-black/25 rounded-md px-3.5 py-2.5 border border-white/25 text-xs shadow-md">
      <div className="flex flex-col min-w-0 pr-2">
        <span className="font-bold text-sm text-white tracking-tight leading-tight truncate">{item.primeiroNome}</span>
        <span className="text-[12px] text-amber-100 font-medium mt-0.5 whitespace-nowrap">
          {item.horaSaida} às {item.horaRetornoPrevista}
        </span>
      </div>

      <div
        className={`flex items-center gap-1.5 font-mono font-bold text-xs px-2.5 py-1.5 rounded-md border shadow-sm shrink-0 ${
          passouDoTempo
            ? "bg-red-600/75 text-white border-red-400/70 animate-pulse"
            : "bg-black/45 text-amber-200 border-white/20"
        }`}
      >
        <span className="text-xs">⏳</span>
        <span>{tempoRestanteStr}</span>
      </div>
    </div>
  )
}

function Screensaver({ onTap }: { onTap: () => void }) {
  const [time, setTime] = useState("")
  const [periodo, setPeriodo] = useState("Excelente dia")
  const [nomes, setNomes] = useState<string[]>([])
  const [nomeIndex, setNomeIndex] = useState(0)
  const [funcionariosEmAlmoco, setFuncionariosEmAlmoco] = useState<InfoAlmocoAtivo[]>([])

  // Relógio em tempo real
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
      const h = now.getHours()
      if (h < 12) setPeriodo("Excelente dia")
      else if (h < 18) setPeriodo("Excelente tarde")
      else setPeriodo("Excelente noite")
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Carregar lista de funcionários para rotação de primeiro nome
  useEffect(() => {
    buscarFuncionarios()
      .then((funcs) => {
        const primeirosNomes = funcs
          .map((f) => f.nome.split(" ")[0].trim())
          .filter(Boolean)
        if (primeirosNomes.length > 0) {
          setNomes(primeirosNomes)
        }
      })
      .catch(() => {})
  }, [])

  // Rotação de nomes a cada 3 segundos
  useEffect(() => {
    if (nomes.length <= 1) return
    const id = setInterval(() => {
      setNomeIndex((prev) => (prev + 1) % nomes.length)
    }, 3000)
    return () => clearInterval(id)
  }, [nomes])

  // Sincronizar funcionários atualmente em almoço
  useEffect(() => {
    const atualizarAlmoco = () => {
      sincronizarSessoesAlmocoDoDia().then(setFuncionariosEmAlmoco).catch(() => {})
    }
    atualizarAlmoco()
    const idAlmoco = setInterval(atualizarAlmoco, 10000)

    return () => {
      clearInterval(idAlmoco)
    }
  }, [])

  const nomeAtual = nomes.length > 0 ? nomes[nomeIndex] : ""
  const saudacaoCompleta = nomeAtual ? `${periodo}, ${nomeAtual}!` : `${periodo}!`

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-between p-6 cursor-pointer select-none overflow-hidden backdrop-blur-xl"
      style={{
        background: "linear-gradient(135deg, rgba(29, 185, 179, 0.72) 0%, rgba(22, 145, 141, 0.75) 50%, rgba(13, 132, 136, 0.8) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      onClick={onTap}
    >
      <style>{`
        @keyframes fadeUp{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes nameFade{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes pulseSlow{0%,100%{opacity:0.9}50%{opacity:0.55}}
        .ss-fade{animation:fadeUp .6s ease-out both}
        .ss-fade-d1{animation-delay:.1s}
        .ss-name-rot{animation:nameFade .45s ease-out both}
        .ss-pulse{animation:pulseSlow 3s ease-in-out infinite}
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Espaçador superior */}
      <div className="h-4" />

      {/* Centro: Horário e Saudação Personalizada com Rotação de Nomes a cada 3s */}
      <div className="text-center text-white my-auto">
        <p className="ss-fade text-7xl sm:text-8xl md:text-9xl font-light tracking-widest mb-4" style={{ fontVariantNumeric: "tabular-nums" }}>
          {time}
        </p>
        <div key={nomeAtual || "padrao"} className="ss-name-rot">
          <p className="text-3xl sm:text-4xl md:text-5xl font-light opacity-95 tracking-tight">
            {saudacaoCompleta}
          </p>
        </div>
      </div>

      {/* Parte de Baixo: Instrução de Toque posicionada na base */}
      <div className={`text-center z-30 transition-all ${funcionariosEmAlmoco.length > 0 ? "mb-28 sm:mb-24" : "mb-6"}`}>
        <p className="ss-pulse text-xs sm:text-sm text-white/90 font-semibold tracking-wider uppercase bg-black/25 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/15 shadow-lg inline-block">
          Toque na tela para registrar o ponto
        </p>
      </div>

      {/* Canto Inferior: Cards de Almoço Horizontais com Scroll */}
      {funcionariosEmAlmoco.length > 0 && (
        <div
          className="absolute bottom-6 left-4 right-4 sm:left-6 sm:right-6 z-40 pointer-events-auto ss-fade"
          onClick={(e) => {
            e.stopPropagation()
            onTap()
          }}
        >
          <div
            className="rounded-lg p-3.5 text-white shadow-2xl border ml-auto"
            style={{
              background: "linear-gradient(135deg, rgba(198, 158, 107, 0.95) 0%, rgba(175, 134, 87, 0.95) 50%, rgba(150, 107, 60, 0.98) 100%)",
              borderColor: "rgba(255, 255, 255, 0.35)",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.35)",
              maxWidth: funcionariosEmAlmoco.length === 1 ? "24rem" : "100%",
            }}
          >
            <div className="flex items-center gap-2 mb-2 px-1 border-b border-white/20 pb-1.5">
              <span className="text-base">🍽️</span>
              <span className="text-xs font-bold uppercase tracking-wider text-white">Almoço</span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth">
              {funcionariosEmAlmoco.map((f) => (
                <div key={f.funcionarioId} className="shrink-0 w-72 sm:w-80">
                  <BadgeAlmocoCronometro item={f} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
      if (isProcessingRef.current || isRegisteringRef.current) return

      // Se a proteção de tela estiver ativa, executa em baixa frequência apenas para manter a GPU e worker 100% aquecidos
      if (screensaverRef.current) {
        if (Math.random() > 0.03) return // Warmup heartbeat periódico
      }

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
        if (tl.includes("saída") && tl.includes("almoço")) return `Excelente almoço, ${primeiroNome}! Aproveite seu almoço e bom descanso!`
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

      // Gerenciar lembretes automáticos de almoço por voz
      const tl = tipo.toLowerCase()
      if (tl.includes("saída") && tl.includes("almoço")) {
        agendarLembretesAlmoco(funcObj, now)
      } else if (tl.includes("retorno") || (tl.includes("saída") && !tl.includes("almoço"))) {
        cancelarLembretesAlmoco(funcObj.id)
      }

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

      // Gerenciar lembretes automáticos de almoço por voz na regularização inteligente
      const funcionario = await buscarFuncionarioPorId(person.id).catch(() => null)
      const funcObj: Funcionario = funcionario || { id: person.id, nome: person.nome, descritores: [] }
      const tl = tipoExibicao.toLowerCase()
      if (tl.includes("saída") && tl.includes("almoço")) {
        agendarLembretesAlmoco(funcObj, now)
      } else if (tl.includes("retorno") || (tl.includes("saída") && !tl.includes("almoço"))) {
        cancelarLembretesAlmoco(funcObj.id)
      }

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

      {/* Moldura luminosa nas bordas da tela quando reconhecido */}
      {recognizedPerson && !recognizedPerson.registroCompleto && !showSuccess && (
        <ViewfinderBorder isSmiling={recognizedPerson.isSmiling} />
      )}

      {/* Status em Glassmorphism - Pessoa reconhecida (Largura total colada no fundo) */}
      {recognizedPerson && !recognizedPerson.registroCompleto && !showSuccess && (
        <div className="absolute bottom-0 left-0 right-0 z-30 w-full pointer-events-none animate-in fade-in duration-300">
          <div
            className={`py-5 px-6 border-t backdrop-blur-2xl transition-all duration-300 text-center space-y-1 ${
              recognizedPerson.isSmiling
                ? "bg-emerald-950/85 border-emerald-400/60 text-white shadow-[0_-5px_30px_rgba(16,185,129,0.35)]"
                : "bg-teal-950/85 border-teal-400/50 text-white shadow-[0_-5px_25px_rgba(29,185,179,0.3)]"
            }`}
          >
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {recognizedPerson.nome}
            </div>
            <div className="text-sm sm:text-base font-medium">
              {recognizedPerson.isSmiling ? (
                <span className="text-emerald-300 font-semibold tracking-wide animate-pulse">
                  Sorriso detectado! Registrando ponto...
                </span>
              ) : (
                <span className="text-teal-200/95 font-medium tracking-wide">
                  Sorria para registrar seu ponto
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Indicador estável em Glassmorphism — Identificando (Largura total colada no fundo) */}
      {!screensaver && !showSuccess && !recognizedPerson && modelsReady && cameraActive && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none animate-in fade-in duration-300">
          <div className="py-4 px-6 bg-black/55 backdrop-blur-xl border-t border-white/15 text-white flex items-center justify-center gap-3">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-400"></span>
            </div>
            <span className="text-sm font-medium tracking-wide text-white/90">
              Posicione seu rosto na câmera
            </span>
          </div>
        </div>
      )}

      {/* Proteção de tela */}
      {screensaver && <Screensaver onTap={() => { screensaverRef.current = false; setScreensaver(false); resetInactivityTimer() }} />}

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
