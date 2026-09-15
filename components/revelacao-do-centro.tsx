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
export const DURACAO_REVELACAO_MS = 550

const CSS = `
@property --raio-revelacao {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}
@keyframes revelarDoCentro {
  from { --raio-revelacao: 0%; }
  to   { --raio-revelacao: 160%; }
}
.revelar-do-centro {
  animation: revelarDoCentro .55s ease-out forwards;
  -webkit-mask-image: radial-gradient(circle at 50% 50%, black var(--raio-revelacao), transparent var(--raio-revelacao));
          mask-image: radial-gradient(circle at 50% 50%, black var(--raio-revelacao), transparent var(--raio-revelacao));
}
.abrir-do-centro {
  animation: revelarDoCentro .55s ease-out forwards;
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
