"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { supabase, buscarFuncionarios } from "@/lib/supabase"
import { criarPin, hashDisponivel, pinValido, PIN_MAX, PIN_MIN } from "@/lib/pin-manual"

/**
 * PIN da batida manual: o responsável define (ou troca) o PIN de cada pessoa.
 *
 * O PIN é transformado em hash AQUI, no navegador, e só o hash vai para o
 * banco. Ninguém — nem o responsável, depois de salvar — consegue ler um PIN.
 * Esquecido, se troca por um novo.
 *
 * A tela também lista as batidas manuais que pedem uma olhada, para a revisão
 * não depender de rodar SQL.
 */

interface Pessoa {
  id: string
  nome: string
}

interface StatusPin {
  tamanho: number
  atualizado_em: string | null
}

interface ParaRevisar {
  data_hora: string
  nome_funcionario: string
  tipo: string
  situacao: string
  pin_situacao: string | null
}

const ROTULO_SITUACAO: Record<string, string> = {
  divergente: "O rosto da foto NÃO bate com o cadastro",
  sem_rosto: "A foto não tem um rosto",
  sem_foto: "Sem foto",
  nao_verificado: "Não foi possível comparar o rosto",
  pendente: "Aguardando a comparação do rosto",
}

export default function PinsPage() {
  const router = useRouter()
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [status, setStatus] = useState<Record<string, StatusPin>>({})
  const [tabelaOk, setTabelaOk] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [pin, setPin] = useState("")
  const [repete, setRepete] = useState("")
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [revisar, setRevisar] = useState<ParaRevisar[]>([])

  const carregar = useCallback(async () => {
    const funcionarios = await buscarFuncionarios()
    setPessoas(funcionarios.map((f) => ({ id: f.id, nome: f.nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")))

    if (!supabase) return
    const { data, error } = await supabase.from("pins_funcionarios").select("funcionario_id, tamanho, atualizado_em")
    if (error) {
      setTabelaOk(false)
    } else {
      setTabelaOk(true)
      const mapa: Record<string, StatusPin> = {}
      for (const r of (data || []) as unknown as { funcionario_id: string; tamanho: number; atualizado_em: string | null }[]) {
        mapa[r.funcionario_id] = { tamanho: r.tamanho, atualizado_em: r.atualizado_em }
      }
      setStatus(mapa)
    }

    // A visão só existe depois do SQL; sem ela, a seção some em silêncio.
    const v = await supabase.from("pontos_manuais_revisar").select("*").limit(30)
    if (!v.error) setRevisar((v.data || []) as unknown as ParaRevisar[])
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const abrir = (id: string) => {
    setEditando(id)
    setPin("")
    setRepete("")
    setMensagem(null)
  }

  const salvar = async (p: Pessoa) => {
    setMensagem(null)
    if (!pinValido(pin)) return setMensagem({ tipo: "erro", texto: `O PIN deve ter de ${PIN_MIN} a ${PIN_MAX} dígitos, só números.` })
    if (pin !== repete) return setMensagem({ tipo: "erro", texto: "Os dois PINs digitados são diferentes." })
    if (!supabase) return setMensagem({ tipo: "erro", texto: "Sem conexão com o banco." })

    setSalvando(true)
    try {
      const reg = await criarPin(pin)
      const { error } = await supabase.from("pins_funcionarios").upsert(
        {
          funcionario_id: p.id,
          salt: reg.salt,
          hash: reg.hash,
          iteracoes: reg.iteracoes,
          tamanho: reg.tamanho,
          atualizado_em: new Date().toISOString(),
        } as never,
        { onConflict: "funcionario_id" }
      )
      if (error) throw new Error(error.message)
      setMensagem({ tipo: "ok", texto: `PIN de ${p.nome.split(" ")[0]} salvo. O tablet recebe em até 30 minutos (ou na hora em que a batida manual é aberta).` })
      setEditando(null)
      await carregar()
    } catch (e) {
      setMensagem({ tipo: "erro", texto: (e as Error).message })
    } finally {
      setSalvando(false)
    }
  }

  const remover = async (p: Pessoa) => {
    if (!supabase || !window.confirm(`Remover o PIN de ${p.nome}? A pessoa fica sem PIN até você cadastrar outro.`)) return
    const { error } = await supabase.from("pins_funcionarios").delete().eq("funcionario_id", p.id)
    setMensagem(error ? { tipo: "erro", texto: error.message } : { tipo: "ok", texto: `PIN de ${p.nome.split(" ")[0]} removido.` })
    await carregar()
  }

  const sair = () => {
    localStorage.removeItem("authenticated")
    document.cookie = "authenticated=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader onLogout={sair} />
      <main className="container mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <KeyRound className="h-6 w-6 text-[#a67c4e]" />
            PIN da batida manual
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quando o reconhecimento facial não funciona, a pessoa escolhe o próprio nome no tablet e digita o PIN, além de
            tirar uma foto. O PIN é guardado só como hash: depois de salvo, ninguém consegue lê-lo — se alguém esquecer, defina outro.
            Peça para cada pessoa digitar o próprio PIN, sem você olhando. De {PIN_MIN} a {PIN_MAX} dígitos; {PIN_MAX} é mais seguro.
          </p>
        </div>

        {!hashDisponivel() && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Este navegador não permite calcular o PIN (precisa de HTTPS). Abra o painel pelo endereço com https://.
          </p>
        )}
        {!tabelaOk && (
          <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            A tabela de PINs ainda não existe no banco. Rode o script <code>scripts/create_pontos_manuais.sql</code> no SQL Editor do Supabase.
          </p>
        )}
        {mensagem && (
          <p
            role="status"
            className={`rounded-lg border p-3 text-sm ${
              mensagem.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {mensagem.texto}
          </p>
        )}

        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
          {pessoas.map((p) => {
            const st = status[p.id]
            return (
              <li key={p.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{p.nome}</div>
                    {st ? (
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-700">
                        <ShieldCheck className="h-4 w-4" />
                        PIN de {st.tamanho} dígitos
                        {st.atualizado_em ? ` · definido em ${new Date(st.atualizado_em).toLocaleDateString("pt-BR")}` : ""}
                      </div>
                    ) : (
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-700">
                        <ShieldAlert className="h-4 w-4" />
                        Sem PIN: a batida manual fica liberada, mas marcada para revisão
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => abrir(p.id)}
                      disabled={!tabelaOk}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
                    >
                      {st ? "Trocar PIN" : "Definir PIN"}
                    </button>
                    {st && (
                      <button
                        type="button"
                        onClick={() => void remover(p)}
                        aria-label={`Remover o PIN de ${p.nome}`}
                        className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {editando === p.id && (
                  <form
                    className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto]"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void salvar(p)
                    }}
                  >
                    <label className="text-xs font-semibold text-slate-600">
                      Novo PIN
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        maxLength={PIN_MAX}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg tracking-[0.3em]"
                        autoFocus
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Repita o PIN
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        maxLength={PIN_MAX}
                        value={repete}
                        onChange={(e) => setRepete(e.target.value.replace(/\D/g, ""))}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg tracking-[0.3em]"
                      />
                    </label>
                    <div className="flex items-end gap-2">
                      <button
                        type="submit"
                        disabled={salvando}
                        className="rounded-md bg-[#a67c4e] px-4 py-2.5 text-sm font-bold text-white hover:brightness-105 disabled:opacity-60"
                      >
                        {salvando ? "Salvando…" : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditando(null)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </li>
            )
          })}
          {pessoas.length === 0 && <li className="p-4 text-sm text-slate-500">Nenhum funcionário encontrado.</li>}
        </ul>

        {revisar.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-bold">Batidas manuais para revisar</h2>
            <p className="mb-2 text-xs text-slate-600">
              Divergente e sem rosto sempre aparecem. Sem foto ou sem comparação só aparecem quando o PIN também não validou a pessoa.
              As fotos ficam no painel do Supabase, em Storage, no bucket <code>fotos-ponto-manual</code>.
            </p>
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
              {revisar.map((r, i) => (
                <li key={i} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{r.nome_funcionario}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(r.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {r.tipo}
                    </span>
                  </div>
                  <div className={`mt-0.5 text-xs ${r.situacao === "divergente" ? "font-semibold text-red-700" : "text-amber-800"}`}>
                    {ROTULO_SITUACAO[r.situacao] ?? r.situacao}
                    {r.pin_situacao && r.pin_situacao !== "validado" ? " · PIN não validado" : r.pin_situacao === "validado" ? " · PIN validado" : ""}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
