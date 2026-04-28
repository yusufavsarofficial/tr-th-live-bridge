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

type Props = { session: Session; callId: string | null; onClose: () => void };
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export function VideoCallScreen({ session, callId, onClose }: Props) {
  const labels = getStrings(session.user.lang);
  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  useEffect(() => {
    setupPeer();
    return () => cleanupMedia();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on(SOCKET_EVENTS.CALL_ACCEPTED, createOffer);
    socket.on(SOCKET_EVENTS.CALL_REJECTED, endCall);
    socket.on(SOCKET_EVENTS.CALL_ENDED, endCall);
    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, handleOffer);
    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, handleAnswer);
    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, handleIceCandidate);
    return () => {
      socket.off(SOCKET_EVENTS.CALL_ACCEPTED, createOffer);
      socket.off(SOCKET_EVENTS.CALL_REJECTED, endCall);
      socket.off(SOCKET_EVENTS.CALL_ENDED, endCall);
      socket.off(SOCKET_EVENTS.WEBRTC_OFFER, handleOffer);
      socket.off(SOCKET_EVENTS.WEBRTC_ANSWER, handleAnswer);
      socket.off(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, handleIceCandidate);
    };
  });

  async function setupPeer() {
    await Camera.requestCameraPermissionsAsync();
    await Camera.requestMicrophonePermissionsAsync();
    const stream = await mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = stream;
    setLocalStream(stream);
    const peer = new RTCPeerConnection(rtcConfig);
    peerRef.current = peer;
    stream.getTracks().forEach((track: any) => peer.addTrack(track, stream));
    peer.addEventListener("track", (event: any) => setRemoteStream(event.streams[0] || null));
    peer.addEventListener("icecandidate", (event: any) => {
      if (event.candidate) getSocket()?.emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, { callId, candidate: event.candidate });
    });
  }

  async function createOffer() {
    const peer = peerRef.current;
    if (!peer) return;
    const offer = await peer.createOffer({});
    await peer.setLocalDescription(offer);
    getSocket()?.emit(SOCKET_EVENTS.WEBRTC_OFFER, { callId, offer });
  }

  async function handleOffer({ offer }: { offer: any }) {
    const peer = peerRef.current;
    if (!peer) return;
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    getSocket()?.emit(SOCKET_EVENTS.WEBRTC_ANSWER, { callId, answer });
  }

  async function handleAnswer({ answer }: { answer: any }) {
    await peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function handleIceCandidate({ candidate }: { candidate: any }) {
    if (candidate) await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
  }

  function acceptCall() { getSocket()?.emit(SOCKET_EVENTS.CALL_ACCEPT, { callId }); }
  function rejectCall() { getSocket()?.emit(SOCKET_EVENTS.CALL_REJECT, { callId }); endCall(); }
  function endCall() { getSocket()?.emit(SOCKET_EVENTS.CALL_END, { callId }); cleanupMedia(); onClose(); }

  function cleanupMedia() {
    localStreamRef.current?.getTracks().forEach((track: any) => track.stop());
    peerRef.current?.close();
    localStreamRef.current = null;
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }

  return (
    <View style={styles.container}>
      <View style={styles.videoArea}>
        {remoteStream ? <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} /> : <Text style={styles.waiting}>WebRTC</Text>}
        {localStream ? <RTCView streamURL={localStream.toURL()} style={styles.localVideo} /> : null}
      </View>
      <View style={styles.controls}>
        <Button label={labels.accept} onPress={acceptCall} />
        <Button label={labels.reject} onPress={rejectCall} variant="ghost" />
        <Button label={labels.end} onPress={endCall} variant="danger" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  videoArea: { flex: 1, backgroundColor: "#050607" },
  remoteVideo: { flex: 1 },
  localVideo: { position: "absolute", right: 14, top: 14, width: 110, height: 160, borderRadius: theme.radius.md, overflow: "hidden" },
  waiting: { color: theme.colors.muted, textAlign: "center", marginTop: 120 },
  controls: { padding: theme.spacing.md, flexDirection: "row", gap: theme.spacing.sm, justifyContent: "center" }
});
