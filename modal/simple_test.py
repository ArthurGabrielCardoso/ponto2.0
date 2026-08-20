"""
Versão de teste simples para verificar se Modal funciona
"""
import modal

app = modal.App("face-test")

# Imagem com FastAPI
image = modal.Image.debian_slim().pip_install("fastapi")

@app.function(image=image)
@modal.fastapi_endpoint(method="POST")  
def test_endpoint(message: str = "Hello"):
    """Endpoint de teste simples"""
    return {
        "success": True,
        "message": f"Modal funcionando! Recebido: {message}",
        "status": "OK"
    }

if __name__ == "__main__":
    print("Deploy de teste...")