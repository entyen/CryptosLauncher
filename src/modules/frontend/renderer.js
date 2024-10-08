window.addEventListener("load", (event) => {
  window.ipc.send("check-auto-update")
})

const settingClick = document.getElementById("settings-open")
settingClick.addEventListener('click', async (_) => {
  await window.ipc.send("open-settings")
})

const gfopen = document.getElementById("game-folder-open")
gfopen.addEventListener("click", async (event) => {
  await window.ipc.send("game-folder-open")
})

const username = document.getElementById("username")
username.value = window.ipc.sendSync("get-username")

const rammax = document.getElementById("ram-max")
const rammaxnumb = document.getElementById("ram-max-numb")
const avmem = window.ipc.sendSync("available-memory")
rammax.setAttribute("max", avmem)
rammax.setAttribute("min", 512)

const curmem = window.ipc.sendSync("get-memory")
rammax.value = curmem
rammaxnumb.innerHTML = curmem + " MB"

const ver = document.getElementById("ver")
const getver = window.ipc.sendSync("get-ver")
ver.innerHTML = getver

username.addEventListener("input", async (event) => {
  let newname = event.target.value
  window.ipc.send("set-username", newname)
})

rammax.addEventListener("input", (event) => {
  const newmaxmem = event.target.value
  rammaxnumb.innerHTML = newmaxmem + " MB"
  window.ipc.send("set-memory", newmaxmem)
})

window.addEventListener("dragover", (evt) => {
  evt.preventDefault()
})

window.addEventListener("drop", (evt) => {
  evt.preventDefault()
  const droppedfile = evt.dataTransfer.files[0].path
  if (/\.(gif|jpe?g|tiff?|png|webp|bmp)$/i.test(droppedfile)) {
    window.document.body.style.backgroundImage = `url(${droppedfile
      .replace("C:\\", "C:/")
      .replaceAll("\\", "/")})`
  }
})

const progressInfo = document.getElementById("progress-info")
window.ipc.receive("set-update-text", (msg) => {
  progressInfo.innerHTML = msg
})

const progress = document.getElementById("progress")
window.ipc.receive("set-update-progress", (prog) => {
  progress.style.width = prog + "%"
})

/**
 * Active elements disabler
 * @return disabled: state
 */
const disable = (obj) => obj.setAttribute("disabled", true)
const enable = (obj) => obj.removeAttribute("disabled")

/**
 * Start game button checker.
 */
const btn = document.getElementById("start-game")

btn.addEventListener("click", async () => {
  disable(btn)
  disable(rammax)
  disable(username)
  await window.ipc.send("play")
})

window.ipc.receive("launcher-ready", () => {
  enable(btn)
})

window.ipc.receive("launcher-update-finished", () => {
  btn.innerHTML = "Restart"
  btn.style.backgroundColor = "#ff0000"
})

const errorInfo = document.getElementById("errorInfo")

window.ipc.receive("launcher-update-error", (err) => {
  console.log(err)
  errorInfo.innerHTML = "Error Click Ctrl + Shift + I"
})

let keySequence = [];
const targetSequence = ['y', 'a', 'm'];
const maxInterval = 50;

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keySequence.push(key);

  if (keySequence.join('').includes(targetSequence.join(''))) {
    triggerFunction();
    keySequence = [];
  }

  if (keySequence.length > targetSequence.length) {
    keySequence.shift();
  }
});

async function triggerFunction() {
  await window.ipc.send("open-admin-tools")
}

window.ipc.receive("logger", ({ logType, message }) => {
    if (typeof message[0] === 'string' && message[0].startsWith('%c')) {
        console[logType](message[0], message[1], ...message.slice(2));
    } else {
        console[logType](...message);
    }
})