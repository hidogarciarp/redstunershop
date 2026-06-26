// Simple copy of parser and separation functions for node.js testing

export function parseLogCidade(texto) {
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

export function separarEventosPorFuncionario(registros) {
  const mapa = {};

  registros.forEach((r) => {
    if (!mapa[r.idJogo]) {
      mapa[r.idJogo] = { nomePersonagem: r.nomePersonagem, entradas: [], saidas: [] };
    }
    if (r.acao === "entrada") {
      mapa[r.idJogo].entradas.push({ dataISO: r.dataISO, uuid: r.uuid });
    } else {
      mapa[r.idJogo].saidas.push({ dataISO: r.dataISO, uuid: r.uuid });
    }
  });

  Object.values(mapa).forEach((f) => {
    const sortFn = (a, b) => new Date(a.dataISO) - new Date(b.dataISO);
    f.entradas.sort(sortFn);
    f.saidas.sort(sortFn);

    const filterDedup = (item, i, arr) => {
      if (i === 0) return true;
      const d1 = new Date(item.dataISO);
      const d2 = new Date(arr[i-1].dataISO);
      return (
        d1.getFullYear() !== d2.getFullYear() ||
        d1.getMonth() !== d2.getMonth() ||
        d1.getDate() !== d2.getDate() ||
        d1.getHours() !== d2.getHours() ||
        d1.getMinutes() !== d2.getMinutes()
      );
    };

    f.entradas = f.entradas.filter(filterDedup);
    f.saidas = f.saidas.filter(filterDedup);
  });

  return mapa;
}
