"use client"

import React from "react"
import { useVozAtiva } from "@/lib/tts-audio"

interface AnimacaoVozIaProps {
  className?: string
}

/**
 * Onda luminosa azul/ciano orgânica e ultra-fluida na borda inferior da tela.
 * Movimenta-se com suaves oscilações de altura e fluxo harmônico enquanto a voz fala.
 */
export function AnimacaoVozIa({ className = "" }: AnimacaoVozIaProps) {
  const estaFalando = useVozAtiva()

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 pointer-events-none transition-opacity duration-700 overflow-hidden ${
        estaFalando ? "opacity-100" : "opacity-0"
      } ${className}`}
      aria-hidden="true"
    >
      {/* 1. Halo difuso suave azul/ciano ascendente */}
      <div className="absolute bottom-0 left-0 right-0 h-14 sm:h-16 bg-gradient-to-t from-cyan-500/25 via-blue-500/10 to-transparent blur-xl transition-all duration-1000" />

      {/* 2. Camadas de Ondas SVG Fluidas e Orgânicas com Movimento Suave de Altura */}
      <div className="relative w-full h-8 sm:h-10 overflow-hidden">
        {/* Onda 1: Fundo Suave Azul Profundo */}
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-full text-blue-500/35 wave-animation-slow"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,40 C150,90 350,-10 500,40 C650,90 850,-10 1000,40 C1150,90 1200,30 1200,40 L1200,120 L0,120 Z"
            fill="currentColor"
          />
        </svg>

        {/* Onda 2: Camada Intermediária Ciano com Elevação Suave */}
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-full text-cyan-400/50 wave-animation-mid"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,60 C200,10 400,90 600,45 C800,0 1000,85 1200,45 L1200,120 L0,120 Z"
            fill="currentColor"
          />
        </svg>

        {/* Onda 3: Linha de Crista Brilhante Neon */}
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-full text-cyan-300/80 wave-animation-fast filter drop-shadow-[0_-2px_10px_rgba(34,211,238,0.9)]"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,75 C250,30 450,100 700,55 C950,10 1100,85 1200,60 L1200,120 L0,120 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* 3. Linha de Borda Inferior de Alta Intensidade com Micro-Ondulações */}
      <div className="relative w-full h-[3px] bg-gradient-to-r from-transparent via-cyan-300 to-blue-400 shadow-[0_-2px_20px_rgba(34,211,238,1)]">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-sky-200 to-cyan-300 animate-pulse opacity-90" />
      </div>

      <style jsx>{`
        .wave-animation-slow {
          animation: waveMove 6s linear infinite, wavePulseHeight 3s ease-in-out infinite alternate;
        }
        .wave-animation-mid {
          animation: waveMoveReverse 4.5s linear infinite, wavePulseHeight 2.5s ease-in-out infinite alternate;
        }
        .wave-animation-fast {
          animation: waveMove 3s linear infinite, wavePulseHeight 2s ease-in-out infinite alternate;
        }

        @keyframes waveMove {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes waveMoveReverse {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }

        @keyframes wavePulseHeight {
          0% {
            transform: scaleY(0.65) translateY(4px);
            opacity: 0.6;
          }
          50% {
            transform: scaleY(1.15) translateY(-2px);
            opacity: 0.95;
          }
          100% {
            transform: scaleY(0.8) translateY(2px);
            opacity: 0.75;
          }
        }
      `}</style>
    </div>
  )
}
