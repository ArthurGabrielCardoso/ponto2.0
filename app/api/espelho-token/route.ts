import { NextRequest, NextResponse } from "next/server"
import { gerarTokenEspelho, espelhoEstaConfigurado } from "@/lib/token-espelho"

export const dynamic = "force-dynamic"

/**
 * Emite o token curto que o QR da tela de sucesso carrega.
 *
 * Só é chamada DEPOIS que a batida já foi registrada, então não está no caminho
 * crítico — a tela não espera por ela.
 */
export async function POST(req: NextRequest) {
  if (!espelhoEstaConfigurado()) {
    // Sem ESPELHO_SECRET no ambiente o recurso fica desligado e a tela
    // simplesmente não mostra o QR.
    return NextResponse.json({ configurado: false }, { status: 200 })
  }

  try {
    const { funcionarioId, nome } = await req.json()
    if (!funcionarioId || typeof funcionarioId !== "string") {
      return NextResponse.json({ erro: "funcionarioId é obrigatório" }, { status: 400 })
    }

    const token = gerarTokenEspelho(funcionarioId, String(nome || ""))
    if (!token) return NextResponse.json({ configurado: false }, { status: 200 })

    return NextResponse.json({ configurado: true, token }, { status: 200 })
  } catch {
    return NextResponse.json({ erro: "Requisição inválida" }, { status: 400 })
  }
}
