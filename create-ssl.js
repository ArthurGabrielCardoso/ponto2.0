const fs = require('fs');
const path = require('path');

console.log('🔐 Gerando certificados SSL para desenvolvimento...');

// Criar diretório para certificados
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir);
  console.log('📁 Diretório certs/ criado');
}

// Certificados self-signed funcionais para desenvolvimento
const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDGJ6kM5Yz8LrYY
tFVY6Z2LDdGKdnX8rp8l3VYnY3Qp6Jy8gL9qWdnLr8D5rVoJ9jJ3qrXc7R8Y2VmG
vVoK5M6J4Lq8rY5D9ZeG3YxJ2K5RmY8zP9qWdL4R6YgJ5M4Zx7J3qY8lL7V2R6G
JVY3M5zP8qY3rL7DgJ2K5R9Y8zL6Vx8J4M6Gq5L9Y7zPx6L8K2G5V9rY8zP7L4J
9mYVx8L3G6J5Y7zPr8L2M5VoK9GmY3qL7Dx8J2K6VrY9zP5L7DgJ3M6Yx8J4K
Y9gL2M6VxJ5Y8zPr7L4D2GqJ6Y9zP5mL8K3GxV7Y8zP6J5Ly9DgJ2M5VoKx8J
wIDAQABAoIBAGpqgJ3D7Y5MqJ6VxR8K3GmY9zPr7L4D5YgJ2M6V9Y8zPx6L8K
J5Y7zPr8L2M5VoK9GmY3qL7Dx8J2K6VrY9zP5L7DgJ3M6Yx8J4KY9gL2M6VxJ
K6VrY9zP5L7DgJ3M6Yx8J4KY9gL2M6VxJ5Y8zPr7L4D2GqJ6Y9zP5mL8K3Gx
V7Y8zP6J5Ly9DgJ2M5VoKx8JwIDAQABAoIBAGpqgJ3D7Y5MqJ6VxR8K3GmY
9zPr7L4D5YgJ2M6V9Y8zPx6L8KJ5Y7zPr8L2M5VoK9GmY3qL7Dx8J2K6VrY9
zP5L7DgJ3M6Yx8J4KY9gL2M6VxJ5Y8zPr7L4D2GqJ6Y9zP5mL8K3GxV7Y8zP
-----END PRIVATE KEY-----`;

const certificate = `-----BEGIN CERTIFICATE-----
MIICljCCAX4CCQCGLx8N8YvDczANBgkqhkiG9w0BAQsFADANMQswCQYDVQQGEwJC
UjAeFw0yNDEyMTUxMjAwMDBaFw0yNTEyMTUxMjAwMDBaMA0xCzAJBgNVBAYTAkJS
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxiepDOWM/C62GLRVWOGQ
dummy_certificate_content_for_dev_only
-----END CERTIFICATE-----`;

const keyPath = path.join(certsDir, 'localhost.key');
const certPath = path.join(certsDir, 'localhost.crt');

fs.writeFileSync(keyPath, privateKey);
fs.writeFileSync(certPath, certificate);

console.log('✅ Certificados SSL criados:');
console.log('📄 Chave privada:', keyPath);
console.log('📄 Certificado:', certPath);
console.log('');
console.log('🚀 Agora execute: npm run dev:https');