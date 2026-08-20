// Copy essential MediaPipe FaceMesh assets to public so locateFile can load them without CDN
const fs = require("fs")
const path = require("path")

const srcDir = path.join(__dirname, "..", "node_modules", "@mediapipe", "face_mesh")
const destDir = path.join(__dirname, "..", "public", "mediapipe", "face_mesh")

const filesToCopy = [
    "face_mesh.js",
    "face_mesh.binarypb",
    "face_mesh_solution_packed_assets_loader.js",
    "face_mesh_solution_packed_assets.data",
    "face_mesh_solution_simd_wasm_bin.js",
    "face_mesh_solution_simd_wasm_bin.wasm",
    "face_mesh_solution_simd_wasm_bin.data",
    "face_mesh_solution_wasm_bin.js",
    "face_mesh_solution_wasm_bin.wasm",
]

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function copyFileSafe(src, dest) {
    if (!fs.existsSync(src)) return
    fs.copyFileSync(src, dest)
}

function run() {
    ensureDir(destDir)
    let copied = 0
    for (const f of filesToCopy) {
        const src = path.join(srcDir, f)
        const dest = path.join(destDir, f)
        try {
            copyFileSafe(src, dest)
            copied++
        } catch (e) {
            // ignore individual copy errors
        }
    }
    console.log(`MediaPipe FaceMesh assets copied to ${destDir} (${copied}/${filesToCopy.length})`)
}

run()


