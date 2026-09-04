import { NextResponse } from "next/server"
import { obterClimaAtual } from "@/lib/clima"
import { obterContextoFeriados } from "@/lib/feriados"

export const dynamic = "force-dynamic"

/**
 * Contexto do dia em Mogi das Cruzes: clima agora e feriados em volta.
 *
 * A tela de ponto busca isto uma vez ao abrir e revalida de tempos em tempos,
 * guardando o resultado em memória. Assim, na hora da batida, o dado já está
 * na mão — nada disso entra no caminho crítico entre sorrir e ver a tela.
 *
 * Os dois lados falham em silêncio: sem clima ou sem feriado a saudação sai
 * igual, só que sem esse tempero.
 */
export async function GET() {
  const [clima, feriados] = await Promise.all([
    obterClimaAtual().catch(() => null),
    Promise.resolve().then(() => {
      try {
        return obterContextoFeriados(new Date())
      } catch {
        return null
      }
    }),
  ])

  return NextResponse.json(
    { clima, feriados, geradoEm: new Date().toISOString() },
    {
      status: 200,
      headers: {
        // O cache real é o de memória do servidor; aqui só evitamos que um
        // proxy congele a resposta por muito tempo.
        "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
      },
    }
  )
}
