const { Router } = require("express");
const { generateOTP, verifyOTP, createToken } = require("../services/auth");
const { requireAuth } = require("../middleware/auth");

const ALLOWED_USERS = (process.env.ALLOWED_USERS || "").split(",").map(s => s.trim()).filter(Boolean);

function createAuthRouter(storage) {
  const router = Router();

  router.post("/otp/request", (req, res) => {
    const { phoneNumber } = req.body || {};
    // Whitelist check
    if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(phoneNumber)) {
      return res.status(403).json({ ok: false, error: "Bu uygulamaya kayıtlı değilsiniz." });
    }
    const result = generateOTP(phoneNumber);
    if (result.error) return res.status(400).json({ ok: false, error: result.error });
    // Detect language from prefix
    const lang = phoneNumber?.startsWith("+66") ? "th" : phoneNumber?.startsWith("+90") ? "tr" : "en";
    res.json({ ok: true, devOtp: result.devOtp, lang });
  });

  router.post("/otp/verify", async (req, res) => {
    const { phoneNumber, otp } = req.body || {};

    if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(phoneNumber)) {
      return res.status(403).json({ ok: false, error: "Bu uygulamaya kayıtlı değilsiniz." });
    }

    const result = verifyOTP(phoneNumber, otp);
    if (result.error) return res.status(400).json({ ok: false, error: result.error });

    let user = await storage.findUserByPhone(phoneNumber);
    if (!user) {
      user = await storage.createUser({ phoneNumber });
    }

    const lang = phoneNumber?.startsWith("+66") ? "th" : phoneNumber?.startsWith("+90") ? "tr" : "en";
    const token = createToken(user);
    res.json({
      ok: true,
      token,
      lang,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName || null,
        avatarUrl: user.avatarUrl || null,
        about: user.about || null,
      },
    });
  });

  router.get("/me", requireAuth, async (req, res) => {
    const user = await storage.findUserById(req.user.sub);
    if (!user) return res.status(404).json({ ok: false, error: "User not found." });
    res.json({
      ok: true,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName || null,
        avatarUrl: user.avatarUrl || null,
        about: user.about || null,
      },
    });
  });

  router.post("/profile", requireAuth, async (req, res) => {
    const { displayName, avatarUrl, about } = req.body || {};
    const user = await storage.updateUser(req.user.sub, { displayName, avatarUrl, about });
    if (!user) return res.status(404).json({ ok: false, error: "User not found." });
    res.json({
      ok: true,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName || null,
        avatarUrl: user.avatarUrl || null,
        about: user.about || null,
      },
    });
  });

  return router;
}

module.exports = { createAuthRouter };
