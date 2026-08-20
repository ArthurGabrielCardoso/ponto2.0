# 🚀 Modal.com Face Recognition Setup

## Configuração Inicial

### 1. Instalar Modal
```bash
pip install modal
```

### 2. Fazer Login
```bash
modal token new
```
Siga as instruções no browser que abrir.

### 3. Copiar seu modelo
```bash
# Copiar o modelo edgeface.onnx para um local acessível
# Opção 1: GitHub Releases
# Opção 2: Google Drive/Dropbox público  
# Opção 3: AWS S3 público

# Atualizar a URL em face_recognition.py linha 68
```

### 4. Deploy
```bash
cd modal/
python deploy.py
```

### 5. Configurar URL no Next.js
```bash
# Adicionar no .env.local:
NEXT_PUBLIC_MODAL_API_URL=https://SEU_USERNAME--face-recognition-ponto-recognize-face-endpoint.modal.run
```

## Estrutura

```
modal/
├── face_recognition.py  # Código principal Modal
├── deploy.py           # Script de deploy
├── requirements.txt    # Dependências Python
└── README.md          # Esta documentação
```

## API Endpoint

**URL:** `https://SEU_USERNAME--face-recognition-ponto-recognize-face-endpoint.modal.run`

**Method:** POST

**Body:**
```json
{
  "image_data": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Response:**
```json
{
  "success": true,
  "embedding": [0.123, -0.456, 0.789, ...],
  "embedding_size": 512,
  "model_version": "edgeface_v1.0"
}
```

## Performance Esperada

- **Cold start:** ~2-3s (primeira execução)  
- **Warm instance:** ~300-500ms
- **Concurrent requests:** Até 10 instâncias paralelas
- **GPU:** NVIDIA T4 (muito mais rápido que tablet)

## Custos Estimados

Para 3000 reconhecimentos/mês:
- **Compute:** ~$8-12
- **GPU time:** ~$5-8  
- **Requests:** ~$2-3
- **Total:** ~$15-23/mês

**Free tier:** $30/mês de créditos grátis = suficiente para começar!

## Troubleshooting

### Erro de autenticação
```bash
modal token new
```

### Modelo não encontra
Verificar URL do download em `_download_edgeface_model()`

### Timeout
Aumentar `timeout` e `container_idle_timeout` na função Modal

### Performance lenta
- Verificar se está usando GPU (`gpu="T4"`)
- Verificar warm instances (`container_idle_timeout=180`)
- Pré-aquecer modelo no `__enter__`