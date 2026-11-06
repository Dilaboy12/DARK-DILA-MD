
const config = require("../config");

/**
 * Get message text from different WhatsApp message types.
 */
function getMessageText(message) {
    if (!message) return "";

    const msg = message.message || message;

    return (
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.documentMessage?.caption ||
        msg.buttonsResponseMessage?.selectedButtonId ||
        msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
        msg.templateButtonReplyMessage?.selectedId ||
        ""
    );
}

/**
 * Normalize WhatsApp JID.
 */
function normalizeJid(jid = "") {
    return jid.replace(/:\d+@/, "@");
}

/**
 * Check whether a JID belongs to the configured owner.
 */
function isOwner(jid = "") {
    const ownerNumber = String(config.OWNER_NUMBER || "")
        .replace(/\D/g, "");

    const senderNumber = normalizeJid(jid)
        .split("@")[0]
        .replace(/\D/g, "");

    return Boolean(ownerNumber && senderNumber === ownerNumber);
}

/**
 * Format uptime.
 */
function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

/**
 * Get current Sri Lankan time.
 */
function getTime() {
    return new Date().toLocaleString("en-GB", {
        timeZone: config.TIMEZONE || "Asia/Colombo"
    });
}

/**
 * Get bot information.
 */
function getBotInfo() {
    return {
        name: config.BOT_NAME,
        version: config.VERSION,
        owner: config.OWNER_NAME,
        prefix: config.PREFIX,
        footer: config.FOOTER
    };
}

module.exports = {
    getMessageText,
    normalizeJid,
    isOwner,
    formatUptime,
    getTime,
    getBotInfo
};
