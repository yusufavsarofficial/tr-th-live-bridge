import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { playAudio } from "../services/audio";
import { Button } from "./Button";
import { theme } from "../theme/theme";

export type ChatMessage = {
  id: string;
  sender_username: string;
  original_text: string;
  translated_text: string;
  audio_url?: string | null;
  message_type: "text" | "audio";
  read_by: string[];
};

type Props = {
  message: ChatMessage;
  mine: boolean;
  read: boolean;
  labels: { original: string; translation: string; voiceText: string; play: string; read: string };
};

export function MessageBubble({ message, mine, read, labels }: Props) {
  return (
    <View style={[styles.wrap, mine ? styles.mineWrap : styles.otherWrap]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.other]}>
        <Text style={styles.sender}>{message.sender_username}</Text>
        {message.message_type === "audio" && message.audio_url ? (
          <>
            <Button label={labels.play} onPress={() => playAudio(message.audio_url || "")} variant="ghost" />
            {message.original_text ? (
              <>
                <Text style={styles.caption}>{labels.voiceText}</Text>
                <Text style={styles.text}>{message.original_text}</Text>
              </>
            ) : null}
            {message.translated_text ? (
              <>
                <Text style={styles.caption}>{labels.translation}</Text>
                <Text style={styles.translation}>{message.translated_text}</Text>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.caption}>{labels.original}</Text>
            <Text style={styles.text}>{message.original_text}</Text>
            <Text style={styles.caption}>{labels.translation}</Text>
            <Text style={styles.translation}>{message.translated_text}</Text>
          </>
        )}
        {mine && read ? <Text style={styles.read}>{labels.read}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: theme.spacing.xs },
  mineWrap: { alignItems: "flex-end" },
  otherWrap: { alignItems: "flex-start" },
  bubble: { maxWidth: "86%", borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  mine: { backgroundColor: theme.colors.bubbleMine },
  other: { backgroundColor: theme.colors.bubbleOther },
  sender: { color: theme.colors.primary, fontWeight: "700", marginBottom: 4 },
  caption: { color: theme.colors.muted, fontSize: 11, marginTop: 4 },
  text: { color: theme.colors.text, fontSize: 16 },
  translation: { color: theme.colors.text, fontSize: 14 },
  read: { color: theme.colors.muted, fontSize: 11, marginTop: 6, textAlign: "right" }
});
