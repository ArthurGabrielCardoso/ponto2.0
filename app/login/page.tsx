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
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Camera,
} from "lucide-react"
import { AnimacaoVozIa } from "@/components/animacao-voz-ia"

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
      }, 700)
    } else {
      setTimeout(() => {
        setError("Usuário ou senha incorretos. Verifique suas credenciais.")
        setIsLoading(false)
      }, 500)
    }
  }

  // Preenchimento rápido para demonstração
  const preencherAdmin = () => {
    setUsername("admin")
    setPassword("admin")
    setError("")
  }

  return (
    <div className="min-h-screen w-full bg-[#050811] text-white flex flex-col justify-between items-center p-4 sm:p-6 relative select-none overflow-hidden">
      {/* 1. LUZES AMBIENTES DIFUSAS NO FUNDO */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[650px] h-[650px] rounded-full bg-[#c69e6b] blur-[180px] opacity-35 animate-pulse" />
        <div className="absolute bottom-0 -left-20 w-[500px] h-[500px] rounded-full bg-[#14b8a6] blur-[160px] opacity-25" />
        <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full bg-[#3b82f6] blur-[160px] opacity-25" />
      </div>

      {/* TOPO: Botão de Voltar para a Câmera de Ponto */}
      <header className="relative z-10 w-full max-w-5xl flex items-center justify-between py-2">
        <Link
          href="/registrar-ponto"
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all active:scale-95 shadow-lg"
        >
          <ArrowLeft className="w-4 h-4 text-amber-300" />
          <span>Voltar para Registro de Ponto</span>
        </Link>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Ambiente Seguro & Criptografado</span>
        </div>
      </header>

      {/* CENTRO: Card de Login em Dark Glassmorphism de Luxo */}
      <main className="relative z-10 w-full max-w-md my-auto py-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="relative backdrop-blur-3xl bg-slate-950/70 border border-white/20 rounded-3xl p-7 sm:p-9 shadow-[0_25px_70px_rgba(0,0,0,0.8)] space-y-6">
          {/* Logo e Cabeçalho do Card */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <Image
                src="/logo.png"
                alt="Vitall Check-Up"
                width={150}
                height={75}
                priority
                style={{ height: "auto" }}
                className="filter drop-shadow-[0_4px_15px_rgba(0,0,0,0.5)]"
              />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#c69e6b]/20 border border-[#c69e6b]/40 text-amber-300 text-[10px] uppercase font-bold tracking-wider">
                <Sparkles className="w-3 h-3 fill-amber-300" />
                <span>Painel de Gestão</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Acesso Administrativo
              </h1>
              <p className="text-xs text-white/70">
                Entre com suas credenciais para gerenciar jornadas e relatórios
              </p>
            </div>
          </div>

          {/* Mensagem de Erro com Animação */}
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs animate-in fade-in shake duration-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Campo Usuário */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80 uppercase tracking-wider text-[10px] flex items-center justify-between">
                <span>Usuário</span>
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-white/50 absolute left-3.5 pointer-events-none" />
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="w-full bg-white/[0.08] hover:bg-white/[0.12] focus:bg-slate-900 border border-white/20 focus:border-amber-400 rounded-2xl pl-10 pr-4 py-3 text-sm text-white font-medium placeholder-white/30 outline-none focus:ring-2 focus:ring-amber-400/40 transition-all"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80 uppercase tracking-wider text-[10px] flex items-center justify-between">
                <span>Senha</span>
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-white/50 absolute left-3.5 pointer-events-none" />
                <input
                  id="password"
                  type={mostrarSenha ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white/[0.08] hover:bg-white/[0.12] focus:bg-slate-900 border border-white/20 focus:border-amber-400 rounded-2xl pl-10 pr-11 py-3 text-sm text-white font-medium placeholder-white/30 outline-none focus:ring-2 focus:ring-amber-400/40 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3.5 text-white/50 hover:text-white transition-colors cursor-pointer p-1"
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão de Submissão Dourado de Luxo */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-[#c69e6b] to-amber-500 hover:from-amber-400 hover:to-amber-600 text-slate-950 text-sm font-extrabold shadow-[0_0_25px_rgba(198,158,107,0.5)] transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Entrar no Painel</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Dica de Acesso Rápido */}
          <div className="pt-3 border-t border-white/10 text-center">
            <button
              type="button"
              onClick={preencherAdmin}
              className="text-[11px] text-white/60 hover:text-amber-300 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>🔑 Preencher credenciais padrão</span>
              <span className="font-mono font-bold text-amber-200">(admin / admin)</span>
            </button>
          </div>
        </div>
      </main>

      {/* RODAPÉ */}
      <footer className="relative z-10 w-full max-w-5xl py-2 flex flex-col sm:flex-row items-center justify-between text-xs text-white/50 gap-2">
        <span>© Vitall Check-Up • Ponto 2.0 com IA</span>
        <div className="flex items-center gap-4">
          <Link href="/registrar-ponto" className="hover:text-white transition-colors flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-amber-300" />
            Câmera do Ponto
          </Link>
          <Link href="/dashboard/showcase" className="hover:text-white transition-colors flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Showcase
          </Link>
        </div>
      </footer>

      {/* ONDA LUMINOSA AZUL FLUIDA NA BORDA BOTTOM */}
      <AnimacaoVozIa />
    </div>
  )
}
