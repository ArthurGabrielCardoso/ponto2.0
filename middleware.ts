import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Verificar se o usuário está autenticado para acessar o dashboard
  if (
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/cadastrar") ||
    request.nextUrl.pathname.startsWith("/relatorios")
  ) {
    // Verificar o cookie de autenticação
    const authenticated = request.cookies.get("authenticated")?.value

    if (!authenticated) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/cadastrar/:path*", "/relatorios/:path*"],
}
