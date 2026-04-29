import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Session } from "../services/auth";
import { rejectLocationConsent, requestAndStartLocation } from "../services/location";
import { theme } from "../theme/theme";

type Props = {
  session: Session;
  onDone: () => void;
};

export function LocationConsentScreen({ session, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function accept() {
    setBusy(true);
    setNotice("");
    const started = await requestAndStartLocation(session).catch(() => false);
    setBusy(false);
    if (!started) {
      setNotice("Konum izni verilmedi. Daha sonra ayarlardan acabilirsin.");
    }
    onDone();
  }

  async function reject() {
    await rejectLocationConsent();
    onDone();
  }

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>Guvenlik Konumu Onayi</Text>
        <Text style={styles.copy}>
          Guvenlik konumu ozelligi, yalnizca Yusuf ve Neeja arasinda guvenlik amaciyla konum paylasimi yapmak icin kullanilir.
          Kabul edersen, uygulama Android'in izin verdigi olcude konumunu guncelleyebilir. Konum paylasimi cihaz izinlerine,
          pil optimizasyonuna ve Android arka plan kurallarina bagli olarak calisir. Istedigin zaman ayarlardan kapatabilirsin.
        </Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <View style={styles.actions}>
          <Button label={busy ? "Bekle..." : "Kabul ediyorum"} onPress={accept} />
          <Button label="Reddediyorum" onPress={reject} variant="ghost" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  panel: { gap: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: "900" },
  copy: { color: theme.colors.text, fontSize: 16, lineHeight: 24 },
  notice: { color: theme.colors.muted, fontSize: 13, lineHeight: 18 },
  actions: { gap: theme.spacing.sm, marginTop: theme.spacing.sm }
});
