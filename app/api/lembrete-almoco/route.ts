import { NextRequest, NextResponse } from "next/server"
import { validarTokenEspelho } from "@/lib/token-espelho"

export const dynamic = "force-dynamic"

/**
 * Evento de calendário com alarme, para a pessoa não perder a hora de voltar
 * do almoço.
 *
 * Foi a saída encontrada para avisar no celular sem construir push. No iPhone,
 * notificação web exige o site instalado na tela de início mais toda a
 * infraestrutura de web push; um arquivo .ics o sistema abre nativamente, cria
 * o evento e avisa com a tela bloqueada.
 *
 * Protegido pelo mesmo token do espelho: sem ele não se descobre o horário de
 * ninguém por tentativa e erro.
 */
function paraIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

function escapar(texto: string): string {
  return texto.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n")
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || ""
  const retorno = Number(req.nextUrl.searchParams.get("retorno"))

  const dados = validarTokenEspelho(token)
  if (!dados || !Number.isFinite(retorno)) {
    return NextResponse.json({ erro: "Link inválido ou expirado" }, { status: 403 })
  }

  const inicio = new Date(retorno)
  const fim = new Date(retorno + 15 * 60 * 1000)
  const primeiroNome = escapar((dados.nome || "").split(" ")[0] || "você")

  // CRLF é exigido pelo formato; com \n puro alguns calendários recusam.
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vitall//Ponto//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:almoco-${dados.funcionarioId}-${retorno}@vitall`,
    `DTSTAMP:${paraIcsUtc(new Date())}`,
    `DTSTART:${paraIcsUtc(inicio)}`,
    `DTEND:${paraIcsUtc(fim)}`,
    "SUMMARY:Voltar do almoço",
    `DESCRIPTION:${escapar(`Hora de bater o retorno do almoço, ${primeiroNome}!`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT5M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Faltam 5 minutos para voltar do almoço",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="voltar-do-almoco.ics"',
      "Cache-Control": "no-store",
    },
  })
}
