#!/usr/bin/env node
/**
 * Recupera a árvore de arquivos de um deploy feito via `vercel --prod` (CLI).
 * Deploys vindos de push do Git NÃO guardam a árvore; os da CLI guardam.
 *
 * Uso:
 *   VERCEL_TOKEN=xxx node scripts/recover-vercel-source.mjs [--out DIR] [--deploy dpl_xxx]
 *
 * Sem dependências: fetch nativo (Node >= 18).
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const TOKEN = process.env.VERCEL_TOKEN
if (!TOKEN) {
  console.error('ERRO: defina VERCEL_TOKEN no ambiente (não hardcode o token no arquivo).')
  process.exit(1)
}

const TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_OUCaXmWUPRBbis4OuKl211Wx'

// Candidatos em ordem de preferência (todos com gitDirty:1).
const DEPLOYS = [
  'dpl_H6FsoEivP4wLgSPonxgm4FHQkho7', // 13/04/2026, production, READY
  'dpl_7pNx8hFNoDh5KgM9CcGFiGTsHhsq', // 13/04/2026 18:39
  'dpl_8Uh12dM3NKvH1zP8nuC1fkxwNxBw', // 10/04/2026 16:45
  'dpl_FRLJfSQ2xTxoFsurNN6MyH97E1Gi', // 09/04/2026 17:37
  'dpl_AfXKr9wUN5NAmWbyqrpP3wY65WiC', // 09/03/2026 12:00
]

const SKIP_DIRS = new Set(['node_modules', '.next', '.vercel', '.git', 'dist', '.turbo'])
const CONCURRENCY = 8

const args = process.argv.slice(2)
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined }
const OUT_DIR = argOf('--out') || 'recovered'
const ONLY_DEPLOY = argOf('--deploy')

const api = (path) => {
  const sep = path.includes('?') ? '&' : '?'
  return fetch(`https://api.vercel.com${path}${sep}teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
}

/** Baixa a árvore recursiva do deploy. Retorna null se indisponível. */
async function fetchTree(deploymentId) {
  const res = await api(`/v6/deployments/${deploymentId}/files`)
  if (!res.ok) {
    console.log(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
    return null
  }
  return res.json()
}

const skipped = []

/** Achata a árvore em uma lista de {path, uid}, pulando diretórios ignorados. */
function flatten(nodes, prefix = '', out = []) {
  for (const node of nodes || []) {
    const path = prefix ? `${prefix}/${node.name}` : node.name
    if (node.type === 'directory') {
      if (SKIP_DIRS.has(node.name)) continue
      flatten(node.children, path, out)
    } else if (node.type === 'file') {
      out.push({ path, uid: node.uid, type: node.type })
    } else if (node.type === 'lambda') {
      // lambda é saída de build, não fonte: não tem conteúdo baixável pela API
      skipped.push(path)
    }
    // symlink / invalid: sem conteúdo útil
  }
  return out
}

/**
 * Conteúdo do arquivo. A API responde ora JSON {"data":"<base64>"}, ora texto cru.
 * Se v8 falhar com 400/410, cai para v7 e depois v6.
 */
async function fetchFile(deploymentId, file) {
  const qs = `?path=${encodeURIComponent(file.path)}`
  let lastErr = 'sem tentativa'

  for (const version of ['v8', 'v7', 'v6']) {
    const res = await api(`/${version}/deployments/${deploymentId}/files/${file.uid}${qs}`)

    if (res.status === 400 || res.status === 410) {
      lastErr = `HTTP ${res.status} (${version})`
      continue
    }
    if (!res.ok) {
      lastErr = `HTTP ${res.status} (${version}) ${(await res.text()).slice(0, 200)}`
      continue
    }

    const raw = await res.text()

    // Caso 1: JSON com { data: base64 }
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.data === 'string') return Buffer.from(parsed.data, 'base64')
      } catch {
        // não era JSON de verdade — segue como texto cru
      }
    }

    // Caso 2: texto/binário cru
    return Buffer.from(raw, 'utf8')
  }

  throw new Error(lastErr)
}

/** Pool simples de N workers sobre uma fila. */
async function pool(items, limit, worker) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) await worker(items[cursor++])
  })
  await Promise.all(runners)
}

async function main() {
  const candidates = ONLY_DEPLOY ? [ONLY_DEPLOY] : DEPLOYS

  let deploymentId = null
  let tree = null
  for (const id of candidates) {
    process.stdout.write(`Tentando arvore de ${id}... `)
    tree = await fetchTree(id)
    if (tree) { console.log('ok'); deploymentId = id; break }
  }

  if (!tree) {
    console.error('\nNenhum deploy retornou arvore de arquivos.')
    process.exit(1)
  }

  const files = flatten(tree)
  console.log(`\n${files.length} arquivos a baixar de ${deploymentId} -> ${OUT_DIR}/`)
  if (skipped.length) console.log(`(${skipped.length} lambdas ignorados: saida de build, nao fonte)`)
  console.log('')

  let done = 0
  const failures = []

  await pool(files, CONCURRENCY, async (file) => {
    const dest = join(OUT_DIR, file.path)
    try {
      const buf = await fetchFile(deploymentId, file)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, buf)
      done++
      if (done % 25 === 0) console.log(`  ...${done}/${files.length}`)
    } catch (err) {
      failures.push({ path: file.path, error: String(err.message || err) })
      console.log(`  [falhou] ${file.path}: ${err.message || err}`)
    }
  })

  console.log(`\nConcluido: ${done} ok, ${failures.length} falharam.`)
  if (failures.length) {
    await writeFile(join(OUT_DIR, '_falhas.json'), JSON.stringify(failures, null, 2))
    console.log(`Lista de falhas em ${OUT_DIR}/_falhas.json`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
