const os = require("os");

module.exports = {
    command: ["alive", "status", "runtime", "uptime"],

    handler: async (sock, msg, args, ctx) => {
        try {
            const chat = ctx.chat;
            const pushname = msg.pushName || "User";

            const uptimeSeconds = Math.floor(process.uptime());

            const days = Math.floor(uptimeSeconds / 86400);
            const hours = Math.floor((uptimeSeconds % 86400) / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const seconds = uptimeSeconds % 60;

            const uptime =
                `${days}d ${hours}h ${minutes}m ${seconds}s`;

            const usedRam = (
                process.memoryUsage().heapUsed / 1024 / 1024
            ).toFixed(2);

            const totalRam = (
                os.totalmem() / 1024 / 1024
            ).toFixed(2);

            const status = `
👋 *HELLO ${pushname} I'M ALIVE NOW!*

╭━━〔 *DARK DILA-MD* 〕━━┈⊷
┃
┃ ◈ ⏳ *Uptime:* ${uptime}
┃ ◈ 📟 *RAM:* ${usedRam} MB
┃ ◈ 💻 *System RAM:* ${totalRam} MB
┃ ◈ ⚙️ *Host:* ${os.hostname()}
┃ ◈ 👨‍💻 *Owner:* DARK DILA-MD
┃ ◈ 🧬 *Version:* 1.0.0
┃
╰━━━━━━━━━━━━━━━

> *POWERED BY DARK DILA-MD* ⚡
`;

            await sock.sendMessage(chat, {
                text: status
            }, {
                quoted: msg
            });

        } catch (error) {
            console.error("[ALIVE ERROR]", error);

            await sock.sendMessage(ctx.chat, {
                text: "❌ Alive command error: " + error.message
            }, {
                quoted: msg
            });
        }
    }
};
