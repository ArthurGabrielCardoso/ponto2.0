"use client"

/**
 * Página de Registro de Ponto - Otimizada para Modal.com
 * Version: Ultra-fast para Tablet Vision 7
 * 
 * Melhorias principais:
 * - Carregamento instantâneo (sem modelos pesados)
 * - Processamento via Modal API (GPU dedicada)
 * - Interface responsiva e otimizada
 */

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import { buscarFuncionarios, registrarPonto } from "@/lib/supabase"
import type { Funcionario } from "@/lib/types"
import "../ponto-registrado/ponto-batido.css"
import {
  initializeVisionModal,
  detectSingleFace,
  estimateSmileSimple,
  computeEmbeddingModal,
  computeEmbeddingFallback,
  findBestMatchKnnAdvanced,
  assessImageQuality,
  type LoadedVisionModelsModal,
  type QualityMetrics,
} from "@/lib/face-pipeline-modal"

export default function RegistrarPontoModal() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [isLoading] = useState(false)
  const [status, setStatus] = useState("Carregando câmera...")
  const [isCooldown, setIsCooldown] = useState(false)
  const [models, setModels] = useState<LoadedVisionModelsModal | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const recognizedRef = useRef<{ id: string; nome: string } | null>(null)
  const smilingFramesRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  // Estados da interface
  const [showSuccess, setShowSuccess] = useState(false)
  const [successData, setSuccessData] = useState({ nome: '', mensagem: '', tipo: '', hora: '', data: '' })
  const [currentSmileScore, setCurrentSmileScore] = useState(0)
  const [isRecognized, setIsRecognized] = useState(false)
  const [, setRecognizedUser] = useState<{id: string, nome: string} | null>(null)
  const [screensaver, setScreensaver] = useState(true)
  const screensaverRef = useRef(true)
  
  // Indicadores visuais
  const [showUnrecognized, setShowUnrecognized] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const unrecTimerRef = useRef<number | null>(null)
  const inactivityTimerRef = useRef<number | null>(null)
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null)
  
  // Thresholds adaptativos
  const [adaptiveThreshold, setAdaptiveThreshold] = useState(1.2)
  const [adaptiveConfidence, setAdaptiveConfidence] = useState(0.15)
  const [failureCount, setFailureCount] = useState(0)

  // Detecção de dispositivo lento (tablet fraco)
  const [isSlowDevice, setIsSlowDevice] = useState(false)
  
  useEffect(() => {
    // Detectar dispositivos lentos baseado em userAgent ou performance
    const isSlow = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()) ||
                   navigator.hardwareConcurrency <= 2 ||
                   (navigator as any).deviceMemory <= 2
    setIsSlowDevice(isSlow)
    console.log(`📱 Dispositivo detectado como ${isSlow ? 'lento' : 'rápido'}`)
  }, [])

  useEffect(() => {
    screensaverRef.current = screensaver
  }, [screensaver])

  // Inicialização ultra-rápida - apenas BlazeFace
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        setStatus("Inicializando detector facial...")
        const v = await initializeVisionModal()
        if (!mounted) return
        setModels(v)
        setStatus("Carregando funcionários...")
      } catch (e) {
        console.error("Falha ao inicializar visão:", e)
        setStatus("Erro ao carregar detector facial")
      }
    }
    init()
    return () => {
      mounted = false
    }
  }, [])

  // Carregar funcionários quando detector estiver pronto
  useEffect(() => {
    const carregar = async () => {
      try {
        const dados = await buscarFuncionarios()
        const validos = dados.filter((f) => f.id && f.nome && (f.descritores?.length || 0) > 0)
        setFuncionarios(validos)
        
        console.log(`🧑‍💼 FUNCIONÁRIOS CARREGADOS: ${validos.length} funcionários válidos`)
        
        if (validos.length === 0) {
          setStatus("Nenhum funcionário cadastrado. Cadastre pelo menos um funcionário.")
          return
        }
        
        if (!cameraActive) await startCamera()
        setStatus("Posicione seu rosto na câmera")
        if (models) startLoop()
      } catch (e) {
        console.error("Erro ao carregar funcionários:", e)
        setStatus("Erro ao carregar funcionários")
      }
    }
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, cameraActive])

  // Iniciar câmera
  const startCamera = async () => {
    if (!videoRef.current) return
    try {
      setStatus("Ativando câmera...")
      const constraints = {
        video: {
          width: { ideal: 640 }, // Reduzido de 1280 para 640
          height: { ideal: 480 }, // Reduzido de 720 para 480
          facingMode: "user" as const,
        },
        audio: false,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      videoRef.current.srcObject = stream
      setCameraActive(true)
      setStatus("Câmera ativa! Posicione seu rosto")
    } catch (error) {
      console.error("Erro ao acessar a câmera:", error)
      setStatus("Não foi possível acessar a câmera")
    }
  }

  // Parar câmera
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((t) => t.stop())
      setCameraActive(false)
    }
  }, [])

  // Loop de detecção otimizado - Vai direto pro reconhecimento (sempre tem rosto)
  const startLoop = () => {
    if (!videoRef.current || !models) return
    const video = videoRef.current
    let lastTs = 0
    let lastRecognitionTs = 0
    let failCount = 0

    const loop = async (ts: number) => {
      rafRef.current = requestAnimationFrame(loop)
      
      if (isCooldown || showSuccess) return
      if (ts - lastTs < (isSlowDevice ? 500 : 333)) return // Dispositivos lentos: ~2 FPS, outros: ~3 FPS
      lastTs = ts

      // Verificar se vídeo está pronto
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        return // Vídeo ainda carregando
      }

      try {
        // === MODO SCREENSAVER: Tentar reconhecer para acordar ===
        if (screensaverRef.current) {
          const recognitionInterval = isSlowDevice ? 4000 : 3000
          if ((ts - lastRecognitionTs) > recognitionInterval && !isProcessing) {
            lastRecognitionTs = ts
            setIsProcessing(true)
            setStatus("Identificando...")
            
            try {
              // Tentar reconhecer direto (sem detecção)
              const embedding = await computeEmbeddingModal(video, [0, 0, video.videoWidth, video.videoHeight], { marginRatio: 0.35 })
              const match = findBestMatchKnnAdvanced(embedding, funcionarios, 5, true)
              
              if (match.id && match.nome && match.distance < adaptiveThreshold && (match.confidence || 0) >= adaptiveConfidence) {
                // Acordar sistema
                setScreensaver(false)
                setIsRecognized(true)
                setRecognizedUser({ id: match.id, nome: match.nome })
                recognizedRef.current = { id: match.id, nome: match.nome }
                setFailureCount(0)
                setShowUnrecognized(false)
                setStatus(`${match.nome} - Sorria para registrar! 😊`)
              } else {
                failCount++
              }
            } catch (error) {
              console.error("Erro na API de screensaver:", error)
              failCount++
            } finally {
              setIsProcessing(false)
            }
          }
          return
        }

        resetInactivityTimer()

        // === RECONHECIMENTO: Vai direto, sem detecção ===
        const recognitionInterval = isSlowDevice ? 4000 : 3000
        const shouldRecognize = !isRecognized && (ts - lastRecognitionTs) > recognitionInterval
        
        if (shouldRecognize && !isProcessing) {
          lastRecognitionTs = ts
          setIsProcessing(true)
          setStatus(failCount > 0 ? "Tentando novamente..." : "Identificando...")
          
          try {
            // Reconhecer direto do vídeo - usar toda a área
            const embedding = await computeEmbeddingModal(video, [0, 0, video.videoWidth, video.videoHeight], { marginRatio: 0.35 })
            const match = findBestMatchKnnAdvanced(embedding, funcionarios, 5, true)
            
            if (match.id && match.nome && match.distance < adaptiveThreshold && (match.confidence || 0) >= adaptiveConfidence) {
              // Usuário reconhecido
              setIsRecognized(true)
              setRecognizedUser({ id: match.id, nome: match.nome })
              recognizedRef.current = { id: match.id, nome: match.nome }
              setFailureCount(0)
              setShowUnrecognized(false)
              setStatus(`${match.nome} - Sorria para registrar! 😊`)
            } else {
              handleRecognitionFailure(match)
            }
          } catch (error) {
            console.error("Erro na API Modal:", error)
            setStatus("Erro na identificação - Tentando novamente...")
            
            // Fallback para embedding local
            try {
              const fallbackEmbedding = computeEmbeddingFallback()
              findBestMatchKnnAdvanced(fallbackEmbedding, funcionarios, 5, false)
              setStatus(`Modo offline - Confiabilidade limitada`)
            } catch (fallbackError) {
              console.error("Erro no fallback:", fallbackError)
            }
          } finally {
            setIsProcessing(false)
          }
        }

        // === DETECÇÃO DE QUALIDADE (apenas para feedback, não bloqueia reconhecimento) ===
        try {
          const det = await detectSingleFace(video, models.blazefaceModel)
          if (det) {
            const quality = assessImageQuality(video, det.bbox, det.landmarks)
            setQualityMetrics(quality)
            
            // Feedback apenas se qualidade muito ruim
            if (quality.overall < 0.2) {
              if (quality.faceSize < 0.3) {
                setStatus("Aproxime-se mais da câmera")
              } else if (quality.pose < 0.4) {
                setStatus("Centralize seu rosto na câmera")
              }
            } else if (!isRecognized && quality.overall > 0.3) {
              setStatus("Posicione seu rosto na câmera")
            }
          } else {
            setQualityMetrics(null)
            if (!isRecognized) {
              setStatus("Posicione seu rosto na câmera")
            }
          }
        } catch (e) {
          // Detecção de qualidade falhou, mas continua tentando reconhecimento
          console.warn("Erro ao avaliar qualidade:", e)
        }

        // === DETECÇÃO DE SORRISO (após reconhecimento) ===
        if (isRecognized && recognizedRef.current) {
          try {
            const det = await detectSingleFace(video, models.blazefaceModel)
            if (det) {
              const smileScore = estimateSmileSimple(det)
              setCurrentSmileScore(smileScore)
              const smiling = smileScore >= 0.3
              
              if (smiling) smilingFramesRef.current++
              else smilingFramesRef.current = Math.max(0, smilingFramesRef.current - 1)

              const SMILE_FRAMES_REQUIRED_LOCAL = isSlowDevice ? 2 : 3
              const progress = Math.min(100, (smilingFramesRef.current / SMILE_FRAMES_REQUIRED_LOCAL) * 100)
              
              if (smilingFramesRef.current >= SMILE_FRAMES_REQUIRED_LOCAL) {
                // Registrar ponto!
                if (rafRef.current) {
                  cancelAnimationFrame(rafRef.current)
                  rafRef.current = null
                }
                await handleRegistro(recognizedRef.current.id, recognizedRef.current.nome)
                return
              } else if (smiling) {
                setStatus(`Continue sorrindo... ${Math.round(progress)}%`)
              } else {
                setStatus("Sorria para confirmar o registro! 😊")
              }
            }
          } catch (e) {
            console.warn("Erro ao detectar sorriso:", e)
          }
        }

      } catch (e) {
        console.error("Erro no loop de visão:", e)
        setStatus("Erro no processamento - Tentando novamente...")
      }
    }
    
    rafRef.current = requestAnimationFrame(loop)
  }

  // Função auxiliar para tratar falha de reconhecimento
  const handleRecognitionFailure = (match: { id: string | null; nome: string | null; distance: number; confidence: number | null }) => {
    const newFailureCount = failureCount + 1
    setFailureCount(newFailureCount)
    
    // Ajuste adaptativo
    if (newFailureCount > 3 && newFailureCount % 2 === 0) {
      if (match.distance >= adaptiveThreshold) {
        const newThreshold = Math.min(2.0, adaptiveThreshold + 0.1)
        setAdaptiveThreshold(newThreshold)
        console.log(`🔧 AUTO-AJUSTE: Threshold → ${newThreshold.toFixed(1)}`)
      } else {
        const newConfidence = Math.max(0.05, adaptiveConfidence - 0.03)
        setAdaptiveConfidence(newConfidence)
        console.log(`🔧 AUTO-AJUSTE: Confiança → ${(newConfidence * 100).toFixed(0)}%`)
      }
    }

    const reason = match.distance >= adaptiveThreshold 
      ? `distância: ${match.distance.toFixed(2)}`
      : `confiança: ${((match.confidence || 0) * 100).toFixed(0)}%`
    
    setStatus(`Rosto não reconhecido (${reason})`)
    setShowUnrecognized(true)
    
    if (unrecTimerRef.current) clearTimeout(unrecTimerRef.current)
    unrecTimerRef.current = window.setTimeout(() => setShowUnrecognized(false), 2000)
  }

  // Reset timer de inatividade
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = window.setTimeout(() => {
      setScreensaver(true)
    }, 5 * 60 * 1000) // 5 minutos
  }

  // Registrar ponto
  const handleRegistro = async (id: string, nome: string) => {
    if (isCooldown) return
    setIsCooldown(true)
    
    try {
      const now = new Date()
      resetInactivityTimer()
      
      setStatus("Registrando ponto...")
      const resultado = await registrarPonto(id, nome)
      
      const primeiroNome = nome.split(' ')[0]
      
      const getMensagemPorTipo = (tipo: string) => {
        switch(tipo.toLowerCase()) {
          case 'entrada':
            return `Excelente dia, ${primeiroNome}!`
          case 'saida_almoco':
          case 'saída para almoço':
            return `Excelente almoço, ${primeiroNome}!`
          case 'retorno_almoco':
          case 'retorno do almoço':
            return `Excelente retorno do almoço, ${primeiroNome}!`
          case 'saida':
          case 'saída':
            return `Excelente noite e descanso, ${primeiroNome}!`
          default:
            return `Excelente dia, ${primeiroNome}!`
        }
      }
      
      setSuccessData({
        nome: primeiroNome,
        mensagem: getMensagemPorTipo(resultado.tipo),
        tipo: resultado.tipo,
        hora: now.toLocaleTimeString(),
        data: now.toLocaleDateString()
      })
      setShowSuccess(true)
      
      // Auto-retorno em 45 segundos
      setTimeout(() => {
        resetToInitialState()
      }, 45000)
      
    } catch (e) {
      console.error("Erro ao registrar ponto:", e)
      setStatus("Erro ao registrar ponto. Tente novamente")
      setIsCooldown(false)
    }
  }

  // Reset para estado inicial
  const resetToInitialState = () => {
    setShowSuccess(false)
    setIsCooldown(false)
    recognizedRef.current = null
    setIsRecognized(false)
    setRecognizedUser(null)
    smilingFramesRef.current = 0
    setIsProcessing(false)
    setFailureCount(0)
    
    if (models && !rafRef.current) {
      startLoop()
    }
  }

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera()
      if (unrecTimerRef.current) clearTimeout(unrecTimerRef.current)
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    }
  }, [stopCamera])

  return (
    <div className="relative min-h-screen w-full bg-secondary">
      {/* Vídeo em tela cheia */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="absolute inset-0 h-full w-full object-cover" 
      />

      {/* Logo no topo esquerdo */}
      <div className="absolute top-4 left-4 z-10">
        <Image 
          src="/logo.png" 
          alt="Logo" 
          width={140} 
          height={70} 
          priority 
          style={{ height: "auto" }} 
        />
      </div>

      {/* Indicadores de performance/qualidade */}
      {qualityMetrics && !screensaver && (
        <div className="absolute top-4 right-4 z-10 bg-black/70 text-white p-3 rounded-lg text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className={`flex items-center gap-1 ${qualityMetrics.faceSize > 0.4 ? 'text-green-400' : 'text-yellow-400'}`}>
              📏 {(qualityMetrics.faceSize * 100).toFixed(0)}%
            </div>
            <div className={`flex items-center gap-1 ${qualityMetrics.pose > 0.5 ? 'text-green-400' : 'text-yellow-400'}`}>
              🎯 {(qualityMetrics.pose * 100).toFixed(0)}%
            </div>
            <div className={`flex items-center gap-1 ${currentSmileScore >= 0.3 ? 'text-green-400' : 'text-red-400'}`}>
              😊 {(currentSmileScore * 100).toFixed(0)}%
            </div>
            <div className={`flex items-center gap-1 ${isProcessing ? 'text-blue-400' : isRecognized ? 'text-green-400' : 'text-gray-400'}`}>
              🤖 {isProcessing ? 'AI...' : isRecognized ? 'OK' : 'OFF'}
            </div>
          </div>
          <div className="mt-1 text-center text-xs">
            Sorriso: {smilingFramesRef.current}/4 frames
          </div>
        </div>
      )}

      {/* Status inferior */}
      {(recognizedRef.current || showUnrecognized || isProcessing) && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 py-4 text-center text-lg font-medium ${
            recognizedRef.current 
              ? "bg-green-600/80 text-white" 
              : isProcessing 
              ? "bg-blue-600/80 text-white"
              : "bg-red-600/80 text-white"
          }`}
        >
          {isProcessing && (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processando via IA...
            </div>
          )}
          {recognizedRef.current && !isProcessing && `✅ ${recognizedRef.current.nome}`}
          {showUnrecognized && !isProcessing && "❌ Rosto não reconhecido"}
        </div>
      )}

      {/* Proteção de tela */}
      {screensaver && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer select-none bg-primary/75"
          onClick={() => {
            setScreensaver(false)
            resetInactivityTimer()
          }}
        >
          <div className="text-center text-white">
            <Image 
              src="/logo.png" 
              alt="Logo" 
              width={420} 
              height={210} 
              priority 
              style={{ height: "auto" }} 
            />
            <p className="mt-4 text-xl">Toque na tela para ativar</p>
          </div>
        </div>
      )}

      {/* Loader inicial */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
            <span className="text-lg">Carregando sistema...</span>
          </div>
        </div>
      )}

      {/* Tela de sucesso */}
      {showSuccess && (
        <div className="absolute inset-0 z-40">
          <div className="ponto-batido-container">
            {/* Lado esquerdo - texto */}
            <div className="ponto-batido-form-section relative">
              <div className="absolute top-4 left-4 z-10">
                <Image 
                  src="/logo.png" 
                  alt="Logo" 
                  width={140} 
                  height={70} 
                  priority 
                  style={{ height: "auto" }} 
                />
              </div>
              
              <div className="w-full max-w-md">
                <div className="text-center space-y-6 mt-20">
                  {/* Animação de sucesso */}
                  <div className="flex justify-center">
                    <div style={{ width: '200px', height: '200px' }}>
                      <DotLottieReact
                        src="https://lottie.host/8a95b3ad-f30a-4fb9-a55d-4153b3b92810/RPsps2O63O.lottie"
                        loop={false}
                        autoplay
                      />
                    </div>
                  </div>
                  
                  <h1 className="text-3xl font-bold" style={{ color: "#c69e6b" }}>
                    {successData.mensagem}
                  </h1>
                  
                  <div className="text-sm text-gray-600 bg-green-50 rounded-lg p-3 border border-green-200">
                    <span className="text-green-700 font-semibold">{successData.tipo}</span> registrada às{' '}
                    <span className="font-semibold">{successData.hora}</span> em {successData.data}
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    Voltando automaticamente em alguns segundos...
                  </div>
                  
                  <div className="absolute bottom-4 left-4">
                    <button
                      onClick={resetToInitialState}
                      className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Lado direito - favicon */}
            <div className="ponto-batido-image-section">
              <Image 
                src="/favicon.png" 
                alt="Favicon" 
                width={300} 
                height={300} 
                className="ponto-batido-favicon"
                priority
              />
            </div>
          </div>
        </div>
      )}

      {/* Status de carregamento central */}
      {!screensaver && !showSuccess && status && !isRecognized && !showUnrecognized && (
        <div className="absolute bottom-20 left-0 right-0 z-10 text-center">
          <div className="inline-block bg-black/70 text-white px-6 py-3 rounded-lg text-lg">
            {status}
          </div>
        </div>
      )}
    </div>
  )
}