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
let adminWindow

const createWindow = () => {
    win = new BrowserWindow({
        width: 1180,
        height: 730,
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
        resizable: false,
        movable: false,
        minimizable: false,
        webPreferences: {
            contextIsolation: true,
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

function createAdminWindow() {
    adminWindow = new BrowserWindow({
        width: 400,
        height: 300,
        parent: win,
        modal: true,
        resizable: false,
        movable: false,
        minimizable: false,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        autoHideMenuBar: true,
        title: 'Admin Page',
        icon: path.join(__dirname, "images", "logo.png")
    })

    adminWindow.loadFile('./src/modules/frontend/admin.html')

    exports.admin = adminWindow

    adminWindow.on('closed', () => {
        adminWindow = null
    })
}

ipcMain.on('open-settings', (event) => {
    if (!settingsWindow) {
        createSettingsWindow()
    } else {
        settingsWindow.show()
    }
})

ipcMain.on('open-admin-tools', (event) => {
    if (!adminWindow) {
        createAdminWindow()
    } else {
        adminWindow.show()
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

// Выбор канала обновлений (можно сохранять это в конфигурации)
// let updateChannel = ConfigManager.getUpdateChannel() || 'latest';
// autoUpdater.channel = updateChannel;

ipcMain.on('check-auto-update', async () => {
    try {
        if (isDev) {
            return win?.webContents.send("launcher-ready");
        }

        if (process.platform === 'darwin' || process.platform === 'linux') {
            return win.webContents.send("launcher-ready");
        }

        autoUpdater.updateConfigPath = path.join(__dirname, 'app-update.yml');
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.autoRunAppAfterInstall = true;

        autoUpdater.on('update-downloaded', () => {
            log.info("Update downloaded, preparing to quit and install...");
            win.webContents.send("launcher-update-finished");
            autoUpdater.quitAndInstall(true, true);
        });

        autoUpdater.on('update-not-available', () => {
            log.info("No updates available.");
            win.webContents.send("launcher-ready");
        });

        autoUpdater.on('error', (err) => {
            log.error(`Update error: ${err.message}`);
            win.webContents.send("set-update-text", `Error: ${err.message}`);
        });

        autoUpdater.on('download-progress', (progress) => {
            log.info(`Download progress: ${progress.percent}%`);
            win.webContents.send("set-update-text", "Self update...");
            win.webContents.send("set-update-progress", progress.percent);
        });

        await autoUpdater.checkForUpdates();

    } catch (err) {
        log.error(`Failed to check for updates: ${err.message}`);
        win.webContents.send("set-update-text", `Error checking updates: ${err.message}`);
    }
});

// exports.LAUNCHER_CONFIG = "./config.json"
exports.LAUNCHER_NAME = "MC Launcher"
exports.MC_VERSION = "1.20.4"
exports.FORGE_VERSION = "49.1.23"
exports.JRE_WINDOWS = "https://dl.grk.pw/mine/jre-windows.zip"
exports.JRE_LINUX = "https://dl.grk.pw/mine/jre-linux.zip"
exports.JRE_OSX = "https://dl.grk.pw/mine/jre-osx.zip"
exports.MODS_URL = "https://dl.grk.pw/mine/mods.json"

