import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado' }, { status: 503 })
    }
    const searchParams = request.nextUrl.searchParams
    const funcionarioId = searchParams.get('funcionarioId')
    
    if (!funcionarioId) {
      return NextResponse.json({ error: 'funcionarioId é obrigatório' }, { status: 400 })
    }

    console.log(`🔍 [API] Verificando pontos para funcionário: ${funcionarioId}`)

    // Buscar dados do funcionário
    const { data: funcionario, error: funcionarioError } = await supabase
      .from('funcionarios')
      .select('nome')
      .eq('id', funcionarioId)
      .single()

    if (funcionarioError) {
      console.error('❌ Erro ao buscar funcionário:', funcionarioError)
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    // Buscar último ponto do funcionário hoje
    const hoje = new Date()
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    const fimDia = new Date(inicioDia)
    fimDia.setDate(fimDia.getDate() + 1)

    const { data: pontos, error: pontosError } = await supabase
      .from('registros_ponto')
      .select('*')
      .eq('funcionario_id', funcionarioId)
      .gte('created_at', inicioDia.toISOString())
      .lt('created_at', fimDia.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (pontosError) {
      console.error('❌ Erro ao buscar pontos:', pontosError)
      return NextResponse.json({ error: 'Erro ao buscar pontos' }, { status: 500 })
    }

    // Se não há pontos hoje, não disparar alarme
    if (!pontos || pontos.length === 0) {
      console.log('ℹ️ Nenhum ponto encontrado hoje')
      return NextResponse.json({ 
        deveDispararAlarme: false,
        motivo: 'Nenhum ponto registrado hoje'
      })
    }

    const ultimoPonto = pontos[0]
    console.log(`📋 Último ponto: ${ultimoPonto.tipo} às ${new Date(ultimoPonto.created_at).toLocaleTimeString()}`)

    // Verificar se o último ponto é saída para almoço
    const tiposSaidaAlmoco = ['saida_almoco', 'saída para almoço', 'saída_almoco']
    const isSaidaAlmoco = tiposSaidaAlmoco.some(tipo => 
      ultimoPonto.tipo?.toLowerCase().includes(tipo.toLowerCase())
    )

    if (!isSaidaAlmoco) {
      console.log('ℹ️ Último ponto não é saída para almoço')
      return NextResponse.json({ 
        deveDispararAlarme: false,
        motivo: `Último ponto é: ${ultimoPonto.tipo}`
      })
    }

    // Calcular tempo desde a saída para almoço
    const agora = new Date()
    const horaSaidaAlmoco = new Date(ultimoPonto.created_at)
    const diferencaMinutos = Math.floor((agora.getTime() - horaSaidaAlmoco.getTime()) / (1000 * 60))

    console.log(`⏱️ Saída para almoço há ${diferencaMinutos} minutos`)

    // Verificar se deve disparar alarme (52 minutos)
    const MINUTOS_PARA_ALARME = 52
    const deveDispararAlarme = diferencaMinutos >= MINUTOS_PARA_ALARME

    // Calcular horário de retorno sugerido
    const horarioRetorno = new Date(horaSaidaAlmoco.getTime() + (MINUTOS_PARA_ALARME * 60 * 1000))
    
    const response = {
      deveDispararAlarme,
      funcionarioNome: funcionario.nome,
      ultimoPonto: {
        tipo: ultimoPonto.tipo,
        horario: new Date(ultimoPonto.created_at).toLocaleTimeString()
      },
      minutosDesdeAlmoco: diferencaMinutos,
      horarioRetorno: horarioRetorno.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      motivo: deveDispararAlarme 
        ? `Saída para almoço há ${diferencaMinutos} minutos (>= ${MINUTOS_PARA_ALARME})`
        : `Saída para almoço há ${diferencaMinutos} minutos (< ${MINUTOS_PARA_ALARME})`
    }

    console.log(`🎯 Resposta da API:`, response)
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Erro geral na API:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}