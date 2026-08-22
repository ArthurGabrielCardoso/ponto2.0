"use client"

import React from "react"
import { useVozAtiva } from "@/lib/tts-audio"
import { Sparkles, Bot } from "lucide-react"

interface AnimacaoVozIaProps {
  className?: string
  variante?: "badge" | "ondas" | "orb" | "completo"
  label?: string
}

export function AnimacaoVozIa({
  className = "",
  variante = "completo",
  label = "Assistente de Voz Ativa",
}: AnimacaoVozIaProps) {
  const estaFalando = useVozAtiva()

  return (
    <div className={`inline-flex items-center gap-2.5 transition-all duration-500 select-none ${className}`}>
      {/* 1. Orbe / Ícone com Pulso de Energia Dourado & Ciano */}
      <div className="relative flex items-center justify-center">
        {estaFalando && (
          <>
            <span className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-amber-400 via-teal-300 to-amber-500 opacity-75 blur-sm animate-pulse" />
            <span className="absolute -inset-3 rounded-full bg-teal-400/20 blur-md animate-ping" />
          </>
        )}
        <div
          className={`relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all duration-300 ${
            estaFalando
              ? "bg-gradient-to-tr from-amber-500/40 via-teal-500/30 to-amber-300/40 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.6)] scale-105"
              : "bg-white/10 border-white/20 text-white/70"
          }`}
        >
          {estaFalando ? (
            <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-spin" style={{ animationDuration: "3s" }} />
          ) : (
            <Bot className="w-3.5 h-3.5 text-white/80" />
          )}
        </div>
      </div>

      {/* 2. Visualizador de Ondas Sonoras Dinâmicas */}
      <div className="flex items-center gap-1 h-5 px-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-1 rounded-full transition-all duration-200 ${
              estaFalando
                ? "bg-gradient-to-t from-amber-400 to-teal-300 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                : "bg-white/30 h-1.5"
            }`}
            style={
              estaFalando
                ? {
                    animation: `soundWave 0.8s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.15}s`,
                    minHeight: "4px",
                  }
                : undefined
            }
          />
        ))}
      </div>

      {/* 3. Badge de Texto Inteligente */}
      {variante !== "ondas" && (
        <span
          className={`text-xs font-semibold tracking-wide transition-colors ${
            estaFalando
              ? "text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
              : "text-white/60"
          }`}
        >
          {estaFalando ? "Assistente Falando..." : label}
        </span>
      )}

      <style jsx>{`
        @keyframes soundWave {
          0% {
            height: 4px;
          }
          50% {
            height: 18px;
          }
          100% {
            height: 8px;
          }
        }
      `}</style>
    </div>
  )
}
