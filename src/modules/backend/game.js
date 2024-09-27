const { Client, Authenticator } = require('minecraft-launcher-core');
const ipc = require("electron").ipcMain
const path = require("path")
const fs = require("fs")
const Axios = require("axios")
const AdmZip = require("adm-zip")
const crypto = require("crypto")

const ConfigManager = require("./configmanager")
const main = require('../../../launcher')

const gameLogger = require('./logger')('%c[GameLogger]', 'color: #000668; font-weight: bold')
const javaLogger = require('./logger')('%c[JavaLogger]', 'color: #000668; font-weight: bold')
gameLogger.setWindow(main)
javaLogger.setWindow(main)

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
    try {
        gameLogger.log("Starting the update and launch process...")

        gameLogger.log("Downloading Forge...")
        await downloadForge()
        gameLogger.log("Forge downloaded successfully.")

        gameLogger.log("Downloading mods...")
        const modsDownloaded = await downloadMods()
        if (modsDownloaded) {
            gameLogger.log("Mods downloaded successfully.")

            const launcher = new Client()
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
                customArgs: ConfigManager.getVrPrefix() ? [ConfigManager.isVrPrefixEnabled()] : [],
                javaPath: jre ? path.join(jre, "bin", process.platform === "win32" ? "java.exe" : "java") : null,
                forge: main.FORGE_VERSION ? path.join(ConfigManager.getGameDirectory(), `forge-${main.MC_VERSION}-${main.FORGE_VERSION}-installer.jar`) : null,
                server: "multiplayer"
            }

            gameLogger.log("Analyzing mods...")
            const analyseMod = await analyseMods()
            if (!analyseMod) {
                gameLogger.error("Mod analysis failed. Stopping the launch process.")
                return updateError('Дима пошел нахуй!!!')
            }
            gameLogger.log("Mod analysis completed successfully.")

            gameLogger.log("Launching the game with options:", opts)
            launcher.launch(opts).then(() => {
                setUpdateProgress(100)
                setUpdateText("Launching Game")
                setTimeout(() => {
                    main.win.close()
                }, 3000)
            })

            launcher.on('debug', (e) => gameLogger.debug(e))
            launcher.on('data', (e) => gameLogger.log(e))
        } else {
            gameLogger.error("Mods were not downloaded. Stopping the launch process.")
        }
    } catch (error) {
        gameLogger.error(`Error during update and launch process: ${error.message}`)
        updateError("LaunchError: " + error.message)
    }
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
    const getModsUrl = ConfigManager.getModSource()
    const MODS_URL = getModsUrl ? `${getModsUrl}/mine/mods.json` : main.MODS_URL
    if (MODS_URL) {
        try {
            setUpdateText("Checking mods")
            gameLogger.log("Checking Mods...")

            const modsDir = path.join(ConfigManager.getGameDirectory(), "mods")
            gameLogger.log(`Mods directory: ${modsDir}`)

            if (!fs.existsSync(modsDir)) {
                gameLogger.log(`Mods directory does not exist. Creating...`)
                fs.mkdirSync(modsDir)
            } else {
                gameLogger.log(`Mods directory already exists`)
            }

            gameLogger.log(`Fetching mods list from ${MODS_URL}`)
            const response = await Axios.get(MODS_URL)
            gameLogger.log(`Received mods list. Status: ${response.statusText}`)

            for (let i = 0; i < response.data.mods.length; i++) {
                const modFile = path.join(modsDir, response.data.mods[i].name)
                gameLogger.log(`Checking mod: ${response.data.mods[i].name} at ${modFile}`)

                if (fs.existsSync(modFile)) {
                    gameLogger.log(`Mod file ${modFile} exists. Verifying SHA1...`)
                    const modFileContent = fs.readFileSync(modFile)
                    let modSha1 = crypto.createHash("sha1").update(modFileContent).digest("hex")
                    gameLogger.log(`Current SHA1: ${modSha1}, Expected SHA1: ${response.data.mods[i].sha1}`)

                    if (modSha1 !== response.data.mods[i].sha1) {
                        gameLogger.log(`SHA1 mismatch for ${modFile}. Deleting file...`)
                        fs.unlinkSync(modFile)
                        totalModsSize += response.data.mods[i].size
                    } else {
                        gameLogger.log(`SHA1 matches for ${modFile}. Skipping download.`)
                        continue
                    }
                } else {
                    gameLogger.log(`Mod file ${modFile} does not exist. Will download.`)
                    totalModsSize += response.data.mods[i].size
                }
            }

            for (let i = 0; i < response.data.mods.length; i++) {
                const modFile = path.join(modsDir, response.data.mods[i].name)

                if (fs.existsSync(modFile)) {
                    gameLogger.log(`Verifying existing mod file: ${modFile}`)
                    const modFileContent = fs.readFileSync(modFile)
                    let modSha1 = crypto.createHash("sha1").update(modFileContent).digest("hex")

                    if (modSha1 !== response.data.mods[i].sha1) {
                        gameLogger.log(`SHA1 mismatch for ${modFile}. Deleting and re-downloading...`)
                        fs.unlinkSync(modFile)
                        await downloadMod(response.data.mods[i].downloadURL, modFile, response.data.mods[i].size)
                        gameLogger.log(`${response.data.mods[i].name} was successfully downloaded!`)
                    } else {
                        gameLogger.log(`Mod ${modFile} is up to date. Skipping download.`)
                        continue
                    }
                } else {
                    gameLogger.log(`Downloading mod ${response.data.mods[i].name}...`)
                    await downloadMod(response.data.mods[i].downloadURL, modFile, response.data.mods[i].size)
                    gameLogger.log(`${response.data.mods[i].name} was successfully downloaded!`)
                }
            }
            gameLogger.log(`All mods have been processed successfully.`)
            return true
        } catch (err) {
            gameLogger.error(`Error during mods download: ${err?.message}`)
            updateError("ModsError: " + err?.message)
            return false
        }
    } else {
        gameLogger.error("Mods URL is not defined.")
        return false
    }
}

async function analyseMods() {
    try {
        gameLogger.log("Starting mod analysis...")

        const getModsUrl = ConfigManager.getModSource()
        const MODS_URL = getModsUrl ? `${getModsUrl}/mine/mods.json` : main.MODS_URL
        gameLogger.log(`Mods URL: ${MODS_URL}`)

        const modsDir = path.join(ConfigManager.getGameDirectory(), "mods")
        gameLogger.log(`Mods directory: ${modsDir}`)

        if (!fs.existsSync(modsDir)) {
            gameLogger.log(`Mods directory does not exist. Creating...`)
            fs.mkdirSync(modsDir)
        } else {
            gameLogger.log(`Mods directory already exists.`)
        }

        gameLogger.log(`Fetching mods from ${MODS_URL}`)
        const response = await Axios.get(MODS_URL)
        gameLogger.log(`Mods list fetched successfully. Status: ${response.statusText}`)

        gameLogger.log(`Analysing mods in directory: ${modsDir}`)
        fs.readdirSync(modsDir).forEach(file => {
            const jarFileRegex = /\.jar$/i
            if (!jarFileRegex.test(file)) {
                gameLogger.log(`Skipping non-jar file: ${file}`)
                return
            }

            gameLogger.log(`Checking mod file: ${file}`)
            let sha1Array = []

            for (let i = 0; i < response.data.mods.length; i++) {
                sha1Array.push(response.data.mods[i].sha1)
            }

            const modFileContent = fs.readFileSync(path.join(modsDir, file))
            let modSha1 = crypto.createHash("sha1").update(modFileContent).digest("hex")
            gameLogger.log(`Current SHA1: ${modSha1}`)

            if (!sha1Array.includes(modSha1)) {
                gameLogger.log(`Mod file ${file} is not in the mod list. Deleting...`)
                fs.unlinkSync(path.join(modsDir, file))
                gameLogger.log(`Mod file ${file} deleted.`)
            } else {
                gameLogger.log(`Mod file ${file} is valid. Keeping.`)
            }
        })

        gameLogger.log("Mod analysis completed successfully.")
        return true

    } catch (err) {
        gameLogger.error(`Error during mod analysis: ${err.message}`)
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
