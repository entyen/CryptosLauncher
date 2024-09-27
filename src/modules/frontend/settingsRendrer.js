const modsUrl = document.getElementById("modsUrl");

modsUrl.value = window.ipc.sendSync("get-mod-source")

modsUrl.addEventListener('change', async (event) => {
  let newModUrl = event.target.value;
  window.ipc.send("set-mod-url", newModUrl);
});

const vrPrefix = document.getElementById("vrPrefix")
vrPrefix.checked = window.ipc.sendSync("get-vrPrefix") || false
vrPrefix.addEventListener("change", function (event) {
  return window.ipc.send("set-vrPrefix", event.target.checked)
})

const laucherJava = document.getElementById("laucherJava")
laucherJava.checked = window.ipc.sendSync("get-launcherJava") || false
laucherJava.addEventListener("change", function (event) {
  return window.ipc.send("set-launcherJava", event.target.checked)
})