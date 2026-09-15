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
 * POR QUE O RAIO PARA EM 75%, E NÃO EM 160%
 *
 * Num `radial-gradient(circle at 50% 50%)` o raio em porcentagem é medido
 * contra sqrt((l² + a²) / 2), enquanto o canto mais distante do centro está a
 * sqrt(l² + a²) / 2. A razão entre os dois é sqrt(2)/2 — ou seja, **70,7%
 * cobre a tela inteira, em qualquer proporção**. É constante: 1280x800,
 * 1920x1080 ou retrato, dá sempre 70,7%.
 *
 * A primeira versão ia até 160%. A tela já estava completamente revelada com
 * ~44% do progresso, e o resto da animação crescia fora da tela, sem mostrar
 * nada. Era por isso que parecia apressada e parecia não sair do centro: só a
 * primeira fração era visível.
 *
 * 75% dá a margem de segurança e faz a duração inteira ser movimento que se vê.
 */
const RAIO_QUE_COBRE_A_TELA = "75%"

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
  -webkit-mask-image: radial-gradient(circle at 50% 50%, transparent var(--raio-revelacao), black var(--raio-revelacao));
          mask-image: radial-gradient(circle at 50% 50%, transparent var(--raio-revelacao), black var(--raio-revelacao));
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
