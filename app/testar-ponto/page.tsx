"use client"

import { TelaRegistrarPonto } from "@/app/registrar-ponto/page"

/**
 * Tela de ponto para testes.
 *
 * É exatamente a mesma tela de /registrar-ponto — mesmo reconhecimento, mesma
 * IA, mesma voz, mesmos emojis, mesmo check-in de humor — reaproveitando o
 * mesmo componente, para as duas nunca saírem de sincronia.
 *
 * A diferença é que aqui não valem as três travas que protegem o ponto real:
 * o cooldown de 60 segundos, o limite de 4 batidas por dia e o diálogo de
 * regularização. Dá para bater ponto sem parar.
 *
 * Por padrão nada é gravado no banco: a barra de controle tem um interruptor
 * para gravar de verdade, desligado, porque teste não pode sujar o registro
 * de ponto de ninguém.
 */
export default function TestarPonto() {
  return <TelaRegistrarPonto modoTeste />
}
