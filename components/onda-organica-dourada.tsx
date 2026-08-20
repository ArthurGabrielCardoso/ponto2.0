"use client"

import React from "react"

export function OndaOrganicaDourada() {
  return (
    <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden pointer-events-none z-0">
      <svg
        viewBox="0 0 1440 200"
        className="w-full h-24 sm:h-32 lg:h-40 object-cover object-bottom"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0,80L48,96C96,112,192,144,288,149.3C384,155,480,133,576,117.3C672,101,768,91,864,101.3C960,112,1056,144,1152,149.3C1248,155,1344,133,1392,122.7L1440,112L1440,200L1392,200C1344,200,1248,200,1152,200C1056,200,960,200,864,200C768,200,672,200,576,200C480,200,384,200,288,200C192,200,96,200,48,200L0,200Z"
          fill="url(#goldWaveA)"
          opacity="0.3"
        />
        <path
          d="M0,140L48,128C96,117,192,96,288,101.3C384,107,480,139,576,149.3C672,160,768,149,864,133.3C960,117,1056,96,1152,90.7C1248,85,1344,96,1392,101.3L1440,107L1440,200L1392,200C1344,200,1248,200,1152,200C1056,200,960,200,864,200C768,200,672,200,576,200C480,200,384,200,288,200C192,200,96,200,48,200L0,200Z"
          fill="url(#goldWaveB)"
          opacity="0.45"
        />
        <defs>
          <linearGradient id="goldWaveA" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c69e6b" />
            <stop offset="50%" stopColor="#dfba89" />
            <stop offset="100%" stopColor="#9e7542" />
          </linearGradient>
          <linearGradient id="goldWaveB" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9e7542" />
            <stop offset="40%" stopColor="#c69e6b" />
            <stop offset="80%" stopColor="#b88d57" />
            <stop offset="100%" stopColor="#855b30" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
