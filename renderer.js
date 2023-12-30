const gfopen = document.getElementById('game-folder-open');
gfopen.addEventListener('click', async (event) => {
  await window.ipc.send("game-folder-open")
});

const username = document.getElementById('username');
username.value = window.ipc.sendSync('get-username');

const rammax = document.getElementById("ram-max");
const rammaxnumb = document.getElementById("ram-max-numb");
const avmem = window.ipc.sendSync('available-memory')
rammax.setAttribute('max', avmem)
rammax.setAttribute('min', 512)

const curmem = window.ipc.sendSync('get-memory')
rammax.value = curmem
rammaxnumb.innerHTML = curmem + " MB"

const ver = document.getElementById("ver");
const getver = window.ipc.sendSync('get-ver')
ver.innerHTML = getver

username.addEventListener('input', async (event) => {
  let newname = event.target.value
  window.ipc.send('set-username', newname)
})

rammax.addEventListener('input', (event) => {
  const newmaxmem = event.target.value
  rammaxnumb.innerHTML = newmaxmem + " MB"
  window.ipc.send('set-memory', newmaxmem)
})

window.addEventListener("dragover", evt => {
  evt.preventDefault();
});

window.addEventListener("drop", evt => {
  evt.preventDefault();
  const droppedfile = evt.dataTransfer.files[0].path
  if ((/\.(gif|jpe?g|tiff?|png|webp|bmp)$/i).test(droppedfile)) {
    window.document.body.style.backgroundImage = `url(${droppedfile.replace('C:\\', 'C:/').replaceAll('\\', '/')})`
  }
});

const log = document.getElementById('log')
window.ipc.receive("set-update-text" ,(msg) => {
  log.innerHTML = msg
})

const progress = document.getElementById('progress')
window.ipc.receive("set-update-progress" ,(prog) => {
  progress.style.width = prog + "%"
})

/**
 * Active elements disabler
 * @return disabled: state
 */
const disable = (obj, state) => obj.setAttribute('disabled', state)

/**
 * Start game button checker.
 */
const btn = document.getElementById('start-game');

btn.addEventListener('click', async (event) => {
  disable(btn, true)
  disable(rammax, true)
  disable(username, true)
  await window.ipc.send("play")
});

window.ipc.receive("launcher-update-finished", () => {
  disable(btn, false)
})