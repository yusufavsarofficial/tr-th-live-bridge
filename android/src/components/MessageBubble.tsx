import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { playAudio } from "../services/audio";
import { theme } from "../theme/theme";

export type ChatMessage = {
  id: string;
  sender_username: string;
  original_text: string;
  translated_text: string;
  audio_url?: string | null;
  message_type: "text" | "audio";
  read_by: string[];
  created_at?: string;
};

type Props = {
  message: ChatMessage;
  mine: boolean;
  read: boolean;
  canDelete: boolean;
  onDelete: (messageId: string) => void;
  labels: { original: string; translation: string; voiceText: string; play: string; read: string; delete: string };
};

function timeLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, mine, read, canDelete, onDelete, labels }: Props) {
  const hasTranslation = Boolean(message.translated_text && message.translated_text !== message.original_text);

  return (
    <View style={[styles.wrap, mine ? styles.mineWrap : styles.otherWrap]}>
      <Pressable
        onLongPress={() => canDelete ? onDelete(message.id) : undefined}
        delayLongPress={450}
        style={[styles.bubble, mine ? styles.mine : styles.other]}
      >
        <View style={[styles.tail, mine ? styles.mineTail : styles.otherTail]} />
        <Text style={[styles.sender, mine && styles.mineSender]}>{message.sender_username}</Text>

        {message.message_type === "audio" && message.audio_url ? (
          <View style={styles.voiceRow}>
            <Pressable style={styles.playButton} onPress={() => playAudio(message.audio_url || "")}>
              <Text style={styles.playIcon}>▶</Text>
            </Pressable>
            <View style={styles.voiceLine}>
              <View style={styles.wave} />
              <View style={[styles.wave, styles.waveTall]} />
              <View style={styles.wave} />
              <View style={[styles.wave, styles.waveShort]} />
              <View style={styles.wave} />
            </View>
          </View>
        ) : null}

        {message.original_text ? <Text style={styles.text}>{message.original_text}</Text> : null}

        {hasTranslation ? (
          <View style={styles.translationBox}>
            <Text style={styles.translationLabel}>{labels.translation}</Text>
            <Text style={styles.translation}>{message.translated_text}</Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.time}>{timeLabel(message.created_at)}</Text>
          {mine && read ? <Text style={styles.read}>{labels.read}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 4, paddingHorizontal: 8 },
  mineWrap: { alignItems: "flex-end" },
  otherWrap: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "82%",
    minWidth: 92,
    borderRadius: 8,
    paddingTop: 7,
    paddingBottom: 5,
    paddingHorizontal: 9,
    position: "relative"
  },
  mine: { backgroundColor: theme.colors.bubbleMine },
  other: { backgroundColor: theme.colors.bubbleOther },
  tail: {
    position: "absolute",
    top: 0,
    width: 12,
    height: 12,
    transform: [{ rotate: "45deg" }]
  },
  mineTail: { right: -4, backgroundColor: theme.colors.bubbleMine },
  otherTail: { left: -4, backgroundColor: theme.colors.bubbleOther },
  sender: { color: theme.colors.primary, fontWeight: "800", marginBottom: 3, fontSize: 12 },
  mineSender: { color: "#7FE0C3" },
  text: { color: theme.colors.text, fontSize: 16, lineHeight: 21 },
  translationBox: {
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    paddingLeft: 7,
    opacity: 0.92
  },
  translationLabel: { color: theme.colors.muted, fontSize: 10, fontWeight: "800", marginBottom: 1 },
  translation: { color: theme.colors.text, fontSize: 14, lineHeight: 19 },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 190, marginBottom: 5 },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  playIcon: { color: theme.colors.primaryText, fontSize: 15, marginLeft: 2 },
  voiceLine: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  wave: { flex: 1, height: 4, borderRadius: 999, backgroundColor: theme.colors.muted },
  waveTall: { height: 8 },
  waveShort: { height: 3 },
  metaRow: { marginTop: 3, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 5 },
  time: { color: theme.colors.muted, fontSize: 10 },
  read: { color: "#69D6FF", fontSize: 10, fontWeight: "700" }
});
