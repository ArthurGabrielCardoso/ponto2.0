export interface CoordenadasLocalizacao {
  latitude: number
  longitude: number
  precisao?: number
  timestamp?: number
  enderecoAproximado?: string
}

/**
 * Obtém as coordenadas GPS atuais do navegador
 */
export async function obterLocalizacaoAtual(): Promise<CoordenadasLocalizacao | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    console.warn("Geolocalização não suportada neste dispositivo/navegador.")
    return null
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: CoordenadasLocalizacao = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }
        console.log("📍 Geolocalização capturada:", coords)
        resolve(coords)
      },
      (err) => {
        console.warn("⚠️ Aviso de geolocalização:", err.message)
        resolve(null)
      },
      {
        enableHighAccuracy: true,
        timeout: 4000,
        maximumAge: 60000,
      }
    )
  })
}
