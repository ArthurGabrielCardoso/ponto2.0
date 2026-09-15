"use client"

/**
 * Sons curtos do tablet de ponto.
 *
 * Por que Web Audio e não um arquivo de áudio: são dois tons de menos de meio
 * segundo. Um <audio> exigiria baixar um arquivo, esperar o decode e conviver
 * com o primeiro play atrasado — num aparelho onde o dia inteiro foi gasto
 * cortando centenas de milissegundos, seria o cúmulo. Osciladores tocam no
 * instante em que são agendados, sem rede e sem arquivo.
 *
 * A REGRA QUE NÃO SE QUEBRA AQUI: som nunca atrasa nem derruba a batida.
 * Nenhuma função devolve promessa que alguém espere, e todo erro é engolido.
 * Se o áudio falhar, o ponto continua exatamente igual — sem som.
 *
 * Sobre o gesto: navegador nenhum cria AudioContext destravado sem interação.
 * Por isso `prepararSom()` é chamado no toque da proteção de tela, que é o
 * primeiro gesto de toda batida. Depois disso o contexto fica vivo e os sons
 * seguintes saem na hora.
 */

let ctx: AudioContext | null = null

function obterContexto(): AudioContext | null {
  try {
    if (ctx) return ctx
    const Ctor: typeof AudioContext | undefined =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined
    if (!Ctor) return null
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

/**
 * Destrava o áudio. Chamar de dentro de um handler de toque — é a única hora
 * em que o navegador permite.
 */
export function prepararSom(): void {
  try {
    const c = obterContexto()
    if (!c) return
    if (c.state === "suspended") void c.resume().catch(() => {})
  } catch {
    /* sem som é um problema menor que uma batida travada */
  }
}

/** Um tom com envelope suave. Sem clique no ataque nem no corte. */
function tom(c: AudioContext, hz: number, inicio: number, duracao: number, volume: number) {
  const osc = c.createOscillator()
  const ganho = c.createGain()
  osc.type = "sine"
  osc.frequency.setValueAtTime(hz, inicio)
  // A rampa curta nas duas pontas é o que separa "nota" de "estalo": um ganho
  // que salta de 0 para o volume final produz um clique audível no alto-falante.
  ganho.gain.setValueAtTime(0, inicio)
  ganho.gain.linearRampToValueAtTime(volume, inicio + 0.015)
  ganho.gain.setValueAtTime(volume, inicio + duracao - 0.05)
  ganho.gain.linearRampToValueAtTime(0, inicio + duracao)
  osc.connect(ganho).connect(c.destination)
  osc.start(inicio)
  osc.stop(inicio + duracao + 0.02)
}

/**
 * Toca quando o rosto é confirmado e a barra verde acende.
 *
 * Duas notas subindo, 130 ms no total. Curto de propósito: isto acontece no
 * meio de uma batida de ~3 s, e um som longo atravessaria a tela de sucesso.
 */
export function tocarConfirmacao(): void {
  try {
    const c = obterContexto()
    if (!c || c.state !== "running") return
    const t = c.currentTime
    tom(c, 784, t, 0.09, 0.22) // sol
    tom(c, 1046, t + 0.07, 0.12, 0.2) // dó, uma quarta acima
  } catch {
    /* idem */
  }
}

/**
 * Toca junto com a entrada da tela de ponto batido.
 *
 * Uma nota só, mais grave e mais longa que a confirmação — fecha a frase que
 * a confirmação abriu, em vez de repetir o mesmo aviso duas vezes.
 */
export function tocarSucesso(): void {
  try {
    const c = obterContexto()
    if (!c || c.state !== "running") return
    const t = c.currentTime
    tom(c, 1318, t, 0.18, 0.2) // mi agudo
  } catch {
    /* idem */
  }
}
