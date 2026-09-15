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
  const [, setIsLoading] = useState(true)
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
      <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
        <DashboardHeader onLogout={handleLogout} />
        <div className="container mx-auto p-6 flex-1 flex items-center justify-center">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 mx-auto rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-[#c69e6b]">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Nenhum funcionário cadastrado</h2>
            <p className="text-xs text-slate-600">
              Cadastre seus colaboradores para gerenciar jornadas, bater ponto com IA e emitir relatórios.
            </p>
            <Link
              href="/cadastrar"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-gradient-to-r from-[#c69e6b] to-[#b38850] text-white font-bold text-xs shadow-sm hover:brightness-105 transition-all"
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
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 select-none">
      {/* 1. HEADER MODO LIGHT */}
      <DashboardHeader onLogout={handleLogout} />

      {/* 2. CONTEÚDO PRINCIPAL DO PAINEL */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 max-w-7xl flex-1">
        {/* CARD PRINCIPAL DO COLABORADOR COM SELETOR E AJUSTE DE HORÁRIOS */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            {/* Seletor do Colaborador */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-md bg-[#c69e6b] flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                {funcionarioSelecionado?.nome?.charAt(0) || "U"}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm bg-amber-50 text-[#a67c4e] border border-amber-200">
                    Colaborador Ativo
                  </span>
                  <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    Ativo
                  </span>
                </div>

                <div className="relative">
                  <select
                    value={funcionarioId}
                    onChange={(e) => handleChangeFuncionario(e.target.value)}
                    className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-md px-3.5 py-1.5 pr-8 text-base font-bold text-slate-900 outline-none focus:border-[#c69e6b] cursor-pointer transition-all"
                  >
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id} className="text-slate-900 font-medium">
                        {f.nome}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Resumo da Jornada Atual e Botão de Ajustar Horários */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Badge de Horários Vigentes */}
              <div className="bg-slate-50 border border-slate-200 rounded-md px-3.5 py-1.5 text-xs space-y-0.5">
                <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-[#c69e6b]" />
                  <span>Jornada Cadastrada</span>
                </div>
                <div className="font-mono font-bold text-slate-800 text-xs">
                  {horariosAtuais.entrada} – {horariosAtuais.saida}
                  <span className="text-slate-500 ml-1.5 font-normal">
                    ({trabalhaSabado ? "Sáb: Ativo" : "Sáb: Folga"})
                  </span>
                </div>
              </div>

              {/* Botão de Ajustar Horários */}
              <button
                type="button"
                onClick={() => setModalHorariosAberto(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer hover:border-slate-400"
              >
                <Settings2 className="w-4 h-4 text-[#c69e6b]" />
                <span>Mudar Horários da Jornada</span>
              </button>

              {/* Botão de Showcase */}
              <Link
                href="/dashboard/showcase"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-white text-xs font-bold shadow-sm transition-all active:scale-95 hover:brightness-105"
                style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
              >
                <Sparkles className="w-4 h-4" />
                <span>Showcase IA</span>
              </Link>
            </div>
          </div>

          {/* KPIS / RESUMO RÁPIDO DO MÊS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#c69e6b]" />
                Dias Trabalhados
              </span>
              <p className="text-xl font-bold font-mono text-slate-900">
                {diasComRegistro} <span className="text-xs text-slate-500 font-normal">dias</span>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Total de Batidas
              </span>
              <p className="text-xl font-bold font-mono text-emerald-700">
                {totalRegistrosMes} <span className="text-xs text-slate-500 font-normal">registros</span>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-600" />
                Almoço Padrão
              </span>
              <p className="text-base font-bold font-mono text-cyan-800">
                {horariosAtuais.saida_almoco} – {horariosAtuais.retorno_almoco}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                Saudação Inteligente
              </span>
              <p className="text-xs font-bold text-slate-800 truncate">
                Groq IA Llama 3.3 70B
              </p>
            </div>
          </div>
        </section>

        {/* 3. VISUALIZADORES DE PONTO (CALENDÁRIO & SEMANA) */}
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col w-full">
            {/* Barra de Abas */}
            <div className="border-b border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#c69e6b]" />
                <h3 className="text-base font-bold text-slate-900">Espelho de Ponto & Registros</h3>
              </div>

              <TabsList className="grid grid-cols-2 w-full sm:w-64 bg-slate-100 border border-slate-200 p-1 rounded-md">
                <TabsTrigger
                  value="calendario"
                  className="flex items-center gap-1.5 text-xs font-bold py-1.5 rounded-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-600 transition-all cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendário</span>
                </TabsTrigger>
                <TabsTrigger
                  value="semana"
                  className="flex items-center gap-1.5 text-xs font-bold py-1.5 rounded-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-600 transition-all cursor-pointer"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
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

      {/* 4. MODAL DE AJUSTE DE HORÁRIOS DA JORNADA */}
      <ModalEditarHorarios
        funcionario={funcionarioSelecionado}
        aberto={modalHorariosAberto}
        onFechar={() => setModalHorariosAberto(false)}
        onSalvo={handleHorariosSalvos}
      />
    </div>
  )
}
