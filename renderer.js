/**
 * Start game button checker.
 */
const btn = document.getElementById('start-game');

btn.addEventListener('click', async (event) => {
  await window.ipc.send("play")
  btn.setAttribute('disabled', 'true')
});

const gfopen = document.getElementById('game-folder-open');
gfopen.addEventListener('click', async (event) => {
  await window.ipc.send("game-folder-open")
});

const username = document.getElementById('username');
const rammax = document.getElementById("ram-max");
const rammaxnumb = document.getElementById("ram-max-numb");

window.addEventListener("load", (event) => {
  const name = window.ipc.sendSync('get-username')
  const avmem = window.ipc.sendSync('available-memory')
  const curmem = window.ipc.sendSync('get-memory')
  username.value = name
  rammax.setAttribute('max', avmem)
  rammax.setAttribute('min', 512)
  rammax.value = curmem
  rammaxnumb.innerHTML = curmem + " MB"
});

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
  if((/\.(gif|jpe?g|tiff?|png|webp|bmp)$/i).test(droppedfile)) {
    window.document.body.style.backgroundImage = `url(${droppedfile.replace('C:\\', 'C:/').replaceAll('\\', '/')})`
  }
});