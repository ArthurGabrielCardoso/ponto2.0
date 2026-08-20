"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import type { RelatorioPonto } from "@/lib/types"

interface ExportarPDFProps {
  relatorio: RelatorioPonto | null
  disabled?: boolean
}

export function ExportarPDF({ relatorio, disabled = false }: ExportarPDFProps) {
  const [isExporting] = useState(false)

  const imprimirCalendario = () => {
    // Acionar o botão de impressão do calendário
    const exportarBtn = document.querySelector("[data-export-calendar]")
    if (exportarBtn) {
      ; (exportarBtn as HTMLButtonElement).click()
    }
  }

  return (
    <Button
      onClick={imprimirCalendario}
      disabled={disabled || isExporting || !relatorio}
      className="bg-primary hover:bg-primary/90 text-white"
      data-export-pdf
    >
      <Printer className="mr-2 h-4 w-4" />
      {isExporting ? "Imprimindo..." : "Imprimir"}
    </Button>
  )
}
