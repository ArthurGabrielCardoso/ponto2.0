"use client"

import React, { useEffect, useRef, useState } from "react"

interface AlarmeAlmocoProps {
  /** Instante do retorno previsto, em ms desde a época. */
  retornoPrevistoMs: number
  /** Quantos minutos antes o alarme deve tocar. */
  minutosAntes?: number
}

type Estado = "desligado" | "armado" | "tocando" | "indisponivel"

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
 * O `interaction` do botao tambem e obrigatorio: nenhum navegador deixa criar
 * e destravar um AudioContext sem gesto do usuario.
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

  const alvoMs = retornoPrevistoMs - minutosAntes * 60 * 1000

  useEffect(() => {
    return () => {
      pararRef.current?.()
      ctxRef.current?.close().catch(() => {})
    }
  }, [])

  const desarmar = () => {
    pararRef.current?.()
    pararRef.current = null
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    setEstado("desligado")
  }

  const armar = async () => {
    if (estado === "armado" || estado === "tocando") {
      desarmar()
      return
    }

    const segundosAte = (alvoMs - Date.now()) / 1000
    if (segundosAte <= 0) return

    const Ctor: typeof AudioContext | undefined =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined
    if (!Ctor) {
      setEstado("indisponivel")
      return
    }

    const ctx = new Ctor()
    try {
      await ctx.resume()
    } catch {
      setEstado("indisponivel")
      return
    }
    ctxRef.current = ctx

    // Tom mudo em loop: e ele que impede o sistema de congelar a aba e
    // suspender o contexto. Inaudivel, mas conta como audio tocando.
    const mudo = ctx.createOscillator()
    const ganhoMudo = ctx.createGain()
    ganhoMudo.gain.value = 0.0001
    mudo.frequency.value = 440
    mudo.connect(ganhoMudo).connect(ctx.destination)
    mudo.start()

    // O alarme: tres toques curtos, agendados no relogio do audio.
    const inicio = ctx.currentTime + segundosAte
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
    window.setTimeout(
      () => {
        setEstado("tocando")
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("Hora de voltar do almoço", {
              body: `Faltam ${minutosAntes} minutos.`,
              icon: "/icone.png",
            })
          } catch {
            /* alguns navegadores exigem service worker */
          }
        }
      },
      Math.max(0, alvoMs - Date.now())
    )

    setEstado("armado")
  }

  if (estado === "indisponivel") {
    return (
      <p className="mt-4 text-center text-xs text-white/55">
        Este navegador não deixou preparar o som do alarme.
      </p>
    )
  }

  const jaPassou = alvoMs - Date.now() <= 0
  if (jaPassou && estado === "desligado") return null

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={armar}
        className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3.5 text-sm font-bold transition active:scale-[0.98] ${
          estado === "desligado"
            ? "text-white shadow-md"
            : "border border-[#c69e6b]/50 bg-[#c69e6b]/20 text-[#e6c79a]"
        }`}
        style={
          estado === "desligado"
            ? { background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }
            : undefined
        }
      >
        {estado === "desligado"
          ? `Me avisar com som ${minutosAntes} min antes`
          : estado === "tocando"
            ? "Tocou! Toque para desligar"
            : "Alarme armado · toque para cancelar"}
      </button>

      <p className="mt-2 text-center text-[11px] leading-relaxed text-white/55">
        {estado === "desligado"
          ? "O som toca no seu celular, mesmo com a tela bloqueada."
          : "Deixe esta aba aberta. Se fechar o navegador, o alarme não toca."}
      </p>
    </div>
  )
}
