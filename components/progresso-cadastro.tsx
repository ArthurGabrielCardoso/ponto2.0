"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Check, Cpu, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ProgressoCadastro as EstadoProgresso } from "@/lib/cadastro-cliente"

/**
 * Tela cheia mostrada enquanto o cadastro processa as fotos.
 *
 * Antes isto era um "Cadastrando..." com o botão desabilitado e uma lista de
 * log que, pior, era falsa: as linhas eram fixas e apareciam antes de qualquer
 * processamento. Quando o reconhecimento travava, não havia como distinguir
 * "está trabalhando" de "morreu" — e ele travava mesmo, sem timeout.
 *
 * Aqui cada foto tem estado próprio, o cronômetro anda, e depois de um tempo a
 * tela admite que está demorando em vez de fingir normalidade.
 */

const SEGUNDOS_ATE_AVISAR = 20

const TEXTO_FASE: Record<string, { titulo: string; detalhe: string }> = {
  modelos: {
    titulo: "Preparando o reconhecimento facial",
    detalhe:
      "Carregando os modelos no navegador. Acontece uma vez por sessão e é a parte mais demorada.",
  },
  fotos: {
    titulo: "Analisando as fotos",
    detalhe:
      "Cada foto vira um vetor matemático do rosto. A imagem em si não sai deste dispositivo.",
  },
  salvando: {
    titulo: "Salvando o cadastro",
    detalhe: "Gravando os dados do funcionário.",
  },
  concluido: {
    titulo: "Cadastro concluído",
    detalhe: "Tudo certo.",
  },
  erro: {
    titulo: "O cadastro não foi concluído",
    detalhe: "Nada foi gravado. Veja o motivo abaixo.",
  },
}

function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`
}

interface Props {
  progresso: EstadoProgresso
  /** Rótulo de cada pose capturada, na mesma ordem das fotos. */
  rotulos?: string[]
  onCancelar?: () => void
  onTentarNovamente?: () => void
}

export function ProgressoCadastro({
  progresso,
  rotulos,
  onCancelar,
  onTentarNovamente,
}: Props) {
  const [segundos, setSegundos] = useState(0)
  const emErro = progresso.fase === "erro"
  const terminou = emErro || progresso.fase === "concluido"

  useEffect(() => {
    if (terminou) return
    const t = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [terminou])

  const texto = TEXTO_FASE[progresso.fase] ?? TEXTO_FASE.fotos
  const concluidas = progresso.fotos.filter(
    (f) => f.estado === "ok" || f.estado === "falhou",
  ).length
  const aproveitadas = progresso.fotos.filter((f) => f.estado === "ok").length
  const total = progresso.fotos.length
  const percentual = total > 0 ? (concluidas / total) * 100 : 0
  const demorando = !terminou && segundos >= SEGUNDOS_ATE_AVISAR

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-start gap-3">
          {emErro ? (
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" />
          ) : progresso.fase === "concluido" ? (
            <Check className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
          ) : (
            <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-blue-600" />
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight text-slate-900">
              {texto.titulo}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{texto.detalhe}</p>
          </div>
        </div>

        {/* Erro */}
        {emErro && progresso.mensagem && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm leading-relaxed text-red-800">
              {progresso.mensagem}
            </p>
          </div>
        )}

        {/* Barra de progresso das fotos */}
        {total > 0 && !emErro && (
          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-700">
                {concluidas} de {total} fotos
              </span>
              <span className="tabular-nums text-slate-400">
                {formatarTempo(segundos)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${percentual}%` }}
              />
            </div>
          </div>
        )}

        {/* Lista por foto */}
        {total > 0 && (
          <ul className="mt-4 space-y-1.5">
            {progresso.fotos.map((foto, i) => {
              const rotulo = rotulos?.[i] ?? `Foto ${i + 1}`
              return (
                <li
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {foto.estado === "ok" && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    {foto.estado === "falhou" && (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                    {foto.estado === "processando" && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                    {foto.estado === "pendente" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    )}
                  </span>

                  <span
                    className={
                      foto.estado === "pendente"
                        ? "flex-1 truncate text-slate-400"
                        : "flex-1 truncate text-slate-700"
                    }
                  >
                    {rotulo}
                  </span>

                  <span className="shrink-0 tabular-nums text-xs text-slate-400">
                    {foto.estado === "ok" && `${foto.confianca}%`}
                    {foto.estado === "falhou" && (
                      <span className="text-red-500">{foto.erro}</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {/* Aviso de lentidão — em vez de fingir que está tudo normal */}
        {demorando && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm leading-relaxed text-amber-900">
              Está demorando mais que o normal. Em aparelhos com vídeo fraco o
              processamento cai para modo compatível, que funciona porém é mais
              lento. Se travar de vez, o cadastro avisa sozinho — não é preciso
              recarregar a página.
            </p>
          </div>
        )}

        {/* Rodapé */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Cpu className="h-3.5 w-3.5" />
            {progresso.backend || "iniciando"}
            {progresso.fase === "concluido" &&
              ` · ${aproveitadas}/${total} aproveitadas`}
          </span>

          <div className="flex gap-2">
            {emErro && onTentarNovamente && (
              <Button size="sm" onClick={onTentarNovamente}>
                Tentar novamente
              </Button>
            )}
            {emErro && onCancelar && (
              <Button size="sm" variant="outline" onClick={onCancelar}>
                Fechar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
