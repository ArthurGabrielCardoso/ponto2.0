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
    <header className="relative z-40 bg-white border-b border-slate-200 text-slate-900 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo e Badge */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="transition-opacity hover:opacity-90">
              <Image src="/logo.png" alt="Vitall Check-Up" width={130} height={65} priority style={{ height: "auto" }} />
            </Link>
            <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm bg-amber-50 text-[#a67c4e] border border-amber-200">
              Ponto 2.0
            </span>
          </div>

          {/* Navegação Desktop */}
          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/registrar-ponto"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all active:scale-95 shadow-sm"
            >
              <Camera className="h-4 w-4 text-emerald-700" />
              <span>Abrir Câmera do Ponto</span>
            </Link>

            <Link
              href="/dashboard/showcase"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-white text-xs font-bold transition-all active:scale-95 shadow-sm hover:brightness-105"
              style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
            >
              <Sparkles className="h-4 w-4" />
              <span>Showcase IA</span>
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors"
            >
              <BarChart3 className="h-4 w-4 text-slate-600" />
              <span>Painel</span>
            </Link>

            <Link
              href="/relatorios"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-transparent hover:border-slate-200 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-slate-600" />
              <span>Relatórios</span>
            </Link>

            <Link
              href="/cadastrar"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-transparent hover:border-slate-200 transition-colors"
            >
              <UserPlus className="h-4 w-4 text-slate-600" />
              <span>Cadastrar</span>
            </Link>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-red-600" />
              <span>Sair</span>
            </button>
          </nav>

          {/* Botão de Menu Mobile */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 p-4 space-y-2 animate-in slide-in-from-top duration-200">
          <Link
            href="/registrar-ponto"
            className="flex items-center gap-2 w-full p-2.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200"
          >
            <Camera className="h-4 w-4 text-emerald-700" />
            <span>Abrir Câmera de Ponto</span>
          </Link>
          <Link
            href="/dashboard/showcase"
            className="flex items-center gap-2 w-full p-2.5 rounded-md text-white font-bold text-xs"
            style={{ background: "linear-gradient(135deg, #c69e6b 0%, #a67c4e 100%)" }}
          >
            <Sparkles className="h-4 w-4" />
            <span>Visualizar Showcase & Vozes</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 w-full p-2.5 rounded-md bg-slate-100 text-slate-900 font-semibold text-xs"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Painel</span>
          </Link>
          <Link
            href="/relatorios"
            className="flex items-center gap-2 w-full p-2.5 rounded-md text-slate-700 hover:bg-slate-50 font-semibold text-xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Relatórios</span>
          </Link>
          <Link
            href="/cadastrar"
            className="flex items-center gap-2 w-full p-2.5 rounded-md text-slate-700 hover:bg-slate-50 font-semibold text-xs"
          >
            <UserPlus className="h-4 w-4" />
            <span>Cadastrar Funcionário</span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 w-full p-2.5 rounded-md bg-red-50 text-red-700 font-semibold text-xs border border-red-200"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair do Sistema</span>
          </button>
        </div>
      )}
    </header>
  )
}
