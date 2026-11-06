
/*
╔══════════════════════════════════╗
       DARK DILA-MD
       MAIN BOT ENGINE v1.0.0
╚══════════════════════════════════╝
*/

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  jidNormalizedUser,
  getContentType
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");
const path = require("path");
const config = require("./config");

// =================================
// BASIC CONFIGURATION
// =================================

const PREFIX = config.PREFIX;
const OWNER_NUMBER = config.OWNER_NUMBER;

const SESSION_DIR = path.join(__dirname, "session");
const PLUGIN_DIR = path.join(__dirname, "plugins");

let plugins = [];
let reconnecting = false;

// =================================
// HELPERS
// =================================

function normalizeNumber(jid) {
  if (!jid) return "";

  return jidNormalizedUser(jid)
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");
}

function isOwner(jid) {
  if (!OWNER_NUMBER || !jid) return false;

  return normalizeNumber(jid) ===
    normalizeNumber(OWNER_NUMBER);
}

function getMessageText(message) {
  if (!message) return "";

  const type = getContentType(message);

  if (type === "conversation") {
    return message.conversation;
  }

  if (type === "extendedTextMessage") {
    return message.extendedTextMessage.text;
  }

  if (type === "imageMessage") {
    return message.imageMessage.caption || "";
  }

  if (type === "videoMessage") {
    return message.videoMessage.caption || "";
  }

  return "";
}

// =================================
// PLUGIN LOADER
// =================================

function loadPlugins() {
  if (!fs.existsSync(PLUGIN_DIR)) {
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  }

  plugins = [];

  const files = fs.readdirSync(PLUGIN_DIR);

  for (const file of files) {
    if (!file.endsWith(".js")) continue;

    try {
      const pluginPath = path.join(PLUGIN_DIR, file);

      delete require.cache[require.resolve(pluginPath)];

      const plugin = require(pluginPath);

      if (plugin.command && typeof plugin.handler === "function") {
        plugins.push(plugin);

        console.log(`✅ Plugin Loaded: ${file}`);
      }

    } catch (error) {
      console.log(`❌ Plugin Error: ${file}`);
      console.log(error.message);
    }
  }

  console.log(`📦 TOTAL PLUGINS: ${plugins.length}`);
}

// =================================
// OWNER NOTIFICATION
// =================================

async function sendOwnerNotification(sock) {
  if (!config.OWNER_ALERTS || !OWNER_NUMBER) return;

  try {
    const ownerJid =
      normalizeNumber(OWNER_NUMBER) + "@s.whatsapp.net";

    await sock.sendMessage(ownerJid, {
      text:
        `🔔 NEW CONNECTION\n\n` +
        `🤖 Bot: ${config.BOT_NAME}\n` +
        `📦 Version: ${config.VERSION}\n` +
        `👑 Owner: ${config.OWNER_NAME}\n` +
        `⚙️ Status: Connected\n\n` +
        `© ${config.BOT_NAME}`
    });

    console.log("✅ Owner notification sent.");

  } catch (error) {
    console.log("❌ Owner notification failed:", error.message);
  }
}

// =================================
// START BOT
// =================================

async function startBot() {
  console.log("🚀 Starting DARK DILA-MD...");

  const { state, saveCreds } =
    await useMultiFileAuthState(SESSION_DIR);

  const sock = makeWASocket({
    auth: state,

    logger: P({ level: "silent" }),

    browser: Browsers.ubuntu(config.BOT_NAME),

    markOnlineOnConnect: config.ALWAYS_ONLINE,

    syncFullHistory: false
  });

  sock.ev.on("creds.update", saveCreds);

  // =================================
  // PAIR CODE LOGIN
  // =================================

  if (
    !state.creds.registered &&
    config.PAIR_CODE_LOGIN &&
    config.LOGIN_METHOD !== "qr"
  ) {
    const number = String(config.PAIRING_NUMBER || "")
      .replace(/\D/g, "");

    if (number) {
      try {
        const code = await sock.requestPairingCode(number);

        console.log("\n");
        console.log("╔══════════════════════════╗");
        console.log("       DARK DILA-MD");
        console.log("╚══════════════════════════╝");
        console.log("🔐 PAIR CODE:", code);
        console.log("📲 Enter this code in WhatsApp.");
        console.log("\n");

      } catch (error) {
        console.log("❌ Pair Code Error:", error.message);
      }
    } else {
      console.log("⚠️ PAIRING_NUMBER is missing.");
    }
  }

  // =================================
  // CONNECTION UPDATE
  // =================================

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (
      qr &&
      config.QR_LOGIN &&
      config.LOGIN_METHOD !== "pair"
    ) {
      const qrcode = require("qrcode-terminal");

      console.log("📲 SCAN THIS QR CODE:");

      qrcode.generate(qr, { small: true });
    }

    if (connection === "connecting") {
      console.log("🔄 Connecting to WhatsApp...");
    }

    if (connection === "open") {
      console.log("\n");
      console.log("╔════════════════════════════╗");
      console.log("    DARK DILA-MD CONNECTED");
      console.log("╚════════════════════════════╝");

      console.log("🤖 BOT:", config.BOT_NAME);
      console.log("📦 VERSION:", config.VERSION);
      console.log("👑 OWNER:", config.OWNER_NAME);
      console.log("⚡ STATUS: ONLINE");

      console.log("\n");

      await sendOwnerNotification(sock);
    }

    if (connection === "close") {
      const status =
        lastDisconnect?.error?.output?.statusCode;

      console.log("❌ WhatsApp connection closed:", status);

      if (
        status !== DisconnectReason.loggedOut &&
        config.AUTO_RECONNECT &&
        !reconnecting
      ) {
        reconnecting = true;

        console.log("🔄 Reconnecting...");

        setTimeout(async () => {
          try {
            await startBot();
          } catch (error) {
            console.log("Reconnect error:", error.message);
          } finally {
            reconnecting = false;
          }
        }, config.RECONNECT_DELAY);
      } else if (status === DisconnectReason.loggedOut) {
        console.log("❌ Session logged out. Login again.");
      }
    }
  });

  // =================================
  // MESSAGE HANDLER
  // =================================

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;

        if (!jid || jid === "status@broadcast") continue;

        if (config.AUTO_READ) {
          await sock.readMessages([msg.key]);
        }

        const text = getMessageText(msg.message).trim();

        if (!text.startsWith(PREFIX)) continue;

        const args = text
          .slice(PREFIX.length)
          .trim()
          .split(/\s+/);

        const command = args.shift()?.toLowerCase();

        if (!command) continue;

        const sender = msg.key.participant || jid;

        const owner = isOwner(sender);

        console.log(
          `📩 COMMAND: ${command} | FROM: ${normalizeNumber(sender)}`
        );

        // Find Plugin
        const plugin = plugins.find(p => {
          const names = Array.isArray(p.command)
            ? p.command
            : [p.command];

          return names.some(name =>
            config.CASE_SENSITIVE
              ? name === command
              : String(name).toLowerCase() === command
          );
        });

        if (!plugin) continue;

        // Owner-only protection
        if (plugin.ownerOnly && !owner) {
          await sock.sendMessage(jid, {
            text: "❌ This command is only for the Bot Owner."
          }, { quoted: msg });

          continue;
        }

        await plugin.handler(sock, msg, args, {
          config,
          command,
          isOwner: owner,
          sender,
          settings: config
        });

      } catch (error) {
        console.log("❌ MESSAGE HANDLER ERROR:", error.message);
      }
    }
  });

  return sock;
}

// =================================
// INITIALIZE
// =================================

async function main() {
  console.log("================================");
  console.log("       DARK DILA-MD");
  console.log("================================");

  console.log("📦 Loading Plugins...");

  loadPlugins();

  console.log("🤖 Initializing WhatsApp...");

  await startBot();
}

main().catch(error => {
  console.error("❌ BOT START ERROR:", error);
  process.exit(1);
});
