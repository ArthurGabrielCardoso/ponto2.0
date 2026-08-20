// Copy TFJS WASM backend binaries to public/tfjs-wasm for the face-worker.
const fs = require("fs")
const path = require("path")

const srcDir = path.join(__dirname, "..", "node_modules", "@tensorflow", "tfjs-backend-wasm", "dist")
const destDir = path.join(__dirname, "..", "public", "tfjs-wasm")

const filesToCopy = [
    "tfjs-backend-wasm.wasm",
    "tfjs-backend-wasm-simd.wasm",
    "tfjs-backend-wasm-threaded-simd.wasm",
]

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function run() {
    ensureDir(destDir)
    let copied = 0
    for (const f of filesToCopy) {
        const src = path.join(srcDir, f)
        const dest = path.join(destDir, f)
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest)
            copied++
        }
    }
    console.log(`TFJS WASM binaries copied to ${destDir} (${copied}/${filesToCopy.length})`)
}

run()
