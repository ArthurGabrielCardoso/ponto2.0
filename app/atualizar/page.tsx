"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { buscarFuncionarios } from "@/lib/supabase"
import { extrairDescritores, lerResposta } from "@/lib/cadastro-cliente"
import type { ProgressoCadastro as EstadoProgresso } from "@/lib/cadastro-cliente"
import { ProgressoCadastro } from "@/components/progresso-cadastro"
import { UserPlus, Camera, AlertCircle } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import Image from "next/image"

export default function AtualizarFuncionario() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState("Selecione um funcionário e capture novas fotos")
  const [progresso, setProgresso] = useState(0)
  const [capturas, setCapturas] = useState<number>(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [steps] = useState([
    { key: "front", label: "Frente", description: "Olhe diretamente para a câmera" },
    { key: "smile", label: "Frente sorrindo", description: "Sorria naturalmente olhando para a câmera" },
    { key: "left", label: "Perfil esquerdo", description: "Vire levemente à esquerda (~15°)" },
    { key: "right", label: "Perfil direito", description: "Vire levemente à direita (~15°)" },
    { key: "down", label: "Cabeça baixa", description: "Incline levemente a cabeça para baixo" },
    { key: "up", label: "Cabeça alta", description: "Incline levemente a cabeça para cima" },
  ])
  const [currentStep, setCurrentStep] = useState(0)
  const fotosBase64Ref = useRef<string[]>([])
  const [funcionariosExistentes, setFuncionariosExistentes] = useState<{ id: string; nome: string }[]>([])
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>("")
  const [progressoCadastro, setProgressoCadastro] = useState<EstadoProgresso | null>(null)
  const [logProcessamento, setLogProcessamento] = useState<string[]>([])

  // Inicializar câmera
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        })
        if (!mounted) return
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
          setCameraActive(true)
        }
      } catch (e) {
        console.error("Falha ao iniciar câmera:", e)
        setStatus("Não foi possível inicializar a câmera")
      }
    }
    init()

    // Carregar funcionários
    buscarFuncionarios().then(lista => {
      setFuncionariosExistentes(lista.map(f => ({ id: f.id, nome: f.nome })))
    }).catch(() => {})

    return () => {
      mounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // Capturar foto para AWS
  const capturarImagem = async () => {
    if (isLoading || !videoRef.current) return

    if (currentStep >= steps.length) {
      setStatus("Todas as etapas já foram concluídas")
      return
    }

    setIsLoading(true)
    const step = steps[currentStep]
    setStatus(`Capturando ${step.label}...`)

    try {
      // Validar se vídeo está pronto antes de capturar
      const video = videoRef.current
      if (!video || !video.videoWidth || !video.videoHeight || video.readyState < 2) {
        throw new Error("Câmera não está pronta. Aguarde um instante e tente novamente.")
      }

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error("Não foi possível obter contexto 2D")

      ctx.drawImage(video, 0, 0)
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1]

      fotosBase64Ref.current.push(imageBase64)
      const novasCapturas = capturas + 1
      setCapturas(novasCapturas)

      console.log(`📸 ETAPA ${currentStep + 1} (${step.label}): Foto capturada, Total: ${fotosBase64Ref.current.length}`)

      const nextStep = currentStep + 1
      setCurrentStep(nextStep)

      if (nextStep >= steps.length) {
        setProgresso(100)
        setStatus("Todas as etapas concluídas! Clique em 'Salvar Atualização'")
      } else {
        setProgresso((nextStep / steps.length) * 100)
        setStatus(`Etapa ${step.label} concluída! Próxima: ${steps[nextStep].description}`)
      }
    } catch (error) {
      console.error("Erro ao capturar:", error)
      setStatus(`Erro ao capturar ${step.label}. Tente novamente`)
    } finally {
      setIsLoading(false)
    }
  }

  // Resetar captura
  const resetarCaptura = () => {
    setCurrentStep(0)
    setCapturas(0)
    setProgresso(0)
    fotosBase64Ref.current = []
    setStatus("Pronto para iniciar nova captura")
  }

  // Reativar câmera
  const reativarCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraActive(true)
      }

      setStatus("Câmera reativada com sucesso!")
    } catch (error) {
      console.error("Erro ao reativar câmera:", error)
      setStatus("Erro ao reativar câmera")
      setCameraActive(false)
    }
  }

  // Atualizar fotos
  const atualizarFotos = async () => {
    if (!funcionarioSelecionado) return
    try {
      setIsLoading(true)
      setStatus("Processando fotos...")

      const fotos = fotosBase64Ref.current
      const descritores = await extrairDescritores(fotos, setProgressoCadastro)

      setStatus("Salvando...")
      const response = await fetch('/api/aws/update-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionarioId: funcionarioSelecionado,
          descritores
        })
      })

      await lerResposta(response)

      setProgressoCadastro((atual) =>
        atual ? { ...atual, fase: "concluido" } : atual
      )
      setStatus(`✅ Fotos atualizadas! ${descritores.length} nova(s) foto(s) processada(s).`)

      setTimeout(() => {
        router.push("/dashboard")
      }, 3000)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setProgressoCadastro((atual) => ({
        fase: "erro",
        fotos: atual?.fotos ?? [],
        backend: atual?.backend ?? "",
        mensagem: msg,
      }))
      setStatus(`Erro: ${msg}`)
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("authenticated")
    document.cookie = "authenticated=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <DashboardHeader onLogout={handleLogout} />

      <div className="container mx-auto p-6 flex-1">
        <Card className="w-full max-w-4xl mx-auto overflow-hidden shadow-lg">
          <CardHeader className="bg-primary text-white p-6">
            <div className="flex items-center gap-2">
              <UserPlus className="h-6 w-6" />
              <CardTitle className="text-2xl">Atualizar Funcionário</CardTitle>
            </div>
            <CardDescription className="text-white/80">
              Atualize as fotos faciais para melhorar o reconhecimento facial
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-6 flex justify-center">
              <Image src="/logo.png" alt="Vitall Check-Up" width={150} height={75} className="h-auto" />
            </div>

            <Alert className="mb-6 bg-primary/10 border-primary/30">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <AlertTitle className="text-primary">Atualização de Fotos Faciais</AlertTitle>
              <AlertDescription className="text-primary-foreground">
                Capture 6 novas fotos em diferentes poses para atualizar o reconhecimento facial do funcionário.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Selecionar Funcionário</Label>
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={funcionarioSelecionado}
                  onChange={(e) => setFuncionarioSelecionado(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {funcionariosExistentes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Câmera */}
                <div className="relative bg-gray-900 aspect-square rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-primary/70 text-primary-foreground p-3 text-center">
                    <p className="font-medium">{status}</p>
                    {currentStep < steps.length && (
                      <p className="text-sm mt-1 opacity-90">{steps[currentStep].description}</p>
                    )}
                  </div>
                </div>

                {/* Progresso */}
                <div className="flex flex-col">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Captura de Novas Fotos</h2>

                  <div className="mb-4">
                    <div className="grid grid-cols-1 gap-2">
                      {steps.map((s, idx) => {
                        const isDone = idx < currentStep
                        const isCurrent = idx === currentStep
                        return (
                          <div
                            key={s.key}
                            className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                              isDone
                                ? "border-green-200 bg-green-50 text-green-700"
                                : isCurrent
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : "border-gray-200 bg-white text-gray-700"
                            }`}
                          >
                            <span className="text-sm">{idx + 1}. {s.label}</span>
                            <span className={`text-xs ${isDone ? "" : isCurrent ? "" : "text-gray-400"}`}>
                              {isDone ? "✓ Concluído" : isCurrent ? "• Atual" : "Pendente"}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {currentStep < steps.length ? (
                        <span>Etapa atual: <span className="font-medium">{steps[currentStep].label}</span></span>
                      ) : (
                        <span className="text-green-700 font-semibold">✅ Todas as etapas concluídas!</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-gray-700">Progresso das Etapas</Label>
                        <span className="text-sm text-gray-500">
                          {currentStep} de {steps.length} | {fotosBase64Ref.current.length} fotos
                        </span>
                      </div>
                      <Progress value={progresso} className="h-2 bg-secondary" />
                    </div>

                    {logProcessamento.length > 0 && (
                      <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                        {logProcessamento.map((log, idx) => (
                          <p key={idx} className={`text-sm font-mono ${
                            log.startsWith("✅") ? "text-green-400" :
                            log.startsWith("❌") ? "text-red-400" :
                            log.startsWith("📸") ? "text-blue-400" :
                            log.startsWith("📊") ? "text-yellow-400" :
                            log.startsWith("🧠") ? "text-purple-400" :
                            "text-gray-300"
                          }`}>
                            {log}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="pt-4 space-y-4">
                      <Button
                        onClick={capturarImagem}
                        disabled={isLoading || !cameraActive || currentStep >= steps.length || !funcionarioSelecionado}
                        className="w-full bg-primary hover:bg-primary/90 text-white"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        {isLoading ? "Processando..." : currentStep < steps.length ? `Capturar (${currentStep + 1}/${steps.length})` : "✅ Capturas concluídas"}
                      </Button>

                      {!cameraActive && (
                        <Button
                          onClick={reativarCamera}
                          variant="outline"
                          className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                        >
                          🎥 Reativar Câmera
                        </Button>
                      )}

                      <Button
                        onClick={atualizarFotos}
                        disabled={
                          !funcionarioSelecionado ||
                          isLoading ||
                          currentStep < steps.length ||
                          fotosBase64Ref.current.length === 0
                        }
                        className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
                      >
                        💾 Salvar Atualização
                      </Button>

                      {currentStep >= steps.length && fotosBase64Ref.current.length > 0 && (
                        <Button
                          onClick={resetarCaptura}
                          variant="outline"
                          className="w-full"
                        >
                          🔄 Recapturar Fotos
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
          {/* Modal de Progresso em Tempo Real */}
      {progressoCadastro && (
        <ProgressoCadastro
          progresso={progressoCadastro}
          rotulos={steps.map((s) => s.label)}
          onCancelar={() => {
            setProgressoCadastro(null)
            setIsLoading(false)
          }}
          onTentarNovamente={() => {
            setProgressoCadastro(null)
            atualizarFotos()
          }}
        />
      )}
</div>
  )
}
