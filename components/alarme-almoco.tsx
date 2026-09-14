"use client"

import React, { useEffect, useRef, useState } from "react"

interface AlarmeAlmocoProps {
  /** Instante do retorno previsto, em ms desde a época. */
  retornoPrevistoMs: number
  /** Quantos minutos antes o alarme deve tocar. */
  minutosAntes?: number
}

type Estado = "desligado" | "armado" | "teste" | "tocando" | "indisponivel"

/** Quantos segundos à frente o botão de teste agenda o alarme. */
const SEGUNDOS_DO_TESTE = 30

/**
 * Alarme sonoro no proprio navegador, sem calendario e sem push.
 *
 * O problema de fazer isso na web e que um `setTimeout` de 40 minutos nao
 * sobrevive: o navegador estrangula timers de aba em segundo plano, e no
 * celular a aba pode ser congelada minutos depois de sair da tela. Um alarme
 * que so toca se a pessoa ficar olhando a pagina nao serve para nada.
 *
 * A saida e nao usar timer nenhum para disparar o som. O Web Audio tem um
 * relogio proprio, o do hardware de audio, que nao e estrangulado: agendar
 * `oscillator.start(quando)` no AudioContext faz o som sair na hora certa
 * mesmo com o JavaScript parado. O que precisa continuar vivo e o CONTEXTO,
 * e o que o mantem vivo e ter audio tocando — entao deixamos um tom mudo
 * (ganho 0.0001, inaudivel) em loop desde o momento em que a pessoa arma o
 * alarme. Para o sistema operacional a aba vira "uma aba tocando audio", que
 * e justamente a categoria que ele nao congela.
 *
 * O gesto do botao tambem e obrigatorio: nenhum navegador deixa criar e
 * destravar um AudioContext sem interacao do usuario.
 *
 * LIMITE, dito com todas as letras: isso cobre a aba em segundo plano e a tela
 * bloqueada. NAO cobre fechar o navegador nem o iPhone descartando a aba por
 * falta de memoria — nesse caso o contexto morre junto e nada toca. Para
 * sobreviver a isso so com o site instalado na tela de inicio e web push, que
 * e outra ordem de complexidade. Por isso o botao diz para manter a aba
 * aberta, em vez de prometer o que nao entrega.
 */
export function AlarmeAlmoco({ retornoPrevistoMs, minutosAntes = 5 }: AlarmeAlmocoProps) {
  const [estado, setEstado] = useState<Estado>("desligado")
  const ctxRef = useRef<AudioContext | null>(null)
  const pararRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<number | null>(null)

  const alvoMs = retornoPrevistoMs - minutosAntes * 60 * 1000

  useEffect(() => {
    return () => {
      pararRef.current?.()
      if (timerRef.current) window.clearTimeout(timerRef.current)
      ctxRef.current?.close().catch(() => {})
    }
  }, [])

  const limpar = () => {
    pararRef.current?.()
    pararRef.current = null
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
  }

  const desarmar = () => {
    limpar()
    setEstado("desligado")
  }

  /** Cria o contexto destravado pelo gesto e liga o tom mudo que o mantem vivo. */
  const abrirContexto = async (): Promise<AudioContext | null> => {
    const Ctor: typeof AudioContext | undefined =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined
    if (!Ctor) return null

    const ctx = new Ctor()
    try {
      await ctx.resume()
    } catch {
      return null
    }
    return ctx
  }

  /** Os tres toques, agendados no relogio do audio. */
  const agendarToques = (ctx: AudioContext, segundosAte: number): OscillatorNode[] => {
    const inicio = ctx.currentTime + Math.max(0, segundosAte)
    const agendados: OscillatorNode[] = []
    for (let i = 0; i < 3; i++) {
      const t = inicio + i * 0.6
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(880, t)
      osc.frequency.setValueAtTime(1180, t + 0.18)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.55, t + 0.04)
      g.gain.setValueAtTime(0.55, t + 0.3)
      g.gain.linearRampToValueAtTime(0, t + 0.42)
      osc.connect(g).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.45)
      agendados.push(osc)
    }
    return agendados
  }

  /**
   * Arma para daqui a `segundosAte`. É o mesmo caminho para o alarme de
   * verdade e para o teste de 30s — de propósito: um teste que passasse por
   * outro código não provaria nada sobre o alarme real.
   */
  const armarEm = async (segundosAte: number, comoTeste: boolean) => {
    limpar()
    if (segundosAte <= 0) return

    const ctx = await abrirContexto()
    if (!ctx) {
      setEstado("indisponivel")
      return
    }
    ctxRef.current = ctx

    const mudo = ctx.createOscillator()
    const ganhoMudo = ctx.createGain()
    ganhoMudo.gain.value = 0.0001
    mudo.frequency.value = 440
    mudo.connect(ganhoMudo).connect(ctx.destination)
    mudo.start()

    const agendados = agendarToques(ctx, segundosAte)

    pararRef.current = () => {
      agendados.forEach((o) => {
        try {
          o.stop()
        } catch {
          /* ja parou */
        }
      })
      try {
        mudo.stop()
      } catch {
        /* ja parou */
      }
    }

    // A notificacao e um segundo canal, nao o principal: se a permissao for
    // negada o som continua valendo. Diferente do audio, ela depende de timer,
    // entao pode chegar atrasada em aba congelada — o som e que e pontual.
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }
    timerRef.current = window.setTimeout(() => {
      setEstado("tocando")
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(comoTeste ? "Teste do alarme" : "Hora de voltar do almoço", {
            body: comoTeste ? "É assim que ele vai tocar." : `Faltam ${minutosAntes} minutos.`,
            icon: "/icone.png",
          })
        } catch {
          /* alguns navegadores exigem service worker */
        }
      }
    }, segundosAte * 1000)

    setEstado(comoTeste ? "teste" : "armado")
  }

  /** Toca agora, só para a pessoa conferir o som e o volume do aparelho. */
  const ouvirAgora = async () => {
    const ctx = await abrirContexto()
    if (!ctx) {
      setEstado("indisponivel")
      return
    }
    agendarToques(ctx, 0)
    window.setTimeout(() => ctx.close().catch(() => {}), 2600)
  }

  if (estado === "indisponivel") {
    return (
      <p className="mt-4 text-center text-xs text-white/55">
        Este navegador não deixou preparar o som do alarme.
      </p>
    )
  }

  const armado = estado === "armado" || estado === "teste" || estado === "tocando"
  const faltaParaOAlarme = alvoMs - Date.now()

  return (
    <div className="mt-4">
      {faltaParaOAlarme > 0 && (
        <button
          type="button"
          onClick={() => (armado ? desarmar() : armarEm(faltaParaOAlarme / 1000, false))}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] ${
            armado
              ? "border border-[#c69e6b]/50 bg-[#c69e6b]/20 text-[#e6c79a]"
              : "text-white shadow-md"
          }`}
          style={
            armado ? undefined : { background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }
          }
        >
          {estado === "tocando"
            ? "Tocou! Toque para desligar"
            : estado === "teste"
              ? `Teste armado para ${SEGUNDOS_DO_TESTE}s · toque para cancelar`
              : estado === "armado"
                ? "Alarme armado · toque para cancelar"
                : `Me avisar com som ${minutosAntes} min antes`}
        </button>
      )}

      {/* Sem isto a pessoa so descobre se o alarme funciona no dia em que
          precisar dele. O primeiro botao confere som e volume na hora; o
          segundo arma de verdade para daqui a 30 segundos, para ela bloquear
          a tela e ver se toca com o celular no bolso — que e a parte que
          nenhum teste em mesa responde. */}
      <div className="mt-2 flex items-center justify-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={ouvirAgora}
          className="rounded-md border border-white/20 px-2.5 py-1.5 font-semibold text-white/75 active:scale-95"
        >
          Ouvir o som agora
        </button>
        <button
          type="button"
          onClick={() => armarEm(SEGUNDOS_DO_TESTE, true)}
          className="rounded-md border border-white/20 px-2.5 py-1.5 font-semibold text-white/75 active:scale-95"
        >
          Testar em {SEGUNDOS_DO_TESTE}s
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] leading-relaxed text-white/55">
        {estado === "teste"
          ? `Bloqueie a tela agora. Deve tocar em ${SEGUNDOS_DO_TESTE} segundos.`
          : armado
            ? "Deixe esta aba aberta. Se fechar o navegador, o alarme não toca."
            : "O som toca no seu celular, mesmo com a tela bloqueada."}
      </p>
    </div>
  )
}
