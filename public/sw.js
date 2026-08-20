// Service Worker para monitoramento de pontos e alarmes
console.log('🔧 Service Worker carregado')

const CACHE_NAME = 'ponto-models-v1'
const MODEL_FILES = [
  '/models/tiny_face_detector_model-weights_manifest.json',
  '/models/tiny_face_detector_model-shard1',
  '/models/face_landmark_68_model-weights_manifest.json',
  '/models/face_landmark_68_model-shard1',
  '/models/face_recognition_model-weights_manifest.json',
  '/models/face_recognition_model-shard1',
  '/models/face_recognition_model-shard2',
  '/models/face_expression_model-weights_manifest.json',
  '/models/face_expression_model-shard1',
]

let monitoramentoAtivo = false
let funcionarioId = null
let intervalId = null

// Instalar service worker — pré-cacheia modelos
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker instalado')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Cacheando modelos face-api...')
      return cache.addAll(MODEL_FILES)
    }).then(() => {
      console.log('✅ Modelos cacheados!')
      return self.skipWaiting()
    }).catch((err) => {
      console.warn('⚠️ Erro ao cachear modelos:', err)
      return self.skipWaiting()
    })
  )
})

// Ativar service worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker ativado')
  event.waitUntil(self.clients.claim())
})

// Escutar mensagens da página principal
self.addEventListener('message', (event) => {
  console.log('📨 Mensagem recebida:', event.data)
  
  const { type, funcionarioId: novoFuncionarioId } = event.data
  
  if (type === 'ATIVAR_MONITORAMENTO') {
    funcionarioId = novoFuncionarioId
    iniciarMonitoramento()
  } else if (type === 'DESATIVAR_MONITORAMENTO') {
    pararMonitoramento()
  }
})

// Iniciar monitoramento de pontos
function iniciarMonitoramento() {
  if (monitoramentoAtivo) {
    pararMonitoramento()
  }
  
  monitoramentoAtivo = true
  console.log(`🔍 Iniciando monitoramento para funcionário: ${funcionarioId}`)
  
  // Verificar pontos a cada 30 segundos
  intervalId = setInterval(async () => {
    try {
      await verificarPontosRecentes()
    } catch (error) {
      console.error('❌ Erro no monitoramento:', error)
    }
  }, 30000) // 30 segundos
  
  // Primeira verificação imediata
  setTimeout(verificarPontosRecentes, 1000)
}

// Parar monitoramento
function pararMonitoramento() {
  monitoramentoAtivo = false
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  console.log('🔴 Monitoramento parado')
}

// Verificar pontos recentes do funcionário
async function verificarPontosRecentes() {
  if (!funcionarioId || !monitoramentoAtivo) {
    return
  }
  
  try {
    console.log(`🔍 Verificando pontos para: ${funcionarioId}`)
    
    // Buscar último ponto do funcionário
    const response = await fetch(`${self.location.origin}/api/verificar-ponto?funcionarioId=${funcionarioId}`)
    
    if (!response.ok) {
      console.warn('⚠️ Erro na API de verificação:', response.status)
      return
    }
    
    const data = await response.json()
    
    if (data.deveDispararAlarme) {
      console.log('🚨 Disparando alarme!')
      await dispararAlarme(data.horarioRetorno, data.funcionarioNome)
    } else {
      console.log('✅ Nenhum alarme necessário')
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar pontos:', error)
  }
}

// Disparar alarme full-screen
async function dispararAlarme(horarioRetorno, funcionarioNome) {
  try {
    // 1. Mostrar notificação
    await self.registration.showNotification('🚨 HORA DE VOLTAR!', {
      body: `${funcionarioNome}, retorne às ${horarioRetorno}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-96x96.png',
      requireInteraction: true,
      persistent: true,
      vibrate: [1000, 500, 1000, 500, 1000],
      actions: [
        {
          action: 'abrir',
          title: '📱 Abrir Alarme',
          icon: '/icons/action-open.png'
        },
        {
          action: 'soneca',
          title: '⏰ Soneca 5min',
          icon: '/icons/action-snooze.png'
        }
      ],
      data: {
        type: 'alarme-almoco',
        funcionarioId: funcionarioId,
        horarioRetorno: horarioRetorno,
        funcionarioNome: funcionarioNome,
        timestamp: Date.now()
      }
    })
    
    // 2. Tentar abrir página de alarme em todas as abas abertas
    const clients = await self.clients.matchAll({ type: 'window' })
    
    let alarmeAberto = false
    for (const client of clients) {
      if (client.url.includes('/meu-alarme')) {
        // Enviar comando para mostrar alarme full-screen
        client.postMessage({
          type: 'MOSTRAR_ALARME_FULLSCREEN',
          horarioRetorno: horarioRetorno,
          funcionarioNome: funcionarioNome
        })
        
        // Focar na aba
        if (client.focus) {
          await client.focus()
        }
        alarmeAberto = true
        break
      }
    }
    
    // 3. Se não houver aba aberta, abrir nova
    if (!alarmeAberto) {
      await self.clients.openWindow(`${self.location.origin}/meu-alarme/alarme-ativo?horario=${encodeURIComponent(horarioRetorno)}&nome=${encodeURIComponent(funcionarioNome)}`)
    }
    
    // 4. Parar o monitoramento (alarme disparou)
    pararMonitoramento()
    
    console.log('🎯 Alarme disparado com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro ao disparar alarme:', error)
  }
}

// Lidar com cliques na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notificação clicada:', event.action)
  
  event.notification.close()
  
  const { type, horarioRetorno, funcionarioNome } = event.notification.data || {}
  
  if (type === 'alarme-almoco') {
    if (event.action === 'abrir') {
      // Abrir página de alarme
      event.waitUntil(
        self.clients.openWindow(`${self.location.origin}/meu-alarme/alarme-ativo?horario=${encodeURIComponent(horarioRetorno)}&nome=${encodeURIComponent(funcionarioNome)}`)
      )
    } else if (event.action === 'soneca') {
      // Soneca de 5 minutos
      console.log('😴 Soneca ativada - 5 minutos')
      setTimeout(() => {
        dispararAlarme(horarioRetorno, funcionarioNome)
      }, 5 * 60 * 1000) // 5 minutos
    } else {
      // Clique padrão - abrir alarme
      event.waitUntil(
        self.clients.openWindow(`${self.location.origin}/meu-alarme/alarme-ativo?horario=${encodeURIComponent(horarioRetorno)}&nome=${encodeURIComponent(funcionarioNome)}`)
      )
    }
  }
})

// Lidar com fechamento da notificação
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notificação fechada')
})

// Sincronização em background (para PWAs)
self.addEventListener('sync', (event) => {
  if (event.tag === 'verificar-pontos') {
    console.log('🔄 Sincronização de pontos')
    event.waitUntil(verificarPontosRecentes())
  }
})

// Interceptar requests — servir modelos do cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Modelos: cache-first (nunca mudam)
  if (url.pathname.startsWith('/models/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
      })
    )
    return
  }
})