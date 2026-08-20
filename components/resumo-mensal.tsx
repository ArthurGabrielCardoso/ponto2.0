"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Clock, TrendingUp, AlertTriangle, Calendar, AlertCircle } from "lucide-react"
import type { RelatorioPonto } from "@/lib/types"
import { minutosParaHoras } from "@/lib/utils-ponto"

interface ResumoMensalProps {
  relatorio: RelatorioPonto
}

export function ResumoMensal({ relatorio }: ResumoMensalProps) {
  // Calcular a porcentagem de horas extras em relação ao total
  const porcentagemHorasExtras =
    relatorio.totalHorasTrabalhadas > 0 ? (relatorio.totalHorasExtras / relatorio.totalHorasTrabalhadas) * 100 : 0

  // Calcular a porcentagem do saldo em relação ao total esperado
  const porcentagemSaldo =
    relatorio.totalHorasEsperadas > 0 ? (Math.abs(relatorio.saldoMes) / relatorio.totalHorasEsperadas) * 100 : 0

  // Verificar se o saldo é positivo ou negativo
  const saldoPositivo = relatorio.saldoMes >= 0

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Resumo Mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Dias trabalhados e faltas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-500">Dias Úteis</div>
              <div className="text-xl font-semibold">{relatorio.diasUteis}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-500">Dias Trabalhados</div>
              <div className="text-xl font-semibold">{relatorio.diasTrabalhados}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-500">Faltas</div>
              <div className="text-xl font-semibold text-red-500">{relatorio.diasFaltas}</div>
            </div>
          </div>

          {/* Total de horas esperadas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-500 mr-2" />
                <span className="text-gray-700">Total de Horas Esperadas:</span>
              </div>
              <span className="font-medium text-lg">{minutosParaHoras(relatorio.totalHorasEsperadas)}</span>
            </div>
            <Progress value={100} className="h-2 bg-gray-200" />
          </div>

          {/* Total de horas trabalhadas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-primary mr-2" />
                <span className="text-gray-700">Total de Horas Trabalhadas:</span>
              </div>
              <span className="font-medium text-lg">{minutosParaHoras(relatorio.totalHorasTrabalhadas)}</span>
            </div>
            <Progress
              value={
                relatorio.totalHorasEsperadas > 0
                  ? (relatorio.totalHorasTrabalhadas / relatorio.totalHorasEsperadas) * 100
                  : 0
              }
              className="h-2 bg-gray-200"
            />
          </div>

          {/* Saldo do mês */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className={`h-5 w-5 ${saldoPositivo ? "text-green-500" : "text-red-500"} mr-2`} />
                <span className="text-gray-700">Saldo do Mês:</span>
              </div>
              <span className={`font-medium text-lg ${saldoPositivo ? "text-green-500" : "text-red-500"}`}>
                {saldoPositivo ? "+" : ""}
                {minutosParaHoras(relatorio.saldoMes)}
              </span>
            </div>
            <Progress
              value={porcentagemSaldo > 100 ? 100 : porcentagemSaldo}
              className="h-2 bg-gray-200"
              indicatorClassName={saldoPositivo ? "bg-green-500" : "bg-red-500"}
            />
          </div>

          {/* Total de horas extras */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 text-secondary mr-2" />
                <span className="text-gray-700">Total de Horas Extras:</span>
              </div>
              <span className="font-medium text-lg">{minutosParaHoras(relatorio.totalHorasExtras)}</span>
            </div>
            <Progress value={porcentagemHorasExtras} className="h-2 bg-gray-200" indicatorClassName="bg-secondary" />
          </div>

          {/* Alertas e inconsistências */}
          {relatorio.alertas.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
                <h3 className="font-medium text-amber-700">Alertas e Inconsistências</h3>
              </div>
              <ul className="space-y-1 text-sm">
                {relatorio.alertas.slice(0, 5).map((alerta, index) => (
                  <li key={index} className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-amber-500 mr-1 mt-0.5 flex-shrink-0" />
                    <span className="text-amber-700">{alerta}</span>
                  </li>
                ))}
                {relatorio.alertas.length > 5 && (
                  <li className="text-amber-500 font-medium">+ {relatorio.alertas.length - 5} outros alertas...</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
