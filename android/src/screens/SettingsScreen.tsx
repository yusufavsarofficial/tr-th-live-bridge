import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { clearSession, Session } from "../services/auth";
import {
  getLatestLocations,
  getLocationConsent,
  openLocationInMaps,
  rejectLocationConsent,
  requestAndStartLocation,
  SharedLocation,
  stopLocationSharing
} from "../services/location";
import { disconnectSocket } from "../services/socket";
import { theme } from "../theme/theme";

type Props = {
  session: Session;
  onClose: () => void;
  onLogout: () => void;
};

function timeLabel(value?: string) {
  if (!value) return "Yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Yok";
  return date.toLocaleString();
}

export function SettingsScreen({ session, onClose, onLogout }: Props) {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [ownLocation, setOwnLocation] = useState<SharedLocation | null>(null);
  const [partnerLocation, setPartnerLocation] = useState<SharedLocation | null>(null);
  const [notice, setNotice] = useState("");

  async function refresh() {
    const consent = await getLocationConsent();
    setLocationEnabled(consent === "accepted");
    const latest = await getLatestLocations(session.token).catch(() => null);
    if (latest) {
      setOwnLocation(latest.ownLocation);
      setPartnerLocation(latest.partnerLocation);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function enableLocation() {
    const ok = await requestAndStartLocation(session).catch(() => false);
    setNotice(ok ? "Guvenlik konumu aktif." : "Konum izni gerekli.");
    await refresh();
  }

  async function disableLocation() {
    await rejectLocationConsent();
    setLocationEnabled(false);
    setNotice("Guvenlik konumu kapatildi.");
  }

  async function logout() {
    await stopLocationSharing();
    await clearSession();
    disconnectSocket();
    onLogout();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ayarlar</Text>
        <Button label="Kapat" onPress={onClose} variant="ghost" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Guvenlik konumu</Text>
        <Text style={styles.line}>Durum: {locationEnabled ? "Aktif" : "Kapali"}</Text>
        <Text style={styles.line}>Son gonderim: {timeLabel(ownLocation?.createdAt)}</Text>
        <Text style={styles.line}>Son konum: {timeLabel(partnerLocation?.createdAt)}</Text>
        <View style={styles.actions}>
          {locationEnabled ? <Button label="Konumu kapat" onPress={disableLocation} variant="ghost" /> : <Button label="Konumu ac" onPress={enableLocation} />}
          {partnerLocation ? <Button label="Haritada ac" onPress={() => openLocationInMaps(partnerLocation)} variant="ghost" /> : null}
          <Button label="Yenile" onPress={refresh} variant="ghost" />
        </View>
        <Text style={styles.small}>
          Konum sadece acik riza ile calisir. Android pil ve arka plan kurallari nedeniyle uygulama zorla kapatilinca durabilir.
        </Text>
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Button label="Cikis yap" onPress={logout} variant="danger" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 30,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.md
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: "900" },
  section: { backgroundColor: theme.colors.surface, borderRadius: 8, padding: theme.spacing.md, gap: theme.spacing.sm },
  sectionTitle: { color: theme.colors.text, fontSize: 17, fontWeight: "800" },
  line: { color: theme.colors.text, fontSize: 14 },
  small: { color: theme.colors.muted, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  notice: { color: theme.colors.text, backgroundColor: theme.colors.notice, padding: theme.spacing.sm, borderRadius: 8 }
});
