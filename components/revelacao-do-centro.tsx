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
 * A CONTA, porque ela é contra-intuitiva e já foi refeita errada duas vezes
 * neste arquivo:
 *
 * Num `radial-gradient(circle at 50% 50%)` um raio em porcentagem NÃO é medido
 * contra a largura nem contra a diagonal. O CSS resolve porcentagem de círculo
 * contra sqrt((l² + a²) / 2). O canto mais distante do centro, por sua vez,
 * está a sqrt(l² + a²) / 2.
 *
 *     razão = [sqrt(l²+a²)/2] ÷ [sqrt((l²+a²)/2)] = sqrt(2)/2 = 0,7071
 *
 * Os termos l e a se cancelam. **70,71% alcança o canto em QUALQUER
 * proporção** — 1280x800, 1920x1080, retrato, quadrado. Não existe tela
 * widescreen em que 75% não chegue ao canto; a razão é constante.
 *
 * POR QUE 150% ESTRAGAVA A ANIMAÇÃO
 *
 * Se 70,71% já cobre tudo, um raio final de 150% quer dizer que a tela está
 * inteiramente revelada aos 47% do progresso. Os outros 53% da animação
 * crescem fora da tela, sem mostrar nada. Numa animação de 900 ms sobravam
 * ~430 ms de movimento visível — e era exatamente essa a queixa de que a
 * transição estava rápida demais. Aumentar a duração teria tratado o sintoma:
 * metade do tempo novo também iria para fora da tela.
 *
 * POR QUE 90% E NÃO 75%
 *
 * 90% dá 27% de margem sobre o necessário, contra 6% dos 75%. A margem existe
 * porque a versão de 150% foi escrita para resolver um vazamento observado na
 * tela, e eu não consigo reproduzir esse vazamento daqui — pode ter sido
 * anti-aliasing no pixel exato da borda, pode ter sido viewport visual
 * diferente do de layout no WebView. Com 90% o círculo ultrapassa o canto com
 * folga larga e ainda assim ~79% da animação é movimento que se vê, contra
 * 47% antes.
 */
const RAIO_QUE_COBRE_A_TELA = "90%"

/**
 * Duração da animação, com atalho para calibrar no próprio tablet.
 *
 * Duração de animação não se decide por raciocínio — se decide olhando. E quem
 * olha é o Arthur, no tablet; eu só consigo escrever números. Cada tentativa
 * custava um commit, um build, uma promoção e um teste, uns dez minutos para
 * descobrir que ainda estava rápido.
 *
 * Com `?abertura=1400&revelacao=1800` na URL ele percorre a faixa inteira em um
 * minuto e me diz o número certo, que aí vira o padrão daqui.
 *
 * Inerte sem o parâmetro. Os limites impedem que um dedo errado na barra de
 * endereço deixe a tela presa numa animação de meia hora.
 */
function lerDuracao(chave: string, padrao: number): number {
  try {
    if (typeof window === "undefined") return padrao
    const v = new URLSearchParams(window.location.search).get(chave)
    if (!v) return padrao
    const n = Number(v)
    if (!Number.isFinite(n)) return padrao
    return Math.max(150, Math.min(4000, Math.round(n)))
  } catch {
    return padrao
  }
}

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

/**
 * Durações.
 *
 * Subiram junto com a correção do raio, e as duas mudanças se somam: com o
 * raio em 90% em vez de 150%, ~79% da duração vira movimento visível em vez de
 * 47%. Na prática a película saiu de ~330 ms de movimento que se vê para
 * ~830 ms, e a tela de sucesso de ~430 ms para ~1070 ms.
 *
 * Nada disto atrasa a batida: as duas camadas são `pointer-events: none` e
 * todo o estado do app muda de forma síncrona no toque. A animação corre por
 * cima de um app que já está funcionando por baixo.
 */
export const DURACAO_ABERTURA_MS = lerDuracao("abertura", 1050)
/** A tela de sucesso pode respirar: nesse ponto não há mais nada disputando GPU. */
export const DURACAO_REVELACAO_MS = lerDuracao("revelacao", 1350)

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

/* AQUI EXISTIU UM "afastar-pelicula".

   Ele somava ao buraco um afastamento: a película crescia 14% e sumia, para
   parecer uma folha saindo da frente da câmera em vez de um recorte. A ideia
   se sustentava no papel, e o Arthur foi direto ao ponto ao ver na tela: a
   película deixava de parecer película. O que ele queria era a mesma abertura
   de antes, mais bem feita — não um gesto diferente.

   Fica registrado porque a lição vale para o resto do arquivo. Dá para
   raciocinar no escuro sobre suavidade e sobre custo de GPU. Sobre o que uma
   animação COMUNICA, não dá: isso só se decide olhando. */

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
  .assentar-conteudo { animation: none; }
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
