import fs from "fs"
import path from "path"
import https from "https"
import { fileURLToPath } from "url"

// Obter o diretório atual
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Criar o diretório de modelos
const modelsDir = path.join(__dirname, "..", "public", "models")

// Criar o diretório se não existir
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true })
  console.log(`Diretório criado: ${modelsDir}`)
}

// Definir apenas os modelos essenciais que estamos usando
const ESSENTIAL_MODELS = [
  // Modelo de detecção facial (SSD MobileNet)
  {
    name: "ssd_mobilenetv1_model-weights_manifest.json",
    url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-weights_manifest.json",
  },
  {
    name: "ssd_mobilenetv1_model-shard1",
    url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard1",
  },
  {
    name: "ssd_mobilenetv1_model-shard2",
    url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard2",
  },

  // Modelo de pontos de referência facial (landmarks)
  {
    name: "face_landmark_68_model-weights_manifest.json",
    url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json",
  },
  {
    name: "face_landmark_68_model-shard1",
    url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1",
  },

  // Modelo de reconhecimento facial
  {
    name: "face_recognition_model-weights_manifest.json",
    url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-weights_manifest.json",
  },
  {
    name: "face_recognition_model-shard1",
    url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard1",
  },
  {
    name: "face_recognition_model-shard2",
    url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard2",
  },

  // Modelo de expressão facial (para detectar o sorriso)
  {
    name: "face_expression_model-weights_manifest.json",
    url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-weights_manifest.json",
  },
  {
    name: "face_expression_model-shard1",
    url: "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_expression_model-shard1",
  },
]

// Função para baixar um arquivo
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath)

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Falha ao baixar ${url}: ${response.statusCode}`))
          return
        }

        response.pipe(file)

        file.on("finish", () => {
          file.close()
          resolve()
        })

        file.on("error", (err) => {
          fs.unlink(filePath, () => {}) // Excluir o arquivo em caso de erro
          reject(err)
        })
      })
      .on("error", (err) => {
        fs.unlink(filePath, () => {}) // Excluir o arquivo em caso de erro
        reject(err)
      })
  })
}

// Baixar todos os modelos essenciais
async function downloadEssentialModels() {
  console.log("Iniciando download dos modelos essenciais do face-api.js...")

  for (const model of ESSENTIAL_MODELS) {
    const filePath = path.join(modelsDir, model.name)

    try {
      console.log(`Baixando ${model.name}...`)
      await downloadFile(model.url, filePath)
      console.log(`Download de ${model.name} concluído com sucesso!`)
    } catch (error) {
      console.error(`Erro ao baixar ${model.name}:`, error.message)
    }
  }

  console.log("\nDownload concluído!")
  console.log(`Os modelos foram salvos em: ${modelsDir}`)
  console.log("\nVerifique se os seguintes arquivos estão presentes na pasta:")
  ESSENTIAL_MODELS.forEach((model) => console.log(`- ${model.name}`))
}

// Executar o download
downloadEssentialModels()
