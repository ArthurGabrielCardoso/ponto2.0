"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { IlustracaoPontoAnimada } from "@/components/ilustracoes-ponto-animadas"
import { OndaOrganicaDourada } from "@/components/onda-organica-dourada"

export default function PontoRegistradoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [timeLeft, setTimeLeft] = useState(30)

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
    if (t.includes("saída") || t.includes("saida")) return `Excelente noite e bom descanso, ${primeiroNome}!`
    return `Excelente trabalho, ${primeiroNome}!`
  })()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/registrar-ponto")
    }, 30000)

    const countdown = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdown)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearTimeout(timer)
      clearInterval(countdown)
    }
  }, [router])

  return (
    <div className="min-h-screen w-full bg-white flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative overflow-hidden select-none">
      {/* Fundo Orgânico Dourado */}
      <OndaOrganicaDourada />

      {/* Topo: Logo único e Badge de Status */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-4xl mx-auto">
        <Image src="/logo.png" alt="Logo" width={160} height={80} priority style={{ height: "auto" }} />
        <span className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Ponto Registrado
        </span>
      </div>

      {/* Centro: Ilustração Animada, Saudação Dourada e Card Retangular */}
      <div className="relative z-10 my-auto max-w-xl mx-auto w-full text-center space-y-6 py-4">
        {/* Ilustração Animada */}
        <div className="flex justify-center">
          <IlustracaoPontoAnimada tipo={tipo} className="w-32 h-32 sm:w-40 sm:h-40" />
        </div>

        {/* Saudação */}
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
            <span style={{ color: "#c69e6b" }}>{mensagem}</span>
          </h1>
          <p className="text-sm text-gray-500 font-medium">Autenticação biométrica validada com sucesso</p>
        </div>

        {/* Card de Informações Limpo e Mais Quadrado */}
        <div className="rounded-lg p-5 bg-white/90 backdrop-blur-md border border-amber-200/60 shadow-[0_8px_30px_-8px_rgba(198,158,107,0.2)] space-y-3 text-left">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
            <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">Tipo de Batida</span>
            <span className="font-bold text-sm px-3 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80">
              {tipo}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block">Horário Registrado</span>
              <span className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight font-mono">{hora}</span>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block">Data</span>
              <span className="text-sm font-semibold text-gray-700">{data}</span>
            </div>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="pt-1 max-w-md mx-auto space-y-1.5">
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${(timeLeft / 30) * 100}%`,
                background: "linear-gradient(90deg, #c69e6b 0%, #1db9b3 100%)",
              }}
            />
          </div>
          <p className="text-[11px] text-gray-400 font-medium">Retornando à tela inicial em {timeLeft}s...</p>
        </div>
      </div>

      {/* Rodapé: Botão Voltar */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-4xl mx-auto pt-2">
        <button
          onClick={() => router.push("/registrar-ponto")}
          className="px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all shadow-md hover:shadow-lg active:scale-95"
          style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
        >
          Voltar ao Início
        </button>
        <span className="text-xs text-gray-400 font-medium">Vitall Ponto Digital</span>
      </div>
    </div>
  )
}
