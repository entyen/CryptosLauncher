const configManager = require("./configmanager");
const os = require("os");
const { app, shell, BrowserWindow } = require("electron");
const ipc = require("electron").ipcMain;
const GenerateModsJson = require("../../utills/createModsjson");
const authHandler = require("./authHandler");

exports.initMainIPC = () => {
  ipc.on("get-ver", (event) => (event.returnValue = app.getVersion()));

  ipc.on(
    "get-username",
    (event) => (event.returnValue = configManager.getUsername())
  );

  ipc.on("set-username", (event, args) => {
    configManager.setUsername(args);
    configManager.saveConfig();
  });

  ipc.on("set-vrPrefix", (event, args) => {
    configManager.setVrPrefix(args);
    configManager.saveConfig();
  });

  ipc.on(
    "get-launcherJava",
    (event) => (event.returnValue = configManager.getLauncherJava())
  );

  ipc.on("set-launcherJava", (event, args) => {
    configManager.setLauncherJava(args);
    configManager.saveConfig();
  });

  ipc.on(
    "get-vrPrefix",
    (event) => (event.returnValue = configManager.getVrPrefix())
  );

  ipc.on("available-memory", (event) => {
    const mem = os.totalmem();
    event.returnValue = (mem / 1024 / 1024).toFixed(0);
  });

  ipc.on("get-memory", (event) => {
    event.returnValue = parseInt(configManager.getMinRAM().replace("M", ""));
  });

  ipc.on("set-memory", (event, args) => {
    const memory = args + "M";
    configManager.setMinRAM(memory);
    configManager.setMaxRAM(memory);
    configManager.saveConfig();
  });

  ipc.on("game-folder-open", (event) => {
    shell.openPath(configManager.getGameDirectory());
  });

  ipc.on("launcher-folder-open", (event) => {
    shell.openPath(configManager.getLauncherDirectory());
  });

  ipc.on("set-mod-url", (event, args) => {
    configManager.setModSource(args);
    configManager.saveConfig();
  });

  ipc.on("get-mod-source", (event) => {
    event.returnValue = configManager.getModSource();
  });

  ipc.on("generate-json", async (event) => {
    try {
      const res = await GenerateModsJson();
      event.returnValue = res;
    } catch (error) {
      console.error(error);
      event.returnValue = error;
    }
  });

  //TODO need normalisatiion on other files
  ipc.on("get-token", async (event, userData) => {
    const res = await authHandler(event, userData)
    event.returnValue = res.message
  });

  ipc.on("open-dev-tools", (event) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.openDevTools();
    }
  });
};
