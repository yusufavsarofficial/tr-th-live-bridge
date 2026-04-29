import React, { useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import axios from "axios";
import { Camera } from "expo-camera";
import { Dimensions, PanResponder, StyleSheet, Text, View } from "react-native";
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCView } from "react-native-webrtc";
import { Button } from "../components/Button";
import { BACKEND_URL } from "../config/backend";
import { SOCKET_EVENTS } from "../config/socketEvents";
import { getStrings } from "../i18n";
import { startRecording, stopRecording, uploadAudio } from "../services/audio";
import { Session } from "../services/auth";
import { getSocket } from "../services/socket";
import { theme } from "../theme/theme";

type Props = {
  session: Session;
  callId: string | null;
  mode: "incoming" | "outgoing";
  onClose: () => void;
};

type QualityMode = "low" | "balanced" | "high";

const screen = Dimensions.get("window");
const fallbackRtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }] };
const qualityModes: Record<QualityMode, { label: string; width: number; height: number; fps: number; bitrate: number }> = {
  low: { label: "Dusuk veri", width: 480, height: 360, fps: 15, bitrate: 280000 },
  balanced: { label: "Dengeli", width: 640, height: 480, fps: 20, bitrate: 650000 },
  high: { label: "Daha iyi", width: 720, height: 540, fps: 24, bitrate: 1100000 }
};

export function VideoCallScreen({ session, callId, mode, onClose }: Props) {
  const labels = getStrings(session.user.lang);
  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const pendingCandidates = useRef<any[]>([]);
  const endingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const miniRef = useRef(false);
  const miniPositionRef = useRef({ x: Math.max(8, screen.width - 174), y: 72 });
  const translationRecordingRef = useRef<Audio.Recording | null>(null);
  const [rtcConfig, setRtcConfig] = useState<any>(fallbackRtcConfig);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [accepted, setAccepted] = useState(mode === "outgoing");
  const [mini, setMini] = useState(false);
  const [miniPosition, setMiniPosition] = useState({ x: Math.max(8, screen.width - 174), y: 72 });
  const [status, setStatus] = useState(mode === "outgoing" ? labels.waitingForAnswer : labels.waitingForVideo);
  const [translationRecording, setTranslationRecording] = useState<Audio.Recording | null>(null);
  const [callTranslation, setCallTranslation] = useState("");
  const [quality, setQuality] = useState<QualityMode>("balanced");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [beautyEnabled, setBeautyEnabled] = useState(false);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: () => miniRef.current,
    onPanResponderGrant: () => {
      dragStartRef.current = miniPositionRef.current;
    },
    onPanResponderMove: (_, gesture) => {
      const nextX = Math.min(Math.max(8, dragStartRef.current.x + gesture.dx), screen.width - 166);
      const nextY = Math.min(Math.max(58, dragStartRef.current.y + gesture.dy), screen.height - 230);
      setMiniPosition({ x: nextX, y: nextY });
    }
  })).current;

  useEffect(() => {
    miniRef.current = mini;
  }, [mini]);

  useEffect(() => {
    miniPositionRef.current = miniPosition;
  }, [miniPosition]);

  useEffect(() => {
    translationRecordingRef.current = translationRecording;
  }, [translationRecording]);

  useEffect(() => {
    async function initCallMedia() {
      let nextRtcConfig = fallbackRtcConfig;
      try {
        const response = await axios.get(`${BACKEND_URL}/api/rtc-config`, {
          headers: { Authorization: `Bearer ${session.token}` },
          timeout: 12000
        });
        if (Array.isArray(response.data?.iceServers)) nextRtcConfig = { iceServers: response.data.iceServers };
      } catch {
        nextRtcConfig = fallbackRtcConfig;
      }
      setRtcConfig(nextRtcConfig);
      if (mode === "outgoing") await ensurePeer(nextRtcConfig);
    }
    initCallMedia().catch(() => setStatus("Kamera veya mikrofon izni gerekli."));
    return () => cleanupMedia();
  }, []);

  useEffect(() => {
    applySenderParameters(quality).catch(() => undefined);
  }, [quality]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setStatus("Baglanti kurulamadi, tekrar deneyin.");
      return;
    }

    const onAccepted = async () => {
      setAccepted(true);
      setStatus(labels.waitingForVideo);
      await createOffer();
    };
    const onRejected = () => closeCall(false);
    const onEnded = () => closeCall(false);
    const onOffer = (payload: { offer: any }) => handleOffer(payload);
    const onAnswer = (payload: { answer: any }) => handleAnswer(payload);
    const onIce = (payload: { candidate: any }) => handleIceCandidate(payload);
    const onVoiceTranslation = (payload: { callId: string; translatedText?: string; originalText?: string }) => {
      if (payload.callId === callId) setCallTranslation(payload.translatedText || payload.originalText || "");
    };

    socket.on(SOCKET_EVENTS.CALL_ACCEPTED, onAccepted);
    socket.on(SOCKET_EVENTS.CALL_REJECTED, onRejected);
    socket.on(SOCKET_EVENTS.CALL_ENDED, onEnded);
    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, onOffer);
    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, onAnswer);
    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, onIce);
    socket.on(SOCKET_EVENTS.CALL_VOICE_TRANSLATION, onVoiceTranslation);

    return () => {
      socket.off(SOCKET_EVENTS.CALL_ACCEPTED, onAccepted);
      socket.off(SOCKET_EVENTS.CALL_REJECTED, onRejected);
      socket.off(SOCKET_EVENTS.CALL_ENDED, onEnded);
      socket.off(SOCKET_EVENTS.WEBRTC_OFFER, onOffer);
      socket.off(SOCKET_EVENTS.WEBRTC_ANSWER, onAnswer);
      socket.off(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, onIce);
      socket.off(SOCKET_EVENTS.CALL_VOICE_TRANSLATION, onVoiceTranslation);
    };
  }, [callId, labels.waitingForVideo, quality]);

  async function ensurePeer(nextRtcConfig = rtcConfig) {
    if (peerRef.current) return peerRef.current;

    const cameraPermission = await Camera.requestCameraPermissionsAsync();
    const micPermission = await Camera.requestMicrophonePermissionsAsync();
    if (cameraPermission.status !== "granted" || micPermission.status !== "granted") {
      setStatus("Kamera ve mikrofon izni gerekli.");
      throw new Error("MEDIA_PERMISSION_REQUIRED");
    }

    const selectedQuality = qualityModes[quality];
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: {
        facingMode: "user",
        width: { ideal: selectedQuality.width },
        height: { ideal: selectedQuality.height },
        frameRate: { ideal: selectedQuality.fps, max: selectedQuality.fps }
      }
    });
    localStreamRef.current = stream;
    setLocalStream(stream);

    const peer = new RTCPeerConnection(nextRtcConfig);
    peerRef.current = peer;
    stream.getTracks().forEach((track: any) => peer.addTrack(track, stream));
    peer.addEventListener("track", (event: any) => {
      setRemoteStream(event.streams[0] || null);
      setStatus("");
    });
    peer.addEventListener("icecandidate", (event: any) => {
      if (event.candidate) getSocket()?.emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, { callId, candidate: event.candidate });
    });
    peer.addEventListener("connectionstatechange", () => {
      if (["failed", "disconnected"].includes(peer.connectionState)) setStatus("Baglanti kurulamadi, tekrar deneyin.");
    });
    peer.addEventListener("iceconnectionstatechange", () => {
      if (["failed", "disconnected"].includes(peer.iceConnectionState)) setStatus("Baglanti zayif, kalite dusuruldu.");
    });
    await applySenderParameters(quality, peer);
    return peer;
  }

  async function applySenderParameters(modeName: QualityMode, peer = peerRef.current) {
    if (!peer?.getSenders) return;
    const bitrate = qualityModes[modeName].bitrate;
    peer.getSenders().forEach(async (sender: any) => {
      if (sender.track?.kind !== "video" || !sender.getParameters || !sender.setParameters) return;
      const params = sender.getParameters();
      params.encodings = params.encodings?.length ? params.encodings : [{}];
      params.encodings[0].maxBitrate = bitrate;
      await sender.setParameters(params).catch(() => undefined);
    });
  }

  async function flushPendingCandidates() {
    const peer = peerRef.current;
    if (!peer?.remoteDescription) return;
    while (pendingCandidates.current.length) {
      const candidate = pendingCandidates.current.shift();
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  async function createOffer() {
    try {
      const peer = await ensurePeer();
      const offer = await peer.createOffer({});
      await peer.setLocalDescription(offer);
      getSocket()?.emit(SOCKET_EVENTS.WEBRTC_OFFER, { callId, offer });
    } catch {
      setStatus("Baglanti kurulamadi, tekrar deneyin.");
    }
  }

  async function handleOffer({ offer }: { offer: any }) {
    try {
      const peer = await ensurePeer();
      setAccepted(true);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      getSocket()?.emit(SOCKET_EVENTS.WEBRTC_ANSWER, { callId, answer });
    } catch {
      setStatus("Baglanti kurulamadi, tekrar deneyin.");
    }
  }

  async function handleAnswer({ answer }: { answer: any }) {
    try {
      const peer = await ensurePeer();
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
      await flushPendingCandidates();
    } catch {
      setStatus("Baglanti kurulamadi, tekrar deneyin.");
    }
  }

  async function handleIceCandidate({ candidate }: { candidate: any }) {
    if (!candidate) return;
    try {
      const peer = await ensurePeer();
      if (!peer.remoteDescription) {
        pendingCandidates.current.push(candidate);
        return;
      }
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      pendingCandidates.current.push(candidate);
    }
  }

  async function acceptCall() {
    await ensurePeer();
    setAccepted(true);
    setStatus(labels.waitingForVideo);
    getSocket()?.emit(SOCKET_EVENTS.CALL_ACCEPT, { callId });
  }

  function rejectCall() {
    getSocket()?.emit(SOCKET_EVENTS.CALL_REJECT, { callId });
    closeCall(false);
  }

  function endCall() {
    closeCall(true);
  }

  function toggleCamera() {
    const next = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track: any) => {
      track.enabled = next;
    });
    setCameraEnabled(next);
  }

  function toggleMic() {
    const next = !micEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track: any) => {
      track.enabled = next;
    });
    setMicEnabled(next);
  }

  function flipCamera() {
    localStreamRef.current?.getVideoTracks().forEach((track: any) => {
      if (typeof track._switchCamera === "function") track._switchCamera();
    });
  }

  function cycleQuality() {
    setQuality((current) => current === "low" ? "balanced" : current === "balanced" ? "high" : "low");
  }

  async function toggleCallTranslation() {
    if (session.user.username !== "Neeja") return;
    if (translationRecording) {
      const uri = await stopRecording(translationRecording);
      setTranslationRecording(null);
      if (!uri || !callId) return;
      const uploaded = await uploadAudio(uri, session.token);
      getSocket()?.emit(SOCKET_EVENTS.CALL_VOICE_TRANSLATION, {
        callId,
        originalText: uploaded.originalText,
        translatedText: uploaded.translatedText
      });
      setCallTranslation(uploaded.translatedText || uploaded.originalText || uploaded.warning || "");
      return;
    }
    setTranslationRecording(await startRecording());
  }

  function closeCall(emitEnd: boolean) {
    if (endingRef.current) return;
    endingRef.current = true;
    if (emitEnd) getSocket()?.emit(SOCKET_EVENTS.CALL_END, { callId });
    cleanupMedia();
    onClose();
  }

  function cleanupMedia() {
    localStreamRef.current?.getTracks().forEach((track: any) => track.stop());
    if (translationRecordingRef.current) {
      translationRecordingRef.current.stopAndUnloadAsync().catch(() => undefined);
      setTranslationRecording(null);
      translationRecordingRef.current = null;
    }
    peerRef.current?.close();
    pendingCandidates.current = [];
    localStreamRef.current = null;
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }

  const showAcceptControls = mode === "incoming" && !accepted;
  const rootStyle = mini ? [styles.container, styles.containerMini, { left: miniPosition.x, top: miniPosition.y }] : styles.container;

  return (
    <View style={rootStyle} {...(mini ? panResponder.panHandlers : {})}>
      <View style={[styles.videoArea, mini && styles.videoAreaMini]}>
        {remoteStream ? <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" /> : <Text style={styles.waiting}>{status || labels.waitingForVideo}</Text>}
        {localStream ? (
          <View style={[styles.localVideoWrap, mini && styles.localVideoMini, beautyEnabled && styles.localBeauty]}>
            <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" mirror />
            {beautyEnabled ? <View style={styles.beautyOverlay} /> : null}
          </View>
        ) : <Text style={styles.localHint}>Kamera aciliyor...</Text>}
      </View>

      <View style={[styles.controls, mini && styles.controlsMini]}>
        {showAcceptControls ? <Button label={labels.accept} onPress={acceptCall} /> : null}
        {showAcceptControls ? <Button label={labels.reject} onPress={rejectCall} variant="ghost" /> : null}
        {!showAcceptControls && !mini ? <Button label={cameraEnabled ? "Kamera" : "Kamera kapali"} onPress={toggleCamera} variant="ghost" /> : null}
        {!showAcceptControls && !mini ? <Button label={micEnabled ? "Mikrofon" : "Sessiz"} onPress={toggleMic} variant="ghost" /> : null}
        {!showAcceptControls && !mini ? <Button label="Cevir" onPress={flipCamera} variant="ghost" /> : null}
        {!showAcceptControls && !mini ? <Button label={qualityModes[quality].label} onPress={cycleQuality} variant="ghost" /> : null}
        {!showAcceptControls && !mini ? <Button label={beautyEnabled ? "Yumusak acik" : "Yumusak"} onPress={() => setBeautyEnabled((value) => !value)} variant="ghost" /> : null}
        {session.user.username === "Neeja" && !mini ? <Button label={translationRecording ? labels.stopTranslateVoice : labels.translateVoice} onPress={toggleCallTranslation} variant="ghost" /> : null}
        <Button label={mini ? labels.expand : labels.minimize} onPress={() => setMini((value) => !value)} variant="ghost" />
        <Button label={labels.end} onPress={endCall} variant="danger" />
      </View>

      {callTranslation && !mini ? (
        <View style={styles.translationPanel}>
          <Text style={styles.translationTitle}>{labels.callVoiceTranslation}</Text>
          <Text style={styles.translationText}>{callTranslation}</Text>
        </View>
      ) : null}
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
    zIndex: 20,
    backgroundColor: theme.colors.background
  },
  containerMini: {
    right: undefined,
    bottom: undefined,
    width: 158,
    height: 218,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 8
  },
  videoArea: { flex: 1, backgroundColor: "#050607" },
  videoAreaMini: { flex: 1 },
  remoteVideo: { flex: 1 },
  localVideoWrap: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 112,
    height: 158,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)"
  },
  localVideoMini: { right: 8, top: 8, width: 52, height: 74 },
  localVideo: { flex: 1 },
  localBeauty: { borderColor: theme.colors.primary },
  beautyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.08)" },
  localHint: { position: "absolute", right: 18, top: 22, color: theme.colors.muted, fontSize: 11 },
  waiting: { color: theme.colors.muted, textAlign: "center", marginTop: 120 },
  controls: { padding: theme.spacing.md, flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, justifyContent: "center", backgroundColor: theme.colors.background },
  controlsMini: { padding: 6, gap: 5 },
  translationPanel: { borderTopWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, backgroundColor: theme.colors.surface },
  translationTitle: { color: theme.colors.primary, fontWeight: "800", marginBottom: 4 },
  translationText: { color: theme.colors.text, fontSize: 16 }
});
