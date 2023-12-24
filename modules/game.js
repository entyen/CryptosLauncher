const gameLogger = require('./logger')('%c[GameLogger]', 'color: #000668; font-weight: bold')
const javaLogger = require('./logger')('%c[JavaLogger]', 'color: #000668; font-weight: bold')

const { Client, Authenticator } = require('minecraft-launcher-core');
const ipc = require("electron").ipcMain

const ConfigManager = require("./configmanager")
const main = require('../launcher')

exports.init = () => {
    ipc.on("play", () => play())
}

function play() {
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
        forge: "./forge-1.20.1-47.2.4-installer.jar"
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
}

