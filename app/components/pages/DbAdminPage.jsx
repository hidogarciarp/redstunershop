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
      const res = await fetch("/api/reconciliar", { method: "POST" });
      if (res.ok) {
        alert("🔄 Reconciliação iniciada em segundo plano! As tabelas tratadas e de pontos estão sendo atualizadas com base nos novos dados.");
      } else {
        alert("Erro ao disparar reconciliação.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao se conectar com a API de conciliação.");
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
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>ENTRADA</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>SAÍDA</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>DURAÇÃO</th>
                    <th style={{ padding: "16px 20px", fontSize: "12px", fontWeight: "800", color: theme.subtext }}>STATUS</th>
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
                  <td colSpan={8} style={{ padding: "40px", color: theme.subtext, textAlign: "center" }}>
                    ⏳ Consultando registros no Supabase...
                  </td>
                </tr>
              ) : registros.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", color: theme.subtext, textAlign: "center" }}>
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
                          <td style={{ padding: "16px 20px", fontSize: "12.5px" }}>
                            {formatarDataHoraBR(reg.entrada)}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "12.5px" }}>
                            {reg.saida ? formatarDataHoraBR(reg.saida) : <span style={{ color: "#22c55e", fontWeight: "800" }}>🟢 Em Aberto</span>}
                          </td>
                          <td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: "700" }}>
                            {reg.duracao_min ? `${reg.duracao_min} min` : (reg.saida ? "< 1 min" : "Em andamento")}
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

                      <td style={{ padding: "16px 20px", textAlign: "center" }}>
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
    </div>
  );
}
