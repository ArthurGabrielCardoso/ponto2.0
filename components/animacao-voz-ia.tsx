"use client"

import React from "react"
import { useVozAtiva, useNivelVoz } from "@/lib/tts-audio"

interface AnimacaoVozIaProps {
  className?: string
  /** Largura da barra em relação à tela. Padrão: 60%. */
  largura?: string
}

/**
 * Onda luminosa azul/ciano da voz da IA, centralizada na borda inferior.
 *
 * Não ocupa a largura toda de propósito: uma faixa de 60% centralizada lê como
 * "a IA está falando" em vez de virar moldura da tela.
 *
 * A altura acompanha a intensidade real da voz (useNivelVoz mede a amplitude do
 * áudio), então a onda cresce e encolhe junto com a fala. A variação é contida
 * — poucos pixels e um respiro mínimo na largura — para pulsar sem chamar mais
 * atenção que a mensagem na tela.
 */
export function AnimacaoVozIa({ className = "", largura = "60%" }: AnimacaoVozIaProps) {
  const estaFalando = useVozAtiva()
  const nivel = useNivelVoz()

  // Faixas estreitas: a onda respira, não salta.
  const alturaOnda = 7 + nivel * 13 // 7px em silêncio → 20px no pico
  const escalaX = 1 + nivel * 0.035 // no máximo 3,5% mais larga
  const brilho = 0.45 + nivel * 0.5

  return (
    <div
      className={`fixed bottom-0 left-1/2 z-50 pointer-events-none transition-opacity duration-500 ${
        estaFalando ? "opacity-100" : "opacity-0"
      } ${className}`}
      style={{
        width: largura,
        transform: `translateX(-50%) scaleX(${escalaX})`,
        transition: "transform 120ms ease-out, opacity 500ms ease",
      }}
      aria-hidden="true"
    >
      {/* 1. Brilho ambiente sob a faixa, também acompanhando a voz */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-500/25 to-transparent blur-md rounded-t-full"
        style={{
          height: `${alturaOnda + 10}px`,
          opacity: brilho,
          transition: "height 120ms ease-out, opacity 120ms ease-out",
        }}
      />

      {/* 2. Ondas em movimento, com a altura reagindo à intensidade da fala */}
      <div
        className="relative w-full overflow-hidden rounded-t-2xl"
        style={{
          height: `${alturaOnda}px`,
          transition: "height 120ms ease-out",
        }}
      >
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-full text-cyan-400/60 wave-top-slow"
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
        >
          <path d="M0,15 Q150,5 300,15 T600,15 T900,15 T1200,15 L1200,40 L0,40 Z" fill="currentColor" />
        </svg>

        <svg
          className="absolute bottom-0 left-0 w-[200%] h-full text-blue-500/70 wave-top-fast"
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
        >
          <path d="M0,20 Q150,8 300,20 T600,20 T900,20 T1200,20 L1200,40 L0,40 Z" fill="currentColor" />
        </svg>
      </div>

      {/* 3. Linha de base: pontas esmaecidas, já que a faixa agora tem começo e fim */}
      <div
        className="relative w-full h-[2px] rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
        style={{
          boxShadow: `0 -1px ${4 + nivel * 10}px rgba(34, 211, 238, ${brilho})`,
          transition: "box-shadow 120ms ease-out",
        }}
      />

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
