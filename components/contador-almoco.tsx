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
 * É a mesma informação que o tablet já mostra na proteção de tela, resolvendo o
 * problema real: quem sobe para comer não lembra a que horas tem que voltar, e
 * o tablet ficou lá embaixo.
 *
 * O botão de lembrete gera um arquivo de calendário em vez de pedir permissão
 * de notificação. No iPhone, notificação web só funciona se o site for
 * instalado na tela de início — e mesmo assim exige toda a infraestrutura de
 * web push. Um evento de calendário com alarme funciona hoje, em qualquer
 * telefone, e continua avisando com a tela bloqueada e o navegador fechado.
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

  return (
    <section
      className={`mb-5 rounded-2xl border p-5 ${
        passou
          ? "border-red-400/40 bg-red-500/10"
          : acabando
            ? "border-amber-400/40 bg-amber-500/10"
            : "border-emerald-400/30 bg-emerald-500/10"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wider text-white/50">
        {passou ? "Passou do horário de voltar" : "Você está em almoço"}
      </p>

      <p
        className={`mt-1 font-mono text-4xl font-bold tabular-nums ${
          passou ? "text-red-300" : acabando ? "text-amber-200" : "text-emerald-200"
        }`}
      >
        {passou ? "+" : ""}
        {formatar(segundos)}
      </p>

      <p className="mt-1.5 text-sm text-white/70">
        {passou ? "Você deveria ter voltado às " : "Volte às "}
        <strong className="font-semibold text-white">{horaRetorno}</strong>
        <span className="text-white/40"> · saiu às {horaSaida}</span>
      </p>

      {!passou && (
        <a
          href={urlLembrete}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 active:scale-[0.98]"
        >
          ⏰ Criar lembrete 5 min antes
        </a>
      )}
    </section>
  )
}
