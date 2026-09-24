"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";

export default function DbAdminPage({ theme, styles }) {
  const [tabelaAtiva, setTabelaAtiva] = useState("log_ponto_reds");
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dateInicio, setDateInicio] = useState("");
  const [dateFim, setDateFim] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos"); // todos, entrada, saida (apenas para ponto)
  
  // Paginação
  const [pagina, setPagina] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [itensPorPagina, setItensPorPagina] = useState(50);

  // Seleção em massa
  const [selecionados, setSelecionados] = useState(new Set());

  const getItemId = (reg) => {
    if (!reg) return "";
    if (tabelaAtiva === "sessoes_ponto_auditoria_reds") {
      return String(reg.id || reg.uuid_sessao || "");
    }
    return String(reg.uuid || reg.id || "");
  };

  const formatarDataHoraBR = (val) => {
    if (!val) return "—";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    } catch {
      return String(val);
    }
  };

  // Modal de Auditoria de Sessão de Ponto (Atividades & Serviços)
  const [sessaoInspecao, setSessaoInspecao] = useState(null);
  const [atividadesSessao, setAtividadesSessao] = useState({ tunagens: [], bancada: [], bau: [] });
  const [carregandoAtividades, setCarregandoAtividades] = useState(false);
  const [abaAtividades, setAbaAtividades] = useState("todas"); // todas, tunagens, bancada, bau
  const [logRawAberto, setLogRawAberto] = useState(null);
  const [copiadoUuid, setCopiadoUuid] = useState(null);

  const copiarParaClipboard = (texto) => {
    if (!texto) return;
    navigator.clipboard.writeText(texto);
    setCopiadoUuid(texto);
    setTimeout(() => setCopiadoUuid(null), 2000);
  };

  const abrirAuditoriaSessao = async (sessao) => {
    setSessaoInspecao(sessao);
    setCarregandoAtividades(true);
    setAbaAtividades("todas");
    setLogRawAberto(null);

    try {
      const entMs = new Date(sessao.entrada).getTime() - 60000;
      const saiMs = (sessao.saida ? new Date(sessao.saida).getTime() : Date.now()) + 60000;
      const idUsuario = String(sessao.id_jogo || sessao.usuario_id || "");
      const nomeUsuario = String(sessao.nome || "").toLowerCase().trim();

      // 1. Tunagens
      let tunagens = [];
      try {
        const { data: tData } = await supabase
          .from("log_tunagem")
          .select("*")
          .eq("mecanica_id", "reds");

        if (tData) {
          tunagens = tData.filter((t) => {
            const matchUser = (idUsuario && String(t.tecnico_id) === idUsuario) ||
                              (nomeUsuario && (t.tecnico_nome || "").toLowerCase().includes(nomeUsuario));
            if (!matchUser) return false;
            const tTime = new Date(t.timestampz || `${t.data}T${t.hora}-03:00`).getTime();
            return tTime >= entMs && tTime <= saiMs;
          });
        }
      } catch (err) {
        console.warn("Erro ao buscar tunagens da sessão:", err);
      }

      // 2. Bancada & Baú (discord_log_messages)
      let bancada = [];
      let bau = [];
      try {
        const { data: dLogs } = await supabase
          .from("discord_log_messages")
          .select("id, content, created_at, log_type")
          .in("log_type", ["bancada", "bau"])
          .gte("created_at", new Date(entMs).toISOString())
          .lte("created_at", new Date(saiMs).toISOString())
          .order("created_at", { ascending: true });

        if (dLogs) {
          for (const item of dLogs) {
            const content = item.content || "";
            const contentLower = content.toLowerCase();
            const matchUser = (idUsuario && content.includes(`[ID]: ${idUsuario}`)) ||
                              (nomeUsuario && contentLower.includes(nomeUsuario));
            if (!matchUser) continue;

            const clean = content.replace(/```ini/gi, "").replace(/```/g, "");

            if (item.log_type === "bancada") {
              const itemName = (clean.match(/\[ITEMNAME\]:\s*([^\n\r]+)/i) || [])[1];
              const qtd = (clean.match(/\[QUANTIDADE\]:\s*([^\n\r]+)/i) || [])[1];
              const price = (clean.match(/\[PRICE\]:\s*([^\n\r]+)/i) || [])[1];
              const acao = (clean.match(/\[AÇÃO\]:\s*([^\n\r]+)/i) || [])[1];
              const uuidMatch = (clean.match(/\[UUID\]:\s*([a-f0-9-]+)/i) || [])[1];

              bancada.push({
                id: item.id,
                uuid: uuidMatch || `bancada-${item.id}`,
                tipo: "bancada",
                item: itemName ? itemName.trim() : "Item de Bancada",
                quantidade: qtd ? qtd.trim() : "1",
                preco: price ? price.trim() : null,
                acao: acao ? acao.trim() : "buy",
                timestamp: item.created_at,
                raw: content
              });
            } else if (item.log_type === "bau") {
              const retirou = (clean.match(/\[RETIROU\]:\s*([^\n\r]+)/i) || [])[1];
              const guardou = (clean.match(/\[GUARDOU\]:\s*([^\n\r]+)/i) || [])[1];
              const bauNome = (clean.match(/\[ID BAÚ\]:\s*([^\n\r]+)/i) || [])[1];
              const uuidMatch = (clean.match(/\[UUID\]:\s*([a-f0-9-]+)/i) || [])[1];

              const acao = retirou ? "RETIROU" : guardou ? "GUARDOU" : "MOVIMENTOU";
              const itemDesc = retirou ? retirou.trim() : guardou ? guardou.trim() : "Item do Baú";

              bau.push({
                id: item.id,
                uuid: uuidMatch || `bau-${item.id}`,
                tipo: "bau",
                acao,
                item: itemDesc,
                bauNome: bauNome ? bauNome.trim() : "Baú Geral",
                timestamp: item.created_at,
                raw: content
              });
            }
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar logs de bancada/baú:", err);
      }

      setAtividadesSessao({
        tunagens: tunagens.map((t) => ({
          id: t.uuid,
          uuid: t.uuid,
          tipo: "tunagem",
          veiculo: t.veiculo_nome,
          placa: t.placa,
          valor: t.valor_pago,
          dono: t.dono_nome,
          timestamp: t.timestampz || `${t.data}T${t.hora}-03:00`,
          raw: t.raw_text || JSON.stringify(t, null, 2)
        })),
        bancada,
        bau
      });
    } catch (e) {
      console.error("Erro ao auditar sessão de ponto:", e);
    } finally {
      setCarregandoAtividades(false);
    }
  };

  // Carregar dados
  const carregarDados = async (paginaAlvo = pagina) => {
    setLoading(true);
    try {
      let query = supabase
        .from(tabelaAtiva)
        .select("*", { count: "exact" });

      // Filtro de Busca (Nome, Passport ID, UUID, Placa)
      if (search.trim()) {
        const queryStr = search.trim();
        if (queryStr.length === 36) {
          if (tabelaAtiva === "sessoes_ponto_auditoria_reds") {
            query = query.eq("uuid_sessao", queryStr);
          } else {
            query = query.eq("uuid", queryStr);
          }
        } else if (/^\d+$/.test(queryStr)) {
          if (tabelaAtiva === "logs_tunagem_reds") {
            query = query.or(`tecnico_id.eq.${queryStr},dono_id.eq.${queryStr}`);
          } else if (tabelaAtiva === "sessoes_ponto_auditoria_reds") {
            query = query.eq("id_jogo", queryStr);
          } else {
            query = query.eq("id", parseInt(queryStr, 10));
          }
        } else {
          if (tabelaAtiva === "logs_tunagem_reds") {
            query = query.or(`tecnico_nome.ilike.%${queryStr}%,veiculo_nome.ilike.%${queryStr}%,placa.ilike.%${queryStr}%`);
          } else {
            query = query.ilike("nome", `%${queryStr}%`);
          }
        }
      }

      // Filtro de Datas
      if (dateInicio) {
        if (tabelaAtiva === "sessoes_ponto_auditoria_reds") {
          query = query.gte("entrada", `${dateInicio}T00:00:00-03:00`);
        } else {
          query = query.gte("data", dateInicio);
        }
      }
      if (dateFim) {
        if (tabelaAtiva === "sessoes_ponto_auditoria_reds") {
          query = query.lte("entrada", `${dateFim}T23:59:59-03:00`);
        } else {
          query = query.lte("data", dateFim);
        }
      }

      // Filtro de tipo (apenas para pontos)
      if (tabelaAtiva === "log_ponto_reds" && tipoFiltro !== "todos") {
        query = query.eq("tipo", tipoFiltro);
      }

      // Paginação & Ordenação
      const de = (paginaAlvo - 1) * itensPorPagina;
      const ate = de + itensPorPagina - 1;

      if (tabelaAtiva === "sessoes_ponto_auditoria_reds") {
        query = query.order("entrada", { ascending: false });
      } else {
        query = query.order("timestampz", { ascending: false });
      }

      const { data, count, error } = await query.range(de, ate);

      if (error) throw error;

      setRegistros(data || []);
      setTotalRegistros(count || 0);
      setSelecionados(new Set());
    } catch (e) {
      console.error("Erro ao carregar dados do banco:", e);
      alert(`❌ Erro ao consultar dados no Supabase: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPagina(1);
    carregarDados(1);
  }, [tabelaAtiva, dateInicio, dateFim, tipoFiltro, itensPorPagina]);

  const handleBuscaSubmit = (e) => {
    e.preventDefault();
    setPagina(1);
    carregarDados(1);
  };

  const [sincronizando, setSincronizando] = useState(false);

  const reconciliarBanco = async () => {
    setSincronizando(true);
    try {
      const isV2 = typeof window !== "undefined" && (window.location.pathname.startsWith("/v2") || window.__REDS_V2_MODE__ === true);
      const res = await fetch("/api/reconciliar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isV2, dias: 2 })
      });
      const json = await res.json();
      if (res.ok && (json.success || json.ok)) {
        if (isV2 && json.relatorio) {
          alert(
            `✅ Reconciliação V2 Concluída (Janela de 2 dias)!\n\n` +
            `• 🚗 Tunagens processadas: ${json.relatorio.tunagens}\n` +
            `• 🛠️ Bancada processadas: ${json.relatorio.bancada}\n` +
            `• 📦 Baú processadas: ${json.relatorio.bau}\n` +
            `• ⏱️ Sessões de Ponto: ${json.relatorio.pontos}\n` +
            (json.relatorio.ajustesPreservados ? `• 🛡️ Ajustes manuais preservados: ${json.relatorio.ajustesPreservados}\n` : "")
          );
        } else {
          alert("🔄 Reconciliação iniciada em segundo plano! As tabelas tratadas e de pontos estão sendo atualizadas.");
        }
        carregarDados();
      } else {
        alert("Aviso na reconciliação: " + (json.error || json.message || "Erro desconhecido"));
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao se conectar com a API de conciliação: " + e.message);
    } finally {
      setSincronizando(false);
    }
  };

  // Deletar registro individual
  const deletarRegistro = async (reg) => {
    if (!confirm("⚠️ Tem certeza que deseja apagar permanentemente este registro?")) return;
    setLoading(true);
    try {
      if (tabelaAtiva === "sessoes_ponto_auditoria_reds") {
        const { error } = await supabase
          .from("sessoes_ponto_auditoria_reds")
          .delete()
          .eq("id", reg.id);
        if (error) throw error;
      } else {
        if (reg.uuid) {
          await supabase.from("logs_excluidos_reds").insert([{ uuid: reg.uuid }]).catch(() => {});
        }
        const { error } = await supabase
          .from(tabelaAtiva)
          .delete()
          .eq("uuid", reg.uuid);
        if (error) throw error;
      }

      alert("✅ Registro apagado com sucesso!");
      carregarDados();
      fetch("/api/reconciliar", { method: "POST" }).catch(() => {});
    } catch (e) {
      console.error(e);
      alert("Erro ao deletar registro.");
    } finally {
      setLoading(false);
    }
  };

  // Deletar selecionados em massa
  const deletarSelecionados = async () => {
    if (selecionados.size === 0) return;
    if (!confirm(`⚠️ Tem certeza que deseja apagar permanentemente estes ${selecionados.size} registros selecionados?`)) return;

    setLoading(true);
    try {
      const ids = Array.from(selecionados);

      if (tabelaAtiva === "sessoes_ponto_auditoria_reds") {
        const numIds = ids.map(v => parseInt(v, 10)).filter(v => !isNaN(v));
        const { error } = await supabase
          .from("sessoes_ponto_auditoria_reds")
          .delete()
          .in("id", numIds);
        if (error) throw error;
      } else {
        const loteExclusoes = ids.map(uuid => ({ uuid }));
        await supabase.from("logs_excluidos_reds").insert(loteExclusoes).catch(() => {});
        const { error } = await supabase
          .from(tabelaAtiva)
          .delete()
          .in("uuid", ids);
        if (error) throw error;
      }

      alert(`✅ ${ids.length} registros apagados com sucesso!`);
      carregarDados();
      fetch("/api/reconciliar", { method: "POST" }).catch(() => {});
    } catch (e) {
      console.error(e);
      alert("Erro ao deletar registros.");
    } finally {
      setLoading(false);
    }
  };

  const alternarSelecionarTodos = () => {
    if (selecionados.size === registros.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(registros.map(r => getItemId(r))));
    }
  };

  const alternarSelecionado = (idKey) => {
    const novos = new Set(selecionados);
    if (novos.has(idKey)) {
      novos.delete(idKey);
    } else {
      novos.add(idKey);
    }
    setSelecionados(novos);
  };

  const labelTabela = {
    log_ponto_reds: "⏱️ Logs de Ponto",
    log_bau_reds: "📦 Logs de Baú",
    log_bancada_reds: "🛠️ Logs de Bancada",
    logs_tunagem_reds: "🚗 Logs de Tunagem",
    sessoes_ponto_auditoria_reds: "📑 Sessões de Ponto",
  };

  return (
    <div style={{ padding: "24px", color: theme.text }}>
      {/* Topo / Cabeçalho */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "800", color: theme.text, margin: 0 }}>
            🗄️ Gerenciador do Banco de Dados
          </h1>
          <p style={{ fontSize: "13px", color: theme.subtext, marginTop: "6px" }}>
            Visualização, filtragem e exclusão de logs puros tratados no Supabase para a Reds.
          </p>
        </div>
        
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            disabled={sincronizando}
            onClick={reconciliarBanco}
            style={{
              background: "rgba(34,197,94,0.15)",
              border: "1px solid #22c55e",
              padding: "8px 16px",
              borderRadius: "10px",
              color: "#4ade80",
              fontWeight: "800",
              cursor: sincronizando ? "not-allowed" : "pointer",
              fontSize: "13px"
            }}
          >
            {sincronizando ? "⏳ Reconciliando..." : "⚙️ Reconciliar Banco"}
          </button>

          <button
            onClick={() => carregarDados(pagina)}
            style={{
              background: "rgba(236,72,153,0.15)",
              border: "1px solid #ec4899",
              padding: "8px 16px",
              borderRadius: "10px",
              color: "#f472b6",
              fontWeight: "800",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            🔄 Atualizar Dados
          </button>
        </div>
      </div>

      {/* Tabs / Seleção de Tabela */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "24px", borderBottom: `1px solid ${theme.border}`, paddingBottom: "12px", flexWrap: "wrap" }}>
        {Object.entries(labelTabela).map(([key, value]) => {
          const ativo = tabelaAtiva === key;
          return (
            <button
              key={key}
              onClick={() => setTabelaAtiva(key)}
              style={{
                background: ativo ? "rgba(236,72,153,0.2)" : "transparent",
                border: ativo ? "1px solid #ec4899" : "1px solid transparent",
                color: ativo ? "#f472b6" : theme.subtext,
                padding: "8px 16px",
                borderRadius: "10px",
                fontWeight: ativo ? "900" : "600",
                cursor: "pointer",
                fontSize: "13.5px",
                transition: "all 0.2s",
                whiteSpace: "nowrap"
              }}
            >
              {value}
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: "16px",
        padding: "16px",
        marginBottom: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}>
        <form onSubmit={handleBuscaSubmit} style={{ display: "flex", gap: "12px", width: "100%", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder={
              tabelaAtiva === "logs_tunagem_reds"
                ? "Buscar por Nome do Técnico, ID, Veículo ou Placa..."
                : tabelaAtiva === "sessoes_ponto_auditoria_reds"
                ? "Buscar por Nome do Mecânico, ID Jogo ou UUID da Sessão..."
                : "Buscar por Nome, ID Passaporte ou UUID do log..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: "250px",
              background: theme.card2,
              border: `1px solid ${theme.border}`,
              borderRadius: "10px",
              padding: "10px 14px",
              color: theme.text,
              fontSize: "14px"
            }}
          />
          <button
            type="submit"
            style={{
              background: "#ec4899",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "10px",
              fontWeight: "800",
              cursor: "pointer"
            }}
          >
            🔍 Buscar
          </button>
        </form>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext }}>Data Início:</label>
            <input
              type="date"
              value={dateInicio}
              onChange={(e) => setDateInicio(e.target.value)}
              style={{
                background: theme.card2,
                border: `1px solid ${theme.border}`,
                borderRadius: "8px",
                padding: "8px 12px",
                color: theme.text,
                fontSize: "13px"
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext }}>Data Fim:</label>
            <input
              type="date"
              value={dateFim}
              onChange={(e) => setDateFim(e.target.value)}
              style={{
                background: theme.card2,
                border: `1px solid ${theme.border}`,
                borderRadius: "8px",
                padding: "8px 12px",
                color: theme.text,
                fontSize: "13px"
              }}
            />
          </div>

          {tabelaAtiva === "log_ponto_reds" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext }}>Filtrar Tipo:</label>
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                style={{
                  background: theme.card2,
                  border: `1px solid ${theme.border}`,
                  borderRadius: "8px",
                  padding: "8px 12px",
                  color: theme.text,
                  fontSize: "13px"
                }}
              >
                <option value="todos">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext }}>Exibir por Página:</label>
            <select
              value={itensPorPagina}
              onChange={(e) => setItensPorPagina(Number(e.target.value))}
              style={{
                background: theme.card2,
                border: `1px solid ${theme.border}`,
                borderRadius: "8px",
                padding: "8px 12px",
                color: theme.text,
                fontSize: "13px"
              }}
            >
              <option value={50}>50 registros</option>
              <option value={100}>100 registros</option>
              <option value={150}>150 registros</option>
              <option value={200}>200 registros</option>
            </select>
          </div>

          {/* Botão de exclusão em massa */}
          {selecionados.size > 0 && (
            <button
              onClick={deletarSelecionados}
              style={{
                marginLeft: "auto",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid #ef4444",
                borderRadius: "10px",
                padding: "10px 20px",
                color: "#f87171",
                fontWeight: "900",
                cursor: "pointer",
                fontSize: "13px"
              }}
            >
              🗑️ Excluir Selecionados ({selecionados.size})
            </button>
          )}
        </div>
      </div>

      {/* Grid de listagem / Tabela */}
      <div style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: "16px",
        overflow: "hidden"
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: theme.card2, borderBottom: `1px solid ${theme.border}` }}>
                <th style={{ padding: "16px 20px", width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={registros.length > 0 && selecionados.size === registros.length}
                    onChange={alternarSelecionarTodos}
                    style={{ cursor: "pointer" }}
                  />
                </th>

                {tabelaAtiva === "logs_tunagem_reds" ? (
                  <>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>UUID</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>TÉCNICO</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>DONO / CLIENTE</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>VEÍCULO / PLACA</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>VALOR PAGO</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>DATA / HORA</th>
                  </>
                ) : tabelaAtiva === "sessoes_ponto_auditoria_reds" ? (
                  <>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>ID / SESSÃO</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>MECÂNICO</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: "#38bdf8" }} title="Clique na linha para auditar as atividades">ENTRADA 🔍</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: "#38bdf8" }} title="Clique na linha para auditar as atividades">SAÍDA 🔍</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: "#38bdf8" }} title="Clique na linha para auditar as atividades">DURAÇÃO 🔍</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>STATUS</th>
                  </>
                ) : tabelaAtiva === "log_bancada_reds" ? (
                  <>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>UUID</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>PASSPORT ID</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>MECÂNICO</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>ITEM CRAFTADO</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>QUANTIDADE</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>DATA</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>HORA</th>
                  </>
                ) : tabelaAtiva === "log_bau_reds" ? (
                  <>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>UUID</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>PASSPORT ID</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>MECÂNICO</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>AÇÃO</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>ITEM</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>QUANTIDADE</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>DATA</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>HORA</th>
                  </>
                ) : (
                  <>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>UUID DO LOG</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>PASSPORT ID</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>NOME COMPLETO</th>
                    {tabelaAtiva === "log_ponto_reds" && (
                      <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>TIPO</th>
                    )}
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>DATA</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>HORA</th>
                  </>
                )}

                <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext, width: "100px", textAlign: "center" }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: "40px", color: theme.subtext, textAlign: "center" }}>
                    ⏳ Consultando registros no Supabase...
                  </td>
                </tr>
              ) : registros.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: "40px", color: theme.subtext, textAlign: "center" }}>
                    🗄️ Nenhum registro encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                registros.map((reg) => {
                  const idKey = getItemId(reg);
                  const isSelected = selecionados.has(idKey);
                  return (
                    <tr
                      key={idKey}
                      style={{
                        borderBottom: `1px solid ${theme.border}`,
                        background: isSelected ? "rgba(236,72,153,0.05)" : "transparent",
                        transition: "all 0.15s"
                      }}
                    >
                      <td style={{ padding: "16px 20px" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => alternarSelecionado(idKey)}
                          style={{ cursor: "pointer" }}
                        />
                      </td>

                      {tabelaAtiva === "logs_tunagem_reds" ? (
                        <>
                          <td style={{ padding: "16px 20px", fontSize: "12px", fontFamily: "monospace", color: theme.subtext }}>
                            {reg.uuid ? reg.uuid.slice(0, 8) + "..." : "—"}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13.5px" }}>
                            <strong>{reg.tecnico_nome || "—"}</strong>
                            <div style={{ fontSize: "11px", color: theme.subtext }}>ID: {reg.tecnico_id}</div>
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13px" }}>
                            {reg.dono_nome || "—"}
                            {reg.dono_id && <div style={{ fontSize: "11px", color: theme.subtext }}>ID: {reg.dono_id}</div>}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13px" }}>
                            <strong>{reg.veiculo_nome || "—"}</strong>
                            <div style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "monospace" }}>{reg.placa || "Sem placa"}</div>
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13.5px", fontWeight: "800", color: "#22c55e" }}>
                            R$ {Number(reg.valor_pago || 0).toLocaleString("pt-BR")}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "12.5px" }}>
                            {reg.data} <span style={{ color: theme.subtext }}>{reg.hora}</span>
                          </td>
                        </>
                      ) : tabelaAtiva === "sessoes_ponto_auditoria_reds" ? (
                        <>
                          <td style={{ padding: "16px 20px", fontSize: "12px", fontFamily: "monospace", color: theme.subtext }}>
                            #{reg.id}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13.5px" }}>
                            <strong>{reg.nome || "—"}</strong>
                            <div style={{ fontSize: "11px", color: theme.subtext }}>ID: {reg.id_jogo}</div>
                          </td>
                          <td
                            onClick={() => abrirAuditoriaSessao(reg)}
                            style={{
                              padding: "16px 20px",
                              fontSize: "12.5px",
                              cursor: "pointer",
                              color: "#38bdf8",
                              fontWeight: "600",
                              transition: "all 0.15s"
                            }}
                            title="Clique para auditar movimentações e serviços desta sessão"
                          >
                            <span style={{ borderBottom: "1px dashed #38bdf8" }}>
                              {formatarDataHoraBR(reg.entrada)}
                            </span>
                          </td>
                          <td
                            onClick={() => abrirAuditoriaSessao(reg)}
                            style={{
                              padding: "16px 20px",
                              fontSize: "12.5px",
                              cursor: "pointer",
                              color: reg.saida ? "#38bdf8" : undefined,
                              fontWeight: reg.saida ? "600" : "normal",
                              transition: "all 0.15s"
                            }}
                            title="Clique para auditar movimentações e serviços desta sessão"
                          >
                            {reg.saida ? (
                              <span style={{ borderBottom: "1px dashed #38bdf8" }}>
                                {formatarDataHoraBR(reg.saida)}
                              </span>
                            ) : (
                              <span style={{ color: "#22c55e", fontWeight: "800" }}>🟢 Em Aberto</span>
                            )}
                          </td>
                          <td
                            onClick={() => abrirAuditoriaSessao(reg)}
                            style={{ padding: "16px 20px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                            title="Clique para auditar movimentações e serviços desta sessão"
                          >
                            <span style={{
                              background: "rgba(56, 189, 248, 0.12)",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              color: "#38bdf8",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}>
                              {reg.duracao_min ? `${reg.duracao_min} min` : (reg.saida ? "< 1 min" : "Em andamento")}
                              <span style={{ fontSize: "11px" }}>🔍</span>
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{
                              background: reg.status_ponto === "normal" ? "rgba(34,197,94,0.15)" : reg.status_ponto === "aberto" ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.15)",
                              border: `1px solid ${reg.status_ponto === "normal" ? "#22c55e" : reg.status_ponto === "aberto" ? "#3b82f6" : "#ef4444"}`,
                              color: reg.status_ponto === "normal" ? "#4ade80" : reg.status_ponto === "aberto" ? "#60a5fa" : "#f87171",
                              fontSize: "10.5px",
                              fontWeight: "900",
                              padding: "3px 7px",
                              borderRadius: "6px",
                              textTransform: "uppercase"
                            }}>
                              {reg.status_ponto || "normal"}
                            </span>
                          </td>
                        </>
                      ) : tabelaAtiva === "log_bancada_reds" ? (
                        <>
                          <td style={{ padding: "16px 20px", fontSize: "12px", fontFamily: "monospace", color: theme.subtext }}>
                            {reg.uuid ? reg.uuid.slice(0, 8) + "..." : "—"}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "14px", fontWeight: "800" }}>
                            {reg.id}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "14px", fontWeight: "700" }}>
                            {reg.nome || reg.usuario_nome || "—"}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13.5px", fontWeight: "600", color: "#f1f5f9" }}>
                            {reg.item_craftado || reg.item || "—"}
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{
                              background: "rgba(56, 189, 248, 0.15)",
                              border: "1px solid #38bdf8",
                              color: "#38bdf8",
                              fontSize: "11px",
                              fontWeight: "900",
                              padding: "3px 8px",
                              borderRadius: "6px"
                            }}>
                              {reg.quantidade ? `${reg.quantidade}x` : "1x"}
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13px" }}>
                            {reg.data}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13px" }}>
                            {reg.hora}
                          </td>
                        </>
                      ) : tabelaAtiva === "log_bau_reds" ? (
                        <>
                          <td style={{ padding: "16px 20px", fontSize: "12px", fontFamily: "monospace", color: theme.subtext }}>
                            {reg.uuid ? reg.uuid.slice(0, 8) + "..." : "—"}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "14px", fontWeight: "800" }}>
                            {reg.id}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "14px", fontWeight: "700" }}>
                            {reg.nome || reg.usuario_nome || "—"}
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{
                              background: (reg.acao || "").toUpperCase().includes("GUARD") ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                              border: `1px solid ${(reg.acao || "").toUpperCase().includes("GUARD") ? "#22c55e" : "#f97316"}`,
                              color: (reg.acao || "").toUpperCase().includes("GUARD") ? "#4ade80" : "#fb923c",
                              fontSize: "11px",
                              fontWeight: "900",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              textTransform: "uppercase"
                            }}>
                              {reg.acao || "MOVIMENTOU"}
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13.5px", fontWeight: "600", color: "#f1f5f9" }}>
                            {reg.item || "—"}
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span style={{
                              background: "rgba(56, 189, 248, 0.15)",
                              border: "1px solid #38bdf8",
                              color: "#38bdf8",
                              fontSize: "11px",
                              fontWeight: "900",
                              padding: "3px 8px",
                              borderRadius: "6px"
                            }}>
                              {reg.quantidade ? `${reg.quantidade}x` : "1x"}
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13px" }}>
                            {reg.data}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13px" }}>
                            {reg.hora}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: "16px 20px", fontSize: "13px", fontFamily: "monospace", color: theme.subtext }}>
                            {reg.uuid}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "14px", fontWeight: "800" }}>
                            {reg.id}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "14px", fontWeight: "700" }}>
                            {reg.nome}
                          </td>
                          {tabelaAtiva === "log_ponto_reds" && (
                            <td style={{ padding: "16px 20px" }}>
                              <span style={{
                                background: reg.tipo === "entrada" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                                border: `1px solid ${reg.tipo === "entrada" ? "#22c55e" : "#ef4444"}`,
                                color: reg.tipo === "entrada" ? "#4ade80" : "#f87171",
                                fontSize: "11px",
                                fontWeight: "900",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                textTransform: "uppercase"
                              }}>
                                {reg.tipo === "entrada" ? "entrada" : "saída"}
                              </span>
                            </td>
                          )}
                          <td style={{ padding: "16px 20px", fontSize: "13px" }}>
                            {reg.data}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13px" }}>
                            {reg.hora}
                          </td>
                        </>
                      )}

                      <td style={{ padding: "16px 20px", textAlign: "center", whiteSpace: "nowrap" }}>
                        {tabelaAtiva === "sessoes_ponto_auditoria_reds" && (
                          <button
                            onClick={() => abrirAuditoriaSessao(reg)}
                            style={{
                              background: "rgba(56, 189, 248, 0.15)",
                              border: "1px solid #38bdf8",
                              borderRadius: "6px",
                              padding: "6px 10px",
                              color: "#38bdf8",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: "800",
                              marginRight: "6px",
                              transition: "all 0.2s"
                            }}
                            title="Auditar serviços e movimentações desta sessão"
                          >
                            🔍 Ver Logs
                          </button>
                        )}
                        <button
                          onClick={() => deletarRegistro(reg)}
                          style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            color: "#f87171",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "800",
                            transition: "all 0.2s"
                          }}
                          title="Deletar Registro"
                        >
                          🗑️ Apagar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer da tabela / Paginação */}
        {!loading && registros.length > 0 && (
          <div style={{
            background: theme.card2,
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div style={{ fontSize: "13px", color: theme.subtext }}>
              Exibindo registros de <strong>{(pagina - 1) * itensPorPagina + 1}</strong> a <strong>{Math.min(pagina * itensPorPagina, totalRegistros)}</strong> de um total de <strong>{totalRegistros}</strong>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                disabled={pagina === 1}
                onClick={() => { const novaPag = pagina - 1; setPagina(novaPag); carregarDados(novaPag); }}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  padding: "6px 12px",
                  borderRadius: "8px",
                  color: pagina === 1 ? theme.subtext : theme.text,
                  cursor: pagina === 1 ? "not-allowed" : "pointer",
                  fontSize: "13px",
                  fontWeight: "700"
                }}
              >
                ◀ Anterior
              </button>

              <span style={{ fontSize: "13px", fontWeight: "800" }}>
                Página {pagina}
              </span>

              <button
                disabled={pagina * itensPorPagina >= totalRegistros}
                onClick={() => { const novaPag = pagina + 1; setPagina(novaPag); carregarDados(novaPag); }}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  padding: "6px 12px",
                  borderRadius: "8px",
                  color: pagina * itensPorPagina >= totalRegistros ? theme.subtext : theme.text,
                  cursor: pagina * itensPorPagina >= totalRegistros ? "not-allowed" : "pointer",
                  fontSize: "13px",
                  fontWeight: "700"
                }}
              >
                Próxima ▶
              </button>
            </div>
          </div>
        )}
      </div>
      {/* MODAL DE AUDITORIA DE SESSÃO DE PONTO (SERVIÇOS E MOVIMENTAÇÕES) */}
      {sessaoInspecao && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(12px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSessaoInspecao(null);
          }}
        >
          <div
            style={{
              background: theme.card || "#111827",
              border: `1px solid ${theme.border || "#374151"}`,
              borderRadius: "20px",
              width: "100%",
              maxWidth: "920px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px -15px rgba(0,0,0,0.7)",
              overflow: "hidden"
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: `1px solid ${theme.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                background: theme.card2 || "#1f2937"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "19px", fontWeight: "900", margin: 0, color: theme.text }}>
                    📋 Auditoria de Movimentações & Serviços
                  </h2>
                  <span
                    style={{
                      background: "rgba(56, 189, 248, 0.15)",
                      border: "1px solid #38bdf8",
                      color: "#38bdf8",
                      fontSize: "12px",
                      fontWeight: "800",
                      padding: "2px 8px",
                      borderRadius: "6px"
                    }}
                  >
                    Sessão #{sessaoInspecao.id || sessaoInspecao.uuid_sessao}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "13px", color: theme.subtext, flexWrap: "wrap" }}>
                  <span>👤 <strong>{sessaoInspecao.nome}</strong> (ID: {sessaoInspecao.id_jogo || sessaoInspecao.usuario_id || "—"})</span>
                  <span>🟢 Entrada: <strong>{formatarDataHoraBR(sessaoInspecao.entrada)}</strong></span>
                  <span>🔴 Saída: <strong>{sessaoInspecao.saida ? formatarDataHoraBR(sessaoInspecao.saida) : "Em Aberto"}</strong></span>
                  <span>⏱️ Duração: <strong>{sessaoInspecao.duracao_min ? `${sessaoInspecao.duracao_min} min` : (sessaoInspecao.saida ? "< 1 min" : "Em andamento")}</strong></span>
                </div>
              </div>

              <button
                onClick={() => setSessaoInspecao(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: theme.subtext,
                  fontSize: "24px",
                  cursor: "pointer",
                  lineHeight: "1",
                  padding: "4px"
                }}
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Resumo / Cards Estatísticos */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                padding: "16px 24px",
                borderBottom: `1px solid ${theme.border}`,
                background: "rgba(0,0,0,0.15)"
              }}
            >
              {/* Tunagens */}
              <div
                onClick={() => setAbaAtividades("tunagens")}
                style={{
                  background: abaAtividades === "tunagens" ? "rgba(168, 85, 247, 0.2)" : theme.card2,
                  border: `1px solid ${abaAtividades === "tunagens" ? "#a855f7" : theme.border}`,
                  borderRadius: "12px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#c084fc", textTransform: "uppercase" }}>🚗 Tunagens Feitas</div>
                <div style={{ fontSize: "20px", fontWeight: "900", color: theme.text, marginTop: "2px" }}>
                  {atividadesSessao.tunagens.length}
                </div>
                <div style={{ fontSize: "11.5px", color: "#4ade80", fontWeight: "700", marginTop: "2px" }}>
                  R$ {atividadesSessao.tunagens.reduce((acc, t) => acc + Number(t.valor || 0), 0).toLocaleString("pt-BR")}
                </div>
              </div>

              {/* Bancada */}
              <div
                onClick={() => setAbaAtividades("bancada")}
                style={{
                  background: abaAtividades === "bancada" ? "rgba(56, 189, 248, 0.2)" : theme.card2,
                  border: `1px solid ${abaAtividades === "bancada" ? "#38bdf8" : theme.border}`,
                  borderRadius: "12px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#38bdf8", textTransform: "uppercase" }}>🛠️ Compras / Bancada</div>
                <div style={{ fontSize: "20px", fontWeight: "900", color: theme.text, marginTop: "2px" }}>
                  {atividadesSessao.bancada.length}
                </div>
                <div style={{ fontSize: "11.5px", color: theme.subtext, marginTop: "2px" }}>
                  Peças e Ferramentas
                </div>
              </div>

              {/* Baú */}
              <div
                onClick={() => setAbaAtividades("bau")}
                style={{
                  background: abaAtividades === "bau" ? "rgba(249, 115, 22, 0.2)" : theme.card2,
                  border: `1px solid ${abaAtividades === "bau" ? "#f97316" : theme.border}`,
                  borderRadius: "12px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#fb923c", textTransform: "uppercase" }}>📦 Movimentações de Baú</div>
                <div style={{ fontSize: "20px", fontWeight: "900", color: theme.text, marginTop: "2px" }}>
                  {atividadesSessao.bau.length}
                </div>
                <div style={{ fontSize: "11.5px", color: theme.subtext, marginTop: "2px" }}>
                  Retiradas & Guardados
                </div>
              </div>

              {/* Total Geral */}
              <div
                onClick={() => setAbaAtividades("todas")}
                style={{
                  background: abaAtividades === "todas" ? "rgba(236, 72, 153, 0.2)" : theme.card2,
                  border: `1px solid ${abaAtividades === "todas" ? "#ec4899" : theme.border}`,
                  borderRadius: "12px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#f472b6", textTransform: "uppercase" }}>⚡ Total de Registros</div>
                <div style={{ fontSize: "20px", fontWeight: "900", color: theme.text, marginTop: "2px" }}>
                  {atividadesSessao.tunagens.length + atividadesSessao.bancada.length + atividadesSessao.bau.length}
                </div>
                <div style={{ fontSize: "11.5px", color: theme.subtext, marginTop: "2px" }}>
                  Atividades no Turno
                </div>
              </div>
            </div>

            {/* Tabs de Filtro de Atividades */}
            <div style={{ display: "flex", gap: "8px", padding: "12px 24px", borderBottom: `1px solid ${theme.border}`, background: theme.card2, flexWrap: "wrap" }}>
              {[
                { id: "todas", label: `Todas (${atividadesSessao.tunagens.length + atividadesSessao.bancada.length + atividadesSessao.bau.length})` },
                { id: "tunagens", label: `🚗 Tunagens (${atividadesSessao.tunagens.length})` },
                { id: "bancada", label: `🛠️ Bancada (${atividadesSessao.bancada.length})` },
                { id: "bau", label: `📦 Baú (${atividadesSessao.bau.length})` },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setAbaAtividades(t.id)}
                  style={{
                    background: abaAtividades === t.id ? "#ec4899" : "transparent",
                    color: abaAtividades === t.id ? "#fff" : theme.subtext,
                    border: `1px solid ${abaAtividades === t.id ? "#ec4899" : theme.border}`,
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                    fontWeight: "800",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Lista com Scroll */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {carregandoAtividades ? (
                <div style={{ textAlign: "center", padding: "40px", color: theme.subtext }}>
                  ⏳ Buscando todas as movimentações e serviços realizados no período desta sessão...
                </div>
              ) : (() => {
                let lista = [];
                if (abaAtividades === "todas" || abaAtividades === "tunagens") {
                  lista.push(...atividadesSessao.tunagens);
                }
                if (abaAtividades === "todas" || abaAtividades === "bancada") {
                  lista.push(...atividadesSessao.bancada);
                }
                if (abaAtividades === "todas" || abaAtividades === "bau") {
                  lista.push(...atividadesSessao.bau);
                }

                // Ordenar cronologicamente
                lista.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                if (lista.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "40px", color: theme.subtext, background: theme.card2, borderRadius: "12px", border: `1px dashed ${theme.border}` }}>
                      🔍 Nenhuma movimentação ou serviço registrado para {sessaoInspecao.nome} no intervalo deste período.
                    </div>
                  );
                }

                return lista.map((item, idx) => {
                  const isTunagem = item.tipo === "tunagem";
                  const isBancada = item.tipo === "bancada";
                  const isBau = item.tipo === "bau";
                  const isGuardou = isBau && item.acao === "GUARDOU";

                  const tagBg = isTunagem ? "rgba(168, 85, 247, 0.15)" : isBancada ? "rgba(56, 189, 248, 0.15)" : isGuardou ? "rgba(34, 197, 94, 0.15)" : "rgba(249, 115, 22, 0.15)";
                  const tagBorder = isTunagem ? "#a855f7" : isBancada ? "#38bdf8" : isGuardou ? "#22c55e" : "#f97316";
                  const tagColor = isTunagem ? "#c084fc" : isBancada ? "#38bdf8" : isGuardou ? "#4ade80" : "#fb923c";
                  const tagLabel = isTunagem ? "🚗 TUNAGEM" : isBancada ? "🛠️ BANCADA" : isGuardou ? "📦 BAÚ (GUARDOU)" : "📦 BAÚ (RETIROU)";

                  return (
                    <div
                      key={item.uuid || `${item.tipo}-${item.id || idx}`}
                      style={{
                        background: theme.card2,
                        border: `1px solid ${theme.border}`,
                        borderRadius: "12px",
                        padding: "14px 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        transition: "all 0.15s"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span
                            style={{
                              background: tagBg,
                              border: `1px solid ${tagBorder}`,
                              color: tagColor,
                              fontSize: "10.5px",
                              fontWeight: "900",
                              padding: "3px 8px",
                              borderRadius: "6px"
                            }}
                          >
                            {tagLabel}
                          </span>
                          <span style={{ fontSize: "12.5px", color: theme.subtext, fontWeight: "600" }}>
                            🕒 {formatarDataHoraBR(item.timestamp)}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          {item.uuid && (
                            <button
                              onClick={() => copiarParaClipboard(item.uuid)}
                              style={{
                                background: copiadoUuid === item.uuid ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)",
                                border: `1px solid ${copiadoUuid === item.uuid ? "#22c55e" : theme.border}`,
                                color: copiadoUuid === item.uuid ? "#4ade80" : theme.subtext,
                                borderRadius: "6px",
                                padding: "4px 8px",
                                fontSize: "11px",
                                fontWeight: "700",
                                cursor: "pointer"
                              }}
                              title="Copiar UUID"
                            >
                              {copiadoUuid === item.uuid ? "✅ Copiado" : "📋 Copiar UUID"}
                            </button>
                          )}
                          <button
                            onClick={() => setLogRawAberto(logRawAberto === item.uuid ? null : item.uuid)}
                            style={{
                              background: logRawAberto === item.uuid ? "rgba(236,72,153,0.2)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${logRawAberto === item.uuid ? "#ec4899" : theme.border}`,
                              color: logRawAberto === item.uuid ? "#f472b6" : theme.subtext,
                              borderRadius: "6px",
                              padding: "4px 8px",
                              fontSize: "11px",
                              fontWeight: "700",
                              cursor: "pointer"
                            }}
                          >
                            {logRawAberto === item.uuid ? "Ocultar Log" : "📄 Ver Log"}
                          </button>
                        </div>
                      </div>

                      {/* Conteúdo Detalhado */}
                      {isTunagem && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                          <div>
                            <span style={{ fontSize: "14px", fontWeight: "800", color: theme.text }}>
                              {item.veiculo || "Veículo sem nome"}
                            </span>
                            <span style={{ marginLeft: "8px", fontSize: "11px", color: "#38bdf8", fontFamily: "monospace", background: "rgba(56,189,248,0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                              {item.placa || "SEM PLACA"}
                            </span>
                            {item.dono && (
                              <span style={{ marginLeft: "8px", fontSize: "12px", color: theme.subtext }}>
                                • Dono: <strong>{item.dono}</strong>
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: "900", color: "#22c55e" }}>
                            R$ {Number(item.valor || 0).toLocaleString("pt-BR")}
                          </div>
                        </div>
                      )}

                      {isBancada && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                          <div>
                            <span style={{ fontSize: "14px", fontWeight: "800", color: theme.text }}>
                              {item.quantidade}x {item.item}
                            </span>
                            <span style={{ marginLeft: "8px", fontSize: "11.5px", color: theme.subtext }}>
                              (Ação: {item.acao})
                            </span>
                          </div>
                          {item.preco && (
                            <div style={{ fontSize: "13px", fontWeight: "800", color: "#f59e0b" }}>
                              R$ {item.preco}
                            </div>
                          )}
                        </div>
                      )}

                      {isBau && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                          <div>
                            <span style={{ fontSize: "14px", fontWeight: "800", color: theme.text }}>
                              {item.item}
                            </span>
                            <span style={{ marginLeft: "8px", fontSize: "11.5px", color: theme.subtext }}>
                              • Baú: <strong>{item.bauNome}</strong>
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Log Raw Expandido */}
                      {logRawAberto === item.uuid && (
                        <pre
                          style={{
                            background: "rgba(0,0,0,0.5)",
                            border: `1px solid ${theme.border}`,
                            borderRadius: "8px",
                            padding: "12px",
                            fontSize: "11.5px",
                            color: "#94a3b8",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            marginTop: "6px",
                            fontFamily: "monospace"
                          }}
                        >
                          {item.raw}
                        </pre>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: `1px solid ${theme.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: theme.card2
              }}
            >
              <div style={{ fontSize: "12px", color: theme.subtext }}>
                💡 Todas as ações gravadas pelo mecânico durante a janela do ponto são filtradas em tempo real.
              </div>
              <button
                onClick={() => setSessaoInspecao(null)}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  padding: "8px 18px",
                  borderRadius: "8px",
                  color: theme.text,
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "13px"
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
