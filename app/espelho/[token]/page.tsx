import { validarTokenEspelho } from "@/lib/token-espelho"
import { buscarRegistrosPorPeriodo, buscarFuncionarioPorId } from "@/lib/supabase"
import {
  agruparRegistrosPorDia,
  calcularHorasPorDia,
  minutosParaHoras,
  obterHorasEsperadasParaData,
} from "@/lib/utils-ponto"
import { obterGradeDoDia, horaParaMinutos } from "@/lib/logica-ponto-inteligente"
import { ContadorAlmoco } from "@/components/contador-almoco"
import type { RegistroPonto, Funcionario } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * Espelho de ponto pessoal, aberto pelo QR da tela de sucesso.
 *
 * Só leitura, feito para celular. Não tem login: quem prova a identidade é o
 * token assinado da URL, que vence em minutos. Por isso a página nunca lista
 * outra pessoa nem aceita trocar de funcionário por parâmetro.
 */

/**
 * Maiúscula só na primeira letra. O `capitalize` do CSS capitaliza toda palavra
 * e produz "Setembro De 2026" e "Quinta-Feira".
 */
function comInicialMaiuscula(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto
}

/**
 * Almoço em andamento: a última saída para almoço de hoje sem um retorno depois
 * dela. A duração sai da grade do funcionário — a mesma conta que o tablet usa
 * na proteção de tela, para os dois nunca discordarem do horário de volta.
 */
function obterAlmocoEmAndamento(registros: RegistroPonto[], funcionario: Funcionario | null) {
  const hoje = new Date()
  const ehHoje = (iso: string) => {
    const d = new Date(iso)
    return (
      d.getFullYear() === hoje.getFullYear() &&
      d.getMonth() === hoje.getMonth() &&
      d.getDate() === hoje.getDate()
    )
  }

  const doDia = registros
    .filter((r) => ehHoje(r.data_hora))
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora))

  const tipo = (r: RegistroPonto) => (r.tipo || "").toLowerCase()
  const saida = doDia.filter((r) => tipo(r).includes("saída") && tipo(r).includes("almoço")).pop()
  const retorno = doDia.filter((r) => tipo(r).includes("retorno")).pop()

  if (!saida) return null
  if (retorno && new Date(retorno.data_hora) > new Date(saida.data_hora)) return null

  const saidaEm = new Date(saida.data_hora)
  const grade = obterGradeDoDia(funcionario?.horarios, saidaEm)
  const duracao = horaParaMinutos(grade.retornoAlmoco) - horaParaMinutos(grade.saidaAlmoco)
  const minutos = duracao > 0 ? duracao : 60

  const retornoPrevisto = new Date(saidaEm.getTime() + minutos * 60 * 1000)
  const hhmm = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  return {
    retornoPrevistoMs: retornoPrevisto.getTime(),
    horaSaida: hhmm(saidaEm),
    horaRetorno: hhmm(retornoPrevisto),
  }
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h1 className="text-lg font-bold text-white">{titulo}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{texto}</p>
      </div>
    </main>
  )
}

export default async function EspelhoDePonto({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const dados = validarTokenEspelho(decodeURIComponent(token))

  // Adulterado, mal formado e vencido dão a mesma resposta de propósito: dizer
  // qual foi o problema ajudaria quem está tentando adivinhar um token.
  if (!dados) {
    return (
      <Aviso
        titulo="Link expirado"
        texto="Este link vale por poucos minutos depois da batida. Bata o ponto e leia o QR de novo para abrir seu espelho."
      />
    )
  }

  const agora = new Date()
  const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59)

  const [registros, funcionario] = await Promise.all([
    buscarRegistrosPorPeriodo(
      primeiroDia.toISOString(),
      ultimoDia.toISOString(),
      dados.funcionarioId
    ).catch(() => [] as RegistroPonto[]),
    buscarFuncionarioPorId(dados.funcionarioId).catch(() => null as Funcionario | null),
  ])

  const porDia = agruparRegistrosPorDia(registros)
  const dias = Object.entries(porDia).sort((a, b) => b[0].localeCompare(a[0]))

  let saldoAcumulado = 0
  const linhas = dias.map(([data, regs]) => {
    const esperadas = obterHorasEsperadasParaData(
      new Date(regs[0].data_hora),
      funcionario?.horarios,
      funcionario?.carga_horaria_diaria_minutos
    )
    const resumo = calcularHorasPorDia(regs, esperadas)
    saldoAcumulado += resumo.saldoDia
    return { data, regs, resumo }
  })

  const almoco = obterAlmocoEmAndamento(registros, funcionario)
  const primeiroNome = (dados.nome || funcionario?.nome || "").split(" ")[0]
  const mes = comInicialMaiuscula(
    agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  )

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-5">
          <p className="text-xs uppercase tracking-wider text-white/40">Espelho de ponto</p>
          <h1 className="mt-1 text-2xl font-bold">{primeiroNome}</h1>
          <p className="mt-0.5 text-sm text-white/50">{mes}</p>
        </header>

        {almoco && (
          <ContadorAlmoco
            retornoPrevistoMs={almoco.retornoPrevistoMs}
            horaSaida={almoco.horaSaida}
            horaRetorno={almoco.horaRetorno}
            urlLembrete={`/api/lembrete-almoco?token=${encodeURIComponent(token)}&retorno=${almoco.retornoPrevistoMs}`}
          />
        )}

        <section className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
            <p className="text-[11px] uppercase tracking-wide text-white/40">Dias registrados</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{linhas.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
            <p className="text-[11px] uppercase tracking-wide text-white/40">Saldo do mês</p>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums ${
                saldoAcumulado < 0 ? "text-red-300" : "text-emerald-300"
              }`}
            >
              {saldoAcumulado >= 0 ? "+" : "−"}
              {minutosParaHoras(Math.abs(saldoAcumulado))}
            </p>
          </div>
        </section>

        {linhas.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/50">
            Nenhuma batida registrada neste mês.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {linhas.map(({ data, regs, resumo }) => {
              const dia = new Date(regs[0].data_hora)
              return (
                <li key={data} className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <span className="text-base font-semibold">
                        {dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                      <span className="ml-2 text-xs text-white/40">
                        {comInicialMaiuscula(dia.toLocaleDateString("pt-BR", { weekday: "long" }))}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        resumo.saldoDia < 0 ? "text-red-300" : "text-emerald-300"
                      }`}
                    >
                      {resumo.saldoDia >= 0 ? "+" : "−"}
                      {minutosParaHoras(Math.abs(resumo.saldoDia))}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60">
                    {regs
                      .slice()
                      .sort((a, b) => a.data_hora.localeCompare(b.data_hora))
                      .map((r) => (
                        <span key={r.id ?? r.data_hora} className="tabular-nums">
                          <span className="text-white/35">{r.tipo}</span>{" "}
                          {new Date(r.data_hora).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ))}
                  </div>

                  <p className="mt-2 text-xs text-white/45">
                    Trabalhadas {minutosParaHoras(resumo.horasTrabalhadas)} de{" "}
                    {minutosParaHoras(resumo.horasEsperadas)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-white/30">
          Consulta somente leitura. Divergências devem ser tratadas com a gestão.
        </p>
      </div>
    </main>
  )
}
