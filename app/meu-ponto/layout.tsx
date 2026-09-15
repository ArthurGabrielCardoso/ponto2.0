import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Meu Ponto · Vitall",
  description: "Suas batidas e seu saldo de horas do mês.",
}

/**
 * Esta é a única tela do sistema que abre no celular da pessoa, fora da
 * clínica, em telefone que não controlamos. Daí as duas decisões aqui:
 *
 * - Esquema de cor fixo. A tela pinta o próprio fundo e o próprio texto, e
 *   travar isso impede que o modo escuro do sistema, ou o "inverter cores" do
 *   telefone, mexa no que já está resolvido — a película teal com vidro escuro
 *   por cima sai igual em qualquer aparelho.
 * - `overscroll-none` para a página não "descolar" no topo ao puxar, que é o
 *   que denuncia site dentro de navegador.
 */
export default function LayoutMeuPonto({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ colorScheme: "light" }} className="overscroll-none">
      {children}
    </div>
  )
}
