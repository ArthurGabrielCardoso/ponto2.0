"use client"

import React, { useEffect, useRef, useState } from "react"
import { ArrowLeft, Check } from "lucide-react"
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

const OPCOES: { tipo: TipoFixo; emoji: string; titulo: string; legenda: string }[] = [
  { tipo: "Entrada", emoji: "🌤️", titulo: "Entrada", legenda: "Cheguei no trabalho" },
  { tipo: "Saída Almoço", emoji: "🍽️", titulo: "Saída para o almoço", legenda: "Vou almoçar" },
  { tipo: "Retorno Almoço", emoji: "💼", titulo: "Retorno do almoço", legenda: "Voltei do almoço" },
  { tipo: "Saída", emoji: "🌙", titulo: "Saída", legenda: "Fim do expediente" },
]

const MOTIVOS_RAPIDOS = ["Banco", "Médico", "Reunião externa", "Serviço externo", "Assunto pessoal"]

export function PerguntaTipoPonto({ nome, sugerido, onEscolher, onTempoEsgotado, onCancelar }: Props) {
  const primeiroNome = nome.split(" ")[0]
  const [etapa, setEtapa] = useState<"tipo" | "outro">("tipo")
  const [direcao, setDirecao] = useState<DirecaoOutro>("saindo")
  const [motivo, setMotivo] = useState("")
  const [restante, setRestante] = useState(TEMPO_PERGUNTA_S)
  const total = etapa === "outro" ? TEMPO_OUTRO_S : TEMPO_PERGUNTA_S
  const esgotou = useRef(onTempoEsgotado)
  esgotou.current = onTempoEsgotado

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
    return () => window.clearInterval(id)
  }, [])

  const motivoLimpo = limparMotivo(motivo)
  const podeConfirmarOutro = motivoLimpo.length >= 2

  const confirmarOutro = () => {
    if (!podeConfirmarOutro) return
    onEscolher(montarTipoOutro(direcao, motivoLimpo), { sugerido: false, outro: true })
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center overflow-y-auto p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Escolha o tipo do ponto"
      onPointerDown={() => reiniciarRelogio()}
      style={{
        background:
          "linear-gradient(135deg, rgba(10, 70, 72, 0.88) 0%, rgba(13, 100, 104, 0.9) 50%, rgba(8, 60, 66, 0.94) 100%)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <div className="w-full max-w-3xl">
        <div className="mb-5 text-center text-white">
          <h1 className="text-3xl font-bold tracking-tight drop-shadow sm:text-4xl">
            {etapa === "tipo" ? `Olá, ${primeiroNome}!` : "Conte o que está acontecendo"}
          </h1>
          <p className="mt-1.5 text-lg text-amber-100/90 sm:text-xl">
            {etapa === "tipo" ? "O que você está registrando agora?" : "Assim o seu ponto fica certinho."}
          </p>
        </div>

        {etapa === "tipo" ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {OPCOES.map((o) => {
                const ehSugerido = o.tipo === sugerido
                return (
                  <button
                    key={o.tipo}
                    type="button"
                    onClick={() => onEscolher(o.tipo, { sugerido: ehSugerido, outro: false })}
                    className={`relative flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-3xl border px-3 py-4 text-white transition active:scale-[0.97] sm:min-h-[132px] ${
                      ehSugerido
                        ? "border-amber-300/80 bg-amber-300/20 shadow-[0_0_0_3px_rgba(252,211,77,0.35)]"
                        : "border-white/25 bg-white/10"
                    }`}
                    style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
                  >
                    {ehSugerido && (
                      <span className="absolute -top-2.5 rounded-full bg-amber-300 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-950">
                        Sugerido
                      </span>
                    )}
                    <span className="text-4xl leading-none sm:text-5xl" aria-hidden>
                      {o.emoji}
                    </span>
                    <span className="text-xl font-bold leading-tight sm:text-2xl">{o.titulo}</span>
                    <span className="text-sm text-white/75 sm:text-base">{o.legenda}</span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setEtapa("outro")
                reiniciarRelogio(TEMPO_OUTRO_S)
              }}
              className="mt-3 flex min-h-[72px] w-full items-center justify-center gap-3 rounded-3xl border border-dashed border-white/40 bg-white/5 px-4 text-white transition active:scale-[0.98] sm:mt-4"
            >
              <span className="text-3xl" aria-hidden>
                ✍️
              </span>
              <span className="text-left">
                <span className="block text-xl font-bold leading-tight">Outro motivo</span>
                <span className="block text-sm text-white/75">Estou saindo ou voltando por outra razão</span>
              </span>
            </button>
          </>
        ) : (
          <div
            className="rounded-3xl border border-white/25 bg-white/10 p-4 text-white sm:p-6"
            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            <div className="grid grid-cols-2 gap-3">
              {(["saindo", "voltando"] as DirecaoOutro[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirecao(d)}
                  className={`min-h-[64px] rounded-2xl border text-xl font-bold transition active:scale-[0.97] ${
                    direcao === d
                      ? "border-amber-300/80 bg-amber-300/25 shadow-[0_0_0_3px_rgba(252,211,77,0.3)]"
                      : "border-white/25 bg-white/5"
                  }`}
                >
                  {d === "saindo" ? "Estou saindo" : "Estou voltando"}
                </button>
              ))}
            </div>

            <label htmlFor="motivo-outro" className="mt-5 block text-sm font-semibold uppercase tracking-wider text-amber-100/90">
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
              className="mt-2 w-full rounded-2xl border border-white/30 bg-black/25 px-4 py-4 text-xl text-white placeholder-white/45 outline-none focus:border-amber-300/80"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {MOTIVOS_RAPIDOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  className={`rounded-full border px-4 py-2 text-base transition active:scale-95 ${
                    motivoLimpo === m ? "border-amber-300/80 bg-amber-300/25" : "border-white/25 bg-white/5"
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
                className="flex min-h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl text-xl font-bold text-amber-950 transition active:scale-[0.98] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)" }}
              >
                <Check className="h-6 w-6" />
                Registrar ponto
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3 text-white/80">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-amber-300 transition-[width] duration-1000 ease-linear"
              style={{ width: `${(restante / total) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right text-sm tabular-nums">{restante}s</span>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-full border border-white/25 px-4 py-1.5 text-sm transition active:scale-95"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
