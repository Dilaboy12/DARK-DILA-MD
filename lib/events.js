const config = require("../config");
const commands = require("./commands");
const {
    getMessageText,
    normalizeJid,
    isOwner
} = require("./functions");

const startTime = Date.now();

function getSender(message) {
    return normalizeJid(
        message.key.participant ||
        message.key.remoteJid ||
        ""
    );
}

function getMessageType(message) {
    return message.messageType ||
        Object.keys(message.message || {})[0] ||
        "";
}

function registerEvents(sock) {

    // WhatsApp connection events
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && config.QR_LOGIN) {
            console.log("[LOGIN] QR code received.");
        }

        if (connection === "connecting") {
            console.log("[WHATSAPP] Connecting...");
        }

        if (connection === "open") {
            console.log(`[WHATSAPP] ${config.BOT_NAME} Connected!`);
        }

        if (connection === "close") {
            const statusCode =
                lastDisconnect?.error?.output?.statusCode;

            console.log("[WHATSAPP] Connection closed:", statusCode);
        }
    });

    // Incoming message events
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
            try {
                if (!msg.message || msg.key.fromMe) continue;

                const sender = getSender(msg);
                const chat = msg.key.remoteJid;

                if (!chat) continue;

                const text = getMessageText(msg).trim();

                if (!text) continue;

                const prefix = config.PREFIX || ".";
                if (!text.startsWith(prefix)) continue;

                const parts = text.slice(prefix.length).trim().split(/\s+/);
                const commandName = (parts.shift() || "").toLowerCase();
                const args = parts;

                if (!commandName) continue;

                const plugin = commands.get(commandName);

                if (!plugin) continue;

                const owner = isOwner(sender);

                if (plugin.ownerOnly && !owner) {
                    await sock.sendMessage(chat, {
                        text: "❌ This command is only available to the bot owner."
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
                    startTime,
                    uptime: () => Math.floor((Date.now() - startTime) / 1000)
                };

                await plugin.handler(sock, msg, args, context);

                if (config.COMMAND_LOGS) {
                    console.log(
                        `[COMMAND] ${commandName} | ${sender}`
                    );
                }

            } catch (error) {
                console.error("[MESSAGE ERROR]", error);

                try {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: "❌ Command එක ක්‍රියාත්මක කිරීමේදී දෝෂයක් ඇතිවුණා."
                    }, { quoted: msg });
                } catch (sendError) {
                    console.error("[ERROR REPLY]", sendError.message);
                }
            }
        }
    });

    console.log("[EVENTS] WhatsApp events registered.");
}

module.exports = {
    registerEvents,
    startTime
};
