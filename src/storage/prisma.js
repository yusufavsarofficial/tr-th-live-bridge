const { PrismaClient } = require("@prisma/client");
const path = require("path");

let _prisma = null;

function getPrisma() {
  if (!_prisma) {
    const provider = process.env.DB_PROVIDER || "sqlite";
    if (provider === "postgresql") {
      const { PrismaPg } = require("@prisma/adapter-pg");
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
      _prisma = new PrismaClient({ adapter });
    } else {
      const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
      const dbPath = path.join(__dirname, "..", "..", "dev.db");
      const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
      _prisma = new PrismaClient({ adapter });
    }
  }
  return _prisma;
}

async function createPrismaStorage() {
  const prisma = getPrisma();

  async function findUserByPhone(phoneNumber) {
    return prisma.user.findUnique({ where: { phoneNumber } });
  }

  async function findUserById(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  async function createUser(data) {
    return prisma.user.create({
      data: {
        phoneNumber: data.phoneNumber,
        displayName: data.displayName || null,
        avatarUrl: data.avatarUrl || null,
        about: data.about || null,
      },
    });
  }

  async function updateUser(id, updates) {
    const { phoneNumber, ...rest } = updates;
    return prisma.user.update({ where: { id }, data: rest });
  }

  async function searchUsers(query) {
    const q = String(query || "").toLowerCase();
    if (!q || q.length < 3) return [];
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { phoneNumber: { contains: q } },
          { displayName: { contains: q } },
        ],
      },
      take: 20,
      select: { id: true, phoneNumber: true, displayName: true },
    });
    return users;
  }

  async function getContacts(userId) {
    const contacts = await prisma.contact.findMany({
      where: { userId },
      include: { target: { select: { id: true, displayName: true, phoneNumber: true } } },
    });
    return contacts.map((c) => ({
      id: c.id,
      contactUserId: c.contactUserId,
      displayName: c.displayName || c.target.displayName || null,
      phoneNumber: c.target.phoneNumber,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async function addContact(userId, contactUserId, displayName) {
    const existing = await prisma.contact.findUnique({
      where: { userId_contactUserId: { userId, contactUserId } },
    });
    if (existing) return existing;

    const contact = await prisma.contact.create({
      data: { userId, contactUserId, displayName: displayName || null },
    });
    return contact;
  }

  async function removeContact(userId, contactId) {
    await prisma.contact.deleteMany({ where: { userId, id: contactId } });
  }

  async function getConversations(userId) {
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: { id: true, displayName: true, phoneNumber: true, avatarUrl: true } } },
            },
          },
        },
      },
    });

    return participations.map((p) => {
      const conv = p.conversation;
      const otherParticipant = conv.participants.find((pp) => pp.userId !== userId);
      const otherUser = otherParticipant?.user || null;
      return {
        id: conv.id,
        participants: conv.participants.map((pp) => pp.userId),
        otherUser: otherUser
          ? { id: otherUser.id, displayName: otherUser.displayName, phoneNumber: otherUser.phoneNumber, avatarUrl: otherUser.avatarUrl }
          : null,
        lastMessage: conv.lastMessage || null,
        unreadCount: p.unreadCount || 0,
        updatedAt: conv.updatedAt.toISOString(),
        createdAt: conv.createdAt.toISOString(),
      };
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async function createConversation(participantIds) {
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { every: { userId: { in: participantIds } } } },
          { participants: { none: { userId: { notIn: participantIds } } } },
        ],
      },
    });
    if (existing) return existing;

    const conv = await prisma.conversation.create({
      data: {
        participants: {
          create: participantIds.map((userId) => ({ userId, unreadCount: 0 })),
        },
      },
    });
    return conv;
  }

  async function getConversationById(convId) {
    const conv = await prisma.conversation.findUnique({
      where: { id: convId },
      include: {
        participants: {
          include: { user: { select: { id: true, displayName: true, phoneNumber: true, avatarUrl: true } } },
        },
      },
    });
    if (!conv) return null;

    return {
      id: conv.id,
      participants: conv.participants.map((p) => p.userId),
      lastMessage: conv.lastMessage || null,
      lastMessageSender: conv.lastMessageSender || null,
      unreadCount: Object.fromEntries(conv.participants.map((p) => [p.userId, p.unreadCount])),
      updatedAt: conv.updatedAt.toISOString(),
      createdAt: conv.createdAt.toISOString(),
    };
  }

  async function updateConversation(convId, updates) {
    const { unreadCount, ...rest } = updates;

    if (rest) {
      await prisma.conversation.update({
        where: { id: convId },
        data: { ...rest },
      });
    }

    if (unreadCount) {
      for (const [userId, count] of Object.entries(unreadCount)) {
        await prisma.conversationParticipant.update({
          where: { conversationId_userId: { conversationId: convId, userId } },
          data: { unreadCount: count },
        });
      }
    }

    return getConversationById(convId);
  }

  async function saveMessage(conversationId, message) {
    return prisma.message.create({
      data: {
        id: message.id,
        conversationId,
        from: message.from,
        fromName: message.fromName,
        text: message.text || "",
        imageData: message.imageData || null,
        timestamp: BigInt(message.timestamp || Date.now()),
        status: message.status || "sent",
      },
    });
  }

  async function getMessages(conversationId) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: "asc" },
    });
    return messages.map((m) => ({
      ...m,
      timestamp: Number(m.timestamp),
    }));
  }

  async function readHistory() {
    const messages = await prisma.message.findMany({
      orderBy: { timestamp: "asc" },
      take: 200,
    });
    return { history: messages.map((m) => ({ ...m, timestamp: Number(m.timestamp) })) };
  }

  async function persistHistory(history) {
    // History is maintained automatically by Prisma — no-op
  }
  
  async function readNotificationState() {
    return null; // Web push state not stored in DB initially
  }
  
  async function persistNotificationState(keys, subscriptions) {
    // Not implemented in Prisma storage
  }

  // ─── FCM Tokens ────────────────────────────
  async function saveFcmToken(userId, token, platform = "android") {
    const existing = await prisma.fcmToken.findUnique({ where: { token } });
    if (existing) {
      return prisma.fcmToken.update({ where: { token }, data: { userId, platform } });
    }
    return prisma.fcmToken.create({ data: { userId, token, platform } });
  }

  async function getFcmTokens(userId) {
    const tokens = await prisma.fcmToken.findMany({ where: { userId } });
    return tokens.map(t => t.token);
  }

  async function removeFcmToken(token) {
    await prisma.fcmToken.deleteMany({ where: { token } });
  }

  return {
    findUserByPhone,
    findUserById,
    createUser,
    updateUser,
    searchUsers,
    getContacts,
    addContact,
    removeContact,
    getConversations,
    createConversation,
    getConversationById,
    updateConversation,
    readHistory,
    persistHistory,
    saveMessage,
    getMessages,
    readNotificationState,
    persistNotificationState,
    saveFcmToken,
    getFcmTokens,
    removeFcmToken,
  };
}

module.exports = { createPrismaStorage, getPrisma };
