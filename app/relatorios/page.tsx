"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buscarRegistrosPonto } from "@/lib/supabase"
import { FileText, Search } from "lucide-react"
import type { RegistroPonto } from "@/lib/types"
import { DashboardHeader } from "@/components/dashboard-header"

export default function Relatorios() {
  const router = useRouter()
  const [registros, setRegistros] = useState<RegistroPonto[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const carregarRegistros = async () => {
      try {
        const dados = await buscarRegistrosPonto()
        setRegistros(dados)
      } catch (error) {
        console.error("Erro ao carregar registros:", error)
      } finally {
        setIsLoading(false)
      }
    }

    carregarRegistros()
  }, [])

  // Formatar data para exibição
  const formatarData = (dataString: string) => {
    const data = new Date(dataString)
    return data.toLocaleDateString("pt-BR")
  }

  // Formatar hora para exibição
  const formatarHora = (dataString: string) => {
    const data = new Date(dataString)
    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  }

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("authenticated")
    document.cookie = "authenticated=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
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
              <FileText className="h-6 w-6" />
              <CardTitle className="text-2xl">Relatório de Registros de Ponto</CardTitle>
            </div>
            <CardDescription className="text-white/80">
              Visualize todos os registros de ponto dos funcionários
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p>Carregando registros...</p>
                </div>
              </div>
            ) : registros.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="font-semibold">Funcionário</TableHead>
                      <TableHead className="font-semibold">Data</TableHead>
                      <TableHead className="font-semibold">Hora</TableHead>
                      <TableHead className="font-semibold">Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registros.map((registro) => (
                      <TableRow key={registro.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{registro.nome_funcionario}</TableCell>
                        <TableCell>{formatarData(registro.data_hora)}</TableCell>
                        <TableCell>{formatarHora(registro.data_hora)}</TableCell>
                        <TableCell>{registro.tipo || "Entrada/Saída"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-100">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum registro de ponto encontrado.</p>
                <p className="text-gray-400 text-sm mt-1">Registre pontos para visualizá-los aqui.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
