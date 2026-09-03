"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useVozAtiva } from "@/lib/tts-audio"

interface EmojisFlutuantesProps {
  /** Mensagem visual da IA. Os emojis dela é que sobem na tela. */
  texto?: string
  /** Quantas partículas subir. Padrão: 14. */
  quantidade?: number
  className?: string
}

/**
 * Extrai os emojis de um texto, preservando sequências compostas.
 *
 * Emoji não é um caractere só: ❤️ carrega um seletor de variação e 👩‍💻 é uma
 * emenda de dois pictogramas com ZWJ no meio. Partir por caractere quebraria
 * esses casos na tela, então a regex casa a sequência inteira.
 */
export function extrairEmojis(texto?: string): string[] {
  if (!texto) return []
  try {
    const padrao = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu
    const achados = texto.match(padrao) || []
    return achados.map((e) => e.trim()).filter(Boolean)
  } catch {
    // Navegador sem suporte a property escapes: sem emoji flutuante, sem drama.
    return []
  }
}

interface Particula {
  id: number
  emoji: string
  esquerda: number
  atraso: number
  duracao: number
  tamanho: number
  deriva: number
}

/**
 * Emojis da saudação subindo pela tela enquanto a IA fala.
 *
 * Só aparece quando há voz tocando e quando a mensagem realmente traz emoji —
 * uma frase sem emoji não ganha enfeite genérico.
 */
export function EmojisFlutuantes({ texto, quantidade = 14, className = "" }: EmojisFlutuantesProps) {
  const estaFalando = useVozAtiva()
  const emojis = useMemo(() => extrairEmojis(texto), [texto])

  // Muda a cada nova fala, para as partículas reiniciarem em posições novas.
  const [rodada, setRodada] = useState(0)
  useEffect(() => {
    if (estaFalando) setRodada((r) => r + 1)
  }, [estaFalando])

  const particulas = useMemo<Particula[]>(() => {
    if (emojis.length === 0) return []
    return Array.from({ length: quantidade }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      esquerda: 4 + Math.random() * 92,
      atraso: Math.random() * 2.4,
      duracao: 3.6 + Math.random() * 2.4,
      tamanho: 26 + Math.random() * 30,
      deriva: (Math.random() - 0.5) * 90,
    }))
    // `rodada` entra de propósito: cada fala sorteia um layout novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emojis, quantidade, rodada])

  if (!estaFalando || particulas.length === 0) return null

  return (
    <div
      className={`fixed inset-0 z-40 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {particulas.map((p) => (
        <span
          key={`${rodada}-${p.id}`}
          className="ef-particula"
          style={
            {
              left: `${p.esquerda}%`,
              fontSize: `${p.tamanho}px`,
              animationDelay: `${p.atraso}s`,
              animationDuration: `${p.duracao}s`,
              "--ef-deriva": `${p.deriva}px`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}

      <style jsx>{`
        .ef-particula {
          position: absolute;
          bottom: -60px;
          line-height: 1;
          opacity: 0;
          filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
          animation-name: efSubir;
          animation-timing-function: cubic-bezier(0.32, 0.7, 0.35, 1);
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }

        @keyframes efSubir {
          0% {
            transform: translate3d(0, 0, 0) scale(0.65) rotate(-8deg);
            opacity: 0;
          }
          12% {
            opacity: 0.95;
          }
          70% {
            opacity: 0.9;
          }
          100% {
            transform: translate3d(var(--ef-deriva), -105vh, 0) scale(1.05) rotate(8deg);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ef-particula {
            animation-duration: 6s !important;
          }
        }
      `}</style>
    </div>
  )
}
