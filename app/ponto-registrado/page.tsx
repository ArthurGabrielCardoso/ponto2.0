"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { TelaPontoSucesso } from "@/components/tela-ponto-sucesso"
import { gerarSaudacaoLocal } from "@/lib/gerador-falas"

export default function PontoRegistradoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const nome = searchParams.get("nome") || "Funcionario"
  const tipo = searchParams.get("tipo") || "Entrada"
  const hora = searchParams.get("hora") || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const data = searchParams.get("data") || new Date().toLocaleDateString("pt-BR")

  const saudacao = gerarSaudacaoLocal({ nome, tipoPonto: tipo, dataHora: new Date() })
  const mensagem = saudacao.visual

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
