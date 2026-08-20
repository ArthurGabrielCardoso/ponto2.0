"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { BarChart, UserPlus, LogOut, Menu, X } from "lucide-react"

interface DashboardHeaderProps {
  onLogout: () => void
}

export function DashboardHeader({ onLogout }: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="bg-white text-secondary shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Image src="/logo.png" alt="Vitall Check-Up" width={120} height={60} className="h-auto" />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4 justify-start">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-secondary hover:bg-secondary/10">
                <BarChart className="h-5 w-5 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Link href="/cadastrar">
              <Button variant="ghost" className="text-secondary hover:bg-secondary/10">
                <UserPlus className="h-5 w-5 mr-2" />
                Cadastrar Funcionário
              </Button>
            </Link>
            <Button variant="ghost" className="text-secondary hover:bg-secondary/10" onClick={onLogout}>
              <LogOut className="h-5 w-5 mr-2" />
              Sair
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button variant="ghost" className="text-secondary" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="container mx-auto px-4 py-3 space-y-2">
            <Link href="/dashboard" className="block">
              <Button variant="ghost" className="w-full text-secondary hover:bg-secondary/10 justify-start">
                <BarChart className="h-5 w-5 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Link href="/cadastrar" className="block">
              <Button variant="ghost" className="w-full text-secondary hover:bg-secondary/10 justify-start">
                <UserPlus className="h-5 w-5 mr-2" />
                Cadastrar Funcionário
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full text-secondary hover:bg-secondary/10 justify-start"
              onClick={onLogout}
            >
              <LogOut className="h-5 w-5 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
