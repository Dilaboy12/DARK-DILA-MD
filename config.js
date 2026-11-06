// config.js
module.exports = {
  BOT_NAME: "DARK DILA-MD",
  VERSION: "1.0.0",
  PREFIX: ".",
  OWNER_NAME: "Dilshan Ashinsa",
  OWNER_NUMBER: process.env.OWNER_NUMBER || "",
  OWNER_ALERTS: process.env.OWNER_ALERTS === "true",
  LOGIN_METHOD: process.env.LOGIN_METHOD || "both",
  PAIRING_NUMBER: process.env.PAIRING_NUMBER || ""
};
