import Image from "next/image"
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
 * "Meu Ponto": as horas da própria pessoa, no celular dela, abertas pelo QR da
 * tela de ponto batido.
 *
 * Só leitura e sem login: quem prova a identidade é o token assinado da URL.
 * Por isso a página nunca lista outra pessoa nem aceita trocar de funcionário
 * por parâmetro.
 *
 * O visual repete a linguagem da tela de ponto batido — esferas de cor
 * borradas sob uma película de vidro — mas em claro, porque aqui é um celular
 * na mão, possivelmente no sol, e não um tablet numa parede.
 */

/**
 * Maiúscula só na primeira letra. O `capitalize` do CSS capitaliza toda
 * palavra e produz "Setembro De 2026" e "Quinta-Feira".
 */
function comInicialMaiuscula(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto
}

function ehMesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Cada tipo de batida tem sua cor, a mesma família que a tela do tablet usa:
 * teal para começar e voltar, âmbar para o almoço, dourado para encerrar.
 * Ler a linha do dia vira reconhecer cores, sem precisar ler o texto.
 */
function estiloDoTipo(tipo?: string): { ponto: string; texto: string; fundo: string } {
  const t = (tipo || "").toLowerCase()
  if (t.includes("retorno"))
    return { ponto: "bg-teal-500", texto: "text-teal-800", fundo: "bg-teal-50" }
  if (t.includes("almoço") || t.includes("almoco"))
    return { ponto: "bg-amber-500", texto: "text-amber-800", fundo: "bg-amber-50" }
  if (t.includes("entrada"))
    return { ponto: "bg-teal-600", texto: "text-teal-800", fundo: "bg-teal-50" }
  return { ponto: "bg-[#c69e6b]", texto: "text-[#8a663f]", fundo: "bg-[#faf4ec]" }
}

/**
 * Almoço em andamento: a última saída para almoço de hoje sem um retorno
 * depois dela. A duração sai da grade do funcionário — a mesma conta que o
 * tablet usa na proteção de tela, para os dois nunca discordarem do horário de
 * volta.
 */
function obterAlmocoEmAndamento(registros: RegistroPonto[], funcionario: Funcionario | null) {
  const hoje = new Date()

  const doDia = registros
    .filter((r) => ehMesmoDia(new Date(r.data_hora), hoje))
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
  const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  return {
    retornoPrevistoMs: retornoPrevisto.getTime(),
    horaSaida: hhmm(saidaEm),
    horaRetorno: hhmm(retornoPrevisto),
  }
}

/**
 * O fundo: esferas de cor borradas sob uma película de vidro. É a assinatura
 * visual da tela de ponto batido, traduzida para claro — as mesmas cores da
 * marca, o teal do escudo e o dourado da palavra Vitall.
 */
function FundoVitall() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#eef5f5]">
      <div className="absolute -right-20 -top-28 h-[440px] w-[440px] rounded-full bg-[#14b8a6] opacity-70 blur-[110px]" />
      <div className="absolute -left-28 bottom-[-5rem] h-[400px] w-[400px] rounded-full bg-[#c69e6b] opacity-45 blur-[115px]" />
      <div className="absolute left-1/4 top-1/3 h-[360px] w-[360px] rounded-full bg-[#2dd4bf] opacity-45 blur-[105px]" />
      <div className="absolute right-0 bottom-1/4 h-[300px] w-[300px] rounded-full bg-[#5eead4] opacity-40 blur-[100px]" />
      <div className="absolute inset-0 bg-white/30 backdrop-blur-[70px] backdrop-saturate-150" />
    </div>
  )
}

/** Vidro claro: a mesma superfície usada em todos os cartões da página. */
const VIDRO =
  "rounded-2xl border border-white/80 bg-white/80 shadow-[0_10px_30px_-14px_rgba(13,148,136,0.5)] backdrop-blur-xl"

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <FundoVitall />
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className={`max-w-sm ${VIDRO} p-7 text-center`}>
          <Image
            src="/logo.png"
            alt="Vitall Odontologia & Saúde Integrativa"
            width={132}
            height={66}
            priority
            className="mx-auto h-auto w-[132px]"
          />
          <h1 className="mt-5 text-lg font-bold text-slate-900">{titulo}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{texto}</p>
        </div>
      </main>
    </>
  )
}

function Saldo({ minutos, className = "" }: { minutos: number; className?: string }) {
  const negativo = minutos < 0
  return (
    <span className={`tabular-nums ${negativo ? "text-rose-600" : "text-teal-700"} ${className}`}>
      {negativo ? "−" : "+"}
      {minutosParaHoras(Math.abs(minutos))}
    </span>
  )
}

export default async function MeuPonto({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const dados = validarTokenEspelho(decodeURIComponent(token))

  // Adulterado, mal formado e vencido dão a mesma resposta de propósito: dizer
  // qual foi o problema ajudaria quem está tentando adivinhar um token.
  if (!dados) {
    return (
      <Aviso
        titulo="Este link não vale mais"
        texto="O link do QR expira algumas horas depois da batida. Bata o ponto no tablet e leia o QR de novo para abrir seu ponto."
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
  let trabalhadasNoMes = 0
  const linhas = dias.map(([data, regs]) => {
    const esperadas = obterHorasEsperadasParaData(
      new Date(regs[0].data_hora),
      funcionario?.horarios,
      funcionario?.carga_horaria_diaria_minutos
    )
    const resumo = calcularHorasPorDia(regs, esperadas)
    saldoAcumulado += resumo.saldoDia
    trabalhadasNoMes += resumo.horasTrabalhadas
    return { data, regs, resumo }
  })

  const almoco = obterAlmocoEmAndamento(registros, funcionario)
  const primeiroNome = (dados.nome || funcionario?.nome || "").split(" ")[0]
  const mes = comInicialMaiuscula(
    agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  )

  return (
    <>
      <FundoVitall />
      <main className="min-h-screen px-4 pb-10 pt-5 text-slate-900">
        <div className="mx-auto w-full max-w-md">
          <header className="mb-6 flex items-center justify-between gap-3">
            <Image
              src="/logo.png"
              alt="Vitall Odontologia & Saúde Integrativa"
              width={120}
              height={60}
              priority
              className="h-auto w-[120px]"
            />
            <span className="rounded-full border border-teal-600/20 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-700 backdrop-blur">
              Meu Ponto
            </span>
          </header>

          <div className="mb-5">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">
              {primeiroNome ? `Olá, ${primeiroNome}` : "Suas horas"}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{mes}</p>
          </div>

          {almoco && (
            <ContadorAlmoco
              retornoPrevistoMs={almoco.retornoPrevistoMs}
              horaSaida={almoco.horaSaida}
              horaRetorno={almoco.horaRetorno}
              urlLembrete={`/api/lembrete-almoco?token=${encodeURIComponent(token)}&retorno=${almoco.retornoPrevistoMs}`}
            />
          )}

          {/* O saldo do mês é o número que a pessoa abre o celular para ver,
              então ganha a largura toda e o corpo maior. Os outros dois são
              contexto e ficam embaixo, menores. */}
          <section className={`mb-3 ${VIDRO} p-5`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Saldo do mês
            </p>
            <Saldo minutos={saldoAcumulado} className="mt-1 block text-4xl font-bold" />
            <p className="mt-1 text-xs text-slate-500">
              {saldoAcumulado === 0
                ? "Você está em dia com a sua carga horária."
                : saldoAcumulado > 0
                  ? "a mais do que a sua carga horária até aqui."
                  : "a menos do que a sua carga horária até aqui."}
            </p>
          </section>

          <section className="mb-6 grid grid-cols-2 gap-3">
            <div className={`${VIDRO} p-4`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Dias com ponto
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{linhas.length}</p>
            </div>
            <div className={`${VIDRO} p-4`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Horas no mês
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {minutosParaHoras(trabalhadasNoMes)}
              </p>
            </div>
          </section>

          {linhas.length === 0 ? (
            <p className={`${VIDRO} p-6 text-center text-sm text-slate-500`}>
              Nenhuma batida registrada neste mês.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {linhas.map(({ data, regs, resumo }) => {
                const dia = new Date(regs[0].data_hora)
                const ehHoje = ehMesmoDia(dia, agora)
                const temCargaPrevista = resumo.horasEsperadas > 0
                const proporcao = temCargaPrevista
                  ? Math.min(resumo.horasTrabalhadas / resumo.horasEsperadas, 1)
                  : 0

                return (
                  <li
                    key={data}
                    className={`${VIDRO} p-4 ${ehHoje ? "ring-2 ring-teal-500/35" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold tabular-nums">
                          {dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </span>
                        <span className="text-xs text-slate-500">
                          {comInicialMaiuscula(
                            dia.toLocaleDateString("pt-BR", { weekday: "long" })
                          )}
                        </span>
                        {ehHoje && (
                          <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Hoje
                          </span>
                        )}
                      </div>
                      <Saldo minutos={resumo.saldoDia} className="text-sm font-bold" />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {regs
                        .slice()
                        .sort((a, b) => a.data_hora.localeCompare(b.data_hora))
                        .map((r) => {
                          const estilo = estiloDoTipo(r.tipo)
                          return (
                            <span
                              key={r.id ?? r.data_hora}
                              className={`inline-flex items-center gap-1.5 rounded-lg ${estilo.fundo} px-2 py-1 text-xs font-semibold ${estilo.texto}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${estilo.ponto}`} />
                              <span className="tabular-nums">
                                {new Date(r.data_hora).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="font-normal opacity-70">{r.tipo}</span>
                            </span>
                          )
                        })}
                    </div>

                    <div className="mt-3">
                      {temCargaPrevista && (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900/8">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${proporcao * 100}%`,
                              background: "linear-gradient(90deg, #c69e6b 0%, #14b8a6 100%)",
                            }}
                          />
                        </div>
                      )}
                      <p className={`text-[11px] text-slate-500 ${temCargaPrevista ? "mt-1.5" : ""}`}>
                        {temCargaPrevista ? (
                          <>
                            {minutosParaHoras(resumo.horasTrabalhadas)} de{" "}
                            {minutosParaHoras(resumo.horasEsperadas)} previstas
                          </>
                        ) : (
                          <>
                            {minutosParaHoras(resumo.horasTrabalhadas)} trabalhadas · dia sem
                            carga prevista
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="mt-7 text-center text-[11px] leading-relaxed text-slate-500">
            Consulta somente leitura.
            <br />
            Divergências devem ser tratadas com a gestão.
          </p>
        </div>
      </main>
    </>
  )
}
