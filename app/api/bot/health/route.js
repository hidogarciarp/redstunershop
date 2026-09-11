export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url") || process.env.NEXT_PUBLIC_BOT_URL || "https://rua2-pontos-bot.onrender.com";

  const normalized = targetUrl.replace(/\/+$/, "");
  const healthEndpoint = normalized.endsWith("/health") ? normalized : `${normalized}/health`;

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const res = await fetch(healthEndpoint, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - started;

    if (!res.ok) {
      return new Response(JSON.stringify({
        ok: false,
        status: res.status,
        latencyMs,
        url: healthEndpoint,
        error: `Bot respondeu com status HTTP ${res.status}`,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await res.json().catch(() => ({}));
    return new Response(JSON.stringify({
      ok: true,
      status: 200,
      latencyMs,
      url: healthEndpoint,
      data,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const latencyMs = Date.now() - started;
    return new Response(JSON.stringify({
      ok: false,
      latencyMs,
      url: healthEndpoint,
      error: error?.name === "AbortError" ? "Timeout (bot demorou mais de 12s para acordar)" : (error?.message || "Falha ao conectar com o bot"),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
