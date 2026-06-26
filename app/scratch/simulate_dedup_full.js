import { parseLogCidade, separarEventosPorFuncionario } from "../components/pages/PontoAdminPage_isolated.js";
import fs from "fs";

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

const registros = parseLogCidade(logText);
const mapa = separarEventosPorFuncionario(registros);
console.log("Original parsed entries:", JSON.stringify(mapa, null, 2));

// Simulate combinedRecords
const combinedRecords = []; // Supposing registrosCidade is empty, since let's say they're not in the current page either

Object.keys(mapa).forEach((idJogo) => {
  const funcData = mapa[idJogo];
  const uuidSaidasParaRemover = new Set();
  
  funcData.entradas = funcData.entradas.filter((entrada) => {
    const registroExistente = combinedRecords.find((r) => r.uuid_entrada === entrada.uuid);
    if (registroExistente && registroExistente.saida) {
      if (registroExistente.uuid_saida) {
        uuidSaidasParaRemover.add(registroExistente.uuid_saida);
        return false;
      }
      
      const temSaidaValidaNoLog = funcData.saidas.some(s => {
        if (uuidSaidasParaRemover.has(s.uuid)) return false;
        const jaNoBanco = combinedRecords.some(r => r.uuid_saida === s.uuid);
        if (jaNoBanco) return false;
        const diffMin = (new Date(s.dataISO) - new Date(entrada.dataISO)) / 60000;
        return diffMin > 0 && diffMin <= 300;
      });
      if (!temSaidaValidaNoLog) return false;
    }
    return true;
  });

  funcData.saidas = funcData.saidas.filter((saida) => {
    if (uuidSaidasParaRemover.has(saida.uuid)) return false;
    const jaNoBanco = combinedRecords.some(r => r.uuid_saida === saida.uuid);
    if (jaNoBanco) return false;
    return true;
  });

  if (funcData.entradas.length === 0 && funcData.saidas.length === 0) {
    delete mapa[idJogo];
  }
});

console.log("After dedup filter (empty combinedRecords):", JSON.stringify(mapa, null, 2));
