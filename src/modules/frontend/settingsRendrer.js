const modsUrl = document.getElementById("modsUrl")
modsUrl.addEventListener('input', async (event) => {
  let newModUrl = event.target.value
  window.ipc.send("set-modUrl", newModUrl)
})