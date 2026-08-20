"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { buscarFuncionarios, deletarFuncionario } from "@/lib/supabase"
import { extrairDescritores, lerResposta } from "@/lib/cadastro-cliente"
import type { ProgressoCadastro as EstadoProgresso } from "@/lib/cadastro-cliente"
import { ProgressoCadastro } from "@/components/progresso-cadastro"
import { UserPlus, ArrowLeft, Check, Camera, Clock, AlertCircle } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import type { HorariosSemana, HorarioDia } from "@/lib/types"
import Image from "next/image"

// Horário padrão
const horarioPadrao: HorarioDia = {
  entrada: "08:00",
  saida_almoco: "12:00",
  retorno_almoco: "13:00",
  saida: "17:00",
  ativo: true,
}

// Função para calcular a carga horária diária em minutos com base nos horários
function calcularCargaHorariaDiaria(horario: HorarioDia): number {
  if (!horario || !horario.ativo) return 0

  try {
    // Converter horários para minutos desde meia-noite
    const [horaEntrada, minEntrada] = horario.entrada.split(":").map(Number)
    const [horaSaidaAlmoco, minSaidaAlmoco] = horario.saida_almoco.split(":").map(Number)
    const [horaRetornoAlmoco, minRetornoAlmoco] = horario.retorno_almoco.split(":").map(Number)
    const [horaSaida, minSaida] = horario.saida.split(":").map(Number)

    const entradaMinutos = horaEntrada * 60 + minEntrada
    const saidaAlmocoMinutos = horaSaidaAlmoco * 60 + minSaidaAlmoco
    const retornoAlmocoMinutos = horaRetornoAlmoco * 60 + minRetornoAlmoco
    const saidaMinutos = horaSaida * 60 + minSaida

    // Calcular tempo total usando a fórmula: (Saída - Entrada) - (Tempo de Almoço)
    const tempoTotal = saidaMinutos - entradaMinutos - (retornoAlmocoMinutos - saidaAlmocoMinutos)

    return tempoTotal
  } catch (error) {
    console.error("Erro ao calcular carga horária diária:", error)
    return 480 // 8 horas por padrão em caso de erro
  }
}

export default function Cadastrar() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [nome, setNome] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState("Preencha o nome do funcionário e capture imagens do rosto")
  const [progresso, setProgresso] = useState(0)
  const [capturas, setCapturas] = useState<number>(0)
  const [, setSorrisosCapturados] = useState(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [activeTab, setActiveTab] = useState("camera")
  const [steps] = useState<{ key: string; label: string; requiresSmile?: boolean; description: string }[]>([
    { key: "front", label: "Frente", description: "Olhe diretamente para a câmera" },
    { key: "smile", label: "Frente sorrindo", requiresSmile: true, description: "Sorria naturalmente olhando para a câmera" },
    { key: "left", label: "Perfil esquerdo", description: "Vire levemente à esquerda (~15°)" },
    { key: "right", label: "Perfil direito", description: "Vire levemente à direita (~15°)" },
    { key: "down", label: "Cabeça baixa", description: "Incline levemente a cabeça para baixo" },
    { key: "up", label: "Cabeça alta", description: "Incline levemente a cabeça para cima" },
  ])
  const [currentStep, setCurrentStep] = useState(0)
  // controle de vídeo ao alternar tabs/secções
  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    
    const needsCamera = activeTab === "camera" || activeTab === "atualizar"
    
    const handleCameraForTab = async () => {
      try {
        // Verificar se o elemento ainda está no DOM
        if (!vid.isConnected) {
          console.warn("Elemento de vídeo foi removido do DOM")
          return
        }
        
        if (needsCamera) {
          // Verificar se o stream existe e está ativo
          const streamInactive = !streamRef.current || 
            !streamRef.current.active || 
            streamRef.current.getTracks().every(track => track.readyState === 'ended')
          
          // Se precisa da câmera mas não tem stream ativo, recriar
          if (streamInactive) {
            console.log("🎥 Stream inativo, recriando câmera para aba:", activeTab)
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
              audio: false,
            })
            streamRef.current = stream
            setCameraActive(true)
            console.log("✅ Câmera reativada com sucesso")
          }
          
          // Definir o stream no vídeo
          if (streamRef.current) {
            ; (vid as unknown as { srcObject?: MediaStream }).srcObject = streamRef.current
            
            // Pequena pausa para o stream se estabilizar
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          
          // Garantir que está reproduzindo (com verificações de segurança)
          if (vid.paused) {
            try {
              if (vid.readyState >= 2) {
                await vid.play()
              } else {
                // Se não está pronto, aguardar o evento loadeddata
                const playPromise = new Promise<void>((resolve) => {
                  const onReady = () => {
                    vid.play().catch(err => console.warn("Erro ao reproduzir:", err))
                    resolve()
                  }
                  vid.addEventListener('loadeddata', onReady, { once: true })
                  // Timeout de segurança
                  setTimeout(() => {
                    vid.removeEventListener('loadeddata', onReady)
                    resolve()
                  }, 2000)
                })
                await playPromise
              }
            } catch (playError) {
              console.warn("Erro ao reproduzir vídeo (normal durante troca de stream):", playError)
            }
          }
        } else {
          // Se não precisa da câmera, pode pausar mas manter o stream
          vid.pause()
        }
      } catch (error) {
        console.error("Erro ao reativar câmera:", error)
        setStatus("Erro ao acessar a câmera")
      }
    }
    
    handleCameraForTab()
    
    // Verificação periódica da câmera quando está nas abas que precisam dela
    let cameraCheckInterval: NodeJS.Timeout | null = null
    if (needsCamera) {
      cameraCheckInterval = setInterval(() => {
        // Verificar apenas se realmente precisa e não está sendo usado
        if (streamRef.current && !streamRef.current.active && !isLoading) {
          console.log("🔄 Stream detectado inativo, reativando...")
          handleCameraForTab().catch(err => {
            console.warn("Erro na reativação automática:", err)
            setCameraActive(false)
          })
        }
      }, 3000) // Verificar a cada 3 segundos (menos agressivo)
    }
    
    return () => {
      if (cameraCheckInterval) {
        clearInterval(cameraCheckInterval)
      }
    }
  }, [activeTab, isLoading])
  const [error, setError] = useState<string | null>(null)
  const [logProcessamento, setLogProcessamento] = useState<string[]>([])
  // Estado da tela cheia de progresso. null = tela escondida.
  const [progressoCadastro, setProgressoCadastro] = useState<EstadoProgresso | null>(null)
  const fotosBase64Ref = useRef<string[]>([]) // Mudado para armazenar fotos em base64
  const [funcionariosExistentes, setFuncionariosExistentes] = useState<{ id: string; nome: string }[]>([])
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>("")
  const [modoOperacao, setModoOperacao] = useState<"novo" | "atualizar">("novo")
  const [horarios, setHorarios] = useState<HorariosSemana>({
    segunda: { ...horarioPadrao },
    terca: { ...horarioPadrao },
    quarta: { ...horarioPadrao },
    quinta: { ...horarioPadrao },
    sexta: { ...horarioPadrao },
    sabado: { ...horarioPadrao, ativo: false },
    domingo: { ...horarioPadrao, ativo: false },
  })

  // Inicializar câmera
  useEffect(() => {
    let mounted = true
    const vidLocal = videoRef.current
    const init = async () => {
      try {
        if (!vidLocal) return
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        })
        if (!mounted) return
        ; (vidLocal as unknown as { srcObject?: MediaStream }).srcObject = stream
        streamRef.current = stream
        setCameraActive(true)
        setStatus("Preencha o nome e capture imagens do rosto")
      } catch (e) {
        console.error("Falha ao iniciar câmera:", e)
        setStatus("Não foi possível inicializar a câmera")
      }
    }
    init()
    return () => {
      mounted = false
      if (vidLocal && vidLocal.srcObject) {
        const stream = vidLocal.srcObject as MediaStream
        stream.getTracks().forEach((t) => t.stop())
        setCameraActive(false)
      }
      streamRef.current = null
    }
  }, [])

  // Carregar funcionários existentes para atualização
  useEffect(() => {
    const carregar = async () => {
      try {
        const lista = await buscarFuncionarios()
        setFuncionariosExistentes(lista.map((f) => ({ id: f.id, nome: f.nome })))
      } catch {
        // silencioso
      }
    }
    carregar()
  }, [])

  // Capturar foto para AWS Rekognition (sem necessidade de detecção facial)
  const capturarImagem = async () => {
    if (isLoading) return
    if (!videoRef.current) return

    // Verificar se há nome (novo) ou funcionário selecionado (atualizar)
    if (modoOperacao === "novo" && nome.trim() === "") {
      setStatus("Preencha o nome do funcionário primeiro")
      return
    }
    if (modoOperacao === "atualizar" && !funcionarioSelecionado) {
      setStatus("Selecione um funcionário primeiro")
      return
    }

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

      // Capturar foto em base64 (AWS faz a detecção)
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error("Não foi possível obter contexto 2D")

      ctx.drawImage(video, 0, 0)
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1] // Alta qualidade para AWS

      // Armazenar foto
      fotosBase64Ref.current.push(imageBase64)

      const novasCapturas = capturas + 1
      setCapturas(novasCapturas)

      console.log(`📸 ETAPA ${currentStep + 1} (${step.label}): Foto capturada para AWS, Total: ${fotosBase64Ref.current.length}`)

      // Avançar para próxima etapa
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)

      if (nextStep >= steps.length) {
        setProgresso(100)
        if (modoOperacao === "novo") {
          setStatus("Todas as etapas concluídas! Configure os horários na próxima aba.")
          setActiveTab("horarios")
        } else {
          setStatus("Todas as etapas concluídas! Clique em 'Salvar Atualização' para processar.")
        }
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

  // Resetar captura para começar novamente
  const resetarCaptura = () => {
    setCurrentStep(0)
    setCapturas(0)
    setSorrisosCapturados(0)
    setProgresso(0)
    fotosBase64Ref.current = []
    setStatus("Pronto para iniciar nova captura")
  }

  // Reativar câmera manualmente (versão simplificada)
  const reativarCamera = async () => {
    try {
      setStatus("Reativando câmera...")
      
      // Parar stream anterior se existir
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      
      // Criar novo stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      })
      
      streamRef.current = stream
      setCameraActive(true)
      
      // Aplicar ao vídeo de forma mais simples
      if (videoRef.current) {
        const video = videoRef.current
        ; (video as unknown as { srcObject?: MediaStream }).srcObject = stream
        
        // Usar setTimeout para dar tempo ao stream se estabelecer
        setTimeout(() => {
          if (video.isConnected && video.paused) {
            video.play().catch(() => {
              // Ignorar erros de play, normais durante troca de stream
            })
          }
        }, 200)
      }
      
      setStatus("Câmera reativada com sucesso!")
      console.log("🎥 Câmera reativada manualmente")
    } catch (error) {
      console.error("Erro ao reativar câmera:", error)
      setStatus("Erro ao reativar câmera. Verifique as permissões.")
      setCameraActive(false)
    }
  }

  // Atualizar horário de um dia específico
  const atualizarHorario = (dia: keyof HorariosSemana, campo: keyof HorarioDia, valor: string | boolean) => {
    setHorarios((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [campo]: valor,
      },
    }))
  }

  // Calcular a carga horária média diária com base nos horários ativos
  const calcularCargaHorariaMedia = (): number => {
    let totalMinutos = 0
    let diasAtivos = 0

    Object.values(horarios).forEach((horario) => {
      if (horario && horario.ativo) {
        totalMinutos += calcularCargaHorariaDiaria(horario)
        diasAtivos++
      }
    })

    // Se não houver dias ativos, retornar 8 horas (480 minutos)
    if (diasAtivos === 0) return 480

    return Math.round(totalMinutos / diasAtivos)
  }

  // Marca a tela de progresso como erro, preservando o que já apareceu nela.
  const falharProgresso = (mensagem: string) => {
    setProgressoCadastro((atual) => ({
      fase: "erro",
      fotos: atual?.fotos ?? [],
      backend: atual?.backend ?? "",
      mensagem,
    }))
  }

  // Atualizar fotos de funcionário existente
  const atualizarFotosFuncionario = async () => {
    if (!funcionarioSelecionado) return
    try {
      setIsLoading(true)
      setError(null)
      setStatus("Processando fotos...")

      const fotos = fotosBase64Ref.current
      const descritores = await extrairDescritores(fotos, setProgressoCadastro)

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

      // Redirecionar após 3 segundos
      setTimeout(() => {
        router.push("/dashboard")
      }, 3000)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      falharProgresso(msg)
      setError(`Erro ao atualizar fotos: ${msg}`)
      setStatus("Erro ao atualizar fotos.")
      setIsLoading(false)
    }
  }

  // Cadastrar funcionário
  const cadastrarFuncionarioComHorarios = async () => {
    try {
      setError(null)
      setStatus("Cadastrando funcionário...")
      setIsLoading(true)

      const fotos = fotosBase64Ref.current
      const descritores = await extrairDescritores(fotos, setProgressoCadastro)

      // Calcular a carga horária média diária
      const cargaHorariaMedia = calcularCargaHorariaMedia()

      const response = await fetch('/api/aws/add-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          descritores,
          horarios,
          cargaHorariaDiaria: cargaHorariaMedia
        })
      })

      await lerResposta(response)

      setProgressoCadastro((atual) =>
        atual ? { ...atual, fase: "concluido" } : atual
      )
      setStatus(`Funcionário cadastrado com sucesso! ${descritores.length} foto(s) processada(s).`)

      // Redirecionar após 3 segundos
      setTimeout(() => {
        router.push("/dashboard")
      }, 3000)
    } catch (error) {
      console.error("Erro ao cadastrar funcionário:", error)
      const msg = error instanceof Error ? error.message : String(error)
      falharProgresso(msg)
      setError(`Erro ao cadastrar funcionário: ${msg}`)
      setStatus("Erro ao cadastrar funcionário.")
      setIsLoading(false)
    }
  }

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("authenticated")
    document.cookie = "authenticated=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
  }

  // Renderizar configuração de horário para um dia específico
  const renderHorarioDia = (dia: keyof HorariosSemana, nomeDia: string) => {
    const horarioDia = horarios[dia]
    if (!horarioDia) return null

    return (
      <div className="border rounded-md p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">{nomeDia}</h3>
          <div className="flex items-center">
            <Switch
              checked={horarioDia.ativo}
              onCheckedChange={(checked) => atualizarHorario(dia, "ativo", checked)}
              id={`ativo-${dia}`}
            />
            <Label htmlFor={`ativo-${dia}`} className="ml-2">
              {horarioDia.ativo ? "Ativo" : "Inativo"}
            </Label>
          </div>
        </div>

        <div className={`grid grid-cols-2 gap-4 ${!horarioDia.ativo ? "opacity-50" : ""}`}>
          <div className="space-y-2">
            <Label htmlFor={`entrada-${dia}`}>Entrada</Label>
            <Input
              id={`entrada-${dia}`}
              type="time"
              value={horarioDia.entrada}
              onChange={(e) => atualizarHorario(dia, "entrada", e.target.value)}
              disabled={!horarioDia.ativo}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`saida-almoco-${dia}`}>Saída para Almoço</Label>
            <Input
              id={`saida-almoco-${dia}`}
              type="time"
              value={horarioDia.saida_almoco}
              onChange={(e) => atualizarHorario(dia, "saida_almoco", e.target.value)}
              disabled={!horarioDia.ativo}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`retorno-almoco-${dia}`}>Retorno do Almoço</Label>
            <Input
              id={`retorno-almoco-${dia}`}
              type="time"
              value={horarioDia.retorno_almoco}
              onChange={(e) => atualizarHorario(dia, "retorno_almoco", e.target.value)}
              disabled={!horarioDia.ativo}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`saida-${dia}`}>Saída</Label>
            <Input
              id={`saida-${dia}`}
              type="time"
              value={horarioDia.saida}
              onChange={(e) => atualizarHorario(dia, "saida", e.target.value)}
              disabled={!horarioDia.ativo}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <DashboardHeader onLogout={handleLogout} />

      {/* Conteúdo principal */}
      <div className="container mx-auto p-6 flex-1">
        <Card className="w-full max-w-4xl mx-auto overflow-hidden shadow-lg">
          <CardHeader className="bg-primary text-white p-6">
            <div className="flex items-center gap-2">
              <UserPlus className="h-6 w-6" />
              <CardTitle className="text-2xl">Cadastro de Funcionário</CardTitle>
            </div>
            <CardDescription className="text-white/80">
              Preencha o nome, capture imagens do rosto e configure os horários
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-6">
              <div className="flex justify-center mb-4">
                <Image src="/logo.png" alt="Vitall Check-Up" width={150} height={75} className="h-auto" />
              </div>

              <div className="space-y-4">
                {/* Seleção de modo */}
                <div className="space-y-2">
                  <Label className="text-gray-700 font-semibold">O que deseja fazer?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setModoOperacao("novo")
                        setFuncionarioSelecionado("")
                        setNome("")
                        resetarCaptura()
                      }}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        modoOperacao === "novo"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <UserPlus className="h-6 w-6 mb-2" />
                      <div className="font-medium">Novo Funcionário</div>
                      <div className="text-sm opacity-75">Cadastrar nova pessoa</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModoOperacao("atualizar")
                        setNome("")
                        resetarCaptura()
                      }}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        modoOperacao === "atualizar"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <Camera className="h-6 w-6 mb-2" />
                      <div className="font-medium">Atualizar Fotos</div>
                      <div className="text-sm opacity-75">Melhorar reconhecimento</div>
                    </button>
                  </div>
                </div>

                {/* Campo de nome para novo funcionário */}
                {modoOperacao === "novo" && (
                  <div className="space-y-2">
                    <Label htmlFor="nome" className="text-gray-700">
                      Nome Completo
                    </Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Digite o nome completo"
                      className="border-gray-300"
                    />
                  </div>
                )}

                {/* Seleção de funcionário para atualizar */}
                {modoOperacao === "atualizar" && (
                  <div className="space-y-2">
                    <Label htmlFor="funcionario-select" className="text-gray-700">
                      Selecionar Funcionário
                    </Label>
                    <select
                      id="funcionario-select"
                      className="border rounded px-3 py-2 w-full border-gray-300"
                      value={funcionarioSelecionado}
                      onChange={(e) => {
                        setFuncionarioSelecionado(e.target.value)
                        const func = funcionariosExistentes.find(f => f.id === e.target.value)
                        if (func) setNome(func.nome)
                      }}
                    >
                      <option value="">Selecione um funcionário...</option>
                      {funcionariosExistentes.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <Alert className="mb-6 bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertTitle className="text-red-800">Erro</AlertTitle>
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <Alert className="mb-6 bg-primary/10 border-primary/30">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <AlertTitle className="text-primary">Captura de Imagens com Variações</AlertTitle>
              <AlertDescription className="text-primary-foreground">
                Siga as 6 etapas guiadas para capturar diferentes poses do rosto (frontal, sorrindo, perfis, etc.) para um reconhecimento facial mais robusto.
              </AlertDescription>
            </Alert>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
              <TabsList className={`grid w-full ${modoOperacao === "novo" ? "grid-cols-3" : "grid-cols-2"}`}>
                <TabsTrigger value="camera" className="flex items-center">
                  <Camera className="h-4 w-4 mr-2" />
                  Captura de Imagem
                </TabsTrigger>
                {modoOperacao === "novo" && (
                  <TabsTrigger value="horarios" className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Horários de Trabalho
                  </TabsTrigger>
                )}
                <TabsTrigger value="gerenciar" className="flex items-center">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Gerenciar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="camera" className="mt-4">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Coluna da câmera */}
                  <div className="relative bg-gray-900 aspect-square rounded-lg overflow-hidden">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                    {/* Status overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-primary/70 text-primary-foreground p-3 text-center">
                      <p className="font-medium">{status}</p>
                      {currentStep < steps.length && (
                        <p className="text-sm mt-1 opacity-90">{steps[currentStep].description}</p>
                      )}
                    </div>
                  </div>

                  {/* Coluna do progresso */}
                  <div className="flex flex-col">
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">Captura de Imagens</h2>

                    {/* Steps guiados */}
                    <div className="mb-4">
                      <div className="grid grid-cols-1 gap-2">
                        {steps.map((s, idx) => {
                          const isDone = idx < currentStep
                          const isCurrent = idx === currentStep
                          return (
                            <div
                              key={s.key}
                              className={`flex items-center justify-between rounded-md border px-3 py-2 ${isDone
                                  ? "border-green-200 bg-green-50 text-green-700"
                                  : isCurrent
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-gray-200 bg-white text-gray-700"
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isDone ? "bg-green-500" : isCurrent ? "bg-primary animate-pulse" : "bg-gray-300"}`} />
                                <span className="text-sm font-medium">{idx + 1}. {s.label}</span>
                              </div>
                              <span className={`text-xs font-medium ${isDone ? "text-green-600" : isCurrent ? "text-primary" : "text-gray-400"}`}>
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
                          <span className="text-green-700">Todas as etapas concluídas</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-gray-700">Progresso das Etapas</Label>
                          <span className="text-sm text-gray-500">
                            {currentStep} de {steps.length} etapas | {fotosBase64Ref.current.length} fotos
                          </span>
                        </div>
                        <Progress value={progresso} className="h-2 bg-secondary" indicatorClassName="bg-primary" />
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
                          disabled={
                            (modoOperacao === "novo" && !nome.trim()) ||
                            (modoOperacao === "atualizar" && !funcionarioSelecionado) ||
                            isLoading ||
                            currentStep >= steps.length ||
                            !cameraActive
                          }
                          className="w-full bg-primary hover:bg-primary/90 text-white"
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          {isLoading ? "Processando..." : currentStep < steps.length ? `Capturar ${steps[currentStep].label}` : "Todas as etapas concluídas"}
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

                        {currentStep >= steps.length && (
                          <div className="space-y-3">
                            <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center text-green-700">
                              <Check className="h-5 w-5 mr-2 text-green-600" />
                              Todas as etapas concluídas! {fotosBase64Ref.current.length} fotos capturadas.
                              {modoOperacao === "novo" && " Configure os horários na próxima aba."}
                            </div>

                            {modoOperacao === "atualizar" && (
                              <Button
                                onClick={atualizarFotosFuncionario}
                                disabled={isLoading || fotosBase64Ref.current.length === 0}
                                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
                              >
                                <Check className="mr-2 h-4 w-4" />
                                {isLoading ? "Salvando..." : "Salvar Atualização"}
                              </Button>
                            )}

                            <Button
                              onClick={resetarCaptura}
                              variant="outline"
                              className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                              Recapturar Todas as Etapas
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="horarios" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center mb-4">
                    <Clock className="h-5 w-5 text-primary mr-2" />
                    <h2 className="text-xl font-semibold text-gray-800">Configuração de Horários</h2>
                  </div>

                  <p className="text-gray-600 mb-4">
                    Configure os horários de trabalho para cada dia da semana. Desative os dias em que o funcionário não
                    trabalha.
                  </p>

                  {renderHorarioDia("segunda", "Segunda-feira")}
                  {renderHorarioDia("terca", "Terça-feira")}
                  {renderHorarioDia("quarta", "Quarta-feira")}
                  {renderHorarioDia("quinta", "Quinta-feira")}
                  {renderHorarioDia("sexta", "Sexta-feira")}
                  {renderHorarioDia("sabado", "Sábado")}
                  {renderHorarioDia("domingo", "Domingo")}

                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center text-blue-700 mb-2">
                      <Clock className="h-5 w-5 mr-2 text-blue-600" />
                      <span className="font-medium">Carga Horária Calculada</span>
                    </div>
                    <p className="text-blue-600">
                      Com base nos horários configurados, a carga horária média diária será de{" "}
                      <span className="font-bold">
                        {Math.floor(calcularCargaHorariaMedia() / 60)} horas e {calcularCargaHorariaMedia() % 60}{" "}
                        minutos
                      </span>
                      .
                    </p>
                  </div>

                  <div className="flex justify-between pt-6">
                    <Button
                      onClick={() => setActiveTab("camera")}
                      variant="outline"
                      className="border-secondary text-secondary hover:bg-secondary/10"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar para Captura
                    </Button>

                    <Button
                      onClick={cadastrarFuncionarioComHorarios}
                      disabled={!nome.trim() || currentStep < steps.length || isLoading}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {isLoading ? "Cadastrando..." : "Cadastrar Funcionário"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Gerenciar funcionários (excluir) */}
              <TabsContent value="gerenciar" className="mt-4">
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

                  <Button
                    variant="destructive"
                    disabled={!funcionarioSelecionado || isLoading}
                    onClick={async () => {
                      if (!funcionarioSelecionado) return
                      const confirma = window.confirm("Tem certeza que deseja excluir este funcionário e todos os registros de ponto associados?")
                      if (!confirma) return
                      try {
                        setIsLoading(true)
                        await deletarFuncionario(funcionarioSelecionado)
                        setFuncionarioSelecionado("")
                        setStatus("Funcionário excluído com sucesso")
                        // atualizar lista
                        const lista = await buscarFuncionarios()
                        setFuncionariosExistentes(lista.map((f) => ({ id: f.id, nome: f.nome })))
                      } catch {
                        setStatus("Erro ao excluir funcionário")
                      } finally {
                        setIsLoading(false)
                      }
                    }}
                  >
                    Excluir Funcionário
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
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
            if (modoOperacao === "novo") {
              cadastrarFuncionarioComHorarios()
            } else {
              atualizarFotosFuncionario()
            }
          }}
        />
      )}
</div>
  )
}
