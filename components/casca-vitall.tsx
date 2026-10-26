"use client"

import React from "react"
import Image from "next/image"
import { X } from "lucide-react"
import { ESTILO_PELICULA } from "@/lib/pelicula"

/**
 * A casca das telas cheias do tablet, no padrão da pergunta de humor e da tela
 * de ponto batido, com uma regra: o fundo é a película.
 *
 *  - fundo IGUAL ao da tela de espera (`ESTILO_PELICULA`, o mesmo objeto): teal
 *    translúcido com desfoque, de modo que a câmera aparece de leve por trás;
 *  - topo: logo à esquerda; à direita, o tempo que resta e o botão de saída;
 *  - o conteúdo da tela vai no meio.
 *
 * Existe para a pergunta do tipo da batida e as telas da batida manual
 * ficarem com cara do resto do app, e para um ajuste de visual acontecer em
 * um lugar só.
 */

interface Props {
  children: React.ReactNode
  /** Segundos que faltam para a tela se fechar sozinha. Omitido: não mostra relógio. */
  restante?: number
  rotuloSair?: string
  onSair: () => void
  ariaLabel: string
  /** Qualquer toque devolve o tempo à pessoa (quem está digitando não pode ser interrompida). */
  onPointerDown?: () => void
  /** Dica curta ao lado do relógio, em telas largas. */
  dica?: string
}

export function CascaVitall({ children, restante, rotuloSair = "Cancelar", onSair, ariaLabel, onPointerDown, dica }: Props) {
  return (
    <div
      className="fixed inset-0 z-[55] flex h-screen w-screen select-none items-center justify-center overflow-hidden backdrop-blur-xl"
      style={ESTILO_PELICULA}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
    >
      {/* Conteúdo */}
      <div className="absolute inset-0 flex h-full w-full flex-col justify-between overflow-y-auto border-none p-4 sm:p-8 lg:p-10">
        <div className="relative z-10 mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between gap-4">
          {/* A logo é verde-azulada: sobre o teal ela some. O fundo claro
              (o mesmo branco do cabeçalho do dashboard) devolve a leitura. */}
          <span className="rounded-2xl bg-white/90 px-3 py-1.5 shadow-md">
            <Image src="/logo.png" alt="Logo" width={120} height={60} priority style={{ height: "auto" }} />
          </span>

          <div className="flex items-center gap-3 sm:gap-4">
            {dica && <span className="hidden text-xs text-white/75 sm:inline">{dica}</span>}
            {restante !== undefined && (
              <span className="text-xs font-medium tabular-nums text-white/80" aria-label="Tempo restante">
                {`${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, "0")}`}
              </span>
            )}
            <button
              type="button"
              onClick={onSair}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition-all hover:bg-white/20 hover:text-white active:scale-95 sm:text-sm"
            >
              <span>{rotuloSair}</span>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative z-10 mx-auto my-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-2 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
