import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Meu Ponto · Vitall",
  description: "Suas batidas e seu saldo de horas do mês.",
}

/**
 * Esta é a única tela do sistema que abre no celular da pessoa, fora da
 * clínica, em telefone que não controlamos. Daí as duas decisões aqui:
 *
 * - `colorScheme: light` fixo. O tablet tem tema escuro porque fica num
 *   ambiente controlado; um celular no modo escuro do sistema inverteria os
 *   vidros claros e o resultado seria um cinza sujo. Aqui a tela é sempre
 *   clara, em qualquer telefone.
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
