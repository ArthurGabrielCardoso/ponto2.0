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
 * ATÉ ONDE O CÍRCULO PRECISA CRESCER
 *
 * ERRO QUE JÁ FOI COMETIDO DUAS VEZES AQUI, EM DIREÇÕES OPOSTAS:
 *
 * A máscara é `radial-gradient(circle at 50% 50%, black X, transparent X)`.
 * Repare que NENHUM tamanho de círculo é declarado. Sem tamanho, o CSS usa
 * `farthest-corner`: a linha do gradiente vai do centro até o canto mais
 * distante da caixa.
 *
 * Logo, esse X **não é um raio**. É posição de parada ao longo dessa linha —
 * e 100% já é, por definição, o canto. Qualquer valor abaixo de 100% deixa os
 * cantos de fora, e a falha aparece primeiro perto do topo e da base, onde a
 * borda do círculo corta a tela em curva.
 *
 * A regra do sqrt(2)/2 — "70,71% cobre qualquer proporção" — é verdadeira,
 * mas para RAIO EXPLÍCITO de círculo, que não é o caso deste gradiente.
 * Aplicá-la aqui foi o que produziu as versões de 75% e de 90%, as duas com
 * borda sobrando na tela. A versão de 150% que veio antes delas estava certa
 * pelo motivo certo.
 *
 * O mínimo real é 100%. 112% dá margem para anti-aliasing no pixel da borda e
 * para o viewport visual do WebView diferir do de layout, e ainda deixa 89% da
 * animação (100/112) acontecendo dentro da tela.
 */
const RAIO_QUE_COBRE_A_TELA = lerNumero("raio", 112, 100, 250) + "%"

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
function lerNumero(chave: string, padrao: number, min: number, max: number): number {
  try {
    if (typeof window === "undefined") return padrao
    const v = new URLSearchParams(window.location.search).get(chave)
    if (!v) return padrao
    const n = Number(v)
    if (!Number.isFinite(n)) return padrao
    return Math.max(min, Math.min(max, Math.round(n)))
  } catch {
    return padrao
  }
}

const lerDuracao = (chave: string, padrao: number) => lerNumero(chave, padrao, 150, 4000)

/**
 * Curva, por nome.
 *
 *   suave   as duas pontas devagar. Foi o que estava aqui, e foi o problema:
 *           num círculo o que se vê é a BORDA varrendo, e esta curva tem
 *           velocidade zero no começo e no fim. A borda fica parada nas duas
 *           pontas e metade da animação não mostra movimento nenhum — o
 *           "não faz a quantidade de movimentos necessários".
 *   saida    sai com velocidade e desacelera até parar. É a certa para
 *           revelação: a borda anda de imediato, e vai freando conforme se
 *           aproxima dos cantos, que é quando ela já percorreu quase tudo.
 *   expo     a mesma ideia, exagerada. Quase toda a abertura nos primeiros
 *           30%, com uma cauda longa de acomodação.
 */
const CURVAS: Record<string, string> = {
  suave: "cubic-bezier(0.65, 0, 0.35, 1)",
  saida: "cubic-bezier(0.25, 0.8, 0.35, 1)",
  expo: "cubic-bezier(0.16, 1, 0.3, 1)",
}

function lerCurva(padrao: string): string {
  try {
    if (typeof window === "undefined") return CURVAS[padrao]
    const v = new URLSearchParams(window.location.search).get("curva")
    return (v && CURVAS[v]) || CURVAS[padrao]
  } catch {
    return CURVAS[padrao]
  }
}

/**
 * POR QUE A CURVA DEIXOU DE SER A SIMÉTRICA
 *
 * Aqui esteve `cubic-bezier(0.65, 0, 0.35, 1)` — devagar nas duas pontas, a
 * mesma do SplashScreen da VitallCam. O raciocínio original era que `ease-out`
 * estouraria o círculo logo de cara. Ele estava certo enquanto o raio final era
 * 150%: aí quase tudo crescia fora da tela mesmo.
 *
 * Com o raio corrigido, a conta se inverte. O que o olho acompanha numa
 * revelação circular não é o raio, é a BORDA varrendo — e a velocidade da borda
 * é a derivada da curva. Uma curva simétrica tem derivada ZERO nas duas pontas:
 * a borda fica parada no começo, dispara no meio e congela de novo no fim.
 * Numa animação de 1 segundo isso são uns 400 ms sem movimento aparente. Foi
 * exatamente a queixa: "não faz a quantidade de movimentos necessários".
 *
 * `saida` sai com velocidade e vai freando. A borda anda desde o primeiro
 * quadro, e desacelera justamente quando já percorreu quase todo o caminho.
 */
/*
 * DUAS CURVAS, NÃO UMA.
 *
 * Elas eram a mesma constante, e isso obrigava as duas transições a mudarem
 * juntas — foi por isso que "deixar a película como era antes" chegou a
 * parecer conflitante com "dar mais movimento ao ponto batido".
 *
 * A película volta a `suave`, a mesma de antes de tudo isto. O ponto batido
 * fica em `saida`, que sai com velocidade e vai freando.
 *
 * `?curva=` continua sobrescrevendo as duas ao mesmo tempo, que é justamente o
 * que serve para comparar.
 */
const CURVA_PELICULA = lerCurva("suave")
const CURVA_REVELACAO = lerCurva("saida")

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
/* De volta aos 700 ms de antes de tudo isto, a pedido: a película é o único
   elemento desta tela que o Arthur já tinha aprovado antes. */
export const DURACAO_ABERTURA_MS = lerDuracao("abertura", 700)
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
  animation: revelarDoCentro ${DURACAO_REVELACAO_MS}ms ${CURVA_REVELACAO} forwards;
  -webkit-mask-image: radial-gradient(circle at 50% 50%, black var(--raio-revelacao), transparent var(--raio-revelacao));
          mask-image: radial-gradient(circle at 50% 50%, black var(--raio-revelacao), transparent var(--raio-revelacao));
}
.abrir-do-centro {
  animation: revelarDoCentro ${DURACAO_ABERTURA_MS}ms ${CURVA_PELICULA} forwards;
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
/* A PROFUNDIDADE NASCE MAIOR, NUNCA MENOR.
   
   A primeira versão vinha de scale(0.93) com translateY(14px), imitando um
   conteúdo que sobe de trás. Num elemento de tela cheia isso é um erro de
   base: 93% de cobertura deixa ~3,5% de sobra em cada borda, e o deslocamento
   abre um vão no topo. Durante a animação inteira a tela não estava
   preenchida — foi o que o Arthur viu na hora.
   
   Profundidade não pode custar cobertura. Começando ACIMA de 1 o elemento
   sempre transborda a tela, e a sensação continua a mesma: algo que se acomoda
   no lugar. O deslocamento sobrou 10 px, bem dentro dos ~24 px de margem que
   o scale de 1.06 garante numa tela de 800 px de altura.
   
   A opacidade também subiu de 0.55 para 0.88: a 0.55 a tela de sucesso ficava
   translúcida no meio da animação e deixava ver a câmera por baixo, o que
   somava à impressão de tela não preenchida. */
@keyframes assentarConteudo {
  from { transform: scale(1.06) translateY(10px); opacity: 0.88; }
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
