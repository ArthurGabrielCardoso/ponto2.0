"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { X, Clock, ArrowLeft } from "lucide-react"

function AlarmeAtivoContent() {
  const searchParams = useSearchParams()
  const [horarioRetorno, setHorarioRetorno] = useState<string>("")
  const [funcionarioNome, setFuncionarioNome] = useState<string>("")
  const [alarmeAtivo, setAlarmeAtivo] = useState<boolean>(true)
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [tempoRestante, setTempoRestante] = useState<string>("")

  // Carregar parâmetros da URL
  useEffect(() => {
    const horario = searchParams.get('horario')
    const nome = searchParams.get('nome')
    
    if (horario) setHorarioRetorno(horario)
    if (nome) setFuncionarioNome(nome)
    
    // Se não vieram parâmetros, tentar recuperar do localStorage
    if (!horario || !nome) {
      const funcionarioId = localStorage.getItem('alarme_funcionario_id')
      if (funcionarioId) {
        // Buscar dados do localStorage ou definir padrões
        setHorarioRetorno(new Date().toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }))
        setFuncionarioNome('Funcionário')
      }
    }
  }, [searchParams])

  // Som alternativo via Web Audio API
  const tentarSomAlternativo = useCallback(() => {
    try {
      const audioContext = new AudioContext()
      const criarBeep = (frequencia: number, duracao: number) => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.value = frequencia
        oscillator.type = 'square'
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duracao)
        
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + duracao)
      }
      
      // Tocar sequência de beeps repetitivos
      const tocarSequencia = () => {
        criarBeep(800, 0.5) // Beep 1
        setTimeout(() => criarBeep(600, 0.5), 600) // Beep 2
        setTimeout(() => criarBeep(800, 0.5), 1200) // Beep 3
      }
      
      tocarSequencia()
      
      // Repetir a cada 3 segundos
      const intervaloSom = setInterval(() => {
        if (alarmeAtivo) {
          tocarSequencia()
        } else {
          clearInterval(intervaloSom)
        }
      }, 3000)
      
    } catch (error) {
      console.warn('⚠️ Erro no som alternativo:', error)
    }
  }, [alarmeAtivo])

  // Configurar alarme full-screen
  useEffect(() => {
    if (!alarmeAtivo) return

    const configurarAlarme = async () => {
      try {
        // 1. Entrar em tela cheia
        if (document.documentElement.requestFullscreen) {
          try {
            await document.documentElement.requestFullscreen()
            console.log('📱 Tela cheia ativada')
          } catch (error) {
            console.warn('⚠️ Não foi possível ativar tela cheia:', error)
          }
        }

        // 2. Manter tela ligada (Wake Lock)
        if ('wakeLock' in navigator) {
          try {
            const lock = await navigator.wakeLock.request('screen')
            setWakeLock(lock)
            console.log('💡 Wake Lock ativado')
          } catch (error) {
            console.warn('⚠️ Não foi possível ativar Wake Lock:', error)
          }
        }

        // 3. Vibrar celular
        if ('vibrate' in navigator) {
          // Vibração longa e repetitiva
          const padraoVibracao = [1000, 300, 1000, 300, 1000]
          navigator.vibrate(padraoVibracao)
          
          // Repetir vibração a cada 10 segundos
          const vibracao = setInterval(() => {
            if (alarmeAtivo) {
              navigator.vibrate(padraoVibracao)
            } else {
              clearInterval(vibracao)
            }
          }, 10000)
        }

        // 4. Tocar som do alarme
        if (audioRef.current) {
          audioRef.current.volume = 1.0 // Volume máximo
          audioRef.current.loop = true
          try {
            await audioRef.current.play()
            console.log('🔊 Áudio iniciado')
          } catch (error) {
            console.warn('⚠️ Erro ao tocar áudio:', error)
            // Tentar som alternativo via Web Audio API
            tentarSomAlternativo()
          }
        }

      } catch (error) {
        console.error('❌ Erro ao configurar alarme:', error)
      }
    }

    configurarAlarme()

    // Cleanup ao desmontar
    return () => {
      if (wakeLock) {
        wakeLock.release()
      }
      const audio = audioRef.current
      if (audio) {
        audio.pause()
      }
    }
  }, [alarmeAtivo, wakeLock, tentarSomAlternativo])

  // Calcular tempo restante
  useEffect(() => {
    if (!horarioRetorno) return

    const calcularTempo = () => {
      try {
        const agora = new Date()
        const [hora, minuto] = horarioRetorno.split(':').map(Number)
        const retorno = new Date()
        retorno.setHours(hora, minuto, 0, 0)
        
        // Se o horário já passou, é para amanhã
        if (retorno < agora) {
          retorno.setDate(retorno.getDate() + 1)
        }
        
        const diferenca = retorno.getTime() - agora.getTime()
        
        if (diferenca > 0) {
          const minutos = Math.floor(diferenca / (1000 * 60))
          const segundos = Math.floor((diferenca % (1000 * 60)) / 1000)
          setTempoRestante(`${minutos}min ${segundos}s`)
        } else {
          setTempoRestante("Atrasado!")
        }
      } catch (error) {
        console.warn('⚠️ Erro ao calcular tempo:', error)
        setTempoRestante("")
      }
    }

    calcularTempo()
    const intervalo = setInterval(calcularTempo, 1000)
    
    return () => clearInterval(intervalo)
  }, [horarioRetorno])

  // Desligar alarme
  const desligarAlarme = async () => {
    console.log('🔴 Desligando alarme')
    
    // Parar som
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    
    // Liberar Wake Lock
    if (wakeLock) {
      try {
        await wakeLock.release()
        console.log('💡 Wake Lock liberado')
      } catch (error) {
        console.warn('⚠️ Erro ao liberar Wake Lock:', error)
      }
    }
    
    // Sair da tela cheia
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
        console.log('📱 Saiu da tela cheia')
      } catch (error) {
        console.warn('⚠️ Erro ao sair da tela cheia:', error)
      }
    }
    
    // Parar vibração
    if ('vibrate' in navigator) {
      navigator.vibrate(0)
    }
    
    setAlarmeAtivo(false)
    
    // Redirecionar de volta para configuração após 2 segundos
    setTimeout(() => {
      window.location.href = '/meu-alarme'
    }, 2000)
  }

  // Soneca de 5 minutos
  const soneca = () => {
    console.log('😴 Soneca ativada')
    
    // Parar alarme temporariamente
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0)
    }
    
    setAlarmeAtivo(false)
    
    // Mostrar mensagem de soneca
    alert('😴 Soneca de 5 minutos ativada!\nO alarme tocará novamente em 5 minutos.')
    
    // Reativar alarme em 5 minutos
    setTimeout(() => {
      setAlarmeAtivo(true)
    }, 5 * 60 * 1000)
    
    // Voltar para página anterior
    window.location.href = '/meu-alarme'
  }

  // Escutar mensagens do Service Worker
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'MOSTRAR_ALARME_FULLSCREEN') {
        console.log('📨 Recebida mensagem do SW para mostrar alarme')
        setHorarioRetorno(event.data.horarioRetorno)
        setFuncionarioNome(event.data.funcionarioNome)
        setAlarmeAtivo(true)
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleMessage)
    
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage)
    }
  }, [])

  if (!alarmeAtivo) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Alarme Desligado</h1>
          <p className="text-gray-600">Redirecionando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex flex-col items-center justify-center text-white overflow-hidden">
      {/* Som do alarme */}
      <audio
        ref={audioRef}
        preload="auto"
        className="hidden"
      >
        <source src="/sounds/alarm.mp3" type="audio/mpeg" />
        <source src="/sounds/alarm.wav" type="audio/wav" />
      </audio>

      {/* Logo da clínica */}
      <div className="mb-8 animate-pulse">
        <Image 
          src="/logo.png" 
          alt="Logo" 
          width={250} 
          height={125} 
          className="drop-shadow-2xl"
          priority
        />
      </div>

      {/* Animação de alarme */}
      <div className="mb-8 relative">
        <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center animate-ping absolute">
        </div>
        <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center animate-pulse">
          <Clock className="w-16 h-16 text-white" />
        </div>
      </div>

      {/* Mensagem principal */}
      <div className="text-center mb-12 px-6">
        <h1 className="text-5xl md:text-7xl font-bold mb-4 animate-bounce drop-shadow-lg">
          ⏰ HORA DE VOLTAR!
        </h1>
        
        {funcionarioNome && (
          <p className="text-2xl md:text-3xl mb-6 drop-shadow-md">
            <strong>{funcionarioNome}</strong>
          </p>
        )}
        
        {horarioRetorno && (
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-6">
            <p className="text-xl md:text-2xl mb-2">
              Retorne às:
            </p>
            <p className="text-4xl md:text-6xl font-mono font-bold drop-shadow-lg">
              {horarioRetorno}
            </p>
            {tempoRestante && (
              <p className="text-lg md:text-xl mt-2 opacity-90">
                {tempoRestante.includes('Atrasado') ? (
                  <span className="text-red-200 font-bold animate-pulse">
                    🚨 {tempoRestante}
                  </span>
                ) : (
                  <span>
                    Restam: {tempoRestante}
                  </span>
                )}
              </p>
            )}
          </div>
        )}
        
        <p className="text-lg md:text-xl opacity-90 mb-8">
          🍽️ Seu tempo de almoço acabou!
        </p>
      </div>

      {/* Botões de ação */}
      <div className="flex flex-col sm:flex-row gap-4 px-6">
        <Button
          onClick={desligarAlarme}
          size="lg"
          className="bg-white text-primary hover:bg-gray-100 font-bold text-lg px-8 py-4 rounded-2xl shadow-2xl transition-all transform hover:scale-105"
        >
          <X className="mr-2 h-6 w-6" />
          Desligar Alarme
        </Button>
        
        <Button
          onClick={soneca}
          variant="outline"
          size="lg"
          className="border-white/50 text-white hover:bg-white/20 font-bold text-lg px-8 py-4 rounded-2xl backdrop-blur-sm transition-all transform hover:scale-105"
        >
          <Clock className="mr-2 h-6 w-6" />
          Soneca (5min)
        </Button>
      </div>

      {/* Botão voltar (pequeno, no canto) */}
      <Button
        onClick={() => window.location.href = '/meu-alarme'}
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 text-white/70 hover:text-white hover:bg-white/20"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      {/* Indicador de som */}
      <div className="absolute top-4 right-4 text-white/70 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          Som ativo
        </div>
      </div>

      {/* Efeitos visuais */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Círculos animados */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full animate-ping"></div>
        <div className="absolute top-3/4 right-1/4 w-48 h-48 bg-white/5 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/5 rounded-full animate-ping" style={{ animationDelay: '2s' }}></div>
      </div>
    </div>
  )
}

export default function AlarmeAtivo() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-white">Carregando...</div>}>
      <AlarmeAtivoContent />
    </Suspense>
  )
}