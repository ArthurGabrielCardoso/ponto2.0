"use client"

import React, { useState } from "react"

export interface BatidaDoDia {
  id: string
  hora: string
  tipo: string
}

export interface DiaDePonto {
  chave: string
  diaMes: string
  diaSemana: string
  ehHoje: boolean
  batidas: BatidaDoDia[]
  trabalhadas: string
  esperadas: string
  temCargaPrevista: boolean
  proporcao: number
  saldoMinutos: number
  saldoTexto: string
}

interface ListaDiasPontoProps {
  dias: DiaDePonto[]
  /** Quantos dias aparecem antes do botão "ver mais". */
  janelaInicial?: number
}

function corDoTipo(tipo: string): string {
  const t = (tipo || "").toLowerCase()
  if (t.includes("retorno")) return "bg-teal-500"
  if (t.includes("almoço") || t.includes("almoco")) return "bg-amber-500"
  if (t.includes("entrada")) return "bg-teal-600"
  return "bg-[#c69e6b]"
}

/**
 * Os dias do mês em linhas compactas.
 *
 * Um mês fechado tem mais de vinte dias com ponto. Mostrar cada um aberto, com
 * as batidas e a barra, dava uma rolagem interminável num celular — a pessoa
 * abre isso para ver o saldo, não para auditar o mês inteiro.
 *
 * Então cada dia é uma linha de uma altura só: data, bolinhas indicando quantas
 * batidas teve, horas e saldo. Tocar abre os horários daquele dia. O dia de
 * hoje já vem aberto, porque é o único que ainda está mudando. E a lista começa
 * com uma janela dos dias recentes, com o resto atrás de um botão.
 */
export function ListaDiasPonto({ dias, janelaInicial = 7 }: ListaDiasPontoProps) {
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(dias.filter((d) => d.ehHoje).map((d) => d.chave))
  )
  const [mostrarTudo, setMostrarTudo] = useState(false)

  const visiveis = mostrarTudo ? dias : dias.slice(0, janelaInicial)
  const escondidos = dias.length - visiveis.length

  const alternar = (chave: string) => {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  return (
    <div>
      <ul className="space-y-1.5">
        {visiveis.map((d) => {
          const aberto = abertos.has(d.chave)
          return (
            <li
              key={d.chave}
              className={`overflow-hidden rounded-lg border bg-white/85 backdrop-blur-xl ${
                d.ehHoje ? "border-[#c69e6b]/70 ring-1 ring-[#c69e6b]/40" : "border-white/70"
              }`}
            >
              <button
                type="button"
                onClick={() => alternar(d.chave)}
                aria-expanded={aberto}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left active:bg-black/[0.03]"
              >
                <span className="w-[52px] shrink-0 text-[15px] font-bold tabular-nums text-slate-900">
                  {d.diaMes}
                </span>

                <span className="w-[34px] shrink-0 text-[11px] uppercase text-slate-500">
                  {d.diaSemana.slice(0, 3)}
                </span>

                {/* As bolinhas dizem quantas batidas o dia teve, e de que tipo,
                    sem gastar altura com texto. Quatro bolinhas e um dia
                    completo; duas e um dia pela metade. */}
                <span className="flex flex-1 items-center gap-1">
                  {d.batidas.map((b) => (
                    <span key={b.id} className={`h-1.5 w-1.5 rounded-full ${corDoTipo(b.tipo)}`} />
                  ))}
                </span>

                <span className="shrink-0 text-[13px] tabular-nums text-slate-500">
                  {d.trabalhadas}
                </span>

                <span
                  className={`w-[62px] shrink-0 text-right text-[13px] font-bold tabular-nums ${
                    d.saldoMinutos < 0 ? "text-rose-600" : "text-teal-700"
                  }`}
                >
                  {d.saldoTexto}
                </span>
              </button>

              {aberto && (
                <div className="border-t border-black/5 px-3.5 pb-3 pt-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {d.batidas.map((b) => (
                      <span
                        key={b.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-black/[0.04] px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${corDoTipo(b.tipo)}`} />
                        <span className="tabular-nums">{b.hora}</span>
                        <span className="font-normal text-slate-500">{b.tipo}</span>
                      </span>
                    ))}
                  </div>

                  {d.temCargaPrevista ? (
                    <>
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-black/8">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${d.proporcao * 100}%`,
                            background: "linear-gradient(90deg, #c69e6b 0%, #14b8a6 100%)",
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        {d.trabalhadas} de {d.esperadas} previstas
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-500">
                      {d.trabalhadas} trabalhadas · dia sem carga prevista
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {escondidos > 0 && (
        <button
          type="button"
          onClick={() => setMostrarTudo(true)}
          className="mt-2.5 w-full rounded-lg border border-white/70 bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 backdrop-blur-xl active:scale-[0.99]"
        >
          Ver os outros {escondidos} {escondidos === 1 ? "dia" : "dias"} do mês
        </button>
      )}
    </div>
  )
}
