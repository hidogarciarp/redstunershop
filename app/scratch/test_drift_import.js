import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://prperurjtvayjrazdxvh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBycGVydXJqdHZheWpyYXpkeHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjEwMzUsImV4cCI6MjA5MDU5NzAzNX0.MDk7Pm5fYQ_18GPUDv0R360y_M1eBaJ2-zKHPhmQOJ0";
const supabase = createClient(supabaseUrl, supabaseKey);

const construtorDate = (dataEHora) => {
  const partesStr = dataEHora.split(",");
  if (partesStr.length < 2) {
    const partesEspaco = dataEHora.trim().split(/\s+/);
    if (partesEspaco.length >= 2) {
      const [d, m, y] = partesEspaco[0].split("/");
      const hora = partesEspaco[1];
      if (!y || !m || !d || !hora) return null;
      return new Date(`${y}-${m}-${d}T${hora}:00-03:00`).toISOString();
    }
    return null;
  }
  const [d, m, y] = partesStr[0].trim().split("/");
  const hora = partesStr[1].trim();
  if (!y || !m || !d || !hora) return null;
  return new Date(`${y}-${m}-${d}T${hora}-03:00`).toISOString();
};

const text = `RUA2 - Logs
APP
 — 14:12
[QUANTIDADE]: 1
[ID]: 5077
[STORENAME]: mechanicReds
[STORETYPE]: Cash
[NOME COMPLETO]: Mikael Bernkastel
[ITEMKEY]: drift
[PRICE]: 15.000
[ITEMNAME]: Kit Drift
[AÇÃO]: buy

[DATA]: 15/06/2026, 14:12:12
[UUID]: d1f097c9-79ed-449b-be4f-a582a08f5e7f`;

async function run() {
  const rawLogs = text.split(/\[UUID\]:/i);
  let extracoes = [];
  rawLogs.forEach((blocoRaw, index) => {
    if (!blocoRaw.trim()) return;
    const linhasRestantesText = index < rawLogs.length - 1 ? rawLogs[index + 1].split('\n')[0].trim() : "";
    if (!linhasRestantesText) return;
    const uuidFull = linhasRestantesText;
    
    const regexNome = /\[(?:NOME[^\]]*|PASSAPORTE[^\]]*)\]\s*:\s*(.*)/i;
    const regexId = /\[ID[^\]]*\]\s*:\s*(\d+)/i;
    const regexQtd = /\[QUANTIDADE[^\]]*\]\s*:\s*(\d+)/i;
    const regexPreco = /\[PRICE[^\]]*\]\s*:\s*(.*)/i;
    const regexData = /\[DATA[^\]]*\]\s*:\s*(.*)/i;
    const regexItemKey = /\[ITEMKEY[^\]]*\]\s*:\s*(.*)/i;
    const regexItemName = /\[ITEMNAME[^\]]*\]\s*:\s*(.*)/i;
    const regexAcao = /\[A[ÇC]ÃO[^\]]*\]\s*:\s*(.*)/i;
    
    const nomeMatch = regexNome.exec(blocoRaw);
    const idMatch = regexId.exec(blocoRaw);
    const qtdMatch = regexQtd.exec(blocoRaw);
    const precoMatch = regexPreco.exec(blocoRaw);
    const dataMatch = regexData.exec(blocoRaw);
    const itemKeyMatch = regexItemKey.exec(blocoRaw);
    const itemNameMatch = regexItemName.exec(blocoRaw);
    const acaoMatch = regexAcao.exec(blocoRaw);

    if (idMatch && dataMatch && itemKeyMatch) {
      const iso = construtorDate(dataMatch[1]);
      if (iso) {
        extracoes.push({
          id_jogo: parseInt(idMatch[1], 10),
          nome_personagem: nomeMatch ? nomeMatch[1].trim() : "Desconhecido",
          item_key: itemKeyMatch[1].trim(),
          item_name: itemNameMatch ? itemNameMatch[1].trim() : "Kit Drift",
          quantidade: qtdMatch ? parseInt(qtdMatch[1], 10) : 1,
          preco: precoMatch ? precoMatch[1].trim() : "15.000",
          data_compra: iso,
          uuid_log: uuidFull,
          acao: acaoMatch ? acaoMatch[1].trim().toLowerCase() : "buy"
        });
      }
    }
  });

  console.log("Parsed Extracted Logs:", extracoes);

  if (extracoes.length > 0) {
    const payload = { ...extracoes[0], importado_por: 643 };
    console.log("Payload to insert:", payload);
    const { data, error } = await supabase
      .from("vendas_drift_cidade")
      .insert([payload]);

    if (error) {
      console.error("Database Insert Error:", error);
    } else {
      console.log("Database Insert Success:", data);
    }
  }
}
run();
