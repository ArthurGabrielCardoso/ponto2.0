"use client"

import {
  iniciarRastreamentoLocalizacao,
  pararRastreamentoLocalizacao,
  obterLocalizacaoEmCache,
} from "@/lib/geolocation"

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
import type { Funcionario, RegistroPonto } from "@/lib/types"
import type { CoordenadasLocalizacao } from "@/lib/geolocation"
import { analisarSituacaoPonto, type DiagnosticoPonto } from "@/lib/logica-ponto-inteligente"
import { DialogoPontoInteligente, type PontoRegularizacao } from "@/components/dialogo-ponto-inteligente"
import { TelaPontoSucesso } from "@/components/tela-ponto-sucesso"
import { ModalCheckinHumor } from "@/components/modal-checkin-humor"
import { OndaOrganicaDourada } from "@/components/onda-organica-dourada"
import { reproduzirVozSaudacao } from "@/lib/tts-audio"
import {
  obterSaudacaoInteligente,
  gerarSaudacaoLocalDoDia,
  type RespostaSaudacao,
} from "@/lib/ia-saudacao"
import { aquecerContextoDia } from "@/lib/contexto-dia-cliente"
import { OlhosRobo } from "@/components/olhos-robo"
import { agendarLembretesAlmoco, cancelarLembretesAlmoco, sincronizarSessoesAlmocoDoDia, type InfoAlmocoAtivo } from "@/lib/lembretes-almoco"
import "../ponto-registrado/ponto-batido.css"
import {
  initModels,
  loadDescriptors,
  getFuncionariosCarregados,
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

function Screensaver({ onTap, onSegredo }: { onTap: () => void; onSegredo: () => void }) {
  // Gesto escondido: 10 toques no canto inferior direito abrem o modo teste.
  // Fica no canto e exige repetição justamente para ninguém cair nele sem querer.
  const toquesRef = useRef(0)
  const prazoRef = useRef<number | null>(null)
  const [toquesVisiveis, setToquesVisiveis] = useState(0)

  const tocarCanto = () => {
    toquesRef.current += 1
    setToquesVisiveis(toquesRef.current)

    if (prazoRef.current) clearTimeout(prazoRef.current)
    // A sequência precisa ser contínua: parou, zera.
    prazoRef.current = window.setTimeout(() => {
      toquesRef.current = 0
      setToquesVisiveis(0)
    }, 2500)

    if (toquesRef.current >= 10) {
      if (prazoRef.current) clearTimeout(prazoRef.current)
      toquesRef.current = 0
      setToquesVisiveis(0)
      onSegredo()
    }
  }

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

      {/* Centro: Olhos da IA + Saudação com Nome Rotativo a cada 5s + Instrução de Toque */}
      <div className="text-center text-white px-6 ss-fade">
        {/* Os olhos ficam aqui e em nenhum outro lugar da espera: é o que faz o
            tablet parado parecer acordado e convidar a pessoa a chegar. */}
        <div className="mb-6 flex justify-center sm:mb-8">
          <OlhosRobo largura={215} cor="#ffffff" ocioso piscar />
        </div>

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

      {/* Canto inferior direito: área invisível do gesto do modo teste.
          stopPropagation é obrigatório — sem ele o toque também dispensaria a
          proteção de tela e a contagem nunca chegaria a 10. */}
      <div
        className="absolute bottom-0 right-0 z-50 h-24 w-24 cursor-default"
        onClick={(e) => {
          e.stopPropagation()
          tocarCanto()
        }}
      >
        {toquesVisiveis >= 3 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-white/70">
            {toquesVisiveis}/10
          </span>
        )}
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
  falaVoz?: string
}

/** Tipos de batida, na ordem do expediente. Usado pelo ciclo do modo teste. */
const CICLO_TIPOS_TESTE = ["Entrada", "Saída Almoço", "Retorno Almoço", "Saída"] as const

interface TelaRegistrarPontoProps {
  /**
   * Modo teste: mesma tela, mesmo reconhecimento, mesma IA — só que sem as
   * travas que existem para proteger o ponto real (cooldown de 60s, limite de
   * 4 batidas por dia e o diálogo de regularização). Serve para bater ponto à
   * vontade enquanto se ajusta a experiência.
   */
  modoTeste?: boolean
}

export function TelaRegistrarPonto({ modoTeste: modoTesteInicial = false }: TelaRegistrarPontoProps) {
  const router = useRouter()
  // Ligado pelo gesto na proteção de tela. O ref existe porque o loop de
  // reconhecimento é criado uma vez e enxergaria o valor da primeira render.
  const [modoTeste, setModoTeste] = useState(modoTesteInicial)
  const modoTesteRef = useRef(modoTesteInicial)
  useEffect(() => {
    modoTesteRef.current = modoTeste
  }, [modoTeste])
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
  const [mostrarCheckinHumor, setMostrarCheckinHumor] = useState(false)
  const [humorSelecionado, setHumorSelecionado] = useState<string | null>(null)
  const lastFaceSeenRef = useRef<number>(0)
  const isRegisteringRef = useRef(false)
  const isProcessingRef = useRef(false)
  const pendingTipoRef = useRef<string | null>(null)
  const pendingTipoPromiseRef = useRef<Promise<string> | null>(null)

  // Grade de horários de cada funcionário, já em memória desde o boot: evita ir ao
  // banco buscar o funcionário na hora de bater o ponto.
  const funcionariosMapRef = useRef<Map<string, Funcionario>>(new Map())
  // Registros do dia buscados assim que a pessoa é identificada — enquanto ela lê
  // "Sorria para registrar", a consulta já está a caminho.
  const prefetchRegistrosRef = useRef<{
    id: string
    ts: number
    promise: Promise<RegistroPonto[]>
  } | null>(null)
  const ultimaVerificacaoIdentidadeRef = useRef(0)
  // Saudação da IA já pedida durante os segundos em que a pessoa sorri, para
  // não gastar o tempo dela esperando a rede depois do sorriso.
  const prefetchSaudacaoRef = useRef<{
    chave: string
    promise: Promise<RespostaSaudacao>
  } | null>(null)

  // === Controles do modo teste ===
  // O loop de reconhecimento é criado uma vez só, então handleRegistro enxerga
  // o estado da primeira renderização. Por isso cada controle tem um ref espelho:
  // o estado desenha a barra, o ref é o que o fluxo da batida lê.
  const [tipoTeste, setTipoTeste] = useState<string>("auto")
  const [gravarNoBanco, setGravarNoBanco] = useState(false)
  const [forcarHumor, setForcarHumor] = useState(false)
  const [batidasTeste, setBatidasTeste] = useState(0)
  const [barraAberta, setBarraAberta] = useState(true)
  const tipoTesteRef = useRef("auto")
  const gravarNoBancoRef = useRef(false)
  const forcarHumorRef = useRef(false)
  const cicloTesteRef = useRef(0)

  useEffect(() => {
    tipoTesteRef.current = tipoTeste
  }, [tipoTeste])
  useEffect(() => {
    gravarNoBancoRef.current = gravarNoBanco
  }, [gravarNoBanco])
  useEffect(() => {
    forcarHumorRef.current = forcarHumor
  }, [forcarHumor])

  /** Próximo tipo do modo teste, sem consumir o ciclo. */
  const espiarTipoTeste = () =>
    tipoTesteRef.current !== "auto"
      ? tipoTesteRef.current
      : CICLO_TIPOS_TESTE[cicloTesteRef.current % CICLO_TIPOS_TESTE.length]

  /** Próximo tipo do modo teste, avançando o ciclo. */
  const consumirTipoTeste = () => {
    const tipo = espiarTipoTeste()
    if (tipoTesteRef.current === "auto") cicloTesteRef.current += 1
    setBatidasTeste((n) => n + 1)
    return tipo
  }

  const SMILE_FRAMES_REQUIRED = 1 // 1 frame sorrindo já registra instantaneamente
  const SMILE_THRESHOLD = 0.40
  // De quanto em quanto tempo a identidade é reconferida com o passe completo.
  // É esta janela que pega a troca de pessoa na frente da câmera.
  const RE_VERIFICACAO_IDENTIDADE_MS = 800
  // Confirmação visual da moldura esmeralda antes de trocar de tela.
  const PULSO_CONFIRMACAO_MS = 220
  const COOLDOWN_MS = 60 * 1000
  // Com que frequência a tela de humor aparece na entrada (fora de cooldown).
  const CHANCE_CHECKIN_HUMOR = 0.55

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
      // 0. Rastreamento de localização em segundo plano.
      // Assim o fix de GPS já está em memória quando alguém bater o ponto, em vez
      // de ser pedido na hora (era o que travava a tela por vários segundos).
      iniciarRastreamentoLocalizacao()

      // Clima de Mogi das Cruzes e feriados por perto, para a IA ter o que
      // comentar. Fica em cache no cliente e é revalidado de meia em meia hora,
      // então nunca é buscado na hora da batida.
      aquecerContextoDia()

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
          // Mesma lista que alimentou os descritores — traz a grade de horários de
          // cada um, que é tudo que o diagnóstico do ponto precisa.
          funcionariosMapRef.current = new Map(
            getFuncionariosCarregados().map((f) => [f.id, f])
          )
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
                  funcionariosMapRef.current = new Map(
                    getFuncionariosCarregados().map((f) => [f.id, f])
                  )
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
      pararRastreamentoLocalizacao()
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((t) => t.stop())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Revalidar o contexto do dia (clima muda, e à meia-noite o feriado também)
  useEffect(() => {
    const id = setInterval(aquecerContextoDia, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Iniciar loop de reconhecimento quando tudo estiver pronto
  useEffect(() => {
    if (modelsReady && cameraActive && !rafRef.current) {
      startLoop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsReady, cameraActive])

  // Dispara a busca dos registros do dia assim que a pessoa é identificada.
  // A batida acontece 1-2s depois (o tempo de ela sorrir), então a consulta chega
  // pronta e some do caminho crítico.
  const prefetchRegistrosDoDia = (funcionarioId: string) => {
    const atual = prefetchRegistrosRef.current
    if (atual && atual.id === funcionarioId && Date.now() - atual.ts < 20000) return
    const promise = buscarRegistrosHoje(funcionarioId).catch(() => [] as RegistroPonto[])
    prefetchRegistrosRef.current = { id: funcionarioId, ts: Date.now(), promise }

    // Assim que os registros chegam já dá para saber qual será a batida, e com
    // isso pedir a saudação da IA adiantado. Ela leva até 1,8s; pedir só depois
    // do sorriso jogaria essa espera inteira na cara da pessoa.
    if (modoTesteRef.current) {
      // No teste o tipo não depende do banco: dá para pedir a saudação já.
      const func = funcionariosMapRef.current.get(funcionarioId)
      if (func) prefetchSaudacao(func, espiarTipoTeste())
      return
    }

    promise
      .then((registros) => {
        const func = funcionariosMapRef.current.get(funcionarioId)
        if (!func) return
        const diag = analisarSituacaoPonto(func, registros, new Date())
        if (diag.tipo !== "DIRETO") return
        prefetchSaudacao(func, diag.proximoTipoSugerido)
      })
      .catch(() => {})
  }

  /**
   * Pede a saudação da IA antes da hora. Guardada por pessoa + tipo de batida,
   * porque é isso que define o texto.
   */
  const prefetchSaudacao = (func: Funcionario, tipo: string) => {
    const chave = `${func.id}|${tipo}`
    if (prefetchSaudacaoRef.current?.chave === chave) return

    prefetchSaudacaoRef.current = {
      chave,
      promise: obterSaudacaoInteligente({
        nome: func.nome,
        tipoPonto: tipo,
        dataHora: new Date(),
        trabalhaSabado: !!func.horarios?.sabado?.ativo,
      }).catch(() =>
        gerarSaudacaoLocalDoDia({ nome: func.nome, tipoPonto: tipo, dataHora: new Date() })
      ),
    }
  }

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
          // === Duas velocidades ===
          // O passe completo (detector + landmarks + descritor 128D + expressões)
          // é caro: a rede de descritor sozinha domina o custo do frame. Rodá-lo em
          // TODO frame, como estava, fazia a espera pelo sorriso ficar lenta no
          // tablet — o sorriso só era amostrado a cada passe completo.
          //
          // Agora, quem já está identificado é acompanhado por um passe barato
          // (detector + expressões). O passe completo volta a rodar só quando:
          //   - ninguém está identificado ainda;
          //   - passaram RE_VERIFICACAO_IDENTIDADE_MS desde a última conferência
          //     (é isto que pega a troca de pessoa na frente da câmera);
          //   - alguém sorriu — a identidade é confirmada antes de gravar o ponto.
          const identidadeVencida =
            Date.now() - ultimaVerificacaoIdentidadeRef.current > RE_VERIFICACAO_IDENTIDADE_MS

          if (current && !identidadeVencida) {
            const smile = await detectSmileOnly(video, SMILE_THRESHOLD)

            if (!smile) {
              // O passe barato detecta em resolução menor que o completo, então ele
              // erra o rosto com mais facilidade. Quem limpa a identificação é
              // sempre o passe completo — aqui só forçamos que ele rode já no
              // próximo frame, para não piscar o nome de quem continua na frente.
              ultimaVerificacaoIdentidadeRef.current = 0
              return
            }

            lastFaceSeenRef.current = Date.now()

            if (!smile.isSmiling) {
              if (current.isSmiling) {
                setRecognizedPerson({ ...current, isSmiling: false, smileFrames: 0 })
              }
              return
            }

            // Sorriu: acende a moldura esmeralda na hora e confirma a identidade no
            // passe completo abaixo antes de gravar qualquer coisa.
            if (!current.isSmiling) {
              setRecognizedPerson({ ...current, isSmiling: true, smileFrames: 1 })
            }
          }

          // Reconhecimento completo: identificação + sorriso em 1 passe no Web Worker
          const result = await recognizeFace(video, SMILE_THRESHOLD)
          ultimaVerificacaoIdentidadeRef.current = Date.now()
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

            // Adianta a consulta dos registros do dia enquanto a pessoa sorri.
            prefetchRegistrosDoDia(result.id)

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

  // Grava o ponto no Supabase depois que a tela de sucesso já está na frente da
  // pessoa. Se falhar de vez, a tela vira aviso: ninguém pode sair achando que
  // bateu o ponto quando o registro não foi salvo.
  const gravarPontoEmSegundoPlano = async (
    person: RecognizedPerson,
    tipo: string,
    localizacao: CoordenadasLocalizacao | null,
    registrosHoje: RegistroPonto[]
  ) => {
    // Cada tentativa tem prazo próprio: a rede pode pendurar a promise para sempre,
    // e o aviso de falha precisa caber na janela em que a tela de sucesso ainda
    // está no ar (15s), senão ninguém vê.
    const comPrazo = <T,>(promessa: Promise<T>, ms: number) =>
      Promise.race([
        promessa,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Tempo esgotado ao salvar o ponto")), ms)
        ),
      ])

    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        await comPrazo(
          registrarPonto(person.id, person.nome, tipo, localizacao, registrosHoje),
          5000
        )
        prefetchRegistrosRef.current = null // os registros do dia mudaram
        return
      } catch (erro) {
        console.error(`Erro ao gravar ponto (tentativa ${tentativa}/2):`, erro)
        if (tentativa === 1) await new Promise((r) => setTimeout(r, 800))
      }
    }

    prefetchRegistrosRef.current = null
    console.error(`❌ PONTO NÃO SALVO: ${person.nome} (${tipo})`)

    // Se a tela já passou para outra pessoa, trocar o conteúdo agora só confundiria
    // quem está na frente do tablet.
    if (!showSuccessRef.current || recognizedPersonRef.current?.id !== person.id) return

    const agora = new Date()
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    setRecognizedPerson({
      ...person,
      registroCompleto: true,
      tipo: "Aviso",
      hora: agora.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      data: agora.toLocaleDateString(),
      mensagem: "Não foi possível salvar seu ponto. Tente novamente.",
    })
    setShowSuccess(true)
    successTimeoutRef.current = window.setTimeout(() => {
      resetToInitialState()
    }, 8000)
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
      // Funcionário: já está em memória desde o boot — a grade de horários é tudo
      // que o diagnóstico usa. Só vai ao banco se for alguém cadastrado depois.
      const funcObj: Funcionario =
        funcionariosMapRef.current.get(person.id) ||
        (await buscarFuncionarioPorId(person.id).catch(() => null)) || {
          id: person.id,
          nome: person.nome,
          descritores: [],
        }

      // Registros do dia: normalmente já resolvidos pelo prefetch disparado na
      // identificação, então este await volta na hora.
      const prefetch = prefetchRegistrosRef.current
      const registrosHoje =
        prefetch && prefetch.id === person.id
          ? await prefetch.promise
          : await buscarRegistrosHoje(person.id).catch(() => [] as RegistroPonto[])

      let tipo: string
      let emCooldown = false

      if (modoTesteRef.current) {
        // Modo teste: nenhuma das três travas do ponto real se aplica — nem o
        // cooldown de 60s, nem o teto de 4 batidas no dia, nem o diálogo de
        // regularização. O tipo vem do seletor da barra ou do ciclo
        // Entrada → Saída Almoço → Retorno → Saída, que repete sem fim.
        tipo = consumirTipoTeste()
      } else {
        // Analisar situação inteligente com base na grade
        const diag = analisarSituacaoPonto(funcObj, registrosHoje, now)

        if (diag.tipo !== "DIRETO") {
          // Exibir diálogo inteligente amigável
          setDialogoInteligente({ diagnostico: diag, person })
          return
        }

        // === Fluxo Direto ===
        // Tudo que define a tela de sucesso é resolvido aqui, em memória: o tipo
        // vem do diagnóstico e o cooldown de 60s sai do último registro do dia —
        // as mesmas duas regras que o registrarPonto aplica. Assim a tela entra
        // na hora e a gravação no Supabase corre em segundo plano, em vez de a
        // pessoa ficar olhando a moldura esmeralda esperando a rede.
        const ultimoRegistro =
          registrosHoje.length > 0 ? registrosHoje[registrosHoje.length - 1] : null
        const msDesdeUltimo = ultimoRegistro
          ? Math.abs(now.getTime() - new Date(ultimoRegistro.data_hora).getTime())
          : Number.POSITIVE_INFINITY
        emCooldown = msDesdeUltimo < COOLDOWN_MS
        tipo = emCooldown ? ultimoRegistro?.tipo || "Entrada" : diag.proximoTipoSugerido
      }

      // Saudação da IA: normalmente já foi pedida quando a pessoa foi
      // identificada, então este await volta na hora. Sem prefetch — troca de
      // tipo, cooldown, primeira batida da sessão — usamos o catálogo local,
      // que é síncrono. A IA nunca segura a tela.
      const trabalhaSabado = !!funcObj.horarios?.sabado?.ativo
      const chaveSaudacao = `${person.id}|${tipo}`
      const saudacaoIa: RespostaSaudacao =
        prefetchSaudacaoRef.current?.chave === chaveSaudacao
          ? await prefetchSaudacaoRef.current.promise
          : gerarSaudacaoLocalDoDia({
              nome: person.nome,
              tipoPonto: tipo,
              dataHora: now,
              trabalhaSabado,
            })

      const mensagemVisual = emCooldown
        ? `Olá, ${primeiroNome}! Seu ponto (${tipo}) já foi registrado recentemente.`
        : saudacaoIa.visual

      const mensagemVoz = emCooldown
        ? `Olá, ${primeiroNome}! Seu ponto (${tipo}) já foi registrado recentemente.`
        : saudacaoIa.voz

      // Ativar check-in de humor ocasional (ex: ~35% das vezes na entrada sem cooldown)
      const ehEntrada = tipo.toLowerCase().includes("entrada")
      if (modoTesteRef.current && forcarHumorRef.current) {
        setMostrarCheckinHumor(true)
      } else if (ehEntrada && !emCooldown) {
        setMostrarCheckinHumor(Math.random() < CHANCE_CHECKIN_HUMOR)
      } else {
        setMostrarCheckinHumor(false)
      }

      const completed: RecognizedPerson = {
        ...person,
        registroCompleto: true,
        tipo,
        hora: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        data: now.toLocaleDateString(),
        mensagem: mensagemVisual,
        falaVoz: mensagemVoz,
      }

      // Confirmação visual curta da moldura esmeralda antes da transição
      await new Promise((r) => setTimeout(r, PULSO_CONFIRMACAO_MS))

      setRecognizedPerson(completed)
      setShowSuccess(true)
      reproduzirVozSaudacao(mensagemVoz)

      // A tela já está na frente da pessoa — grava no Supabase em segundo plano.
      // A localização sai do cache do rastreamento, sem esperar fix novo de GPS.
      // No modo teste a gravação é opcional e vem desligada: bater ponto de
      // mentira não pode sujar o registro real de ninguém.
      const deveGravar = modoTesteRef.current ? gravarNoBancoRef.current : !emCooldown
      if (deveGravar) {
        // Com a gravação ligada no teste, os registros do dia vão vazios de
        // propósito: o registrarPonto deriva o cooldown de 60s justamente dessa
        // lista, e passá-la faria a segunda batida seguida ser descartada sem
        // aviso — o oposto do que esta rota promete.
        gravarPontoEmSegundoPlano(
          person,
          tipo,
          obterLocalizacaoEmCache(),
          modoTesteRef.current ? [] : registrosHoje
        )
      }

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

  // Resposta carinhosa por voz quando o usuário seleciona seu humor
  const handleSelecionarHumor = async (humorId: string, label: string) => {
    setHumorSelecionado(humorId)
    if (!recognizedPerson) return

    try {
      const funcionario = await buscarFuncionarioPorId(recognizedPerson.id).catch(() => null)
      const trabalhaSabado = !!funcionario?.horarios?.sabado?.ativo
      const respostaHumor = await obterSaudacaoInteligente({
        nome: recognizedPerson.nome,
        tipoPonto: "Entrada",
        dataHora: new Date(),
        trabalhaSabado,
        humor: humorId,
      })

      if (respostaHumor?.voz) {
        reproduzirVozSaudacao(respostaHumor.voz)
      }
    } catch {}
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
      await registrarMultiplosPontos(person.id, person.nome, pontos, obterLocalizacaoEmCache())

      const funcionario = await buscarFuncionarioPorId(person.id).catch(() => null)
      const funcObj: Funcionario = funcionario || { id: person.id, nome: person.nome, descritores: [] }
      const trabalhaSabado = !!funcObj.horarios?.sabado?.ativo

      const saudacaoIa = await obterSaudacaoInteligente({
        nome: person.nome,
        tipoPonto: tipoExibicao,
        dataHora: now,
        trabalhaSabado,
      })

      const completed: RecognizedPerson = {
        ...person,
        registroCompleto: true,
        tipo: tipoExibicao,
        hora: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        data: now.toLocaleDateString(),
        mensagem: saudacaoIa.visual || mensagemPersonalizada,
        falaVoz: saudacaoIa.voz || mensagemPersonalizada,
      }

      setRecognizedPerson(completed)
      setShowSuccess(true)
      reproduzirVozSaudacao(saudacaoIa.voz || completed.mensagem)

      // Gerenciar lembretes automáticos de almoço por voz na regularização inteligente
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
      setMostrarCheckinHumor(false)
      setHumorSelecionado(null)
    }, 5 * 60 * 1000) // 5 minutos
  }

  // Reset para estado inicial (SEM recarregar a página!)
  const resetToInitialState = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
      successTimeoutRef.current = null
    }
    isRegisteringRef.current = false
    prefetchSaudacaoRef.current = null
    setShowSuccess(false)
    setRecognizedPerson(null)
    setDialogoInteligente(null)
    setMostrarCheckinHumor(false)
    setHumorSelecionado(null)
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

      {/* Status em Glassmorphism Dourado - Pessoa reconhecida (segue visível ao sorrir) */}
      {recognizedPerson && !recognizedPerson.registroCompleto && !showSuccess && (
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
              {recognizedPerson.isSmiling ? "Registrando seu ponto..." : "Sorria para registrar seu ponto"}
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
      {screensaver && (
        <Screensaver
          onTap={() => {
            screensaverRef.current = false
            setScreensaver(false)
            resetInactivityTimer()
          }}
          onSegredo={() => setModoTeste(true)}
        />
      )}

      {/* Tela de sucesso de Ponto Registrado — Zero Scroll, Animação do Centro para Direita & Dourado */}
      {showSuccess && recognizedPerson && (
        <TelaPontoSucesso
          nome={recognizedPerson.nome}
          tipo={recognizedPerson.tipo || "Entrada"}
          hora={recognizedPerson.hora || "08:00:00"}
          data={recognizedPerson.data || new Date().toLocaleDateString()}
          mensagem={recognizedPerson.mensagem || ""}
          falaVoz={recognizedPerson.falaVoz || ""}
          durationMs={30000}
          onVoltar={resetToInitialState}
        />
      )}

      {/* Modal / Tela de Check-in de Humor no Padrão Ponto Batido (Ocasional) */}
      {mostrarCheckinHumor && recognizedPerson && (
        <ModalCheckinHumor
          nome={recognizedPerson.nome}
          onConfirmar={handleSelecionarHumor}
          onFechar={() => setMostrarCheckinHumor(false)}
          duracaoSegundos={120}
        />
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

      {/* Barra de controle do modo teste — fica acima de tudo, inclusive da
          tela de sucesso, para dar para trocar o tipo entre uma batida e outra. */}
      {/* Recolhida: só um ponto discreto, para dar para ver a tela inteira sem
          sair do modo teste. */}
      {modoTeste && !barraAberta && (
        <button
          type="button"
          onClick={() => setBarraAberta(true)}
          aria-label="Abrir controles do modo teste"
          className="fixed top-3 right-3 z-[60] flex h-7 w-7 items-center justify-center rounded-full border border-fuchsia-400/60 bg-slate-950/70 text-[11px] font-bold text-fuchsia-300 shadow-lg backdrop-blur-md"
        >
          T
        </button>
      )}

      {modoTeste && barraAberta && (
        <div className="fixed top-3 right-3 z-[60] w-[248px] rounded-xl border border-fuchsia-400/50 bg-slate-950/85 p-3 text-white shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-md bg-fuchsia-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Modo teste
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/60">{batidasTeste}</span>
              <button
                type="button"
                onClick={() => setBarraAberta(false)}
                aria-label="Recolher controles"
                className="rounded-md border border-white/20 px-1.5 py-0.5 text-[11px] leading-none text-white/70 hover:bg-white/10"
              >
                –
              </button>
            </div>
          </div>

          <p className="mb-2 text-[11px] leading-snug text-white/70">
            Sem cooldown, sem limite de 4 por dia e sem diálogo de regularização.
          </p>

          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/50">
            Tipo da batida
          </label>
          <select
            value={tipoTeste}
            onChange={(e) => setTipoTeste(e.target.value)}
            className="mb-2.5 w-full rounded-md border border-white/20 bg-slate-900 px-2 py-1.5 text-xs text-white outline-none focus:border-fuchsia-400"
          >
            <option value="auto">Ciclo automático</option>
            {CICLO_TIPOS_TESTE.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={forcarHumor}
              onChange={(e) => setForcarHumor(e.target.checked)}
              className="h-3.5 w-3.5 accent-fuchsia-500"
            />
            <span>Sempre mostrar tela de humor</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={gravarNoBanco}
              onChange={(e) => setGravarNoBanco(e.target.checked)}
              className="h-3.5 w-3.5 accent-red-500"
            />
            <span className={gravarNoBanco ? "font-semibold text-red-300" : ""}>
              Gravar no banco de verdade
            </span>
          </label>

          <p
            className={`mt-2 rounded-md px-2 py-1.5 text-[11px] leading-snug ${
              gravarNoBanco
                ? "bg-red-500/20 text-red-200"
                : "bg-emerald-500/15 text-emerald-200"
            }`}
          >
            {gravarNoBanco
              ? "Atenção: as batidas estão indo para o registro real."
              : "Nada é gravado. O ponto real não é afetado."}
          </p>

          <button
            type="button"
            onClick={() => {
              setModoTeste(false)
              setGravarNoBanco(false)
              setForcarHumor(false)
              setBatidasTeste(0)
              cicloTesteRef.current = 0
              setBarraAberta(true)
            }}
            className="mt-2 w-full rounded-md border border-white/20 px-2 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10"
          >
            Sair do modo teste
          </button>
        </div>
      )}
</div>
  )
}

export default function RegistrarPonto() {
  return <TelaRegistrarPonto />
}
