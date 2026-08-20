"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"

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
    <div className="min-h-screen w-full bg-white flex flex-col md:flex-row overflow-hidden select-none">
      <style>{`
        @keyframes bounceBadge {
          0% { transform: scale(0.6) rotate(-10deg); opacity: 0; }
          50% { transform: scale(1.1) rotate(3deg); opacity: 1; }
          70% { transform: scale(0.96) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes pulseRing {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.18); opacity: 0.15; }
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .badge-pop { animation: bounceBadge 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .ring-pulse { animation: pulseRing 2.4s ease-in-out infinite; }
        .su-card { animation: fadeUp 0.5s ease-out 0.2s both; }
        .su-btn { animation: fadeUp 0.5s ease-out 0.35s both; }
      `}</style>

      {/* Lado Esquerdo - Detalhes do Registro */}
      <div className="w-full md:w-[58%] min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative bg-gradient-to-b from-white via-amber-50/15 to-white overflow-y-auto">
        {/* Topo: Logo */}
        <div className="flex items-center justify-between">
          <Image src="/logo.png" alt="Logo" width={160} height={80} priority style={{ height: "auto" }} />
          <span className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Ponto Registrado
          </span>
        </div>

        {/* Conteúdo Central */}
        <div className="my-auto max-w-lg mx-auto w-full text-center space-y-6 py-6">
          {/* Ícone Animado de Sucesso */}
          <div className="flex justify-center relative">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-emerald-400/20 ring-pulse blur-sm" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-xl badge-pop">
                <svg className="w-12 h-12 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              {/* Badge de tipo */}
              <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-lg">
                {(() => {
                  const t = tipo.toLowerCase()
                  if (t.includes("entrada")) return "🌤️"
                  if (t.includes("almoço") && (t.includes("saída") || t.includes("saida"))) return "🍽️"
                  if (t.includes("retorno")) return "💼"
                  if (t.includes("saída") || t.includes("saida")) return "🌙"
                  return "⭐"
                })()}
              </div>
            </div>
          </div>

          {/* Saudação com Nome em Dourado */}
          <div className="space-y-1.5">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight">
              <span style={{ color: "#c69e6b" }}>{mensagem}</span>
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              Autenticação biométrica validada com sucesso
            </p>
          </div>

          {/* Card de Informações do Registro */}
          <div className="su-card rounded-2xl p-5 bg-white border border-gray-100 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.06)] space-y-3.5 text-left">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">Tipo de Batida</span>
              <span className="font-bold text-sm px-3.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80">
                {tipo}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block">Horário Registrado</span>
                <span className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight font-mono">
                  {hora}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block">Data</span>
                <span className="text-sm font-semibold text-gray-700">
                  {data}
                </span>
              </div>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="pt-2 space-y-1.5">
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
        <div className="su-btn flex items-center justify-between pt-4">
          <button
            onClick={() => router.push("/registrar-ponto")}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all shadow-md hover:shadow-lg active:scale-95"
            style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
          >
            Voltar ao Início
          </button>
          <span className="text-xs text-gray-400">Vitall Ponto Digital</span>
        </div>
      </div>

      {/* Lado Direito - Gradiente Temático com Logo */}
      <div
        className="hidden md:flex md:w-[42%] min-h-screen flex-col items-center justify-center p-10 text-white text-center relative overflow-hidden"
        style={{
          background: (() => {
            const t = tipo.toLowerCase()
            if (t.includes("entrada")) return "linear-gradient(135deg, #c69e6b 0%, #b88d57 50%, #8c5e28 100%)"
            if (t.includes("almoço") && (t.includes("saída") || t.includes("saida"))) return "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #9a3412 100%)"
            if (t.includes("retorno")) return "linear-gradient(135deg, #1db9b3 0%, #16918d 50%, #0d8488 100%)"
            if (t.includes("saída") || t.includes("saida")) return "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
            return "linear-gradient(135deg, #1db9b3 0%, #0d8488 100%)"
          })(),
        }}
      >
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-black/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6 max-w-sm">
          <div className="p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl inline-block">
            <Image src="/logo.png" alt="Logo" width={400} height={180} priority style={{ height: "auto" }} />
          </div>
          <p className="text-white/95 text-xl font-light leading-relaxed">
            {(() => {
              const t = tipo.toLowerCase()
              if (t.includes("entrada")) return "Tenha um excelente e produtivo dia de trabalho!"
              if (t.includes("almoço") && (t.includes("saída") || t.includes("saida"))) return "Aproveite seu almoço e tenha um ótimo descanso!"
              if (t.includes("retorno")) return "Excelente retorno ao trabalho! Vamos em frente!"
              if (t.includes("saída") || t.includes("saida")) return "Dever cumprido! Descanse bem e até amanhã!"
              return "Ponto registrado com sucesso!"
            })()}
          </p>
        </div>
      </div>
    </div>
  )
}
