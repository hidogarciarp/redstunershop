import fs from "fs";

function parseLogCidade(texto) {
  const registros = [];
  const linhas = texto.split("\n");
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i].trim();

    const matchId = linha.match(
      /^\[ID\]:\s*(\d+)\s+(.+?)\s*\(\s*(ENTROU EM SERVI[ÇC]O|SAIU DE SERVI[ÇC]O)\s*-[^)]+\)/i
    );

    if (matchId) {
      const idJogo = matchId[1];
      const nomePersonagem = matchId[2].trim();
      const acao = matchId[3].toUpperCase().includes("ENTROU") ? "entrada" : "saida";

      let dataISO = null;
      let uuid = null;

      for (let j = i + 1; j < Math.min(i + 8, linhas.length); j++) {
        const l = linhas[j].trim();
        if (!dataISO) {
          const mData = l.match(/^\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}:\d{2}:\d{2})/);
          if (mData) {
            const [, dd, mm, aaaa, hora] = mData;
            dataISO = `${aaaa}-${mm}-${dd}T${hora}-03:00`;
          }
        }
        if (!uuid) {
          const mUuid = l.match(/^\[UUID\]:\s*([a-f0-9-]{36})/i);
          if (mUuid) uuid = mUuid[1];
        }
        if (dataISO && uuid) break;
      }

      if (dataISO) {
        registros.push({ idJogo, nomePersonagem, acao, dataISO, uuid });
      }
    }
    i++;
  }

  return registros;
}

const logText = `RUA2 - Logs
APP
 — 19:24
[ID]: 2099 Gracinha Felix ( SAIU DE SERVIÇO - Reds Tunnershop )

[DATA]: 19/06/2026, 19:24:37
[UUID]: ab1ba36c-f8dd-432c-a441-e663eb63c56d
RUA2 - Logs
APP
 — 19:08
[ID]: 4414 Jota Silva ( ENTROU EM SERVIÇO - Reds Tunnershop )

[DATA]: 19/06/2026, 19:08:06
[UUID]: 9f1572c6-e191-46d0-8d9e-3c5cdb9e3794
RUA2 - Logs
APP
 — 19:07
[ID]: 2341 Mila Yamashita ( ENTROU EM SERVIÇO - Reds Tunnershop )

[DATA]: 19/06/2026, 19:07:06
[UUID]: a90d779b-4d7b-4539-9e4c-ca34ac12e2cd
RUA2 - Logs
APP
 — 18:53
[ID]: 1085 Alice Bianchi ( ENTROU EM SERVIÇO - Reds Tunnershop )

[DATA]: 19/06/2026, 18:53:35
[UUID]: be3a5ca1-d249-48bf-9d45-090212678cea
RUA2 - Logs
APP
 — 18:53
[ID]: 1085 Alice Bianchi ( SAIU DE SERVIÇO - Reds Tunnershop )

[DATA]: 19/06/2026, 18:53:35
[UUID]: b85c4eb1-c5c3-4e21-88ec-552215512496`;

console.log("Parsed records count:", parseLogCidade(logText).length);
console.log(parseLogCidade(logText));
