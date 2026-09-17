/**
 * Uma mola amortecida, em uma dimensão.
 *
 * POR QUE MOLA E NÃO `transition` DO CSS
 *
 * Uma transição CSS anima DE um valor ATÉ outro num tempo fixo. Isso serve
 * quando o alvo muda de vez em quando e fica parado. Serve mal quando o alvo
 * muda o tempo todo — que é o caso do olhar seguindo um rosto: a cada leitura
 * da câmera a transição recomeça do zero, e ela nunca chega. O olho fica
 * permanentemente indo para onde a pessoa ESTAVA.
 *
 * A mola não tem destino nem duração: ela tem posição, velocidade e um alvo
 * que pode mudar a qualquer instante. Trocar o alvo no meio do caminho não
 * reinicia nada — a velocidade que já existia continua valendo, e o movimento
 * apenas curva para o novo destino. É por isso que parece vivo: é o mesmo
 * comportamento de um corpo com massa.
 *
 * A física é a de sempre:
 *
 *     aceleração = (alvo - posição) * rigidez - velocidade * amortecimento
 *
 * Com `amortecimento = 2 * sqrt(rigidez)` a mola é criticamente amortecida:
 * chega rápido e para, sem passar do ponto. Abaixo disso ela ultrapassa e
 * volta — o "quique" que dá vida. Acima, fica arrastada.
 */
export class Mola {
  private pos: number
  private vel = 0
  private alvo: number
  private rigidez: number
  private amortecimento: number

  /**
   * @param inicial  posição de partida
   * @param rigidez  quanto puxa. Alto = rápido e nervoso; baixo = preguiçoso.
   * @param quique   0 = para seco no alvo. Até ~0.3 = passa um pouco e volta.
   */
  constructor(inicial = 0, rigidez = 120, quique = 0) {
    this.pos = inicial
    this.alvo = inicial
    this.rigidez = rigidez
    this.amortecimento = 2 * Math.sqrt(rigidez) * (1 - quique)
  }

  definirAlvo(v: number) {
    this.alvo = v
  }

  definirRigidez(rigidez: number, quique = 0) {
    this.rigidez = rigidez
    this.amortecimento = 2 * Math.sqrt(rigidez) * (1 - quique)
  }

  /** Teleporta, sem animação. Para posicionar antes do primeiro quadro. */
  irDireto(v: number) {
    this.pos = v
    this.alvo = v
    this.vel = 0
  }

  /**
   * Avança a simulação.
   *
   * `dt` vem limitado a 50 ms porque nem todo quadro chega: quando o tablet
   * engasga — e este engasga — o intervalo entre dois `requestAnimationFrame`
   * pode ser de meio segundo. Integrar meio segundo de uma vez faz a mola
   * disparar para longe e voltar com tudo, que na tela vira um espasmo. Com o
   * teto, o pior caso é a animação andar um pouco mais devagar que o relógio,
   * o que ninguém percebe.
   */
  avancar(dt: number): number {
    const passo = Math.min(dt, 0.05)
    const acel = (this.alvo - this.pos) * this.rigidez - this.vel * this.amortecimento
    this.vel += acel * passo
    this.pos += this.vel * passo
    return this.pos
  }

  get valor() {
    return this.pos
  }

  /** Chegou e parou: dá para desligar o loop até o alvo mudar de novo. */
  get parada() {
    return Math.abs(this.alvo - this.pos) < 0.0008 && Math.abs(this.vel) < 0.0008
  }
}
