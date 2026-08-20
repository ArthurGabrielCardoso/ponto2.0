import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurar headers para permitir câmera
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=*, geolocation=*'
          }
        ],
      },
    ];
  }
};

export default nextConfig;
