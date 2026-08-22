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
      }, 1200)
    } catch (err: any) {
      setErro(err?.message || "Erro ao salvar horários no servidor")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-slate-900/90 border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl text-white space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#c69e6b]/20 border border-[#c69e6b]/40 flex items-center justify-center text-[#c69e6b]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Ajustar Horários da Jornada</span>
              </h2>
              <p className="text-xs text-white/70">
                Colaborador: <strong className="text-amber-300">{funcionario.nome}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {sucesso && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Horários atualizados com sucesso no sistema!</span>
          </div>
        )}

        <form onSubmit={handleSalvar} className="space-y-6">
          {/* Seção 1: Segunda a Sexta (Horários Principais) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Segunda a Sexta-feira</span>
              </label>
              <span className="text-[11px] text-white/60">Aplica para todos os dias úteis</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Entrada */}
              <div className="space-y-1.5 bg-white/5 p-3 rounded-2xl border border-white/10">
                <label className="text-[11px] font-semibold text-white/80 block">🌅 Entrada</label>
                <input
                  type="time"
                  required
                  value={horarios.segunda?.entrada || "08:00"}
                  onChange={(e) => handleAtualizarTodosDias("entrada", e.target.value)}
                  className="w-full bg-slate-950/70 border border-white/20 rounded-xl px-2.5 py-1.5 text-sm font-mono font-bold text-amber-200 focus:ring-2 focus:ring-amber-400 outline-none text-center"
                />
              </div>

              {/* Saída Almoço */}
              <div className="space-y-1.5 bg-white/5 p-3 rounded-2xl border border-white/10">
                <label className="text-[11px] font-semibold text-white/80 block">🥪 Saída Almoço</label>
                <input
                  type="time"
                  required
                  value={horarios.segunda?.saida_almoco || "12:00"}
                  onChange={(e) => handleAtualizarTodosDias("saida_almoco", e.target.value)}
                  className="w-full bg-slate-950/70 border border-white/20 rounded-xl px-2.5 py-1.5 text-sm font-mono font-bold text-amber-200 focus:ring-2 focus:ring-amber-400 outline-none text-center"
                />
              </div>

              {/* Retorno Almoço */}
              <div className="space-y-1.5 bg-white/5 p-3 rounded-2xl border border-white/10">
                <label className="text-[11px] font-semibold text-white/80 block">⚡ Retorno Almoço</label>
                <input
                  type="time"
                  required
                  value={horarios.segunda?.retorno_almoco || "13:00"}
                  onChange={(e) => handleAtualizarTodosDias("retorno_almoco", e.target.value)}
                  className="w-full bg-slate-950/70 border border-white/20 rounded-xl px-2.5 py-1.5 text-sm font-mono font-bold text-amber-200 focus:ring-2 focus:ring-amber-400 outline-none text-center"
                />
              </div>

              {/* Saída Final */}
              <div className="space-y-1.5 bg-white/5 p-3 rounded-2xl border border-white/10">
                <label className="text-[11px] font-semibold text-white/80 block">🌙 Saída Fim</label>
                <input
                  type="time"
                  required
                  value={horarios.segunda?.saida || "18:00"}
                  onChange={(e) => handleAtualizarTodosDias("saida", e.target.value)}
                  className="w-full bg-slate-950/70 border border-white/20 rounded-xl px-2.5 py-1.5 text-sm font-mono font-bold text-amber-200 focus:ring-2 focus:ring-amber-400 outline-none text-center"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Sábado */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
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
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                  horarios.sabado?.ativo
                    ? "bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                    : "bg-white/10 border-white/20 text-white/60"
                }`}
              >
                {horarios.sabado?.ativo ? "✅ Sábado Ativo" : "❌ Folga no Sábado"}
              </button>
            </div>

            {horarios.sabado?.ativo ? (
              <div className="grid grid-cols-2 gap-3 bg-cyan-950/20 border border-cyan-500/30 p-3.5 rounded-2xl animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-cyan-200 block">🌅 Entrada Sábado</label>
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
                    className="w-full bg-slate-950/70 border border-cyan-400/40 rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-cyan-200 focus:ring-2 focus:ring-cyan-400 outline-none text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-cyan-200 block">🌙 Saída Sábado</label>
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
                    className="w-full bg-slate-950/70 border border-cyan-400/40 rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-cyan-200 focus:ring-2 focus:ring-cyan-400 outline-none text-center"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/50 italic bg-white/5 p-2.5 rounded-xl border border-white/10">
                Este colaborador não trabalha no sábado. (A IA da sexta-feira saberá falar "Excelente final de semana!").
              </p>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onFechar}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#c69e6b] to-amber-500 hover:from-amber-400 hover:to-amber-600 text-slate-950 text-xs font-extrabold shadow-[0_0_20px_rgba(198,158,107,0.5)] transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{salvando ? "Salvando Horários..." : "Salvar Horários"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
