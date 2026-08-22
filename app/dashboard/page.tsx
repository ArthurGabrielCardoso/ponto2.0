"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { startOfMonth, endOfMonth, subMonths } from "date-fns"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CalendarioDetalhado } from "@/components/calendario-detalhado"
import { CalendarioSemanal } from "@/components/calendario-semanal"
import { DashboardHeader } from "@/components/dashboard-header"
import { ModalEditarHorarios } from "@/components/modal-editar-horarios"
import { AnimacaoVozIa } from "@/components/animacao-voz-ia"
import { buscarFuncionarios, buscarRegistrosPorPeriodo } from "@/lib/supabase"
import type { Funcionario, RegistroPonto, ResumoHoras, HorariosSemana } from "@/lib/types"
import {
  Calendar,
  CalendarCheck,
  Users,
  Clock,
  Settings2,
  Sparkles,
  ChevronDown,
  UserCheck,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  UserPlus,
} from "lucide-react"

export default function Dashboard() {
  const router = useRouter()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [funcionarioId, setFuncionarioId] = useState<string>("")
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<Funcionario | null>(null)
  const [registros, setRegistros] = useState<RegistroPonto[]>([])
  const [mesAtual] = useState(new Date())
  const [, setDiaSelecionado] = useState<ResumoHoras | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("calendario")
  const [semFuncionarios, setSemFuncionarios] = useState(false)
  const [modalHorariosAberto, setModalHorariosAberto] = useState(false)

  // Carregar funcionários ao montar o componente
  useEffect(() => {
    const carregarFuncionarios = async () => {
      try {
        setIsLoading(true)
        const dados = await buscarFuncionarios()

        if (!dados || dados.length === 0) {
          setSemFuncionarios(true)
          setIsLoading(false)
          return
        }

        setFuncionarios(dados)
        setFuncionarioId(dados[0].id)
        setFuncionarioSelecionado(dados[0])
        setSemFuncionarios(false)
      } catch (error) {
        console.error("Erro ao carregar funcionários:", error)
        setSemFuncionarios(true)
      } finally {
        setIsLoading(false)
      }
    }

    carregarFuncionarios()
  }, [])

  // Carregar registros quando o funcionário ou período mudar
  useEffect(() => {
    const carregarRegistros = async () => {
      if (!funcionarioId) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const inicio = startOfMonth(subMonths(mesAtual, 1))
        const fim = endOfMonth(mesAtual)

        const dados = await buscarRegistrosPorPeriodo(inicio.toISOString(), fim.toISOString(), funcionarioId)
        setRegistros(dados || [])
      } catch {
        setRegistros([])
      } finally {
        setIsLoading(false)
      }
    }

    carregarRegistros()
  }, [mesAtual, funcionarioId])

  // Mudar funcionário selecionado
  const handleChangeFuncionario = (id: string) => {
    setFuncionarioId(id)
    const func = funcionarios.find((f) => f.id === id) || null
    setFuncionarioSelecionado(func)
  }

  // Atualizar horários salvos no state local
  const handleHorariosSalvos = (novosHorarios: HorariosSemana) => {
    if (!funcionarioSelecionado) return

    const atualizado: Funcionario = {
      ...funcionarioSelecionado,
      horarios: novosHorarios,
    }

    setFuncionarioSelecionado(atualizado)
    setFuncionarios((prev) =>
      prev.map((f) => (f.id === atualizado.id ? atualizado : f))
    )
  }

  const handleSelectDay = (data: string, resumo: ResumoHoras) => {
    setDiaSelecionado(resumo)
  }

  const handleLogout = () => {
    localStorage.removeItem("authenticated")
    document.cookie = "authenticated=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
  }

  // Estatísticas rápidas do mês
  const totalRegistrosMes = registros.length
  const diasComRegistro = new Set(registros.map((r) => new Date(r.data_hora).toDateString())).size

  const horariosAtuais = funcionarioSelecionado?.horarios?.segunda || {
    entrada: "08:00",
    saida_almoco: "12:00",
    retorno_almoco: "13:00",
    saida: "18:00",
    ativo: true,
  }
  const trabalhaSabado = !!funcionarioSelecionado?.horarios?.sabado?.ativo

  if (semFuncionarios) {
    return (
      <div className="flex min-h-screen flex-col bg-[#050811] text-white">
        <DashboardHeader onLogout={handleLogout} />
        <div className="container mx-auto p-6 flex-1 flex items-center justify-center">
          <div className="max-w-md w-full bg-slate-900/80 border border-white/15 rounded-3xl p-8 text-center space-y-4 shadow-2xl backdrop-blur-xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white">Nenhum funcionário cadastrado</h2>
            <p className="text-xs text-white/70">
              Cadastre seus colaboradores para gerenciar jornadas, bater ponto com IA e emitir relatórios.
            </p>
            <Link
              href="/cadastrar"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#c69e6b] to-amber-500 text-slate-950 font-bold text-xs shadow-lg hover:brightness-110 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Cadastrar Primeiro Funcionário
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#050811] text-white select-none relative overflow-x-hidden">
      {/* 1. LUZES AMBIENTES DIFUSAS NO FUNDO */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 right-10 w-[600px] h-[600px] rounded-full bg-[#c69e6b] blur-[170px] opacity-25" />
        <div className="absolute top-1/2 -left-20 w-[500px] h-[500px] rounded-full bg-[#14b8a6] blur-[160px] opacity-20" />
      </div>

      {/* 2. HEADER NOBRE */}
      <DashboardHeader onLogout={handleLogout} />

      {/* 3. CONTEÚDO PRINCIPAL DO PAINEL */}
      <main className="relative z-10 container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 max-w-7xl flex-1">
        {/* CARD PRINCIPAL DO COLABORADOR COM SELETOR E AJUSTE DE HORÁRIOS */}
        <section className="backdrop-blur-2xl bg-slate-900/60 border border-white/15 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-white/10 pb-5">
            {/* Seletor do Colaborador */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#c69e6b] to-amber-600 p-[2px] shadow-[0_0_20px_rgba(198,158,107,0.4)] shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-200 font-bold text-xl">
                  {funcionarioSelecionado?.nome?.charAt(0) || "U"}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    Colaborador Ativo
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Ativo
                  </span>
                </div>

                <div className="relative">
                  <select
                    value={funcionarioId}
                    onChange={(e) => handleChangeFuncionario(e.target.value)}
                    className="appearance-none bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl px-4 py-2 pr-10 text-base sm:text-lg font-bold text-white outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer transition-all"
                  >
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id} className="bg-slate-900 text-white font-medium">
                        {f.nome}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/70 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Resumo da Jornada Atual e Botão de Ajustar Horários */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Badge de Horários Vigentes */}
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-xs space-y-0.5">
                <div className="flex items-center gap-1.5 text-white/60 font-semibold text-[10px] uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  <span>Jornada Cadastrada</span>
                </div>
                <div className="font-mono font-bold text-amber-200 text-xs">
                  {horariosAtuais.entrada} – {horariosAtuais.saida}
                  <span className="text-white/40 ml-1.5">
                    ({trabalhaSabado ? "Sáb: Ativo" : "Sáb: Folga"})
                  </span>
                </div>
              </div>

              {/* Botão de Ajustar Horários */}
              <button
                type="button"
                onClick={() => setModalHorariosAberto(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer hover:border-amber-400/50"
              >
                <Settings2 className="w-4 h-4 text-amber-300" />
                <span>Mudar Horários da Jornada</span>
              </button>

              {/* Botão de Showcase */}
              <Link
                href="/dashboard/showcase"
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-slate-950 text-xs font-extrabold shadow-[0_0_15px_rgba(198,158,107,0.4)] transition-all active:scale-95 hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #c69e6b 0%, #d4af37 100%)" }}
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span>Showcase IA</span>
              </Link>
            </div>
          </div>

          {/* KPIS / RESUMO RÁPIDO DO MÊS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-300" />
                Dias Trabalhados
              </span>
              <p className="text-xl sm:text-2xl font-bold font-mono text-white">
                {diasComRegistro} <span className="text-xs text-white/50 font-normal">dias</span>
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                Total de Batidas
              </span>
              <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-300">
                {totalRegistrosMes} <span className="text-xs text-white/50 font-normal">registros</span>
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-300" />
                Almoço Padrão
              </span>
              <p className="text-base sm:text-lg font-bold font-mono text-cyan-200">
                {horariosAtuais.saida_almoco} – {horariosAtuais.retorno_almoco}
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-purple-300" />
                Saudação Inteligente
              </span>
              <p className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                Groq IA Llama 3.3 70B
              </p>
            </div>
          </div>
        </section>

        {/* 4. VISUALIZADORES DE PONTO (CALENDÁRIO & SEMANA) */}
        <section className="backdrop-blur-2xl bg-slate-900/60 border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col w-full">
            {/* Barra de Abas */}
            <div className="border-b border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-bold text-white">Espelho de Ponto & Registros</h3>
              </div>

              <TabsList className="grid grid-cols-2 w-full sm:w-72 bg-slate-950/80 border border-white/15 p-1 rounded-2xl">
                <TabsTrigger
                  value="calendario"
                  className="flex items-center gap-2 text-xs font-bold py-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#c69e6b] data-[state=active]:to-amber-500 data-[state=active]:text-slate-950 text-white/70 transition-all cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Calendário</span>
                </TabsTrigger>
                <TabsTrigger
                  value="semana"
                  className="flex items-center gap-2 text-xs font-bold py-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#c69e6b] data-[state=active]:to-amber-500 data-[state=active]:text-slate-950 text-white/70 transition-all cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>Visão Semanal</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Conteúdo das Abas */}
            <div className="p-4 sm:p-6">
              <TabsContent value="calendario" className="m-0 focus-visible:outline-none">
                <CalendarioDetalhado
                  registros={registros}
                  onSelectDay={handleSelectDay}
                  funcionarioNome={funcionarioSelecionado?.nome || ""}
                  funcionarioId={funcionarioId}
                />
              </TabsContent>

              <TabsContent value="semana" className="m-0 focus-visible:outline-none">
                <CalendarioSemanal
                  registros={registros}
                  onSelectDay={handleSelectDay}
                  funcionarioNome={funcionarioSelecionado?.nome || ""}
                  funcionarioId={funcionarioId}
                />
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </main>

      {/* 5. MODAL DE AJUSTE DE HORÁRIOS DA JORNADA */}
      <ModalEditarHorarios
        funcionario={funcionarioSelecionado}
        aberto={modalHorariosAberto}
        onFechar={() => setModalHorariosAberto(false)}
        onSalvo={handleHorariosSalvos}
      />

      {/* 6. ONDA LUMINOSA AZUL FLUIDA NA BORDA BOTTOM ENQUANTO A VOZ FALA */}
      <AnimacaoVozIa />
    </div>
  )
}
