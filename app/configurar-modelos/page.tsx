"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Info, AlertCircle } from "lucide-react"

export default function ConfigurarModelos() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader className="bg-primary text-white p-6">
          <div className="flex items-center gap-2">
            <Info className="h-6 w-6" />
            <CardTitle className="text-2xl">Configuração de Modelos Faciais</CardTitle>
          </div>
          <CardDescription className="text-white/80">
            Instruções para instalar os modelos de reconhecimento facial
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-800">Modo de Simulação Ativo</AlertTitle>
            <AlertDescription className="text-blue-700">
              O sistema está funcionando em modo de simulação. Para ativar o reconhecimento facial, siga as instruções
              abaixo.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Instalação dos Modelos</h2>
            <p className="text-gray-700">
              Para que o reconhecimento facial funcione corretamente, você precisa baixar os modelos do face-api.js e
              colocá-los na pasta <code className="bg-gray-100 px-1 rounded">/public/models</code> do seu projeto.
            </p>

            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <h3 className="font-medium text-gray-800 mb-2">Passo 1: Criar a pasta de modelos</h3>
              <p className="text-gray-700 mb-2">Crie a seguinte estrutura de pastas no seu projeto:</p>
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">/public/models/</pre>
            </div>

            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <h3 className="font-medium text-gray-800 mb-2">Passo 2: Baixar os modelos</h3>
              <p className="text-gray-700 mb-2">Baixe os seguintes modelos do repositório oficial do face-api.js:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                <li>tiny_face_detector_model-weights_manifest.json</li>
                <li>tiny_face_detector_model-shard1</li>
                <li>face_landmark_68_model-weights_manifest.json</li>
                <li>face_landmark_68_model-shard1</li>
                <li>face_recognition_model-weights_manifest.json</li>
                <li>face_recognition_model-shard1</li>
                <li>face_recognition_model-shard2</li>
                <li>face_expression_model-weights_manifest.json</li>
                <li>face_expression_model-shard1</li>
              </ul>
              <p className="text-gray-700 mt-2">
                Você pode encontrar esses arquivos no{" "}
                <a
                  href="https://github.com/justadudewhohacks/face-api.js/tree/master/weights"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  repositório oficial do face-api.js
                </a>
                .
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <h3 className="font-medium text-gray-800 mb-2">Passo 3: Instalar a biblioteca</h3>
              <p className="text-gray-700 mb-2">Instale a biblioteca face-api.js usando npm:</p>
              <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">npm install face-api.js</pre>
            </div>

            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <h3 className="font-medium text-gray-800 mb-2">Passo 4: Reiniciar o aplicativo</h3>
              <p className="text-gray-700">
                Após instalar os modelos e a biblioteca, reinicie o aplicativo para que as alterações tenham efeito.
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
            <h3 className="font-medium text-yellow-800 mb-2 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-yellow-600" />
              Alternativa: Script de Download
            </h3>
            <p className="text-yellow-700 mb-2">
              Como alternativa, você pode usar o script{" "}
              <code className="bg-yellow-100 px-1 rounded">scripts/download-essential-models.js</code> incluído no
              projeto para baixar automaticamente os modelos necessários.
            </p>
            <pre className="bg-yellow-100 p-2 rounded text-sm overflow-x-auto">
              node scripts/download-essential-models.js
            </pre>
          </div>

          <div className="flex justify-center pt-4">
            <Button onClick={() => router.push("/")} className="bg-primary hover:bg-primary/90 text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o Início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
