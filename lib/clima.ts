/**
 * Previsão do tempo de Mogi das Cruzes via Open-Meteo.
 *
 * Open-Meteo é aberta e não pede chave de API — uma variável de ambiente a
 * menos para configurar no tablet e na Vercel.
 *
 * Módulo de servidor, com cache em memória: a temperatura não muda a cada
 * batida de ponto, e a rota não pode ficar dependendo da rede para responder.
 */

// Praça oficial de Mogi das Cruzes.
const LATITUDE = -23.5228
const LONGITUDE = -46.1883

const URL_CLIMA =
  `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
  `&current=temperature_2m,apparent_temperature,weather_code` +
  `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
  `&timezone=America%2FSao_Paulo&forecast_days=1`

export interface InfoClima {
  temperaturaAtual: number
  sensacaoTermica: number
  minima: number
  maxima: number
  descricao: string
  emoji: string
  chanceDeChuva: number
  /** Resumo com todos os números — vai no prompt da IA, que precisa deles para não inventar. */
  resumo: string
  /**
   * Frase curta e falável — só existe quando o tempo merece comentário.
   * Dia ameno não vira assunto: ninguém quer ouvir "faz 22 graus" toda vez que
   * bate o ponto.
   */
  frase: string | null
  /** Se o tempo de hoje merece ser mencionado (chuva forte, frio ou calor forte). */
  relevante: boolean
}

/**
 * Códigos WMO devolvidos pela Open-Meteo.
 * https://open-meteo.com/en/docs — tabela "Weather variable documentation".
 */
const CODIGOS_WMO: Record<number, { descricao: string; emoji: string }> = {
  0: { descricao: "céu limpo", emoji: "☀️" },
  1: { descricao: "predominantemente limpo", emoji: "🌤️" },
  2: { descricao: "parcialmente nublado", emoji: "⛅" },
  3: { descricao: "nublado", emoji: "☁️" },
  45: { descricao: "névoa", emoji: "🌫️" },
  48: { descricao: "nevoeiro com geada", emoji: "🌫️" },
  51: { descricao: "garoa leve", emoji: "🌦️" },
  53: { descricao: "garoa", emoji: "🌦️" },
  55: { descricao: "garoa intensa", emoji: "🌧️" },
  56: { descricao: "garoa congelante", emoji: "🌧️" },
  57: { descricao: "garoa congelante forte", emoji: "🌧️" },
  61: { descricao: "chuva fraca", emoji: "🌦️" },
  63: { descricao: "chuva", emoji: "🌧️" },
  65: { descricao: "chuva forte", emoji: "🌧️" },
  66: { descricao: "chuva congelante", emoji: "🌧️" },
  67: { descricao: "chuva congelante forte", emoji: "🌧️" },
  71: { descricao: "neve fraca", emoji: "❄️" },
  73: { descricao: "neve", emoji: "❄️" },
  75: { descricao: "neve forte", emoji: "❄️" },
  77: { descricao: "grãos de neve", emoji: "❄️" },
  80: { descricao: "pancadas de chuva isoladas", emoji: "🌦️" },
  81: { descricao: "pancadas de chuva", emoji: "🌧️" },
  82: { descricao: "pancadas de chuva fortes", emoji: "⛈️" },
  85: { descricao: "pancadas de neve", emoji: "❄️" },
  86: { descricao: "pancadas de neve fortes", emoji: "❄️" },
  95: { descricao: "tempestade", emoji: "⛈️" },
  96: { descricao: "tempestade com granizo", emoji: "⛈️" },
  99: { descricao: "tempestade forte com granizo", emoji: "⛈️" },
}

function traduzirCodigo(codigo: number) {
  return CODIGOS_WMO[codigo] || { descricao: "tempo instável", emoji: "🌥️" }
}

const VALIDADE_CACHE_MS = 20 * 60 * 1000
let cache: { dados: InfoClima; ts: number } | null = null
let buscaEmVoo: Promise<InfoClima | null> | null = null

async function buscarDaApi(): Promise<InfoClima | null> {
  // Orçamento curto: o clima é enfeite da saudação, nunca pode segurar a resposta.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)

  try {
    const res = await fetch(URL_CLIMA, {
      signal: controller.signal,
      // Next não deve cachear por conta própria — o cache é o nosso, acima.
      cache: "no-store",
    })
    if (!res.ok) {
      console.warn(`[clima] Open-Meteo respondeu ${res.status}`)
      return null
    }

    const json = await res.json()
    const atual = json?.current
    const diario = json?.daily
    if (!atual || !diario) return null

    const codigoDia = Number(diario.weather_code?.[0] ?? atual.weather_code ?? 0)
    const { descricao, emoji } = traduzirCodigo(codigoDia)

    const temperaturaAtual = Math.round(Number(atual.temperature_2m))
    const sensacaoTermica = Math.round(Number(atual.apparent_temperature))
    const minima = Math.round(Number(diario.temperature_2m_min?.[0]))
    const maxima = Math.round(Number(diario.temperature_2m_max?.[0]))
    const chanceDeChuva = Math.round(Number(diario.precipitation_probability_max?.[0] ?? 0))

    if (!Number.isFinite(temperaturaAtual)) return null

    const resumo =
      `${temperaturaAtual}°C agora em Mogi das Cruzes, ${descricao}, ` +
      `mínima de ${minima}°C e máxima de ${maxima}°C, ` +
      `${chanceDeChuva}% de chance de chuva`

    // A voz só comenta o tempo quando há o que comentar: chuva forte a caminho,
    // frio de verdade ou calor forte. Dia ameno não rende frase — vira ruído
    // repetido a cada batida.
    const tempestade = [95, 96, 99, 82].includes(codigoDia)
    let frase: string | null = null

    if (chanceDeChuva >= 60 || tempestade) {
      frase = tempestade
        ? `Tem tempestade prevista para hoje, se puder já leve guarda-chuva.`
        : `Hoje tem ${chanceDeChuva}% de chance de chuva, vale levar guarda-chuva.`
    } else if (minima <= 12) {
      frase = `A mínima hoje é de ${minima} graus, capriche no agasalho.`
    } else if (maxima >= 30) {
      frase = `A máxima hoje chega a ${maxima} graus, beba bastante água.`
    }

    const relevante = frase !== null

    return {
      temperaturaAtual,
      sensacaoTermica,
      minima,
      maxima,
      descricao,
      emoji,
      chanceDeChuva,
      resumo,
      frase,
      relevante,
    }
  } catch (e) {
    console.warn("[clima] falha ao consultar Open-Meteo:", e)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Clima atual de Mogi das Cruzes, servido do cache sempre que possível.
 *
 * Enquanto uma busca está em voo as chamadas seguintes esperam a mesma promise,
 * para não disparar N requisições quando várias pessoas batem ponto juntas.
 * Se a API falhar e houver cache velho, o cache velho é devolvido: um dado de
 * uma hora atrás é melhor do que nenhum.
 */
export async function obterClimaAtual(): Promise<InfoClima | null> {
  if (cache && Date.now() - cache.ts < VALIDADE_CACHE_MS) {
    return cache.dados
  }

  if (!buscaEmVoo) {
    buscaEmVoo = buscarDaApi().finally(() => {
      buscaEmVoo = null
    })
  }

  const novo = await buscaEmVoo
  if (novo) {
    cache = { dados: novo, ts: Date.now() }
    return novo
  }

  return cache?.dados ?? null
}
