import React, { useState, useEffect } from "react";

// Estilos padronizados baseados no app
const cardStyle = {
  background: "rgba(30, 41, 59, 0.7)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "16px",
  padding: "24px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
  marginBottom: "20px",
};

const inputSmall = {
  background: "#0f172a",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#f8fafc",
  padding: "6px 12px",
  borderRadius: "8px",
  fontSize: "12px",
  outline: "none",
};

export default function ControleVendasPage({
  theme,
  usuarioLogado,
  importarNitroLogsParaBanco,
  buscarNitroLogs,
  nitroLogs = [],
  nitroLogsCarregando,
  atualizarLinksNitro, // atualizado de atualizarLinkVendaNitro
  importarDriftLogsParaBanco,
  buscarDriftLogs,
  driftLogs = [],
  driftLogsCarregando,
  atualizarLinksDrift, // atualizado de atualizarLinkVendaDrift
  listaFuncionarios,
  driftLogsError = false,
  nitroLogsError = false,
}) {
  const [abaAtiva, setAbaAtiva] = useState("nitro"); // "nitro" | "drift"

  // Estados Nitro
  const [logInputNitro, setLogInputNitro] = useState("");
  const [importandoNitro, setImportandoNitro] = useState(false);
  const [filtroNomeNitro, setFiltroNomeNitro] = useState("");
  const [filtroPeriodoNitro, setFiltroPeriodoNitro] = useState("mes");
  const [filtroDataInicioNitro, setFiltroDataInicioNitro] = useState("");
  const [filtroDataFimNitro, setFiltroDataFimNitro] = useState("");
  const [filtroStatusNitro, setFiltroStatusNitro] = useState("todos"); // todos, com_link, sem_link, pendente_qualquer
  const [editandoIdNitro, setEditandoIdNitro] = useState(null);
  const [linkVendaInputNitro, setLinkVendaInputNitro] = useState("");
  const [linkBancadaInputNitro, setLinkBancadaInputNitro] = useState("");
  const [salvandoIdNitro, setSalvandoIdNitro] = useState(null);

  // Estados Drift
  const [logInputDrift, setLogInputDrift] = useState("");
  const [importandoDrift, setImportandoDrift] = useState(false);
  const [filtroNomeDrift, setFiltroNomeDrift] = useState("");
  const [filtroPeriodoDrift, setFiltroPeriodoDrift] = useState("mes");
  const [filtroDataInicioDrift, setFiltroDataInicioDrift] = useState("");
  const [filtroDataFimDrift, setFiltroDataFimDrift] = useState("");
  const [filtroStatusDrift, setFiltroStatusDrift] = useState("todos");
  const [filtroProdutoDrift, setFiltroProdutoDrift] = useState("todos"); // todos, drift, remdrift
  const [editandoIdDrift, setEditandoIdDrift] = useState(null);
  const [linkVendaInputDrift, setLinkVendaInputDrift] = useState("");
  const [linkBancadaInputDrift, setLinkBancadaInputDrift] = useState("");
  const [salvandoIdDrift, setSalvandoIdDrift] = useState(null);

  // Parse Logs
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
    return new Date(`${y}-${m}-${d}T${hora}-03:00`).toISOString(); // BRT format
  };

  const processarLogNitro = () => {
    if (!logInputNitro.trim()) {
      alert("⚠️ Cole o log do Discord primeiro!");
      return;
    }

    const rawLogs = logInputNitro.split(/\[UUID\]:/i);
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
      
      const nomeMatch = regexNome.exec(blocoRaw);
      const idMatch = regexId.exec(blocoRaw);
      const qtdMatch = regexQtd.exec(blocoRaw);
      const precoMatch = regexPreco.exec(blocoRaw);
      const dataMatch = regexData.exec(blocoRaw);

      if (idMatch && dataMatch) {
        const iso = construtorDate(dataMatch[1]);
        if (iso) {
          extracoes.push({
            id_jogo: parseInt(idMatch[1], 10),
            nome_personagem: nomeMatch ? nomeMatch[1].trim() : "Desconhecido",
            quantidade: qtdMatch ? parseInt(qtdMatch[1], 10) : 1,
            preco: precoMatch ? precoMatch[1].trim() : "15.000",
            data_compra: iso,
            uuid_log: uuidFull,
            acao: "buy"
          });
        }
      }
    });

    return extracoes;
  };

  const processarLogDrift = () => {
    if (!logInputDrift.trim()) {
      alert("⚠️ Cole o log do Discord primeiro!");
      return;
    }

    const rawLogs = logInputDrift.split(/\[UUID\]:/i);
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
          const key = itemKeyMatch[1].trim().toLowerCase();
          const defName = key === "drift" ? "Kit Drift" : "Removedor de Drift";
          extracoes.push({
            id_jogo: parseInt(idMatch[1], 10),
            nome_personagem: nomeMatch ? nomeMatch[1].trim() : "Desconhecido",
            item_key: key,
            item_name: itemNameMatch ? itemNameMatch[1].trim() : defName,
            quantidade: qtdMatch ? parseInt(qtdMatch[1], 10) : 1,
            preco: precoMatch ? precoMatch[1].trim() : "15.000",
            data_compra: iso,
            uuid_log: uuidFull,
            acao: acaoMatch ? acaoMatch[1].trim().toLowerCase() : "buy"
          });
        }
      }
    });

    return extracoes;
  };

  const handleImportarNitro = async () => {
    const sessoes = processarLogNitro();
    if (!sessoes || sessoes.length === 0) {
       alert("❌ Não foi possível extrair nenhuma compra de Nitro válida. Verifique o formato padrão do log.");
       return;
    }
    setImportandoNitro(true);
    const resultado = await importarNitroLogsParaBanco(sessoes);
    setImportandoNitro(false);
    
    if (resultado) {
      alert(`✅ Importação de Nitro concluída:\n- Inseridos: ${resultado.inseridos}\n- Duplicados: ${resultado.duplicados}\n- Erros: ${resultado.erros}`);
      setLogInputNitro("");
      aplicarFiltrosNitro();
    }
  };

  const handleImportarDrift = async () => {
    const sessoes = processarLogDrift();
    if (!sessoes || sessoes.length === 0) {
       alert("❌ Não foi possível extrair nenhuma compra de Drift válida. Verifique o formato padrão do log.");
       return;
    }
    setImportandoDrift(true);
    const resultado = await importarDriftLogsParaBanco(sessoes);
    setImportandoDrift(false);
    
    if (resultado) {
      alert(`✅ Importação de Drift concluída:\n- Inseridos: ${resultado.inseridos}\n- Duplicados: ${resultado.duplicados}\n- Erros: ${resultado.erros}`);
      setLogInputDrift("");
      aplicarFiltrosDrift();
    }
  };

  // Funções de Filtro Comuns
  const calcularDatasPeriodo = (periodoStr, inicioCustom, fimCustom) => {
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    if (periodoStr === "mes") {
      const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const anoProg = primeiroDia.getFullYear();
      const mesProg = String(primeiroDia.getMonth() + 1).padStart(2, "0");
      const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
      const diaProg = String(ultimoDia.getDate()).padStart(2, "0");
      return { inicio: `${anoProg}-${mesProg}-01`, fim: `${anoProg}-${mesProg}-${diaProg}` };
    }
    if (periodoStr === "semana") {
      const day = agora.getDay() || 7; 
      const start = new Date(agora);
      start.setDate(agora.getDate() - day + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        inicio: start.toISOString().split("T")[0],
        fim: end.toISOString().split("T")[0],
      };
    }
    return { inicio: inicioCustom, fim: fimCustom };
  };

  const aplicarFiltrosNitro = (overrideNome, overridePeriodo) => {
    if (nitroLogsError) return;
    const nome = overrideNome !== undefined ? overrideNome : filtroNomeNitro;
    const periodo = overridePeriodo !== undefined ? overridePeriodo : filtroPeriodoNitro;
    const { inicio, fim } = calcularDatasPeriodo(periodo, filtroDataInicioNitro, filtroDataFimNitro);
    buscarNitroLogs({ nome, dataInicio: inicio, dataFim: fim });
  };

  const aplicarFiltrosDrift = (overrideNome, overridePeriodo) => {
    if (driftLogsError) return;
    const nome = overrideNome !== undefined ? overrideNome : filtroNomeDrift;
    const periodo = overridePeriodo !== undefined ? overridePeriodo : filtroPeriodoDrift;
    const { inicio, fim } = calcularDatasPeriodo(periodo, filtroDataInicioDrift, filtroDataFimDrift);
    buscarDriftLogs({ nome, dataInicio: inicio, dataFim: fim });
  };

  useEffect(() => {
    if (abaAtiva === "nitro") {
      aplicarFiltrosNitro();
    } else {
      aplicarFiltrosDrift();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaAtiva]);

  // Edição Nitro
  const iniciarEdicaoLinkNitro = (reg) => {
    setEditandoIdNitro(reg.id);
    setLinkVendaInputNitro(reg.link_venda || "");
    setLinkBancadaInputNitro(reg.link_bancada || "");
  };

  const salvarLinkNitro = async (id) => {
    setSalvandoIdNitro(id);
    const { error } = await atualizarLinksNitro(id, {
      link_venda: linkVendaInputNitro,
      link_bancada: linkBancadaInputNitro
    });
    if (error) {
      alert("❌ Erro ao salvar links de Nitro.");
    } else {
      setEditandoIdNitro(null);
      aplicarFiltrosNitro();
    }
    setSalvandoIdNitro(null);
  };

  // Edição Drift
  const iniciarEdicaoLinkDrift = (reg) => {
    setEditandoIdDrift(reg.id);
    setLinkVendaInputDrift(reg.link_venda || "");
    setLinkBancadaInputDrift(reg.link_bancada || "");
  };

  const salvarLinkDrift = async (id) => {
    setSalvandoIdDrift(id);
    const { error } = await atualizarLinksDrift(id, {
      link_venda: linkVendaInputDrift,
      link_bancada: linkBancadaInputDrift
    });
    if (error) {
      alert("❌ Erro ao salvar links de Drift.");
    } else {
      setEditandoIdDrift(null);
      aplicarFiltrosDrift();
    }
    setSalvandoIdDrift(null);
  };

  // Filtragem local
  const filtradosNitro = nitroLogs.filter(n => {
    if (filtroStatusNitro === "com_link" && (!n.link_venda && !n.link_bancada)) return false;
    if (filtroStatusNitro === "sem_link" && (n.link_venda || n.link_bancada)) return false;
    if (filtroStatusNitro === "pendente_qualquer" && (!n.link_venda || !n.link_bancada)) return true;
    return true;
  });

  const filtradosDrift = driftLogs.filter(d => {
    if (filtroStatusDrift === "com_link" && (!d.link_venda && !d.link_bancada)) return false;
    if (filtroStatusDrift === "sem_link" && (d.link_venda || d.link_bancada)) return false;
    if (filtroStatusDrift === "pendente_qualquer" && (!d.link_venda || !d.link_bancada)) return true;
    if (filtroProdutoDrift !== "todos" && d.item_key !== filtroProdutoDrift) return false;
    return true;
  });

  const warningTableBox = (tableName, migrationFile) => (
    <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "10px", padding: "16px", marginBottom: "20px", color: "#fca5a5", fontSize: "13px" }}>
      <p style={{ margin: "0 0 8px 0", fontWeight: "700" }}>⚠️ Tabela ou Coluna do Banco de Dados Ausente</p>
      A tabela <strong>{tableName}</strong> não foi encontrada ou precisa ser atualizada. Para corrigir, por favor execute a migração SQL correspondente da pasta <strong>{migrationFile}</strong> no editor SQL do seu Supabase.
    </div>
  );

  return (
    <div style={{ padding: "30px 40px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* TÍTULO E ABAS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ color: theme.text, margin: 0, fontWeight: "800", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>📈 Controle de Vendas</span>
          </h2>
          <p style={{ fontSize: "13px", color: theme.subtext, marginTop: "6px", marginBottom: 0 }}>
            Painel unificado para auditoria de vendas especiais da oficina.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", background: "rgba(15,23,42,0.4)", padding: "4px", borderRadius: "10px", border: `1px solid ${theme.border}44` }}>
          <button
            onClick={() => setAbaAtiva("nitro")}
            style={{
              padding: "6px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
              fontSize: "13px", fontWeight: "700", transition: "all 0.2s",
              background: abaAtiva === "nitro" ? "#14b8a6" : "transparent",
              color: abaAtiva === "nitro" ? "#fff" : theme.subtext,
            }}
          >🧪 Vendas de Nitro</button>
          <button
            onClick={() => setAbaAtiva("drift")}
            style={{
              padding: "6px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
              fontSize: "13px", fontWeight: "700", transition: "all 0.2s",
              background: abaAtiva === "drift" ? "#14b8a6" : "transparent",
              color: abaAtiva === "drift" ? "#fff" : theme.subtext,
            }}
          >🏎️ Vendas de Drift</button>
        </div>
      </div>

      {/* RENDER POR ABA */}
      {abaAtiva === "nitro" ? (
        <div>
          {nitroLogsError && warningTableBox("vendas_nitro_cidade", "migrations/adicionar_link_bancada_nitro.sql")}

          {/* IMPORTAÇÃO */}
          <div style={cardStyle}>
            <div style={{ fontWeight: "700", color: "#14b8a6", marginBottom: "12px", fontSize: "14px" }}>📥 Importar Logs de Nitro (Discord)</div>
            <textarea
              style={{
                width: "100%", height: "140px", background: "rgba(15,23,42,0.8)", border: `1px solid ${theme.border}`,
                color: theme.subtext, padding: "12px", borderRadius: "10px", fontSize: "12px",
                fontFamily: "monospace", resize: "vertical", marginBottom: "12px"
              }}
              placeholder="Cole aqui os blocos do Discord. Ex: [NOME COMPLETO] ... [ITEMKEY]: nitro ..."
              value={logInputNitro}
              onChange={(e) => setLogInputNitro(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleImportarNitro}
                disabled={importandoNitro || nitroLogsError}
                style={{
                  background: "linear-gradient(135deg, #0d9488, #14b8a6)",
                  color: "#fff", border: "none", padding: "8px 24px",
                  borderRadius: "8px", cursor: (importandoNitro || nitroLogsError) ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: "700",
                  opacity: (importandoNitro || nitroLogsError) ? 0.6 : 1
                }}
              >
                {importandoNitro ? "⏳ Processando..." : "✅ Extrair e Importar Nitro"}
              </button>
            </div>
          </div>

          {/* TABELA DE AUDITORIA */}
          <div style={{ ...cardStyle, background: "rgba(15,23,42,0.9)" }}>
            <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap", paddingBottom: "16px", borderBottom: `1px solid ${theme.border}` }}>
              <div>
                <label style={{ display: "block", fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Funcionário</label>
                <input
                  style={{ ...inputSmall, width: "180px", background: theme.card2 }}
                  placeholder="🔍 Nome ou ID" value={filtroNomeNitro}
                  onChange={(e) => setFiltroNomeNitro(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Vínculo de Venda</label>
                <select
                  style={{ ...inputSmall, width: "160px", background: theme.card2 }}
                  value={filtroStatusNitro} onChange={(e) => setFiltroStatusNitro(e.target.value)}
                >
                  <option value="todos">Todos os logs</option>
                  <option value="sem_link">⚠️ Sem Nenhum Vínculo</option>
                  <option value="com_link">✅ Ambos Vínculos Criados</option>
                  <option value="pendente_qualquer">⚠️ Pendente Registro ou Bancada</option>
                </select>
              </div>
              <div>
                 <label style={{ display: "block", fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Período</label>
                 <div style={{ display: "flex", gap: "6px" }}>
                  {[{ val: "semana", label: "Semana" }, { val: "mes", label: "Mês atual" }, { val: "custom", label: "Custom" }].map(({ val, label }) => (
                    <button
                      key={val}
                      onClick={() => {
                        setFiltroPeriodoNitro(val);
                        if (val !== "custom") aplicarFiltrosNitro(undefined, val);
                      }}
                      style={{
                        padding: "5px 12px", borderRadius: "8px", border: "none", cursor: "pointer",
                        fontSize: "12px", fontWeight: "700",
                        background: filtroPeriodoNitro === val ? "#14b8a6" : theme.card2,
                        color: filtroPeriodoNitro === val ? "#fff" : theme.subtext,
                      }}
                    >{label}</button>
                  ))}
                </div>
              </div>
              {filtroPeriodoNitro === "custom" && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>De</label>
                    <input type="date" value={filtroDataInicioNitro} onChange={(e) => setFiltroDataInicioNitro(e.target.value)} style={{ ...inputSmall, width: "135px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Até</label>
                    <input type="date" value={filtroDataFimNitro} onChange={(e) => setFiltroDataFimNitro(e.target.value)} style={{ ...inputSmall, width: "135px" }} />
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", marginLeft: "auto" }}>
                <button
                  onClick={() => aplicarFiltrosNitro()}
                  disabled={nitroLogsCarregando || nitroLogsError}
                  style={{
                    background: "linear-gradient(135deg, #14b8a6, #0d9488)", color: "#fff", border: "none", padding: "6px 16px",
                    borderRadius: "8px", cursor: (nitroLogsCarregando || nitroLogsError) ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: "700",
                  }}
                >🔍 Filtrar</button>
              </div>
            </div>

            {nitroLogsCarregando ? (
              <div style={{ padding: "32px", textAlign: "center", color: theme.subtext }}>⏳ Carregando banco...</div>
            ) : filtradosNitro.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: theme.subtext, opacity: 0.6 }}>
                 <div style={{ fontSize: "32px", marginBottom: "8px" }}>🧪</div>
                 Nenhuma compra de nitro encontrada para os filtros.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                 <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: theme.card2 }}>
                         {["Data", "ID Jogo", "Funcionário Comprador", "Pacote", "Registro Venda", "Log Bancada", "Ações"].map((col) => (
                           <th key={col} style={{
                             padding: "10px 14px", textAlign: "left",
                             color: theme.subtext, fontWeight: "700", fontSize: "11px",
                             textTransform: "uppercase", letterSpacing: "0.4px",
                             borderBottom: `1px solid ${theme.border}`,
                             whiteSpace: "nowrap",
                           }}>{col}</th>
                         ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtradosNitro.map((log) => {
                        const dt = new Date(log.data_compra);
                        const funcEncontrado = listaFuncionarios?.find(f => String(f.id) === String(log.id_jogo));

                        return (
                          <tr key={log.id} style={{
                            background: editandoIdNitro === log.id ? "rgba(20, 184, 166, 0.08)" : "transparent",
                            borderBottom: `1px solid ${theme.border}55`,
                          }}>
                             <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                               <div style={{ color: "#14b8a6", fontWeight: "700" }}>{dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                               <div style={{ fontSize: "11px", color: theme.subtext }}>{dt.toLocaleDateString("pt-BR")}</div>
                             </td>
                             <td style={{ padding: "10px 14px", color: theme.subtext, fontFamily: "monospace" }}>#{log.id_jogo}</td>
                             <td style={{ padding: "10px 14px", color: theme.text, fontWeight: "600" }}>
                               <div>{log.nome_personagem}</div>
                               {funcEncontrado ? (
                                  <div style={{ fontSize: "11px", color: "#22c55e" }}>✅ {funcEncontrado.nome}</div>
                               ) : (
                                  <div style={{ fontSize: "11px", color: "#facc15" }}>⚠️ Staff/Off</div>
                               )}
                             </td>
                             <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                               <span style={{ background: theme.card2, padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                                 {log.quantidade}x Nitro
                               </span>
                               <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>Preço: $ {log.preco}</div>
                             </td>
                             
                             {/* LINK REGISTRO VENDA */}
                             <td style={{ padding: "10px 14px" }}>
                               {editandoIdNitro === log.id ? (
                                 <input 
                                   value={linkVendaInputNitro} 
                                   onChange={e => setLinkVendaInputNitro(e.target.value)}
                                   placeholder="https://discord.com/... (Registro Venda)"
                                   style={{ ...inputSmall, width: "230px", border: "1px solid #14b8a6" }}
                                 />
                               ) : log.link_venda ? (
                                 <a href={log.link_venda} target="_blank" rel="noopener noreferrer" style={{
                                    color: "#38bdf8", textDecoration: "none", fontWeight: "600", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px"
                                 }}>
                                   🔗 Registro Venda
                                 </a>
                               ) : (
                                 <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#facc15", fontSize: "11px", fontWeight: "600" }}>
                                   ⚠️ Pendente
                                 </div>
                               )}
                             </td>

                             {/* LINK LOG BANCADA */}
                             <td style={{ padding: "10px 14px" }}>
                               {editandoIdNitro === log.id ? (
                                 <input 
                                   value={linkBancadaInputNitro} 
                                   onChange={e => setLinkBancadaInputNitro(e.target.value)}
                                   placeholder="https://discord.com/... (Log Bancada)"
                                   style={{ ...inputSmall, width: "230px", border: "1px solid #14b8a6" }}
                                 />
                               ) : log.link_bancada ? (
                                 <a href={log.link_bancada} target="_blank" rel="noopener noreferrer" style={{
                                    color: "#a78bfa", textDecoration: "none", fontWeight: "600", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px"
                                 }}>
                                   🔗 Log Bancada
                                 </a>
                               ) : (
                                 <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#facc15", fontSize: "11px", fontWeight: "600" }}>
                                   ⚠️ Pendente
                                 </div>
                               )}
                             </td>

                             <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                               {editandoIdNitro === log.id ? (
                                 <div style={{ display: "flex", gap: "4px" }}>
                                   <button onClick={() => salvarLinkNitro(log.id)} disabled={salvandoIdNitro === log.id} style={{
                                     background: "#16a34a", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700"
                                   }}>{salvandoIdNitro === log.id ? "⏳" : "💾 Salvar"}</button>
                                   <button onClick={() => setEditandoIdNitro(null)} style={{
                                     background: "#444", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700"
                                   }}>✕</button>
                                 </div>
                               ) : (
                                 <button onClick={() => iniciarEdicaoLinkNitro(log)} style={{
                                   background: "transparent", border: `1px solid ${theme.border}`, color: theme.subtext, padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", transition: "all 0.2s"
                                 }} onMouseOver={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#14b8a6"; }} onMouseOut={(e) => { e.currentTarget.style.color = theme.subtext; e.currentTarget.style.borderColor = theme.border; }}>
                                   ✏️ Links
                                 </button>
                               )}
                             </td>
                          </tr>
                        );
                      })}
                    </tbody>
                 </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ABA DRIFT */
        <div>
          {driftLogsError && warningTableBox("vendas_drift_cidade", "migrations/adicionar_tabela_drift.sql")}

          {/* IMPORTAÇÃO */}
          <div style={cardStyle}>
            <div style={{ fontWeight: "700", color: "#14b8a6", marginBottom: "12px", fontSize: "14px" }}>📥 Importar Logs de Drift (Discord)</div>
            <textarea
              style={{
                width: "100%", height: "140px", background: "rgba(15,23,42,0.8)", border: `1px solid ${theme.border}`,
                color: theme.subtext, padding: "12px", borderRadius: "10px", fontSize: "12px",
                fontFamily: "monospace", resize: "vertical", marginBottom: "12px"
              }}
              placeholder="Cole aqui os blocos do Discord. Ex: [NOME COMPLETO] ... [ITEMKEY]: drift / remdrift ..."
              value={logInputDrift}
              onChange={(e) => setLogInputDrift(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleImportarDrift}
                disabled={importandoDrift || driftLogsError}
                style={{
                  background: "linear-gradient(135deg, #0d9488, #14b8a6)",
                  color: "#fff", border: "none", padding: "8px 24px",
                  borderRadius: "8px", cursor: (importandoDrift || driftLogsError) ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: "700",
                  opacity: (importandoDrift || driftLogsError) ? 0.6 : 1
                }}
              >
                {importandoDrift ? "⏳ Processando..." : "✅ Extrair e Importar Drift"}
              </button>
            </div>
          </div>

          {/* TABELA DE AUDITORIA */}
          <div style={{ ...cardStyle, background: "rgba(15,23,42,0.9)" }}>
            <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap", paddingBottom: "16px", borderBottom: `1px solid ${theme.border}` }}>
              <div>
                <label style={{ display: "block", fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Funcionário</label>
                <input
                  style={{ ...inputSmall, width: "180px", background: theme.card2 }}
                  placeholder="🔍 Nome ou ID" value={filtroNomeDrift}
                  onChange={(e) => setFiltroNomeDrift(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Produto</label>
                <select
                  style={{ ...inputSmall, width: "160px", background: theme.card2 }}
                  value={filtroProdutoDrift} onChange={(e) => setFiltroProdutoDrift(e.target.value)}
                >
                  <option value="todos">Todos os produtos</option>
                  <option value="drift">🏎️ Kit Drift</option>
                  <option value="remdrift">🔧 Removedor de Drift</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Vínculo de Venda</label>
                <select
                  style={{ ...inputSmall, width: "160px", background: theme.card2 }}
                  value={filtroStatusDrift} onChange={(e) => setFiltroStatusDrift(e.target.value)}
                >
                  <option value="todos">Todos os logs</option>
                  <option value="sem_link">⚠️ Sem Nenhum Vínculo</option>
                  <option value="com_link">✅ Ambos Vínculos Criados</option>
                  <option value="pendente_qualquer">⚠️ Pendente Registro ou Bancada</option>
                </select>
              </div>
              <div>
                 <label style={{ display: "block", fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Período</label>
                 <div style={{ display: "flex", gap: "6px" }}>
                  {[{ val: "semana", label: "Semana" }, { val: "mes", label: "Mês atual" }, { val: "custom", label: "Custom" }].map(({ val, label }) => (
                    <button
                      key={val}
                      onClick={() => {
                        setFiltroPeriodoDrift(val);
                        if (val !== "custom") aplicarFiltrosDrift(undefined, val);
                      }}
                      style={{
                        padding: "5px 12px", borderRadius: "8px", border: "none", cursor: "pointer",
                        fontSize: "12px", fontWeight: "700",
                        background: filtroPeriodoDrift === val ? "#14b8a6" : theme.card2,
                        color: filtroPeriodoDrift === val ? "#fff" : theme.subtext,
                      }}
                    >{label}</button>
                  ))}
                </div>
              </div>
              {filtroPeriodoDrift === "custom" && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>De</label>
                    <input type="date" value={filtroDataInicioDrift} onChange={(e) => setFiltroDataInicioDrift(e.target.value)} style={{ ...inputSmall, width: "135px" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Até</label>
                    <input type="date" value={filtroDataFimDrift} onChange={(e) => setFiltroDataFimDrift(e.target.value)} style={{ ...inputSmall, width: "135px" }} />
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", marginLeft: "auto" }}>
                <button
                  onClick={() => aplicarFiltrosDrift()}
                  disabled={driftLogsCarregando || driftLogsError}
                  style={{
                    background: "linear-gradient(135deg, #14b8a6, #0d9488)", color: "#fff", border: "none", padding: "6px 16px",
                    borderRadius: "8px", cursor: (driftLogsCarregando || driftLogsError) ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: "700",
                  }}
                >🔍 Filtrar</button>
              </div>
            </div>

            {driftLogsCarregando ? (
              <div style={{ padding: "32px", textAlign: "center", color: theme.subtext }}>⏳ Carregando banco...</div>
            ) : filtradosDrift.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: theme.subtext, opacity: 0.6 }}>
                 <div style={{ fontSize: "32px", marginBottom: "8px" }}>🏎️</div>
                 Nenhuma compra de Drift encontrada para os filtros.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                 <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: theme.card2 }}>
                         {["Data", "ID Jogo", "Funcionário Comprador", "Produto", "Registro Venda", "Log Bancada", "Ações"].map((col) => (
                           <th key={col} style={{
                             padding: "10px 14px", textAlign: "left",
                             color: theme.subtext, fontWeight: "700", fontSize: "11px",
                             textTransform: "uppercase", letterSpacing: "0.4px",
                             borderBottom: `1px solid ${theme.border}`,
                             whiteSpace: "nowrap",
                           }}>{col}</th>
                         ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtradosDrift.map((log) => {
                        const dt = new Date(log.data_compra);
                        const funcEncontrado = listaFuncionarios?.find(f => String(f.id) === String(log.id_jogo));

                        return (
                          <tr key={log.id} style={{
                            background: editandoIdDrift === log.id ? "rgba(20, 184, 166, 0.08)" : "transparent",
                            borderBottom: `1px solid ${theme.border}55`,
                          }}>
                             <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                               <div style={{ color: "#14b8a6", fontWeight: "700" }}>{dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                               <div style={{ fontSize: "11px", color: theme.subtext }}>{dt.toLocaleDateString("pt-BR")}</div>
                             </td>
                             <td style={{ padding: "10px 14px", color: theme.subtext, fontFamily: "monospace" }}>#{log.id_jogo}</td>
                             <td style={{ padding: "10px 14px", color: theme.text, fontWeight: "600" }}>
                               <div>{log.nome_personagem}</div>
                               {funcEncontrado ? (
                                  <div style={{ fontSize: "11px", color: "#22c55e" }}>✅ {funcEncontrado.nome}</div>
                               ) : (
                                  <div style={{ fontSize: "11px", color: "#facc15" }}>⚠️ Staff/Off</div>
                               )}
                             </td>
                             <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                               <span style={{ background: theme.card2, padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                                 {log.quantidade}x {log.item_name}
                               </span>
                               <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>Preço: $ {log.preco}</div>
                             </td>

                             {/* LINK REGISTRO VENDA */}
                             <td style={{ padding: "10px 14px" }}>
                               {editandoIdDrift === log.id ? (
                                 <input 
                                   value={linkVendaInputDrift} 
                                   onChange={e => setLinkVendaInputDrift(e.target.value)}
                                   placeholder="https://discord.com/... (Registro Venda)"
                                   style={{ ...inputSmall, width: "230px", border: "1px solid #14b8a6" }}
                                 />
                               ) : log.link_venda ? (
                                 <a href={log.link_venda} target="_blank" rel="noopener noreferrer" style={{
                                    color: "#38bdf8", textDecoration: "none", fontWeight: "600", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px"
                                 }}>
                                   🔗 Registro Venda
                                 </a>
                               ) : (
                                 <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#facc15", fontSize: "11px", fontWeight: "600" }}>
                                   ⚠️ Pendente
                                 </div>
                               )}
                             </td>

                             {/* LINK LOG BANCADA */}
                             <td style={{ padding: "10px 14px" }}>
                               {editandoIdDrift === log.id ? (
                                 <input 
                                   value={linkBancadaInputDrift} 
                                   onChange={e => setLinkBancadaInputDrift(e.target.value)}
                                   placeholder="https://discord.com/... (Log Bancada)"
                                   style={{ ...inputSmall, width: "230px", border: "1px solid #14b8a6" }}
                                 />
                               ) : log.link_bancada ? (
                                 <a href={log.link_bancada} target="_blank" rel="noopener noreferrer" style={{
                                    color: "#a78bfa", textDecoration: "none", fontWeight: "600", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px"
                                 }}>
                                   🔗 Log Bancada
                                 </a>
                               ) : (
                                 <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#facc15", fontSize: "11px", fontWeight: "600" }}>
                                   ⚠️ Pendente
                                 </div>
                               )}
                             </td>

                             <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                               {editandoIdDrift === log.id ? (
                                 <div style={{ display: "flex", gap: "4px" }}>
                                   <button onClick={() => salvarLinkDrift(log.id)} disabled={salvandoIdDrift === log.id} style={{
                                     background: "#16a34a", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700"
                                   }}>{salvandoIdDrift === log.id ? "⏳" : "💾 Salvar"}</button>
                                   <button onClick={() => setEditandoIdDrift(null)} style={{
                                     background: "#444", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700"
                                   }}>✕</button>
                                 </div>
                               ) : (
                                 <button onClick={() => iniciarEdicaoLinkDrift(log)} style={{
                                   background: "transparent", border: `1px solid ${theme.border}`, color: theme.subtext, padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", transition: "all 0.2s"
                                 }} onMouseOver={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#14b8a6"; }} onMouseOut={(e) => { e.currentTarget.style.color = theme.subtext; e.currentTarget.style.borderColor = theme.border; }}>
                                   ✏️ Links
                                 </button>
                               )}
                             </td>
                          </tr>
                        );
                      })}
                    </tbody>
                 </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
