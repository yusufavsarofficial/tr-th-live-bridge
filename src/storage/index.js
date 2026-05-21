const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let _fileInstance = null;
let _prismaPromise = null;
let _resolvedStorage = null;

/**
 * Returns a storage implementation.
 * If DATABASE_URL is set, uses Prisma (PostgreSQL or SQLite).
 * Otherwise falls back to file-based storage.
 */
function getStorage() {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl) {
    if (!_fileInstance) _fileInstance = createFileStorage();
    return _fileInstance;
  }

  if (!_prismaPromise) {
    _prismaPromise = (async () => {
      const { createPrismaStorage } = require("./prisma");
      return createPrismaStorage();
    })();
  }

  return {
    then: (resolve, reject) => _prismaPromise.then(resolve, reject),
    catch: (reject) => _prismaPromise.catch(reject),
  };
}

/** Resolve to the actual storage (works for both file and prisma) */
async function getStorageAsync() {
  if (_resolvedStorage) return _resolvedStorage;
  const s = getStorage();
  _resolvedStorage = s.then ? await s : s;
  return _resolvedStorage;
}

// ─── File-based storage (legacy fallback) ─────────────────────

function createFileStorage() {
  const config = require("../config").config;
  const DATA_DIR = path.dirname(config.dataFile);
  const USERS_FILE = path.join(DATA_DIR, "users.json");
  const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");
  const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");

  function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }
  function readJSON(fp, fallback) { try { if (!fs.existsSync(fp)) return fallback; const r = fs.readFileSync(fp, "utf8"); return r.trim() ? JSON.parse(r) : fallback; } catch { return fallback; } }
  function writeJSON(fp, data) { ensureDir(); fs.writeFileSync(fp, JSON.stringify(data, null, 2) + "\n", "utf8"); }

  function readUsers() { return readJSON(USERS_FILE, []); }
  function writeUsers(u) { writeJSON(USERS_FILE, u); }
  function findUserByPhone(pn) { return readUsers().find(u => u.phoneNumber === pn) || null; }
  function findUserById(id) { return readUsers().find(u => u.id === id) || null; }

  function createUser(data) {
    const users = readUsers();
    const now = new Date().toISOString();
    const user = { id: crypto.randomUUID(), phoneNumber: data.phoneNumber, displayName: data.displayName || null, avatarUrl: data.avatarUrl || null, about: data.about || null, createdAt: now, updatedAt: now, lastSeen: now };
    users.push(user);
    writeUsers(users);
    return user;
  }

  function updateUser(id, updates) {
    const users = readUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
    writeUsers(users);
    return users[idx];
  }

  function searchUsers(query) {
    const q = String(query || "").toLowerCase();
    if (!q || q.length < 3) return [];
    return readUsers().filter(u => u.phoneNumber.includes(q) || (u.displayName || "").toLowerCase().includes(q)).slice(0, 20).map(u => ({ id: u.id, phoneNumber: u.phoneNumber, displayName: u.displayName }));
  }

  function readContacts() { return readJSON(CONTACTS_FILE, []); }
  function writeContacts(c) { writeJSON(CONTACTS_FILE, c); }

  function getContacts(userId) {
    return readContacts().filter(c => c.userId === userId).map(c => {
      const contactUser = findUserById(c.contactUserId);
      return { id: c.id, contactUserId: c.contactUserId, displayName: c.displayName || contactUser?.displayName || null, phoneNumber: contactUser?.phoneNumber || null, createdAt: c.createdAt };
    });
  }

  function addContact(userId, contactUserId, displayName) {
    const contactUser = findUserById(contactUserId);
    if (!contactUser) return null;
    const contacts = readContacts();
    const existing = contacts.find(c => c.userId === userId && c.contactUserId === contactUserId);
    if (existing) return existing;
    const contact = { id: crypto.randomUUID(), userId, contactUserId, displayName: displayName || null, createdAt: new Date().toISOString() };
    contacts.push(contact);
    writeContacts(contacts);
    return contact;
  }

  function removeContact(userId, contactId) {
    const contacts = readContacts().filter(c => !(c.userId === userId && c.id === contactId));
    writeContacts(contacts);
  }

  function readConversations() { return readJSON(CONVERSATIONS_FILE, []); }
  function writeConversations(c) { writeJSON(CONVERSATIONS_FILE, c); }

  function getConversations(userId) {
    return readConversations().filter(c => c.participants.includes(userId)).map(c => {
      const otherId = c.participants.find(id => id !== userId);
      const otherUser = otherId ? findUserById(otherId) : null;
      return { id: c.id, participants: c.participants, otherUser: otherUser ? { id: otherUser.id, displayName: otherUser.displayName, phoneNumber: otherUser.phoneNumber, avatarUrl: otherUser.avatarUrl } : null, lastMessage: c.lastMessage || null, unreadCount: c.unreadCount?.[userId] || 0, updatedAt: c.updatedAt, createdAt: c.createdAt };
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  function createConversation(participantIds) {
    const conversations = readConversations();
    const existing = conversations.find(c => participantIds.every(id => c.participants.includes(id)) && c.participants.length === participantIds.length);
    if (existing) return existing;
    const now = new Date().toISOString();
    const conv = { id: crypto.randomUUID(), participants: participantIds, lastMessage: null, unreadCount: {}, updatedAt: now, createdAt: now };
    conversations.push(conv);
    writeConversations(conversations);
    return conv;
  }

  function getConversationById(convId) {
    return readConversations().find(c => c.id === convId) || null;
  }

  function updateConversation(convId, updates) {
    const conversations = readConversations();
    const idx = conversations.findIndex(c => c.id === convId);
    if (idx === -1) return null;
    conversations[idx] = { ...conversations[idx], ...updates, updatedAt: new Date().toISOString() };
    writeConversations(conversations);
    return conversations[idx];
  }

  function readHistory() { return readJSON(config.dataFile, { history: [] }).history || []; }
  function persistHistory(history) { writeJSON(config.dataFile, { history }); }

  function saveMessage(conversationId, message) {
    const messagesFile = path.join(DATA_DIR, `messages-${conversationId}.json`);
    const messages = readJSON(messagesFile, []);
    messages.push(message);
    writeJSON(messagesFile, messages);
    return message;
  }

  function getMessages(conversationId) {
    const messagesFile = path.join(DATA_DIR, `messages-${conversationId}.json`);
    return readJSON(messagesFile, []);
  }

  function readNotificationState() { return readJSON(config.notificationFile, null); }
  function persistNotificationState(vapidKeys, subscriptions) {
    writeJSON(config.notificationFile, { vapidKeys, subscriptions: Array.from(subscriptions.values()) });
  }

  // ─── FCM Tokens (file-based fallback) ───────
  const FCM_TOKENS_FILE = path.join(DATA_DIR, "fcm-tokens.json");
  function readFcmTokens() { return readJSON(FCM_TOKENS_FILE, []); }
  function writeFcmTokens(t) { writeJSON(FCM_TOKENS_FILE, t); }

  function saveFcmToken(userId, token, platform = "android") {
    const tokens = readFcmTokens();
    const idx = tokens.findIndex(t => t.token === token);
    if (idx >= 0) { tokens[idx] = { ...tokens[idx], userId, platform, updatedAt: new Date().toISOString() }; }
    else { tokens.push({ id: crypto.randomUUID(), userId, token, platform, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); }
    writeFcmTokens(tokens);
    return tokens.find(t => t.token === token);
  }

  function getFcmTokens(userId) {
    return readFcmTokens().filter(t => t.userId === userId).map(t => t.token);
  }

  function removeFcmToken(token) {
    writeFcmTokens(readFcmTokens().filter(t => t.token !== token));
  }

  // Wrap all methods to return promises (async-compatible with Prisma storage)
  const sync = {
    findUserByPhone, findUserById, createUser, updateUser, searchUsers,
    getContacts, addContact, removeContact,
    getConversations, createConversation, getConversationById, updateConversation,
    readHistory, persistHistory, saveMessage, getMessages,
    readNotificationState, persistNotificationState,
    saveFcmToken, getFcmTokens, removeFcmToken,
  };
  const async = {};
  for (const [k, fn] of Object.entries(sync)) {
    async[k] = (...args) => Promise.resolve(fn(...args));
  }
  return async;
}

module.exports = { createFileStorage, getStorage, getStorageAsync };
