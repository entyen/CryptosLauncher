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
    main.win.webContents.send("set-update-progress", progress.toFixed(0))
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
        gameLogger.log("Starting the update and launch process...");

        // Сначала проверяем Forge
        await downloadForge();

        // Проверяем и загружаем моды
        gameLogger.log("Checking mods...");
        const modsDownloaded = await checkMods();

        // Анализ модов
        gameLogger.log("Analyzing mods...");
        const modsAnalyzed = await analyseMods();

        // Если моды успешно загружены и проанализированы, продолжаем
        if (modsDownloaded && modsAnalyzed) {
            gameLogger.log("Mods downloaded and analyzed successfully.");

            // Формирование опций для запуска
            const opts = await createLaunchOptions(jre);

            const launcher = new Client();
            gameLogger.log("Launching the game...");

            // Асинхронный запуск игры с ожиданием
            await launcher.launch(opts);
            setUpdateProgress(100);
            setUpdateText("Launching Game");

            // Закрытие окна после небольшого ожидания
            setTimeout(() => {
                main.win.close();
            }, 3000);

            // Логи на случай отладки
            launcher.on('debug', (e) => gameLogger.debug(e));
            launcher.on('data', (e) => gameLogger.log(e));
        } else {
            gameLogger.error("Mods were not downloaded or analyzed. Stopping the launch process.");
        }
    } catch (error) {
        gameLogger.error(`Error during update and launch process: ${error.message}`);
        updateError("LaunchError: " + error.message);
    }
}

// Вспомогательная функция для формирования опций
async function createLaunchOptions(jre) {
    let opts = {
        authorization: await Authenticator.getAuth(ConfigManager.getUsername()),
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
        forge: main.FORGE_VERSION ? path.join(ConfigManager.getGameDirectory(), `forge-${main.MC_VERSION}-${main.FORGE_VERSION}-installer.jar`) : null,
        server: "multiplayer"
    };

    if (ConfigManager.getLauncherJava()) {
        opts.javaPath = jre ? path.join(jre, "bin", process.platform === "win32" ? "java.exe" : "java") : null;
    }

    return opts;
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
                setUpdateProgress(100)
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

            setUpdateProgress((100.0 * receivedBytes / totalLength))
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

async function downloadForge(retries = 3) {
    try {
        if (!main.FORGE_VERSION) {
            return;
        }

        setUpdateText("Checking Forge");
        gameLogger.log("Checking Forge...");

        const forgeInstallerFile = path.join(ConfigManager.getGameDirectory(), `forge-${main.MC_VERSION}-${main.FORGE_VERSION}-installer.jar`);
        const forgeInstallerURL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${main.MC_VERSION}-${main.FORGE_VERSION}/forge-${main.MC_VERSION}-${main.FORGE_VERSION}-installer.jar`;

        // Проверяем наличие файла Forge
        const res = await Axios.head(forgeInstallerURL);
        const totalLength = parseInt(res.headers["content-length"], 10);

        try {
            const stats = await fs.promises.stat(forgeInstallerFile);
            if (stats.size === totalLength) {
                setUpdateText('Forge installed');
                gameLogger.log("Forge installer is already installed");
                return;
            }
        } catch {
            gameLogger.log("Forge installer not found or incomplete. Starting download...");
        }

        // Загрузка файла Forge
        const { data, headers } = await Axios({
            url: forgeInstallerURL,
            method: 'GET',
            responseType: 'stream'
        });

        let receivedBytes = 0;
        const writer = fs.createWriteStream(forgeInstallerFile);

        // Обновление прогресса скачивания
        data.on('data', (chunk) => {
            receivedBytes += chunk.length;
            setUpdateText("Downloading Forge");
            setUpdateProgress((100.0 * receivedBytes) / totalLength);
        });

        // Пишем данные в файл
        data.pipe(writer);

        writer.on('finish', async () => {
            try {
                const stats = await fs.promises.stat(forgeInstallerFile);
                if (stats.size === totalLength) {
                    setUpdateText("Forge downloaded!");
                    gameLogger.log("Forge was successfully downloaded!");
                } else {
                    throw new Error("File size mismatch after download");
                }
            } catch (err) {
                throw err;
            }
        });

        writer.on('error', (err) => {
            fs.promises.unlink(forgeInstallerFile).catch(console.error); // Удаляем файл в случае ошибки
            throw err;
        });

    } catch (err) {
        if (retries > 0) {
            gameLogger.warn(`Retrying Forge download. Retries left: ${retries - 1}`);
            setTimeout(() => downloadForge(retries - 1), 2000);  // Ретрай через 2 секунды
        } else {
            gameLogger.error(`Forge download failed: ${err.message}`);
            updateError(`ForgeError: ${err.message}`);
        }
    }
}

// Глобальные переменные для отслеживания общего прогресса
let totalModsSize = 0;       // Общий размер всех модов
let currentModsSize = 0;     // Текущий объем загруженных данных

async function checkMods() {
    const getModsUrl = ConfigManager.getModSource()
    const MODS_URL = getModsUrl ? `${getModsUrl}/mine/mods.json` : main.MODS_URL
    if (!MODS_URL) {
        gameLogger.error("Mods URL is not defined.")
        return false
    }

    try {
        setUpdateText("Checking mods")
        setUpdateProgress(0)

        const modsDir = path.join(ConfigManager.getGameDirectory(), "mods")
        await fs.promises.mkdir(modsDir, { recursive: true })

        const response = await Axios.get(MODS_URL)
        const mods = response.data.mods

        // Подсчет общего размера модов
        totalModsSize = mods.reduce((acc, mod) => acc + mod.size, 0)

        // Проход по модам для проверки и загрузки
        for (const mod of mods) {
            const modFile = path.join(modsDir, mod.file)
            let shouldDownload = false

            if (await fileExists(modFile)) {
                const modFileContent = await fs.promises.readFile(modFile)
                const modSha1 = crypto.createHash("sha1").update(modFileContent).digest("hex")

                if (modSha1 !== mod.sha1) {
                    await fs.promises.unlink(modFile)
                    shouldDownload = true
                }
            } else {
                shouldDownload = true
            }

            if (shouldDownload) {
                await downloadMod(mod.downloadURL, modFile, mod.size)
            }
        }

        gameLogger.log(`All mods have been processed successfully.`)
        return true

    } catch (err) {
        gameLogger.error(`Error during mods download: ${err?.message}`)
        updateError("ModsError: " + err?.message)
        return false
    }
}

async function downloadMod(fileURL, targetPath, modSize) {
    return new Promise(async (resolve, reject) => {
        try {
            const { data } = await Axios({
                url: fileURL,
                method: 'GET',
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(targetPath);
            let downloadedSize = 0;

            // Обновление прогресса загрузки всех модов
            data.on('data', (chunk) => {
                downloadedSize += chunk.length;
                currentModsSize += chunk.length; // Добавляем к общему прогрессу

                setUpdateText("Downloading Mods");
                setUpdateProgress((100 * currentModsSize) / totalModsSize);  // Прогресс для всех модов
            });

            // Привязка к стримам
            data.pipe(writer);

            // Обработка завершения записи
            writer.on('finish', async () => {
                try {
                    const stats = await fs.promises.stat(targetPath);
                    if (stats.size === modSize) {
                        resolve();
                    } else {
                        reject(new Error(`File size mismatch: expected ${modSize}, but got ${stats.size}`));
                    }
                } catch (err) {
                    reject(err);
                }
            });

            writer.on('error', (err) => {
                fs.promises.unlink(targetPath).catch(console.error); // Удаляем файл в случае ошибки
                gameLogger.error(`Write stream error: ${err.message}`);
                reject(err);
            });

        } catch (err) {
            if (retries > 0) {
                gameLogger.warn(`Retrying download for ${fileURL}. Retries left: ${retries - 1}`);
                setTimeout(() => downloadMod(fileURL, targetPath, modSize, retries - 1).then(resolve).catch(reject), 2000);  // Ретрай через 2 секунды
            } else {
                gameLogger.error(`Download failed after ${retries} retries: ${fileURL}`);
                updateError(`ModsError: ${err.message} = ${fileURL}`);
                reject(err);
            }
        }
    });
}

// Вспомогательная функция для проверки существования файла
async function fileExists(path) {
    try {
        await fs.promises.access(path)
        return true
    } catch {
        return false
    }
}

async function analyseMods() {
    try {
        setUpdateText("Analyse mods")
        setUpdateProgress(0)

        const getModsUrl = ConfigManager.getModSource()
        const MODS_URL = getModsUrl ? `${getModsUrl}/mine/mods.json` : main.MODS_URL

        const modsDir = path.join(ConfigManager.getGameDirectory(), "mods")

        if (!fs.existsSync(modsDir)) {
            fs.mkdirSync(modsDir)
        }

        const response = await Axios.get(MODS_URL)

        fs.readdirSync(modsDir).forEach((file, index) => {
            const jarFileRegex = /\.jar$/i
            if (!jarFileRegex.test(file)) {
                return
            }

            let sha1Array = []

            for (let i = 0; i < response.data.mods.length; i++) {
                sha1Array.push(response.data.mods[i].sha1)
            }

            const modFileContent = fs.readFileSync(path.join(modsDir, file))
            let modSha1 = crypto.createHash("sha1").update(modFileContent).digest("hex")
            setUpdateProgress((index / sha1Array.length) * 100)

            if (!sha1Array.includes(modSha1)) {
                fs.unlinkSync(path.join(modsDir, file))
            }
        })

        gameLogger.log("Mod analysis completed successfully.")
        return true

    } catch (err) {
        gameLogger.error(`Error during mod analysis: ${err.message}`)
        updateError("ModsError: " + err.message)
        return false
    }
}
