const REQUIRED_WEBHOOKS = [
  "NEXT_PUBLIC_WEBHOOK_ESTETICA",
  "NEXT_PUBLIC_WEBHOOK_TUNAGEM",
  "NEXT_PUBLIC_WEBHOOK_VENDAS",
  "NEXT_PUBLIC_WEBHOOK_GUINCHO",
  "NEXT_PUBLIC_WEBHOOK_RODAS",
  "NEXT_PUBLIC_WEBHOOK_REPORT",
  "NEXT_PUBLIC_WEBHOOK_PAGAMENTOS",
  "NEXT_PUBLIC_WEBHOOK_CAIXA2",
];

const REQUIRED_SUPABASE = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

export const ALL_WEBHOOKS = REQUIRED_WEBHOOKS;

export function validateEnv() {
  const missing = [];

  for (const key of REQUIRED_SUPABASE) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `⚠️ Variáveis de ambiente ausentes: ${missing.join(", ")}.\n` +
      "Verifique o arquivo .env.local"
    );
  }

  return missing.length === 0;
}
