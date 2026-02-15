/**
 * TTS Fallback Engines
 *
 * Contains isolated, self-contained TTS implementations for fallback scenarios.
 * Each function returns a Promise that resolves when audio finishes playing.
 *
 * Active fallback: StreamElements (used when backend Edge TTS fails)
 * Emergency backups (dead code): Gemini TTS, Google Translate, Web Speech API
 */

// ─── StreamElements API (Primary Fallback) ──────────────────────────────────────

/**
 * Speak text using StreamElements TTS API.
 * Free, no auth required, returns MP3 audio.
 * Called directly from frontend when backend TTS fails — user won't notice a switch.
 *
 * @param {string} text - Text to speak
 * @param {string} voice - StreamElements voice (default: 'Brian')
 * @returns {Promise<void>} Resolves when audio finishes playing
 */
export async function speakWithStreamElements(text, voice = "Brian") {
  if (!text || text.trim().length === 0) {
    console.warn("[TTS Fallback: StreamElements] Empty text, skipping");
    return;
  }

  // StreamElements has a ~300 char limit per request, so split if needed
  const chunks = splitTextForStreamElements(text);

  for (const chunk of chunks) {
    await playStreamElementsChunk(chunk, voice);
  }
}

function splitTextForStreamElements(text, maxLen = 280) {
  if (text.length <= maxLen) return [text];

  const sentences = text.split(/(?<=[.!?;])\s+/);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text.substring(0, maxLen)];
}

function playStreamElementsChunk(text, voice) {
  return new Promise((resolve, reject) => {
    try {
      const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`;
      const audio = new Audio(url);
      audio.onended = () => resolve();
      audio.onerror = (e) => {
        console.error(
          "[TTS Fallback: StreamElements] Audio playback error:",
          e,
        );
        reject(new Error("StreamElements audio playback failed"));
      };
      audio.play().catch((e) => {
        console.error("[TTS Fallback: StreamElements] Play failed:", e);
        reject(e);
      });
    } catch (err) {
      console.error("[TTS Fallback: StreamElements] Error:", err);
      reject(err);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMERGENCY BACKUP ENGINES — NOT ACTIVELY USED
// To activate any of these, import and wire into the fallback chain in ttsPlayer.js
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Gemini TTS (Emergency Backup #1) ───────────────────────────────────────────

/**
 * Speak using Gemini 2.5 Flash Preview TTS via backend API.
 * Expensive but high quality. Uses the old /api/ai/tts endpoint.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function speakWithGeminiTTS(text) {
  const { api } = await import("./api");

  try {
    const data = await api.generateSpeech(text);
    if (!data?.audio) {
      console.error("[TTS Backup: Gemini] No audio data returned");
      return;
    }

    const audioContext = new (window.AudioContext || window.webkitAudioContext)(
      { sampleRate: 24000 },
    );
    const binaryString = atob(data.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode raw PCM
    const dataInt16 = new Int16Array(bytes.buffer);
    const frameCount = dataInt16.length;
    const buffer = audioContext.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }

    return new Promise((resolve) => {
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        audioContext.close();
        resolve();
      };
      source.start();
    });
  } catch (error) {
    console.error("[TTS Backup: Gemini] Error:", error);
  }
}

// ─── Google Translate TTS (Emergency Backup #2) ─────────────────────────────────

/**
 * Speak using Google Translate's TTS endpoint.
 * Free but limited, may be rate-limited. Good for short texts.
 *
 * @param {string} text
 * @param {string} lang - Language code (default: 'en')
 * @returns {Promise<void>}
 */
export async function speakWithGoogleTranslate(text, lang = "en") {
  const maxLen = 200;
  const chunks = [];

  // Split text into chunks of maxLen
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Find last space within maxLen
    let splitIdx = remaining.lastIndexOf(" ", maxLen);
    if (splitIdx === -1) splitIdx = maxLen;
    chunks.push(remaining.substring(0, splitIdx));
    remaining = remaining.substring(splitIdx).trim();
  }

  for (const chunk of chunks) {
    await new Promise((resolve, reject) => {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob`;
      const audio = new Audio(url);
      audio.onended = () => resolve();
      audio.onerror = (e) => {
        console.error("[TTS Backup: Google Translate] Error:", e);
        reject(e);
      };
      audio.play().catch(reject);
    });
  }
}

// ─── Web Speech API (Emergency Backup #3 — Last Resort) ─────────────────────────

/**
 * Speak using the browser's built-in Web Speech API.
 * No network required. Quality varies by browser/OS.
 *
 * @param {string} text
 * @param {string} lang - Language (default: 'en-US')
 * @returns {Promise<void>}
 */
export async function speakWithWebSpeechAPI(text, lang = "en-US") {
  if (!window.speechSynthesis) {
    console.error("[TTS Backup: Web Speech API] Not supported in this browser");
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      console.error("[TTS Backup: Web Speech API] Error:", e);
      resolve(); // Don't reject — this is the last resort
    };
    window.speechSynthesis.speak(utterance);
  });
}
