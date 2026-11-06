const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const config = require("./config");

const PREFIX = config.PREFIX;
const plugins = [];

function loadPlugins() {
  const dir = path.join(__dirname, "plugins");

  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".js")) continue;

    try {
      const plugin = require(path.join(dir, file));
      if (plugin.command && plugin.handler) {
        plugins.push(plugin);
        console.log(`✅ Loaded: ${file}`);
      }
    } catch (error) {
      console.log(`❌ Plugin error: ${file}`, error.message);
    }
  }
}

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("./session");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    browser: Browsers.ubuntu("DARK DILA-MD"),
    printQRInTerminal: false,
    markOnlineOnConnect: settings.ALWAYS_ONLINE
  });

  sock.ev.on("creds.update", saveCreds);

  let pairingRequested = false;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && config.LOGIN_METHOD !== "pair") {
      const qrcode = require("qrcode-terminal");
      qrcode.generate(qr, { small: true });
      console.log("📲 Scan the QR code with WhatsApp.");
    }

    if (
      connection === "connecting" &&
      !state.creds.registered &&
      config.LOGIN_METHOD !== "qr" &&
      !pairingRequested
    ) {
      const number = config.PAIRING_NUMBER.replace(/\D/g, "");

      if (number) {
        pairingRequested = true;
        try {
          const code = await sock.requestPairingCode(number);
          console.log("PAIR CODE:", code);
        } catch (error) {
          pairingRequested = false;
          console.log("Pairing error:", error.message);
        }
      }
    }

    if (connection === "open") {
      console.log("✅ DARK DILA-MD CONNECTED!");
      console.log("🤖 Version:", config.VERSION);

      if (config.OWNER_ALERTS && config.OWNER_NUMBER) {
        try {
          const instanceId = crypto.randomUUID().slice(0, 8);

          await sock.sendMessage(
            config.OWNER_NUMBER.replace(/\D/g, "") + "@s.whatsapp.net",
            {
              text:
                `🔔 DARK DILA-MD INSTANCE CONNECTED\n\n` +
                `🤖 Bot: ${config.BOT_NAME}\n` +
                `📦 Version: ${config.VERSION}\n` +
                `🆔 Instance: ${instanceId}\n` +
                `⚙️ Status: Connected\n\n` +
                `© DARK DILA-MD`
            }
          );

          console.log("✅ Owner notification sent.");
        } catch (error) {
          console.log("Owner notification failed:", error.message);
        }
      }
    }

    if (connection === "close") {
      const status =
        lastDisconnect?.error?.output?.statusCode;

      if (status !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting...");
        startBot();
      } else {
        console.log("❌ Session logged out. Login again.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      if (!jid || jid === "status@broadcast") continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text.startsWith(PREFIX)) continue;

      const args = text.slice(PREFIX.length).trim().split(/\s+/);
      const command = args.shift()?.toLowerCase();

      for (const plugin of plugins) {
        if (plugin.command.toLowerCase() === command) {
          try {
            await plugin.handler(sock, msg, args, {
              config,
              settings,
              command
            });
          } catch (error) {
            console.log("Command error:", error);
            await sock.sendMessage(jid, {
              text: "❌ Command error occurred."
            });
          }
          break;
        }
      }
    }
  });
}

loadPlugins();
startBot().catch(console.error);
