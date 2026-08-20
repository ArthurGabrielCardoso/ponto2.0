"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Edit2, Save, X } from "lucide-react"
import type { RegistroPonto } from "@/lib/types"

interface AjustarRegistroProps {
  registro: RegistroPonto
  onSave: (registroAtualizado: RegistroPonto) => Promise<void>
  onCancel: () => void
}

export function AjustarRegistro({ registro, onSave, onCancel }: AjustarRegistroProps) {
  const [dataHora, setDataHora] = useState(() => {
    try {
      // Converter a string de data para um formato que o input datetime-local aceite
      const date = new Date(registro.data_hora)
      const isoString = date.toISOString()
      return isoString.substring(0, 16) // formato YYYY-MM-DDTHH:MM
    } catch {
      return ""
    }
  })

  const [tipo, setTipo] = useState(registro.tipo || "Entrada")
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Converter de volta para o formato esperado pelo sistema
      const registroAtualizado: RegistroPonto = {
        ...registro,
        data_hora: new Date(dataHora).toISOString(),
        tipo,
      }

      await onSave(registroAtualizado)
    } catch (error) {
      console.error("Erro ao salvar registro ajustado:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Edit2 className="mr-2 h-5 w-5 text-primary" />
          Ajustar Registro de Ponto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="funcionario">Funcionário</Label>
            <Input id="funcionario" value={registro.nome_funcionario} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data-hora">Data e Hora</Label>
            <Input
              id="data-hora"
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Registro</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="tipo">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Entrada">Entrada</SelectItem>
                <SelectItem value="Saída Almoço">Saída para Almoço</SelectItem>
                <SelectItem value="Retorno Almoço">Retorno do Almoço</SelectItem>
                <SelectItem value="Saída">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
