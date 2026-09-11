import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const getWebhookUrl = (tipo) => {
  const map = {
    estetica: process.env.DISCORD_WEBHOOK_ESTETICA || process.env.NEXT_PUBLIC_WEBHOOK_ESTETICA,
    tunagem: process.env.DISCORD_WEBHOOK_TUNAGEM || process.env.NEXT_PUBLIC_WEBHOOK_TUNAGEM,
    vendas: process.env.DISCORD_WEBHOOK_VENDAS || process.env.NEXT_PUBLIC_WEBHOOK_VENDAS,
    guincho: process.env.DISCORD_WEBHOOK_GUINCHO || process.env.NEXT_PUBLIC_WEBHOOK_GUINCHO,
    reboque:
      process.env.DISCORD_WEBHOOK_REBOQUE ||
      process.env.NEXT_PUBLIC_WEBHOOK_REBOQUE ||
      "https://discord.com/api/webhooks/1547358481122590870/iiYd9HgKm_Sk7Li67mNzlcdqOyXNsY-V2pSu13bqmAqeKfCSkZ4F2Vg-2aJoLI6X893V",
    rodas: process.env.DISCORD_WEBHOOK_RODAS || process.env.NEXT_PUBLIC_WEBHOOK_RODAS,
    report: process.env.DISCORD_WEBHOOK_REPORT || process.env.NEXT_PUBLIC_WEBHOOK_REPORT,
    pagamentos: process.env.DISCORD_WEBHOOK_PAGAMENTOS || process.env.NEXT_PUBLIC_WEBHOOK_PAGAMENTOS,
    caixa2: process.env.DISCORD_WEBHOOK_CAIXA2 || process.env.NEXT_PUBLIC_WEBHOOK_CAIXA2,
  };

  let url = map[tipo];
  if (!url) {
    if (tipo === "tunagem") url = map.estetica;
    else if (tipo === "estetica") url = map.tunagem;
    else if (tipo === "reboque") url = map.guincho || map.estetica;
    else if (tipo === "caixa2") url = map.pagamentos;
  }
  return url;
};

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTipo = searchParams.get("tipo") || "estetica";
    const tipo = rawTipo.split("?")[0].split("&")[0].toLowerCase();

    const webhookUrl = getWebhookUrl(tipo);
    if (!webhookUrl) {
      return NextResponse.json(
        { error: `Webhook do tipo '${tipo}' não configurado no servidor.` },
        { status: 400 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let discordResponse;

    if (contentType.includes("multipart/form-data")) {
      const incomingFormData = await request.formData();
      const outgoingFormData = new FormData();

      for (const [key, value] of incomingFormData.entries()) {
        outgoingFormData.append(key, value);
      }

      discordResponse = await fetch(webhookUrl + "?wait=true", {
        method: "POST",
        body: outgoingFormData,
      });
    } else {
      const jsonBody = await request.json();
      discordResponse = await fetch(webhookUrl + "?wait=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonBody),
      });
    }

    const responseData = await discordResponse.json().catch(() => ({}));

    // Injeta channel_id se ausente para facilitar a geração de link pelo cliente
    if (responseData && !responseData.channel_id && webhookUrl.includes("/webhooks/")) {
      responseData.channel_id = webhookUrl.split("/webhooks/")[1]?.split("/")[0];
    }

    return NextResponse.json(responseData, {
      status: discordResponse.status,
    });
  } catch (error) {
    console.error("Erro no proxy de webhook Discord:", error);
    return NextResponse.json(
      { error: "Falha ao encaminhar requisição para o Discord: " + (error?.message || error) },
      { status: 500 }
    );
  }
}