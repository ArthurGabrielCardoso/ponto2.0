"use client"

import React from "react"
import { useVozAtiva } from "@/lib/tts-audio"

interface AnimacaoVozIaProps {
  className?: string
  variante?: "bottom_bar" | "borda" | string
}

/**
 * Onda leve azul na borda inferior quando a voz estiver falando.
 * Totalmente limpa: sem ícones de robô, sem badges, apenas a onda luminosa sutil azul/ciano.
 */
export function AnimacaoVozIa({ className = "", variante = "bottom_bar" }: AnimacaoVozIaProps) {
  const estaFalando = useVozAtiva()

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 pointer-events-none transition-all duration-500 overflow-hidden ${
        estaFalando ? "opacity-100" : "opacity-0"
      } ${className}`}
      aria-hidden="true"
    >
      {/* 1. Brilho ambiente difuso suave azul/ciano no rodapé */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-cyan-500/25 via-blue-500/10 to-transparent blur-md" />

      {/* 2. Barra de onda luminosa animada na borda inferior */}
      <div className="relative w-full h-[3px] sm:h-[4px] bg-gradient-to-r from-transparent via-cyan-400 to-blue-500 shadow-[0_-2px_15px_rgba(34,211,238,0.8)]">
        {/* Camada de onda pulsante */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-300 via-blue-400 to-sky-200 animate-pulse" />
      </div>

      {/* 3. Micro-ondas harmônicas dinâmicas de som centralizadas */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-1.5 h-6 px-4">
        {[0.1, 0.3, 0.5, 0.7, 0.9, 0.6, 0.4, 0.2].map((delay, idx) => (
          <span
            key={idx}
            className="w-1 rounded-full bg-cyan-300/80 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
            style={{
              animation: estaFalando ? `ondaAzulBottom 0.9s ease-in-out infinite alternate` : "none",
              animationDelay: `${delay}s`,
              height: estaFalando ? "16px" : "2px",
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes ondaAzulBottom {
          0% {
            height: 3px;
            opacity: 0.4;
          }
          50% {
            height: 18px;
            opacity: 1;
          }
          100% {
            height: 6px;
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  )
}
