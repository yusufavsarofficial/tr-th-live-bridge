const dotenv = require("dotenv");

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requireStrongSecret(name, minimumLength = 32) {
  const value = required(name);
  if (value.includes("CHANGE_ME") || value.length < minimumLength) {
    throw new Error(`${name} must be a strong production secret.`);
  }
  return value;
}

function getUsers() {
  return [
    {
      username: required("USER_A_USERNAME"),
      displayName: required("USER_A_DISPLAY_NAME"),
      passwordHash: required("USER_A_PASSWORD"),
      lang: required("USER_A_LANG")
    },
    {
      username: required("USER_B_USERNAME"),
      displayName: required("USER_B_DISPLAY_NAME"),
      passwordHash: required("USER_B_PASSWORD"),
      lang: required("USER_B_LANG")
    }
  ];
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: requireStrongSecret("JWT_SECRET", 48),
  messageEncryptionKey: requireStrongSecret("MESSAGE_ENCRYPTION_KEY", 32),
  privateRoomCode: required("PRIVATE_ROOM_CODE"),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  apkDownloadUrl: process.env.APK_DOWNLOAD_URL || "",
  translationProvider: process.env.TRANSLATION_PROVIDER || "openai",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  turn: {
    url: process.env.TURN_URL || "",
    username: process.env.TURN_USERNAME || "",
    password: process.env.TURN_PASSWORD || ""
  },
  getUsers
};

module.exports = { env };
