"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { TelaPontoSucesso } from "@/components/tela-ponto-sucesso"

export default function PontoRegistradoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const nome = searchParams.get("nome") || "Funcionario"
  const tipo = searchParams.get("tipo") || "Entrada"
  const hora = searchParams.get("hora") || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const data = searchParams.get("data") || new Date().toLocaleDateString("pt-BR")
  const primeiroNome = nome.split(" ")[0]

  const mensagem = (() => {
    const t = tipo.toLowerCase().trim()
    if (t.includes("entrada")) return `Excelente dia, ${primeiroNome}!`
    if (t.includes("saída") && t.includes("almoço")) return `Excelente almoço, ${primeiroNome}! Aproveite seu almoço e bom descanso!`
    if (t.includes("retorno")) return `Excelente retorno ao trabalho, ${primeiroNome}!`
    if (t.includes("saída") || t.includes("saida")) return `Excelente noite, ${primeiroNome}!`
    return `Excelente trabalho, ${primeiroNome}!`
  })()

  return (
    <TelaPontoSucesso
      nome={nome}
      tipo={tipo}
      hora={hora}
      data={data}
      mensagem={mensagem}
      durationMs={30000}
      onVoltar={() => router.push("/registrar-ponto")}
    />
  )
}
