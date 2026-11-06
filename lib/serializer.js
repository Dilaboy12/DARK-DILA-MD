const {
    getContentType,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

function serializeMessage(sock, message) {
    if (!message || !message.message) return null;

    const type = getContentType(message.message);
    const content = message.message[type];

    const sender = jidNormalizedUser(
        message.key.participant ||
        message.key.remoteJid ||
        ""
    );

    const chat = jidNormalizedUser(
        message.key.remoteJid || ""
    );

    let text = "";

    if (type === "conversation") {
        text = content || "";
    } else if (type === "extendedTextMessage") {
        text = content?.text || "";
    } else if (content?.caption) {
        text = content.caption;
    } else if (type === "buttonsResponseMessage") {
        text = content?.selectedButtonId || "";
    } else if (type === "listResponseMessage") {
        text = content?.singleSelectReply?.selectedRowId || "";
    }

    return {
        id: message.key.id,
        key: message.key,
        message,
        type,
        text,
        sender,
        chat,
        fromMe: Boolean(message.key.fromMe),
        isGroup: chat.endsWith("@g.us"),

        reply: async (replyText, options = {}) => {
            return sock.sendMessage(
                chat,
                {
                    text: String(replyText),
                    ...options
                },
                { quoted: message }
            );
        }
    };
}

module.exports = {
    serializeMessage
};
