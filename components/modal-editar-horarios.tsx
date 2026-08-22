"use client"

import React, { useState, useEffect } from "react"
import { Clock, Calendar, Save, CheckCircle2, AlertCircle, X } from "lucide-react"
import { atualizarHorariosFuncionario } from "@/lib/supabase"
import type { Funcionario, HorariosSemana, HorarioDia } from "@/lib/types"

interface ModalEditarHorariosProps {
  funcionario: Funcionario | null
  aberto: boolean
  onFechar: () => void
  onSalvo: (novosHorarios: HorariosSemana) => void
}

const HORARIO_DIA_PADRAO: HorarioDia = {
  entrada: "08:00",
  saida_almoco: "12:00",
  retorno_almoco: "13:00",
  saida: "18:00",
  ativo: true,
}

const HORARIO_SABADO_PADRAO: HorarioDia = {
  entrada: "08:00",
  saida_almoco: "12:00",
  retorno_almoco: "12:00",
  saida: "12:00",
  ativo: false,
}

const HORARIOS_PADRAO: HorariosSemana = {
  segunda: { ...HORARIO_DIA_PADRAO },
  terca: { ...HORARIO_DIA_PADRAO },
  quarta: { ...HORARIO_DIA_PADRAO },
  quinta: { ...HORARIO_DIA_PADRAO },
  sexta: { ...HORARIO_DIA_PADRAO },
  sabado: { ...HORARIO_SABADO_PADRAO },
}

export function ModalEditarHorarios({
  funcionario,
  aberto,
  onFechar,
  onSalvo,
}: ModalEditarHorariosProps) {
  const [horarios, setHorarios] = useState<HorariosSemana>(HORARIOS_PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Carrega os horários existentes do funcionário ao abrir
  useEffect(() => {
    if (funcionario?.horarios) {
      setHorarios({
        segunda: funcionario.horarios.segunda ? { ...HORARIO_DIA_PADRAO, ...funcionario.horarios.segunda } : { ...HORARIO_DIA_PADRAO },
        terca: funcionario.horarios.terca ? { ...HORARIO_DIA_PADRAO, ...funcionario.horarios.terca } : { ...HORARIO_DIA_PADRAO },
        quarta: funcionario.horarios.quarta ? { ...HORARIO_DIA_PADRAO, ...funcionario.horarios.quarta } : { ...HORARIO_DIA_PADRAO },
        quinta: funcionario.horarios.quinta ? { ...HORARIO_DIA_PADRAO, ...funcionario.horarios.quinta } : { ...HORARIO_DIA_PADRAO },
        sexta: funcionario.horarios.sexta ? { ...HORARIO_DIA_PADRAO, ...funcionario.horarios.sexta } : { ...HORARIO_DIA_PADRAO },
        sabado: funcionario.horarios.sabado ? { ...HORARIO_SABADO_PADRAO, ...funcionario.horarios.sabado } : { ...HORARIO_SABADO_PADRAO },
      })
    } else {
      setHorarios({ ...HORARIOS_PADRAO })
    }
    setSucesso(false)
    setErro(null)
  }, [funcionario, aberto])

  if (!aberto || !funcionario) return null

  // Atualiza um horário padrão para Seg-Sex simultaneamente
  const handleAtualizarTodosDias = (campo: "entrada" | "saida_almoco" | "retorno_almoco" | "saida", valor: string) => {
    setHorarios((prev) => ({
      ...prev,
      segunda: { ...(prev.segunda || HORARIO_DIA_PADRAO), [campo]: valor },
      terca: { ...(prev.terca || HORARIO_DIA_PADRAO), [campo]: valor },
      quarta: { ...(prev.quarta || HORARIO_DIA_PADRAO), [campo]: valor },
      quinta: { ...(prev.quinta || HORARIO_DIA_PADRAO), [campo]: valor },
      sexta: { ...(prev.sexta || HORARIO_DIA_PADRAO), [campo]: valor },
    }))
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErro(null)

    try {
      await atualizarHorariosFuncionario(funcionario.id, horarios)
      setSucesso(true)
      onSalvo(horarios)
      setTimeout(() => {
        onFechar()
      }, 1000)
    } catch (err: any) {
      setErro(err?.message || "Erro ao salvar horários no servidor")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-2xl text-slate-900 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-[#c69e6b]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Ajustar Horários da Jornada
              </h2>
              <p className="text-xs text-slate-500">
                Colaborador: <strong className="text-slate-800">{funcionario.nome}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{erro}</span>
          </div>
        )}

        {sucesso && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Horários atualizados com sucesso no sistema!</span>
          </div>
        )}

        <form onSubmit={handleSalvar} className="space-y-6">
          {/* Seção 1: Segunda a Sexta (Horários Principais) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#c69e6b]" />
                <span>Segunda a Sexta-feira</span>
              </label>
              <span className="text-xs text-slate-500">Aplica para todos os dias úteis</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Entrada */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-md border border-slate-200">
                <label className="text-xs font-semibold text-slate-700 block">🌅 Entrada</label>
                <input
                  type="time"
                  required
                  value={horarios.segunda?.entrada || "08:00"}
                  onChange={(e) => handleAtualizarTodosDias("entrada", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono font-bold text-slate-900 focus:border-[#c69e6b] outline-none text-center"
                />
              </div>

              {/* Saída Almoço */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-md border border-slate-200">
                <label className="text-xs font-semibold text-slate-700 block">🥪 Saída Almoço</label>
                <input
                  type="time"
                  required
                  value={horarios.segunda?.saida_almoco || "12:00"}
                  onChange={(e) => handleAtualizarTodosDias("saida_almoco", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono font-bold text-slate-900 focus:border-[#c69e6b] outline-none text-center"
                />
              </div>

              {/* Retorno Almoço */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-md border border-slate-200">
                <label className="text-xs font-semibold text-slate-700 block">⚡ Retorno Almoço</label>
                <input
                  type="time"
                  required
                  value={horarios.segunda?.retorno_almoco || "13:00"}
                  onChange={(e) => handleAtualizarTodosDias("retorno_almoco", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono font-bold text-slate-900 focus:border-[#c69e6b] outline-none text-center"
                />
              </div>

              {/* Saída Final */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-md border border-slate-200">
                <label className="text-xs font-semibold text-slate-700 block">🌙 Saída Fim</label>
                <input
                  type="time"
                  required
                  value={horarios.segunda?.saida || "18:00"}
                  onChange={(e) => handleAtualizarTodosDias("saida", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono font-bold text-slate-900 focus:border-[#c69e6b] outline-none text-center"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Sábado */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-cyan-600" />
                <span>Trabalho aos Sábados</span>
              </label>

              {/* Toggle Sábado */}
              <button
                type="button"
                onClick={() =>
                  setHorarios((prev) => {
                    const sabAtual = prev.sabado || HORARIO_SABADO_PADRAO
                    return {
                      ...prev,
                      sabado: {
                        ...sabAtual,
                        ativo: !sabAtual.ativo,
                      },
                    }
                  })
                }
                className={`px-3 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                  horarios.sabado?.ativo
                    ? "bg-cyan-50 border-cyan-300 text-cyan-800"
                    : "bg-slate-100 border-slate-300 text-slate-600"
                }`}
              >
                {horarios.sabado?.ativo ? "✅ Sábado Ativo" : "❌ Folga no Sábado"}
              </button>
            </div>

            {horarios.sabado?.ativo ? (
              <div className="grid grid-cols-2 gap-3 bg-cyan-50/50 border border-cyan-200 p-3.5 rounded-md animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-cyan-900 block">🌅 Entrada Sábado</label>
                  <input
                    type="time"
                    required
                    value={horarios.sabado?.entrada || "08:00"}
                    onChange={(e) =>
                      setHorarios((prev) => ({
                        ...prev,
                        sabado: { ...(prev.sabado || HORARIO_SABADO_PADRAO), entrada: e.target.value },
                      }))
                    }
                    className="w-full bg-white border border-cyan-300 rounded-md px-3 py-1.5 text-sm font-mono font-bold text-cyan-900 focus:border-cyan-500 outline-none text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-cyan-900 block">🌙 Saída Sábado</label>
                  <input
                    type="time"
                    required
                    value={horarios.sabado?.saida || "12:00"}
                    onChange={(e) =>
                      setHorarios((prev) => ({
                        ...prev,
                        sabado: { ...(prev.sabado || HORARIO_SABADO_PADRAO), saida: e.target.value },
                      }))
                    }
                    className="w-full bg-white border border-cyan-300 rounded-md px-3 py-1.5 text-sm font-mono font-bold text-cyan-900 focus:border-cyan-500 outline-none text-center"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-md border border-slate-200">
                Este colaborador não trabalha no sábado. (A IA da sexta-feira saberá falar "Excelente final de semana!").
              </p>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 rounded-md bg-gradient-to-r from-[#c69e6b] to-[#b38850] hover:from-[#b38850] hover:to-[#9e7542] text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{salvando ? "Salvando..." : "Salvar Horários"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
