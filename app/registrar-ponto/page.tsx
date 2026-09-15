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
import { registrarPonto, buscarRegistrosHoje, buscarFuncionarioPorId, registrarMultiplosPontos, buscarFuncionarios, aquecerConexaoSupabase } from "@/lib/supabase"
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
import * as telemetria from "@/lib/telemetria-reconhecimento"
import {
  enfileirarPonto,
  removerDaFila,
  contarPendentes,
  iniciarSincronizacaoAutomatica,
} from "@/lib/fila-pontos"
import { OlhosRobo } from "@/components/olhos-robo"
import { agendarLembretesAlmoco, cancelarLembretesAlmoco, sincronizarSessoesAlmocoDoDia, type InfoAlmocoAtivo } from "@/lib/lembretes-almoco"
import "../ponto-registrado/ponto-batido.css"
import {
  initModels,
  loadDescriptors,
  getFuncionariosCarregados,
  recognizeFace,
  detectSmileOnly,
  detectFaceFast,
  getBackend,
  getUltimaCapturaMs,
  definirBackendManual,
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

function Screensaver({
  onTap,
  onSegredo,
  olhar,
}: {
  onTap: () => void
  onSegredo: () => void
  /** Direção em que a pessoa detectada está. null = ninguém à vista. */
  olhar: { x: number; y: number } | null
}) {
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
          {/* Com alguém à vista os olhos seguem a pessoa; sozinhos, voltam a
              vaguear. É a câmera que já roda para o reconhecimento, então isso
              não custa nada de novo. */}
          <OlhosRobo
            largura={215}
            cor="#ffffff"
            olhar={olhar ?? undefined}
            ocioso={!olhar}
            piscar
            piscadinha
          />
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
  /** Passes completos seguidos que não confirmaram quem está na frente. */
  const falhasSeguidasRef = useRef(0)
  /** Já há alguém na frente do tablet durante a proteção de tela. */
  const rostoNaEsperaRef = useRef(false)
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
  // Batidas ainda não gravadas no Supabase (rede fora, servidor lento).
  const [pontosPendentes, setPontosPendentes] = useState(0)
  // Para onde os olhos da proteção de tela estão olhando. null = ninguém à
  // vista, e aí eles voltam a vaguear sozinhos.
  const [olharDaCamera, setOlharDaCamera] = useState<{ x: number; y: number } | null>(null)
  const ultimaDeteccaoOciosaRef = useRef(0)
  /**
   * Quando a rede pesada rodou pela última vez, seja de verdade ou por
   * aquecimento. É daqui que sai tanto o aquecimento da espera quanto o
   * `ms_ocioso_antes` da telemetria — o número que finalmente diz se "parado há
   * muito tempo" é mesmo o que deixa a batida lenta.
   */
  const ultimoPassePesadoRef = useRef(0)
  /**
   * Quem foi confirmado por um passe completo de verdade, e quando.
   *
   * Diferente de `ultimaVerificacaoIdentidadeRef`, que marca QUALQUER passe
   * completo: aqui só entra passe que bateu com alguém cadastrado. É o que
   * permite gravar o ponto no sorriso sem rodar um segundo passe idêntico —
   * sem abrir mão da regra de que todo ponto exige um passe completo que
   * bateu de verdade.
   */
  const ultimaConfirmacaoRef = useRef<{ id: string; em: number } | null>(null)
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
  // A câmera frontal NÃO está espelhada no vídeo: quem está à esquerda de quem
  // olha o tablet aparece à direita do frame. Por isso o eixo X é invertido
  // para os olhos acompanharem a pessoa, e não o espelho dela. Se no tablet o
  // olhar sair ao contrário, é só trocar este sinal.
  const INVERTER_OLHAR_X = true
  // De quanto em quanto tempo procurar um rosto enquanto a tela está em espera.
  const INTERVALO_DETECCAO_OCIOSA_MS = 180
  /**
   * De quanto em quanto tempo rodar um passe COMPLETO de mentira enquanto
   * ninguém está na frente do tablet.
   *
   * O motivo é a queixa mais concreta que temos: duas batidas seguidas são
   * instantâneas, mas a primeira depois de três horas parada demora. A espera
   * só exercitava o detector barato (192x144, entrada 96). A rede de descritor
   * — que é o que custa caro — ficava horas sem rodar, e o Android trata isso
   * como deve tratar: baixa o clock da GPU e despeja da memória o que não está
   * sendo usado. Quando alguém enfim chega, o primeiro passe paga tudo isso de
   * volta.
   *
   * Então mantemos a rede pesada acordada de tempos em tempos. O resultado é
   * jogado fora de propósito: o que importa é o caminho ter passado pela GPU.
   * Só roda quando NÃO há ninguém no quadro — se alguém chegou, quem manda é a
   * batida de verdade, nunca o aquecimento.
   */
  const INTERVALO_AQUECIMENTO_PESADO_MS = 25 * 1000
  /**
   * Faixa de horas em que vale a pena manter a rede pesada acordada.
   *
   * Aquecer as três da manhã não serve a ninguém: não há batida, e o custo
   * (GPU acordando de 25 em 25 segundos) corre igual. Limitando ao expediente
   * — com folga generosa nas pontas, porque gente chega cedo e sai tarde —
   * sobra cerca de um terço do trabalho de aquecimento, sem que uma única
   * batida real fique fria.
   */
  const HORA_INICIO_AQUECIMENTO = 6
  const HORA_FIM_AQUECIMENTO = 22
  /**
   * Quantos passes completos seguidos precisam falhar para a identificação cair.
   *
   * Antes era 1: um único frame ruim — a cabeça virando alguns graus, um borrão
   * de movimento, o rosto meio fora do quadro — apagava quem estava
   * identificado. Era isso que fazia a moldura esmeralda acender, escrever
   * "Registrando" e sumir: o passe barato via o sorriso e acendia o verde, e no
   * mesmo ciclo o passe completo errava o rosto e zerava tudo.
   *
   * Três é o suficiente para atravessar um tropeço e baixo o bastante para a
   * troca de pessoa na frente da câmera continuar rápida (~3 passes completos).
   */
  const FALHAS_PARA_PERDER_IDENTIDADE = 3
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

  /**
   * Troca quem está identificado, escrevendo no ref NO MESMO INSTANTE.
   *
   * O efeito acima só roda depois que o React confirma a renderização. Isso
   * era invisível enquanto um passe completo custava 4 s: sobrava tempo de
   * sobra para a tela atualizar entre um passe e o outro.
   *
   * Com o passe em 184 ms, deixou de sobrar. O laço volta antes do React
   * confirmar, lê `recognizedPersonRef.current` ainda nulo, conclui que
   * ninguém foi identificado e roda outro passe completo — repetidamente. A
   * telemetria pegou isso no ato: 19 passes completos e ZERO passes baratos
   * numa batida em que a pessoa já tinha sido reconhecida no primeiro.
   *
   * Ou seja: o ganho de velocidade criou um bug que a lentidão escondia. O
   * ref passa a ser escrito de forma síncrona; o estado continua igual, para
   * a tela.
   */
  const definirPessoa = (p: RecognizedPerson | null) => {
    recognizedPersonRef.current = p
    setRecognizedPerson(p)
  }

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
        // `?backend=wasm` ou `?backend=cpu` força o motor de cálculo, para
        // medir no próprio tablet o que não dá para decidir na teoria: se o
        // WebGL, passando por driver Mali dentro de um WebView, realmente ganha
        // do WASM+SIMD aqui. Sem o parâmetro nada muda — o padrão continua
        // sendo webgl → wasm → cpu.
        const backendPedido = new URLSearchParams(window.location.search).get("backend")
        if (backendPedido === "wasm" || backendPedido === "cpu") {
          definirBackendManual(backendPedido)
        }
        await initModels()
        // Registra o ambiente do tablet uma vez: qual backend o TFJS conseguiu
        // (webgl, wasm ou cpu) e qual GPU. É a primeira coisa que a telemetria
        // precisa responder — a diferença entre webgl e cpu é de ordens de
        // grandeza, e hoje isso é palpite.
        telemetria.iniciarAmbiente(getBackend())

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

  // Fila offline: sobe o que ficou para trás quando a internet volta, quando a
  // aba reaparece e periodicamente.
  useEffect(() => iniciarSincronizacaoAutomatica(setPontosPendentes), [])

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

      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        return
      }

      // === Tela em espera: só o detector barato ===
      // Nada de descritor aqui — apenas "existe um rosto e onde ele está", que
      // é o suficiente para os olhos acompanharem quem se aproxima. De quebra
      // mantém o worker e a GPU aquecidos, que era o único motivo do
      // heartbeat aleatório que existia antes.
      if (screensaverRef.current) {
        if (Date.now() - ultimaDeteccaoOciosaRef.current < INTERVALO_DETECCAO_OCIOSA_MS) return
        ultimaDeteccaoOciosaRef.current = Date.now()

        isProcessingRef.current = true
        try {
          const rosto = await detectFaceFast(video)
          if (!rosto) {
            setOlharDaCamera(null)
            if (rostoNaEsperaRef.current) {
              // Apareceu e foi embora sem bater nada. A telemetria descarta
              // tentativas sem nenhum passe completo, então isso não vira lixo.
              rostoNaEsperaRef.current = false
              telemetria.encerrarTentativa("nao_identificado", modoTesteRef.current)
            }
            // Ninguém à vista: momento certo de manter a rede pesada acordada.
            // Fica aqui dentro, e não antes do detector, porque aquecimento
            // nunca pode atrasar quem chegou — se há rosto no quadro, este
            // trecho sequer é alcançado.
            const hora = new Date().getHours()
            const dentroDoExpediente =
              hora >= HORA_INICIO_AQUECIMENTO && hora < HORA_FIM_AQUECIMENTO
            if (
              dentroDoExpediente &&
              Date.now() - ultimoPassePesadoRef.current > INTERVALO_AQUECIMENTO_PESADO_MS
            ) {
              await recognizeFace(video, SMILE_THRESHOLD)
              ultimoPassePesadoRef.current = Date.now()
            }
            return
          }
          // Alguém apareceu na frente do tablet. Ainda não se sabe quem, mas já
          // dá para abrir a conexão com o banco enquanto a pessoa termina de
          // chegar. É o que tira a lentidão da primeira batida depois de horas
          // parado — as de três em três horas, que são justamente as reais.
          if (!rostoNaEsperaRef.current) {
            rostoNaEsperaRef.current = true
            aquecerConexaoSupabase()
            // O cronômetro da tentativa começa aqui, no instante em que alguém
            // aparece — não quando é identificado. O tempo até identificar é
            // justamente uma das medidas que interessam.
            //
            // E vem ANTES da ociosidade de propósito: a telemetria guarda os
            // valores dentro da tentativa em curso, então qualquer medida
            // enviada antes de `iniciarTentativa` é descartada em silêncio.
            // Foi esse o bug que deixou ms_ocioso_antes vazio nas três
            // primeiras batidas com o código novo — justamente a coluna que
            // diria de quanto em quanto tempo vale a pena aquecer.
            telemetria.iniciarTentativa()
            // Quanto tempo a rede pesada passou sem rodar antes desta pessoa
            // chegar. É a variável que o Arthur descreveu na mão ("duas
            // seguidas é rápido, de três em três horas é lento") virando
            // número, para o próximo ajuste sair de dado e não de palpite.
            telemetria.registrarOciosidade(
              ultimoPassePesadoRef.current === 0
                ? null
                : Date.now() - ultimoPassePesadoRef.current
            )
          }

          // Centro do rosto (0..1) vira direção do olhar (-1..1). O eixo
          // vertical fica mais contido: olhar muito para baixo esconde os olhos
          // atrás da própria pálpebra.
          const x = Math.max(-1, Math.min(1, (rosto.centroX * 2 - 1) * (INVERTER_OLHAR_X ? -1 : 1)))
          const y = Math.max(-1, Math.min(1, (rosto.centroY * 2 - 1) * 0.6))

          // Só re-renderiza quando a pessoa realmente se moveu. Sem isto seriam
          // ~5 renders por segundo da tela inteira por causa de tremidas de
          // um pixel na detecção.
          setOlharDaCamera((atual) =>
            atual && Math.abs(atual.x - x) < 0.07 && Math.abs(atual.y - y) < 0.07
              ? atual
              : { x, y }
          )
        } finally {
          isProcessingRef.current = false
        }
        return
      }

      try {
        const current = recognizedPersonRef.current
        resetInactivityTimer()
        // Idempotente: se a tentativa já começou na proteção de tela, não faz
        // nada. Cobre quem toca no tablet antes de ser detectado.
        telemetria.iniciarTentativa()

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
            const t0 = performance.now()
            const smile = await detectSmileOnly(video, SMILE_THRESHOLD)
            telemetria.registrarPasseBarato(performance.now() - t0)
            telemetria.registrarCaptura(getUltimaCapturaMs())

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
                definirPessoa({ ...current, isSmiling: false, smileFrames: 0 })
              }
              return
            }

            // Sorriu: acende a moldura esmeralda na hora.
            telemetria.registrarSorriso()
            if (!current.isSmiling) {
              definirPessoa({ ...current, isSmiling: true, smileFrames: 1 })
            }

            // === Por que dá para gravar aqui, sem mais um passe completo ===
            //
            // Este ramo só roda quando `identidadeVencida` é falso, ou seja,
            // quando o último passe completo tem menos de
            // RE_VERIFICACAO_IDENTIDADE_MS. Se esse passe confirmou ESTA
            // pessoa, a regra de sempre — "todo ponto exige um passe completo
            // que bateu de verdade" — já está satisfeita por ele.
            //
            // O passe que rodava aqui embaixo perguntava de novo, para a mesma
            // pessoa, dentro da mesma janela que o sistema já trata como
            // confiável. Custava ~925 ms no tablet e não respondia nada novo.
            //
            // A janela de confiança é a MESMA de antes, de propósito: isto
            // remove trabalho repetido, não afrouxa a verificação. Fora da
            // janela, ou se quem foi confirmado for outra pessoa, o passe
            // completo abaixo continua valendo.
            const confirmacao = ultimaConfirmacaoRef.current
            if (
              confirmacao &&
              confirmacao.id === current.id &&
              Date.now() - confirmacao.em <= RE_VERIFICACAO_IDENTIDADE_MS
            ) {
              telemetria.registrarConfirmacao()
              await handleRegistro({ ...current, isSmiling: true, smileFrames: 1 })
              return
            }
          }

          // Reconhecimento completo: identificação + sorriso em 1 passe no Web Worker
          const tCompleto = performance.now()
          const result = await recognizeFace(video, SMILE_THRESHOLD)
          telemetria.registrarPasseCompleto(performance.now() - tCompleto)
          telemetria.registrarCaptura(getUltimaCapturaMs())
          ultimoPassePesadoRef.current = Date.now()
          ultimaVerificacaoIdentidadeRef.current = Date.now()
          if (result) {
            telemetria.registrarComparacao(!result.isUnknown, result.distancia, result.limiar)
            // Rosto detectado, mas não bateu com ninguém cadastrado.
            //
            // Isto NÃO é o mesmo que "chegou outra pessoa": na maior parte das
            // vezes é a mesma pessoa num frame ruim — a cabeça virando, um
            // borrão, o rosto meio cortado. Derrubar a identificação no
            // primeiro tropeço era o que fazia a moldura acender e sumir, e o
            // que obrigava a pessoa a se reapresentar depois de mexer a cabeça.
            //
            // Então a identificação só cai depois de algumas falhas seguidas.
            // Isso não afrouxa nada de segurança: gravar o ponto continua
            // exigindo um passe completo que bateu de verdade, logo abaixo.
            if (result.isUnknown || result.id === "unknown") {
              lastFaceSeenRef.current = Date.now()
              if (recognizedPersonRef.current) {
                falhasSeguidasRef.current += 1
                if (falhasSeguidasRef.current >= FALHAS_PARA_PERDER_IDENTIDADE) {
                  console.log("⚠️ Rosto não confirmado em vários passes — limpando identificação")
                  definirPessoa(null)
                  falhasSeguidasRef.current = 0
                  telemetria.registrarPerdaDeIdentidade()
                }
              }
              return
            }

            // Rosto válido de funcionário cadastrado!
            lastFaceSeenRef.current = Date.now()
            falhasSeguidasRef.current = 0
            ultimaConfirmacaoRef.current = { id: result.id, em: Date.now() }

            const isDifferentPerson = !current || current.id !== result.id
            const isSmiling = result.isSmiling
            // O sorriso também precisa ser cronometrado quando quem o vê é o
            // passe completo. Sem isto, toda batida que não passa pelo ramo
            // barato grava ms_ate_sorrir e ms_sorriso_ate_confirmar em branco
            // — foi o que aconteceu nas três primeiras batidas com o código
            // novo, e é justamente a etapa que falta medir.
            if (isSmiling) telemetria.registrarSorriso()
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
              telemetria.registrarIdentificacao(result.id)
              definirPessoa(updated)
            }

            // Adianta a consulta dos registros do dia enquanto a pessoa sorri.
            prefetchRegistrosDoDia(result.id)

            // Registra ponto instantaneamente no 1º frame com sorriso da pessoa identificada
            if (isSmiling && smileFrames >= SMILE_FRAMES_REQUIRED) {
              telemetria.registrarConfirmacao()
              await handleRegistro(updated)
            }
          } else {
            // Nenhum rosto no frame. Mesma lógica de antes: uma falha isolada
            // não derruba ninguém. 600ms era curto demais — quem se inclina
            // para ler a tela some do quadro por mais tempo que isso.
            if (current) {
              falhasSeguidasRef.current += 1
              const sumiuDeVerdade =
                falhasSeguidasRef.current >= FALHAS_PARA_PERDER_IDENTIDADE &&
                Date.now() - lastFaceSeenRef.current > 1500
              if (sumiuDeVerdade) {
                definirPessoa(null)
                falhasSeguidasRef.current = 0
              }
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
  /**
   * Grava o ponto depois que a tela de sucesso já está na frente da pessoa.
   *
   * A batida entra ANTES numa fila persistente. Se a rede falhar, ela fica lá e
   * sobe sozinha quando a internet voltar — carimbada com o horário real, não
   * com o do envio. Por isso não existe mais a tela de "não foi possível
   * salvar": o ponto não se perde, só atrasa.
   */
  const gravarPontoEmSegundoPlano = async (
    person: RecognizedPerson,
    tipo: string,
    localizacao: CoordenadasLocalizacao | null,
    registrosHoje: RegistroPonto[],
    dataHoraIso: string
  ) => {
    const idNaFila = enfileirarPonto({
      funcionarioId: person.id,
      nomeFuncionario: person.nome,
      tipo,
      dataHoraIso,
      localizacao,
    })
    setPontosPendentes(contarPendentes())

    // Prazo curto: a rede pode pendurar a promise para sempre, e quem está na
    // frente do tablet não pode ficar esperando por isso.
    const comPrazo = <T,>(promessa: Promise<T>, ms: number) =>
      Promise.race([
        promessa,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Tempo esgotado ao salvar o ponto")), ms)
        ),
      ])

    try {
      await comPrazo(
        registrarPonto(person.id, person.nome, tipo, localizacao, registrosHoje, dataHoraIso),
        5000
      )
      removerDaFila(idNaFila)
      prefetchRegistrosRef.current = null // os registros do dia mudaram
    } catch (erro) {
      // Fica na fila. A sincronização automática cuida do resto.
      console.warn("Ponto foi para a fila offline, será gravado assim que der:", erro)
      prefetchRegistrosRef.current = null
    } finally {
      setPontosPendentes(contarPendentes())
    }
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
      const tRegistros = performance.now()
      const registrosHoje =
        prefetch && prefetch.id === person.id
          ? await prefetch.promise
          : await buscarRegistrosHoje(person.id).catch(() => [] as RegistroPonto[])
      telemetria.registrarConsultaRegistros(performance.now() - tRegistros)

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
      const tSaudacao = performance.now()
      const saudacaoIa: RespostaSaudacao =
        prefetchSaudacaoRef.current?.chave === chaveSaudacao
          ? await prefetchSaudacaoRef.current.promise
          : gerarSaudacaoLocalDoDia({
              nome: person.nome,
              tipoPonto: tipo,
              dataHora: now,
              trabalhaSabado,
            })

      telemetria.registrarSaudacaoIa(performance.now() - tSaudacao)

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

      // Fecha a medição no mesmo instante em que a pessoa vê a tela pronta.
      // Disparado e esquecido: não segura nada.
      telemetria.registrarTelaSucesso(tipo)
      telemetria.encerrarTentativa("ponto_batido", modoTesteRef.current)

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
          modoTesteRef.current ? [] : registrosHoje,
          now.toISOString()
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
      telemetria.encerrarTentativa("desistiu", modoTesteRef.current)
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
    // Se ainda havia medição aberta aqui, a tentativa não virou ponto: ou a
    // pessoa desistiu, ou o diálogo de regularização foi cancelado. Interessa
    // saber quantas vezes isso acontece.
    telemetria.encerrarTentativa("desistiu", modoTesteRef.current)
    isRegisteringRef.current = false
    falhasSeguidasRef.current = 0
    rostoNaEsperaRef.current = false
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
          olhar={olharDaCamera}
          onTap={() => {
            screensaverRef.current = false
            setScreensaver(false)
            // Marca a fronteira entre o tempo da pessoa e o tempo do tablet.
            telemetria.registrarToque()
            resetInactivityTimer()
          }}
          onSegredo={() => setModoTeste(true)}
        />
      )}

      {/* Tela de sucesso de Ponto Registrado — Zero Scroll, Animação do Centro para Direita & Dourado */}
      {showSuccess && recognizedPerson && (
        <TelaPontoSucesso
          funcionarioId={recognizedPerson.id}
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

      {/* Batidas na fila esperando internet. Discreto de propósito: é informação
          para quem cuida do tablet, não um alarme para quem bate o ponto. */}
      {pontosPendentes > 0 && (
        <div className="fixed top-3 left-1/2 z-[55] -translate-x-1/2 rounded-full border border-amber-300/40 bg-amber-950/70 px-3 py-1 text-[11px] font-medium text-amber-100 shadow-lg backdrop-blur-md">
          {pontosPendentes === 1
            ? "1 batida aguardando internet"
            : `${pontosPendentes} batidas aguardando internet`}
        </div>
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
