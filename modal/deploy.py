#!/usr/bin/env python3
"""
Script de deploy para Modal.com
Execute: python deploy.py
"""

import subprocess
import sys
import os

def run_command(cmd):
    """Executar comando e mostrar output"""
    print(f"🚀 Executando: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    if result.stdout:
        print("📤 Output:")
        print(result.stdout)
    
    if result.stderr:
        print("⚠️ Stderr:")
        print(result.stderr)
    
    if result.returncode != 0:
        print(f"❌ Comando falhou com código: {result.returncode}")
        return False
    
    return True

def main():
    """Deploy no Modal"""
    print("🚀 Iniciando deploy no Modal.com...")
    
    # Verificar se Modal está instalado
    print("📋 Verificando instalação do Modal...")
    if not run_command("modal --version"):
        print("❌ Modal não encontrado. Instalando...")
        run_command("pip install modal")
    
    # Verificar autenticação (comando correto)
    print("🔐 Verificando autenticação...")
    if not run_command("modal token show"):
        print("🔐 Fazendo login no Modal...")
        print("📋 Execute: modal token new")
        print("📋 Siga as instruções no browser que abriu")
        sys.exit(1)
    
    # Deploy da aplicação
    print("🚀 Fazendo deploy...")
    if run_command("modal deploy face_recognition.py"):
        print("✅ Deploy concluído com sucesso!")
        print("📋 Sua API está disponível em:")
        print("🌐 https://YOUR_USERNAME--face-recognition-ponto-recognize-face-endpoint.modal.run")
        
        # Listar deployments
        print("📋 Listando deployments...")
        run_command("modal app list")
        
    else:
        print("❌ Erro no deploy!")

if __name__ == "__main__":
    main()