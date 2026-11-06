const fs = require("fs");
const path = require("path");

const {
    useMultiFileAuthState
} = require("@whiskeysockets/baileys");

const config = require("../config");

const SESSION_DIR = path.join(__dirname, "../session");

/**
 * Create session directory.
 */
function createSessionDirectory() {
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, {
            recursive: true
        });
    }
}

/**
 * Load WhatsApp authentication state.
 */
async function loadSession() {
    createSessionDirectory();

    const {
        state,
        saveCreds
    } = await useMultiFileAuthState(SESSION_DIR);

    return {
        state,
        saveCreds,
        sessionDir: SESSION_DIR
    };
}

/**
 * Request WhatsApp Pair Code.
 */
async function requestPairCode(sock) {
    if (!config.PAIR_CODE_LOGIN) {
        throw new Error("Pair Code Login is disabled in config.js");
    }

    const number = String(config.PAIRING_NUMBER || "")
        .replace(/\D/g, "");

    if (!number) {
        throw new Error("PAIRING_NUMBER is missing in config.js");
    }

    if (sock.authState?.creds?.registered) {
        console.log("[SESSION] Already registered.");
        return null;
    }

    const code = await sock.requestPairingCode(number);

    console.log("--------------------------------");
    console.log("DARK DILA-MD PAIRING CODE");
    console.log(code);
    console.log("--------------------------------");

    return code;
}

/**
 * Session status.
 */
function getSessionStatus() {
    createSessionDirectory();

    const files = fs.readdirSync(SESSION_DIR);

    return {
        exists: files.length > 0,
        files: files.length,
        directory: SESSION_DIR
    };
}

module.exports = {
    SESSION_DIR,
    createSessionDirectory,
    loadSession,
    requestPairCode,
    getSessionStatus
};
