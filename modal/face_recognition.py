# Modal.com - Face Recognition API
# Otimizado para performance ultra-rápida no tablet Vision 7

import modal
from typing import List, Dict, Any, Tuple

# Imports que serão feitos dentro das funções Modal
# (evita erro de validação local)

# Logging será configurado dentro das funções

# Configuração do Modal
app = modal.App("face-recognition-ponto")

# Imagem Docker otimizada com dependências
face_image = (
    modal.Image.debian_slim()
    .pip_install([
        "opencv-python-headless==4.8.1.78",
        "numpy==1.24.3", 
        "pillow==10.0.0",
        "onnxruntime==1.16.0",
        "requests==2.31.0",
        "fastapi==0.103.1",
        "python-multipart==0.0.6"
    ])
    .apt_install(["libglib2.0-0", "libsm6", "libxext6", "libxrender-dev", "libgomp1"])
)

# Volume persistente para cache do modelo
model_volume = modal.Volume.from_name("face-models", create_if_missing=True)

@app.cls(
    image=face_image,
    gpu="T4",  # GPU otimizada para inferência rápida
    volumes={"/models": model_volume},
    timeout=300,
    scaledown_window=180,  # Manter aquecido por 3 minutos
    memory=2048,  # 2GB RAM
)
class FaceRecognition:
    """Classe para reconhecimento facial otimizada para Modal"""
    
    def __enter__(self):
        """Inicializar modelo na GPU"""
        # Imports internos
        import logging
        import numpy as np
        import onnxruntime as ort
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        self.logger.info("🚀 Inicializando FaceRecognition...")
        
        # Download do modelo EdgeFace se não existir
        model_path = "/models/edgeface.onnx"
        if not self._model_exists(model_path):
            self.logger.info("📥 Baixando modelo EdgeFace...")
            self._download_edgeface_model(model_path)
        
        # Configurar ONNX Runtime para GPU
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        self.session = ort.InferenceSession(model_path, providers=providers)
        
        # Pré-aquecer modelo com imagem fake
        self.logger.info("🔥 Pré-aquecendo modelo...")
        fake_input = np.random.randint(0, 255, (112, 112, 3), dtype=np.uint8)
        self._compute_embedding(fake_input)
        
        self.logger.info("✅ FaceRecognition inicializado com sucesso!")
        return self
    
    def _model_exists(self, path: str) -> bool:
        """Verificar se modelo existe no volume"""
        try:
            import os
            return os.path.exists(path) and os.path.getsize(path) > 1000000  # > 1MB
        except:
            return False
    
    def _download_edgeface_model(self, model_path: str):
        """Baixar modelo EdgeFace do seu app Vercel"""
        import os
        import requests
        
        # URL do modelo no seu app Vercel
        model_url = "https://ponto2-0.vercel.app/models/edgeface.onnx"
        
        try:
            self.logger.info(f"📥 Baixando modelo de {model_url}...")
            
            os.makedirs(os.path.dirname(model_path), exist_ok=True)
            
            # Download do modelo
            response = requests.get(model_url, stream=True, timeout=60)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            self.logger.info(f"📊 Tamanho do modelo: {total_size / (1024*1024):.1f}MB")
            
            with open(model_path, 'wb') as f:
                downloaded = 0
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            if downloaded % (1024*1024) == 0:  # Log a cada 1MB
                                self.logger.info(f"📥 Download: {progress:.1f}%")
            
            self.logger.info(f"✅ Modelo baixado com sucesso: {model_path}")
            
        except Exception as e:
            self.logger.error(f"❌ Erro ao baixar modelo: {e}")
            raise
    
    def _preprocess_image(self, image_data: str):
        """Pré-processar imagem base64 para formato EdgeFace"""
        import base64
        import numpy as np
        import cv2
        from PIL import Image
        from io import BytesIO
        
        try:
            # Decodificar base64
            image_bytes = base64.b64decode(image_data.split(',')[-1])
            
            # Converter para PIL Image
            pil_image = Image.open(BytesIO(image_bytes)).convert('RGB')
            
            # Converter para numpy array
            img_array = np.array(pil_image)
            
            # Redimensionar para 112x112 (formato EdgeFace)
            img_resized = cv2.resize(img_array, (112, 112))
            
            # Normalizar [-1, 1]
            img_normalized = (img_resized.astype(np.float32) - 127.5) / 127.5
            
            # Transpor para CHW format
            img_transposed = np.transpose(img_normalized, (2, 0, 1))
            
            # Adicionar batch dimension
            img_batch = np.expand_dims(img_transposed, axis=0)
            
            return img_batch
            
        except Exception as e:
            self.logger.error(f"❌ Erro no pré-processamento: {e}")
            raise ValueError(f"Erro ao processar imagem: {str(e)}")
    
    def _compute_embedding(self, image_array) -> List[float]:
        """Computar embedding usando EdgeFace ONNX"""
        import numpy as np
        
        try:
            # Inferência ONNX
            input_name = self.session.get_inputs()[0].name
            output = self.session.run(None, {input_name: image_array})
            
            # Extrair embedding e normalizar
            embedding = output[0].flatten()
            
            # Normalização L2
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            
            return embedding.tolist()
            
        except Exception as e:
            self.logger.error(f"❌ Erro na computação do embedding: {e}")
            raise ValueError(f"Erro ao computar embedding: {str(e)}")
    
    @modal.method()
    def recognize_face(self, image_data: str) -> Dict[str, Any]:
        """
        Endpoint principal para reconhecimento facial
        
        Args:
            image_data: Imagem em base64 format
            
        Returns:
            Dict com embedding e metadados
        """
        try:
            self.logger.info("🎯 Processando reconhecimento facial...")
            
            # Pré-processar imagem
            processed_image = self._preprocess_image(image_data)
            
            # Computar embedding
            embedding = self._compute_embedding(processed_image)
            
            # Retornar resultado
            result = {
                "success": True,
                "embedding": embedding,
                "embedding_size": len(embedding),
                "model_version": "edgeface_v1.0",
                "processing_time": "computed_on_gpu"
            }
            
            self.logger.info(f"✅ Embedding computado com sucesso! Size: {len(embedding)}")
            return result
            
        except Exception as e:
            self.logger.error(f"❌ Erro no reconhecimento: {e}")
            return {
                "success": False,
                "error": str(e),
                "embedding": None
            }

# Endpoint HTTP FastAPI
@app.function(
    image=face_image,
    timeout=30,
    scaledown_window=300,  # Manter aquecido por 5 minutos
)
@modal.fastapi_endpoint(method="POST", docs=True)
def recognize_face_endpoint(image_data: str):
    """
    Endpoint REST para reconhecimento facial
    
    Body: {"image_data": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."}
    
    Response: {
        "success": true,
        "embedding": [0.123, -0.456, ...],
        "embedding_size": 512
    }
    """
    face_recognizer = FaceRecognition()
    return face_recognizer.recognize_face(image_data)

# Função para deploy e teste
if __name__ == "__main__":
    print("🚀 Iniciando deploy no Modal...")