import os
import sys
import torch


def main():
  model_name = os.environ.get("EDGEFACE_MODEL", "edgeface_xs_gamma_06")
  out_path = os.environ.get("OUT_PATH", os.path.join("public", "models", "edgeface.onnx"))

  # Escolher checkpoint local
  models_dir = os.path.join("public", "models")
  local_ckpt = os.path.join(models_dir, f"{model_name}.pt")
  if not os.path.exists(local_ckpt):
    # fallback: se xs não existir, tentar s_gamma_05
    alt = os.path.join(models_dir, "edgeface_s_gamma_05.pt")
    if os.path.exists(alt):
      local_ckpt = alt
      model_name = "edgeface_s_gamma_05"
    else:
      raise FileNotFoundError("Checkpoint .pt não encontrado em public/models")

  # Adicionar repositório cacheado do torch.hub ao sys.path para importar backbones
  hub_repo = os.path.join(os.path.expanduser("~"), ".cache", "torch", "hub", "otroshi_edgeface_main")
  if not os.path.isdir(hub_repo):
    # baixar o código do repo (sem pesos) para popular cache
    print("Baixando código do repositório edgeface para o cache do torch.hub...")
    torch.hub.load('otroshi/edgeface', 'edgeface_xxs', source='github', pretrained=False)
  if hub_repo not in sys.path:
    sys.path.insert(0, hub_repo)

  from backbones import get_model  # type: ignore

  print(f"Construindo arquitetura: {model_name}")
  model = get_model(model_name)
  print(f"Carregando pesos locais: {local_ckpt}")
  state = torch.load(local_ckpt, map_location='cpu')
  model.load_state_dict(state)
  model.eval()

  dummy = torch.randn(1, 3, 112, 112)

  os.makedirs(os.path.dirname(out_path), exist_ok=True)
  print(f"Exportando ONNX para: {out_path}")
  torch.onnx.export(
      model,
      dummy,
      out_path,
      input_names=["input"],
      output_names=["embedding"],
      opset_version=13,
      do_constant_folding=True,
      dynamic_axes=None,
  )
  print("Exportação concluída.")


if __name__ == "__main__":
  main()


