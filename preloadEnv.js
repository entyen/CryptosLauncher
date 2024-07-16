require('dotenv').config();
const { execSync } = require('child_process');

// Получаем GH_TOKEN из переменных окружения
const { GH_TOKEN } = process.env;

// Проверяем, что GH_TOKEN был установлен
if (!GH_TOKEN) {
  console.error('GH_TOKEN is not set in the .env file.');
  process.exit(1); // Выходим с кодом ошибки
}

// Устанавливаем команду для выполнения в зависимости от операционной системы
const command = process.platform === 'win32'
  ? `$env:GH_TOKEN=${GH_TOKEN}; npx electron-builder --publish always`
  : `GH_TOKEN=${GH_TOKEN} npx electron-builder`;

// Запускаем команду
try {
  execSync(command, { stdio: 'inherit', env: { ...process.env, GH_TOKEN } });
} catch (err) {
  console.error('Error executing command:', err.message);
  process.exit(1); // Выходим с кодом ошибки
}
