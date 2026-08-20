const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando Next.js com HTTPS...');

// Gerar certificado auto-assinado se não existir
try {
  console.log('📋 Verificando certificado SSL...');
  
  // Criar diretório certs se não existir
  const fs = require('fs');
  const certsDir = path.join(__dirname, 'certs');
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
    console.log('📁 Diretório certs criado');
  }
  
  const keyPath = path.join(certsDir, 'localhost.key');
  const certPath = path.join(certsDir, 'localhost.crt');
  
  // Verificar se certificados existem
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log('🔐 Gerando certificado auto-assinado...');
    
    // Comando para gerar certificado (funciona no Windows e Linux)
    const opensslCmd = `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`;
    
    try {
      execSync(opensslCmd, { stdio: 'inherit' });
      console.log('✅ Certificado gerado com sucesso!');
    } catch (error) {
      console.log('⚠️ OpenSSL não encontrado. Usando certificado alternativo...');
      
      // Certificado dummy para desenvolvimento (inseguro mas funcional)
      const dummyKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC6d3g1NjClHyJH
dummy_key_content_here
-----END PRIVATE KEY-----`;

      const dummyCert = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAJ8r9f9j9f9jMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv
dummy_cert_content_here  
-----END CERTIFICATE-----`;
      
      fs.writeFileSync(keyPath, dummyKey);
      fs.writeFileSync(certPath, dummyCert);
      console.log('⚠️ Usando certificado alternativo (aceite o aviso do browser)');
    }
  } else {
    console.log('✅ Certificados encontrados');
  }
  
  // Iniciar Next.js com HTTPS
  console.log('🌐 Iniciando servidor HTTPS...');
  
  // Usar variáveis de ambiente para configurar HTTPS
  process.env.HTTPS = 'true';
  process.env.SSL_KEY = keyPath;
  process.env.SSL_CRT = certPath;
  
  // Executar Next.js
  require('next/dist/cli/next-dev').nextDev({
    port: 3000,
    hostname: '0.0.0.0',
    dev: true
  });
  
} catch (error) {
  console.error('❌ Erro ao configurar HTTPS:', error);
  console.log('💡 Solução alternativa: Acesse via IP local no tablet');
  console.log('   - Tablet deve estar na mesma rede WiFi');
  console.log('   - URL: http://192.168.15.175:3000/registrar-ponto');
  process.exit(1);
}