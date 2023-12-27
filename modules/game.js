const gameLogger = require('./logger')('%c[GameLogger]', 'color: #000668; font-weight: bold')
const javaLogger = require('./logger')('%c[JavaLogger]', 'color: #000668; font-weight: bold')

const { Client, Authenticator } = require('minecraft-launcher-core');
const ipc = require("electron").ipcMain
const path = require("path")
const fs = require("fs")
const Axios = require("axios")

const ConfigManager = require("./configmanager")
const main = require('../launcher')

exports.init = () => {
    ipc.on("play", () => play())
}

function setUpdateText(message) {
    main.win.webContents.send("set-update-text", message)
}
function setUpdateProgress(progress) {
    main.win.webContents.send("set-update-progress", progress)
}

function play() {

    downloadForge().then(async () => {

        const launcher = new Client();

        let opts = {
            authorization: Authenticator.getAuth(ConfigManager.getUsername()),
            root: ConfigManager.getGameDirectory(),
            version: {
                number: main.MC_VERSION,
                type: "release"
            },
            memory: {
                max: ConfigManager.getMaxRAM(),
                min: ConfigManager.getMinRAM()
            },
            javaPath: "C:/Program Files/Java/jdk-21/bin/java",
            forge: main.FORGE_VERSION ? path.join(ConfigManager.getGameDirectory(), `forge-${main.MC_VERSION}-${main.FORGE_VERSION}-installer.jar`) : null
        }
        //GAME LAUNCH
        launcher.launch(opts)

        launcher.on('debug', (e) => gameLogger.log(e));
        launcher.on('data', (e) => gameLogger.log(e));

        launcher.on("arguments", () => {
            setTimeout(() => {
                main.win.close()
            }, 3000)
        })

    })
}

function downloadForge() {
    return new Promise(async (resolve, reject) => {

        try {

            if (!main.FORGE_VERSION) {
                resolve()
            }
            setUpdateText("DownloadingForge")
            gameLogger.log("Downloading Forge...")
            const forgeInstallerFile = path.join(ConfigManager.getGameDirectory(), `forge-${main.MC_VERSION}-${main.FORGE_VERSION}-installer.jar`)
            const forgeInstallerURL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${main.MC_VERSION}-${main.FORGE_VERSION}/forge-${main.MC_VERSION}-${main.FORGE_VERSION}-installer.jar`

            let res = await Axios.head(forgeInstallerURL)
            if (!fs.existsSync(forgeInstallerFile) || fs.statSync(forgeInstallerFile).size !== parseInt(res.headers["content-length"])) {
                const { data, headers } = await Axios({
                    url: forgeInstallerURL,
                    method: 'GET',
                    responseType: 'stream'
                })
                const totalLength = headers['content-length']
                let receivedBytes = 0
                const writer = fs.createWriteStream(forgeInstallerFile)
                data.on('data', (chunk) => {
                    receivedBytes += chunk.length
                    setUpdateText("DownloadingForge")

                    setUpdateProgress((100.0 * receivedBytes / totalLength).toFixed(0))
                })
                data.pipe(writer)
                writer.on('error', err => {
                    gameLogger.error(err.message)
                    main.win.webContents.send("update-error", "ForgeError", err.message)
                    reject()
                })

                data.on('end', async function () {
                    if (fs.statSync(forgeInstallerFile).size == totalLength) {
                        setUpdateText("Forge was successfully downloaded!")
                        gameLogger.log("Forge was successfully downloaded!")
                        resolve()
                    }
                    else {
                        reject()

                    }
                })

            }
            else {
                setUpdateText("Forge Checked")
                gameLogger.log("Forge installer is already installed")
                resolve()
            }

        } catch (err) {
            gameLogger.error(err.message)
            main.win.webContents.send("update-error", "ForgeError", err.message)
            reject()

        }
    })

}
