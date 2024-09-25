import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const source = path.resolve(__dirname, "src/sql")
const destination = path.resolve(__dirname, "build/src/sql")

function copyFolderSync(from, to) {
  fs.mkdirSync(to, { recursive: true })
  
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element)
    const toPath = path.join(to, element)
    if (fs.lstatSync(fromPath).isFile()) {
      fs.copyFileSync(fromPath, toPath)
    } else {
      copyFolderSync(fromPath, toPath)
    }
  })
}

copyFolderSync(source, destination)
console.log(`Copied SQL files from ${source} to ${destination}`)
