
module.exports = {
  BOT_NAME: "DARK DILA-MD",
  VERSION: "1.0.0",

  PREFIX: ".",

  OWNER_NAME: "Dilshan Ashinsa",
  OWNER_NUMBER: process.env.OWNER_NUMBER || "94772194789",

  // WhatsApp Session
  SESSION_ID: process.env.SESSION_ID || "",
  SESSION_PREFIX: "DARK-DILA-MD=",

  // Login Settings
  LOGIN_METHOD: process.env.LOGIN_METHOD || "both",
  PAIRING_NUMBER: process.env.PAIRING_NUMBER || "",

  // Owner Notifications
  OWNER_ALERTS: process.env.OWNER_ALERTS === "true",

  MODE: "public"
};
