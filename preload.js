const {
    contextBridge,
    ipcRenderer
} = require("electron")

// const logger = require('./modules/logger')('%c[Preloader]', 'color: #a02d2a; font-weight: bold');

// logger.log('Loading..');

contextBridge.exposeInMainWorld(
    "ipc", {
    send: (channel, data) => {
        ipcRenderer.send(channel, data)

    },
    sendSync: (channel, data) => {
        return ipcRenderer.sendSync(channel, data)

    },
    receive: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args))

    }
}
)