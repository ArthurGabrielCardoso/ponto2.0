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
import {
  obterSaudacaoInteligente,
  gerarSaudacaoLocalDoDia,
  type RespostaSaudacao,
} from "@/lib/ia-saudacao"
import { aquecerContextoDia } from "@/lib/contexto-dia-cliente"
import { prepararSom, tocarConfirmacao, tocarSucesso } from "@/lib/som-ponto"
import { useCssRevelacao, DURACAO_ABERTURA_MS } from "@/components/revelacao-do-centro"
import { reproduzirVozSaudacao, prepararVozSaudacao } from "@/lib/tts-audio"
import * as telemetria from "@/lib/telemetria-reconhecimento"
import {
  enfileirarPonto,
  removerDaFila,
  contarPendentes,
  iniciarSincronizacaoAutomatica,
} from "@/lib/fila-pontos"
import { OlhosRobo } from "@/components/olhos-robo"
import { agendarLembretesAlmoco, cancelarLembretesAlmoco, sincronizarSessoesAlmocoDoDia, type InfoAlmocoAtivo } from "@/lib/lembretes-almoco"
import { ModalQRAlmoco } from "@/components/modal-qr-almoco"
import { BalaoFalaRobo } from "@/components/balao-fala-robo"
import "../ponto-registrado/ponto-batido.css"
import {
  initModels,
  loadDescriptors,
  getFuncionariosCarregados,
  recognizeFace,
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
/**
 * Sinal de "rosto confirmado, gravando".
 *
 * ANTES era uma moldura nos quatro lados piscando a cada 0,45 s. Piscar é o
 * vocabulário de alerta — é o que a tela usa quando algo deu errado. Aqui o
 * que aconteceu foi o oposto: deu certo. E, com o reconhecimento a ~190 ms, a
 * moldura às vezes aparecia e sumia em menos de um ciclo da piscada, o que
 * lia como falha mesmo quando o ponto entrava.
 *
 * AGORA é uma barra só, na borda de cima, que cresce do centro para os dois
 * lados ao mesmo tempo e FICA. O movimento do centro para fora é o mesmo
 * gesto de uma barra de progresso completando: diz "terminou", não "atenção".
 *
 * A emenda com a tela de sucesso não é mais feita aqui: quem faz é a
 * revelação do centro, a mesma transição de rota da VitallCam. Uma cortina
 * esmeralda descendo por cima disso seria movimento demais para o mesmo
 * instante.
 */
function MolduraTopo({ duracaoMs }: { duracaoMs: number }) {
  return (
    <>
      <style>{`
        @keyframes barraDoCentro {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        .barra-topo {
          transform-origin: center;
          /* LINEAR de propósito: esta barra virou medidor de tempo, e curva
             com aceleração mentiria sobre quanto falta. */
          animation: barraDoCentro var(--tempo-sorriso) linear both;
        }
        /* Quem pediu menos movimento no sistema recebe o estado final direto:
           o sinal continua sendo dado, sem a animação. */
        @media (prefers-reduced-motion: reduce) {
          .barra-topo { animation: none; }
        }
      `}</style>

      {/* A barra. Fica acima de tudo para nunca ser coberta pela barra dourada
          de status nem pelo vídeo. */}
      <div
        className="fixed inset-x-0 top-0 z-40 h-[6px] pointer-events-none"
        style={{ ["--tempo-sorriso" as string]: `${duracaoMs}ms` }}
      >
        <div
          className="barra-topo h-full w-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(16,185,129,0) 0%, rgba(52,211,153,1) 18%, rgba(110,231,183,1) 50%, rgba(52,211,153,1) 82%, rgba(16,185,129,0) 100%)",
            boxShadow: "0 0 18px rgba(16,185,129,0.9), 0 0 42px rgba(16,185,129,0.5)",
          }}
        />
      </div>

      {/* Brilho curto logo abaixo da barra: dá espessura ao sinal sem voltar a
          fechar uma moldura em volta da pessoa. */}
      <div
        className="fixed inset-x-0 top-0 z-30 h-24 pointer-events-none barra-topo"
        style={{
          ["--tempo-sorriso" as string]: `${duracaoMs}ms`,
          background:
            "linear-gradient(180deg, rgba(16,185,129,0.34) 0%, rgba(16,185,129,0.10) 45%, rgba(16,185,129,0) 100%)",
        }}
      />

    </>
  )
}

// Componente individual com cronômetro regressivo ao vivo (Design Dourado e horizontal)
function BadgeAlmocoCronometro({
  item,
  onClick,
}: {
  item: InfoAlmocoAtivo
  onClick?: () => void
}) {
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
    <div
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className="flex items-center justify-between gap-3 bg-black/25 hover:bg-black/45 cursor-pointer rounded-md px-3.5 py-2.5 border border-white/25 text-xs shadow-md transition-all active:scale-[0.98]"
    >
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
  onSelecionarAlmoco,
  pessoaNaEspera,
  falaIa,
}: {
  onTap: () => void
  onSegredo: () => void
  /** Direção em que a pessoa detectada está. null = ninguém à vista. */
  olhar: { x: number; y: number } | null
  onSelecionarAlmoco?: (item: InfoAlmocoAtivo) => void
  pessoaNaEspera?: { id: string; nome: string; primeiroNome: string } | null
  falaIa?: string | null
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Canto Superior Esquerdo: Relógio Menor e Discreto (+1px font-size) */}
      <div className="absolute top-5 left-6 sm:top-7 sm:left-8 z-30 pointer-events-none ss-fade">
        <p className="text-[27px] sm:text-[31px] font-light text-white/95 tracking-wider" style={{ fontVariantNumeric: "tabular-nums" }}>
          {time}
        </p>
      </div>

      {/* Centro: Olhos do Robô Ampliados + Balão de Fala Inteligente */}
      <div className="text-center text-white px-4 ss-fade w-full max-w-xl flex flex-col items-center">
        {/* Rosto do robô com presença ampliada e vidro nobre */}
        <div className="flex justify-center -mt-2 sm:-mt-4 mb-4">
          <div
            className="rounded-[2.5rem] px-8 py-5 sm:px-11 sm:py-6"
            style={{
              background: "rgba(3, 32, 38, 0.45)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.14), 0 16px 40px -12px rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.14)",
            }}
          >
            <OlhosRobo
              largura={255}
              cor="#ffffff"
              olhar={olhar ?? { x: 0, y: 0 }}
              ocioso={false}
              piscar
            />
          </div>
        </div>

        {/* Balão de Fala Dinâmico com IA Llama, Lembretes e Identificação */}
        <BalaoFalaRobo
          pessoaNaEspera={pessoaNaEspera ?? null}
          falaIa={falaIa}
        />
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
            // O card de almoço engole o clique para não abrir a película por
            // baixo dele, mas quem toca aqui também quer bater ponto — então o
            // toque segue adiante, com o mesmo evento, para o círculo abrir no
            // lugar certo.
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
                  <BadgeAlmocoCronometro
                    item={f}
                    onClick={() => onSelecionarAlmoco?.(f)}
                  />
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
  /**
   * Quando o sorriso contínuo começou. `null` = não está sorrindo agora.
   *
   * Zera em qualquer passe que não veja sorriso — é isso que faz "contínuo"
   * significar contínuo, e não "sorriu 1,5 s somados ao longo de um minuto".
   */
  const sorrindoDesdeRef = useRef<number | null>(null)
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
  // Saudação da IA já pedida durante os segundos em que a pessoa sorri, para
  // não gastar o tempo dela esperando a rede depois do sorriso.
  const prefetchSaudacaoRef = useRef<{
    chave: string
    promise: Promise<RespostaSaudacao>
    fallback: RespostaSaudacao
  } | null>(null)

  // Modal de validação facial e QR Code ao tocar no card de almoço
  const [funcionarioAlmocoModal, setFuncionarioAlmocoModal] = useState<InfoAlmocoAtivo | null>(null)
  const funcionarioAlmocoModalRef = useRef<InfoAlmocoAtivo | null>(null)
  const [pessoaDetectadaModal, setPessoaDetectadaModal] = useState<{ id: string; nome: string } | null>(null)

  // Pessoa detectada na tela de descanso para o balão de fala da IA
  const [pessoaNaEspera, setPessoaNaEspera] = useState<{
    id: string
    nome: string
    primeiroNome: string
  } | null>(null)
  const [falaIaEspera, setFalaIaEspera] = useState<string | null>(null)
  const ultimoReconhecimentoEsperaRef = useRef(0)

  useEffect(() => {
    funcionarioAlmocoModalRef.current = funcionarioAlmocoModal
  }, [funcionarioAlmocoModal])

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
  /**
   * Marca a película que está se abrindo. É PURAMENTE COSMÉTICA: uma camada
   * própria, por fora da proteção de tela, que já foi desmontada.
   *
   * Nenhum estado do app depende dela. A versão anterior punha o
   * `setScreensaver(false)` dentro de um `setTimeout` da animação — se algo
   * naquele caminho falhasse, a película nunca saía, a câmera ficava escondida
   * atrás dela e o reconhecimento não começava. Animação não pode ter esse
   * poder sobre o ponto.
   */
  const [peliculaSaindo, setPeliculaSaindo] = useState(0)
  const timerAberturaRef = useRef<number | null>(null)
  const ultimaDeteccaoOciosaRef = useRef(0)
  /**
   * Quando a rede pesada rodou pela última vez, seja de verdade ou por
   * aquecimento. É daqui que sai tanto o aquecimento da espera quanto o
   * `ms_ocioso_antes` da telemetria — o número que finalmente diz se "parado há
   * muito tempo" é mesmo o que deixa a batida lenta.
   */
  const ultimoPassePesadoRef = useRef(0)
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

  /**
   * Quanto tempo de sorriso CONTÍNUO o ponto exige.
   *
   * 1,0s de sorriso contínuo medido no relógio: rápido, natural e sem disparos acidentais.
   */
  const TEMPO_DE_SORRISO_MS = 1000
  const SMILE_THRESHOLD = 0.40
  // De quanto em quanto tempo a identidade é reconferida com o passe completo.
  // É esta janela que pega a troca de pessoa na frente da câmera.
  // Confirmação visual da moldura esmeralda antes de trocar de tela.
  const PULSO_CONFIRMACAO_MS = 220
  /**
   * Quanto a tela de sucesso aceita esperar pela saudação da IA.
   *
   * Quando o prefetch já voltou, ele resolve em 0 a 7 ms — então este teto
   * quase nunca é alcançado. Ele existe para o caso medido na linha 31: IA em
   * 1.444 ms com a pessoa parada olhando a tela, por causa de uma frase.
   *
   * 120 ms é folgado o bastante para não roubar a saudação personalizada de
   * quem está quase pronta, e curto o bastante para ninguém perceber.
   */
  const TETO_SAUDACAO_IA_MS = 120
  // Câmera espelhada do tablet: inverte o eixo X para que os olhos acompanhem o rosto perfeitamente.
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
   *
   * POR QUE 5 SEGUNDOS, E NÃO 25 COMO ANTES
   *
   * A primeira leitura real de ms_ocioso_antes mediu a queda: 7.332 ms parado
   * e a olhada seguinte custou 875 ms; batidas em sequência, 176 a 185 ms. A
   * GPU esfria em menos de dez segundos.
   *
   * Isso inverte a conta de custo. A 25 s ela esfria entre um aquecimento e o
   * outro, então CADA aquecimento paga preço de frio (~900 ms) e ainda assim
   * esfria de novo antes da próxima batida — gasta e não entrega. A 5 s ela
   * nunca esfria, e cada aquecimento custa ~180 ms. O trabalho por minuto
   * acaba sendo praticamente o mesmo (~2,2 s), com a diferença de que este
   * funciona.
   *
   * 7 s foi considerado e descartado: fica em cima do único ponto que
   * medimos (7,3 s já custou 875 ms), ou seja, na fronteira do que sabemos.
   *
   * Sobre desgaste: durante a proteção de tela o tablet já roda uma detecção
   * a cada INTERVALO_DETECCAO_OCIOSA_MS para mover os olhos. Uma olhada
   * pesada a cada 5 s é ~3,6% em cima disso.
   *
   * ms_ocioso_antes continua gravando em toda batida, então a curva de
   * esfriamento vai ficando mais nítida e este número pode ser reajustado com
   * dado em vez de estimativa.
   */
  const INTERVALO_AQUECIMENTO_PESADO_MS = 5 * 1000
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

  // Registra o @property e as duas classes da revelação uma vez só.
  useCssRevelacao()

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

    // 1. Gera IMEDIATAMENTE a saudação local instantânea (0ms)
    const fallback = gerarSaudacaoLocalDoDia({
      nome: func.nome,
      tipoPonto: tipo,
      dataHora: new Date(),
      trabalhaSabado: !!func.horarios?.sabado?.ativo,
    })

    // 2. Pré-carrega no mesmo instante o áudio TTS da saudação local.
    // Durante o 1,5s em que o colaborador sorri, o áudio já fica baixado em memória no cache.
    void prepararVozSaudacao(fallback.voz)

    // 3. Em paralelo, dispara a tentativa de saudação inteligente com Groq (Llama)
    const promessaSaudacao = obterSaudacaoInteligente({
      nome: func.nome,
      tipoPonto: tipo,
      dataHora: new Date(),
      trabalhaSabado: !!func.horarios?.sabado?.ativo,
    })
      .then((sd) => {
        if (sd?.voz) {
          void prepararVozSaudacao(sd.voz)
        }
        if (sd?.visual) {
          setFalaIaEspera(sd.visual)
        }
        return sd
      })
      .catch(() => fallback)

    prefetchSaudacaoRef.current = { chave, promise: promessaSaudacao, fallback }
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
          // Se o modal de confirmação de almoço estiver aberto, roda identificação para validar a pessoa
          if (funcionarioAlmocoModalRef.current) {
            const result = await recognizeFace(video, SMILE_THRESHOLD)
            if (result && !result.isUnknown && result.id !== "unknown") {
              const func = funcionariosMapRef.current.get(result.id)
              if (func) {
                setPessoaDetectadaModal({ id: func.id, nome: func.nome })
              }
            }
            return
          }

          const rosto = await detectFaceFast(video)
          if (!rosto) {
            setOlharDaCamera(null)
            setPessoaNaEspera(null)
            setFalaIaEspera(null)
            if (rostoNaEsperaRef.current) {
              // Apareceu e foi embora sem bater nada. A telemetria descarta
              // tentativas sem nenhum passe completo, então isso não vira lixo.
              rostoNaEsperaRef.current = false
              telemetria.encerrarTentativa("nao_identificado", modoTesteRef.current)
            }
            // Ninguém à vista: momento certo de manter a rede pesada acordada.
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

          // Alguém apareceu na frente do tablet
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

          // Identificação em segundo plano para o balão de fala da tela de espera
          if (Date.now() - ultimoReconhecimentoEsperaRef.current > 1200) {
            ultimoReconhecimentoEsperaRef.current = Date.now()
            void recognizeFace(video, SMILE_THRESHOLD).then((res) => {
              if (res && !res.isUnknown && res.id !== "unknown") {
                const func = funcionariosMapRef.current.get(res.id)
                if (func) {
                  setPessoaNaEspera({
                    id: func.id,
                    nome: func.nome,
                    primeiroNome: func.nome.split(" ")[0],
                  })
                  prefetchRegistrosDoDia(func.id)
                }
              } else if (res && (res.isUnknown || res.id === "unknown")) {
                setPessoaNaEspera((prev) =>
                  prev?.id && prev.id !== "unknown"
                    ? prev
                    : { id: "unknown", nome: "Visitante", primeiroNome: "Visitante" }
                )
              }
            }).catch(() => {})
          }

          // Centro do rosto (0..1) vira direção do olhar (-1..1).
          // Com INVERTER_OLHAR_X para acompanhar perfeitamente o rosto na câmera espelhada!
          const x = Math.max(-1, Math.min(1, (rosto.centroX * 2 - 1) * (INVERTER_OLHAR_X ? -1 : 1) * 1.35))
          const y = Math.max(-1, Math.min(1, (rosto.centroY * 2 - 1) * 1.3))

          // Deadzone reduzida para 0.03 para responder a movimentos menores e mais fluidos
          setOlharDaCamera((atual) =>
            atual && Math.abs(atual.x - x) < 0.03 && Math.abs(atual.y - y) < 0.03
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
          // === Uma velocidade só, e é a rápida ===
          //
          // Aqui existia um mecanismo de duas velocidades: quem já estava
          // identificado era acompanhado por um passe BARATO (detector menor +
          // expressões, 192x144 entrada 96), e o passe COMPLETO só voltava a
          // cada 800 ms. A ideia era boa e, no tablet lento, funcionava.
          //
          // A telemetria de seis batidas seguidas mostrou que ela se inverteu:
          //
          //     id 8   barato 463 ms   completo 192 ms   2.41x
          //     id 11  barato 351 ms   completo 175 ms   2.01x
          //     id 12  barato 348 ms   completo 194 ms   1.79x
          //     id 13  barato 376 ms   completo 189 ms   1.99x
          //
          // O passe "barato" ficou DUAS VEZES MAIS CARO que o completo. O
          // motivo é o mesmo frio/quente que este trabalho todo perseguiu: o
          // passe completo roda a cada quadro e vive quente; o barato roda
          // duas ou três vezes por batida, com outro shape de entrada, e paga
          // aquecimento de shader toda vez. A otimização virou pedágio.
          //
          // Então some. Um shape só, sempre quente, ~190 ms — e de quebra o
          // sorriso passa a ser amostrado a cada 190 ms em vez de a cada
          // 350-900 ms, e some a corrida entre o laço e o render que obrigou a
          // escrever a identidade no ref de forma síncrona.
          //
          // Se algum dia o aparelho voltar a ficar lento (passe completo acima
          // de ~600 ms), vale reconsiderar: com a GPU fria a conta se inverte
          // de novo, como nas linhas 9 e 10 (barato 422 ms, completo 925 ms).
          // Reconhecimento completo: identificação + sorriso em 1 passe no Web Worker
          const tCompleto = performance.now()
          const result = await recognizeFace(video, SMILE_THRESHOLD)
          telemetria.registrarPasseCompleto(performance.now() - tCompleto)
          telemetria.registrarCaptura(getUltimaCapturaMs())
          ultimoPassePesadoRef.current = Date.now()
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
                  sorrindoDesdeRef.current = null
                  telemetria.registrarPerdaDeIdentidade()
                }
              }
              return
            }

            // Rosto válido de funcionário cadastrado!
            lastFaceSeenRef.current = Date.now()
            falhasSeguidasRef.current = 0

            const isDifferentPerson = !current || current.id !== result.id
            const isSmiling = result.isSmiling
            // O sorriso também precisa ser cronometrado quando quem o vê é o
            // passe completo. Sem isto, toda batida que não passa pelo ramo
            // barato grava ms_ate_sorrir e ms_sorriso_ate_confirmar em branco
            // — foi o que aconteceu nas três primeiras batidas com o código
            // novo, e é justamente a etapa que falta medir.
            if (isSmiling) telemetria.registrarSorriso()

            // === Cronômetro do sorriso contínuo ===
            // Qualquer passe sem sorriso zera. É o que separa "sorriu 1,5 s
            // seguidos" de "sorriu 1,5 s somados ao longo de um minuto".
            if (!isSmiling || isDifferentPerson) {
              sorrindoDesdeRef.current = null
            } else if (sorrindoDesdeRef.current === null) {
              sorrindoDesdeRef.current = Date.now()
              // O som acompanha a barra verde acendendo: os dois dizem a mesma
              // coisa, no mesmo instante. Só na transição, senão repetiria a
              // cada passe enquanto a pessoa continua sorrindo.
              tocarConfirmacao()
            }
            const msSorrindo =
              sorrindoDesdeRef.current === null ? 0 : Date.now() - sorrindoDesdeRef.current

            const updated: RecognizedPerson = {
              id: result.id,
              nome: result.nome,
              similarity: result.similarity,
              isSmiling,
              smileFrames: isSmiling ? 1 : 0,
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

            // Grava só depois do sorriso inteiro. A barra verde no topo leva
            // exatamente TEMPO_DE_SORRISO_MS para ir do centro às duas pontas,
            // então ela não é enfeite: é o medidor. Quem está sorrindo vê
            // quanto falta, e quem desiste no meio vê a barra sumir.
            if (isSmiling && msSorrindo >= TEMPO_DE_SORRISO_MS) {
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

      // Saudação da IA, COM TETO DE ESPERA.
      //
      // O comentário aqui dizia que a IA nunca segura a tela, porque o pedido
      // sai quando a pessoa é identificada e normalmente já voltou. A
      // telemetria mostrou que "normalmente" não é sempre, e que quando falha
      // custa caro. A relação apareceu limpa em doze linhas seguidas:
      //
      //     confirmar -> tela  =  ms_saudacao_ia + PULSO_CONFIRMACAO_MS
      //
      //     id 11: IA 2386 ms -> tela 2613 ms
      //     id 31: IA 1444 ms -> tela 1675 ms
      //     id 24: IA  624 ms -> tela  852 ms
      //     id 29/30/32: IA 0 a 7 ms -> tela 229 a 262 ms
      //
      // Quem sorri rápido chega aqui antes da IA responder, e a tela fica
      // parada esperando uma frase — com o ponto já decidido e o banco já
      // respondido em 0 ms.
      //
      // Agora a espera tem teto. Quando o prefetch já voltou (o caso comum:
      // 0 a 7 ms em três das cinco batidas de teste) nada muda. Quando
      // demora, entra a saudação local, que é síncrona e sempre existe. A
      // frase pode ficar menos personalizada; a tela não fica parada.
      const trabalhaSabado = !!funcObj.horarios?.sabado?.ativo
      const chaveSaudacao = `${person.id}|${tipo}`
      const tSaudacao = performance.now()
      const saudacaoGuardada =
        prefetchSaudacaoRef.current?.chave === chaveSaudacao
          ? prefetchSaudacaoRef.current
          : null

      // Se a IA não responder a tempo, usamos o fallback que já teve o áudio
      // pré-carregado no mesmo instante em que a pessoa foi detectada!
      const fallbackComAudioPronto =
        saudacaoGuardada?.fallback ??
        gerarSaudacaoLocalDoDia({
          nome: person.nome,
          tipoPonto: tipo,
          dataHora: now,
          trabalhaSabado,
        })

      const saudacaoIa: RespostaSaudacao = saudacaoGuardada
        ? await Promise.race([
            saudacaoGuardada.promise.catch(() => fallbackComAudioPronto),
            new Promise<RespostaSaudacao>((resolve) =>
              setTimeout(() => resolve(fallbackComAudioPronto), TETO_SAUDACAO_IA_MS)
            ),
          ])
        : fallbackComAudioPronto

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
      // Antes da voz, de propósito: a nota fecha a frase que a confirmação
      // abriu, e a saudação falada entra em seguida sem disputar com ela.
      tocarSucesso()
      // `semEsperarRede`: se o adiantamento acima não deu conta (frase
      // diferente da prevista, rede lenta), a voz do navegador fala AGORA em
      // vez de esperar o MP3. Voz pior na hora serve; voz boa falando para
      // uma sala vazia não serve para nada.
      reproduzirVozSaudacao(mensagemVoz, { semEsperarRede: true })

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
      reproduzirVozSaudacao(saudacaoIa.voz || completed.mensagem, { semEsperarRede: true })

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
    sorrindoDesdeRef.current = null
    rostoNaEsperaRef.current = false
    prefetchSaudacaoRef.current = null
    setShowSuccess(false)
    setRecognizedPerson(null)
    setDialogoInteligente(null)
    setMostrarCheckinHumor(false)
    setHumorSelecionado(null)
    isProcessingRef.current = false
    if (timerAberturaRef.current) {
      window.clearTimeout(timerAberturaRef.current)
      timerAberturaRef.current = null
    }
    setPeliculaSaindo(0)
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

      {/* Barra esmeralda no topo — acende quando o rosto é confirmado e o ponto
          está sendo gravado. Continua visível durante `registroCompleto`, aí
          com a cortina, para emendar na tela de sucesso sem corte seco. */}
      {recognizedPerson && recognizedPerson.isSmiling && !showSuccess && (
        <MolduraTopo duracaoMs={TEMPO_DE_SORRISO_MS} />
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
              {/* "Registrando" mentia: durante o sorriso ainda não está
                  registrando nada, está esperando. E quem lê "registrando" e vê
                  que nada acontece conclui que travou. "Segure o sorriso" diz o
                  que fazer, e a barra no topo diz por quanto tempo. */}
              {recognizedPerson.isSmiling
                ? "Segure o sorriso..."
                : "Sorria para registrar seu ponto"}
            </div>
          </div>
        </div>
      )}

      {/* Indicador em Glassmorphism Dourado — Posicione seu rosto na câmera (Sem bolinha)
          Só aparece quando a película já saiu 100% (peliculaSaindo === 0) */}
      {!screensaver && peliculaSaindo === 0 && !showSuccess && !recognizedPerson && modelsReady && cameraActive && (
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

      {/* Película se abrindo — camada cosmética, por fora da proteção de tela.
          A câmera já está visível por baixo; o buraco cresce do centro e come
          a película. Mesma mecânica da transição de rotas da VitallCam.
          `pointer-events-none` e fim totalmente transparente: mesmo que a
          limpeza falhe, ela não bloqueia nada. */}
      {peliculaSaindo > 0 && (
        <div
          key={peliculaSaindo}
          className="fixed inset-0 z-40 pointer-events-none abrir-do-centro"
          style={{
            background:
              "linear-gradient(135deg, rgba(29, 185, 179, 0.72) 0%, rgba(22, 145, 141, 0.75) 50%, rgba(13, 132, 136, 0.8) 100%)",
          }}
        />
      )}

      {/* Proteção de tela */}
      {screensaver && (
        <Screensaver
          olhar={olharDaCamera}
          pessoaNaEspera={pessoaNaEspera}
          falaIa={falaIaEspera}
          onSelecionarAlmoco={(f) => {
            setPessoaDetectadaModal(null)
            setFuncionarioAlmocoModal(f)
          }}
          onTap={() => {
            // Tudo que o app precisa acontece AQUI, de forma síncrona. A
            // animação vem depois e não tem voto nenhum sobre isso.
            screensaverRef.current = false
            setScreensaver(false)
            telemetria.registrarToque()
            // Único gesto garantido da batida: é aqui, e só aqui, que dá para
            // destravar o áudio do navegador.
            prepararSom()
            resetInactivityTimer()

            // A película vira uma camada à parte, que se abre do centro por
            // cima da câmera já visível. Se o timer abaixo nunca rodar, ela
            // termina totalmente transparente e sem captar toque — pior caso
            // é uma camada invisível esquecida, não um ponto travado.
            setPeliculaSaindo((n) => n + 1)
            if (timerAberturaRef.current) window.clearTimeout(timerAberturaRef.current)
            timerAberturaRef.current = window.setTimeout(
              () => setPeliculaSaindo(0),
              DURACAO_ABERTURA_MS + 120
            )
          }}
          onSegredo={() => setModoTeste(true)}
        />
      )}

      {/* Modal inteligente de confirmação de almoço por QR Code */}
      {funcionarioAlmocoModal && (
        <ModalQRAlmoco
          funcionario={{
            funcionarioId: funcionarioAlmocoModal.funcionarioId,
            primeiroNome: funcionarioAlmocoModal.primeiroNome,
            nomeCompleto: funcionarioAlmocoModal.nome,
            horaSaida: funcionarioAlmocoModal.horaSaida,
            horaRetornoPrevista: funcionarioAlmocoModal.horaRetornoPrevista,
            retornoPrevistoMs: funcionarioAlmocoModal.retornoPrevistoMs,
          }}
          pessoaNaCamera={pessoaDetectadaModal}
          onClose={() => {
            setFuncionarioAlmocoModal(null)
            setPessoaDetectadaModal(null)
          }}
        />
      )}

      {/* Tela de sucesso de Ponto Registrado — Zero Scroll, Animação do Centro para Direita & Dourado */}
      {/* A tela de ponto batido nasce de dentro de um círculo que cresce do
          centro — a mesma transição de rota da VitallCam, na direção dela: o
          conteúdo NOVO é que é revelado. `fixed inset-0` porque a máscara
          precisa de uma caixa do tamanho da tela para o raio em % fazer
          sentido. */}
      {showSuccess && recognizedPerson && (
        <div className="fixed inset-0 z-50 revelar-do-centro">
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
        </div>
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
