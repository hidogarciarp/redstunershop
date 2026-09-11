import React, { useState } from "react";

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

export default function NitroAdminPage({
  theme,
  usuarioLogado,
  importarNitroLogsParaBanco,
  buscarNitroLogs,
  nitroLogs,
  nitroLogsCarregando,
  atualizarLinkVendaNitro,
  listaFuncionarios,
}) {
  const [logInput, setLogInput] = useState("");
  const [importando, setImportando] = useState(false);

  // Filtros
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("mes"); // mes, semana, custom
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroStatusRegistro, setFiltroStatusRegistro] = useState("todos"); // todos, com_link, sem_link

  // Edição
  const [editandoId, setEditandoId] = useState(null);
  const [linkInput, setLinkInput] = useState("");
  const [salvandoId, setSalvandoId] = useState(null);

  // Parse Logs
  const construtorDate = (dataEHora) => {
    // Ex: 06/04/2026, 15:16:26
    const partesStr = dataEHora.split(",");
    if (partesStr.length < 2) return null;
    const [d, m, y] = partesStr[0].trim().split("/");
    const hora = partesStr[1].trim();
    if (!y || !m || !d || !hora) return null;
    return new Date(`${y}-${m}-${d}T${hora}-03:00`).toISOString(); // BRT format
  };

  const processarLogNitro = () => {
    if (!logInput.trim()) {
      alert("⚠️ Cole o log do Discord primeiro!");
      return;
    }

    // Dividimos por delimitadores comuns para cada registro ( UUID é sempre o fim do bloco)
    const rawLogs = logInput.split(/\[UUID\]:/i);
    let extracoes = [];

    rawLogs.forEach((blocoRaw, index) => {
      if (!blocoRaw.trim()) return;

      // Pega o UUID
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

  const handleImportar = async () => {
    const sessoes = processarLogNitro();
    if (!sessoes || sessoes.length === 0) {
       alert("❌ Não foi possível extrair nenhuma compra de Nitro válida do texto fornecido. Siga o formato padrão do log.");
       return;
    }
    setImportando(true);
    const resultado = await importarNitroLogsParaBanco(sessoes);
    setImportando(false);
    
    if (resultado) {
      alert(`✅ Importação concluída:\n- Inseridos: ${resultado.inseridos}\n- Duplicados (ignorados): ${resultado.duplicados}\n- Erros: ${resultado.erros}`);
      setLogInput("");
      buscarNitroLogs({ nome: filtroNome, periodo: filtroPeriodo });
    }
  };

  // Funções de Filtro
  const calcularDatasPeriodo = (periodoStr) => {
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
    return { inicio: filtroDataInicio, fim: filtroDataFim };
  };

  const aplicarFiltros = (overrideNome, overridePeriodo) => {
    const nome = overrideNome !== undefined ? overrideNome : filtroNome;
    const periodo = overridePeriodo !== undefined ? overridePeriodo : filtroPeriodo;
    const { inicio, fim } = calcularDatasPeriodo(periodo);
    buscarNitroLogs({ nome, dataInicio: inicio, dataFim: fim });
  };

  React.useEffect(() => {
    aplicarFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iniciarEdicaoLink = (reg) => {
    setEditandoId(reg.id);
    setLinkInput(reg.link_venda || "");
  };

  const salvarLink = async (id) => {
    setSalvandoId(id);
    const { error } = await atualizarLinkVendaNitro(id, linkInput);
    if (error) {
      alert("❌ Erro ao salvar link.");
    } else {
      setEditandoId(null);
      aplicarFiltros();
    }
    setSalvandoId(null);
  };

  // Filtragem local
  const filtrados = nitroLogs.filter(n => {
    if (filtroStatusRegistro === "com_link" && !n.link_venda) return false;
    if (filtroStatusRegistro === "sem_link" && n.link_venda) return false;
    return true;
  });

  return (
    <div style={{ padding: "30px 40px", maxWidth: "1400px", margin: "0 auto" }}>
      <h2 style={{ color: theme.text, margin: "0 0 24px", fontWeight: "800", display: "flex", alignItems: "center", gap: "10px" }}>
        <span>🧪 Análise de Nitro (Auditoria)</span>
      </h2>

      {/* ÁREA DE IMPORTAÇÃO */}
      <div style={cardStyle}>
        <div style={{ fontWeight: "700", color: "#14b8a6", marginBottom: "12px", fontSize: "14px" }}>📥 Importar Logs do Jogo (Mechanic Reds)</div>
        <textarea
          style={{
            width: "100%", height: "140px", background: "rgba(15,23,42,0.8)", border: `1px solid ${theme.border}`,
            color: theme.subtext, padding: "12px", borderRadius: "10px", fontSize: "12px",
            fontFamily: "monospace", resize: "vertical", marginBottom: "12px"
          }}
          placeholder="Cole aqui os blocos do Discord. Ex: [NOME COMPLETO]: Natasha Duclair... [ITEMKEY]: nitro..."
          value={logInput}
          onChange={(e) => setLogInput(e.target.value)}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleImportar}
            disabled={importando}
            style={{
              background: "linear-gradient(135deg, #0d9488, #14b8a6)",
              color: "#fff", border: "none", padding: "8px 24px",
              borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "700",
              opacity: importando ? 0.7 : 1
            }}
          >
            {importando ? "⏳ Processando..." : "✅ Extrair e Importar"}
          </button>
        </div>
      </div>

      {/* ÁREA DE FILTROS E TABELA */}
      <div style={{ ...cardStyle, background: "rgba(15,23,42,0.9)" }}>
        {/* FILTROS */}
        <div style={{
          display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap",
          paddingBottom: "16px", borderBottom: `1px solid ${theme.border}`
        }}>
          <div>
            <label style={{ display: "block", fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Funcionário</label>
            <input
              style={{ ...inputSmall, width: "180px", background: theme.card2 }}
              placeholder="🔍 Nome ou ID" value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Vínculo de Venda</label>
            <select
              style={{ ...inputSmall, width: "160px", background: theme.card2 }}
              value={filtroStatusRegistro} onChange={(e) => setFiltroStatusRegistro(e.target.value)}
            >
              <option value="todos">Todos os logs</option>
              <option value="sem_link">⚠️ Sem Comprovante</option>
              <option value="com_link">✅ Comprovado</option>
            </select>
          </div>
          <div>
             <label style={{ display: "block", fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Período</label>
             <div style={{ display: "flex", gap: "6px" }}>
              {[{ val: "semana", label: "Semana" }, { val: "mes", label: "Mês atual" }, { val: "custom", label: "Custom" }].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => {
                    setFiltroPeriodo(val);
                    if (val !== "custom") aplicarFiltros(undefined, val);
                  }}
                  style={{
                    padding: "5px 12px", borderRadius: "8px", border: "none", cursor: "pointer",
                    fontSize: "12px", fontWeight: "700",
                    background: filtroPeriodo === val ? "#14b8a6" : theme.card2,
                    color: filtroPeriodo === val ? "#fff" : theme.subtext,
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
          {filtroPeriodo === "custom" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>De</label>
                <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} style={{ ...inputSmall, width: "135px" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Até</label>
                <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} style={{ ...inputSmall, width: "135px" }} />
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", marginLeft: "auto" }}>
            <button
              onClick={() => aplicarFiltros()}
              disabled={nitroLogsCarregando}
              style={{
                background: "linear-gradient(135deg, #14b8a6, #0d9488)", color: "#fff", border: "none", padding: "6px 16px",
                borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "700",
              }}
            >🔍 Filtrar</button>
          </div>
        </div>

        {/* TABELA DE AUDITORIA */}
        {nitroLogsCarregando ? (
          <div style={{ padding: "32px", textAlign: "center", color: theme.subtext }}>⏳ Carregando banco...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: theme.subtext, opacity: 0.6 }}>
             <div style={{ fontSize: "32px", marginBottom: "8px" }}>🧪</div>
             Nenhuma compra de nitro encontrada para os filtros.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: theme.card2 }}>
                     {["Data", "ID Jogo", "Funcionário Comprador", "Pacote", "Auditoria (Link Venda)", "Ações"].map((col) => (
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
                  {filtrados.map((log, i) => {
                    const dt = new Date(log.data_compra);
                    const funcEncontrado = listaFuncionarios?.find(f => String(f.id) === String(log.id_jogo));
                    const requiresLink = !log.link_venda;

                    return (
                      <tr key={log.id} style={{
                        background: editandoId === log.id ? "rgba(20, 184, 166, 0.08)" : (requiresLink ? "rgba(250,204,21,0.03)" : "transparent"),
                        borderBottom: `1px solid ${theme.border}55`,
                      }}>
                         {/* DATA */}
                         <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                           <div style={{ color: "#14b8a6", fontWeight: "700" }}>{dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                           <div style={{ fontSize: "11px", color: theme.subtext }}>{dt.toLocaleDateString("pt-BR")}</div>
                         </td>
                         
                         {/* ID JOGO */}
                         <td style={{ padding: "10px 14px", color: theme.subtext, fontFamily: "monospace" }}>#{log.id_jogo}</td>

                         {/* NOME COMPRADOR */}
                         <td style={{ padding: "10px 14px", color: theme.text, fontWeight: "600" }}>
                           <div>{log.nome_personagem}</div>
                           {funcEncontrado ? (
                              <div style={{ fontSize: "11px", color: "#22c55e" }}>✅ {funcEncontrado.nome}</div>
                           ) : (
                              <div style={{ fontSize: "11px", color: "#facc15" }}>⚠️ Staff/Off</div>
                           )}
                         </td>

                         {/* PACOTE E VALOR */}
                         <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                           <span style={{ background: theme.card2, padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                             {log.quantidade}x Nitro
                           </span>
                           <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px" }}>Price: $ {log.preco}</div>
                         </td>

                         {/* AUDITORIA DE LINK */}
                         <td style={{ padding: "10px 14px" }}>
                           {editandoId === log.id ? (
                             <input 
                               value={linkInput} 
                               onChange={e => setLinkInput(e.target.value)}
                               placeholder="https://discord.com/channels/..."
                               style={{ ...inputSmall, width: "300px", border: "1px solid #14b8a6" }}
                             />
                           ) : log.link_venda ? (
                             <a href={log.link_venda} target="_blank" rel="noopener noreferrer" style={{
                                color: "#38bdf8", textDecoration: "none", fontWeight: "600", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px"
                             }}>
                               🔗 Ver Comprovante
                             </a>
                           ) : (
                             <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#facc15", fontSize: "11px", fontWeight: "600" }}>
                               ⚠️ Pendente vínculo de venda
                             </div>
                           )}
                         </td>

                         {/* AÇÕES */}
                         <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                           {editandoId === log.id ? (
                             <div style={{ display: "flex", gap: "4px" }}>
                               <button onClick={() => salvarLink(log.id)} disabled={salvandoId === log.id} style={{
                                 background: "#16a34a", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700"
                               }}>{salvandoId === log.id ? "⏳" : "💾 Salvar"}</button>
                               <button onClick={() => setEditandoId(null)} style={{
                                 background: "#444", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700"
                               }}>✕</button>
                             </div>
                           ) : (
                             <button onClick={() => iniciarEdicaoLink(log)} style={{
                               background: "transparent", border: `1px solid ${theme.border}`, color: theme.subtext, padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", transition: "all 0.2s"
                             }} onMouseOver={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#14b8a6"; }} onMouseOut={(e) => { e.currentTarget.style.color = theme.subtext; e.currentTarget.style.borderColor = theme.border; }}>
                               {log.link_venda ? "✏️ Editar" : "🔗 Adicionar Link"}
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
  );
}
