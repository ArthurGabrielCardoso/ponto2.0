"use client"

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, AlertTriangle, Printer, Umbrella, Stethoscope, AlertCircle, ArrowDown, ArrowUp } from "lucide-react"
import type { ResumoHoras } from "@/lib/types"
import { minutosParaHoras } from "@/lib/utils-ponto"

interface DetalhesDiaProps {
  resumo: ResumoHoras | null
  onExport?: () => void
}

export function DetalhesDia({ resumo, onExport }: DetalhesDiaProps) {
  if (!resumo) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Detalhes do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">Selecione um dia no calendário para ver os detalhes</p>
        </CardContent>
      </Card>
    )
  }

  // Verificar se o saldo do dia é positivo ou negativo
  const saldoPositivo = resumo.saldoDia >= 0

  // Verificar se é um dia de ausência (simulado)
  const tipoAusencia = resumo.tipoAusencia || null

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Detalhes do Dia: {resumo.data}</span>
          {resumo.ehDiaUtil ? (
            <Badge className="bg-primary">Dia Útil</Badge>
          ) : (
            <Badge variant="outline" className="text-gray-500">
              Fim de Semana
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status de ausência */}
          {tipoAusencia && (
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
              <div className="flex items-center">
                {tipoAusencia === "ferias" && (
                  <>
                    <Umbrella className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-blue-700 font-medium">Férias</span>
                  </>
                )}
                {tipoAusencia === "atestado" && (
                  <>
                    <Stethoscope className="h-5 w-5 text-purple-500 mr-2" />
                    <span className="text-purple-700 font-medium">Atestado Médico</span>
                  </>
                )}
                {tipoAusencia === "falta" && (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                    <span className="text-red-700 font-medium">Falta</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Horários de entrada e saída */}
          {!tipoAusencia && (
            <>
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-primary mr-2" />
                  <span className="text-gray-700">Entrada:</span>
                </div>
                <span className="font-medium">{resumo.entrada || "Não registrado"}</span>
              </div>

              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-secondary mr-2" />
                  <span className="text-gray-700">Saída:</span>
                </div>
                <span className="font-medium">{resumo.saida || "Não registrado"}</span>
              </div>
            </>
          )}

          {/* Resumo de horas */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700">Horas Esperadas:</span>
              <Badge variant="outline" className="font-medium">
                {minutosParaHoras(resumo.horasEsperadas)}
              </Badge>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700">Horas Trabalhadas:</span>
              <Badge variant="outline" className="font-medium">
                {minutosParaHoras(resumo.horasTrabalhadas)}
              </Badge>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700">Saldo do Dia:</span>
              <Badge variant={saldoPositivo ? "default" : "destructive"} className="font-medium">
                {saldoPositivo ? "+" : ""}
                {minutosParaHoras(resumo.saldoDia)}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700">Horas Extras:</span>
              <Badge variant={resumo.horasExtras > 0 ? "default" : "outline"} className="font-medium">
                {minutosParaHoras(resumo.horasExtras)}
              </Badge>
            </div>
          </div>

          {/* Status do dia */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Status:</span>
              {tipoAusencia ? (
                <Badge
                  className={
                    tipoAusencia === "ferias"
                      ? "bg-blue-500"
                      : tipoAusencia === "atestado"
                        ? "bg-purple-500"
                        : "bg-red-500"
                  }
                >
                  {tipoAusencia === "ferias" ? "Férias" : tipoAusencia === "atestado" ? "Atestado" : "Falta"}
                </Badge>
              ) : resumo.entrada && resumo.saida ? (
                <Badge className="bg-green-500">Completo</Badge>
              ) : resumo.entrada ? (
                <Badge className="bg-yellow-500">Entrada Registrada</Badge>
              ) : (
                <Badge variant="outline" className="text-gray-500">
                  Sem Registros
                </Badge>
              )}
            </div>
          </div>

          {/* Inconsistências */}
          {resumo.inconsistencias && resumo.inconsistencias.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
                <span className="text-amber-700 font-medium">Inconsistências:</span>
              </div>
              <ul className="space-y-1 text-sm">
                {resumo.inconsistencias.map((inconsistencia, index) => (
                  <li key={index} className="text-amber-600 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{inconsistencia}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Registros detalhados */}
          {resumo && resumo.paresPontos && resumo.paresPontos.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center mb-2">
                <Clock className="h-5 w-5 text-primary mr-2" />
                <span className="text-gray-700 font-medium">Registros Detalhados:</span>
              </div>
              <div className="space-y-2">
                {resumo.paresPontos.map((par, idx) => (
                  <div key={idx} className="bg-gray-50 p-3 rounded-md flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="flex flex-col items-center mr-3">
                        <span className="text-xs text-gray-500">Par {idx + 1}</span>
                      </div>
                      <div>
                        <div className="flex items-center">
                          <ArrowDown className="h-4 w-4 text-green-600 mr-1" />
                          <span className="text-green-600 font-medium">{par.entrada}</span>
                        </div>
                        <div className="flex items-center mt-1">
                          <ArrowUp className="h-4 w-4 text-red-600 mr-1" />
                          <span className="text-red-600 font-medium">{par.saida || "--:--"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Duração</div>
                      <div className="font-medium">
                        {par.minutos > 0 ? `${Math.floor(par.minutos / 60)}h ${par.minutos % 60}m` : "Em aberto"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      {onExport && (
        <CardFooter>
          <Button
            onClick={onExport}
            variant="outline"
            className="w-full border-primary text-primary hover:bg-primary/10"
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir Relatório Completo
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
