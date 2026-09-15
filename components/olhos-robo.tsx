"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useVozAtiva, useNivelVoz } from "@/lib/tts-audio"

export type HumorOlhos = "padrao" | "feliz" | "cansado" | "bravo"

/** Qual olho está fechado neste instante. */
type Piscada = "ambos" | "esquerdo" | "direito" | null

interface OlhosRoboProps {
  humor?: HumorOlhos
  /** Largura total do desenho, em px. A altura sai proporcional. */
  largura?: number
  cor?: string
  /** Olha sozinho para os lados de tempos em tempos. */
  ocioso?: boolean
  /** Pisca sozinho em intervalos aleatórios. */
  piscar?: boolean
  /** Deixa escapar piscadinhas de um olho só. Combina com tela ociosa. */
  piscadinha?: boolean
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
 * Do original vieram os quatro humores, o piscar automático em intervalo
 * aleatório e o modo ocioso que reposiciona o olhar sozinho. Daqui vieram a
 * reação à voz — ligada no mesmo medidor de amplitude que move a onda do
 * rodapé — e a piscadinha de um olho só.
 */
export function OlhosRobo({
  humor = "padrao",
  largura = 220,
  cor = "#ffffff",
  ocioso = true,
  piscar = true,
  piscadinha = false,
  reagirAVoz = false,
  olhar,
  className = "",
}: OlhosRoboProps) {
  const estaFalando = useVozAtiva()
  const nivelVoz = useNivelVoz()

  // === Geometria ===
  // Os olhos ocupam 70% da largura e o resto é margem. Essa sobra é o que
  // permite um deslocamento grande o bastante para o olhar realmente ler como
  // "olhando para o lado" — com pouca folga, o movimento some.
  const g = useMemo(() => {
    const larguraOlho = largura * 0.3
    const alturaOlho = larguraOlho
    const espaco = largura * 0.1
    const raio = larguraOlho * 0.3
    const margemX = (largura - (larguraOlho * 2 + espaco)) / 2
    const altura = alturaOlho * 1.7
    const margemY = (altura - alturaOlho) / 2
    return {
      larguraOlho,
      alturaOlho,
      espaco,
      raio,
      margemX,
      margemY,
      altura,
      alcanceX: margemX * 0.96,
      alcanceY: margemY * 1.32,
    }
  }, [largura])

  // === Piscar automático ===
  const [piscada, setPiscada] = useState<Piscada>(null)
  useEffect(() => {
    if (!piscar) return
    let cancelado = false
    const timers: number[] = []
    const esperar = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms))
    }

    const agendar = () => {
      if (cancelado) return
      // Intervalo irregular: piscar em cadência fixa parece relógio, não vida.
      esperar(2400 + Math.random() * 3600, () => {
        if (cancelado) return

        // De vez em quando sai uma piscadinha de um olho só — é o que dá o ar
        // de brincalhão na tela de espera.
        const soUmOlho = piscadinha && Math.random() < 0.3
        const alvo: Piscada = soUmOlho
          ? Math.random() < 0.5
            ? "esquerdo"
            : "direito"
          : "ambos"

        setPiscada(alvo)
        esperar(soUmOlho ? 230 : 100, () => {
          setPiscada(null)
          // Piscada dupla eventual, só quando foi com os dois olhos.
          if (!soUmOlho && Math.random() < 0.25) {
            esperar(130, () => {
              setPiscada("ambos")
              esperar(90, () => setPiscada(null))
            })
          }
          agendar()
        })
      })
    }

    agendar()
    return () => {
      cancelado = true
      timers.forEach((t) => clearTimeout(t))
    }
  }, [piscar, piscadinha])

  // === Modo ocioso: reposiciona o olhar sozinho ===
  const [direcao, setDirecao] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (!ocioso || olhar) return
    let cancelado = false
    let timer: number

    const mover = () => {
      if (cancelado) return
      // Sorteia com viés para os extremos: olhar meio torto não lê como olhar
      // para o lado, e o meio-termo é justamente o que não comunica nada.
      const sortear = () => {
        const r = Math.random()
        if (r < 0.3) return 0
        return (Math.random() < 0.5 ? -1 : 1) * (0.65 + Math.random() * 0.35)
      }
      setDirecao({ x: sortear(), y: sortear() * 0.7 })
      timer = window.setTimeout(mover, 1600 + Math.random() * 2600)
    }

    timer = window.setTimeout(mover, 900)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [ocioso, olhar])

  const alvo = olhar ?? direcao
  const dirX = Math.max(-1, Math.min(1, alvo.x))
  const dirY = Math.max(-1, Math.min(1, alvo.y))
  const deslocX = dirX * g.alcanceX
  const deslocY = dirY * (dirY > 0 ? g.alcanceY * 1.15 : g.alcanceY)

  // === Reação à voz ===
  // Faixa curta de propósito: os olhos respiram junto com a fala, não pulam.
  const vivo = reagirAVoz && estaFalando
  const escalaVoz = vivo ? 1 + nivelVoz * 0.08 : 1

  const idMascara = useMemo(() => `olhos-${Math.random().toString(36).slice(2, 9)}`, [])

  /*
   * AQUI EXISTIA A `palpebraDoOlhar`.
   *
   * Ela descia a pálpebra de cima quando o olhar ia para baixo, imitando um
   * olho de verdade. A imitação era correta e o efeito, errado: pálpebra
   * caída é a forma universal de desenhar tristeza ou sono, e o tablet
   * passava o dia inteiro parecendo abatido para quem chegava.
   *
   * Um robô simpático não precisa de anatomia. Sem ela o olhar para baixo é
   * só o olho descendo — lê menos como "olhando para baixo" e muito mais como
   * "acordado", que é o que esta tela precisa transmitir.
   */

  /** Pálpebra do humor, em coordenadas locais do olho. Preto = recortado. */
  const palpebra = (ladoEsquerdo: boolean) => {
    const { larguraOlho: w, alturaOlho: h } = g

    if (humor === "feliz") {
      // Curva rasa subindo pela base: o olho fecha por baixo, como quem sorri.
      // Raso de propósito — cortar fundo transforma o olho num arco de ponte.
      return (
        <rect x={-w * 0.3} y={h * 0.74} width={w * 1.6} height={h} rx={w * 0.8} fill="black" />
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

    // Os dois olhos são sempre do mesmo tamanho. O RoboEyes original tem uma
    // "curiosidade" que estica o olho do lado para onde se olha e encolhe o
    // outro; aqui ficou feio — um olho grande e um pequeno lê como defeito, não
    // como olhar. O que dá a direção é o deslocamento, que já é grande
    // (~45% da largura do olho) desde que a margem em volta foi aumentada.
    const fechado = piscada === "ambos" || piscada === (ladoEsquerdo ? "esquerdo" : "direito")
    const abertura = fechado ? 0.08 : vivo ? 1 + nivelVoz * 0.06 : 1

    return (
      // O deslocamento vai por CSS, não pelo atributo transform do SVG:
      // atributo não recebe transição, e o olhar teleportaria de um lado ao
      // outro em vez de deslizar.
      <g
        style={{
          transform: `translate(${x + deslocX}px, ${g.margemY + deslocY}px)`,
          // Seguir uma pessoa e vaguear sozinho pedem tempos diferentes. Com
          // `olhar` a posição vem da câmera, que atualiza umas três vezes por
          // segundo: uma transição de 520 ms ainda estaria a caminho do alvo
          // antigo quando o novo chega, e o olhar ficava sempre atrasado em
          // relação à pessoa — parecia que não seguia nada. 240 ms chega antes
          // da próxima leitura e o movimento vira acompanhamento de verdade.
          transition: olhar
            ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)"
            : "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)",
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
            transition: fechado
              ? "transform 90ms ease-out"
              : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
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
