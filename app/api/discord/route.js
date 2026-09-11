import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_WEBHOOKS = {
  pagamentos: "https://discord.com/api/webhooks/1548095936264413216/sJTh7Hki2NfbE6znTKgjF0PGYI_S_vQuk07OvYLVpbVfxDVA0GKOTrmWN53wM0SY_xIT",
  caixa2: "https://discord.com/api/webhooks/1548095936264413216/sJTh7Hki2NfbE6znTKgjF0PGYI_S_vQuk07OvYLVpbVfxDVA0GKOTrmWN53wM0SY_xIT",
  rodas: "https://discord.com/api/webhooks/1548094643743228016/5ZoAEi-RmYYjhhdf32p6rG5uVSu9IwVTSI_1OxE455tTuFPsJAiY4Am8exLOo5n43Yrw",
  report: "https://discord.com/api/webhooks/1548094785573617768/grgXpJw1AaCLkqgaBR298iXEzBuCHTk6zP2qHa3WNOU_pbEFNr7lp79ANT_LnIvJRpJF",
  reboque: "https://discord.com/api/webhooks/1548095041657110631/8xGF7xp98CJD-hg6TXTmTurJ-vrFp6tlCWgw8E5fnmYNCK2zF92HE1x3iX93flDERoJG",
  guincho: "https://discord.com/api/webhooks/1548095342900158487/Bi3uzFAN45H0v4KAV4Wt5T6OCCd9OJZVHtzEXbXKffFPN91aeK4FM9r-fGJnecRrGAIX",
  vendas: "https://discord.com/api/webhooks/1548095432339624099/HAtNIYDsrsK5lc1Q34v1hDoC4FkPosf-c4wewqOgeSvEhn5uBi9ir51BptEFN92l9Gnn",
  tunagem: "https://discord.com/api/webhooks/1548095528578056318/yiHKnkcIA-V_q_6XvoytZtKsqzia8dk32E8JUWupRfvPKC2U0OdSPXl1Fu1Myya9w8rR",
  estetica: "https://discord.com/api/webhooks/1548095664645214288/qL3OPKKozmSM2GpcT1u3ABNzQW4DP5KvRWbQCSK7EmhH_V-Wd9O3jq9ZK0uje_3i3bME",
};

const getWebhookUrl = (tipo) => {
  const envMap = {
    estetica: process.env.DISCORD_WEBHOOK_ESTETICA || process.env.NEXT_PUBLIC_WEBHOOK_ESTETICA,
    tunagem: process.env.DISCORD_WEBHOOK_TUNAGEM || process.env.NEXT_PUBLIC_WEBHOOK_TUNAGEM,
    vendas: process.env.DISCORD_WEBHOOK_VENDAS || process.env.NEXT_PUBLIC_WEBHOOK_VENDAS,
    guincho: process.env.DISCORD_WEBHOOK_GUINCHO || process.env.NEXT_PUBLIC_WEBHOOK_GUINCHO,
    reboque: process.env.DISCORD_WEBHOOK_REBOQUE || process.env.NEXT_PUBLIC_WEBHOOK_REBOQUE,
    rodas: process.env.DISCORD_WEBHOOK_RODAS || process.env.NEXT_PUBLIC_WEBHOOK_RODAS,
    report: process.env.DISCORD_WEBHOOK_REPORT || process.env.NEXT_PUBLIC_WEBHOOK_REPORT,
    pagamentos: process.env.DISCORD_WEBHOOK_PAGAMENTOS || process.env.NEXT_PUBLIC_WEBHOOK_PAGAMENTOS,
    caixa2: process.env.DISCORD_WEBHOOK_CAIXA2 || process.env.NEXT_PUBLIC_WEBHOOK_CAIXA2,
  };

  let url = envMap[tipo] || DEFAULT_WEBHOOKS[tipo];
  if (!url) {
    if (tipo === "tunagem") url = envMap.estetica || DEFAULT_WEBHOOKS.estetica;
    else if (tipo === "estetica") url = envMap.tunagem || DEFAULT_WEBHOOKS.tunagem;
    else if (tipo === "reboque") url = envMap.guincho || DEFAULT_WEBHOOKS.guincho;
    else if (tipo === "caixa2") url = envMap.pagamentos || DEFAULT_WEBHOOKS.pagamentos;
    else if (tipo === "rodas") url = envMap.report || DEFAULT_WEBHOOKS.report;
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