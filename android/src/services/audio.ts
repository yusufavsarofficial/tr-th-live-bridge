import { Audio } from "expo-av";
import axios from "axios";
import { BACKEND_URL } from "../config/backend";

export async function startRecording() {
  await Audio.requestPermissionsAsync();
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
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
  });
  return {
    audioUrl: response.data.audioUrl as string,
    originalText: response.data.originalText || "",
    translatedText: response.data.translatedText || "",
    warning: response.data.warning
  };
}

export async function playAudio(url: string) {
  const { sound } = await Audio.Sound.createAsync({ uri: `${BACKEND_URL}${url}` });
  await sound.playAsync();
}
