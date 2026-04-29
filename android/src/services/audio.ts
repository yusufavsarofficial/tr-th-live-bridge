import { Audio } from "expo-av";
import axios from "axios";
import { BACKEND_URL } from "../config/backend";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export async function startRecording() {
  const permission = await Audio.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("MICROPHONE_PERMISSION_REQUIRED");
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  return recording;
}

export async function stopRecording(recording: Audio.Recording) {
  await recording.stopAndUnloadAsync();
  return recording.getURI();
}

export type UploadedAudio = {
  audioUrl: string;
  originalText: string;
  translatedText: string;
  warning?: string;
};

export async function uploadAudio(uri: string, token: string): Promise<UploadedAudio> {
  const form = new FormData();
  form.append("audio", { uri, name: "voice-message.m4a", type: "audio/m4a" } as unknown as string);
  const response = await axios.post(`${BACKEND_URL}/api/uploads/audio`, form, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
    maxBodyLength: MAX_AUDIO_BYTES,
    timeout: 30000
  });
  return {
    audioUrl: response.data.audioUrl as string,
    originalText: response.data.originalText || "",
    translatedText: response.data.translatedText || "",
    warning: response.data.warning
  };
}

export async function playAudio(url: string) {
  const uri = url.startsWith("http") ? url : `${BACKEND_URL}${url}`;
  const { sound } = await Audio.Sound.createAsync({ uri });
  await sound.playAsync();
}
