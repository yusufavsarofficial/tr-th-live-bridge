import React, { useEffect, useRef, useState } from "react";
import { Camera } from "expo-camera";
import { StyleSheet, Text, View } from "react-native";
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCView } from "react-native-webrtc";
import { Button } from "../components/Button";
import { SOCKET_EVENTS } from "../config/socketEvents";
import { getStrings } from "../i18n";
import { Session } from "../services/auth";
import { getSocket } from "../services/socket";
import { theme } from "../theme/theme";

type Props = {
  session: Session;
  callId: string | null;
  mode: "incoming" | "outgoing";
  onClose: () => void;
};

const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export function VideoCallScreen({ session, callId, mode, onClose }: Props) {
  const labels = getStrings(session.user.lang);
  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const pendingCandidates = useRef<any[]>([]);
  const endingRef = useRef(false);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [accepted, setAccepted] = useState(mode === "outgoing");
  const [mini, setMini] = useState(false);
  const [status, setStatus] = useState(mode === "outgoing" ? labels.waitingForAnswer : labels.waitingForVideo);

  useEffect(() => {
    ensurePeer().catch(() => setStatus("MEDIA_ERROR"));
    return () => cleanupMedia();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setStatus("SOCKET_DISCONNECTED");
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

    socket.on(SOCKET_EVENTS.CALL_ACCEPTED, onAccepted);
    socket.on(SOCKET_EVENTS.CALL_REJECTED, onRejected);
    socket.on(SOCKET_EVENTS.CALL_ENDED, onEnded);
    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, onOffer);
    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, onAnswer);
    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, onIce);

    return () => {
      socket.off(SOCKET_EVENTS.CALL_ACCEPTED, onAccepted);
      socket.off(SOCKET_EVENTS.CALL_REJECTED, onRejected);
      socket.off(SOCKET_EVENTS.CALL_ENDED, onEnded);
      socket.off(SOCKET_EVENTS.WEBRTC_OFFER, onOffer);
      socket.off(SOCKET_EVENTS.WEBRTC_ANSWER, onAnswer);
      socket.off(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, onIce);
    };
  }, [callId, labels.waitingForVideo]);

  async function ensurePeer() {
    if (peerRef.current) return peerRef.current;

    await Camera.requestCameraPermissionsAsync();
    await Camera.requestMicrophonePermissionsAsync();
    const stream = await mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = stream;
    setLocalStream(stream);

    const peer = new RTCPeerConnection(rtcConfig);
    peerRef.current = peer;
    stream.getTracks().forEach((track: any) => peer.addTrack(track, stream));
    peer.addEventListener("track", (event: any) => {
      setRemoteStream(event.streams[0] || null);
      setStatus("");
    });
    peer.addEventListener("icecandidate", (event: any) => {
      if (event.candidate) getSocket()?.emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, { callId, candidate: event.candidate });
    });
    return peer;
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
    const peer = await ensurePeer();
    const offer = await peer.createOffer({});
    await peer.setLocalDescription(offer);
    getSocket()?.emit(SOCKET_EVENTS.WEBRTC_OFFER, { callId, offer });
  }

  async function handleOffer({ offer }: { offer: any }) {
    const peer = await ensurePeer();
    setAccepted(true);
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    await flushPendingCandidates();
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    getSocket()?.emit(SOCKET_EVENTS.WEBRTC_ANSWER, { callId, answer });
  }

  async function handleAnswer({ answer }: { answer: any }) {
    const peer = await ensurePeer();
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
    await flushPendingCandidates();
  }

  async function handleIceCandidate({ candidate }: { candidate: any }) {
    if (!candidate) return;
    const peer = await ensurePeer();
    if (!peer.remoteDescription) {
      pendingCandidates.current.push(candidate);
      return;
    }
    await peer.addIceCandidate(new RTCIceCandidate(candidate));
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

  function closeCall(emitEnd: boolean) {
    if (endingRef.current) return;
    endingRef.current = true;
    if (emitEnd) getSocket()?.emit(SOCKET_EVENTS.CALL_END, { callId });
    cleanupMedia();
    onClose();
  }

  function cleanupMedia() {
    localStreamRef.current?.getTracks().forEach((track: any) => track.stop());
    peerRef.current?.close();
    pendingCandidates.current = [];
    localStreamRef.current = null;
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }

  const showAcceptControls = mode === "incoming" && !accepted;

  return (
    <View style={styles.container}>
      <View style={[styles.videoArea, mini && styles.videoAreaMini]}>
        {remoteStream ? <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" /> : <Text style={styles.waiting}>{status || labels.waitingForVideo}</Text>}
        {localStream ? <RTCView streamURL={localStream.toURL()} style={[styles.localVideo, mini && styles.localVideoMini]} objectFit="cover" /> : null}
      </View>
      <View style={styles.controls}>
        {showAcceptControls ? <Button label={labels.accept} onPress={acceptCall} /> : null}
        {showAcceptControls ? <Button label={labels.reject} onPress={rejectCall} variant="ghost" /> : null}
        <Button label={mini ? labels.expand : labels.minimize} onPress={() => setMini((value) => !value)} variant="ghost" />
        <Button label={labels.end} onPress={endCall} variant="danger" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  videoArea: { flex: 1, backgroundColor: "#050607" },
  videoAreaMini: { flex: 0, height: 230, margin: theme.spacing.md, borderRadius: theme.radius.md, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.border },
  remoteVideo: { flex: 1 },
  localVideo: { position: "absolute", right: 14, top: 14, width: 110, height: 160, borderRadius: theme.radius.md, overflow: "hidden" },
  localVideoMini: { width: 82, height: 118 },
  waiting: { color: theme.colors.muted, textAlign: "center", marginTop: 120 },
  controls: { padding: theme.spacing.md, flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, justifyContent: "center" }
});
