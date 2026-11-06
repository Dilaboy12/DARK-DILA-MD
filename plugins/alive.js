module.exports = {
  command: "alive",
  description: "Check bot status",
  category: "main",

  handler: async (sock, msg, args, { config }) => {
    const uptime = process.uptime();

    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const text =
      `╭━━〔 ${config.BOT_NAME} 〕━━╮\n\n` +
      `┃ ✅ Status: Online\n` +
      `┃ 🤖 Bot: ${config.BOT_NAME}\n` +
      `┃ 📦 Version: ${config.VERSION}\n` +
      `┃ ⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s\n` +
      `┃ 👑 Owner: ${config.OWNER_NAME}\n\n` +
      `╰━━━━━━━━━━━━━━━━╯\n` +
      `${config.FOOTER}`;

    await sock.sendMessage(
      msg.key.remoteJid,
      { text },
      { quoted: msg }
    );
  }
};
