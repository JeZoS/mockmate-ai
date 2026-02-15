/**
 * TTS Service — High-performance Edge TTS with connection pooling,
 * sentence splitting, parallel synthesis, LRU caching, and concurrency control.
 *
 * Designed to handle 100–300 concurrent interview sessions with <0.5s first-audio latency.
 */

const { EdgeTTS } = require("node-edge-tts");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

// ─── Configuration ──────────────────────────────────────────────────────────────

const CONFIG = {
  voice: "en-US-AriaNeural", // Clear, professional female voice
  // voice: "en-US-AvaNeural", // Other choices
  // voice: "en-US-JennyNeural",
  // voice: "en-US-EmmaNeural",
  // voice: "en-US-AnaNeural",
  // voice: "en-US-NeerjaNeural",
  rate: "+0%",
  pitch: "+0Hz",
  outputFormat: "audio-24khz-96kbitrate-mono-mp3",
  poolSize: 5, // Pre-created EdgeTTS instances
  maxConcurrent: 50, // Max simultaneous WebSocket TTS calls
  cacheMaxEntries: 500, // LRU cache size (sentence → mp3 buffer)
  tempDir: path.join(os.tmpdir(), "mockmate-tts"),
  sentenceTimeout: 8000, // Timeout per sentence synthesis (ms)
};

// Ensure temp directory exists
if (!fs.existsSync(CONFIG.tempDir)) {
  fs.mkdirSync(CONFIG.tempDir, { recursive: true });
}

// ─── Semaphore (Concurrency Limiter) ────────────────────────────────────────────

class Semaphore {
  constructor(max) {
    this._max = max;
    this._current = 0;
    this._queue = [];
  }

  async acquire() {
    if (this._current < this._max) {
      this._current++;
      return;
    }
    return new Promise((resolve) => this._queue.push(resolve));
  }

  release() {
    this._current--;
    if (this._queue.length > 0) {
      this._current++;
      const next = this._queue.shift();
      next();
    }
  }
}

const concurrencySemaphore = new Semaphore(CONFIG.maxConcurrent);

// ─── LRU Cache ──────────────────────────────────────────────────────────────────

class LRUCache {
  constructor(maxSize) {
    this._maxSize = maxSize;
    this._map = new Map();
  }

  get(key) {
    if (!this._map.has(key)) return null;
    const value = this._map.get(key);
    // Move to end (most recently used)
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this._map.has(key)) {
      this._map.delete(key);
    } else if (this._map.size >= this._maxSize) {
      // Evict the least recently used (first entry)
      const firstKey = this._map.keys().next().value;
      this._map.delete(firstKey);
    }
    this._map.set(key, value);
  }

  get size() {
    return this._map.size;
  }
}

const audioCache = new LRUCache(CONFIG.cacheMaxEntries);

// ─── EdgeTTS Connection Pool ────────────────────────────────────────────────────

/**
 * Pool of EdgeTTS instances. Each instance is stateless between calls,
 * but pre-creation avoids constructor overhead under load.
 */
class TTSPool {
  constructor(size) {
    this._pool = [];
    this._available = [];
    for (let i = 0; i < size; i++) {
      const instance = new EdgeTTS({
        voice: CONFIG.voice,
        rate: CONFIG.rate,
        pitch: CONFIG.pitch,
        outputFormat: CONFIG.outputFormat,
        timeout: CONFIG.sentenceTimeout,
      });
      this._pool.push(instance);
      this._available.push(instance);
    }
    this._waiters = [];
  }

  async acquire() {
    if (this._available.length > 0) {
      return this._available.pop();
    }
    // All instances in use — wait for one to be released
    return new Promise((resolve) => this._waiters.push(resolve));
  }

  release(instance) {
    if (this._waiters.length > 0) {
      const waiter = this._waiters.shift();
      waiter(instance);
    } else {
      this._available.push(instance);
    }
  }

  /**
   * Create a fresh instance (not from pool) for overflow scenarios.
   * Used when pool is exhausted and we can't wait.
   */
  static createFresh() {
    return new EdgeTTS({
      voice: CONFIG.voice,
      rate: CONFIG.rate,
      pitch: CONFIG.pitch,
      outputFormat: CONFIG.outputFormat,
      timeout: CONFIG.sentenceTimeout,
    });
  }
}

const ttsPool = new TTSPool(CONFIG.poolSize);

// ─── Sentence Splitter ──────────────────────────────────────────────────────────

/**
 * Split text into natural sentences for parallel TTS synthesis.
 * Preserves punctuation. Coalesces tiny fragments (< 10 chars) into the previous sentence.
 */
function splitSentences(text) {
  if (!text || typeof text !== "string") return [];

  // Clean up any JSON artifacts or markdown
  let cleaned = text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/\*\*/g, "") // Remove bold markers
    .replace(/\*/g, "") // Remove italic markers
    .replace(/#{1,6}\s/g, "") // Remove heading markers
    .trim();

  if (!cleaned) return [];

  // Split on sentence boundaries: . ! ? ; and newlines
  // Lookahead ensures we keep the delimiter with the sentence
  const rawParts = cleaned.split(/(?<=[.!?;])\s+|\n+/);

  const sentences = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Coalesce tiny fragments into the previous sentence
    if (trimmed.length < 10 && sentences.length > 0) {
      sentences[sentences.length - 1] += " " + trimmed;
    } else {
      sentences.push(trimmed);
    }
  }

  // If splitting produced nothing useful, return the whole text as one sentence
  if (sentences.length === 0 && cleaned.length > 0) {
    sentences.push(cleaned);
  }

  return sentences;
}

// ─── Single Sentence Synthesis ──────────────────────────────────────────────────

/**
 * Synthesize a single sentence to MP3 buffer.
 * Uses pool instance, semaphore for concurrency, and cache for dedup.
 */
async function synthesizeSentence(sentence) {
  // Check cache first
  const cacheKey = sentence.trim().toLowerCase();
  const cached = audioCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  await concurrencySemaphore.acquire();
  let poolInstance = null;
  let usedFresh = false;

  try {
    // Try to acquire from pool with a short timeout
    const poolPromise = ttsPool.acquire();
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve(null), 200),
    );
    poolInstance = await Promise.race([poolPromise, timeoutPromise]);

    if (!poolInstance) {
      // Pool exhausted — create a fresh instance
      poolInstance = TTSPool.createFresh();
      usedFresh = true;
    }

    // Generate unique temp file path
    const hash = crypto.randomBytes(8).toString("hex");
    const tempFile = path.join(CONFIG.tempDir, `tts_${hash}.mp3`);

    try {
      await poolInstance.ttsPromise(sentence, tempFile);
      const mp3Buffer = await fs.promises.readFile(tempFile);

      // Clean up temp file (fire and forget)
      fs.promises.unlink(tempFile).catch(() => {});

      // Cache the result
      if (mp3Buffer && mp3Buffer.length > 0) {
        audioCache.set(cacheKey, mp3Buffer);
      }

      return mp3Buffer;
    } finally {
      // Clean up temp file if it still exists
      fs.promises.unlink(tempFile).catch(() => {});
    }
  } finally {
    concurrencySemaphore.release();
    if (poolInstance && !usedFresh) {
      ttsPool.release(poolInstance);
    }
  }
}

// ─── Parallel Synthesis with Ordered Streaming ──────────────────────────────────

/**
 * Synthesize all sentences in parallel, stream MP3 chunks to HTTP response
 * in original sentence order as they complete.
 *
 * Binary protocol per chunk: [4-byte big-endian length][MP3 data]
 * Terminal signal: [4 bytes of 0x00000000]
 *
 * @param {string} text - Full text to synthesize
 * @param {import('express').Response} res - Express response object
 */
async function streamTtsChunks(text, res) {
  const sentences = splitSentences(text);

  if (sentences.length === 0) {
    // Write terminal signal and end
    const endSignal = Buffer.alloc(4, 0);
    res.write(endSignal);
    res.end();
    return;
  }

  // Launch all sentences in parallel
  const synthesisPromises = sentences.map((sentence, index) => {
    return synthesizeSentence(sentence)
      .then((buffer) => ({ index, buffer, error: null }))
      .catch((error) => {
        console.error(
          `[TTS] Sentence ${index} synthesis failed: "${sentence.substring(0, 50)}..."`,
          error.message,
        );
        return { index, buffer: null, error };
      });
  });

  // Stream results in order as they complete
  const results = new Array(sentences.length).fill(null);
  let nextToSend = 0;

  // Create a promise resolver for each slot
  const resolvers = sentences.map(() => {
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    return { promise, resolve };
  });

  // As each synthesis completes, store result and resolve its slot
  for (const synthPromise of synthesisPromises) {
    synthPromise.then((result) => {
      results[result.index] = result;
      resolvers[result.index].resolve();
    });
  }

  // Stream in order
  for (let i = 0; i < sentences.length; i++) {
    await resolvers[i].promise;

    const result = results[i];
    if (result && result.buffer && result.buffer.length > 0) {
      // Write length header (4 bytes, big-endian)
      const lengthBuf = Buffer.alloc(4);
      lengthBuf.writeUInt32BE(result.buffer.length, 0);

      // Check if response is still writable
      if (!res.writableEnded) {
        res.write(lengthBuf);
        res.write(result.buffer);
      }
    }
    // If failed, skip this chunk silently (already logged above)
  }

  // Write terminal signal
  if (!res.writableEnded) {
    const endSignal = Buffer.alloc(4, 0);
    res.write(endSignal);
    res.end();
  }
}

/**
 * Synthesize full text to a single MP3 buffer (non-streaming alternative).
 * Useful for fallback or simpler use cases.
 *
 * @param {string} text - Full text to synthesize
 * @returns {Promise<Buffer>} - Complete MP3 buffer
 */
async function synthesizeFull(text) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return Buffer.alloc(0);

  const results = await Promise.allSettled(
    sentences.map((s) => synthesizeSentence(s)),
  );

  const buffers = [];
  results.forEach((result, i) => {
    if (
      result.status === "fulfilled" &&
      result.value &&
      result.value.length > 0
    ) {
      buffers.push(result.value);
    } else if (result.status === "rejected") {
      console.error(
        `[TTS] Full synthesis — sentence ${i} failed:`,
        result.reason?.message,
      );
    }
  });

  return Buffer.concat(buffers);
}

// ─── Health / Stats ─────────────────────────────────────────────────────────────

function getStats() {
  return {
    cacheSize: audioCache.size,
    cacheMaxSize: CONFIG.cacheMaxEntries,
    poolSize: CONFIG.poolSize,
    maxConcurrent: CONFIG.maxConcurrent,
    voice: CONFIG.voice,
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  streamTtsChunks,
  synthesizeFull,
  synthesizeSentence,
  splitSentences,
  getStats,
  CONFIG,
};
