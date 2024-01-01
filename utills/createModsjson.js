const fs = require('fs')
const crypto = require('crypto')
const path = require("path")

const sysRoot = process.env.APPDATA || (process.platform == "darwin" ? process.env.HOME + "/Library/Application Support" : process.env.HOME)
const modsDir = path.join(sysRoot, "./.minecraft", "mods")

let modFiles = { mods: [] }

fs.readdir(modsDir, (err, files) => {
  files.forEach(name => {
    const modFile = path.join(modsDir, name)
    const modFileContent = fs.readFileSync(modFile)
    let sha1 = crypto.createHash("sha1").update(modFileContent).digest("hex")
    let downloadURL = `https://dl.grk.pw/mine/mods/${name}`
    let size = fs.statSync(modFile).size
    modFiles.mods.push({ name, sha1, downloadURL, size })
  })
  const modFilesJSON = JSON.stringify(modFiles);
  fs.writeFile('./utills/mods.json', modFilesJSON, err => {
    if (err) {
      console.log('Error writing file', err)
    } else {
      console.log('Successfully wrote file')
    }
  })
}
)
