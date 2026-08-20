"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarFuncionarios, buscarFuncionarioPorId } from "@/lib/supabase"
import { DashboardHeader } from "@/components/dashboard-header"
import { Clock, AlertCircle, CheckCircle } from "lucide-react"
import type { Funcionario } from "@/lib/types"
import { minutosParaHoras } from "@/lib/utils-ponto"

export default function VerificarHorarios() {
  const router = useRouter()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [funcionarioId, setFuncionarioId] = useState<string>("")
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<Funcionario | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Carregar funcionários ao montar o componente
  useEffect(() => {
    const carregarFuncionarios = async () => {
      try {
        const dados = await buscarFuncionarios()
        console.log("Funcionários carregados:", dados)

        if (dados.length === 0) {
          setError("Nenhum funcionário cadastrado.")
          setIsLoading(false)
          return
        }

        setFuncionarios(dados)
        setIsLoading(false)
      } catch (error) {
        console.error("Erro ao carregar funcionários:", error)
        setError("Erro ao carregar funcionários.")
        setIsLoading(false)
      }
    }

    carregarFuncionarios()
  }, [])

  // Carregar detalhes do funcionário quando selecionado
  useEffect(() => {
    const carregarFuncionario = async () => {
      if (!funcionarioId) return

      setIsLoading(true)
      setError(null)
      setSuccess(null)

      try {
        const funcionario = await buscarFuncionarioPorId(funcionarioId)
        console.log("Detalhes do funcionário:", funcionario)
        setFuncionarioSelecionado(funcionario)
      } catch (error) {
        console.error("Erro ao carregar detalhes do funcionário:", error)
        setError("Erro ao carregar detalhes do funcionário.")
        setFuncionarioSelecionado(null)
      } finally {
        setIsLoading(false)
      }
    }

    carregarFuncionario()
  }, [funcionarioId])

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("authenticated")
    document.cookie = "authenticated=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
  }

  // Formatar horário para exibição
  const formatarHorario = (horario: string | undefined) => {
    return horario || "--:--"
  }

  // Calcular carga horária de um dia
  const calcularCargaHorariaDia = (entrada: string, saidaAlmoco: string, retornoAlmoco: string, saida: string) => {
    try {
      // Converter horários para minutos desde meia-noite
      const [horaEntrada, minEntrada] = entrada.split(":").map(Number)
      const [horaSaidaAlmoco, minSaidaAlmoco] = saidaAlmoco.split(":").map(Number)
      const [horaRetornoAlmoco, minRetornoAlmoco] = retornoAlmoco.split(":").map(Number)
      const [horaSaida, minSaida] = saida.split(":").map(Number)

      const entradaMinutos = horaEntrada * 60 + minEntrada
      const saidaAlmocoMinutos = horaSaidaAlmoco * 60 + minSaidaAlmoco
      const retornoAlmocoMinutos = horaRetornoAlmoco * 60 + minRetornoAlmoco
      const saidaMinutos = horaSaida * 60 + minSaida

      // Calcular tempo total usando a fórmula: (Saída - Entrada) - (Tempo de Almoço)
      const tempoTotal = saidaMinutos - entradaMinutos - (retornoAlmocoMinutos - saidaAlmocoMinutos)

      return tempoTotal
    } catch (error) {
      console.error("Erro ao calcular carga horária:", error)
      return 0
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <DashboardHeader onLogout={handleLogout} />

      {/* Conteúdo principal */}
      <div className="container mx-auto p-6">
        <Card className="w-full shadow-lg">
          <CardHeader className="bg-primary text-white p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6" />
              <CardTitle className="text-2xl">Verificar Horários de Funcionários</CardTitle>
            </div>
            <CardDescription className="text-white/80">
              Verifique se os horários e carga horária estão configurados corretamente
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {error && (
              <Alert className="mb-6 bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertTitle className="text-red-800">Erro</AlertTitle>
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-6 bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-800">Sucesso</AlertTitle>
                <AlertDescription className="text-green-700">{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Select value={funcionarioId} onValueChange={setFuncionarioId}>
                  <SelectTrigger className="w-[300px]">
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

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p>Carregando dados...</p>
                  </div>
                </div>
              ) : funcionarioSelecionado ? (
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h2 className="text-xl font-semibold mb-2">{funcionarioSelecionado.nome}</h2>
                    <p className="text-gray-600">
                      <span className="font-medium">Carga Horária Diária:</span>{" "}
                      {funcionarioSelecionado.carga_horaria_diaria_minutos
                        ? `${minutosParaHoras(funcionarioSelecionado.carga_horaria_diaria_minutos)} (${
                            funcionarioSelecionado.carga_horaria_diaria_minutos
                          } minutos)`
                        : "Não configurada"}
                    </p>
                  </div>

                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-100">
                        <TableRow>
                          <TableHead className="font-semibold">Dia da Semana</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Entrada</TableHead>
                          <TableHead className="font-semibold">Saída Almoço</TableHead>
                          <TableHead className="font-semibold">Retorno Almoço</TableHead>
                          <TableHead className="font-semibold">Saída</TableHead>
                          <TableHead className="font-semibold">Carga Horária</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {funcionarioSelecionado.horarios ? (
                          <>
                            <TableRow>
                              <TableCell className="font-medium">Segunda-feira</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.segunda?.ativo ? (
                                  <span className="text-green-600">Ativo</span>
                                ) : (
                                  <span className="text-gray-400">Inativo</span>
                                )}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.segunda?.entrada)}</TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.segunda?.saida_almoco)}
                              </TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.segunda?.retorno_almoco)}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.segunda?.saida)}</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.segunda?.ativo
                                  ? minutosParaHoras(
                                      calcularCargaHorariaDia(
                                        funcionarioSelecionado.horarios.segunda.entrada,
                                        funcionarioSelecionado.horarios.segunda.saida_almoco,
                                        funcionarioSelecionado.horarios.segunda.retorno_almoco,
                                        funcionarioSelecionado.horarios.segunda.saida,
                                      ),
                                    )
                                  : "--:--"}
                              </TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell className="font-medium">Terça-feira</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.terca?.ativo ? (
                                  <span className="text-green-600">Ativo</span>
                                ) : (
                                  <span className="text-gray-400">Inativo</span>
                                )}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.terca?.entrada)}</TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.terca?.saida_almoco)}
                              </TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.terca?.retorno_almoco)}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.terca?.saida)}</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.terca?.ativo
                                  ? minutosParaHoras(
                                      calcularCargaHorariaDia(
                                        funcionarioSelecionado.horarios.terca.entrada,
                                        funcionarioSelecionado.horarios.terca.saida_almoco,
                                        funcionarioSelecionado.horarios.terca.retorno_almoco,
                                        funcionarioSelecionado.horarios.terca.saida,
                                      ),
                                    )
                                  : "--:--"}
                              </TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell className="font-medium">Quarta-feira</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.quarta?.ativo ? (
                                  <span className="text-green-600">Ativo</span>
                                ) : (
                                  <span className="text-gray-400">Inativo</span>
                                )}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.quarta?.entrada)}</TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.quarta?.saida_almoco)}
                              </TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.quarta?.retorno_almoco)}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.quarta?.saida)}</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.quarta?.ativo
                                  ? minutosParaHoras(
                                      calcularCargaHorariaDia(
                                        funcionarioSelecionado.horarios.quarta.entrada,
                                        funcionarioSelecionado.horarios.quarta.saida_almoco,
                                        funcionarioSelecionado.horarios.quarta.retorno_almoco,
                                        funcionarioSelecionado.horarios.quarta.saida,
                                      ),
                                    )
                                  : "--:--"}
                              </TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell className="font-medium">Quinta-feira</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.quinta?.ativo ? (
                                  <span className="text-green-600">Ativo</span>
                                ) : (
                                  <span className="text-gray-400">Inativo</span>
                                )}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.quinta?.entrada)}</TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.quinta?.saida_almoco)}
                              </TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.quinta?.retorno_almoco)}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.quinta?.saida)}</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.quinta?.ativo
                                  ? minutosParaHoras(
                                      calcularCargaHorariaDia(
                                        funcionarioSelecionado.horarios.quinta.entrada,
                                        funcionarioSelecionado.horarios.quinta.saida_almoco,
                                        funcionarioSelecionado.horarios.quinta.retorno_almoco,
                                        funcionarioSelecionado.horarios.quinta.saida,
                                      ),
                                    )
                                  : "--:--"}
                              </TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell className="font-medium">Sexta-feira</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.sexta?.ativo ? (
                                  <span className="text-green-600">Ativo</span>
                                ) : (
                                  <span className="text-gray-400">Inativo</span>
                                )}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.sexta?.entrada)}</TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.sexta?.saida_almoco)}
                              </TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.sexta?.retorno_almoco)}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.sexta?.saida)}</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.sexta?.ativo
                                  ? minutosParaHoras(
                                      calcularCargaHorariaDia(
                                        funcionarioSelecionado.horarios.sexta.entrada,
                                        funcionarioSelecionado.horarios.sexta.saida_almoco,
                                        funcionarioSelecionado.horarios.sexta.retorno_almoco,
                                        funcionarioSelecionado.horarios.sexta.saida,
                                      ),
                                    )
                                  : "--:--"}
                              </TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell className="font-medium">Sábado</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.sabado?.ativo ? (
                                  <span className="text-green-600">Ativo</span>
                                ) : (
                                  <span className="text-gray-400">Inativo</span>
                                )}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.sabado?.entrada)}</TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.sabado?.saida_almoco)}
                              </TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.sabado?.retorno_almoco)}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.sabado?.saida)}</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.sabado?.ativo
                                  ? minutosParaHoras(
                                      calcularCargaHorariaDia(
                                        funcionarioSelecionado.horarios.sabado.entrada,
                                        funcionarioSelecionado.horarios.sabado.saida_almoco,
                                        funcionarioSelecionado.horarios.sabado.retorno_almoco,
                                        funcionarioSelecionado.horarios.sabado.saida,
                                      ),
                                    )
                                  : "--:--"}
                              </TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell className="font-medium">Domingo</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.domingo?.ativo ? (
                                  <span className="text-green-600">Ativo</span>
                                ) : (
                                  <span className="text-gray-400">Inativo</span>
                                )}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.domingo?.entrada)}</TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.domingo?.saida_almoco)}
                              </TableCell>
                              <TableCell>
                                {formatarHorario(funcionarioSelecionado.horarios.domingo?.retorno_almoco)}
                              </TableCell>
                              <TableCell>{formatarHorario(funcionarioSelecionado.horarios.domingo?.saida)}</TableCell>
                              <TableCell>
                                {funcionarioSelecionado.horarios.domingo?.ativo
                                  ? minutosParaHoras(
                                      calcularCargaHorariaDia(
                                        funcionarioSelecionado.horarios.domingo.entrada,
                                        funcionarioSelecionado.horarios.domingo.saida_almoco,
                                        funcionarioSelecionado.horarios.domingo.retorno_almoco,
                                        funcionarioSelecionado.horarios.domingo.saida,
                                      ),
                                    )
                                  : "--:--"}
                              </TableCell>
                            </TableRow>
                          </>
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                              Este funcionário não possui horários configurados.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-between">
                    <Button
                      onClick={() => router.push("/dashboard")}
                      variant="outline"
                      className="border-secondary text-secondary hover:bg-secondary/10"
                    >
                      Voltar para o Dashboard
                    </Button>
                    <Button
                      onClick={() => router.push("/cadastrar")}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      Cadastrar Novo Funcionário
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Selecione um funcionário para visualizar seus horários.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
