"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { buscarFuncionarios, buscarFuncionarioPorId, atualizarHorariosFuncionario } from "@/lib/supabase"
import { DashboardHeader } from "@/components/dashboard-header"
import { Clock, AlertCircle, CheckCircle, Edit3, Save, X, ArrowLeft, UserPlus } from "lucide-react"
import type { Funcionario, HorariosSemana, HorarioDia } from "@/lib/types"
import { minutosParaHoras } from "@/lib/utils-ponto"

const horarioPadrao: HorarioDia = {
  entrada: "08:00",
  saida_almoco: "12:00",
  retorno_almoco: "13:00",
  saida: "17:00",
  ativo: true,
}

const DIAS: { chave: keyof HorariosSemana; nome: string }[] = [
  { chave: "segunda", nome: "Segunda-feira" },
  { chave: "terca", nome: "Terça-feira" },
  { chave: "quarta", nome: "Quarta-feira" },
  { chave: "quinta", nome: "Quinta-feira" },
  { chave: "sexta", nome: "Sexta-feira" },
  { chave: "sabado", nome: "Sábado" },
  { chave: "domingo", nome: "Domingo" },
]

function calcularCargaHorariaDia(
  entrada?: string,
  saidaAlmoco?: string,
  retornoAlmoco?: string,
  saida?: string
): number {
  try {
    const [hE, mE] = (entrada || "08:00").split(":").map(Number)
    const [hSA, mSA] = (saidaAlmoco || "12:00").split(":").map(Number)
    const [hRA, mRA] = (retornoAlmoco || "13:00").split(":").map(Number)
    const [hS, mS] = (saida || "17:00").split(":").map(Number)

    const entradaMin = hE * 60 + mE
    const saidaAlmocoMin = hSA * 60 + mSA
    const retornoAlmocoMin = hRA * 60 + mRA
    const saidaMin = hS * 60 + mS

    return Math.max(0, (saidaMin - entradaMin) - (retornoAlmocoMin - saidaAlmocoMin))
  } catch {
    return 0
  }
}

export default function VerificarHorarios() {
  const router = useRouter()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [funcionarioId, setFuncionarioId] = useState<string>("")
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<Funcionario | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [horariosEditados, setHorariosEditados] = useState<HorariosSemana>({
    segunda: { ...horarioPadrao },
    terca: { ...horarioPadrao },
    quarta: { ...horarioPadrao },
    quinta: { ...horarioPadrao },
    sexta: { ...horarioPadrao },
    sabado: { ...horarioPadrao, ativo: false },
    domingo: { ...horarioPadrao, ativo: false },
  })

  useEffect(() => {
    const carregarFuncionarios = async () => {
      try {
        const dados = await buscarFuncionarios()
        if (dados.length === 0) {
          setError("Nenhum funcionário cadastrado.")
        } else {
          setFuncionarios(dados)
        }
      } catch {
        setError("Erro ao carregar funcionários.")
      } finally {
        setIsLoading(false)
      }
    }
    carregarFuncionarios()
  }, [])

  useEffect(() => {
    const carregarFuncionario = async () => {
      if (!funcionarioId) return

      setIsLoading(true)
      setError(null)
      setSuccess(null)
      setIsEditing(false)

      try {
        const funcionario = await buscarFuncionarioPorId(funcionarioId)
        setFuncionarioSelecionado(funcionario)

        if (funcionario?.horarios) {
          setHorariosEditados({
            segunda: funcionario.horarios.segunda || { ...horarioPadrao },
            terca: funcionario.horarios.terca || { ...horarioPadrao },
            quarta: funcionario.horarios.quarta || { ...horarioPadrao },
            quinta: funcionario.horarios.quinta || { ...horarioPadrao },
            sexta: funcionario.horarios.sexta || { ...horarioPadrao },
            sabado: funcionario.horarios.sabado || { ...horarioPadrao, ativo: false },
            domingo: funcionario.horarios.domingo || { ...horarioPadrao, ativo: false },
          })
        }
      } catch {
        setError("Erro ao carregar detalhes do funcionário.")
        setFuncionarioSelecionado(null)
      } finally {
        setIsLoading(false)
      }
    }
    carregarFuncionario()
  }, [funcionarioId])

  const handleLogout = () => {
    localStorage.removeItem("authenticated")
    document.cookie = "authenticated=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
  }

  const formatarHorario = (horario: string | undefined) => horario || "--:--"

  const handleAtualizarCampo = (
    dia: keyof HorariosSemana,
    campo: keyof HorarioDia,
    valor: string | boolean
  ) => {
    setHorariosEditados((prev) => ({
      ...prev,
      [dia]: {
        ...(prev[dia] || horarioPadrao),
        [campo]: valor,
      },
    }))
  }

  const calcularMediaAtual = (): number => {
    let total = 0
    let ativos = 0
    Object.values(horariosEditados).forEach((h) => {
      if (h?.ativo) {
        total += calcularCargaHorariaDia(h.entrada, h.saida_almoco, h.retorno_almoco, h.saida)
        ativos++
      }
    })
    return ativos > 0 ? Math.round(total / ativos) : 480
  }

  const handleSalvarHorarios = async () => {
    if (!funcionarioSelecionado?.id) return
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await atualizarHorariosFuncionario(funcionarioSelecionado.id, horariosEditados)
      const novaMedia = calcularMediaAtual()
      const funcionarioAtualizado: Funcionario = {
        ...funcionarioSelecionado,
        horarios: horariosEditados,
        carga_horaria_diaria_minutos: novaMedia,
      }

      setFuncionarioSelecionado(funcionarioAtualizado)
      setFuncionarios((prev) =>
        prev.map((f) => (f.id === funcionarioAtualizado.id ? funcionarioAtualizado : f))
      )
      setIsEditing(false)
      setSuccess(`Horários e carga horária (${minutosParaHoras(novaMedia)}) atualizados com sucesso!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar horários.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <DashboardHeader onLogout={handleLogout} />

      <div className="container mx-auto p-6 flex-1">
        <Card className="w-full max-w-4xl mx-auto shadow-lg">
          <CardHeader className="bg-primary text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-6 w-6" />
                <CardTitle className="text-2xl">Horários de Trabalho</CardTitle>
              </div>
              {funcionarioSelecionado && !isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="secondary"
                  className="bg-white text-primary hover:bg-white/90"
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Editar Horários
                </Button>
              )}
            </div>
            <CardDescription className="text-white/80">
              Visualize e configure os horários de trabalho e carga horária dos funcionários
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-50 border-green-200 text-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>Sucesso</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Selecione o Funcionário</label>
                <Select value={funcionarioId} onValueChange={setFuncionarioId} disabled={isLoading || isSaving}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um funcionário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {funcionarios.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Carregando horários...</div>
              ) : funcionarioSelecionado ? (
                <div className="space-y-6">
                  <div className="rounded-lg border bg-blue-50/50 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{funcionarioSelecionado.nome}</h3>
                        <p className="text-sm text-gray-600">
                          Carga horária diária média:{" "}
                          <span className="font-bold text-primary">
                            {funcionarioSelecionado.carga_horaria_diaria_minutos
                              ? `${minutosParaHoras(funcionarioSelecionado.carga_horaria_diaria_minutos)} (${funcionarioSelecionado.carga_horaria_diaria_minutos} min)`
                              : "8:00 (480 min)"}
                          </span>
                        </p>
                      </div>
                      {isEditing && (
                        <div className="text-sm bg-blue-100 text-blue-800 px-3 py-1.5 rounded-md font-medium">
                          Nova média calculada: {minutosParaHoras(calcularMediaAtual())}
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b">
                        <h3 className="font-semibold text-gray-800">Editar Grade Semanal</h3>
                        <p className="text-xs text-gray-500">Altere os horários ou desative os dias sem expediente</p>
                      </div>

                      <div className="space-y-3">
                        {DIAS.map(({ chave, nome }) => {
                          const h = horariosEditados[chave] || horarioPadrao
                          const cargaDia = h.ativo
                            ? calcularCargaHorariaDia(h.entrada, h.saida_almoco, h.retorno_almoco, h.saida)
                            : 0

                          return (
                            <div
                              key={chave}
                              className={`rounded-lg border p-4 transition-colors ${
                                h.ativo ? "bg-white border-gray-200" : "bg-gray-50/70 border-gray-100 opacity-60"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{nome}</span>
                                  <span className="text-xs text-gray-500">
                                    {h.ativo ? `(${minutosParaHoras(cargaDia)})` : "(Folga)"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    id={`ativo-${chave}`}
                                    checked={h.ativo}
                                    onCheckedChange={(checked) => handleAtualizarCampo(chave, "ativo", checked)}
                                  />
                                  <Label htmlFor={`ativo-${chave}`} className="text-xs font-normal cursor-pointer">
                                    {h.ativo ? "Trabalha" : "Folga"}
                                  </Label>
                                </div>
                              </div>

                              {h.ativo && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                                  <div>
                                    <Label className="text-xs text-gray-500">Entrada</Label>
                                    <Input
                                      type="time"
                                      value={h.entrada || "08:00"}
                                      onChange={(e) => handleAtualizarCampo(chave, "entrada", e.target.value)}
                                      className="h-9"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-gray-500">Saída Almoço</Label>
                                    <Input
                                      type="time"
                                      value={h.saida_almoco || "12:00"}
                                      onChange={(e) => handleAtualizarCampo(chave, "saida_almoco", e.target.value)}
                                      className="h-9"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-gray-500">Retorno Almoço</Label>
                                    <Input
                                      type="time"
                                      value={h.retorno_almoco || "13:00"}
                                      onChange={(e) => handleAtualizarCampo(chave, "retorno_almoco", e.target.value)}
                                      className="h-9"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-gray-500">Saída</Label>
                                    <Input
                                      type="time"
                                      value={h.saida || "17:00"}
                                      onChange={(e) => handleAtualizarCampo(chave, "saida", e.target.value)}
                                      className="h-9"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false)
                            setError(null)
                          }}
                          disabled={isSaving}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleSalvarHorarios}
                          disabled={isSaving}
                          className="bg-primary hover:bg-primary/90 text-white"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {isSaving ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-semibold">Dia da Semana</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold">Entrada</TableHead>
                            <TableHead className="font-semibold">Saída Almoço</TableHead>
                            <TableHead className="font-semibold">Retorno Almoço</TableHead>
                            <TableHead className="font-semibold">Saída</TableHead>
                            <TableHead className="font-semibold">Carga Diária</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {funcionarioSelecionado.horarios ? (
                            DIAS.map(({ chave, nome }) => {
                              const h = funcionarioSelecionado.horarios?.[chave]
                              const carga = h?.ativo
                                ? calcularCargaHorariaDia(h.entrada, h.saida_almoco, h.retorno_almoco, h.saida)
                                : 0

                              return (
                                <TableRow key={chave} className={!h?.ativo ? "bg-gray-50/50 text-gray-400" : ""}>
                                  <TableCell className="font-medium text-gray-900">{nome}</TableCell>
                                  <TableCell>
                                    {h?.ativo ? (
                                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                                        Ativo
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                        Folga
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>{formatarHorario(h?.entrada)}</TableCell>
                                  <TableCell>{formatarHorario(h?.saida_almoco)}</TableCell>
                                  <TableCell>{formatarHorario(h?.retorno_almoco)}</TableCell>
                                  <TableCell>{formatarHorario(h?.saida)}</TableCell>
                                  <TableCell className="font-semibold">
                                    {h?.ativo ? minutosParaHoras(carga) : "--:--"}
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-6 text-gray-500">
                                Este funcionário não possui horários configurados.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="flex justify-between pt-4">
                    <Button
                      onClick={() => router.push("/dashboard")}
                      variant="outline"
                      className="border-secondary text-secondary hover:bg-secondary/10"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar ao Dashboard
                    </Button>
                    <Button
                      onClick={() => router.push("/cadastrar")}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Cadastrar Novo Funcionário
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Selecione um funcionário acima para visualizar e editar seus horários.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
