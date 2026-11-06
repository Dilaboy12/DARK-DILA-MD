const baileys = require("@whiskeysockets/baileys");
const makeWASocket = baileys.default;
const {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    Browsers
} = baileys;

const pino = require("pino");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const mega = require("./mega");
const config = require("./config");

const SESSION_DIR = path.join(__dirname, "session");
const PLUGIN_DIR = path.join(__dirname, "plugins");
const TEMP_DIR = path.join(os.tmpdir(), "dark-dila-session");
const ARCHIVE = path.join(os.tmpdir(), "dark-dila-session.tar.gz");

const PREFIX = config.PREFIX || ".";
const OWNER = String(process.env.OWNER_NUMBER || config.OWNER_NUMBER || "").replace(/\D/g, "");
const logger = pino({ level: "silent" });

let sock;
let reconnectTimer;
let pairingStarted = false;
let sessionUploaded = false;
let stopping = false;
let commands = new Map();

function cleanDirectories() {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });
}

function getSessionUrl() {
    const value = String(process.env.SESSION_ID || "").trim();
    const prefix = "DARK DILA-MD=";

    if (!value) return "";

    if (!value.startsWith(prefix)) {
        throw new Error("SESSION_ID must start with DARK DILA-MD=");
    }

    return value.slice(prefix.length).trim();
}

function loadPlugins() {
    commands.clear();
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });

    const files = fs.readdirSync(PLUGIN_DIR)
        .filter(file => file.endsWith(".js"));

    for (const file of files) {
        const filePath = path.join(PLUGIN_DIR, file);

        try {
            delete require.cache[require.resolve(filePath)];
            const plugin = require(filePath);

            if (!plugin.command || typeof plugin.handler !== "function") {
                console.log(`[PLUGIN SKIP] ${file}: invalid plugin format`);
                continue;
            }

            const names = Array.isArray(plugin.command)
                ? plugin.command
                : [plugin.command];

            for (const name of names) {
                commands.set(String(name).toLowerCase(), plugin);
            }

            console.log(`[PLUGIN] Loaded: ${file}`);
        } catch (error) {
            console.error(`[PLUGIN ERROR] ${file}:`, error.message);
        }
    }

    console.log(`[PLUGIN] Total commands: ${commands.size}`);
}

function createArchive() {
    if (fs.existsSync(ARCHIVE)) fs.unlinkSync(ARCHIVE);

    execFileSync("tar", [
        "-czf",
        ARCHIVE,
        "-C",
        __dirname,
        "session"
    ]);
}

async function restoreSession() {
    const url = getSessionUrl();

    if (!url) {
        console.log("[SESSION] No SESSION_ID. Pair Code login required.");
        return false;
    }

    console.log("[SESSION] Downloading existing MEGA session...");

    const buffer = await mega.download(url);

    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    fs.writeFileSync(ARCHIVE, buffer);

    execFileSync("tar", [
        "-xzf",
        ARCHIVE,
        "-C",
        TEMP_DIR
    ]);

    const restored = path.join(TEMP_DIR, "session");

    if (!fs.existsSync(path.join(restored, "creds.json"))) {
        throw new Error("Downloaded archive does not contain session/creds.json");
    }

    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    fs.cpSync(restored, SESSION_DIR, { recursive: true });

    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    fs.rmSync(ARCHIVE, { force: true });

    console.log("[SESSION] Existing WhatsApp session restored.");
    return true;
}

async function uploadSession() {
    if (sessionUploaded) return;
    sessionUploaded = true;

    try {
        console.log("[SESSION] Creating complete session archive...");

        createArchive();

        const url = await mega.upload(
            ARCHIVE,
            `DARK_DILA_MD_SESSION_${Date.now()}.tar.gz`
        );

        const sessionId = `DARK DILA-MD=${url}`;

        console.log("[SESSION] Upload successful.");

        const number = String(
            process.env.PAIRING_NUMBER || ""
        ).replace(/\D/g, "");

        const target = number || OWNER;

        if (target) {
            await sock.sendMessage(`${target}@s.whatsapp.net`, {
                text:
                    `✅ DARK DILA-MD Connected!\n\n` +
                    `🔐 SESSION ID:\n\n${sessionId}\n\n` +
                    `⚠️ Keep this Session ID private.\n` +
                    `Save it in GitHub Secrets as SESSION_ID.`
            });
        }

        console.log("[SESSION] Session ID sent to WhatsApp.");
        console.log("[SESSION] Save the SESSION_ID secret before the next run.");

        fs.rmSync(ARCHIVE, { force: true });
    } catch (error) {
        sessionUploaded = false;
        console.error("[SESSION UPLOAD ERROR]", error.message);
    }
}

function isOwner(jid) {
    const number = String(jid || "")
        .split("@")[0]
        .replace(/\D/g, "");

    return Boolean(OWNER && number === OWNER);
}

function getText(message) {
    const m = message.message || {};

    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        m.buttonsResponseMessage?.selectedButtonId ||
        m.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ""
    );
}

async function handleMessages(update) {
    if (update.type !== "notify") return;

    for (const msg of update.messages || []) {
        try {
            if (!msg.message || msg.key.fromMe) continue;

            const chat = msg.key.remoteJid;
            if (!chat || chat === "status@broadcast") continue;

            const text = getText(msg).trim();
            if (!text.startsWith(PREFIX)) continue;

            const parts = text.slice(PREFIX.length).trim().split(/\s+/);
            const name = (parts.shift() || "").toLowerCase();
            const plugin = commands.get(name);

            if (!plugin) continue;

            const sender = msg.key.participant || chat;
            const owner = isOwner(sender);

            if (plugin.ownerOnly && !owner) {
                await sock.sendMessage(chat, {
                    text: "This command is only for the bot owner."
                }, { quoted: msg });
                continue;
            }

            await plugin.handler(sock, msg, parts, {
                sock,
                msg,
                args: parts,
                sender,
                chat,
                owner,
                config,
                startTime: global.startTime,
                uptime: () => Math.floor((Date.now() - global.startTime) / 1000)
            });

            console.log(`[COMMAND] ${name}`);
        } catch (error) {
            console.error("[MESSAGE ERROR]", error.message);
        }
    }
}

async function startBot() {
    if (stopping) return;

    cleanDirectories();
    loadPlugins();

    try {
        const hasSession = await restoreSession();

        const { state, saveCreds } =
            await useMultiFileAuthState(SESSION_DIR);

        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            logger,
            auth: state,
            browser: Browsers.ubuntu("Chrome"),
            printQRInTerminal: false,
            syncFullHistory: false,
            markOnlineOnConnect: false
        });

        sock.ev.on("creds.update", saveCreds);
        sock.ev.on("messages.upsert", handleMessages);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            // QR login is intentionally disabled.
            if (connection === "connecting") {
                console.log("[WHATSAPP] Connecting...");
            }

            if (connection === "open") {
                console.log("✅ DARK DILA-MD CONNECTED!");
                console.log(`[PLUGIN] Active commands: ${commands.size}`);

                if (!hasSession) {
                    await uploadSession();
                }
            }

            if (connection === "close") {
                const status = lastDisconnect?.error?.output?.statusCode;

                console.log("[WHATSAPP] Connection closed:", status);

                if (
                    status === DisconnectReason.loggedOut ||
                    !config.AUTO_RECONNECT
                ) {
                    console.log("[WHATSAPP] Session logged out. New Pair Code required.");
                    return;
                }

                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(() => {
                    startBot();
                }, Number(config.RECONNECT_DELAY) || 5000);
            }
        });

        if (!state.creds.registered && !hasSession && !pairingStarted) {
            pairingStarted = true;

            const number = String(
    process.env.PAIRING_NUMBER ||
    process.env.OWNER_NUMBER ||
    config.OWNER_NUMBER ||
    ""
).replace(/\D/g, "");

            if (!number) {
                throw new Error("Add PAIRING_NUMBER in GitHub Secrets.");
            }

            await new Promise(resolve => setTimeout(resolve, 3000));

            const code = await sock.requestPairingCode(number);

            console.log("\n================================");
            console.log(" DARK DILA-MD PAIR CODE");
            console.log(code);
            console.log("================================\n");
        }

    } catch (error) {
        console.error("[START ERROR]", error.message);
        process.exitCode = 1;
    }
}

global.startTime = Date.now();

process.on("SIGINT", () => {
    stopping = true;
    clearTimeout(reconnectTimer);
    if (sock) sock.end(undefined);
    process.exit(0);
});

process.on("SIGTERM", () => {
    stopping = true;
    clearTimeout(reconnectTimer);
    if (sock) sock.end(undefined);
    process.exit(0);
});

startBot();
