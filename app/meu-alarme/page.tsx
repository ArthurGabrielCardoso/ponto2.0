"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { buscarFuncionarios } from "@/lib/supabase"
import type { Funcionario } from "@/lib/types"
import Image from "next/image"
import { Bell, BellOff, Clock, User, Smartphone } from "lucide-react"

export default function MeuAlarme() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>("")
  const [alarmeAtivo, setAlarmeAtivo] = useState<boolean>(false)
  const [permissoesOK, setPermissoesOK] = useState<boolean>(false)
  const [status, setStatus] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [serviceworkerOK, setServiceWorkerOK] = useState<boolean>(false)

  // Carregar funcionários e estado do alarme
  useEffect(() => {
    const carregarDados = async () => {
      try {
        // Buscar funcionários
        const dados = await buscarFuncionarios()
        setFuncionarios(dados)

        // Recuperar estado salvo do localStorage
        const funcionarioSalvo = localStorage.getItem('alarme_funcionario_id')
        const alarmeAtivoSalvo = localStorage.getItem('alarme_ativo') === 'true'
        
        if (funcionarioSalvo) {
          setFuncionarioSelecionado(funcionarioSalvo)
          setAlarmeAtivo(alarmeAtivoSalvo)
        }

        // Verificar se service worker está registrado
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration()
          setServiceWorkerOK(!!registration)
        }

        // Verificar permissões existentes
        verificarPermissoes()
      } catch (error) {
        console.error("Erro ao carregar dados:", error)
        setStatus("❌ Erro ao carregar funcionários")
      }
    }
    carregarDados()
  }, [])

  // Verificar status das permissões
  const verificarPermissoes = async () => {
    try {
      let todasPermissoes = true
      let statusTexto = ""

      // Verificar notificações
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const notificationStatus = Notification.permission
        if (notificationStatus !== 'granted') {
          todasPermissoes = false
          statusTexto += "🔔 Notificações não permitidas. "
        }
      } else {
        todasPermissoes = false
        statusTexto += "❌ Notificações não suportadas. "
      }

      // Verificar wake lock (manter tela ligada)
      if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
        statusTexto += "⚠️ Wake Lock não suportado. "
      }

      // Verificar fullscreen
      if (!document.documentElement.requestFullscreen) {
        statusTexto += "⚠️ Tela cheia pode não funcionar. "
      }

      setPermissoesOK(todasPermissoes)
      if (statusTexto) {
        setStatus(statusTexto)
      } else {
        setStatus("✅ Todas as permissões OK!")
      }
    } catch (error) {
      console.error("Erro ao verificar permissões:", error)
      setPermissoesOK(false)
    }
  }

  // Solicitar todas as permissões necessárias
  const solicitarPermissoes = async () => {
    setIsLoading(true)
    setStatus("📱 Solicitando permissões...")

    try {
      // 1. Permissão para notificações
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          throw new Error('Permissão de notificação negada')
        }
      }

      // 2. Registrar service worker se não estiver registrado
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !serviceworkerOK) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js')
          console.log('Service Worker registrado:', registration)
          setServiceWorkerOK(true)
        } catch (swError) {
          console.warn('Erro ao registrar Service Worker:', swError)
          // Continuar mesmo sem SW
        }
      }

      // 3. Testar áudio
      try {
        const audio = new Audio('/sounds/test-beep.mp3')
        audio.volume = 0.1 // Volume baixo para teste
        await audio.play()
        audio.pause()
      } catch (audioError) {
        console.warn('Áudio pode não funcionar:', audioError)
      }

      // 4. Testar vibração
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100])
      }

      await verificarPermissoes()
      setStatus("✅ Permissões configuradas com sucesso!")
    } catch (error) {
      console.error("Erro ao solicitar permissões:", error)
      setStatus("❌ Erro ao configurar permissões. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  // Ativar/desativar alarme
  const toggleAlarme = async (ativo: boolean) => {
    if (!funcionarioSelecionado) {
      setStatus("⚠️ Selecione um funcionário primeiro!")
      return
    }

    if (ativo && !permissoesOK) {
      setStatus("⚠️ Configure as permissões primeiro!")
      return
    }

    try {
      setAlarmeAtivo(ativo)
      
      // Salvar no localStorage
      localStorage.setItem('alarme_funcionario_id', funcionarioSelecionado)
      localStorage.setItem('alarme_ativo', ativo.toString())
      localStorage.setItem('alarme_configurado_em', new Date().toISOString())

      if (ativo) {
        // Enviar mensagem para o service worker
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && serviceworkerOK) {
          const registration = await navigator.serviceWorker.ready
          if (registration.active) {
            registration.active.postMessage({
              type: 'ATIVAR_MONITORAMENTO',
              funcionarioId: funcionarioSelecionado
            })
          }
        }

        const funcionario = funcionarios.find(f => f.id === funcionarioSelecionado)
        setStatus(`🔔 Alarme ativado para ${funcionario?.nome}!`)
        
        // Mostrar notificação de teste
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('✅ Alarme de Almoço Ativado!', {
            body: `Lembretes ativados para ${funcionario?.nome}`,
            icon: '/icons/icon-192x192.png'
          })
        }
      } else {
        setStatus("🔕 Alarme desativado")
        
        // Desativar monitoramento no service worker
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && serviceworkerOK) {
          const registration = await navigator.serviceWorker.ready
          if (registration.active) {
            registration.active.postMessage({
              type: 'DESATIVAR_MONITORAMENTO'
            })
          }
        }
      }
    } catch (error) {
      console.error("Erro ao configurar alarme:", error)
      setStatus("❌ Erro ao configurar alarme")
    }
  }

  // Teste do alarme
  const testarAlarme = () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('🧪 Teste do Alarme', {
        body: 'Este é um teste do sistema de alarme!',
        icon: '/icons/icon-192x192.png',
        requireInteraction: true
      })
    }
    
    // Vibrar se suportado
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([500, 200, 500])
    }
    
    setStatus("🧪 Teste do alarme executado!")
  }

  const funcionarioAtual = funcionarios.find(f => f.id === funcionarioSelecionado)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader className="bg-primary text-white">
            <div className="flex items-center justify-center gap-3">
              <Image src="/logo.png" alt="Logo" width={120} height={60} />
            </div>
            <CardTitle className="text-center text-2xl">
              🔔 Meu Alarme de Almoço
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center text-gray-600">
              <p>Configure seu alarme pessoal para lembrar do retorno do almoço!</p>
              <p className="text-sm mt-2">⏰ O alarme tocará <strong>52 minutos</strong> após sua saída para almoço</p>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        {status && (
          <Alert className="mb-6">
            <AlertDescription>{status}</AlertDescription>
          </Alert>
        )}

        {/* Seleção do funcionário */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Selecionar Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Quem é você?</Label>
                <select
                  className="w-full mt-1 p-3 border border-gray-300 rounded-lg bg-white"
                  value={funcionarioSelecionado}
                  onChange={(e) => setFuncionarioSelecionado(e.target.value)}
                >
                  <option value="">Selecione seu nome...</option>
                  {funcionarios.map((funcionario) => (
                    <option key={funcionario.id} value={funcionario.id}>
                      {funcionario.nome}
                    </option>
                  ))}
                </select>
              </div>
              
              {funcionarioAtual && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800">
                    ✅ Selecionado: <strong>{funcionarioAtual.nome}</strong>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configuração de permissões */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Configurar Celular
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Permissões do Sistema</p>
                  <p className="text-sm text-gray-600">
                    Notificações, som e tela cheia
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {permissoesOK ? (
                    <span className="text-green-600">✅</span>
                  ) : (
                    <Button
                      onClick={solicitarPermissoes}
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                    >
                      {isLoading ? "⏳" : "🔧"} Configurar
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className={`p-2 rounded ${typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  🔔 Notificações: {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' ? 'OK' : 'Negado'}
                </div>
                <div className={`p-2 rounded ${serviceworkerOK ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  ⚙️ Service Worker: {serviceworkerOK ? 'OK' : 'Pendente'}
                </div>
                <div className={`p-2 rounded ${typeof window !== 'undefined' && 'wakeLock' in navigator ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  📱 Wake Lock: {typeof window !== 'undefined' && 'wakeLock' in navigator ? 'OK' : 'Limitado'}
                </div>
                <div className={`p-2 rounded ${typeof window !== 'undefined' && 'vibrate' in navigator ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  📳 Vibração: {typeof window !== 'undefined' && 'vibrate' in navigator ? 'OK' : 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ativação do alarme */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Ativar Alarme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Lembretes de Almoço</p>
                  <p className="text-sm text-gray-600">
                    Alarme tocará 52 minutos após saída para almoço
                  </p>
                </div>
                <Switch
                  checked={alarmeAtivo}
                  onCheckedChange={toggleAlarme}
                  disabled={!funcionarioSelecionado || !permissoesOK}
                />
              </div>

              {alarmeAtivo && funcionarioAtual && (
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    <span className="font-medium text-primary">
                      Alarme ativo para {funcionarioAtual.nome}
                    </span>
                  </div>
                  <p className="text-sm text-primary/70 mt-1">
                    O sistema está monitorando seus pontos em segundo plano
                  </p>
                </div>
              )}

              {!alarmeAtivo && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <BellOff className="h-5 w-5 text-gray-500" />
                    <span className="font-medium text-gray-600">
                      Alarme desativado
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Teste */}
        {alarmeAtivo && (
          <Card>
            <CardHeader>
              <CardTitle>🧪 Teste do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={testarAlarme}
                variant="outline"
                className="w-full"
              >
                Testar Notificação
              </Button>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Clique para testar se as notificações estão funcionando
              </p>
            </CardContent>
          </Card>
        )}

        {/* Instruções */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>💡 <strong>Dica:</strong> Mantenha esta aba aberta no seu celular</p>
          <p>O alarme funcionará mesmo com o celular em modo silencioso</p>
        </div>
      </div>
    </div>
  )
}