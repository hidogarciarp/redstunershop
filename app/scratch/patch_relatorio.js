import fs from 'fs';

const filePath = 'c:/Users/Garrido/registro-servicos/app/components/pages/RelatorioPage.jsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Target the grouping block in the modal
const targetBlock = `    // Agrupar por semana a partir de TODOS OS REGISTROS (sem limite do filtro de período do relatório)
    const semanas = {};
    const logsCompletosFiltrados = filtrarManuais(logsCompletosFunc);
    logsCompletosFiltrados.forEach((reg) => {
      if (!reg.entrada || !reg.saida) return;
      const { key, label } = obterLabelSemana(reg.data);
      if (!key) return;

      const diffMin = (new Date(reg.saida) - new Date(reg.entrada)) / 60000;
      if (diffMin > 0) {
        if (!semanas[key]) {
          semanas[key] = { key, label, totalMinutos: 0 };
        }
        semanas[key].totalMinutos += diffMin;
      }
    });
    const resumosSemanais = Object.values(semanas).sort((a, b) => b.key.localeCompare(a.key));`;

const replacementBlock = `    // Agrupar por semana a partir de TODOS OS REGISTROS (sem limite do filtro de período do relatório)
    const semanas = {};
    const logsCompletosFiltrados = filtrarManuais(logsCompletosFunc);

    // Determinar a data de início para exibição de semanas (admissão ou primeiro registro nos logs completos)
    let dataInicio = null;
    if (func.data_admissao) {
      dataInicio = new Date(\`\${func.data_admissao}T12:00:00\`);
    } else if (logsCompletosFiltrados.length > 0) {
      const datas = logsCompletosFiltrados.map(r => r.data).filter(Boolean);
      if (datas.length > 0) {
        datas.sort();
        dataInicio = new Date(\`\${datas[0]}T12:00:00\`);
      }
    }

    if (dataInicio) {
      const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const dataLimite60 = new Date(agora);
      dataLimite60.setDate(agora.getDate() - 60);
      const dataInicioAvaliacao = dataInicio > dataLimite60 ? dataInicio : dataLimite60;

      let temp = new Date(dataInicioAvaliacao);
      while (temp <= agora) {
        const yyyymmdd = temp.toLocaleDateString("en-CA");
        const { key, label } = obterLabelSemana(yyyymmdd);
        if (key) {
          semanas[key] = { key, label, totalMinutos: 0 };
        }
        temp.setDate(temp.getDate() + 7);
      }
      const hojeStr = agora.toLocaleDateString("en-CA");
      const { key: hojeKey, label: hojeLabel } = obterLabelSemana(hojeStr);
      if (hojeKey) {
        semanas[hojeKey] = { key: hojeKey, label: hojeLabel, totalMinutos: 0 };
      }
    }

    logsCompletosFiltrados.forEach((reg) => {
      if (!reg.entrada || !reg.saida) return;
      const { key, label } = obterLabelSemana(reg.data);
      if (!key) return;

      const diffMin = (new Date(reg.saida) - new Date(reg.entrada)) / 60000;
      if (diffMin > 0) {
        if (!semanas[key]) {
          semanas[key] = { key, label, totalMinutos: 0 };
        }
        semanas[key].totalMinutos += diffMin;
      }
    });
    const resumosSemanais = Object.values(semanas).sort((a, b) => b.key.localeCompare(a.key));`;

const normalize = str => str.replace(/\r\n/g, '\n').trim();

if (normalize(content).includes(normalize(targetBlock))) {
  content = content.replace(targetBlock, replacementBlock);
  console.log("Successfully patched modal weekly summary grouping!");
  fs.writeFileSync(filePath, content, 'utf-8');
} else {
  console.log("Mismatch! File snippet:");
  const idx = content.indexOf('Agrupar por semana a partir de TODOS OS REGISTROS');
  if (idx !== -1) {
    console.log(content.slice(idx, idx + 200));
  }
}
