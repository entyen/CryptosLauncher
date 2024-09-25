const modsUrl = document.getElementById("modsUrl");

modsUrl.value = window.ipc.sendSync("get-mod-source")

modsUrl.addEventListener('change', async (event) => {
  let newModUrl = event.target.value;
  window.ipc.send("set-mod-url", newModUrl);
});