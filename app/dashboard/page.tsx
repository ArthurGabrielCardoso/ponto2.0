"use client"

import { Button } from "@/components/ui/button"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { startOfMonth, endOfMonth, subMonths } from "date-fns"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CalendarioDetalhado } from "@/components/calendario-detalhado"
import { Calendar, CalendarCheck, Users } from "lucide-react"
import { buscarFuncionarios, buscarRegistrosPorPeriodo } from "@/lib/supabase"
import type { Funcionario, RegistroPonto, ResumoHoras } from "@/lib/types"
import { DashboardHeader } from "@/components/dashboard-header"
import { CalendarioSemanal } from "@/components/calendario-semanal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function Dashboard() {
  const router = useRouter()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [funcionarioId, setFuncionarioId] = useState<string>("")
  const [funcionarioNome, setFuncionarioNome] = useState<string>("")
  const [registros, setRegistros] = useState<RegistroPonto[]>([])
  const [mesAtual] = useState(new Date())
  const [, setDiaSelecionado] = useState<ResumoHoras | null>(null)
  const [, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("calendario")
  const [semFuncionarios, setSemFuncionarios] = useState(false)

  // Carregar funcionários ao montar o componente
  useEffect(() => {
    const carregarFuncionarios = async () => {
      try {
        setIsLoading(true)
        const dados = await buscarFuncionarios()
        console.log("Funcionários carregados:", dados)

        if (dados.length === 0) {
          setSemFuncionarios(true)
          setIsLoading(false)
          return
        }

        setFuncionarios(dados)
        setFuncionarioId(dados[0].id)
        setFuncionarioNome(dados[0].nome)
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

  // Carregar registros quando o mês, funcionário ou carga horária mudar
  useEffect(() => {
    const carregarRegistros = async () => {
      if (!funcionarioId) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        // Ampliar janela para incluir mês atual e anterior
        const inicio = startOfMonth(subMonths(mesAtual, 1))
        const fim = endOfMonth(mesAtual)

        // Buscar registros do banco de dados (mês atual + anterior)
        const dados = await buscarRegistrosPorPeriodo(inicio.toISOString(), fim.toISOString(), funcionarioId)
        console.log(`Registros carregados para ${funcionarioNome}:`, dados)

        setRegistros(dados)
      } catch {
        setRegistros([])
      } finally {
        setIsLoading(false)
      }
    }

    carregarRegistros()
  }, [mesAtual, funcionarioId, funcionarioNome])

  // Quando um dia é selecionado no calendário
  const handleSelectDay = (data: string, resumo: ResumoHoras) => {
    setDiaSelecionado(resumo)
  }

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("authenticated")
    document.cookie = "authenticated=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
  }

  // Mudar funcionário selecionado
  const handleChangeFuncionario = (id: string) => {
    setFuncionarioId(id)
    const funcionario = funcionarios.find((f) => f.id === id)
    if (funcionario) {
      setFuncionarioNome(funcionario.nome)
    }
  }

  if (semFuncionarios) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <DashboardHeader onLogout={handleLogout} />
        <div className="container mx-auto p-6 flex items-center justify-center">
          <Alert className="max-w-lg bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-800">Nenhum funcionário cadastrado</AlertTitle>
            <AlertDescription className="text-amber-700">
              Você precisa cadastrar funcionários antes de visualizar o dashboard.
              <div className="mt-4">
                <Button onClick={() => router.push("/cadastrar")} className="bg-primary hover:bg-primary/90 text-white">
                  Cadastrar Funcionário
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header do Dashboard */}
      <DashboardHeader onLogout={handleLogout} />

      {/* Conteúdo principal */}
      <div className="container mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          {/* Header com dropdown e tabs */}
          <div className="bg-white rounded-t-xl shadow-md p-4 mb-0 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Users className="h-5 w-5 text-primary" />
              <Select value={funcionarioId} onValueChange={handleChangeFuncionario}>
                <SelectTrigger className="w-[220px] border-primary/20 focus:ring-primary">
                  <SelectValue placeholder="Selecione um funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.map((funcionario) => (
                    <SelectItem key={funcionario.id} value={funcionario.id}>
                      {funcionario.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TabsList className="grid grid-cols-2 w-full md:w-[300px]">
              <TabsTrigger value="calendario" className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Calendário
              </TabsTrigger>
              <TabsTrigger value="semana" className="flex items-center">
                <CalendarCheck className="h-5 w-5 mr-2" />
                Semana
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Conteúdo das tabs */}
          <div className="rounded-b-xl overflow-hidden shadow-lg">
            <TabsContent value="calendario" className="m-0">
              <CalendarioDetalhado
                registros={registros}
                onSelectDay={handleSelectDay}
                funcionarioNome={funcionarioNome}
                funcionarioId={funcionarioId}
              />
            </TabsContent>

            <TabsContent value="semana" className="m-0">
              <CalendarioSemanal
                registros={registros}
                onSelectDay={handleSelectDay}
                funcionarioNome={funcionarioNome}
                funcionarioId={funcionarioId}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

// (simulação removida)
