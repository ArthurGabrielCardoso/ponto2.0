"use client"

import React, { useEffect, useState } from "react"

interface ContadorAlmocoProps {
  /** Instante do retorno previsto, em ms desde a época. */
  retornoPrevistoMs: number
  horaSaida: string
  horaRetorno: string
  /** URL do arquivo .ics que cria o lembrete no calendário do celular. */
  urlLembrete: string
}

function formatar(totalSegundos: number): string {
  const h = Math.floor(totalSegundos / 3600)
  const m = Math.floor((totalSegundos % 3600) / 60)
  const s = totalSegundos % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * Quanto falta para voltar do almoço, no celular da pessoa.
 *
 * É a mesma informação que o tablet já mostra na proteção de tela, resolvendo
 * o problema real: quem sobe para comer não lembra a que horas tem que voltar,
 * e o tablet ficou lá embaixo.
 *
 * O botão de lembrete gera um arquivo de calendário em vez de pedir permissão
 * de notificação. No iPhone, notificação web só funciona se o site for
 * instalado na tela de início — e mesmo assim exige toda a infraestrutura de
 * web push. Um evento de calendário com alarme funciona hoje, em qualquer
 * telefone, e continua avisando com a tela bloqueada e o navegador fechado.
 *
 * Três estados, e a cor é o que se lê de longe: no tempo, acabando (últimos 10
 * minutos) e atrasado, este contando para cima.
 */
export function ContadorAlmoco({
  retornoPrevistoMs,
  horaSaida,
  horaRetorno,
  urlLembrete,
}: ContadorAlmocoProps) {
  const [restanteMs, setRestanteMs] = useState(() => retornoPrevistoMs - Date.now())

  useEffect(() => {
    const tick = () => setRestanteMs(retornoPrevistoMs - Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [retornoPrevistoMs])

  const passou = restanteMs < 0
  const segundos = Math.floor(Math.abs(restanteMs) / 1000)
  const acabando = !passou && restanteMs <= 10 * 60 * 1000

  const tema = passou
    ? {
        borda: "border-rose-300/70",
        fundo: "bg-rose-50/80",
        sombra: "shadow-[0_10px_30px_-14px_rgba(225,29,72,0.5)]",
        rotulo: "text-rose-700/80",
        numero: "text-rose-600",
        ponto: "bg-rose-500",
      }
    : acabando
      ? {
          borda: "border-amber-300/70",
          fundo: "bg-amber-50/80",
          sombra: "shadow-[0_10px_30px_-14px_rgba(217,119,6,0.5)]",
          rotulo: "text-amber-800/80",
          numero: "text-amber-600",
          ponto: "bg-amber-500",
        }
      : {
          borda: "border-teal-300/70",
          fundo: "bg-teal-50/80",
          sombra: "shadow-[0_10px_30px_-14px_rgba(13,148,136,0.5)]",
          rotulo: "text-teal-800/80",
          numero: "text-teal-700",
          ponto: "bg-teal-500",
        }

  return (
    <section
      className={`mb-3 rounded-2xl border ${tema.borda} ${tema.fundo} ${tema.sombra} p-5 backdrop-blur-xl`}
    >
      <p
        className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${tema.rotulo}`}
      >
        <span className={`h-2 w-2 animate-pulse rounded-full ${tema.ponto}`} />
        {passou ? "Passou do horário de voltar" : "Você está em almoço"}
      </p>

      <p className={`mt-2 font-mono text-[44px] font-bold leading-none tabular-nums ${tema.numero}`}>
        {passou ? "+" : ""}
        {formatar(segundos)}
      </p>

      <p className="mt-2.5 text-sm text-slate-600">
        {passou ? "Você deveria ter voltado às " : "Volte às "}
        <strong className="font-bold text-slate-900">{horaRetorno}</strong>
        <span className="text-slate-400"> · saiu às {horaSaida}</span>
      </p>

      {!passou && (
        <a
          href={urlLembrete}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-md transition active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)" }}
        >
          Criar lembrete 5 min antes
        </a>
      )}
    </section>
  )
}
