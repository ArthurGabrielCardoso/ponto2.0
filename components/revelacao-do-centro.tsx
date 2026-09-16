"use client"

import { useEffect } from "react"

/**
 * Revelação do centro para fora — a mesma da VitallCam.
 *
 * O mecanismo é o do `PageRevealTransition` de lá, copiado de propósito em vez
 * de reinventado: uma custom property registrada com `@property` (sem ela o
 * navegador não interpola percentuais dentro de um gradiente) animando o raio
 * de uma máscara radial. O conteúdo aparece por dentro de um círculo que cresce
 * do centro até passar da tela.
 *
 * Duas direções, porque este projeto precisa das duas:
 *
 *   `revelar-do-centro`  — o conteúdo NOVO nasce dentro do círculo.
 *                          É a transição de rota da VitallCam. Aqui entra na
 *                          tela de ponto batido.
 *
 *   `abrir-do-centro`    — a camada de cima é REMOVIDA por um buraco que
 *                          cresce. Aqui é a película: a câmera já está
 *                          desenhada por baixo e vai aparecendo.
 *
 * Por que a película usa a segunda e não a primeira, já que o resultado visual
 * é o mesmo: mascarar a camada da película é mascarar um gradiente pintado;
 * mascarar o conteúdo seria mascarar o elemento de VÍDEO ao vivo, e o
 * compositor teria que reaplicar a máscara a cada quadro da câmera — na mesma
 * GPU que nesse instante roda o reconhecimento. Mesmo desenho, conta diferente.
 */
/**
 * RAIO QUE COBRE A TELA INTEIRA
 *
 * Em telas widescreen (16:9, tablets 1280x800 ou 1920x1080), 75% não alcança
 * os 4 cantos da tela retangular (a hipotenusa/distância do centro ao canto é maior).
 * 150% garante que o círculo se expanda completamente além de qualquer canto,
 * revelando 100% da tela sem vazar a camada anterior.
 */
const RAIO_QUE_COBRE_A_TELA = "150%"

/**
 * A curva também mudou. `ease-out` é rápido no começo e lento no fim — para uma
 * revelação a partir do centro, isso estoura o círculo logo de cara e come
 * justamente o momento em que ele é pequeno.
 *
 * `cubic-bezier(0.65, 0, 0.35, 1)` sai devagar e chega devagar. É a mesma curva
 * do SplashScreen da VitallCam, então as duas telas se movem com o mesmo
 * sotaque.
 */
const CURVA = "cubic-bezier(0.65, 0, 0.35, 1)"

/** A película é mais curta: ela corre por cima do primeiro passe do reconhecimento. */
export const DURACAO_ABERTURA_MS = 700
/** A tela de sucesso pode respirar: nesse ponto não há mais nada disputando GPU. */
export const DURACAO_REVELACAO_MS = 900

/**
 * A CURVA COM QUIQUE, E POR QUE ELA MUDA TUDO
 *
 * `cubic-bezier(0.65, 0, 0.35, 1)` chega no destino e para. É correto e é
 * morto: nada no mundo físico para assim. Um corpo com massa passa um fio
 * além do ponto e volta.
 *
 * O terceiro número aqui é 1.2, acima de 1 — é isso que faz a curva
 * ultrapassar e assentar. O excesso é pequeno de propósito: o suficiente para
 * o olho ler "isso tem peso", longe do quique de desenho animado.
 */
const CURVA_QUIQUE = "cubic-bezier(0.22, 1.2, 0.36, 1)"

/**
 * O DESENCONTRO
 *
 * Duas coisas que começam juntas parecem uma máquina. As MESMAS duas com um
 * décimo de segundo entre elas parecem vivas. É o truque mais barato e mais
 * eficaz da animação da Apple, e é literalmente um `animation-delay`.
 *
 * Aqui: o círculo abre primeiro, o conteúdo assenta atrás. Quem olha não
 * percebe o atraso — percebe profundidade.
 */
const ATRASO_CONTEUDO_MS = 120
const ATRASO_CONTEUDO_PELICULA_MS = 80

const CSS = `
@property --raio-revelacao {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}
@keyframes revelarDoCentro {
  from { --raio-revelacao: 0%; }
  to   { --raio-revelacao: ${RAIO_QUE_COBRE_A_TELA}; }
}
.revelar-do-centro {
  animation: revelarDoCentro ${DURACAO_REVELACAO_MS}ms ${CURVA} forwards;
  -webkit-mask-image: radial-gradient(circle at 50% 50%, black var(--raio-revelacao), transparent var(--raio-revelacao));
          mask-image: radial-gradient(circle at 50% 50%, black var(--raio-revelacao), transparent var(--raio-revelacao));
}
.abrir-do-centro {
  animation: revelarDoCentro ${DURACAO_ABERTURA_MS}ms ${CURVA} forwards;
  /* Promove a camada ANTES de a animação começar. Sem isto o navegador só
     cria a camada quando o primeiro quadro já pediu, e essa criação no meio
     do caminho é o soluço que se vê logo na largada. */
  will-change: transform, opacity, mask-image;
  -webkit-mask-image: radial-gradient(circle at 50% 50%, transparent var(--raio-revelacao), black var(--raio-revelacao));
          mask-image: radial-gradient(circle at 50% 50%, transparent var(--raio-revelacao), black var(--raio-revelacao));
}
/* === PROFUNDIDADE ===
   Uma camada só sendo revelada é um recorte. Duas camadas em profundidades
   diferentes, assentando com um pequeno desencontro, é a sensação de o mundo
   vir na tua direção — que é o que a tela de desbloqueio do iPhone faz.

   Só transform e opacity: as duas únicas propriedades que o navegador
   anima no compositor, sem repintar e sem tocar na thread principal. Num
   tablet que ao mesmo tempo decodifica vídeo e roda reconhecimento, essa
   distinção é a diferença entre fluido e travado. */
@keyframes assentarConteudo {
  from { transform: scale(0.93) translateY(14px); opacity: 0.55; }
  to   { transform: none; opacity: 1; }
}
.assentar-conteudo {
  animation: assentarConteudo ${DURACAO_REVELACAO_MS - ATRASO_CONTEUDO_MS}ms ${CURVA_QUIQUE} ${ATRASO_CONTEUDO_MS}ms both;
  will-change: transform, opacity;
}

/* A PELÍCULA SE AFASTA ENQUANTO ABRE
   
   O buraco crescendo, sozinho, é um recorte: a película fica parada e some
   por dentro. Somando um afastamento — ela cresce um pouco e desaparece — o
   painel deixa de ser um buraco e vira uma folha saindo da frente da câmera.
   Duas coisas na mesma camada, em curvas e tempos diferentes: é o desencontro
   de novo, pelo preço de uma animação a mais no compositor.
   
   A opacidade indo a zero tem um segundo efeito, mais discreto e talvez mais
   importante: ela dissolve a borda dura da máscara nos últimos quadros. Borda
   dura ampliada é justamente o que o olho lê como "serrilhado". */
@keyframes afastarPelicula {
  from { transform: scale(1); opacity: 1; }
  60%  { opacity: 0.82; }
  to   { transform: scale(1.14); opacity: 0; }
}
.afastar-pelicula {
  animation: afastarPelicula ${DURACAO_ABERTURA_MS}ms ${CURVA_QUIQUE} ${ATRASO_CONTEUDO_PELICULA_MS}ms both;
}

/* Sem @property a interpolação não acontece e o raio ficaria travado em 0%.
   Para 'revelar' isso esconderia o conteúdo, então a consulta abaixo desliga
   a máscara inteira — o conteúdo aparece direto, sem animação. */
@supports not (background: paint(algo)) {
  .revelar-do-centro, .abrir-do-centro {
    animation: none;
    -webkit-mask-image: none;
            mask-image: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .revelar-do-centro { animation: none; -webkit-mask-image: none; mask-image: none; }
  .abrir-do-centro { animation: none; opacity: 0; }
  .assentar-conteudo, .afastar-pelicula { animation: none; }
}
`

/**
 * Injeta o CSS uma única vez por página.
 *
 * Fora de qualquer componente animado de propósito: o `@property` precisa
 * existir antes de a animação começar, e re-inserir a folha a cada transição
 * reiniciaria a declaração no meio do caminho.
 */
export function useCssRevelacao() {
  useEffect(() => {
    if (document.head.querySelector("[data-revelacao-css]")) return
    const el = document.createElement("style")
    el.setAttribute("data-revelacao-css", "1")
    el.textContent = CSS
    document.head.appendChild(el)
  }, [])
}
