export interface CoordenadasLocalizacao {
  latitude: number
  longitude: number
  precisao?: number
  timestamp?: number
  enderecoAproximado?: string
}

/**
 * Geolocalização para o registro de ponto.
 *
 * O ponto é batido num tablet fixo, sempre no mesmo lugar. Pedir um fix novo de
 * GPS na hora de bater era o maior gargalo do fluxo: `getCurrentPosition` com
 * `enableHighAccuracy` levava até o timeout inteiro (4s) sempre que o cache do
 * navegador (60s) já tinha vencido — ou seja, em toda batida real do dia. Duas
 * batidas seguidas pareciam instantâneas só porque a segunda pegava o cache.
 *
 * Aqui a lógica é invertida: um `watchPosition` roda em segundo plano enquanto a
 * tela de ponto está aberta e mantém o último fix em memória. Na hora da batida
 * lemos esse valor de forma síncrona — custo zero no caminho crítico.
 */

// Último fix conhecido, alimentado pelo watchPosition.
let ultimaPosicao: CoordenadasLocalizacao | null = null
let watchId: number | null = null

// Um tablet parado não muda de lugar: um fix de até 15 min continua descrevendo
// corretamente onde a pessoa bateu o ponto.
const IDADE_MAXIMA_ACEITAVEL_MS = 15 * 60 * 1000

function suportaGeolocalizacao(): boolean {
  return typeof window !== "undefined" && "geolocation" in navigator
}

function paraCoordenadas(pos: GeolocationPosition): CoordenadasLocalizacao {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    precisao: pos.coords.accuracy,
    timestamp: pos.timestamp,
  }
}

/**
 * Liga o rastreamento contínuo em segundo plano. Idempotente.
 * Chamar uma vez quando a tela de ponto monta.
 */
export function iniciarRastreamentoLocalizacao(): void {
  if (!suportaGeolocalizacao() || watchId !== null) return

  try {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        ultimaPosicao = paraCoordenadas(pos)
      },
      (err) => {
        // Permissão negada ou GPS indisponível: seguimos sem coordenadas. O ponto
        // nunca deve deixar de ser registrado por causa disso.
        console.warn("⚠️ Rastreamento de localização indisponível:", err.message)
      },
      {
        // Alta precisão liga o GPS do chip e é justamente o que demora. Para
        // provar "bateu na clínica" a precisão de rede (~50m) basta e chega
        // em milissegundos.
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: IDADE_MAXIMA_ACEITAVEL_MS,
      }
    )
  } catch (e) {
    console.warn("⚠️ Falha ao iniciar rastreamento de localização:", e)
  }
}

/** Desliga o rastreamento (cleanup ao desmontar a tela). */
export function pararRastreamentoLocalizacao(): void {
  if (watchId === null || !suportaGeolocalizacao()) return
  try {
    navigator.geolocation.clearWatch(watchId)
  } catch (_) {}
  watchId = null
}

/**
 * Devolve o último fix conhecido SEM esperar nada.
 * É o que o caminho crítico do registro de ponto usa.
 *
 * Retorna null quando ainda não houve nenhum fix — nesse caso o ponto é gravado
 * sem coordenadas, que é o comportamento correto: localização é um dado
 * complementar, não pode segurar a batida.
 */
export function obterLocalizacaoEmCache(): CoordenadasLocalizacao | null {
  if (!ultimaPosicao) return null
  const idade = Date.now() - (ultimaPosicao.timestamp || 0)
  return idade <= IDADE_MAXIMA_ACEITAVEL_MS ? ultimaPosicao : null
}

/**
 * Obtém as coordenadas GPS atuais do navegador.
 *
 * Usa o cache do rastreamento quando disponível e só cai no `getCurrentPosition`
 * (com orçamento de tempo curto) quando não há nada em memória. Mantida para
 * fluxos fora do caminho crítico.
 */
export async function obterLocalizacaoAtual(): Promise<CoordenadasLocalizacao | null> {
  const cache = obterLocalizacaoEmCache()
  if (cache) return cache

  if (!suportaGeolocalizacao()) {
    console.warn("Geolocalização não suportada neste dispositivo/navegador.")
    return null
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = paraCoordenadas(pos)
        ultimaPosicao = coords
        resolve(coords)
      },
      (err) => {
        console.warn("⚠️ Aviso de geolocalização:", err.message)
        resolve(null)
      },
      {
        enableHighAccuracy: false,
        timeout: 1500,
        maximumAge: IDADE_MAXIMA_ACEITAVEL_MS,
      }
    )
  })
}
