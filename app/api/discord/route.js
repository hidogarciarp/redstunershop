export async function POST(request) {
  const data = await request.json()
  
  // Essa URL será configurada na Vercel depois por segurança
  const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL 

  if (!WEBHOOK_URL) {
    return new Response('Webhook não configurado', { status: 500 })
  }

  const payload = {
    embeds: [{
      title: "🚀 Novo Serviço Registrado",
      color: 0x00ff00,
      fields: [
        { name: "Serviço", value: data.nome, inline: true },
        { name: "Valor", value: data.valor, inline: true },
      ],
      timestamp: new Date().toISOString()
    }]
  }

  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}