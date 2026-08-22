"use client"

import React, { useState } from "react"
import { Sparkles, Heart } from "lucide-react"

export interface OpcaoHumor {
  id: string
  emoji: string
  label: string
  corHover: string
}

export const OPCOES_HUMOR: OpcaoHumor[] = [
  { id: "animado", emoji: "🚀", label: "A todo vapor!", corHover: "hover:bg-amber-500/25 hover:border-amber-400/60" },
  { id: "excelente", emoji: "😄", label: "Excelente!", corHover: "hover:bg-emerald-500/25 hover:border-emerald-400/60" },
  { id: "bem", emoji: "🙂", label: "Tudo bem!", corHover: "hover:bg-blue-500/25 hover:border-blue-400/60" },
  { id: "cafe", emoji: "☕", label: "Preciso de café!", corHover: "hover:bg-orange-500/25 hover:border-orange-400/60" },
  { id: "sono", emoji: "😴", label: "Com soninho!", corHover: "hover:bg-purple-500/25 hover:border-purple-400/60" },
]

interface CheckinHumorProps {
  nome?: string
  onSelecionar: (humorId: string, label: string) => void
  selecionadoId?: string | null
}

export function CheckinHumor({ nome, onSelecionar, selecionadoId }: CheckinHumorProps) {
  const [selecionado, setSelecionado] = useState<string | null>(selecionadoId || null)
  const primeiroNome = (nome || "").split(" ")[0]

  const handleClique = (opcao: OpcaoHumor) => {
    setSelecionado(opcao.id)
    onSelecionar(opcao.id, opcao.label)
  }

  return (
    <div className="w-full max-w-xl mx-auto mt-4 p-4 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/20 shadow-lg text-center animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
        <span className="text-sm font-medium text-white/90">
          {primeiroNome ? `Como você está se sentindo hoje, ${primeiroNome}?` : "Como você está se sentindo hoje?"}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {OPCOES_HUMOR.map((opcao) => {
          const isAtivo = selecionado === opcao.id
          return (
            <button
              key={opcao.id}
              type="button"
              onClick={() => handleClique(opcao)}
              className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl transition-all duration-300 active:scale-95 group cursor-pointer border ${
                isAtivo
                  ? "bg-amber-400/30 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)] scale-105"
                  : `bg-black/30 border-white/10 ${opcao.corHover}`
              }`}
            >
              <span className="text-2xl sm:text-3xl transition-transform duration-300 group-hover:scale-125 group-active:scale-95 filter drop-shadow">
                {opcao.emoji}
              </span>
              <span
                className={`text-[10px] sm:text-xs mt-1.5 font-medium leading-tight line-clamp-1 transition-colors ${
                  isAtivo ? "text-amber-200 font-bold" : "text-white/70 group-hover:text-white"
                }`}
              >
                {opcao.label}
              </span>
            </button>
          )
        })}
      </div>

      {selecionado && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-amber-200 animate-in fade-in duration-300">
          <Heart className="w-3.5 h-3.5 fill-amber-300 text-amber-300 animate-bounce" />
          <span>Obrigado pelo carinho e pela energia compartilhada!</span>
        </div>
      )}
    </div>
  )
}
