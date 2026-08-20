#!/bin/bash

# Script de Migração para Modal.com
# Converte o sistema de modelos locais para API Modal

echo "🚀 Iniciando migração para Modal.com..."

# Backup dos arquivos originais
echo "📦 Fazendo backup dos arquivos originais..."
cp app/registrar-ponto/page.tsx app/registrar-ponto/page-original.tsx.bak
cp lib/face-pipeline.ts lib/face-pipeline-original.ts.bak

echo "✅ Backup concluído!"

# Substituir arquivos pelos otimizados
echo "🔄 Aplicando versões otimizadas..."
cp app/registrar-ponto/page-modal.tsx app/registrar-ponto/page.tsx
cp lib/face-pipeline-modal.ts lib/face-pipeline.ts

echo "✅ Arquivos atualizados!"

# Limpar modelos pesados locais (opcional)
echo "🧹 Removendo modelos pesados locais..."
if [ -d "public/models" ]; then
    echo "📁 Encontrado diretório public/models/ (7.3MB)"
    echo "⚠️  Deseja remover? (y/n)"
    read -n 1 -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf public/models
        echo "🗑️  Modelos locais removidos!"
    else
        echo "📁 Modelos mantidos (para fallback)"
    fi
fi

if [ -d "public/mediapipe" ]; then
    echo "📁 Encontrado diretório public/mediapipe/ (15MB)"
    echo "⚠️  Deseja remover? (y/n)"
    read -n 1 -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf public/mediapipe
        echo "🗑️  MediaPipe removido!"
    else
        echo "📁 MediaPipe mantido (para fallback)"
    fi
fi

echo ""
echo "🎉 Migração concluída!"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. cd modal/"
echo "2. python deploy.py"  
echo "3. Configurar NEXT_PUBLIC_MODAL_API_URL no .env.local"
echo "4. npm run build (para testar)"
echo "5. Testar no tablet Vision 7"
echo ""
echo "💡 Performance esperada:"
echo "   - Carregamento: 25s → 0s (instantâneo)"
echo "   - Reconhecimento: 3-5s → 0.5-1s" 
echo "   - Uso CPU: 80% → 10%"
echo ""