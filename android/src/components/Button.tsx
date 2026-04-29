import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { theme } from "../theme/theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "danger" | "ghost" | "icon";
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = "primary", style }: Props) {
  const icon = variant === "icon";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        icon && styles.icon,
        variant === "danger" && styles.danger,
        variant === "ghost" && styles.ghost,
        pressed && styles.pressed,
        style
      ]}
    >
      <Text style={[styles.label, icon && styles.iconLabel, variant === "ghost" && styles.ghostLabel]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  icon: {
    width: 42,
    height: 42,
    minHeight: 42,
    paddingHorizontal: 0,
    backgroundColor: "transparent"
  },
  danger: { backgroundColor: theme.colors.danger },
  ghost: { backgroundColor: theme.colors.surfaceSoft, borderWidth: 1, borderColor: theme.colors.border },
  pressed: { opacity: 0.72 },
  label: { color: theme.colors.primaryText, fontWeight: "800", fontSize: 14 },
  iconLabel: { color: theme.colors.text, fontSize: 22, fontWeight: "800" },
  ghostLabel: { color: theme.colors.text }
});
