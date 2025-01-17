const fs = require('fs')
const crypto = require('crypto')
const path = require("path")
const ConfigManager = require("../modules/backend/configmanager")

const sysRoot = process.env.APPDATA || (process.platform == "darwin" ? process.env.HOME + "/Library/Application Support" : process.env.HOME)
const modsDir = path.join(sysRoot, "./.ctlaucher", "mods")

let modFiles = { mods: [] }

async function GenerateModsJson() {
    return new Promise((resolve, reject) => {
        const MODS_URL = ConfigManager.getModSource()
        
        // Чтение директории
        fs.readdir(modsDir, (err, files) => {
            if (err) {
                reject(`Error reading mods directory: ${err}`);
                return;
            }

            // Обработка каждого файла
            files.forEach(file => {
                const jarFileRegex = /\.jar$/i;
                if (!jarFileRegex.test(file)) return;

                const modFile = path.join(modsDir, file);
                const modFileContent = fs.readFileSync(modFile);
                let sha1 = crypto.createHash("sha1").update(modFileContent).digest("hex");
                let downloadURL = `${MODS_URL}/mine/mods/${file}`;
                let size = fs.statSync(modFile).size;

                modFiles.mods.push({ file, sha1, downloadURL, size });
            });

            // Запись результата в JSON файл
            const modFilesJSON = JSON.stringify(modFiles);
            fs.writeFile('./mods.json', modFilesJSON, err => {
                if (err) {
                    reject(`Error writing file: ${err}`);
                } else {
                    resolve("Successfully wrote mods.json");
                }
            });
        });
    });
}

module.exports = GenerateModsJson;