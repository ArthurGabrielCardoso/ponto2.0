"use client"

import React from "react"

interface IlustracaoProps {
  tipo: string
  className?: string
}

export function IlustracaoPontoAnimada({ tipo, className = "w-36 h-36" }: IlustracaoProps) {
  const t = (tipo || "").toLowerCase()

  // 1. ENTRADA - Sol Radiante da Manhã com Raios Giratórios e Nuvens Flutuantes
  if (t.includes("entrada")) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <style>{`
          @keyframes sunRotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes sunPulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(245, 158, 11, 0.5)); }
            50% { transform: scale(1.06); filter: drop-shadow(0 0 30px rgba(245, 158, 11, 0.85)); }
          }
          @keyframes floatCloud {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(6px); }
          }
          @keyframes sparkleIn {
            0%, 100% { opacity: 0.3; transform: scale(0.7); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          .anim-sun-rays { animation: sunRotate 24s linear infinite; transform-origin: 50% 50%; }
          .anim-sun-core { animation: sunPulse 3s ease-in-out infinite; }
          .anim-cloud { animation: floatCloud 4s ease-in-out infinite; }
          .anim-sparkle-1 { animation: sparkleIn 2s ease-in-out infinite; }
          .anim-sparkle-2 { animation: sparkleIn 2.4s ease-in-out 0.8s infinite; }
        `}</style>
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
          {/* Brilho de Fundo */}
          <circle cx="60" cy="60" r="46" fill="url(#sunGlow)" opacity="0.4" />

          {/* Raios Solares Rotativos */}
          <g className="anim-sun-rays">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <line
                key={i}
                x1="60"
                y1="18"
                x2="60"
                y2="25"
                stroke="url(#sunRaysGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                transform={`rotate(${angle} 60 60)`}
              />
            ))}
          </g>

          {/* Núcleo do Sol */}
          <circle cx="60" cy="60" r="24" fill="url(#sunCoreGrad)" className="anim-sun-core" />
          <circle cx="53" cy="53" r="5" fill="#ffffff" opacity="0.45" />

          {/* Nuvem Matinal */}
          <path
            className="anim-cloud"
            d="M40 76C40 71.5817 43.5817 68 48 68C48.6859 68 49.3496 68.0863 49.9839 68.2494C51.5235 63.5042 55.9754 60 61.2 60C67.496 60 72.6 65.104 72.6 71.4C72.6 71.6035 72.5947 71.8058 72.5841 72.0067C75.6425 72.6074 78 75.3129 78 78.6C78 82.1346 75.1346 85 71.6 85H47C43.134 85 40 81.866 40 78V76Z"
            fill="url(#cloudGrad)"
            opacity="0.9"
          />

          {/* Brilhos / Partículas */}
          <polygon points="90,30 92,36 98,38 92,40 90,46 88,40 82,38 88,36" fill="#fde047" className="anim-sparkle-1" />
          <polygon points="26,45 27,49 31,50 27,51 26,55 25,51 21,50 25,49" fill="#fde047" className="anim-sparkle-2" />

          <defs>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="sunCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="60%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="sunRaysGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  // 2. SAÍDA ALMOÇO - Prato Gourmet com Vapores Fumegantes Animados
  if (t.includes("almoço") && (t.includes("saída") || t.includes("saida"))) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <style>{`
          @keyframes steamRise1 {
            0% { transform: translateY(0) scaleX(1); opacity: 0; }
            40% { opacity: 0.85; }
            100% { transform: translateY(-22px) scaleX(1.3); opacity: 0; }
          }
          @keyframes steamRise2 {
            0% { transform: translateY(0) scaleX(1); opacity: 0; }
            40% { opacity: 0.85; }
            100% { transform: translateY(-22px) scaleX(1.3); opacity: 0; }
          }
          @keyframes steamRise3 {
            0% { transform: translateY(0) scaleX(1); opacity: 0; }
            40% { opacity: 0.85; }
            100% { transform: translateY(-22px) scaleX(1.3); opacity: 0; }
          }
          @keyframes clochePulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(249, 115, 22, 0.4)); }
            50% { transform: scale(1.04); filter: drop-shadow(0 0 25px rgba(249, 115, 22, 0.75)); }
          }
          .anim-steam-1 { animation: steamRise1 2.2s ease-out infinite; }
          .anim-steam-2 { animation: steamRise2 2.5s ease-out 0.6s infinite; }
          .anim-steam-3 { animation: steamRise3 2.1s ease-out 1.2s infinite; }
          .anim-cloche { animation: clochePulse 3s ease-in-out infinite; }
        `}</style>
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
          {/* Brilho */}
          <circle cx="60" cy="65" r="46" fill="url(#lunchGlow)" opacity="0.4" />

          {/* Vapores Fumegantes */}
          <path
            className="anim-steam-1"
            d="M48 44C46 38 52 34 50 28"
            stroke="url(#steamGrad)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            className="anim-steam-2"
            d="M60 40C58 34 64 30 62 24"
            stroke="url(#steamGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            className="anim-steam-3"
            d="M72 44C70 38 76 34 74 28"
            stroke="url(#steamGrad)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Cloche / Prato Gourmet */}
          <g className="anim-cloche">
            {/* Prato Base */}
            <ellipse cx="60" cy="85" rx="42" ry="7" fill="url(#plateGrad)" />
            <ellipse cx="60" cy="83" rx="36" ry="4" fill="#ffffff" opacity="0.6" />

            {/* Tampa Gourmet (Cloche) */}
            <path
              d="M26 80C26 58 41 48 60 48C79 48 94 58 94 80H26Z"
              fill="url(#clocheGrad)"
            />

            {/* Puxador da Tampa */}
            <circle cx="60" cy="44" r="5.5" fill="url(#knobGrad)" />

            {/* Reflexo de Luz Curvo */}
            <path
              d="M36 76C37 62 48 54 60 54"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.5"
            />
          </g>

          <defs>
            <radialGradient id="lunchGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="clocheGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="60%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#9a3412" />
            </linearGradient>
            <linearGradient id="knobGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id="plateGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="50%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            <linearGradient id="steamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#fb923c" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  // 3. RETORNO ALMOÇO - Maleta / Foco de Alta Energia com Ondas de Retorno
  if (t.includes("retorno")) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <style>{`
          @keyframes focusPulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(29, 185, 179, 0.5)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 30px rgba(29, 185, 179, 0.85)); }
          }
          @keyframes ringEnergy {
            0% { transform: scale(0.8); opacity: 0.8; }
            100% { transform: scale(1.4); opacity: 0; }
          }
          .anim-brief-core { animation: focusPulse 2.8s ease-in-out infinite; }
          .anim-energy-ring { animation: ringEnergy 2.5s cubic-bezier(0.16, 1, 0.3, 1) infinite; transform-origin: 50% 50%; }
        `}</style>
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
          {/* Anel de Energia */}
          <circle cx="60" cy="62" r="38" stroke="url(#tealGrad)" strokeWidth="2" className="anim-energy-ring" opacity="0.6" />

          {/* Maleta de Foco */}
          <g className="anim-brief-core">
            {/* Alça */}
            <path
              d="M48 46V38C48 35.7909 49.7909 34 52 34H68C70.2091 34 72 35.7909 72 38V46"
              stroke="url(#handleGrad)"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Corpo da Maleta */}
            <rect x="25" y="46" width="70" height="46" rx="8" fill="url(#briefGrad)" />

            {/* Faixa Central */}
            <line x1="25" y1="64" x2="95" y2="64" stroke="#ffffff" strokeWidth="2.5" opacity="0.3" />

            {/* Fecho Dourado */}
            <rect x="54" y="60" width="12" height="9" rx="2" fill="url(#goldLockGrad)" />

            {/* Ícone de Raio/Foco */}
            <polygon points="60,49 57,56 61,56 59,62 64,54 60,54" fill="#ffffff" opacity="0.9" />
          </g>

          <defs>
            <linearGradient id="briefGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="50%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
            <linearGradient id="handleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0f766e" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
            <linearGradient id="goldLockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
            <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5eead4" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  // 4. SAÍDA (FIM DE EXPEDIENTE) - Lua Noturna com Estrelas Cintilantes
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <style>{`
        @keyframes moonFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); filter: drop-shadow(0 0 15px rgba(253, 224, 71, 0.45)); }
          50% { transform: translateY(-6px) rotate(3deg); filter: drop-shadow(0 0 30px rgba(253, 224, 71, 0.85)); }
        }
        @keyframes starBlink1 {
          0%, 100% { opacity: 0.25; transform: scale(0.65) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.3) rotate(45deg); filter: drop-shadow(0 0 8px #fde047); }
        }
        @keyframes starBlink2 {
          0%, 100% { opacity: 0.2; transform: scale(0.6) rotate(0deg); }
          50% { opacity: 0.95; transform: scale(1.25) rotate(30deg); filter: drop-shadow(0 0 8px #fde047); }
        }
        @keyframes starBlink3 {
          0%, 100% { opacity: 0.3; transform: scale(0.7) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.35) rotate(-45deg); filter: drop-shadow(0 0 8px #fde047); }
        }
        .anim-moon { animation: moonFloat 4s ease-in-out infinite; }
        .anim-star-1 { animation: starBlink1 2s ease-in-out infinite; }
        .anim-star-2 { animation: starBlink2 2.6s ease-in-out 0.7s infinite; }
        .anim-star-3 { animation: starBlink3 2.2s ease-in-out 1.3s infinite; }
      `}</style>
      <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
        {/* Halo Noturno */}
        <circle cx="56" cy="58" r="46" fill="url(#moonHalo)" opacity="0.35" />

        {/* Lua Crescente Dourada */}
        <path
          className="anim-moon"
          d="M68 28C50 30 36 45 36 64C36 83.8823 52.1177 100 72 100C81.5 100 90 96 96 90C80 92 64 80 64 62C64 47 74 34 88 28C81.5 28 74.5 27.5 68 28Z"
          fill="url(#moonGrad)"
        />

        {/* Estrelas Cintilantes */}
        <polygon points="94,36 96,42 102,44 96,46 94,52 92,46 86,44 92,42" fill="#fde047" className="anim-star-1" />
        <polygon points="28,34 29,38 33,39 29,40 28,44 27,40 23,39 27,38" fill="#fde047" className="anim-star-2" />
        <polygon points="86,76 87,80 91,81 87,82 86,86 85,82 81,81 85,80" fill="#fde047" className="anim-star-3" />

        <defs>
          <radialGradient id="moonHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde047" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="moonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="40%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
