# 🚀 Guia de Configuração - AWS Rekognition

## ✅ INSTALAÇÃO COMPLETA

Todos os arquivos foram criados com sucesso! ✨

---

## 📋 ARQUIVOS CRIADOS

### **Biblioteca AWS:**
- ✅ `lib/aws-rekognition.ts` - Integração com AWS Rekognition

### **API Routes:**
- ✅ `app/api/aws/init/route.ts` - Inicializar Collection
- ✅ `app/api/aws/identify/route.ts` - Identificar funcionário
- ✅ `app/api/aws/add-person/route.ts` - Cadastrar funcionário
- ✅ `app/api/aws/update-person/route.ts` - Atualizar fotos

### **Types:**
- ✅ `lib/types.ts` - Atualizado com `aws_face_ids`

### **Arquivos Azure removidos:**
- ❌ `lib/azure-face-api.ts` (deletado)
- ❌ `app/api/azure/*` (deletado)
- ❌ `AZURE_INTEGRATION_GUIDE.md` (deletado)

---

## 🔐 CONFIGURAÇÃO - PASSO 1: Variáveis de Ambiente

Edite o arquivo `.env.local` (ou crie se não existir) e adicione:

```env
# Supabase (mantenha as existentes)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima-aqui

# AWS Rekognition (ADICIONE ESTAS)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA****************
AWS_SECRET_ACCESS_KEY=wJal********************************
AWS_REKOGNITION_COLLECTION_ID=ponto-funcionarios
```

### **Onde pegar as credenciais:**

1. **AWS_REGION**:
   - Veja no canto superior direito do console AWS
   - Exemplos: `us-east-1` (N. Virginia) ou `sa-east-1` (São Paulo)

2. **AWS_ACCESS_KEY_ID** e **AWS_SECRET_ACCESS_KEY**:
   - Você copiou quando criou o usuário IAM
   - Se perdeu, crie uma nova Access Key:
     - IAM → Users → Controle-de-ponto → Security credentials → Create access key

3. **AWS_REKOGNITION_COLLECTION_ID**:
   - Use: `ponto-funcionarios` (já configurado)

---

## 🗄️ PASSO 2: Criar Collection no AWS Rekognition

### **Via Browser:**

Acesse:
```
http://localhost:3000/api/aws/init
```

**Resposta esperada:**
```json
{
  "success": true,
  "configured": true,
  "message": "Collection criada com sucesso",
  "totalFaces": 0,
  "collectionId": "ponto-funcionarios"
}
```

### **Via Terminal (alternativo):**

```bash
curl http://localhost:3000/api/aws/init
```

---

## 🧪 PASSO 3: Testar Identificação

### **Teste 1: Verificar se está funcionando**

```bash
curl -X POST http://localhost:3000/api/aws/identify \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "threshold": 80
  }'
```

**Resposta esperada (sem funcionários cadastrados):**
```json
{
  "success": false,
  "faceDetected": true,
  "error": "Nenhum funcionário reconhecido"
}
```

---

## 👤 COMO USAR AS APIs

### **1. Cadastrar Funcionário** (via API)

**Endpoint:** `POST /api/aws/add-person`

**Body:**
```json
{
  "nome": "João Silva",
  "fotos": [
    "base64_foto_1",
    "base64_foto_2",
    "base64_foto_3"
  ],
  "cargaHorariaDiaria": 480,
  "horarios": {
    "segunda": {
      "entrada": "08:00",
      "saida_almoco": "12:00",
      "retorno_almoco": "13:00",
      "saida": "17:00",
      "ativo": true
    }
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Funcionário João Silva cadastrado com sucesso!",
  "funcionarioId": "abc123-def456",
  "fotosAdicionadas": 3,
  "fotosTotais": 3,
  "faceIds": ["face-id-1", "face-id-2", "face-id-3"]
}
```

---

### **2. Identificar Funcionário** (via API)

**Endpoint:** `POST /api/aws/identify`

**Body:**
```json
{
  "imageBase64": "base64_da_imagem",
  "threshold": 80
}
```

**Resposta (sucesso):**
```json
{
  "success": true,
  "faceDetected": true,
  "funcionario": {
    "id": "abc123-def456",
    "nome": "João Silva",
    "similarity": 98.5,
    "confidence": 0.985
  }
}
```

**Resposta (não reconhecido):**
```json
{
  "success": false,
  "faceDetected": true,
  "error": "Nenhum funcionário reconhecido"
}
```

---

### **3. Atualizar Fotos** (via API)

**Endpoint:** `POST /api/aws/update-person`

**Body:**
```json
{
  "funcionarioId": "abc123-def456",
  "fotos": [
    "base64_nova_foto_1",
    "base64_nova_foto_2"
  ]
}
```

---

## 🔧 INTEGRAÇÃO COM FRONTEND (FUTURO)

### **Exemplo: Adaptar `/registrar-ponto/page.tsx`**

```typescript
// ANTES (local)
const embedding = await computeEmbedding(video, bbox, models.edgeFaceSession)
const match = findBestMatchKnnAdvanced(embedding, funcionarios, 5)

// DEPOIS (AWS)
// 1. Capturar frame
const canvas = document.createElement('canvas')
canvas.width = video.videoWidth
canvas.height = video.videoHeight
const ctx = canvas.getContext('2d')
ctx.drawImage(video, 0, 0)
const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]

// 2. Chamar API AWS
const response = await fetch('/api/aws/identify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageBase64, threshold: 80 })
})

const result = await response.json()

if (result.success) {
  console.log('Funcionário:', result.funcionario.nome)
  console.log('Similaridade:', result.funcionario.similarity)

  // Registrar ponto
  await registrarPonto(result.funcionario.id, result.funcionario.nome)
}
```

---

## 💰 CUSTOS AWS

### **Free Tier (Permanente):**
- ✅ **5.000 imagens/mês** - GRÁTIS
- ✅ **1.000 rostos armazenados** - GRÁTIS (primeiro mês)

### **Depois do Free Tier:**
- Detecção: **$1 por 1.000 imagens**
- Armazenamento: **$0.01 por 1.000 rostos/mês**

### **Seu uso estimado (312 reconhecimentos/mês):**
- **CUSTO: $0/mês** (dentro do free tier!)

---

## 🐛 TROUBLESHOOTING

### **Erro: "AWS Rekognition não configurado"**

**Solução:**
1. Verifique se `.env.local` tem as 4 variáveis AWS
2. Reinicie o servidor: `npm run dev`

---

### **Erro: "Collection não existe"**

**Solução:**
```bash
curl http://localhost:3000/api/aws/init
```

---

### **Erro: "Nenhum rosto detectado"**

**Causas:**
- Imagem muito escura
- Rosto muito pequeno
- Imagem de baixa qualidade

**Soluções:**
- Melhorar iluminação
- Aumentar resolução mínima (640x480)
- Aproximar câmera

---

### **Erro: "Nenhum funcionário reconhecido"**

**Causas:**
- Similaridade abaixo do threshold (80%)
- Funcionário não cadastrado
- Fotos de cadastro ruins

**Soluções:**
- Reduzir `threshold` para 70-75
- Cadastrar mais fotos (5-10)
- Usar fotos de alta qualidade

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [x] Instalar `@aws-sdk/client-rekognition`
- [x] Criar `lib/aws-rekognition.ts`
- [x] Criar API routes `/api/aws/*`
- [x] Remover arquivos Azure
- [x] Atualizar `lib/types.ts`
- [ ] Configurar `.env.local` com credenciais AWS
- [ ] Testar `/api/aws/init`
- [ ] Cadastrar funcionário de teste
- [ ] Testar identificação
- [ ] (Futuro) Adaptar frontend para usar AWS APIs

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Configure o `.env.local` com suas credenciais
2. ✅ Reinicie o servidor: `npm run dev`
3. ✅ Teste a Collection: `http://localhost:3000/api/aws/init`
4. ✅ Cadastre um funcionário (via API ou frontend)
5. ✅ Teste o reconhecimento

---

**Sistema AWS Rekognition instalado com sucesso! 🎉**

Se tiver dúvidas, consulte este guia ou a documentação oficial da AWS.
