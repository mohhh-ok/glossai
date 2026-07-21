import OpenAI from "openai";
import type { TtsProvider } from "./types";

const VOICE = process.env.GLOSSAI_TTS_VOICE || "alloy";

export class OpenAiTtsProvider implements TtsProvider {
  async synthesize(text: string): Promise<ArrayBuffer> {
    const client = new OpenAI();
    const response = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: VOICE as OpenAI.Audio.Speech.SpeechCreateParams["voice"],
      input: text,
    });
    return response.arrayBuffer();
  }
}
