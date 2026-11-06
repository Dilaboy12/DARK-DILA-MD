const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const functions = require("./lib/functions");
const database = require("./lib/database");
const commands = require("./lib/commands");

// ========================================
// DARK DILA-MD CONFIGURATION
// ========================================

const BOT_NAME = config.BOT_NAME || "DARK DILA-MD";
const PREFIX = config.PREFIX || ".";
const OWNER_NUMBER = String(config.OWNER_NUMBER || "").replace(/\D/g, "");

const SESSION_DIR = path.join(__dirname, "session");
const PLUGIN_DIR = path.join(__dirname, "plugins");

let sock;
let reconnectTimer;
let isStarting = false;
let isStopping = false;

const logger = pino({
    level: "silent"
});

const startTime = Date.now();

// ========================================
// DIRECTORY SETUP
// ========================================

function createDirectories() {
    [SESSION_DIR, PLUGIN_DIR, path.join(__dirname, "data")].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// ========================================
// SESSION PREFIX HANDLER
// ========================================

function getSessionData() {
    const sessionId = String(config.SESSION_ID || "").trim();
    const prefix = config.SESSION_PREFIX || "THENUVA-XMD=";

    if (!sessionId) return "";

    if (sessionId.startsWith(prefix)) {
        return sessionId.slice(prefix.length).trim();
    }

    return sessionId;
}

// A session prefix is not itself an authentication session.
// This base restores credentials from the local session directory.
// An external session-data provider must be implemented separately
// before getSessionData() can restore a remote session.

// ========================================
// OWNER CHECK
// ========================================

function isOwner(jid) {
    if (!OWNER_NUMBER || !jid) return false;

    const sender = jidNormalizedUser(jid)
        .split("@")[0]
        .replace(/\D/g, "");

    return sender === OWNER_NUMBER;
}

// ========================================
// PLUGIN LOADER
// ========================================

function loadPlugins() {
    commands.clear();

    if (!fs.existsSync(PLUGIN_DIR)) {
        fs.mkdirSync(PLUGIN_DIR, { recursive: true });
    }

    const files = fs.readdirSync(PLUGIN_DIR)
        .filter(file => file.endsWith(".js"));

    for (const file of files) {
        const filePath = path.join(PLUGIN_DIR, file);

        try {
            delete require.cache[require.resolve(filePath)];

            const plugin = require(filePath);

            if (commands.register(plugin)) {
                console.log(`[PLUGIN] Loaded: ${file}`);
            }
        } catch (error) {
            console.error(`[PLUGIN ERROR] ${file}:`, error.message);
        }
    }

    console.log(`[PLUGIN] Total commands: ${commands.getAll().length}`);
}

// ========================================
// MESSAGE TEXT
// ========================================

function getText(message) {
    if (!message) return "";

    const msg = message.message || {};

    return (
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.documentMessage?.caption ||
        msg.buttonsResponseMessage?.selectedButtonId ||
        msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ""
    );
}

// ========================================
// MESSAGE HANDLER
// ========================================

async function handleMessages(update) {
    const { messages, type } = update;

    if (type !== "notify") return;

    for (const msg of messages) {
        try {
            if (!msg.message || msg.key.fromMe) continue;

            const chat = msg.key.remoteJid;
            if (!chat || chat === "status@broadcast") continue;

            const sender = msg.key.participant || chat;
            const text = getText(msg).trim();

            if (!text.startsWith(PREFIX)) continue;

            const parts = text.slice(PREFIX.length).trim().split(/\s+/);
            const commandName = (parts.shift() || "").toLowerCase();
            const args = parts;

            if (!commandName) continue;

            const plugin = commands.get(commandName);

            if (!plugin) continue;

            const owner = isOwner(sender);

            if (plugin.ownerOnly && !owner) {
                await sock.sendMessage(chat, {
                    text: "❌ මෙම Command එක Bot Owner සඳහා පමණයි."
                }, { quoted: msg });
                continue;
            }

            const context = {
                sock,
                msg,
                args,
                sender,
                chat,
                owner,
                config,
                database,
                functions,
                startTime,
                uptime: () => Math.floor((Date.now() - startTime) / 1000)
            };

            await plugin.handler(sock, msg, args, context);

            if (config.COMMAND_LOGS) {
                console.log(`[COMMAND] ${commandName} | ${chat}`);
            }

        } catch (error) {
            console.error("[MESSAGE ERROR]", error);

            try {
                await sock.sendMessage(msg.key.remoteJid, {
                    text: "❌ Command එක ක්‍රියාත්මක කිරීමේදී දෝෂයක් ඇතිවුණා."
                }, { quoted: msg });
            } catch (e) {
                console.error("[REPLY ERROR]", e.message);
            }
        }
    }
}

// ========================================
// OWNER NOTIFICATION
// ========================================

async function notifyOwner() {
    if (!config.OWNER_ALERTS || !OWNER_NUMBER) return;

    try {
        await sock.sendMessage(`${OWNER_NUMBER}@s.whatsapp.net`, {
            text:
                `✅ ${BOT_NAME} Connected!\n\n` +
                `Version: ${config.VERSION}\n` +
                `Status: Online\n` +
                `Time: ${functions.getTime()}\n\n` +
                `${config.FOOTER}`
        });

        console.log("[OWNER] Connection notification sent.");
    } catch (error) {
        console.error("[OWNER NOTIFICATION]", error.message);
    }
}

// ========================================
// START BOT
// ========================================

async function startBot() {
    if (isStarting || isStopping) return;

    isStarting = true;
    createDirectories();

    try {
        console.log(`\n========== ${BOT_NAME} ==========`);
        console.log("[BOT] Starting...");

        loadPlugins();

        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(SESSION_DIR);

        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            logger,
            auth: state,
            browser: Browsers.ubuntu("Chrome"),
            printQRInTerminal: false,
            markOnlineOnConnect: config.ALWAYS_ONLINE || false,
            syncFullHistory: false
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("messages.upsert", handleMessages);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && config.QR_LOGIN) {
                console.log("[LOGIN] QR code generated.");

                try {
                    const qrcode = require("qrcode-terminal");
                    qrcode.generate(qr, { small: true });
                } catch (error) {
                    console.error("[QR ERROR]", error.message);
                }
            }

            if (connection === "connecting") {
                console.log("[WHATSAPP] Connecting...");
            }

            if (connection === "open") {
                console.log(`\n✅ ${BOT_NAME} CONNECTED!`);
                console.log(`[BOT] Commands: ${commands.getAll().length}`);
                console.log(`[BOT] Prefix: ${PREFIX}`);

                await notifyOwner();
            }

            if (connection === "close") {
                const statusCode =
                    lastDisconnect?.error?.output?.statusCode;

                console.log("[WHATSAPP] Connection closed:", statusCode);

                if (
                    statusCode !== DisconnectReason.loggedOut &&
                    config.AUTO_RECONNECT &&
                    !isStopping
                ) {
                    console.log("[BOT] Reconnecting...");

                    clearTimeout(reconnectTimer);

                    reconnectTimer = setTimeout(() => {
                        isStarting = false;
                        startBot();
                    }, Number(config.RECONNECT_DELAY) || 5000);
                } else {
                    console.log("[BOT] Login required. Check your session.");
                }
            }
        });

        // ========================================
        // PAIR CODE LOGIN
        // ========================================

        if (
            !state.creds.registered &&
            config.PAIR_CODE_LOGIN &&
            config.LOGIN_METHOD !== "qr"
        ) {
            const number = String(config.PAIRING_NUMBER || "")
                .replace(/\D/g, "");

            if (!number) {
                console.log("[LOGIN] Add PAIRING_NUMBER in config.js");
            } else {
                const code = await sock.requestPairingCode(number);

                console.log("\n================================");
                console.log("       DARK DILA-MD PAIR CODE");
                console.log("================================");
                console.log(code);
                console.log("================================\n");
            }
        }

        isStarting = false;

    } catch (error) {
        isStarting = false;

        console.error("[START ERROR]", error);

        if (config.AUTO_RECONNECT && !isStopping) {
            clearTimeout(reconnectTimer);

            reconnectTimer = setTimeout(() => {
                startBot();
            }, Number(config.RECONNECT_DELAY) || 5000);
        }
    }
}

// ========================================
// SHUTDOWN
// ========================================

async function shutdown() {
    if (isStopping) return;

    isStopping = true;
    clearTimeout(reconnectTimer);

    console.log("[BOT] Shutting down...");

    try {
        if (sock) {
            sock.end(undefined);
        }
    } catch (error) {
        console.error("[SHUTDOWN ERROR]", error.message);
    }

    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ========================================
// START
// ========================================

startBot();
