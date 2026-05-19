export interface User {
  id: string;
  phoneNumber?: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  about?: string;
  lastSeenAt?: string;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  title?: string;
  avatarUrl?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMember {
  conversationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  mutedUntil?: string;
  archivedAt?: string;
  pinnedAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: "text" | "image" | "audio" | "video" | "file" | "system";
  body?: string;
  mediaUrl?: string;
  replyToMessageId?: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
}

export interface MessageStatus {
  messageId: string;
  userId: string;
  status: "sent" | "delivered" | "read" | "failed";
  updatedAt: string;
}

export interface Call {
  id: string;
  conversationId: string;
  callerId: string;
  type: "audio" | "video";
  status: "ringing" | "accepted" | "rejected" | "missed" | "ended";
  startedAt: string;
  endedAt?: string;
}

export interface CallParticipant {
  callId: string;
  userId: string;
  status: "ringing" | "accepted" | "rejected" | "missed" | "ended";
  joinedAt?: string;
  leftAt?: string;
}

export interface MediaFile {
  id: string;
  ownerId: string;
  conversationId?: string;
  messageId?: string;
  type: "image" | "audio" | "video" | "file" | "avatar";
  url: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
}
