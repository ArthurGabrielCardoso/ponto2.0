"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Camera,
  Sparkles,
} from "lucide-react"

export default function Login() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Credenciais administrativas do sistema
    if (username.trim().toLowerCase() === "admin" && password === "admin") {
      setTimeout(() => {
        document.cookie = "authenticated=true; path=/; max-age=86400" // 24 horas
        localStorage.setItem("authenticated", "true")
        router.push("/dashboard")
      }, 600)
    } else {
      setTimeout(() => {
        setError("Usuário ou senha incorretos. Verifique suas credenciais.")
        setIsLoading(false)
      }, 400)
    }
  }

  // Preenchimento rápido para demonstração
  const preencherAdmin = () => {
    setUsername("admin")
    setPassword("admin")
    setError("")
  }

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 flex flex-col justify-between items-center p-4 sm:p-6 relative select-none">
      {/* TOPO: Botão de Voltar para a Câmera de Ponto */}
      <header className="relative z-10 w-full max-w-5xl flex items-center justify-between py-2">
        <Link
          href="/registrar-ponto"
          className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-700 shadow-sm transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-[#c69e6b]" />
          <span>Voltar para Registro de Ponto</span>
        </Link>

        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">Ambiente Seguro & Autenticado</span>
        </div>
      </header>

      {/* CENTRO: Card de Login em MODO LIGHT com Bordas Quadradas Modernas */}
      <main className="relative z-10 w-full max-w-md my-auto py-6 animate-in fade-in duration-300">
        <div className="bg-white border border-slate-200 rounded-lg p-7 sm:p-9 shadow-md space-y-6">
          {/* Logo e Cabeçalho */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <Image
                src="/logo.png"
                alt="Vitall Check-Up"
                width={160}
                height={80}
                priority
                style={{ height: "auto" }}
              />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm bg-amber-50 border border-amber-200 text-[#a67c4e] text-[11px] uppercase font-bold tracking-wider">
                <Sparkles className="w-3 h-3 text-[#c69e6b]" />
                <span>Painel de Gestão</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Acesso Administrativo
              </h1>
              <p className="text-xs text-slate-500">
                Entre com suas credenciais para gerenciar colaboradores e relatórios
              </p>
            </div>
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Campo Usuário */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Usuário
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-[#c69e6b] rounded-md pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-1 focus:ring-[#c69e6b] transition-all"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Senha
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  id="password"
                  type={mostrarSenha ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-[#c69e6b] rounded-md pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-1 focus:ring-[#c69e6b] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão de Submissão */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-md bg-gradient-to-r from-[#c69e6b] to-[#b38850] hover:from-[#b38850] hover:to-[#9e7542] text-white text-sm font-bold shadow-sm transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Entrar no Painel</span>
                )}
              </button>
            </div>
          </form>

          {/* Dica de Acesso Rápido */}
          <div className="pt-3 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={preencherAdmin}
              className="text-xs text-slate-500 hover:text-[#a67c4e] transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <span>Preencher credenciais padrão</span>
              <span className="font-mono font-bold text-slate-700">(admin / admin)</span>
            </button>
          </div>
        </div>
      </main>

      {/* RODAPÉ */}
      <footer className="relative z-10 w-full max-w-5xl py-2 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <span>© Vitall Check-Up • Ponto 2.0</span>
        <div className="flex items-center gap-4">
          <Link href="/registrar-ponto" className="hover:text-slate-800 transition-colors flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-[#c69e6b]" />
            Câmera do Ponto
          </Link>
          <Link href="/dashboard/showcase" className="hover:text-slate-800 transition-colors flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#c69e6b]" />
            Showcase
          </Link>
        </div>
      </footer>
    </div>
  )
}
