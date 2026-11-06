
/*
╔══════════════════════════════╗
       DARK DILA-MD
       MAIN CONFIGURATION
╚══════════════════════════════╝
*/

const config = {

  // BOT INFORMATION
  BOT_NAME: "DARK DILA-MD",
  VERSION: "1.0.0",
  DESCRIPTION: "DARK DILA-MD WhatsApp Bot",
  AUTHOR: "Dilshan Ashinsa",
  FOOTER: "© POWERED BY DARK DILA-MD",

  // OWNER SETTINGS
  OWNER_NAME: "Dilshan Ashinsa",
  OWNER_NUMBER: process.env.OWNER_NUMBER || "",
  OWNER_ALERTS: true,

  // SESSION SETTINGS
  SESSION_ID: process.env.SESSION_ID || "",
  SESSION_PREFIX: "THENUVA-XMD=",
  SESSION_AUTO_SAVE: true,
  SESSION_AUTO_RESTORE: true,

  // LOGIN SETTINGS
  LOGIN_METHOD: "both",
  PAIRING_NUMBER: process.env.PAIRING_NUMBER || "",
  QR_LOGIN: true,
  PAIR_CODE_LOGIN: true,

  // COMMAND SETTINGS
  PREFIX: ".",
  CASE_SENSITIVE: false,
  COMMAND_LOGS: true,

  // BOT MODE
  MODE: "public",
  PUBLIC_MODE: true,
  PRIVATE_MODE: false,

  // MESSAGE SETTINGS
  AUTO_READ: false,
  AUTO_READ_STATUS: false,
  AUTO_TYPING: false,
  AUTO_RECORDING: false,
  AUTO_REPLY: false,

  // CONNECTION SETTINGS
  ALWAYS_ONLINE: false,
  AUTO_RECONNECT: true,
  RECONNECT_DELAY: 5000,

  // GROUP SETTINGS
  ANTI_LINK: false,
  ANTI_BADWORD: false,
  WELCOME: false,
  GOODBYE: false,

  // MEDIA SETTINGS
  AUTO_STICKER: false,
  AUTO_IMAGE: false,
  AUTO_VIDEO: false,

  // SECURITY SETTINGS
  ANTI_DELETE: false,
  ANTI_VIEW_ONCE: false,
  BLOCK_UNKNOWN: false,

  // MENU SETTINGS
  MENU_STYLE: "default",
  MENU_IMAGE: "",
  MENU_TITLE: "DARK DILA-MD MENU",

  // DATABASE SETTINGS
  DATABASE: "json",
  AUTO_BACKUP: true,

  // TIME SETTINGS
  TIMEZONE: "Asia/Colombo",
  LANGUAGE: "SI",

  // PLUGIN SETTINGS
  PLUGINS: true,
  PLUGIN_AUTO_LOAD: true

};

module.exports = config;
