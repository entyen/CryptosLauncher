const fs = require("fs");
const path = require("path");

// Определение пути к папке конфигурации
const sysRoot = process.env.APPDATA || 
    (process.platform === "darwin" ? path.join(process.env.HOME, "/Library/Application Support") : process.env.HOME);

let gamePath;
if (process.platform === "darwin") {
    gamePath = path.join(sysRoot, "./ctlauncher");
} else {
    gamePath = path.join(sysRoot, "./.ctlauncher");
}

const configDir = path.join(gamePath, "config", "PacketAuth");
const configFilePath = path.join(configDir, "config.yml");

// Функция для создания директории, если она не существует
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Функция для записи данных в config.yaml
function saveConfigToFile(data) {
    try {
        // Убедимся, что директория существует
        ensureDirectoryExists(configDir);

        const configString = `${data.username}: 1.6;${data.token}`;

        // Записываем данные в файл
        fs.writeFileSync(configFilePath, configString, "utf8");
        console.log("Конфигурация успешно сохранена:", configFilePath);
    } catch (error) {
        console.error("Ошибка при сохранении конфигурации:", error);
    }
}

// Обработчик события IPC для получения токена
module.exports = async (event, userData) => {
        try {
            const response = await fetch("https://yam.grk.pw/api/auth_launcher", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login: userData.username, password: userData.password }),
            });

            const result = await response.json();

            if (response.ok) {
                // Сохраняем имя пользователя и токен в config.yaml
                const configData = {
                    username: userData.username,
                    token: result.token,
                };

                saveConfigToFile(configData);

                // Отправляем успешный ответ клиенту
                event.reply("auth-success", { message: "Авторизация успешна!" });
            } else {
                // Отправляем ошибку клиенту
                event.reply("auth-error", { message: result.message || "Ошибка авторизации" });
            }
        } catch (error) {
            console.error("Ошибка при получении токена:", error);
            event.reply("auth-error", { message: "Ошибка сервера" });
        }
};