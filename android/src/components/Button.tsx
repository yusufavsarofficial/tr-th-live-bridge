import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../theme/theme";

type Props = { label: string; onPress: () => void; variant?: "primary" | "danger" | "ghost" };

export function Button({ label, onPress, variant = "primary" }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, variant === "danger" && styles.danger, variant === "ghost" && styles.ghost, pressed && styles.pressed]}>
      <Text style={[styles.label, variant === "ghost" && styles.ghostLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 42, paddingHorizontal: theme.spacing.md, borderRadius: 999, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  danger: { backgroundColor: theme.colors.danger },
  ghost: { backgroundColor: theme.colors.surfaceSoft, borderWidth: 1, borderColor: theme.colors.border },
  pressed: { opacity: 0.78 },
  label: { color: theme.colors.primaryText, fontWeight: "700" },
  ghostLabel: { color: theme.colors.text }
});
