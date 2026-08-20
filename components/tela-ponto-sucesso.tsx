"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { IlustracaoPontoAnimada } from "@/components/ilustracoes-ponto-animadas"
import { OndaOrganicaDourada } from "@/components/onda-organica-dourada"

interface TelaPontoSucessoProps {
  nome: string
  tipo: string
  hora: string
  data: string
  mensagem?: string
  durationMs?: number
  onVoltar: () => void
  modoDemonstracao?: boolean
}

export function TelaPontoSucesso({
  nome,
  tipo,
  hora,
  data,
  mensagem,
  durationMs = 30000,
  onVoltar,
  modoDemonstracao = false,
}: TelaPontoSucessoProps) {
  // Fases da coreografia:
  // 1. "centro": Ícone grande no centro da tela (0 a 1.2s)
  // 2. "deslizando": Ícone desliza suavemente para a direita (1.2s a 2.0s)
  // 3. "revelar": Ícone 100% ancorado + espera um tiquinho -> surge a logo, badge e lado esquerdo (2.2s+)
  const [fase, setFase] = useState<"centro" | "deslizando" | "revelar">("centro")
  const [timeLeft, setTimeLeft] = useState(Math.round(durationMs / 1000))

  useEffect(() => {
    // 1. Fica centralizado grande por 1.2s
    const tDeslizar = setTimeout(() => {
      setFase("deslizando")
    }, 1200)

    // 2. Chega 100% à direita aos 2.0s, espera um tiquinho (~200ms) e aos 2.2s revela o restante
    const tRevelar = setTimeout(() => {
      setFase("revelar")
    }, 2200)

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onVoltar()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearTimeout(tDeslizar)
      clearTimeout(tRevelar)
      clearInterval(timer)
    }
  }, [durationMs, onVoltar])

  const iconeAncorado = fase === "deslizando" || fase === "revelar"
  const conteudoVisivel = fase === "revelar"

  return (
    <div className="absolute inset-0 z-40 bg-white h-screen w-full flex flex-col justify-between p-4 sm:p-8 lg:p-10 overflow-hidden select-none">
      {/* Fundo com Onda Orgânica Dourada */}
      <OndaOrganicaDourada />

      {/* TOPO: Logo e Badge "Ponto Registrado" — Aparece somente após o ícone ancorar à direita */}
      <div
        className={`relative z-10 flex items-center justify-between w-full max-w-5xl mx-auto shrink-0 transition-opacity duration-600 ease-out ${
          conteudoVisivel ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Image src="/logo.png" alt="Logo" width={150} height={75} priority style={{ height: "auto" }} />
        <span className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Ponto Registrado
        </span>
      </div>

      {/* ÁREA CENTRAL: Layout Dividido sem Scroll com Transição Cinematográfica */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-10 max-w-5xl mx-auto w-full my-auto px-2">
        {/* LADO ESQUERDO: Saudação Dourada e Card de Informações — Surge após o ícone ancorar */}
        <div
          className={`w-full md:w-[54%] space-y-4 sm:space-y-5 text-center md:text-left transition-all duration-600 ease-out ${
            conteudoVisivel
              ? "opacity-100 translate-x-0 translate-y-0"
              : "opacity-0 -translate-x-6 md:-translate-y-2 pointer-events-none"
          }`}
        >
          {/* Saudação com Nome em Dourado */}
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
              <span style={{ color: "#c69e6b" }}>
                {mensagem || `Excelente trabalho, ${nome.split(" ")[0]}!`}
              </span>
            </h1>
          </div>

          {/* Card de Informações Retangular / Quadrado Limpo */}
          <div className="rounded-lg p-4 sm:p-5 bg-white/95 backdrop-blur-md border border-amber-200/60 shadow-[0_8px_30px_-8px_rgba(198,158,107,0.2)] space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">Tipo</span>
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

          {/* Barra de Progresso e Botão */}
          <div className="space-y-2 pt-1">
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${(timeLeft / Math.round(durationMs / 1000)) * 100}%`,
                  background: "linear-gradient(90deg, #c69e6b 0%, #1db9b3 100%)",
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <button
                onClick={onVoltar}
                className="px-5 py-2 rounded-lg font-bold text-white transition-all shadow-sm hover:shadow active:scale-95 text-xs sm:text-sm"
                style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
              >
                Voltar ao Início
              </button>
              <span>Retornando em {timeLeft}s...</span>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Ícone Animado (Inicia no centro grande e desliza para a direita) */}
        <div
          className={`w-full md:w-[46%] flex items-center justify-center transition-all duration-800 cubic-bezier(0.2, 0.8, 0.2, 1) ${
            iconeAncorado
              ? "translate-x-0 scale-100"
              : "md:-translate-x-[60%] scale-135 sm:scale-150 md:scale-160"
          }`}
        >
          <div className="relative">
            <IlustracaoPontoAnimada tipo={tipo} className="w-48 h-48 sm:w-60 sm:h-60 lg:w-72 lg:h-72" />
          </div>
        </div>
      </div>

      {/* RODAPÉ: Limpo sem textos extras */}
      <div className="relative z-10 h-4 shrink-0" />
    </div>
  )
}
