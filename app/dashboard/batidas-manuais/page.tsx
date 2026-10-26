"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { supabase } from "@/lib/supabase"

/**
 * Batidas manuais para revisar.
 *
 * Quando o reconhecimento facial não funciona, a pessoa escolhe o próprio nome
 * no tablet e uma foto fica guardada. Aqui aparecem as batidas manuais que
 * pedem uma olhada: o rosto da foto não bate com o cadastro, a foto não tem
 * rosto, ou não houve foto. As confirmadas (rosto bateu) não aparecem.
 *
 * As fotos ficam no painel do Supabase (Storage, bucket `fotos-ponto-manual`):
 * o bucket é privado e o tablet só consegue escrever nele.
 */

interface ParaRevisar {
  data_hora: string
  nome_funcionario: string
  tipo: string
  situacao: string
  detalhe: Record<string, unknown> | null
}

const ROTULO_SITUACAO: Record<string, { texto: string; grave: boolean }> = {
  divergente: { texto: "O rosto da foto NÃO bate com o cadastro", grave: true },
  sem_rosto: { texto: "A foto não tem um rosto", grave: true },
  sem_foto: { texto: "Sem foto: a câmera não funcionou ou a pessoa seguiu sem foto", grave: false },
  nao_verificado: { texto: "Não foi possível comparar o rosto com o cadastro", grave: false },
  pendente: { texto: "Aguardando a comparação do rosto", grave: false },
}

export default function BatidasManuaisPage() {
  const router = useRouter()
  const [lista, setLista] = useState<ParaRevisar[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)

  const carregar = useCallback(async () => {
    if (!supabase) return setCarregando(false)
    const { data, error } = await supabase.from("pontos_manuais_revisar").select("*").limit(100)
    if (error) setSemTabela(true)
    else setLista((data || []) as unknown as ParaRevisar[])
    setCarregando(false)
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const sair = () => {
    localStorage.removeItem("authenticated")
    document.cookie = "authenticated=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader onLogout={sair} />
      <main className="container mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardCheck className="h-6 w-6 text-[#a67c4e]" />
            Batidas manuais para revisar
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quando o reconhecimento facial não funciona, a pessoa escolhe o próprio nome no tablet e uma foto fica guardada.
            Aqui aparecem as batidas que pedem uma olhada. As fotos ficam no painel do Supabase, em Storage, no bucket{" "}
            <code>fotos-ponto-manual</code>.
          </p>
        </div>

        {semTabela && (
          <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            As tabelas ainda não existem no banco. Rode o script <code>scripts/create_pontos_manuais.sql</code> no SQL Editor do Supabase.
          </p>
        )}

        {!semTabela && !carregando && lista.length === 0 && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Nenhuma batida manual precisa de revisão.
          </p>
        )}

        {lista.length > 0 && (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
            {lista.map((r, i) => {
              const rot = ROTULO_SITUACAO[r.situacao] ?? { texto: r.situacao, grave: false }
              return (
                <li key={i} className="p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{r.nome_funcionario}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(r.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {r.tipo}
                    </span>
                  </div>
                  <div className={`mt-0.5 text-xs ${rot.grave ? "font-semibold text-red-700" : "text-amber-800"}`}>{rot.texto}</div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
