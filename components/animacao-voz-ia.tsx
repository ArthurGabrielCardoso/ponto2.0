"use client"

import React from "react"
import { useVozAtiva } from "@/lib/tts-audio"

interface AnimacaoVozIaProps {
  className?: string
}

/**
 * Micro-onda luminosa azul/ciano sutil fixada na borda inferior (bottom-0).
 * A base permanece 100% colada no rodapé e apenas a crista superior ondula suavemente (altura discreta de 6px a 10px).
 */
export function AnimacaoVozIa({ className = "" }: AnimacaoVozIaProps) {
  const estaFalando = useVozAtiva()

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 pointer-events-none transition-opacity duration-500 overflow-hidden ${
        estaFalando ? "opacity-100" : "opacity-0"
      } ${className}`}
      aria-hidden="true"
    >
      {/* 1. Brilho ambiente bem sutil e baixo no rodapé */}
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-cyan-500/20 to-transparent blur-sm" />

      {/* 2. Micro-onda SVG com base fixa no bottom-0 e topo ondulante discreto */}
      <div className="relative w-full h-[8px] sm:h-[10px] overflow-hidden">
        {/* Camada 1: Onda Suave Ciano/Azul com movimento contínuo horizontal apenas no topo */}
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-full text-cyan-400/60 wave-top-slow"
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
        >
          <path
            d="M0,15 Q150,5 300,15 T600,15 T900,15 T1200,15 L1200,40 L0,40 Z"
            fill="currentColor"
          />
        </svg>

        {/* Camada 2: Onda de Crista Brilhante com micro-oscilação superior */}
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-full text-blue-500/70 wave-top-fast"
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
        >
          <path
            d="M0,20 Q150,8 300,20 T600,20 T900,20 T1200,20 L1200,40 L0,40 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* 3. Linha de Borda Inferior Fina Colada na Margem Inferior */}
      <div className="relative w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-blue-500 shadow-[0_-1px_6px_rgba(34,211,238,0.8)]">
        <div className="absolute inset-0 bg-cyan-300 animate-pulse opacity-80" />
      </div>

      <style jsx>{`
        .wave-top-slow {
          animation: waveMoveHorizontal 4s linear infinite;
        }
        .wave-top-fast {
          animation: waveMoveHorizontalReverse 3s linear infinite;
        }

        @keyframes waveMoveHorizontal {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes waveMoveHorizontalReverse {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
