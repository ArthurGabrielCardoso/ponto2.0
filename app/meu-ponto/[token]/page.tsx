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
import {
  horaDoDia,
  diaEMes,
  diaDaSemana,
  mesEAno,
  ehMesmoDiaNaClinica,
} from "@/lib/fuso-brasil"
import { ContadorAlmoco } from "@/components/contador-almoco"
import { ListaDiasPonto, type DiaDePonto } from "@/components/lista-dias-ponto"
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
 * ATENÇÃO ao mexer aqui: esta página é montada no SERVIDOR, e a Vercel roda em
 * UTC. Toda data e hora tem que passar pelos ajudantes de lib/fuso-brasil, ou
 * sai três horas adiantada. Um `toLocaleTimeString` direto neste arquivo é bug.
 */

/**
 * Maiúscula só na primeira letra. O `capitalize` do CSS capitaliza toda
 * palavra e produz "Setembro De 2026" e "Quinta-Feira".
 */
function comInicialMaiuscula(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto
}

/**
 * Almoço em andamento: a última saída para almoço de hoje sem um retorno
 * depois dela. A duração sai da grade do funcionário — a mesma conta que o
 * tablet usa na proteção de tela, para os dois nunca discordarem do horário de
 * volta.
 */
function obterAlmocoEmAndamento(registros: RegistroPonto[], funcionario: Funcionario | null) {
  const agora = new Date()

  const doDia = registros
    .filter((r) => ehMesmoDiaNaClinica(r.data_hora, agora))
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

  return {
    retornoPrevistoMs: retornoPrevisto.getTime(),
    horaSaida: horaDoDia(saidaEm),
    horaRetorno: horaDoDia(retornoPrevisto),
  }
}

/**
 * O fundo é a MESMA película da tela de espera do tablet: o gradiente teal em
 * três paradas, com desfoque por cima. Copiado valor por valor de
 * app/registrar-ponto — se um dia mudar lá, muda aqui junto, senão as duas
 * telas deixam de parecer o mesmo produto.
 *
 * Sobre ele, um brilho dourado nos cantos, que é a outra metade da marca.
 */
const PELICULA_TEAL =
  "linear-gradient(135deg, rgba(29, 185, 179, 0.72) 0%, rgba(22, 145, 141, 0.75) 50%, rgba(13, 132, 136, 0.8) 100%)"

function FundoVitall() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0f8a86]">
      <div
        className="absolute inset-0"
        style={{
          background: PELICULA_TEAL,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      />
      <div className="absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-[#c69e6b] opacity-55 blur-[110px]" />
      <div className="absolute -left-24 top-1/2 h-[320px] w-[320px] rounded-full bg-[#e6c79a] opacity-35 blur-[110px]" />
      <div className="absolute -right-16 bottom-0 h-[340px] w-[340px] rounded-full bg-[#a67c4e] opacity-45 blur-[115px]" />
    </div>
  )
}

/**
 * Vidro escuro sobre a película teal, do mesmo jeito que os cartões da tela de
 * ponto batido — lá também é uma superfície escura translúcida sobre o fundo
 * colorido, não um cartão branco. Canto reto de propósito: o arredondado
 * grande dava cara de aplicativo de banco.
 */
const VIDRO =
  "rounded-lg border border-white/20 bg-slate-950/35 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl"

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
            style={{ filter: "brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.3))" }}
          />
          <h1 className="mt-5 text-lg font-bold text-white">{titulo}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/65">{texto}</p>
        </div>
      </main>
    </>
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
  const ordenados = Object.entries(porDia).sort((a, b) => b[0].localeCompare(a[0]))

  let saldoAcumulado = 0
  let trabalhadasNoMes = 0
  const dias: DiaDePonto[] = ordenados.map(([chave, regs]) => {
    const esperadas = obterHorasEsperadasParaData(
      new Date(regs[0].data_hora),
      funcionario?.horarios,
      funcionario?.carga_horaria_diaria_minutos
    )
    const resumo = calcularHorasPorDia(regs, esperadas)
    saldoAcumulado += resumo.saldoDia
    trabalhadasNoMes += resumo.horasTrabalhadas

    const referencia = new Date(regs[0].data_hora)
    const temCargaPrevista = resumo.horasEsperadas > 0

    return {
      chave,
      diaMes: diaEMes(referencia),
      diaSemana: comInicialMaiuscula(diaDaSemana(referencia)),
      ehHoje: ehMesmoDiaNaClinica(referencia, agora),
      batidas: regs
        .slice()
        .sort((a, b) => a.data_hora.localeCompare(b.data_hora))
        .map((r, i) => ({
          id: r.id ?? `${chave}-${i}`,
          hora: horaDoDia(r.data_hora),
          tipo: r.tipo ?? "",
        })),
      trabalhadas: minutosParaHoras(resumo.horasTrabalhadas),
      esperadas: minutosParaHoras(resumo.horasEsperadas),
      temCargaPrevista,
      proporcao: temCargaPrevista
        ? Math.min(resumo.horasTrabalhadas / resumo.horasEsperadas, 1)
        : 0,
      saldoMinutos: resumo.saldoDia,
      saldoTexto: `${resumo.saldoDia < 0 ? "−" : "+"}${minutosParaHoras(Math.abs(resumo.saldoDia))}`,
    }
  })

  const almoco = obterAlmocoEmAndamento(registros, funcionario)
  const primeiroNome = (dados.nome || funcionario?.nome || "").split(" ")[0]
  const mes = comInicialMaiuscula(mesEAno(agora))
  const saldoNegativo = saldoAcumulado < 0

  return (
    <>
      <FundoVitall />
      <main className="min-h-screen px-4 pb-10 pt-5">
        <div className="mx-auto w-full max-w-md">
          <header className="mb-5 flex items-center justify-between gap-3">
            <Image
              src="/logo.png"
              alt="Vitall Odontologia & Saúde Integrativa"
              width={120}
              height={60}
              priority
              className="h-auto w-[120px]"
              style={{
                // A logo e teal e dourada; o teal dela some na pelicula teal do
                // fundo. Sem um card branco atras, a saida e usar a versao
                // solida em branco — o dourado da marca aparece no resto da
                // tela, entao a identidade nao se perde.
                filter: "brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.3))",
              }}
            />
            <span className="rounded-md border border-[#e6c79a]/60 bg-[#c69e6b]/25 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
              Meu Ponto
            </span>
          </header>

          <div className="mb-5">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-white drop-shadow-sm">
              {primeiroNome ? `Olá, ${primeiroNome}` : "Suas horas"}
            </h1>
            <p className="mt-0.5 text-sm text-white/75">{mes}</p>
          </div>

          {almoco && (
            <ContadorAlmoco
              retornoPrevistoMs={almoco.retornoPrevistoMs}
              horaSaida={almoco.horaSaida}
              horaRetorno={almoco.horaRetorno}
            />
          )}

          {/* O saldo do mês é o número que a pessoa abre o celular para ver,
              então ganha a largura toda e o corpo maior. */}
          <section className={`mb-2.5 ${VIDRO} p-5`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#e6c79a]">
              Saldo do mês
            </p>
            <p
              className={`mt-1 text-4xl font-bold tabular-nums ${
                saldoNegativo ? "text-rose-300" : "text-teal-200"
              }`}
            >
              {saldoNegativo ? "−" : "+"}
              {minutosParaHoras(Math.abs(saldoAcumulado))}
            </p>
            <p className="mt-1 text-xs text-white/60">
              {saldoAcumulado === 0
                ? "Você está em dia com a sua carga horária."
                : saldoNegativo
                  ? "a menos do que a sua carga horária até aqui."
                  : "a mais do que a sua carga horária até aqui."}
            </p>
          </section>

          <section className="mb-5 grid grid-cols-2 gap-2.5">
            <div className={`${VIDRO} p-4`}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#e6c79a]">
                Dias com ponto
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">{dias.length}</p>
            </div>
            <div className={`${VIDRO} p-4`}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#e6c79a]">
                Horas no mês
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                {minutosParaHoras(trabalhadasNoMes)}
              </p>
            </div>
          </section>

          {dias.length === 0 ? (
            <p className={`${VIDRO} p-6 text-center text-sm text-white/60`}>
              Nenhuma batida registrada neste mês.
            </p>
          ) : (
            <ListaDiasPonto dias={dias} />
          )}
        </div>
      </main>
    </>
  )
}
