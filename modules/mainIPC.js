const configManager = require("./configmanager")
const os = require("os")
const { app, shell } = require('electron')
const ipc = require("electron").ipcMain

exports.initMainIPC = () => {

  ipc.on("get-ver", (event) =>
    event.returnValue = app.getVersion()
  )

  ipc.on("get-username", (event) =>
    event.returnValue = configManager.getUsername()
  )

  ipc.on("set-username", (event, args) => {
    configManager.setUsername(args)
    configManager.saveConfig()
  })

  ipc.on("available-memory", event => {
    const mem = os.totalmem()
    event.returnValue = (mem / 1024 / 1024).toFixed(0)
  })

  ipc.on("get-memory", event => {
    event.returnValue = parseInt(configManager.getMinRAM().replace("M", ""))
  })

  ipc.on("set-memory", (event, args) => {
    const memory = args + "M"
    configManager.setMinRAM(memory)
    configManager.setMaxRAM(memory)
    configManager.saveConfig()
  })

  ipc.on("game-folder-open", (event) => {
    shell.openPath(configManager.getGameDirectory())
  })

}