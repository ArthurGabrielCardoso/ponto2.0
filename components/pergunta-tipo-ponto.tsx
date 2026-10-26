"use client"

import React, { useEffect, useRef, useState } from "react"
import { ArrowLeft, Check } from "lucide-react"
import { CascaVitall } from "@/components/casca-vitall"
import { OlhosRobo } from "@/components/olhos-robo"
import {
  MOTIVO_MAX,
  limparMotivo,
  montarTipoOutro,
  type DirecaoOutro,
  type TipoFixo,
} from "@/lib/tipos-ponto"

/**
 * "O que você está registrando?" — a pergunta que vem antes de qualquer
 * saudação.
 *
 * Por que existe: o tipo da batida era DEDUZIDO pela contagem de registros do
 * dia (0 → Entrada, 1 → Saída Almoço, 2 → Retorno, 3 → Saída). Bastava uma
 * batida esquecida, um ponto fora do padrão ou uma saída para resolver algo
 * para a conta deslocar tudo — e a pessoa entrava e ouvia "Excelente almoço".
 * Agora quem sabe o que está fazendo é quem responde.
 *
 * O tipo que o sistema acha mais provável vem destacado ("Sugerido"), então o
 * caso comum continua sendo um toque. Mas é sugestão: nunca é aplicada sozinha.
 *
 * Visual: o mesmo da pergunta de humor — fundo com luzes, vidro, olhos do robô,
 * nome em dourado e os cartões todos lado a lado.
 */

interface Props {
  nome: string
  /** O que a contagem de registros acha que é. Só destaca; não decide. */
  sugerido: TipoFixo
  onEscolher: (tipo: string, info: { sugerido: boolean; outro: boolean }) => void
  /** Ninguém respondeu a tempo: volta para a tela de espera sem registrar. */
  onTempoEsgotado: () => void
  /** Pessoa saiu da frente ou desistiu. */
  onCancelar: () => void
}

const TEMPO_PERGUNTA_S = 30
const TEMPO_OUTRO_S = 60
/** Tempo do cartão "acender" antes de seguir: o toque precisa dar retorno visível. */
const RETORNO_VISUAL_MS = 260

type ChaveOpcao = TipoFixo | "outro"

interface Opcao {
  chave: ChaveOpcao
  emoji: string
  titulo: string
  legenda: string
  /** Fundo do cartão quando escolhido. */
  gradiente: string
  /** Borda e brilho quando escolhido. */
  destaque: string
}

const OPCOES: Opcao[] = [
  {
    chave: "Entrada",
    emoji: "🌤️",
    titulo: "Entrada",
    legenda: "Cheguei no trabalho",
    gradiente: "from-[#c69e6b]/35 to-[#a67c4e]/20",
    destaque: "border-[#c69e6b] shadow-[0_0_30px_rgba(198,158,107,0.7)]",
  },
  {
    chave: "Saída Almoço",
    emoji: "🍽️",
    titulo: "Saída para o almoço",
    legenda: "Vou almoçar",
    gradiente: "from-orange-500/30 to-amber-600/20",
    destaque: "border-orange-300 shadow-[0_0_30px_rgba(251,146,60,0.7)]",
  },
  {
    chave: "Retorno Almoço",
    emoji: "💼",
    titulo: "Retorno do almoço",
    legenda: "Voltei do almoço",
    gradiente: "from-teal-500/30 to-emerald-600/20",
    destaque: "border-teal-300 shadow-[0_0_30px_rgba(20,184,166,0.7)]",
  },
  {
    chave: "Saída",
    emoji: "🌙",
    titulo: "Saída",
    legenda: "Fim do expediente",
    gradiente: "from-blue-500/30 to-slate-600/20",
    destaque: "border-blue-300 shadow-[0_0_30px_rgba(96,165,250,0.6)]",
  },
  {
    chave: "outro",
    emoji: "✍️",
    titulo: "Outro motivo",
    legenda: "Saindo ou voltando por outra razão",
    gradiente: "from-white/20 to-white/5",
    destaque: "border-white/70 shadow-[0_0_30px_rgba(255,255,255,0.35)]",
  },
]

const MOTIVOS_RAPIDOS = ["Banco", "Médico", "Reunião externa", "Serviço externo", "Assunto pessoal"]

export function PerguntaTipoPonto({ nome, sugerido, onEscolher, onTempoEsgotado, onCancelar }: Props) {
  const primeiroNome = nome.split(" ")[0]
  const [etapa, setEtapa] = useState<"tipo" | "outro">("tipo")
  const [escolhido, setEscolhido] = useState<ChaveOpcao | null>(null)
  const [direcao, setDirecao] = useState<DirecaoOutro>("saindo")
  const [motivo, setMotivo] = useState("")
  const [restante, setRestante] = useState(TEMPO_PERGUNTA_S)
  const total = etapa === "outro" ? TEMPO_OUTRO_S : TEMPO_PERGUNTA_S
  const esgotou = useRef(onTempoEsgotado)
  const seguirTimer = useRef<number | null>(null)

  useEffect(() => {
    esgotou.current = onTempoEsgotado
  }, [onTempoEsgotado])

  // Qualquer toque devolve o tempo inteiro: quem está digitando não pode ser
  // interrompido no meio da palavra.
  const reiniciarRelogio = (para = total) => setRestante(para)

  useEffect(() => {
    const id = window.setInterval(() => {
      setRestante((r) => {
        if (r <= 1) {
          window.clearInterval(id)
          // Fora do updater: o setState do pai não pode rodar durante o render.
          window.setTimeout(() => esgotou.current(), 0)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => {
      window.clearInterval(id)
      if (seguirTimer.current) window.clearTimeout(seguirTimer.current)
    }
  }, [])

  const escolher = (o: Opcao) => {
    if (escolhido) return // evita duplo toque
    reiniciarRelogio()
    if (o.chave === "outro") {
      setEtapa("outro")
      reiniciarRelogio(TEMPO_OUTRO_S)
      return
    }
    setEscolhido(o.chave)
    seguirTimer.current = window.setTimeout(
      () => onEscolher(o.chave, { sugerido: o.chave === sugerido, outro: false }),
      RETORNO_VISUAL_MS
    )
  }

  const motivoLimpo = limparMotivo(motivo)
  const podeConfirmarOutro = motivoLimpo.length >= 2

  const confirmarOutro = () => {
    if (!podeConfirmarOutro) return
    onEscolher(montarTipoOutro(direcao, motivoLimpo), { sugerido: false, outro: true })
  }

  return (
    <CascaVitall
      ariaLabel="Escolha o tipo do ponto"
      restante={restante}
      onSair={onCancelar}
      onPointerDown={() => reiniciarRelogio()}
      dica={etapa === "tipo" ? "Toque em uma opção para registrar" : undefined}
    >
      {etapa === "tipo" ? (
        <>
          {/* Olhos do robô: a mesma presença da pergunta de humor. */}
          <div className="mb-4 flex justify-center md:justify-start">
            <OlhosRobo humor={escolhido ? "feliz" : "padrao"} largura={140} cor="#c69e6b" ocioso={!escolhido} piscar />
          </div>

          <div className={`mb-6 space-y-1.5 text-center transition-all duration-500 md:text-left ${escolhido ? "opacity-30" : "opacity-100"}`}>
            <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-5xl">
              Olá, <span style={{ color: "#c69e6b" }}>{primeiroNome}</span>! O que você está registrando?
            </h1>
            <p className="text-sm font-medium text-white/80 sm:text-base">
              Escolha abaixo para o seu ponto ficar certinho.
            </p>
          </div>

          {/* Todas as opções lado a lado, como os cartões de humor. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
            {OPCOES.map((o) => {
              const ativo = escolhido === o.chave
              const outroEscolhido = escolhido !== null && !ativo
              const ehSugerido = o.chave === sugerido
              return (
                <button
                  key={o.chave}
                  type="button"
                  onClick={() => escolher(o)}
                  disabled={escolhido !== null}
                  className={`group relative flex h-44 cursor-pointer flex-col justify-between rounded-2xl border p-4 text-left backdrop-blur-2xl transition-all duration-500 sm:h-52 sm:p-5 ${
                    ativo
                      ? `z-30 scale-105 bg-gradient-to-b shadow-2xl ${o.gradiente} ${o.destaque}`
                      : outroEscolhido
                      ? "pointer-events-none scale-90 opacity-20 blur-[1px]"
                      : ehSugerido
                      ? "border-[#c69e6b]/80 bg-[#c69e6b]/15 shadow-[0_0_0_2px_rgba(198,158,107,0.45)] hover:scale-[1.03] hover:bg-[#c69e6b]/25 active:scale-95"
                      : "border-white/20 bg-white/[0.08] shadow-lg hover:scale-[1.03] hover:border-[#c69e6b]/60 hover:bg-white/[0.14] hover:shadow-2xl active:scale-95"
                  }`}
                >
                  <div className="flex w-full items-start justify-between">
                    <span
                      className={`inline-block text-4xl drop-shadow transition-all duration-500 sm:text-5xl ${
                        ativo ? "-translate-y-1 scale-125" : "group-hover:scale-110"
                      }`}
                    >
                      {o.emoji}
                    </span>
                    {ativo ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c69e6b] text-xs font-bold text-[#2e1a0c] shadow-md">
                        ✓
                      </span>
                    ) : (
                      ehSugerido && (
                        <span className="rounded-full bg-[#c69e6b] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2e1a0c]">
                          Sugerido
                        </span>
                      )
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold leading-tight tracking-tight text-white transition-colors group-hover:text-[#ecdcc3] sm:text-lg">
                      {o.titulo}
                    </h3>
                    <p className="line-clamp-2 text-[11px] leading-snug text-white/70 sm:text-xs">{o.legenda}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 space-y-1.5 text-center md:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
              Conte o que está acontecendo, <span style={{ color: "#c69e6b" }}>{primeiroNome}</span>
            </h1>
            <p className="text-sm font-medium text-white/80 sm:text-base">Assim o seu ponto fica certinho.</p>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-4 text-white shadow-lg backdrop-blur-2xl sm:p-6">
            <div className="grid grid-cols-2 gap-3">
              {(["saindo", "voltando"] as DirecaoOutro[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirecao(d)}
                  className={`min-h-[64px] rounded-2xl border text-xl font-bold transition active:scale-[0.97] ${
                    direcao === d
                      ? "border-[#c69e6b] bg-[#c69e6b]/25 shadow-[0_0_0_3px_rgba(198,158,107,0.4)]"
                      : "border-white/25 bg-white/5"
                  }`}
                >
                  {d === "saindo" ? "Estou saindo" : "Estou voltando"}
                </button>
              ))}
            </div>

            <label htmlFor="motivo-outro" className="mt-5 block text-sm font-semibold uppercase tracking-wider text-[#ecdcc3]">
              Qual é o motivo?
            </label>
            <input
              id="motivo-outro"
              type="text"
              value={motivo}
              maxLength={MOTIVO_MAX}
              autoFocus
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => setMotivo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarOutro()
              }}
              placeholder="Escreva aqui, ou toque numa opção abaixo"
              className="mt-2 w-full rounded-2xl border border-white/30 bg-black/25 px-4 py-4 text-xl text-white placeholder-white/45 outline-none focus:border-[#c69e6b]"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {MOTIVOS_RAPIDOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  className={`rounded-full border px-4 py-2 text-base transition active:scale-95 ${
                    motivoLimpo === m ? "border-[#c69e6b] bg-[#c69e6b]/25" : "border-white/25 bg-white/5"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setEtapa("tipo")
                  reiniciarRelogio(TEMPO_PERGUNTA_S)
                }}
                className="flex min-h-[60px] items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/5 px-6 text-lg font-semibold transition active:scale-[0.97]"
              >
                <ArrowLeft className="h-5 w-5" />
                Voltar
              </button>
              <button
                type="button"
                disabled={!podeConfirmarOutro}
                onClick={confirmarOutro}
                className="flex min-h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-xl font-bold text-[#2e1a0c] transition active:scale-[0.98] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #d6b184 0%, #c69e6b 50%, #a67c4e 100%)" }}
              >
                <Check className="h-6 w-6" />
                Registrar ponto
              </button>
            </div>
          </div>
        </>
      )}
    </CascaVitall>
  )
}
