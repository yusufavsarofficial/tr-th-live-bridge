const twilio = require("twilio");

let _client = null;

function getClient() {
  if (_client) return _client;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  _client = twilio(accountSid, authToken);
  return _client;
}

function isConfigured() {
  return !!getClient();
}

async function sendOtp(phoneNumber, otp) {
  const client = getClient();
  if (!client) {
    console.warn("Twilio not configured. OTP not sent.");
    return false;
  }
  try {
    await client.messages.create({
      body: `Nova doğrulama kodunuz: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
    return true;
  } catch (err) {
    console.error("Twilio send error:", err.message);
    return false;
  }
}

module.exports = { sendOtp, isConfigured };
