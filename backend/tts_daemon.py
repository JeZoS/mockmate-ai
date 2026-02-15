
import sys
import asyncio
import struct
import json
import aiohttp
import edge_tts

# Protocol:
# Input:  [4-byte length][JSON payload]  e.g. { "text": "Hello", "voice": "en-US-AriaNeural" }
# Output (streaming):
#   [4-byte 0xFFFFFFFF]   — signals streaming mode
#   [4-byte chunk-len][chunk-data]  — repeated for each audio chunk
#   [4-byte 0x00000000]   — end marker

# Persistent connector for TCP/TLS connection reuse across requests.
# This avoids the ~500-800ms TLS handshake overhead on every request.
_connector = None

async def get_connector():
    global _connector
    if _connector is None or _connector.closed:
        _connector = aiohttp.TCPConnector(
            limit=4,
            keepalive_timeout=300,  # Keep connections alive for 5 minutes
            enable_cleanup_closed=True,
        )
    return _connector

async def generate_audio_streaming(text, voice, stdout):
    """Generate TTS audio and stream chunks to stdout as they arrive."""
    connector = await get_connector()
    communicate = edge_tts.Communicate(text, voice, connector=connector)

    # Send streaming mode header
    stdout.write(struct.pack('>I', 0xFFFFFFFF))
    stdout.flush()

    chunk_count = 0
    async for chunk in communicate.stream():
        if chunk["type"] == "audio" and chunk["data"]:
            data = chunk["data"]
            stdout.write(struct.pack('>I', len(data)))
            stdout.write(data)
            stdout.flush()
            chunk_count += 1

    # Send end marker
    stdout.write(struct.pack('>I', 0))
    stdout.flush()

    return chunk_count

async def warmup(voice="en-US-AriaNeural"):
    """Pre-establish WebSocket connection by synthesizing a tiny phrase."""
    try:
        connector = await get_connector()
        communicate = edge_tts.Communicate("hi", voice, connector=connector)
        async for _ in communicate.stream():
            pass
        sys.stderr.write("TTS Daemon warmup complete — connection pool primed\n")
        sys.stderr.flush()
    except Exception as e:
        sys.stderr.write(f"TTS Daemon warmup failed (non-fatal): {e}\n")
        sys.stderr.flush()

async def main():
    stdin = sys.stdin.buffer
    stdout = sys.stdout.buffer

    # Warmup: pre-establish connection to reduce first-request latency
    await warmup()

    while True:
        try:
            # Read 4 bytes for length
            length_bytes = stdin.read(4)
            if not length_bytes or len(length_bytes) < 4:
                break

            length = struct.unpack('>I', length_bytes)[0]

            # Read payload
            payload_bytes = stdin.read(length)
            if not payload_bytes:
                break

            try:
                request = json.loads(payload_bytes.decode('utf-8'))
                text = request.get("text", "")
                voice = request.get("voice", "en-US-AriaNeural")

                if text:
                    await generate_audio_streaming(text, voice, stdout)
                else:
                    # Empty response for empty text
                    stdout.write(struct.pack('>I', 0))
                    stdout.flush()

            except Exception as e:
                sys.stderr.write(f"Error processing request: {str(e)}\n")
                sys.stderr.flush()
                # Send empty non-streaming response to unblock Node
                stdout.write(struct.pack('>I', 0))
                stdout.flush()

        except Exception as e:
            sys.stderr.write(f"Daemon Loop Error: {str(e)}\n")
            sys.stderr.flush()
            break

    # Cleanup connector on exit
    if _connector and not _connector.closed:
        await _connector.close()

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(main())
    finally:
        loop.close()
