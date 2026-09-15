"use client"

import React, { useEffect, useState } from "react"

interface BalaoFalaRoboProps {
  pessoaNaEspera: { id: string; nome: string; primeiroNome: string } | null
  falaIa?: string | null
  className?: string
}

const LEMBRETES_CLINICA = [
  "Que seu dia seja produtivo, alegre e com foco total na excelência! ✨",
  "Lembre-se de manter sua postura e cuidar da hidratação ao longo do turno. 💧",
  "O sorriso de cada paciente começa no cuidado e na atenção da nossa equipe. 🦷",
  "Tenha um excelente expediente com dedicação, energia e harmonia! 🌟",
  "Vitall Odontologia & Saúde Integrativa — Cuidando de vidas com amor e precisão. ✨",
]

function gerarLembreteContextual(nome: string): string {
  const h = new Date().getHours()
  const dia = new Date().getDay()
  if (dia === 5 && h >= 14) {
    return `Sexta-feira com energia máxima, ${nome}! Foco total na excelência.`
  }
  if (h < 12) {
    return `Excelente dia, ${nome}! Que sua manhã seja iluminada, com foco e realizações.`
  }
  if (h >= 12 && h < 14) {
    return `Excelente refeição, ${nome}! Aproveite seu intervalo e recarregue as energias.`
  }
  if (h < 18) {
    return `Excelente tarde, ${nome}! Mantenha a hidratação e o alto astral no atendimento.`
  }
  return `Excelente noite, ${nome}! Parabéns pelo empenho e dedicação de hoje.`
}

export function BalaoFalaRobo({
  pessoaNaEspera,
  falaIa,
  className = "",
}: BalaoFalaRoboProps) {
  const [indiceLembrete, setIndiceLembrete] = useState(0)

  // Rotação de lembretes da clínica quando ninguém está na frente
  useEffect(() => {
    if (pessoaNaEspera) return
    const id = setInterval(() => {
      setIndiceLembrete((prev) => (prev + 1) % LEMBRETES_CLINICA.length)
    }, 6000)
    return () => clearInterval(id)
  }, [pessoaNaEspera])

  let nome = ""
  let mensagem = LEMBRETES_CLINICA[indiceLembrete]

  if (pessoaNaEspera) {
    if (pessoaNaEspera.id !== "unknown") {
      nome = pessoaNaEspera.primeiroNome
      mensagem = falaIa || gerarLembreteContextual(pessoaNaEspera.primeiroNome)
    } else {
      mensagem = "Olá! Aproxime-se para registrar seu ponto."
    }
  }

  return (
    <div className={`relative w-full max-w-md ${className}`}>
      {/* Rabicho apontando para baixo (em direção ao robô), alinhado ao centro da face */}
      <div
        className="absolute -bottom-2.5 left-7 sm:left-9 w-0 h-0 border-x-[9px] border-x-transparent border-t-[11px] drop-shadow-md z-10"
        style={{ borderTopColor: "rgba(15, 23, 42, 0.94)" }}
      />

      {/* Caixa do balão com glassmorphism obsidian escuro de altíssimo nível */}
      <div
        className="rounded-3xl p-5 sm:p-6 border text-left transition-all duration-300 backdrop-blur-2xl relative"
        style={{
          background:
            "linear-gradient(135deg, rgba(15, 23, 42, 0.90) 0%, rgba(3, 7, 18, 0.95) 100%)",
          borderColor: "rgba(255, 255, 255, 0.16)",
          boxShadow:
            "0 20px 45px -10px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.16)",
        }}
      >
        {nome ? (
          <>
            <div className="text-base sm:text-lg font-semibold text-teal-300 mb-1 flex items-center gap-1.5">
              <span>Olá, {nome}!</span>
              <span>👋</span>
            </div>
            <p
              key={mensagem}
              className="text-sm sm:text-base font-light text-white/95 leading-relaxed drop-shadow-sm animate-in fade-in duration-300"
            >
              {mensagem}
            </p>
          </>
        ) : (
          <p
            key={mensagem}
            className="text-sm sm:text-base font-light text-white/90 leading-relaxed drop-shadow-sm animate-in fade-in duration-300 italic"
          >
            {mensagem}
          </p>
        )}
      </div>
    </div>
  )
}
