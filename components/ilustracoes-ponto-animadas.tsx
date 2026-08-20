"use client"

import React from "react"

interface IlustracaoProps {
  tipo: string
  className?: string
}

export function IlustracaoPontoAnimada({ tipo, className = "w-48 h-48 sm:w-64 sm:h-64" }: IlustracaoProps) {
  const t = (tipo || "").toLowerCase()

  // 1. ENTRADA - Sol Radiante Dourado com Raios Rotativos, Nuvens e Estrelas
  if (t.includes("entrada")) {
    return (
      <div className={`relative flex items-center justify-center ${className} select-none`}>
        <style>{`
          @keyframes sunRaysSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes sunPulseCore {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes floatCloudOrganic {
            0%, 100% { transform: translateX(0) translateY(0); }
            50% { transform: translateX(5px) translateY(-2px); }
          }
          @keyframes sparkleStarPulse {
            0%, 100% { opacity: 0.3; transform: scale(0.7); }
            50% { opacity: 1; transform: scale(1.25); }
          }
          .spin-rays { animation: sunRaysSpin 28s linear infinite; transform-origin: 100px 100px; }
          .pulse-sun { animation: sunPulseCore 3.5s ease-in-out infinite; transform-origin: 100px 100px; }
          .float-cloud { animation: floatCloudOrganic 4s ease-in-out infinite; }
          .sparkle-s1 { animation: sparkleStarPulse 2s ease-in-out infinite; transform-origin: 145px 55px; }
          .sparkle-s2 { animation: sparkleStarPulse 2.6s ease-in-out 0.8s infinite; transform-origin: 50px 70px; }
        `}</style>
        <svg viewBox="0 0 200 200" className="w-full h-full" fill="none">
          {/* Halos Radiantes Circulares Suaves */}
          <circle cx="100" cy="100" r="90" fill="url(#sunOuterHalo)" opacity="0.3" />
          <circle cx="100" cy="100" r="72" fill="url(#sunInnerHalo)" opacity="0.45" />

          {/* Raios Solares com Pontas Arredondadas */}
          <g className="spin-rays">
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
              <line
                key={i}
                x1="100"
                y1="34"
                x2="100"
                y2="46"
                stroke="url(#sunRaysGrad)"
                strokeWidth="5"
                strokeLinecap="round"
                transform={`rotate(${angle} 100 100)`}
              />
            ))}
          </g>

          {/* Disco Central do Sol */}
          <g className="pulse-sun">
            <circle cx="100" cy="100" r="42" fill="url(#sunCoreGrad)" />
            {/* Brilho Especular */}
            <circle cx="86" cy="86" r="10" fill="#ffffff" opacity="0.45" />
          </g>

          {/* Nuvem Matinal com Gradiente Suave */}
          <path
            className="float-cloud"
            d="M66 128C66 120.268 72.268 114 80 114C81.2 114 82.36 114.15 83.47 114.43C86.16 106.13 93.95 100 103.1 100C114.1 100 123 108.9 123 119.9C123 120.25 122.99 120.6 122.97 120.95C128.3 122 132.4 126.7 132.4 132.4C132.4 138.6 127.4 143.6 121.2 143.6H78.2C71.5 143.6 66 138.1 66 131.4V128Z"
            fill="url(#sunCloudGrad)"
            opacity="0.95"
          />

          {/* Estrelas Cintilantes de Energia Matinal */}
          <g className="sparkle-s1">
            <polygon points="145,45 148,53 156,55 148,57 145,65 142,57 134,55 142,53" fill="#fde047" />
          </g>
          <g className="sparkle-s2">
            <polygon points="50,62 52,68 58,70 52,72 50,78 48,72 42,70 48,68" fill="#fde047" />
          </g>

          <defs>
            <radialGradient id="sunOuterHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sunInnerHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde047" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="sunCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="25%" stopColor="#fde047" />
              <stop offset="70%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#c69e6b" />
            </linearGradient>
            <linearGradient id="sunRaysGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="sunCloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  // 2. SAÍDA ALMOÇO - Cloche Gourmet com Vapores Orgânicos Suaves e Aura Âmbar
  if (t.includes("almoço") && (t.includes("saída") || t.includes("saida"))) {
    return (
      <div className={`relative flex items-center justify-center ${className} select-none`}>
        <style>{`
          @keyframes steamPlume1 {
            0% { transform: translateY(0) scaleX(1); opacity: 0; }
            40% { opacity: 0.85; }
            100% { transform: translateY(-30px) scaleX(1.35); opacity: 0; }
          }
          @keyframes steamPlume2 {
            0% { transform: translateY(0) scaleX(1); opacity: 0; }
            40% { opacity: 0.9; }
            100% { transform: translateY(-32px) scaleX(1.4); opacity: 0; }
          }
          @keyframes steamPlume3 {
            0% { transform: translateY(0) scaleX(1); opacity: 0; }
            40% { opacity: 0.85; }
            100% { transform: translateY(-28px) scaleX(1.3); opacity: 0; }
          }
          @keyframes clocheFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          .anim-plume-1 { animation: steamPlume1 2.4s ease-out infinite; }
          .anim-plume-2 { animation: steamPlume2 2.8s ease-out 0.7s infinite; }
          .anim-plume-3 { animation: steamPlume3 2.3s ease-out 1.4s infinite; }
          .anim-cloche-body { animation: clocheFloat 3.6s ease-in-out infinite; }
        `}</style>
        <svg viewBox="0 0 200 200" className="w-full h-full" fill="none">
          {/* Halos Suaves de Calor Gastronômico */}
          <circle cx="100" cy="110" r="85" fill="url(#lunchWarmHalo)" opacity="0.35" />
          <circle cx="100" cy="115" r="65" fill="url(#lunchInnerHalo)" opacity="0.5" />

          {/* Vapores Fumegantes Fluidos */}
          <path
            className="anim-plume-1"
            d="M80 75C76 64 88 56 84 44"
            stroke="url(#steamGradient)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            className="anim-plume-2"
            d="M100 68C96 56 108 48 104 36"
            stroke="url(#steamGradient)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            className="anim-plume-3"
            d="M120 75C116 64 128 56 124 44"
            stroke="url(#steamGradient)"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Prato Base e Cloche Gourmet */}
          <g className="anim-cloche-body">
            {/* Prato Base */}
            <ellipse cx="100" cy="144" rx="70" ry="12" fill="url(#lunchPlateGrad)" />
            <ellipse cx="100" cy="140" rx="60" ry="7" fill="#ffffff" opacity="0.7" />

            {/* Tampa Curva Dourada/Âmbar */}
            <path
              d="M44 135C44 98 68 82 100 82C132 82 156 98 156 135H44Z"
              fill="url(#lunchClocheGrad)"
            />

            {/* Puxador da Tampa */}
            <circle cx="100" cy="76" r="9" fill="url(#lunchKnobGrad)" />

            {/* Reflexo de Luz Curvo */}
            <path
              d="M60 128C62 104 80 92 100 92"
              stroke="#ffffff"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.55"
            />
          </g>

          <defs>
            <radialGradient id="lunchWarmHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#fb923c" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="lunchInnerHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde047" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="lunchClocheGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="35%" stopColor="#fb923c" />
              <stop offset="80%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#9a3412" />
            </linearGradient>
            <linearGradient id="lunchKnobGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffedd5" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id="lunchPlateGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <linearGradient id="steamGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#fb923c" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  // 3. RETORNO ALMOÇO - Maleta / Foco de Alta Energia com Ondas Teal/Esmeralda
  if (t.includes("retorno")) {
    return (
      <div className={`relative flex items-center justify-center ${className} select-none`}>
        <style>{`
          @keyframes focusEnergyRing {
            0% { transform: scale(0.85); opacity: 0.8; }
            100% { transform: scale(1.35); opacity: 0; }
          }
          @keyframes briefFloatPulse {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-3px) scale(1.02); }
          }
          .anim-focus-ring { animation: focusEnergyRing 2.8s cubic-bezier(0.16, 1, 0.3, 1) infinite; transform-origin: 100px 105px; }
          .anim-briefcase { animation: briefFloatPulse 3.5s ease-in-out infinite; transform-origin: 100px 105px; }
        `}</style>
        <svg viewBox="0 0 200 200" className="w-full h-full" fill="none">
          {/* Halos Suaves de Foco & Produtividade */}
          <circle cx="100" cy="105" r="85" fill="url(#tealWarmHalo)" opacity="0.3" />
          <circle cx="100" cy="105" r="62" stroke="url(#tealRingsGrad)" strokeWidth="3" className="anim-focus-ring" />

          {/* Maleta de Foco */}
          <g className="anim-briefcase">
            {/* Alça */}
            <path
              d="M80 78V66C80 62.6863 82.6863 60 86 60H114C117.314 60 120 62.6863 120 66V78"
              stroke="url(#tealHandleGrad)"
              strokeWidth="6"
              strokeLinecap="round"
            />

            {/* Corpo da Maleta */}
            <rect x="42" y="78" width="116" height="76" rx="14" fill="url(#tealBodyGrad)" />

            {/* Divisória Central Suave */}
            <line x1="42" y1="108" x2="158" y2="108" stroke="#ffffff" strokeWidth="3.5" opacity="0.3" />

            {/* Fecho Dourado Signature */}
            <rect x="90" y="102" width="20" height="14" rx="3.5" fill="url(#goldLockGradient)" />

            {/* Símbolo de Raio/Foco */}
            <polygon points="100,84 95,94 102,94 99,102 107,91 101,91" fill="#ffffff" opacity="0.95" />
          </g>

          <defs>
            <radialGradient id="tealWarmHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#0d9488" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="tealBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5eead4" />
              <stop offset="40%" stopColor="#14b8a6" />
              <stop offset="85%" stopColor="#0d9488" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
            <linearGradient id="tealHandleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0f766e" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
            <linearGradient id="tealRingsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5eead4" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
            <linearGradient id="goldLockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  // 4. SAÍDA (FIM DE EXPEDIENTE) - Lua Crescente Dourada com Constelação de Estrelas
  return (
    <div className={`relative flex items-center justify-center ${className} select-none`}>
      <style>{`
        @keyframes moonGlideNight {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(2deg); }
        }
        @keyframes starTwinkleN1 {
          0%, 100% { opacity: 0.25; transform: scale(0.65) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.3) rotate(45deg); }
        }
        @keyframes starTwinkleN2 {
          0%, 100% { opacity: 0.2; transform: scale(0.6) rotate(0deg); }
          50% { opacity: 0.95; transform: scale(1.25) rotate(30deg); }
        }
        @keyframes starTwinkleN3 {
          0%, 100% { opacity: 0.3; transform: scale(0.7) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.35) rotate(-45deg); }
        }
        .anim-moon-body { animation: moonGlideNight 4.5s ease-in-out infinite; transform-origin: 100px 100px; }
        .anim-star-n1 { animation: starTwinkleN1 2s ease-in-out infinite; transform-origin: 155px 60px; }
        .anim-star-n2 { animation: starTwinkleN2 2.7s ease-in-out 0.8s infinite; transform-origin: 45px 60px; }
        .anim-star-n3 { animation: starTwinkleN3 2.3s ease-in-out 1.4s infinite; transform-origin: 145px 125px; }
      `}</style>
      <svg viewBox="0 0 200 200" className="w-full h-full" fill="none">
        {/* Halos Suaves Noturnos */}
        <circle cx="95" cy="100" r="85" fill="url(#moonNightHalo)" opacity="0.35" />
        <circle cx="95" cy="100" r="65" fill="url(#moonInnerHalo)" opacity="0.45" />

        {/* Lua Crescente Dourada Nobre */}
        <g className="anim-moon-body">
          <path
            d="M115 46C85 49 62 74 62 105C62 138 88 164 121 164C137 164 151 157 161 147C135 150 108 131 108 101C108 76 125 55 148 46C137 46 126 45 115 46Z"
            fill="url(#moonGoldGrad)"
          />
          {/* Brilho Especular na Borda Interna */}
          <path
            d="M110 54C86 58 68 80 68 105C68 132 89 154 116 156"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.4"
          />
        </g>

        {/* Constelação de Estrelas Cintilantes */}
        <g className="anim-star-n1">
          <polygon points="155,50 158,58 166,60 158,62 155,70 152,62 144,60 152,58" fill="#fde047" />
        </g>
        <g className="anim-star-n2">
          <polygon points="45,52 47,58 53,60 47,62 45,68 43,62 37,60 43,58" fill="#fde047" />
        </g>
        <g className="anim-star-n3">
          <polygon points="145,117 147,123 153,125 147,127 145,133 143,127 137,125 143,123" fill="#fde047" />
        </g>

        <defs>
          <radialGradient id="moonNightHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde047" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#818cf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#312e81" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="moonInnerHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ca8a04" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="moonGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="30%" stopColor="#fef08a" />
            <stop offset="70%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#c69e6b" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
