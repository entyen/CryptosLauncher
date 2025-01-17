const generateJsonButton = document.getElementById("modsjson-generate");
const generateStatus = document.getElementById("__progress-info")

generateJsonButton.addEventListener("click", async (event) => {
    disable(generateJsonButton)
    generateStatus.textContent = 'Generating...';

    try {
        const res = window.ipc.sendSync("generate-json")
        generateStatus.textContent = res;
        generateStatus.style.backgroundColor = '#28a745';
    } catch (e) {
        console.log(e)
        generateStatus.textContent = e;
        generateStatus.style.backgroundColor = '#dc3545';
    }
})

const disable = (obj) => obj.setAttribute("disabled", true)
const enable = (obj) => obj.removeAttribute("disabled")

const lnopen = document.getElementById("launcher-folder-open")
lnopen.addEventListener("click", async (event) => {
  await window.ipc.send("launcher-folder-open")
})