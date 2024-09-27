class Logger {

    constructor(prefix, style) {
        this.prefix = prefix
        this.style = style
        this.win = null
    }

    setWindow(win) {
        this.win = win
    }

    sendLogToWindow(logType, message) {
        if (this.win?.win && this.win?.win?.webContents) {
            if (message[0].startsWith('%c')) {
                const formattedMessage = [message[0], message[1], ...message.slice(2)];
                this.win.win.webContents.send("logger", { logType, message: formattedMessage });
            } else {
                this.win.win.webContents.send("logger", { message });
            }
        }
    }

    log() {
        console.log.apply(null, [this.prefix, this.style, ...arguments])
        this.sendLogToWindow("log", [this.prefix, this.style, ...arguments])
    }

    info() {
        console.info.apply(null, [this.prefix, this.style, ...arguments])
        this.sendLogToWindow("info", [this.prefix, this.style, ...arguments])
    }

    warn() {
        console.warn.apply(null, [this.prefix, this.style, ...arguments])
        this.sendLogToWindow("warn", [this.prefix, this.style, ...arguments])
    }

    debug() {
        console.debug.apply(null, [this.prefix, this.style, ...arguments])
        this.sendLogToWindow("debug", [this.prefix, this.style, ...arguments])
    }

    error() {
        console.error.apply(null, [this.prefix, this.style, ...arguments])
        this.sendLogToWindow("error", [this.prefix, this.style, ...arguments])
    }

}

module.exports = function (prefix, style, win) {
    return new Logger(prefix, style, win)
}