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

  let titulo = "IA Vitall • Mensagem do Dia"
  let mensagem = LEMBRETES_CLINICA[indiceLembrete]
  let badge = "Assistente Ativo"
  let badgeCor = "bg-teal-400"

  if (pessoaNaEspera) {
    if (pessoaNaEspera.id !== "unknown") {
      titulo = `Olá, ${pessoaNaEspera.primeiroNome}! 👋`
      mensagem = falaIa || gerarLembreteContextual(pessoaNaEspera.primeiroNome)
      badge = "Identificado"
      badgeCor = "bg-emerald-400"
    } else {
      titulo = "Olá! Chegue mais perto 🙂"
      mensagem = "Posicione seu rosto ou toque na tela para abrir a câmera e bater seu ponto."
      badge = "Reconhecimento Ativo"
      badgeCor = "bg-amber-400"
    }
  }

  return (
    <div className={`relative mx-auto w-full max-w-lg px-3 ${className}`}>
      {/* Triângulo / Rabicho do balão apontando para o rosto do robô */}
      <div className="mx-auto w-0 h-0 border-x-[10px] border-x-transparent border-b-[10px] border-b-slate-950/80 mb-[-1px] drop-shadow-md" />

      {/* Caixa do balão com glassmorphism premium */}
      <div
        className="rounded-3xl p-5 border text-center transition-all duration-300 backdrop-blur-2xl"
        style={{
          background: "rgba(2, 22, 28, 0.78)",
          borderColor: "rgba(45, 212, 191, 0.38)",
          boxShadow:
            "0 18px 45px -10px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Cabeçalho do balão com dot de pulso e título */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${badgeCor}`} />
          <span className="text-[12px] uppercase font-bold tracking-wider text-teal-300">
            {titulo}
          </span>
          <span className="text-[10px] text-white/40 border border-white/10 rounded-full px-2 py-0.2">
            {badge}
          </span>
        </div>

        {/* Frase dinâmica / Lembrete / Fala da IA Llama */}
        <p
          key={mensagem}
          className="text-base sm:text-lg font-light text-white leading-relaxed drop-shadow-sm animate-in fade-in duration-300"
        >
          {mensagem}
        </p>

        {/* Dica de interação sutil */}
        <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-center gap-1.5 text-[11px] text-white/50">
          <span>👆</span>
          <span>Toque na tela para registrar seu ponto</span>
        </div>
      </div>
    </div>
  )
}
