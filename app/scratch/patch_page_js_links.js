import fs from 'fs';

const filePath = 'c:/Users/Garrido/registro-servicos/app/page.js';
let content = fs.readFileSync(filePath, 'utf-8');

// Target functions:
const targetFunctions = `  const atualizarLinkVendaNitro = async (id, novoLink) => {
    return await supabase.from("vendas_nitro_cidade").update({ link_venda: novoLink || null }).eq("id", id);
  };

  const buscarDriftLogs = async ({ nome = "", dataInicio = null, dataFim = null } = {}) => {
    setDriftLogsCarregando(true);
    setDriftLogsError(false);
    try {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore && allData.length < 20000) {
        let query = supabase.from("vendas_drift_cidade").select("*").order("data_compra", { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
        if (dataInicio) query = query.gte("data_compra", \`\${dataInicio}T00:00:00-03:00\`);
        if (dataFim) query = query.lte("data_compra", \`\${dataFim}T23:59:59-03:00\`);
        const { data, error } = await query;
        if (error) {
          if (error.code === '42P01') {
            setDriftLogsError(true);
          }
          throw error;
        }
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }
      let data = allData;
      
      let res = data || [];
      if (nome.trim()) {
        const t = nome.toLowerCase();
        res = res.filter(r => r.nome_personagem?.toLowerCase().includes(t) || String(r.id_jogo) === t);
      }
      
      setDriftLogs(res);
    } catch (err) {
      console.error("Erro ao buscar logs de drift:", err);
    }
    setDriftLogsCarregando(false);
  };

  const importarDriftLogsParaBanco = async (sessoesDrift) => {
    if (!sessoesDrift || sessoesDrift.length === 0) return { inseridos: 0, duplicados: 0, erros: 0 };
    let inseridos = 0; let duplicados = 0; let erros = 0;

    for (const compra of sessoesDrift) {
      if (!compra.uuid_log) { erros++; continue; }
      
      const { data: ext } = await supabase.from("vendas_drift_cidade").select("id").eq("uuid_log", compra.uuid_log).maybeSingle();
      if (ext) { duplicados++; continue; }

      const payload = { ...compra, importado_por: usuarioLogado?.id || null };
      const { error } = await supabase.from("vendas_drift_cidade").insert([payload]);
      
      if (error) erros++;
      else inseridos++;
    }
    return { inseridos, duplicados, erros };
  };

  const atualizarLinkVendaDrift = async (id, novoLink) => {
    return await supabase.from("vendas_drift_cidade").update({ link_venda: novoLink || null }).eq("id", id);
  };`;

const replacementFunctions = `  const atualizarLinksNitro = async (id, { link_venda, link_bancada }) => {
    return await supabase.from("vendas_nitro_cidade").update({
      link_venda: link_venda || null,
      link_bancada: link_bancada || null
    }).eq("id", id);
  };

  const buscarDriftLogs = async ({ nome = "", dataInicio = null, dataFim = null } = {}) => {
    setDriftLogsCarregando(true);
    setDriftLogsError(false);
    try {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore && allData.length < 20000) {
        let query = supabase.from("vendas_drift_cidade").select("*").order("data_compra", { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
        if (dataInicio) query = query.gte("data_compra", \`\${dataInicio}T00:00:00-03:00\`);
        if (dataFim) query = query.lte("data_compra", \`\${dataFim}T23:59:59-03:00\`);
        const { data, error } = await query;
        if (error) {
          if (error.code === '42P01') {
            setDriftLogsError(true);
          }
          throw error;
        }
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }
      let data = allData;
      
      let res = data || [];
      if (nome.trim()) {
        const t = nome.toLowerCase();
        res = res.filter(r => r.nome_personagem?.toLowerCase().includes(t) || String(r.id_jogo) === t);
      }
      
      setDriftLogs(res);
    } catch (err) {
      console.error("Erro ao buscar logs de drift:", err);
    }
    setDriftLogsCarregando(false);
  };

  const importarDriftLogsParaBanco = async (sessoesDrift) => {
    if (!sessoesDrift || sessoesDrift.length === 0) return { inseridos: 0, duplicados: 0, erros: 0 };
    let inseridos = 0; let duplicados = 0; let erros = 0;

    for (const compra of sessoesDrift) {
      if (!compra.uuid_log) { erros++; continue; }
      
      const { data: ext } = await supabase.from("vendas_drift_cidade").select("id").eq("uuid_log", compra.uuid_log).maybeSingle();
      if (ext) { duplicados++; continue; }

      const payload = { ...compra, importado_por: usuarioLogado?.id || null };
      const { error } = await supabase.from("vendas_drift_cidade").insert([payload]);
      
      if (error) erros++;
      else inseridos++;
    }
    return { inseridos, duplicados, erros };
  };

  const atualizarLinksDrift = async (id, { link_venda, link_bancada }) => {
    return await supabase.from("vendas_drift_cidade").update({
      link_venda: link_venda || null,
      link_bancada: link_bancada || null
    }).eq("id", id);
  };`;

const normalize = str => str.replace(/\r\n/g, '\n').trim();

if (normalize(content).includes(normalize(targetFunctions))) {
  content = content.replace(targetFunctions, replacementFunctions);
  console.log("Successfully replaced DB Functions!");
} else {
  console.log("DB Functions target not found!");
}

// Target rendering:
const targetRender = `          <ControleVendasPage
            theme={theme}
            usuarioLogado={usuarioLogado}
            importarNitroLogsParaBanco={importarNitroLogsParaBanco}
            buscarNitroLogs={buscarNitroLogs}
            nitroLogs={nitroLogs}
            nitroLogsCarregando={nitroLogsCarregando}
            atualizarLinkVendaNitro={atualizarLinkVendaNitro}
            importarDriftLogsParaBanco={importarDriftLogsParaBanco}
            buscarDriftLogs={buscarDriftLogs}
            driftLogs={driftLogs}
            driftLogsCarregando={driftLogsCarregando}
            atualizarLinkVendaDrift={atualizarLinkVendaDrift}
            listaFuncionarios={listaFuncionarios}
            driftLogsError={driftLogsError}
            nitroLogsError={nitroLogsError}
          />`;

const replacementRender = `          <ControleVendasPage
            theme={theme}
            usuarioLogado={usuarioLogado}
            importarNitroLogsParaBanco={importarNitroLogsParaBanco}
            buscarNitroLogs={buscarNitroLogs}
            nitroLogs={nitroLogs}
            nitroLogsCarregando={nitroLogsCarregando}
            atualizarLinksNitro={atualizarLinksNitro}
            importarDriftLogsParaBanco={importarDriftLogsParaBanco}
            buscarDriftLogs={buscarDriftLogs}
            driftLogs={driftLogs}
            driftLogsCarregando={driftLogsCarregando}
            atualizarLinksDrift={atualizarLinksDrift}
            listaFuncionarios={listaFuncionarios}
            driftLogsError={driftLogsError}
            nitroLogsError={nitroLogsError}
          />`;

if (content.includes(targetRender)) {
  content = content.replace(targetRender, replacementRender);
  console.log("Successfully replaced Rendering props!");
} else {
  console.log("Rendering props target not found!");
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log("File saved!");
