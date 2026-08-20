"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Clock, Save } from "lucide-react"
import { atualizarCargaHoraria } from "@/lib/supabase"
import { minutosParaHoras } from "@/lib/utils-ponto"

interface ConfigurarCargaHorariaProps {
  funcionarioId: string
  cargaHorariaAtual: number
  onUpdate: (novaCargaHoraria: number) => void
}

export function ConfigurarCargaHoraria({ funcionarioId, cargaHorariaAtual, onUpdate }: ConfigurarCargaHorariaProps) {
  const [horas, setHoras] = useState(Math.floor(cargaHorariaAtual / 60).toString())
  const [minutos, setMinutos] = useState((cargaHorariaAtual % 60).toString())
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const horasNum = Number.parseInt(horas) || 0
      const minutosNum = Number.parseInt(minutos) || 0
      const totalMinutos = horasNum * 60 + minutosNum

      // Não permitir valores negativos ou zero
      if (totalMinutos <= 0) {
        alert("A carga horária deve ser maior que zero.")
        return
      }

      // Se for um ID simulado, apenas atualizar localmente
      if (funcionarioId === "simulado") {
        onUpdate(totalMinutos)
      } else {
        // Caso contrário, tentar atualizar no banco de dados
        try {
          await atualizarCargaHoraria(funcionarioId, totalMinutos)
          onUpdate(totalMinutos)
        } catch (error) {
          console.error("Erro ao atualizar carga horária no banco de dados:", error)
          // Mesmo com erro no banco, atualizar localmente
          onUpdate(totalMinutos)
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar carga horária:", error)
      alert("Erro ao atualizar carga horária. Tente novamente.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Configurar Carga Horária
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">
              Carga horária atual: <span className="font-medium">{minutosParaHoras(cargaHorariaAtual)}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="horas">Horas</Label>
              <Input
                id="horas"
                type="number"
                min="0"
                max="23"
                value={horas}
                onChange={(e) => setHoras(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minutos">Minutos</Label>
              <Input
                id="minutos"
                type="number"
                min="0"
                max="59"
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Salvando..." : "Salvar Carga Horária"}
        </Button>
      </CardFooter>
    </Card>
  )
}
