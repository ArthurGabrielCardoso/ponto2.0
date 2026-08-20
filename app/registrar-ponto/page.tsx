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
// Moldura luminosa esmeralda pulsante ativada exclusivamente ao sorrir
function ViewfinderBorder() {
  return (
    <>
      <style>{`
        @keyframes smilePulseIntense {
          0%, 100% {
            border-color: rgba(52, 211, 153, 0.95);
            box-shadow: inset 0 0 70px rgba(16, 185, 129, 0.6), 0 0 35px rgba(16, 185, 129, 0.45);
            transform: scale(1);
          }
          50% {
            border-color: rgba(16, 185, 129, 1);
            box-shadow: inset 0 0 130px rgba(16, 185, 129, 0.95), 0 0 80px rgba(52, 211, 153, 0.85);
            transform: scale(1.002);
          }
        }
        .smile-glow-pulse {
          animation: smilePulseIntense 0.45s ease-in-out infinite;
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none z-20 border-[7px] sm:border-[8px] smile-glow-pulse" />
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
      setTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
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

  // Rotação de nomes a cada 5 segundos (mantém o prefixo "Excelente tarde," estático e anima apenas o nome)
  useEffect(() => {
    if (nomes.length <= 1) return
    const id = setInterval(() => {
      setNomeIndex((prev) => (prev + 1) % nomes.length)
    }, 5000)
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

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer select-none overflow-hidden backdrop-blur-xl"
      style={{
        background: "linear-gradient(135deg, rgba(29, 185, 179, 0.72) 0%, rgba(22, 145, 141, 0.75) 50%, rgba(13, 132, 136, 0.8) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      onClick={onTap}
    >
      <style>{`
        @keyframes fadeUp{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes smoothNameFade{0%{opacity:0;transform:translateY(4px);filter:blur(3px)}100%{opacity:1;transform:translateY(0);filter:blur(0)}}
        .ss-fade{animation:fadeUp .6s ease-out both}
        .ss-name-smooth{display:inline-block;animation:smoothNameFade .8s cubic-bezier(0.22, 1, 0.36, 1) both}
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Canto Superior Esquerdo: Relógio Menor e Discreto */}
      <div className="absolute top-6 left-6 sm:top-8 sm:left-8 z-30 pointer-events-none ss-fade">
        <p className="text-3xl sm:text-4xl font-light text-white/90 tracking-wider" style={{ fontVariantNumeric: "tabular-nums" }}>
          {time}
        </p>
      </div>

      {/* Centro: Saudação com Nome Rotativo a cada 5s (prefixo fixo) + Instrução de Toque */}
      <div className="text-center text-white px-6 ss-fade">
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight flex items-center justify-center flex-wrap">
          <span>{periodo},</span>
          {nomeAtual ? (
            <span key={nomeAtual} className="ss-name-smooth font-normal ml-2 sm:ml-3">
              {nomeAtual}!
            </span>
          ) : (
            <span className="font-normal ml-2">!</span>
          )}
        </h2>

        <p className="text-base sm:text-lg text-white/70 font-light mt-4 sm:mt-5 tracking-wide">
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
  const lastFaceSeenRef = useRef<number>(0)
  const isRegisteringRef = useRef(false)
  const isProcessingRef = useRef(false)
  const pendingTipoRef = useRef<string | null>(null)
  const pendingTipoPromiseRef = useRef<Promise<string> | null>(null)

  const SMILE_FRAMES_REQUIRED = 1 // 1 frame sorrindo já registra instantaneamente

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
          console.log(`🎥 Sistema de reconhecimento local pronto (${count} funcionários)!`)
          // Preload do Lottie check para transição instantânea
          fetch("https://lottie.host/8a95b3ad-f30a-4fb9-a55d-4153b3b92810/RPsps2O63O.lottie").catch(() => {})

          // Se por ventura o Supabase estava acordando no momento do boot e retornou 0, tenta novamente a cada 3.5s
          if (count === 0) {
            const retryId = setInterval(async () => {
              if (!mounted) {
                clearInterval(retryId)
                return
              }
              try {
                const c = await loadDescriptors()
                if (c > 0) {
                  console.log(`✅ ${c} funcionário(s) carregado(s) com sucesso pelo retry automático!`)
                  clearInterval(retryId)
                }
              } catch (_) {}
            }, 3500)
          }
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

        isProcessingRef.current = true
        try {
          // Reconhecimento contínuo e detecção de sorriso em 1 único passe no Web Worker
          const result = await recognizeFace(video, 0.40)
          if (result) {
            // Se o rosto detectado for desconhecido / não cadastrado (ex: Dra. Ana):
            if (result.isUnknown || result.id === "unknown") {
              if (recognizedPersonRef.current) {
                console.log("⚠️ Rosto não cadastrado na câmera — limpando identificação anterior")
                setRecognizedPerson(null)
              }
              lastFaceSeenRef.current = Date.now()
              return
            }

            // Rosto válido de funcionário cadastrado!
            lastFaceSeenRef.current = Date.now()

            const isDifferentPerson = !current || current.id !== result.id
            const isSmiling = result.isSmiling
            const smileFrames = isSmiling ? (isDifferentPerson ? 1 : current.smileFrames + 1) : 0

            const updated: RecognizedPerson = {
              id: result.id,
              nome: result.nome,
              similarity: result.similarity,
              isSmiling,
              smileFrames,
              registroCompleto: false,
            }

            // Atualiza imediatamente se mudou de pessoa ou se mudou o estado de sorriso
            if (isDifferentPerson || current.isSmiling !== isSmiling) {
              if (isDifferentPerson) {
                pendingTipoRef.current = null
                pendingTipoPromiseRef.current = null
                console.log(`✅ Funcionário identificado: ${result.nome} (${result.similarity.toFixed(0)}%)`)
              }
              setRecognizedPerson(updated)
            }

            // Registra ponto instantaneamente no 1º frame com sorriso da pessoa identificada
            if (isSmiling && smileFrames >= SMILE_FRAMES_REQUIRED) {
              await handleRegistro(updated)
            }
          } else {
            // Se nenhum rosto for detectado na câmera por mais de 600ms, reseta
            if (current && Date.now() - lastFaceSeenRef.current > 600) {
              setRecognizedPerson(null)
            }
          }
        } finally {
          isProcessingRef.current = false
        }
      } catch (e) {
        console.error("Erro no loop de reconhecimento:", e)
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
        if (tl.includes("entrada")) return `Excelente dia, ${primeiroNome}! Tenha um ótimo e produtivo dia de trabalho!`
        if (tl.includes("saída") && tl.includes("almoço")) return `Excelente almoço, ${primeiroNome}! Aproveite seu almoço e bom descanso!`
        if (tl.includes("retorno")) return `Excelente retorno ao trabalho, ${primeiroNome}! Bom trabalho nesta tarde!`
        if (tl.includes("saída") || tl.includes("saida")) return `Excelente noite e bom descanso, ${primeiroNome}! Dever cumprido, até amanhã!`
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

      // Manter a moldura esmeralda pulsante por 750ms para confirmação visual satisfatória antes da transição
      await new Promise((r) => setTimeout(r, 750))

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

      {/* Moldura luminosa esmeralda — Exibida exclusivamente quando a pessoa sorri */}
      {recognizedPerson && recognizedPerson.isSmiling && !recognizedPerson.registroCompleto && !showSuccess && (
        <ViewfinderBorder />
      )}

      {/* Status em Glassmorphism Dourado - Pessoa reconhecida (Oculta ao sorrir) */}
      {recognizedPerson && !recognizedPerson.isSmiling && !recognizedPerson.registroCompleto && !showSuccess && (
        <div className="absolute bottom-0 left-0 right-0 z-30 w-full pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className="py-5 px-6 border-t backdrop-blur-2xl text-center space-y-1 text-white"
            style={{
              background: "linear-gradient(180deg, rgba(198, 158, 107, 0.88) 0%, rgba(166, 124, 78, 0.94) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderColor: "rgba(255, 255, 255, 0.4)",
              boxShadow: "0 -10px 30px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
            }}
          >
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow">
              {recognizedPerson.nome}
            </div>
            <div className="text-sm sm:text-base font-medium text-amber-100/95 tracking-wide drop-shadow-sm">
              Sorria para registrar seu ponto
            </div>
          </div>
        </div>
      )}

      {/* Indicador em Glassmorphism Dourado — Posicione seu rosto na câmera (Sem bolinha) */}
      {!screensaver && !showSuccess && !recognizedPerson && modelsReady && cameraActive && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none animate-in fade-in duration-300">
          <div
            className="py-4 px-6 border-t backdrop-blur-xl text-white text-center"
            style={{
              background: "linear-gradient(180deg, rgba(198, 158, 107, 0.8) 0%, rgba(150, 107, 60, 0.9) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderColor: "rgba(255, 255, 255, 0.35)",
              boxShadow: "0 -8px 25px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
            }}
          >
            <span className="text-sm sm:text-base font-medium tracking-wide text-white drop-shadow-sm">
              Posicione seu rosto na câmera
            </span>
          </div>
        </div>
      )}

      {/* Proteção de tela */}
      {screensaver && <Screensaver onTap={() => { screensaverRef.current = false; setScreensaver(false); resetInactivityTimer() }} />}

      {/* Tela de sucesso de Ponto Registrado (Design Moderno, Dourado & Glassmorphism) */}
      {showSuccess && completedPerson && (
        <div className="absolute inset-0 z-40 bg-white flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
          <style>{`
            @keyframes bounceBadge {
              0% { transform: scale(0.6) rotate(-10deg); opacity: 0; }
              50% { transform: scale(1.1) rotate(3deg); opacity: 1; }
              70% { transform: scale(0.96) rotate(-1deg); }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes pulseRing {
              0%, 100% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.18); opacity: 0.15; }
            }
            .badge-pop { animation: bounceBadge 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
            .ring-pulse { animation: pulseRing 2.4s ease-in-out infinite; }
            .su-card { animation: fadeUp 0.5s ease-out 0.2s both; }
            .su-btn { animation: fadeUp 0.5s ease-out 0.35s both; }
          `}</style>

          {/* Lado Esquerdo - Detalhes do Registro e Informações */}
          <div className="w-full md:w-[58%] h-full flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative bg-gradient-to-b from-white via-amber-50/15 to-white overflow-y-auto">
            {/* Topo: Logo */}
            <div className="flex items-center justify-between">
              <Image src="/logo.png" alt="Logo" width={160} height={80} priority style={{ height: "auto" }} />
              <span className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Ponto Registrado
              </span>
            </div>

            {/* Conteúdo Central */}
            <div className="my-auto max-w-lg mx-auto w-full text-center space-y-6 py-6">
              {/* Ícone Animado de Sucesso */}
              <div className="flex justify-center relative">
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full bg-emerald-400/20 ring-pulse blur-sm" />
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-xl badge-pop">
                    <svg className="w-12 h-12 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  {/* Badge de tipo no canto inferior */}
                  <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-lg">
                    {(() => {
                      const t = (completedPerson.tipo || "").toLowerCase()
                      if (t.includes("entrada")) return "🌤️"
                      if (t.includes("almoço") && (t.includes("saída") || t.includes("saida"))) return "🍽️"
                      if (t.includes("retorno")) return "💼"
                      if (t.includes("saída") || t.includes("saida")) return "🌙"
                      return "⭐"
                    })()}
                  </div>
                </div>
              </div>

              {/* Saudação com Nome em Dourado */}
              <div className="space-y-1.5">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight">
                  <span style={{ color: "#c69e6b" }}>{completedPerson.mensagem}</span>
                </h1>
                <p className="text-sm text-gray-500 font-medium">
                  Autenticação biométrica validada com sucesso
                </p>
              </div>

              {/* Card de Informações do Registro */}
              <div className="su-card rounded-2xl p-5 bg-white border border-gray-100 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.06)] space-y-3.5 text-left">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">Tipo de Batida</span>
                  <span className="font-bold text-sm px-3.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80">
                    {completedPerson.tipo}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block">Horário Registrado</span>
                    <span className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight font-mono">
                      {completedPerson.hora}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block">Data</span>
                    <span className="text-sm font-semibold text-gray-700">
                      {completedPerson.data}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progresso de Retorno Automático */}
              <div className="pt-2">
                <ReturnProgress durationMs={30000} />
              </div>
            </div>

            {/* Rodapé: Botão Voltar */}
            <div className="su-btn flex items-center justify-between pt-4">
              <button
                onClick={resetToInitialState}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all shadow-md hover:shadow-lg active:scale-95"
                style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
              >
                Voltar ao Início
              </button>
              <span className="text-xs text-gray-400">Vitall Ponto Digital</span>
            </div>
          </div>

          {/* Lado Direito - Gradiente Temático com Ilustração e Logo */}
          <div
            className="hidden md:flex md:w-[42%] h-full flex-col items-center justify-center p-10 text-white text-center relative overflow-hidden"
            style={{
              background: (() => {
                const t = (completedPerson.tipo || "").toLowerCase()
                if (t.includes("entrada")) return "linear-gradient(135deg, #c69e6b 0%, #b88d57 50%, #8c5e28 100%)"
                if (t.includes("almoço") && (t.includes("saída") || t.includes("saida"))) return "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #9a3412 100%)"
                if (t.includes("retorno")) return "linear-gradient(135deg, #1db9b3 0%, #16918d 50%, #0d8488 100%)"
                if (t.includes("saída") || t.includes("saida")) return "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
                return "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)"
              })(),
            }}
          >
            {/* Decoração de fundo */}
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-black/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6 max-w-sm">
              <div className="p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl inline-block">
                <Image src="/logo.png" alt="Logo" width={400} height={180} priority style={{ height: "auto" }} />
              </div>
              <p className="text-white/95 text-xl font-light leading-relaxed">
                {(() => {
                  const t = (completedPerson.tipo || "").toLowerCase()
                  if (t.includes("entrada")) return "Tenha um excelente e produtivo dia de trabalho!"
                  if (t.includes("almoço") && (t.includes("saída") || t.includes("saida"))) return "Aproveite seu almoço e tenha um ótimo descanso!"
                  if (t.includes("retorno")) return "Excelente retorno ao trabalho! Vamos em frente!"
                  if (t.includes("saída") || t.includes("saida")) return "Dever cumprido! Descanse bem e até amanhã!"
                  return "Ponto registrado com sucesso!"
                })()}
              </p>
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
