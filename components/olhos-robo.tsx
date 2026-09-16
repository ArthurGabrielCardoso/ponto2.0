"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useVozAtiva, useNivelVoz } from "@/lib/tts-audio"
import { Mola } from "@/lib/mola"

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
  //
  // Vai para uma ref, não para estado: quem consome é o laço de animação
  // abaixo, e um `setState` aqui re-renderizaria a árvore inteira de 2 em 2
  // segundos sem necessidade.
  const direcaoOciosaRef = useRef({ x: 0, y: 0 })
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
      direcaoOciosaRef.current = { x: sortear(), y: sortear() * 0.7 }
      acordarLaco()
      timer = window.setTimeout(mover, 1600 + Math.random() * 2600)
    }

    timer = window.setTimeout(mover, 900)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
    // `!!olhar` e não `olhar`: o objeto vem novo a cada render do pai, e com
    // ele na lista este efeito se desmontaria e remontaria 4 vezes por segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocioso, !!olhar])

  /*
   * ===================================================================
   * O OLHAR, QUADRO A QUADRO
   * ===================================================================
   *
   * Antes: cada leitura da câmera virava estado do React e o olho ia até lá
   * com uma `transition` CSS de 240 ms.
   *
   * O problema não era a duração. Era a estrutura. A câmera entrega posição
   * uma 3 a 5 vezes por segundo — o detector leva o tempo que leva e o laço é
   * serializado. Então a cada ~250 ms chegava um alvo novo e a transição
   * recomeçava do zero. Ela nunca terminava. O olho passava a vida indo para
   * onde a pessoa ESTAVA, e o resultado era aquela sensação de que ele não
   * acompanha nada.
   *
   * Agora são duas coisas separadas, em ritmos diferentes:
   *
   *   a câmera        →  só atualiza um ALVO (3-5x por segundo)
   *   este laço       →  persegue esse alvo a 60 quadros por segundo
   *
   * O movimento fica contínuo mesmo com leitura lenta, porque a suavidade
   * deixou de depender da taxa de amostragem.
   *
   * EXTRAPOLAÇÃO — o que tira o atraso que sobra
   *
   * Mesmo perfeito, o olho só sabe de uma posição ~250 ms velha. Quando alguém
   * atravessa a frente do tablet, 250 ms é bastante. Então, ao receber um alvo
   * novo, medimos a velocidade do rosto (quanto andou desde a leitura anterior,
   * dividido pelo tempo) e miramos um pouco ADIANTE dele. É o mesmo truque de
   * jogo em rede para esconder latência: não se mostra onde o outro estava,
   * mostra-se onde ele deve estar agora.
   *
   * O avanço é limitado de propósito. Extrapolar demais faz o olho ultrapassar
   * a pessoa e voltar quando ela para — pior que o atraso original.
   *
   * E tudo isto escreve DIRETO no DOM, via ref. Nenhum `setState` por quadro:
   * a 60fps isso re-renderizaria a árvore 60 vezes por segundo e roubaria a
   * thread principal justamente de quem precisa dela (a captura da câmera).
   */
  const grupoEsqRef = useRef<SVGGElement | null>(null)
  const grupoDirRef = useRef<SVGGElement | null>(null)
  const molaXRef = useRef<Mola | null>(null)
  const molaYRef = useRef<Mola | null>(null)
  const rafRef = useRef<number | null>(null)
  const ultimoQuadroRef = useRef(0)
  const leituraAnteriorRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const alvoRef = useRef({ x: 0, y: 0 })
  const seguindoRef = useRef(false)

  /** Quanto à frente da pessoa o olho mira, em segundos de movimento. */
  const AVANCO_S = 0.16
  /** Teto do avanço, em unidades de direção (-1..1). */
  const AVANCO_MAX = 0.42

  if (molaXRef.current === null) {
    molaXRef.current = new Mola(0, 120)
    molaYRef.current = new Mola(0, 120)
  }

  const desenhar = () => {
    const mx = molaXRef.current!
    const my = molaYRef.current!
    const dirX = Math.max(-1, Math.min(1, mx.valor))
    const dirY = Math.max(-1, Math.min(1, my.valor))
    const deslocX = dirX * g.alcanceX
    const deslocY = dirY * (dirY > 0 ? g.alcanceY * 1.15 : g.alcanceY)
    const y = g.margemY + deslocY
    if (grupoEsqRef.current) {
      grupoEsqRef.current.style.transform = `translate(${g.margemX + deslocX}px, ${y}px)`
    }
    if (grupoDirRef.current) {
      const x = g.margemX + g.larguraOlho + g.espaco + deslocX
      grupoDirRef.current.style.transform = `translate(${x}px, ${y}px)`
    }
  }

  const laco = (agora: number) => {
    const dt = ultimoQuadroRef.current ? (agora - ultimoQuadroRef.current) / 1000 : 1 / 60
    ultimoQuadroRef.current = agora
    const mx = molaXRef.current!
    const my = molaYRef.current!
    mx.avancar(dt)
    my.avancar(dt)
    desenhar()

    // Parou de mexer: desliga o laço até alguém trocar o alvo. Num tablet que
    // fica ligado o dia inteiro, um rAF girando à toa é bateria e thread
    // principal jogados fora.
    if (mx.parada && my.parada) {
      rafRef.current = null
      ultimoQuadroRef.current = 0
      return
    }
    rafRef.current = requestAnimationFrame(laco)
  }

  const acordarLaco = () => {
    const alvo = olharRef.current ? alvoRef.current : direcaoOciosaRef.current
    molaXRef.current!.definirAlvo(alvo.x)
    molaYRef.current!.definirAlvo(alvo.y)
    if (rafRef.current === null) {
      ultimoQuadroRef.current = 0
      rafRef.current = requestAnimationFrame(laco)
    }
  }

  // `olhar` chega como objeto novo a cada leitura; a ref evita recriar o laço.
  const olharRef = useRef(olhar)
  olharRef.current = olhar

  // Rigidez diferente para cada situação. Seguir um rosto pede mola dura
  // (chegar rápido). Vaguear sozinho pede mola mole, com um quique de leve —
  // é o que faz o olhar ocioso parecer curioso em vez de programado.
  useEffect(() => {
    if (olhar) {
      molaXRef.current!.definirRigidez(190, 0.08)
      molaYRef.current!.definirRigidez(190, 0.08)
    } else {
      molaXRef.current!.definirRigidez(42, 0.22)
      molaYRef.current!.definirRigidez(42, 0.22)
    }
  }, [!!olhar])

  // Chegou leitura nova da câmera: calcula o avanço e reaponta a mola.
  useEffect(() => {
    if (!olhar) {
      // Perdeu o rosto. Não volta ao centro de estalo: a mola do modo ocioso
      // assume e leva o olhar de volta com calma.
      if (seguindoRef.current) {
        seguindoRef.current = false
        leituraAnteriorRef.current = null
        direcaoOciosaRef.current = { x: 0, y: 0 }
      }
      acordarLaco()
      return
    }
    seguindoRef.current = true

    const agora = performance.now()
    const ant = leituraAnteriorRef.current
    let avX = 0
    let avY = 0
    if (ant) {
      const dt = (agora - ant.t) / 1000
      // Abaixo de 30 ms a divisão explode a velocidade por ruído de medida;
      // acima de 600 ms a leitura anterior é velha demais para dizer algo.
      if (dt > 0.03 && dt < 0.6) {
        avX = ((olhar.x - ant.x) / dt) * AVANCO_S
        avY = ((olhar.y - ant.y) / dt) * AVANCO_S
        avX = Math.max(-AVANCO_MAX, Math.min(AVANCO_MAX, avX))
        avY = Math.max(-AVANCO_MAX, Math.min(AVANCO_MAX, avY))
      }
    }
    leituraAnteriorRef.current = { x: olhar.x, y: olhar.y, t: agora }

    alvoRef.current = {
      x: Math.max(-1, Math.min(1, olhar.x + avX)),
      y: Math.max(-1, Math.min(1, olhar.y + avY)),
    }
    acordarLaco()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [olhar?.x, olhar?.y, olhar === null])

  // Posiciona antes do primeiro quadro pintado, para o olho não nascer no
  // canto e escorregar até o lugar.
  useEffect(() => {
    desenhar()
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      // Sem `transition` aqui, de propósito: quem move este grupo é o laço de
      // rAF acima, escrevendo `style.transform` a cada quadro. Uma transição
      // por cima brigaria com ele — o navegador tentaria interpolar entre dois
      // valores que já estão sendo interpolados, e o movimento sairia
      // borrachudo.
      //
      // O deslocamento continua indo por CSS e não pelo atributo `transform`
      // do SVG porque só a propriedade CSS entra no compositor.
      <g
        ref={ladoEsquerdo ? grupoEsqRef : grupoDirRef}
        style={{
          transform: `translate(${x}px, ${g.margemY}px)`,
          willChange: "transform",
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
