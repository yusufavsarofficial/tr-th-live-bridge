const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");

function createContactRouter(storage) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", (req, res) => {
    storage.getContacts(req.user.sub).then(contacts => {
      res.json({ ok: true, contacts });
    });
  });

  router.post("/search", (req, res) => {
    const { query } = req.body || {};
    if (!query || String(query).trim().length < 3) {
      return res.status(400).json({ ok: false, error: "Query must be at least 3 characters." });
    }
    storage.searchUsers(query).then(users => {
      const filtered = users.filter(u => u.id !== req.user.sub).map(u => ({
        id: u.id,
        phoneNumber: u.phoneNumber,
        displayName: u.displayName,
      }));
      res.json({ ok: true, users: filtered });
    });
  });

  router.post("/add", (req, res) => {
    const { contactUserId, displayName } = req.body || {};
    if (!contactUserId) return res.status(400).json({ ok: false, error: "contactUserId is required." });
    if (contactUserId === req.user.sub) return res.status(400).json({ ok: false, error: "Cannot add yourself." });
    storage.addContact(req.user.sub, contactUserId, displayName).then(contact => {
      if (!contact) return res.status(404).json({ ok: false, error: "User not found." });
      res.json({ ok: true, contact });
    });
  });

  router.delete("/:contactId", (req, res) => {
    storage.removeContact(req.user.sub, req.params.contactId).then(() => {
      res.json({ ok: true });
    });
  });

  return router;
}

module.exports = { createContactRouter };
