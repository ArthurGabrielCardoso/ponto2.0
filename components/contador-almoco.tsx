"use client"

import React, { useEffect, useState } from "react"
import { IlustracaoPontoAnimada } from "@/components/ilustracoes-ponto-animadas"
import { AlarmeAlmoco } from "@/components/alarme-almoco"

interface ContadorAlmocoProps {
  /** Instante do retorno previsto, em ms desde a época. */
  retornoPrevistoMs: number
  /** Já formatados no fuso da clínica pelo servidor — não reformatar aqui. */
  horaSaida: string
  horaRetorno: string
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
 * A ilustração é a mesma do almoço na tela de ponto batido, para o celular e o
 * tablet falarem a mesma língua.
 *
 * Três estados, e a cor é o que se lê de longe: no tempo, acabando (últimos 10
 * minutos) e atrasado, este contando para cima.
 */
export function ContadorAlmoco({
  retornoPrevistoMs,
  horaSaida,
  horaRetorno,
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
    ? { borda: "border-rose-300", rotulo: "text-rose-700", numero: "text-rose-600", ponto: "bg-rose-500" }
    : acabando
      ? { borda: "border-amber-300", rotulo: "text-amber-800", numero: "text-amber-600", ponto: "bg-amber-500" }
      : { borda: "border-[#c69e6b]/60", rotulo: "text-[#a67c4e]", numero: "text-teal-700", ponto: "bg-teal-500" }

  return (
    <section
      className={`mb-2.5 rounded-lg border ${tema.borda} bg-white/85 p-5 shadow-lg backdrop-blur-xl`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${tema.rotulo}`}
          >
            <span className={`h-2 w-2 animate-pulse rounded-full ${tema.ponto}`} />
            {passou ? "Passou do horário" : "Você está em almoço"}
          </p>

          <p className={`mt-2 font-mono text-[42px] font-bold leading-none tabular-nums ${tema.numero}`}>
            {passou ? "+" : ""}
            {formatar(segundos)}
          </p>

          <p className="mt-2.5 text-sm text-slate-600">
            {passou ? "Deveria ter voltado às " : "Volte às "}
            <strong className="font-bold text-slate-900">{horaRetorno}</strong>
          </p>
          <p className="text-xs text-slate-400">saiu às {horaSaida}</p>
        </div>

        {/* A mesma ilustração de almoço da tela de ponto batido. */}
        <IlustracaoPontoAnimada
          tipo="Saída Almoço"
          className="-mr-1 -mt-2 h-24 w-24 shrink-0"
        />
      </div>

      {!passou && <AlarmeAlmoco retornoPrevistoMs={retornoPrevistoMs} minutosAntes={5} />}
    </section>
  )
}
