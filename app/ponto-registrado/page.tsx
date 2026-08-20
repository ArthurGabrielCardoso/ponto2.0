"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
// CSS removido para evitar conflitos

export default function PontoRegistradoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [timeLeft, setTimeLeft] = useState(45)

  // Pegar dados da URL
  const nome = searchParams.get('nome') || 'Funcionario'
  const tipo = searchParams.get('tipo') || 'Entrada'
  const hora = searchParams.get('hora') || new Date().toLocaleTimeString()
  const data = searchParams.get('data') || new Date().toLocaleDateString()

  // Timer de 45 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/registrar-ponto')
    }, 45000) // 45 segundos

    // Contador regressivo
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
    <div className="login-container">
      {/* Divisor curvo entre as seções */}
      <div className="section-divider"></div>

      {/* Left side - Ponto registrado */}
      <div className="login-form-section">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Image src="/logo.png" alt="Logo" width={180} height={60} priority className="h-16 w-auto" />
          </div>

          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="pt-6 px-0">
              <div className="text-center space-y-8 max-w-lg mx-auto px-4 sm:px-6 md:px-0">
                {/* Saudação dinâmica baseada no tipo de ponto */}
                <h1 className="text-3xl font-bold" style={{ color: "#c69e6b" }}>
                  {(() => {
                    const t = tipo.toLowerCase().trim()
                    const primeiroNome = nome.split(" ")[0]
                    if (t.includes("entrada")) return `Excelente dia, ${primeiroNome}!`
                    if (t.includes("saída") && t.includes("almoço")) return `Excelente almoço, ${primeiroNome}!`
                    if (t.includes("retorno")) return `Excelente retorno ao trabalho, ${primeiroNome}!`
                    if (t.includes("saída") || t.includes("saida")) return `Excelente noite e bom descanso, ${primeiroNome}!`
                    const horaAtual = new Date().getHours()
                    if (horaAtual < 12) return `Excelente dia, ${primeiroNome}!`
                    if (horaAtual < 18) return `Excelente tarde, ${primeiroNome}!`
                    return `Excelente noite, ${primeiroNome}!`
                  })()}
                </h1>

                <div className="text-sm text-gray-600 bg-green-50 rounded-lg p-3 border border-green-200">
                  <span className="text-green-700 font-semibold">{tipo}</span> registrada às <span className="font-semibold">{hora}</span> em {data}
                </div>

                {/* Barra de Progresso */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(timeLeft / 45) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => router.push('/ponto-registrado?continue=true')}
                  className="w-full bg-primary hover:bg-primary/90 text-lg py-3"
                >
                  Iniciar
                </Button>

                <Button
                  onClick={() => router.push('/registrar-ponto')}
                  variant="outline"
                  className="w-full text-base py-2"
                >
                  Voltar ao Ponto
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Logo icon */}
      <div className="login-image-section">
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <div className="text-6xl font-bold text-orange-400">C</div>
          </div>
        </div>
      </div>
    </div>
  )
}