const gameLogger = require('./logger')('%c[GameLogger]', 'color: #000668; font-weight: bold')
const javaLogger = require('./logger')('%c[JavaLogger]', 'color: #000668; font-weight: bold')

const { Client, Authenticator } = require('minecraft-launcher-core');
const ipc = require("electron").ipcMain
const path = require("path")
const fs = require("fs")
const Axios = require("axios")
const AdmZip = require("adm-zip")
const crypto = require("crypto")

const ConfigManager = require("./configmanager")
const main = require('../../../launcher')

exports.init = () => {
    ipc.on("play", () => play())
}

function setUpdateText(message) {
    main.win.webContents.send("set-update-text", message)
}
function setUpdateProgress(progress) {
    main.win.webContents.send("set-update-progress", progress)
}

function updateError(message) {
    main.win.webContents.send("launcher-update-error", message)
}

function play() {
    checkJavaInstallation().then((jre = null) => {
        updateAndLaunch(jre)
    }).catch(() => {
        const jrePath = path.join(ConfigManager.getGameDirectory(), "jre")
        if (!fs.existsSync(jrePath)) {
            fs.mkdirSync(jrePath, { recursive: true })
        }

        if (process.platform === "win32") {
            downloadJava(main.JRE_WINDOWS, path.join(jrePath, "jre-windows.zip"), jrePath)
        } else if (process.platform === "darwin") {
            downloadJava(main.JRE_OSX, path.join(jrePath, "jre-osx.zip"), jrePath)
        }
        else {
            downloadJava(main.JRE_LINUX, path.join(jrePath, "jre-linux.zip"), jrePath)
        }

    })
}

async function updateAndLaunch(jre = null) {

    downloadForge().then(async () => {
        const modsDownloaded = await downloadMods()

        if (modsDownloaded) {
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
                customArgs: ConfigManager.getVrPrefix() ? [ ConfigManager.isVrPrefixEnabled() ] : [],
                javaPath: jre ? path.join(jre, "bin", process.platform === "win32" ? "java.exe" : "java") : null,
                forge: main.FORGE_VERSION ? path.join(ConfigManager.getGameDirectory(), `forge-${main.MC_VERSION}-${main.FORGE_VERSION}-installer.jar`) : null,
                server: "multiplayer"
            }
            const analyseMod = await analyseMods()
            if (!analyseMod) return updateError('Дима пошел нахуй!!!')
            //GAME LAUNCH
            launcher.launch(opts).then(() => {
                setUpdateProgress(100)
                setUpdateText("LaunchingGame");
                setTimeout(() => {
                    main.win.close()
                }, 3000)
            })

            launcher.on('debug', (e) => gameLogger.log(e));
            launcher.on('data', (e) => gameLogger.log(e));

            // launcher.on("arguments", () => {
            //     setUpdateProgress(100)
            //     setUpdateText("LaunchingGame");
            //     analyseMods();
            //     setTimeout(() => {
            //         main.win.close()
            //     }, 3000)
            // })
        }
    })
}

function checkJavaInstallation() {
    return new Promise((resolve, reject) => {
        setUpdateText("AnalyzingJava")
        const jrePath = path.join(ConfigManager.getGameDirectory(), "jre")
        if (process.platform == "win32") {
            jreInstallationFile = path.join(jrePath, "jre-windows.zip")
        } else if (process.platform == "darwin") {
            jreInstallationFile = path.join(jrePath, "jre-osx.zip")
        } else {
            jreInstallationFile = path.join(jrePath, "jre-linux.zip")
        }

        if (fs.existsSync(jreInstallationFile)) {
            fs.unlink(jreInstallationFile, (err) => {
                if (err) {
                    console.error(err)
                }
                return reject()
            })
        }

        var spawn = require("child_process").spawn("java", ["-version"])
        spawn.on("error", function (err) {
            if (fs.existsSync(jrePath) && fs.readdirSync(jrePath).length !== 0) {
                return resolve(jrePath)
            }
            else {
                javaLogger.log("No java installation found!")
                return reject()
            }

        })
        spawn.stderr.on("data", function (data) {
            if (process.platform == "darwin" && !!data) {
                return resolve()
            }
            if (data.toString().includes("64") && data.toString().includes("17.0")) {
                data = data.toString().split("\n")[0]
                var javaVersion = new RegExp('java version').test(data) ? data.split(" ")[2].replace(/"/g, "") : false;
                if (javaVersion != false) {
                    javaLogger.log("Java " + javaVersion + " is already installed")
                    return resolve()
                } else {
                    if (fs.existsSync(jrePath) && fs.readdirSync(jrePath).length !== 0) {
                        return resolve(jrePath)
                    }
                    else {
                        javaLogger.log("No java installation found!")
                        return reject()
                    }
                }
            }
            else {
                if (fs.existsSync(jrePath) && fs.readdirSync(jrePath).length !== 0) {
                    return resolve(jrePath)
                }
                else {
                    javaLogger.log("No java installation found!")
                    return reject()
                }

            }
        })
    })
}

async function downloadJava(fileURL, targetPath, jrePath) {
    try {
        gameLogger.log("Downloading Java...")
        setUpdateText("DownloadingJava")

        const { data, headers } = await Axios({
            url: fileURL,
            method: 'GET',
            responseType: 'stream'
        })
        const totalLength = headers['content-length']
        let receivedBytes = 0
        const writer = fs.createWriteStream(targetPath)
        data.on('data', (chunk) => {
            receivedBytes += chunk.length
            setUpdateText("DownloadingJava")

            setUpdateProgress((100.0 * receivedBytes / totalLength).toFixed(0))
        })
        data.pipe(writer)
        writer.on('error', err => {
            javaLogger.error(err.message)
            updateError("JavaError: " + err.message)
        })
        writer.on('close', async function () {
            let res = await Axios.head(fileURL)
            if (fs.statSync(targetPath).size === parseInt(res.headers["content-length"])) {
                javaLogger.log("Java installation successfully downloaded!")
                let zip = new AdmZip(targetPath)
                javaLogger.log("Extracting java!")
                setUpdateText("ExtractingJava")
                zip.extractAllTo(jrePath, true)
                javaLogger.log("Java was successfully extracted!")
                fs.unlink(targetPath, (err) => {
                    if (err) {
                        javaLogger.error(err.message)
                        return
                    }
                    javaLogger.log("Java installation file was successfully removed!")
                })
                updateAndLaunch(jrePath)
            }
            else {
                javaLogger.error("Error while downloading java!")
                updateError("JavaError: " + "")
            }

        })
    } catch (err) {
        javaLogger.error(err.message)
        updateError("JavaError: " + err.message)

    }
}

function downloadForge() {
    return new Promise(async (resolve, reject) => {

        try {

            if (!main.FORGE_VERSION) {
                resolve()
            }
            setUpdateText("Checking Forge")
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
                    updateError("ForgeError: " + err.message)
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
                gameLogger.log("Forge installer is already installed")
                resolve()
            }

        } catch (err) {
            gameLogger.error(err.message)
            updateError("ForgeError: " + err.message)
            reject()

        }
    })

}

let totalModsSize = 0
let currentModsSize = 0


async function downloadMods() {
    if (main.MODS_URL) {
        try {
            setUpdateText("Checking mods")
            gameLogger.log("Downloading Mods...")
            const modsDir = path.join(ConfigManager.getGameDirectory(), "mods")
            if (!fs.existsSync(modsDir)) {
                fs.mkdirSync(modsDir)
            }

            const response = await Axios.get(main.MODS_URL)

            for (let i = 0; i < response.data.mods.length; i++) {
                const modFile = path.join(modsDir, response.data.mods[i].name)
                if (fs.existsSync(modFile)) {
                    const modFileContent = fs.readFileSync(modFile)
                    let modSha1 = crypto.createHash("sha1").update(modFileContent).digest("hex")
                    if (modSha1 !== response.data.mods[i].sha1) {
                        fs.unlinkSync(modFile)
                        totalModsSize += response.data.mods[i].size
                    }
                    else {
                        continue
                    }
                }
                else {
                    totalModsSize += response.data.mods[i].size
                }
            }

            for (let i = 0; i < response.data.mods.length; i++) {
                const modFile = path.join(modsDir, response.data.mods[i].name)
                if (fs.existsSync(modFile)) {
                    const modFileContent = fs.readFileSync(modFile)
                    let modSha1 = crypto.createHash("sha1").update(modFileContent).digest("hex")
                    if (modSha1 !== response.data.mods[i].sha1) {
                        fs.unlinkSync(modFile)
                        await downloadMod(response.data.mods[i].downloadURL, modFile, response.data.mods[i].size)
                        gameLogger.log(`${response.data.mods[i].name} was successfully downloaded!`)
                    }
                    else {
                        continue
                    }
                }
                else {
                    await downloadMod(response.data.mods[i].downloadURL, modFile, response.data.mods[i].size)
                    gameLogger.log(`${response.data.mods[i].name} was successfully downloaded!`)
                }
            }
            return true
        }
        catch (err) {
            gameLogger.error(err?.message)
            updateError("ModsError: " + err?.message)
            return false
        }
    }

}

async function analyseMods() {
    try {

        const modsDir = path.join(ConfigManager.getGameDirectory(), "mods")
        if (!fs.existsSync(modsDir)) {
            fs.mkdirSync(modsDir)
        }
        const response = await Axios.get(main.MODS_URL)
        fs.readdirSync(modsDir).forEach(file => {
            let sha1Array = []
            for (let i = 0; i < response.data.mods.length; i++) {
                sha1Array.push(response.data.mods[i].sha1)
            }
            const modFileContent = fs.readFileSync(path.join(modsDir, file))
            let modSha1 = crypto.createHash("sha1").update(modFileContent).digest("hex")
            if (!sha1Array.includes(modSha1)) {
                fs.unlinkSync(path.join(modsDir, file))
            }
       })

       return true

    }
    catch (err) {
        gameLogger.error(err.message)
        updateError("ModsError: " + err.message)
    }
}

async function downloadMod(fileURL, targetPath, modSize) {
    return new Promise(async (resolve, reject) => {

        try {
            const { data } = await Axios({
                url: fileURL,
                method: 'GET',
                responseType: 'stream'
            })
            //const totalLength = headers['content-length']
            const writer = fs.createWriteStream(targetPath)
            data.on('data', (chunk) => {
                currentModsSize += chunk.length
                setUpdateText("DownloadingMods")
                setUpdateProgress((100 * currentModsSize / totalModsSize).toFixed(0))
            })
            data.pipe(writer)
            writer.on('error', err => {
                gameLogger.error(err?.message)
                updateError("ModsError: " + err?.message)
                reject()
            })

            writer.on('close', () => {
                if (fs.statSync(targetPath).size == modSize) {
                    resolve()
                }
                else {
                    reject()
                }
            })

        } catch (err) {
            updateError(`ModsError: ${err?.message} = ${fileURL}`)
            console.error(err)
        }
    })
}
