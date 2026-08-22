"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  BarChart3,
  UserPlus,
  LogOut,
  Menu,
  X,
  Sparkles,
  Camera,
  FileSpreadsheet,
} from "lucide-react"

interface DashboardHeaderProps {
  onLogout: () => void
}

export function DashboardHeader({ onLogout }: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="relative z-40 bg-slate-950/80 backdrop-blur-2xl border-b border-white/10 text-white">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo Nobre */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="transition-opacity hover:opacity-90">
              <Image src="/logo.png" alt="Vitall Check-Up" width={130} height={65} priority style={{ height: "auto" }} />
            </Link>
            <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#c69e6b]/20 text-amber-200 border border-[#c69e6b]/40">
              Ponto 2.0
            </span>
          </div>

          {/* Navegação Desktop */}
          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/registrar-ponto"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
            >
              <Camera className="h-4 w-4" />
              <span>Abrir Câmera do Ponto</span>
            </Link>

            <Link
              href="/dashboard/showcase"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-950 text-xs font-extrabold transition-all active:scale-95 shadow-[0_0_15px_rgba(198,158,107,0.5)] hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #c69e6b 0%, #d4af37 100%)" }}
            >
              <Sparkles className="h-4 w-4 fill-slate-950" />
              <span>Showcase IA & Telas</span>
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/10 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Painel</span>
            </Link>

            <Link
              href="/relatorios"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/80 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Relatórios</span>
            </Link>

            <Link
              href="/cadastrar"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/80 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              <span>Cadastrar</span>
            </Link>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 text-xs font-semibold border border-red-500/30 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          </nav>

          {/* Botão de Menu Mobile */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900/95 border-t border-white/10 p-4 space-y-2.5 animate-in slide-in-from-top duration-200">
          <Link
            href="/registrar-ponto"
            className="flex items-center gap-2 w-full p-3 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs"
          >
            <Camera className="h-4 w-4" />
            <span>Abrir Câmera de Ponto</span>
          </Link>
          <Link
            href="/dashboard/showcase"
            className="flex items-center gap-2 w-full p-3 rounded-xl text-slate-950 font-bold text-xs"
            style={{ background: "linear-gradient(135deg, #c69e6b 0%, #d4af37 100%)" }}
          >
            <Sparkles className="h-4 w-4 fill-slate-950" />
            <span>Visualizar Showcase & Vozes</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 w-full p-3 rounded-xl bg-white/10 text-white font-semibold text-xs"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Painel</span>
          </Link>
          <Link
            href="/relatorios"
            className="flex items-center gap-2 w-full p-3 rounded-xl bg-white/5 text-white/80 font-semibold text-xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Relatórios</span>
          </Link>
          <Link
            href="/cadastrar"
            className="flex items-center gap-2 w-full p-3 rounded-xl bg-white/5 text-white/80 font-semibold text-xs"
          >
            <UserPlus className="h-4 w-4" />
            <span>Cadastrar Funcionário</span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 w-full p-3 rounded-xl bg-red-500/20 text-red-300 font-semibold text-xs"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      )}
    </header>
  )
}
