const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const game = require('./src/modules/backend/game')
const mainIPC = require("./src/modules/backend/mainIPC")
const ConfigManager = require('./src/modules/backend/configmanager')
const { autoUpdater } = require("electron-updater")
const isDev = require('electron-is-dev')

const log = require("electron-log")
log.transports.file.level = "debug"
autoUpdater.logger = log

let win
let settingsWindow

const createWindow = () => {
    win = new BrowserWindow({
        width: 1180,
        height: 729,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        autoHideMenuBar: true,
        title: exports.LAUNCHER_NAME,
        icon: path.join(__dirname, "images", "logo.png")
    })

    win.loadFile('./src/modules/frontend/index.html')

    exports.win = win
}

function createSettingsWindow() {
    settingsWindow = new BrowserWindow({
        width: 400,
        height: 300,
        parent: win,
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
        autoHideMenuBar: true,
        title: 'Settings',
        icon: path.join(__dirname, "images", "logo.png")
    })

    settingsWindow.loadFile('./src/modules/frontend/settings.html')

    exports.settings = settingsWindow

    settingsWindow.on('closed', () => {
        settingsWindow = null
    })
}

ipcMain.on('open-settings', (event) => {
    if (!settingsWindow) {
        createSettingsWindow()
    } else {
        settingsWindow.show()
    }
})

app.whenReady().then(() => {
    ConfigManager.load()
    createWindow()
    mainIPC.initMainIPC()
    game.init()
})

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit()
    }
})

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

ipcMain.on('check-auto-update', () => {

    if (process.platform !== 'darwin') {

        if (isDev) win?.webContents.send("launcher-ready")
        autoUpdater.updateConfigPath = path.join(__dirname, 'app-update.yml')
        autoUpdater.autoInstallOnAppQuit = true

        autoUpdater.on('update-downloaded', () => {
            win.webContents.send("launcher-update-finished")
        })
        autoUpdater.on('update-not-available', () => {
            win.webContents.send("launcher-ready")
        })
        autoUpdater.on('error', (err) => {
            win.webContents.send("set-update-text", err)
        })
        autoUpdater.on('download-progress', (progress) => {
            win.webContents.send("set-update-text", "Self update...")
            win.webContents.send("set-update-progress", progress)
        })
        autoUpdater.checkForUpdates().catch(err => {
            win.webContents.send("set-update-text", err)
        })

        if (isDev) return win?.webContents.send("launcher-ready")
    }
    else {
        win.webContents.send("launcher-ready")
    }
})

// exports.LAUNCHER_CONFIG = "./config.json"
exports.LAUNCHER_NAME = "MC Launcher"
exports.MC_VERSION = "1.20.1"
exports.FORGE_VERSION = "47.3.5"
exports.JRE_WINDOWS = "https://dl.grk.pw/mine/jre-windows.zip"
exports.JRE_LINUX = "https://dl.grk.pw/mine/jre-linux.zip"
exports.JRE_OSX = "https://dl.grk.pw/mine/jre-osx.zip"
exports.MODS_URL = "https://dl.grk.pw/mine/mods.json"

