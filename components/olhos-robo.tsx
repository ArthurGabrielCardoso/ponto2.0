"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useVozAtiva, useNivelVoz } from "@/lib/tts-audio"

export type HumorOlhos = "padrao" | "feliz" | "cansado" | "bravo"

interface OlhosRoboProps {
  humor?: HumorOlhos
  /** Largura total do desenho, em px. A altura sai proporcional. */
  largura?: number
  cor?: string
  /** Olha sozinho para os lados de tempos em tempos. */
  ocioso?: boolean
  /** Pisca sozinho em intervalos aleatórios. */
  piscar?: boolean
  /** Cresce e encolhe junto com a voz da IA. */
  reagirAVoz?: boolean
  /** Direção fixa do olhar, de -1 a 1 em cada eixo. Desliga o modo ocioso. */
  olhar?: { x: number; y: number }
  className?: string
}

/**
 * Olhos de robô animados, inspirados na biblioteca FluxGarage/RoboEyes.
 *
 * O original é C++ para Arduino e desenha em display OLED monocromático, onde
 * pálpebra é simplesmente um retângulo preto pintado por cima do olho. Aqui o
 * fundo é gradiente e vidro, então as pálpebras são recortadas com máscara SVG:
 * o que some vira transparente e deixa ver o fundo, em vez de virar um borrão
 * escuro.
 *
 * O que veio do original: os quatro humores, o piscar automático em intervalo
 * aleatório e o modo ocioso que reposiciona o olhar sozinho. O que é daqui: a
 * reação à voz, ligada no mesmo medidor de amplitude que move a onda do rodapé,
 * para os olhos acompanharem a fala da IA.
 */
export function OlhosRobo({
  humor = "padrao",
  largura = 220,
  cor = "#ffffff",
  ocioso = true,
  piscar = true,
  reagirAVoz = false,
  olhar,
  className = "",
}: OlhosRoboProps) {
  const estaFalando = useVozAtiva()
  const nivelVoz = useNivelVoz()

  // === Geometria, toda derivada da largura ===
  const g = useMemo(() => {
    const larguraOlho = largura * 0.36
    const alturaOlho = larguraOlho
    const espaco = largura * 0.12
    const raio = larguraOlho * 0.3
    // Sobra em volta para o olhar se deslocar sem encostar na borda.
    const margemX = (largura - (larguraOlho * 2 + espaco)) / 2
    const altura = alturaOlho * 1.5
    const margemY = (altura - alturaOlho) / 2
    return {
      larguraOlho,
      alturaOlho,
      espaco,
      raio,
      margemX,
      margemY,
      altura,
      alcanceX: margemX * 0.75,
      alcanceY: margemY * 0.6,
    }
  }, [largura])

  // === Piscar automático ===
  const [fechado, setFechado] = useState(false)
  useEffect(() => {
    if (!piscar) return
    let cancelado = false
    const timers: number[] = []

    const agendar = () => {
      if (cancelado) return
      // Intervalo irregular: piscar em cadência fixa parece relógio, não vida.
      const espera = 2400 + Math.random() * 3600
      timers.push(
        window.setTimeout(() => {
          if (cancelado) return
          setFechado(true)
          timers.push(
            window.setTimeout(() => {
              setFechado(false)
              // De vez em quando sai uma piscada dupla.
              if (Math.random() < 0.25) {
                timers.push(
                  window.setTimeout(() => {
                    setFechado(true)
                    timers.push(window.setTimeout(() => setFechado(false), 90))
                  }, 130)
                )
              }
              agendar()
            }, 100)
          )
        }, espera)
      )
    }

    agendar()
    return () => {
      cancelado = true
      timers.forEach((t) => clearTimeout(t))
    }
  }, [piscar])

  // === Modo ocioso: reposiciona o olhar sozinho ===
  const [direcao, setDirecao] = useState({ x: 0, y: 0 })
  const olharFixoRef = useRef(olhar)
  olharFixoRef.current = olhar

  useEffect(() => {
    if (!ocioso || olhar) return
    let cancelado = false
    let timer: number

    const mover = () => {
      if (cancelado) return
      // Centro puxa mais que os cantos: olhar sempre torto fica esquisito.
      const sortear = () => (Math.random() < 0.4 ? 0 : Math.random() * 2 - 1)
      setDirecao({ x: sortear(), y: sortear() * 0.6 })
      timer = window.setTimeout(mover, 1600 + Math.random() * 2600)
    }

    timer = window.setTimeout(mover, 900)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [ocioso, olhar])

  const alvo = olhar ?? direcao
  const deslocX = Math.max(-1, Math.min(1, alvo.x)) * g.alcanceX
  const deslocY = Math.max(-1, Math.min(1, alvo.y)) * g.alcanceY

  // === Reação à voz ===
  // Faixa curta de propósito: os olhos respiram junto com a fala, não pulam.
  const vivo = reagirAVoz && estaFalando
  const escalaVoz = vivo ? 1 + nivelVoz * 0.08 : 1
  const abertura = fechado ? 0.08 : vivo ? 1 + nivelVoz * 0.06 : 1

  const idMascara = useMemo(() => `olhos-${Math.random().toString(36).slice(2, 9)}`, [])

  /** Pálpebra do humor, em coordenadas locais do olho. Preto = recortado. */
  const palpebra = (ladoEsquerdo: boolean) => {
    const { larguraOlho: w, alturaOlho: h } = g

    if (humor === "feliz") {
      // Curva rasa subindo pela base: o olho fecha por baixo, como quem sorri.
      // Raso de propósito — cortar fundo transforma o olho num arco de ponte.
      return (
        <rect
          x={-w * 0.3}
          y={h * 0.74}
          width={w * 1.6}
          height={h}
          rx={w * 0.8}
          fill="black"
        />
      )
    }

    // Pálpebras inclinadas. Os cortes são contidos: o olho tem que continuar
    // parecendo um olho com a pálpebra caindo, não virar uma cunha afiada.
    if (humor === "cansado") {
      // Peso no canto de FORA do rosto — o olhar caído de cansaço.
      const pontos = ladoEsquerdo
        ? `0,0 ${w},0 ${w},${h * 0.08} 0,${h * 0.44}`
        : `0,0 ${w},0 ${w},${h * 0.44} 0,${h * 0.08}`
      return <polygon points={pontos} fill="black" />
    }

    if (humor === "bravo") {
      // Peso no canto de DENTRO — a sobrancelha franzida em direção ao nariz.
      const pontos = ladoEsquerdo
        ? `0,0 ${w},0 ${w},${h * 0.46} 0,${h * 0.06}`
        : `0,0 ${w},0 ${w},${h * 0.06} 0,${h * 0.46}`
      return <polygon points={pontos} fill="black" />
    }

    return null
  }

  const olho = (ladoEsquerdo: boolean) => {
    const x = ladoEsquerdo ? g.margemX : g.margemX + g.larguraOlho + g.espaco
    const idLocal = `${idMascara}-${ladoEsquerdo ? "e" : "d"}`

    return (
      // O deslocamento vai por CSS, não pelo atributo transform do SVG:
      // atributo não recebe transição, e o olhar teleportaria de um lado ao
      // outro em vez de deslizar.
      <g
        style={{
          transform: `translate(${x + deslocX}px, ${g.margemY + deslocY}px)`,
          transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <mask id={idLocal}>
          <rect width={g.larguraOlho} height={g.alturaOlho} rx={g.raio} fill="white" />
          {palpebra(ladoEsquerdo)}
        </mask>
        <g
          style={{
            transform: `scaleY(${abertura})`,
            transformOrigin: `${g.larguraOlho / 2}px ${g.alturaOlho / 2}px`,
            transition: "transform 90ms ease-out",
          }}
        >
          <rect
            width={g.larguraOlho}
            height={g.alturaOlho}
            rx={g.raio}
            fill={cor}
            mask={`url(#${idLocal})`}
          />
        </g>
      </g>
    )
  }

  return (
    <svg
      className={className}
      width={largura}
      height={g.altura}
      viewBox={`0 0 ${largura} ${g.altura}`}
      aria-hidden="true"
      style={{
        overflow: "visible",
        transform: `scale(${escalaVoz})`,
        transition: "transform 120ms ease-out",
        filter: `drop-shadow(0 0 ${largura * 0.05}px ${cor}55)`,
      }}
    >
      {olho(true)}
      {olho(false)}
    </svg>
  )
}
