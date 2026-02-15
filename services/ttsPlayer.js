/**
 * TTS Player — Audio orchestrator with streaming playback, ordered queue,
 * and automatic fallback to StreamElements.
 *
 * Singleton pattern. Main entry: speak(text) → Promise<void>
 * The Promise resolves when ALL audio chunks have finished playing.
 */

import { speakWithStreamElements } from "./ttsFallbacks";

// ─── Configuration ──────────────────────────────────────────────────────────────

// const TTS_API_URL_END_POINT = "/api/ai/tts";

const TTS_API_URL_END_POINT = "http://localhost:5001/api/ai/tts";

const FETCH_TIMEOUT_MS = 15000; // Max wait for backend TTS response

// ─── State ──────────────────────────────────────────────────────────────────────

let audioContext = null;
let playbackQueue = []; // Array of { buffer: AudioBuffer, index: number }
let isCurrentlyPlaying = false;
let currentSource = null;
let stopRequested = false;
let currentResolve = null; // Resolve function for the current speak() Promise
let pendingChunks = 0; // How many chunks are still expected
let chunksPlayed = 0; // How many chunks have finished playing
let totalChunks = 0; // Total chunks received

// ─── Audio Context Management ───────────────────────────────────────────────────

function getAudioContext() {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

// ─── Binary Stream Parser ───────────────────────────────────────────────────────

/**
 * Parse the binary stream protocol: [4-byte big-endian length][MP3 data]
 * Terminal signal: 4 bytes of 0x00000000
 *
 * Yields { index, mp3Data } objects as complete chunks arrive.
 */
async function* parseBinaryStream(reader) {
  let buffer = new Uint8Array(0);
  let chunkIndex = 0;

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    // Append new data to buffer
    const newBuffer = new Uint8Array(buffer.length + value.length);
    newBuffer.set(buffer, 0);
    newBuffer.set(value, buffer.length);
    buffer = newBuffer;

    // Process complete chunks from buffer
    while (buffer.length >= 4) {
      // Read the 4-byte length header
      const view = new DataView(buffer.buffer, buffer.byteOffset, 4);
      const chunkLength = view.getUint32(0, false); // big-endian

      // Terminal signal
      if (chunkLength === 0) {
        return;
      }

      // Not enough data yet for this chunk
      if (buffer.length < 4 + chunkLength) {
        break;
      }

      // Extract the MP3 data
      const mp3Data = buffer.slice(4, 4 + chunkLength);
      yield { index: chunkIndex++, mp3Data };

      // Remove processed bytes from buffer
      buffer = buffer.slice(4 + chunkLength);
    }
  }
}

// ─── Chunk Decoding & Playback ──────────────────────────────────────────────────

/**
 * Decode MP3 data to AudioBuffer using the Web Audio API.
 */
async function decodeMP3(mp3Data) {
  const ctx = getAudioContext();
  // Some browsers need ArrayBuffer, not Uint8Array
  const arrayBuffer = mp3Data.buffer.slice(
    mp3Data.byteOffset,
    mp3Data.byteOffset + mp3Data.byteLength,
  );
  return ctx.decodeAudioData(arrayBuffer);
}

/**
 * Play the next audio buffer in the queue.
 * Called recursively when each chunk finishes.
 */
function playNextInQueue() {
  if (stopRequested || playbackQueue.length === 0) {
    isCurrentlyPlaying = false;

    // If no more chunks pending and queue is empty, we're done
    if (pendingChunks === 0 && currentResolve) {
      const resolve = currentResolve;
      currentResolve = null;
      resolve();
    }
    return;
  }

  // Sort queue by index to maintain order
  playbackQueue.sort((a, b) => a.index - b.index);

  // Only play if the next expected chunk is available
  const expectedIndex = chunksPlayed;
  const nextChunk = playbackQueue[0];

  if (nextChunk.index !== expectedIndex) {
    // Next chunk hasn't arrived yet — wait
    isCurrentlyPlaying = false;
    return;
  }

  // Remove from queue and play
  playbackQueue.shift();
  isCurrentlyPlaying = true;

  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = nextChunk.buffer;
  source.connect(ctx.destination);
  currentSource = source;

  source.onended = () => {
    currentSource = null;
    chunksPlayed++;
    playNextInQueue();
  };

  source.start();
}

/**
 * Enqueue a decoded audio buffer for ordered playback.
 */
function enqueueAudioBuffer(index, buffer) {
  playbackQueue.push({ index, buffer });

  // If not currently playing, try to start
  if (!isCurrentlyPlaying && !stopRequested) {
    playNextInQueue();
  }
}

// ─── Main API ───────────────────────────────────────────────────────────────────

/**
 * Speak text using the backend streaming TTS service.
 * Falls back to StreamElements if backend fails.
 *
 * @param {string} text - Text to speak
 * @returns {Promise<void>} Resolves when ALL audio has finished playing
 */
export async function speak(text) {
  if (!text || text.trim().length === 0) return;

  // Reset state
  stop();
  stopRequested = false;
  playbackQueue = [];
  isCurrentlyPlaying = false;
  chunksPlayed = 0;
  totalChunks = 0;
  pendingChunks = 1; // Set to 1 to indicate we're expecting chunks

  return new Promise(async (resolve) => {
    currentResolve = resolve;

    try {
      const token = localStorage.getItem("token");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(TTS_API_URL_END_POINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        throw new Error(`[TTS Player] Backend returned ${response.status}`);
      }

      const reader = response.body.getReader();
      let receivedAny = false;

      // Process chunks as they stream in
      for await (const { index, mp3Data } of parseBinaryStream(reader)) {
        if (stopRequested) break;

        receivedAny = true;
        totalChunks = index + 1;

        try {
          const audioBuffer = await decodeMP3(mp3Data);
          enqueueAudioBuffer(index, audioBuffer);
        } catch (decodeErr) {
          console.error(
            `[TTS Player] Failed to decode chunk ${index}:`,
            decodeErr,
          );
          // Skip this chunk, continue with others
        }
      }

      // All chunks received
      pendingChunks = 0;

      if (!receivedAny) {
        throw new Error("[TTS Player] No audio chunks received from backend");
      }

      // If nothing is playing and queue is empty, resolve immediately
      if (!isCurrentlyPlaying && playbackQueue.length === 0) {
        if (currentResolve) {
          const r = currentResolve;
          currentResolve = null;
          r();
        }
      }
    } catch (error) {
      console.error(
        "[TTS Player] Backend TTS failed, falling back to StreamElements:",
        {
          error: error.message,
          textLength: text.length,
          textPreview: text.substring(0, 80),
        },
      );

      // Fallback to StreamElements
      try {
        pendingChunks = 0;
        await speakWithStreamElements(text);
      } catch (fallbackError) {
        console.error("[TTS Player] StreamElements fallback also failed:", {
          error: fallbackError.message,
          textPreview: text.substring(0, 80),
        });
      }

      // Resolve regardless — don't block the UI
      if (currentResolve) {
        const r = currentResolve;
        currentResolve = null;
        r();
      }
    }
  });
}

/**
 * Immediately stop all audio playback and clear the queue.
 */
export function stop() {
  stopRequested = true;

  if (currentSource) {
    try {
      currentSource.stop();
    } catch (e) {
      /* already stopped */
    }
    currentSource = null;
  }

  playbackQueue = [];
  isCurrentlyPlaying = false;
  pendingChunks = 0;

  // Resolve any pending speak() promise
  if (currentResolve) {
    const r = currentResolve;
    currentResolve = null;
    r();
  }
}

/**
 * Check if audio is currently playing.
 */
export function getIsPlaying() {
  return isCurrentlyPlaying || playbackQueue.length > 0;
}

// Re-export for backward compatibility
export const stopAudio = stop;
