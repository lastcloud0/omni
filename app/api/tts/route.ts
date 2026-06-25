export const runtime = "nodejs";

/**
 * ElevenLabs text-to-speech proxy. Returns audio/mpeg when a key is set;
 * otherwise 204 so the client falls back to browser SpeechSynthesis.
 */
export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  if (!apiKey || !text) {
    return new Response(null, { status: 204 });
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.4, similarity_boost: 0.8 },
        }),
      }
    );

    if (!res.ok) {
      console.error("ElevenLabs error:", await res.text());
      return new Response(null, { status: 204 });
    }

    return new Response(res.body, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error(e);
    return new Response(null, { status: 204 });
  }
}
