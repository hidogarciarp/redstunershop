import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../utils/supabaseClient";
import { analisarServicoTunagem, formatarReciboDiscord, parseLogsTunagemTexto } from "../../utils/calculadoraTunagem";
import ModalDetalheTunagem from "../ModalDetalheTunagem";
import ImportadorLogsTunagem from "../ImportadorLogsTunagem";

// Helper para calcular a semana de Segunda a Domingo
function getSemanaSegundaADomingo(offsetSemanas = 0, dataBase = new Date()) {
  const d = new Date(dataBase);
  d.setDate(d.getDate() + offsetSemanas * 7);
  const diaSemana = d.getDay();
  const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

  const segunda = new Date(d);
  segunda.setDate(d.getDate() + diffParaSegunda);

  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  const fmt = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const fmtBR = (date) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  return {
    inicio: fmt(segunda),
    fim: fmt(domingo),
    label: `Semana de ${fmtBR(segunda)} até ${fmtBR(domingo)}`,
    labelCurto: `${fmtBR(segunda).slice(0, 5)} - ${fmtBR(domingo).slice(0, 5)}`
  };
}

// Helper para converter base64 DataURL em Blob para envio multipart/form-data ao Discord
function dataURLtoBlob(dataurl) {
  try {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.error("Erro ao converter dataURL para Blob:", err);
    return null;
  }
}

export default function TunagemPage({
  theme,
  styles,
  usuarioLogado,
  notificarTodasTunagens = true,
  toggleNotificarTodasTunagens,
  isAdminOuDono,
  logTunagemParaAbrir,
  setLogTunagemParaAbrir
}) {
  const rolePrincipal = String(usuarioLogado?.role || "").split("|")[0].toLowerCase().trim();
  const acessoTotalCentral = ["gerente_rh", "gerente_geral", "dono", "admin"].includes(rolePrincipal);
  const usuarioId = String(usuarioLogado?.id ?? "").trim();
  const isLogDoUsuario = (log) => usuarioId !== "" && String(log?.tecnico_id ?? "").trim() === usuarioId;

  const [abaAtiva, setAbaAtiva] = useState(() => acessoTotalCentral ? "relatorio" : "logs"); // 'relatorio' | 'logs' | 'quadros' | 'importar'
  const [mecanicas, setMecanicas] = useState([]);
  const [vinculos, setVinculos] = useState([]);
  const [logsTunagem, setLogsTunagem] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!acessoTotalCentral && abaAtiva !== "logs") setAbaAtiva("logs");
  }, [acessoTotalCentral, abaAtiva]);

  // Notificação Realtime de Nova Tunagem
  const [notificacaoRealtime, setNotificacaoRealtime] = useState(null); // { log, analise, isMeu, isAdmin }

  // Filtros de Período (Padrão: Semana Atual Seg -> Dom)
  const [tipoPeriodo, setTipoPeriodo] = useState("semana"); // 'semana' | 'hoje' | 'mes' | 'custom' | 'todos'
  const [offsetSemana, setOffsetSemana] = useState(0);

  const semanaInfo = useMemo(() => getSemanaSegundaADomingo(offsetSemana), [offsetSemana]);

  const [filtroDataInicio, setFiltroDataInicio] = useState(() => getSemanaSegundaADomingo(0).inicio);
  const [filtroDataFim, setFiltroDataFim] = useState(() => getSemanaSegundaADomingo(0).fim);
  const [filtroMecanica, setFiltroMecanica] = useState("reds");
  const [buscaLogs, setBuscaLogs] = useState("");
  const [porcentagemRepasse, setPorcentagemRepasse] = useState(100);

  // Efeito para sincronizar as datas quando o tipoPeriodo ou offsetSemana mudar
  useEffect(() => {
    if (tipoPeriodo === "semana") {
      setFiltroDataInicio(semanaInfo.inicio);
      setFiltroDataFim(semanaInfo.fim);
    } else if (tipoPeriodo === "hoje") {
      const hoje = new Date().toISOString().split("T")[0];
      setFiltroDataInicio(hoje);
      setFiltroDataFim(hoje);
    } else if (tipoPeriodo === "mes") {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const ultimoDia = new Date(yyyy, d.getMonth() + 1, 0).getDate();
      setFiltroDataInicio(`${yyyy}-${mm}-01`);
      setFiltroDataFim(`${yyyy}-${mm}-${String(ultimoDia).padStart(2, "0")}`);
    } else if (tipoPeriodo === "todos") {
      setFiltroDataInicio("");
      setFiltroDataFim("");
    }
  }, [tipoPeriodo, offsetSemana, semanaInfo]);

  // Modal de Detalhes de Tunagem
  const [modalLogDetalhe, setModalLogDetalhe] = useState(null);
  const [abaModalDetalhe, setAbaModalDetalhe] = useState("extrato"); // 'extrato' | 'json'

  // Efeito para abrir o modal quando o usuário clica no banner de notificação global
  useEffect(() => {
    if (logTunagemParaAbrir) {
      if (acessoTotalCentral || isLogDoUsuario(logTunagemParaAbrir)) {
        setAbaAtiva("logs");
        setModalLogDetalhe(logTunagemParaAbrir);
      }
      setLogTunagemParaAbrir?.(null);
    }
  }, [logTunagemParaAbrir, setLogTunagemParaAbrir, acessoTotalCentral, usuarioId]);



  // Supabase Realtime Listener na tabela dedicada logs_tunagem_reds
  useEffect(() => {
    const canalTunagem = supabase
      .channel("realtime-tunagem-direct-reds")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs_tunagem_reds" }, (payload) => {
        const novoLog = payload.new;
        if (!novoLog) return;

        const ofc = (novoLog.oficina_nome || "").toLowerCase();
        if (ofc && (ofc.includes("beach") || ofc.includes("vespucci") || ofc.includes("harmony") || ofc.includes("dudark") || ofc.includes("salt") || ofc.includes("lab"))) {
          return;
        }
        if (novoLog.mechanic_id && novoLog.mechanic_id !== "reds") return;
        if (!acessoTotalCentral && !isLogDoUsuario(novoLog)) return;

        setLogsTunagem((prev) => [novoLog, ...prev.filter((l) => l.uuid !== novoLog.uuid)]);

        const isMeu = usuarioLogado?.id && (String(novoLog.tecnico_id) === String(usuarioLogado.id) || String(novoLog.mechanic_id) === String(usuarioLogado.id));
        const isAdmin = isAdminOuDono ? isAdminOuDono(usuarioLogado?.role) : (usuarioLogado?.role === "admin" || usuarioLogado?.role === "dono" || usuarioLogado?.role === "gerente");
        const deveNotificar = isMeu || (isAdmin && notificarTodasTunagens);

        if (deveNotificar) {
          const analise = analisarServicoTunagem(novoLog.antes_json, novoLog.depois_json, novoLog.valor_pago || 0);
          setNotificacaoRealtime({ log: novoLog, analise, isMeu, isAdmin });

          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
          } catch (e) {}
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalTunagem);
    };
  }, [usuarioLogado, notificarTodasTunagens, isAdminOuDono, acessoTotalCentral, usuarioId]);

  // Ficha de Cobrança Instantânea / Calculadora ao vivo
  const [textoLogFicha, setTextoLogFicha] = useState("");
  const [modalMecanicoLogs, setModalMecanicoLogs] = useState(null);
  const [modalVincularTecnico, setModalVincularTecnico] = useState(null);
  const [vincularForm, setVincularForm] = useState({ mecanica_id: "reds", data_inicio: new Date().toISOString().split("T")[0] });

  // Carregamento de dados do Supabase
  const carregarDados = async () => {
    setLoading(true);
    try {
      const { data: mecs } = await supabase.from("mecanicas").select("*").order("nome");
      if (mecs) setMecanicas(mecs);

      const { data: vincs } = await supabase.from("mecanicos_vinculos").select("*");
      if (vincs) setVinculos(vincs);

      // Consulta direta na tabela exclusiva logs_tunagem_reds
      let query = supabase.from("logs_tunagem_reds").select("*").order("data", { ascending: false }).order("hora", { ascending: false });

      if (!acessoTotalCentral && usuarioId) query = query.eq("tecnico_id", usuarioId);

      if (filtroDataInicio) query = query.gte("data", filtroDataInicio);
      if (filtroDataFim) query = query.lte("data", filtroDataFim);

      let { data: logs, error } = await query;
      if (error) {
        // Fallback seguro se logs_tunagem_reds não estiver pronta
        let fallbackQuery = supabase.from("logs_tunagem").select("*").eq("mechanic_id", "reds").order("data", { ascending: false }).order("hora", { ascending: false });
        if (!acessoTotalCentral && usuarioId) fallbackQuery = fallbackQuery.eq("tecnico_id", usuarioId);
        if (filtroDataInicio) fallbackQuery = fallbackQuery.gte("data", filtroDataInicio);
        if (filtroDataFim) fallbackQuery = fallbackQuery.lte("data", filtroDataFim);
        const res = await fallbackQuery;
        logs = res.data;
      }
      if (logs) {
        const logsReds = logs.filter((l) => {
          const ofc = (l.oficina_nome || "").toLowerCase();
          if (ofc && (ofc.includes("beach") || ofc.includes("vespucci") || ofc.includes("harmony") || ofc.includes("dudark") || ofc.includes("salt") || ofc.includes("lab"))) {
            return false;
          }
          if (l.mechanic_id && l.mechanic_id !== "reds") return false;
          return true;
        });
        setLogsTunagem(acessoTotalCentral ? logsReds : logsReds.filter(isLogDoUsuario));
      }
    } catch (e) {
      console.error("Erro ao carregar dados de tunagem:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [filtroDataInicio, filtroDataFim, acessoTotalCentral, usuarioId]);

  const podeDesbloquear = Boolean(
    acessoTotalCentral ||
    usuarioLogado?.role === "dono" ||
    usuarioLogado?.role === "admin" ||
    (typeof isAdminOuDono === "function" && isAdminOuDono(usuarioLogado?.role))
  );

  const handleDesbloquearRapido = async (log) => {
    if (!podeDesbloquear) return;
    const nomeVeic = log.veiculo_nome || "veículo";
    const placaVeic = log.placa ? ` (${log.placa})` : "";
    if (
      !window.confirm(
        `Atenção Dono/Admin: Deseja desbloquear a ficha de ${nomeVeic}${placaVeic}? Isso permitirá novo preenchimento e envio de cobrança ao Discord para corrigir eventuais erros.`
      )
    ) {
      return;
    }

    try {
      const targetUuid = log.uuid || log.id;
      if (targetUuid) {
        await supabase.from("logs_tunagem_reds").update({ cobrado: false }).eq("uuid", targetUuid);
        await supabase.from("logs_tunagem").update({ cobrado: false }).eq("uuid", targetUuid);
      }
      alert("🔓 Ficha de serviço desbloqueada com sucesso!");
      carregarDados();
    } catch (err) {
      console.error("Erro ao desbloquear serviço:", err);
      alert("Erro ao desbloquear: " + err.message);
    }
  };

  // Salvar vínculo de mecânico
  const salvarVinculoRapido = async () => {
    if (!modalVincularTecnico) return;
    try {
      const { error } = await supabase.from("mecanicos_vinculos").insert([{
        mecanico_id: modalVincularTecnico.id,
        mecanico_nome: modalVincularTecnico.nome,
        mecanica_id: vincularForm.mecanica_id,
        data_inicio: vincularForm.data_inicio
      }]);

      if (error) throw error;
      alert("✅ Técnico vinculado com sucesso à oficina!");
      setModalVincularTecnico(null);
      carregarDados();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar vínculo.");
    }
  };

  // Helper para identificar a oficina de um serviço
  const getMecanicaDoServico = (log) => {
    const dataServico = log.data;
    const tecId = String(log.tecnico_id);

    if (log.oficina_nome) {
      const lowerOficina = log.oficina_nome.toLowerCase();
      if (lowerOficina.includes("red")) {
        return mecanicas.find((m) => m.id === "reds") || { id: "reds", nome: "RED'S TUNERSHOP", cor: "#ec4899", icone: "🔴" };
      }
      if (lowerOficina.includes("beach") || lowerOficina.includes("vespucci")) {
        return mecanicas.find((m) => m.id === "vespucci") || { id: "vespucci", nome: "Vespucci Beach", cor: "#06b6d4", icone: "🌊" };
      }
      if (lowerOficina.includes("harmony")) {
        return mecanicas.find((m) => m.id === "harmony") || { id: "harmony", nome: "Harmony Repairs", cor: "#10b981", icone: "🌿" };
      }
      if (lowerOficina.includes("dudark") || lowerOficina.includes("salt") || lowerOficina.includes("lab")) {
        return mecanicas.find((m) => m.id === "dudark") || { id: "dudark", nome: "Dudark Garage", cor: "#f59e0b", icone: "⚡" };
      }
    }

    if (log.mechanic_id) {
      const mec = mecanicas.find((m) => m.id === log.mechanic_id);
      if (mec) return mec;
    }

    const vinc = vinculos.find((v) => {
      if (String(v.mecanico_id) !== tecId) return false;
      if (v.data_inicio && dataServico < v.data_inicio) return false;
      if (v.data_fim && dataServico > v.data_fim) return false;
      return true;
    });

    if (vinc) {
      const mec = mecanicas.find((m) => m.id === vinc.mecanica_id);
      if (mec) return mec;
    }

    return mecanicas.find((m) => m.id === "reds") || { id: "reds", nome: "RED'S TUNERSHOP", cor: "#ec4899", icone: "🔴" };
  };

  // Processamento e Agregação do Relatório Financeiro
  const relatorioMecanicos = useMemo(() => {
    const mapa = {};

    for (const log of logsTunagem) {
      const tecId = log.tecnico_id || "desconhecido";
      const tecNome = log.tecnico_nome || "Mecânico Sem Nome";
      const mec = getMecanicaDoServico(log);

      if (filtroMecanica !== "todas" && mec.id !== filtroMecanica) {
        continue;
      }

      if (!mapa[tecId]) {
        mapa[tecId] = {
          id: tecId,
          nome: tecNome,
          mecanica: mec,
          totalServicos: 0,
          totalValor: 0,
          servicos: []
        };
      }

      const valorCobrado = Number(log.valor_pago || log.valor_cobrado || 0);
      mapa[tecId].totalServicos += 1;
      mapa[tecId].totalValor += valorCobrado;
      mapa[tecId].servicos.push(log);
    }

    return Object.values(mapa).sort((a, b) => b.totalValor - a.totalValor);
  }, [logsTunagem, vinculos, mecanicas, filtroMecanica]);

  const totaisGerais = useMemo(() => {
    const totalServicos = relatorioMecanicos.reduce((acc, m) => acc + m.totalServicos, 0);
    const totalFaturado = relatorioMecanicos.reduce((acc, m) => acc + m.totalValor, 0);
    const totalRepasse = totalFaturado * (porcentagemRepasse / 100);
    return { totalServicos, totalFaturado, totalRepasse };
  }, [relatorioMecanicos, porcentagemRepasse]);

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Topo / Header da Página */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "900", color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
            🚗 Central de Tunagens & Repasses
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: theme.subtext }}>
            {acessoTotalCentral
              ? "Auditoria automática, precificação exata de modificações e repasses por oficina."
              : "Consulte as fichas dos serviços realizados por você."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {Boolean(isAdminOuDono && isAdminOuDono(usuarioLogado?.role)) && (
            <button
              onClick={toggleNotificarTodasTunagens}
              style={{
                background: notificarTodasTunagens ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                border: `1px solid ${notificarTodasTunagens ? "#22c55e" : "#ef4444"}`,
                padding: "10px 16px",
                borderRadius: "12px",
                color: notificarTodasTunagens ? "#4ade80" : "#f87171",
                fontWeight: "800",
                cursor: "pointer",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              {notificarTodasTunagens ? "🔔 Alertas da Equipe: ATIVADOS" : "🔕 Alertas da Equipe: SILENCIADOS"}
            </button>
          )}

          {acessoTotalCentral && <button
            onClick={() => setAbaAtiva("importar")}
            style={{
              background: "rgba(16,185,129,0.15)",
              border: "1px solid #10b981",
              padding: "10px 16px",
              borderRadius: "12px",
              color: "#34d399",
              fontWeight: "800",
              cursor: "pointer",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            📥 Importar Logs (.JSON)
          </button>}

          <button
            onClick={carregarDados}
            style={{
              background: theme.card2,
              border: `1px solid ${theme.border}`,
              padding: "10px 16px",
              borderRadius: "12px",
              color: theme.text,
              fontWeight: "700",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            🔄 Atualizar
          </button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div style={{ display: "flex", gap: "8px", borderBottom: `1px solid ${theme.border}`, paddingBottom: "12px", flexWrap: "wrap" }}>
        {[
          { id: "relatorio", label: "📊 Relatório & Repasses", cor: "#ec4899" },
          { id: "ficha", label: "⚡ Ficha Rápida / Orçamento", cor: "#f59e0b" },
          { id: "logs", label: `🚗 Logs de Tunagem (${logsTunagem.length})`, cor: "#8b5cf6" },
          { id: "quadros", label: `👥 Quadros de Mecânicos (${vinculos.filter((v) => !v.data_fim).length} ativos)`, cor: "#3b82f6" },
          { id: "importar", label: "📥 Importar JSON / Discord", cor: "#10b981" }
        ].filter((aba) => acessoTotalCentral || aba.id === "logs").map((aba) => {
          const ativo = abaAtiva === aba.id;
          return (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              style={{
                background: ativo ? `rgba(236,72,153,0.15)` : "transparent",
                border: ativo ? `1px solid ${aba.cor}` : `1px solid ${theme.border}`,
                color: ativo ? aba.cor : theme.subtext,
                padding: "10px 18px",
                borderRadius: "10px",
                fontWeight: "800",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              {aba.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ABA: RELATÓRIO & REPASSES */}
      {/* ========================================================================= */}
      {acessoTotalCentral && abaAtiva === "relatorio" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Barra de Filtros */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "16px 20px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                onClick={() => setTipoPeriodo("semana")}
                style={{ background: tipoPeriodo === "semana" ? "#ec4899" : theme.card2, border: "none", color: "#fff", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
              >
                📅 Semana
              </button>
              <button
                onClick={() => setTipoPeriodo("hoje")}
                style={{ background: tipoPeriodo === "hoje" ? "#ec4899" : theme.card2, border: "none", color: "#fff", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
              >
                Hoje
              </button>
              <button
                onClick={() => setTipoPeriodo("mes")}
                style={{ background: tipoPeriodo === "mes" ? "#ec4899" : theme.card2, border: "none", color: "#fff", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
              >
                Mês
              </button>
            </div>

            {tipoPeriodo === "semana" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setOffsetSemana((prev) => prev - 1)}
                  style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "4px 10px", borderRadius: "6px", cursor: "pointer" }}
                >
                  ◀
                </button>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#fff" }}>{semanaInfo.label}</span>
                <button
                  onClick={() => setOffsetSemana((prev) => prev + 1)}
                  style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "4px 10px", borderRadius: "6px", cursor: "pointer" }}
                >
                  ▶
                </button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
              <label style={{ fontSize: "12px", color: theme.subtext }}>Oficina:</label>
              <select
                value={filtroMecanica}
                onChange={(e) => setFiltroMecanica(e.target.value)}
                style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "6px 12px", borderRadius: "8px", fontSize: "12px" }}
              >
                <option value="todas">Todas as Oficinas</option>
                {mecanicas.map((m) => (
                  <option key={m.id} value={m.id}>{m.icone} {m.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards de Métricas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase" }}>🚗 Serviços Realizados</div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: "#fff", marginTop: "4px" }}>{totaisGerais.totalServicos}</div>
            </div>

            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase" }}>💰 Faturamento Total</div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: "#4ade80", marginTop: "4px" }}>
                R$ {totaisGerais.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <div style={{
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: `1px solid ${theme.border}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "12px"
              }}>
                <span style={{ color: theme.subtext, fontWeight: "600" }}>80% do montante:</span>
                <span style={{ color: "#38bdf8", fontWeight: "800", fontSize: "13px" }}>
                  R$ {(totaisGerais.totalFaturado * 0.8).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase" }}>👥 Mecânicos Ativos</div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: "#38bdf8", marginTop: "4px" }}>{relatorioMecanicos.length}</div>
            </div>
          </div>

          {/* Tabela de Mecânicos */}
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${theme.border}` }}>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext }}>MECÂNICO</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext }}>OFICINA ATRIBUÍDA</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext, textAlign: "center" }}>QTD TUNAGENS</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext, textAlign: "right" }}>VALOR TOTAL</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext, textAlign: "center" }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {relatorioMecanicos.map((m) => (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: "14px 20px", fontWeight: "800", color: "#fff" }}>
                      {m.nome} <span style={{ fontSize: "12px", color: theme.subtext }}>(ID: {m.id})</span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ background: `${m.mecanica.cor}22`, border: `1px solid ${m.mecanica.cor}`, color: m.mecanica.cor, padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "800" }}>
                        {m.mecanica.icone} {m.mecanica.nome}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "center", fontWeight: "800" }}>{m.totalServicos}</td>
                    <td style={{ padding: "14px 20px", textAlign: "right", fontWeight: "900", color: "#4ade80" }}>
                      R$ {m.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "center" }}>
                      <button
                        onClick={() => setModalMecanicoLogs({ tecnico: m, mecanica: m.mecanica, logs: m.servicos })}
                        style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: "#fff", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                      >
                        🔍 Ver Serviços
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA: FICHA RÁPIDA / ORÇAMENTO INSTANTÂNEO */}
      {/* ========================================================================= */}
      {acessoTotalCentral && abaAtiva === "ficha" && (() => {
        const parsed = parseLogsTunagemTexto(textoLogFicha);
        const logAtual = parsed[0] || null;
        const analise = logAtual ? analisarServicoTunagem(logAtual.antes_json || {}, logAtual.depois_json || {}, logAtual.valor_pago || 0) : null;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "800", color: "#f59e0b", display: "flex", alignItems: "center", gap: "8px" }}>
                ⚡ Ficha Rápida & Auditoria de Modificações
              </h3>
              <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: theme.subtext }}>
                Cole o log bruto do FiveM / GTA V ou o texto da comanda para calcular automaticamente o valor a cobrar do cliente e gerar a ficha de cobrança.
              </p>

              <textarea
                rows={6}
                value={textoLogFicha}
                onChange={(e) => setTextoLogFicha(e.target.value)}
                placeholder="Cole aqui o texto do log de tunagem (ex: [Oficina]: RED'S TUNERSHOP [Técnico]: Nome (ID: 123) [Veículo]: Banshee [Antes]: {...} [Depois]: {...} [Valor Pago]: R$ 3000)..."
                style={{
                  width: "100%",
                  background: theme.card2,
                  border: `1px solid ${theme.border}`,
                  color: "#fff",
                  padding: "14px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  outline: "none",
                  resize: "vertical"
                }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", flexWrap: "wrap", gap: "10px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: logAtual || textoLogFicha ? "600" : "400",
                    color: logAtual ? "#4ade80" : textoLogFicha ? "#fbbf24" : theme.subtext
                  }}
                >
                  {logAtual
                    ? "✅ Log / JSON identificado e calculado com sucesso!"
                    : textoLogFicha
                    ? "⚠️ JSON incompleto ou não identificado. Certifique-se de fechar as chaves {...} do JSON ou colar o log completo."
                    : "Aguardando colagem de log bruto ou JSON de modificações..."}
                </span>

                <div style={{ display: "flex", gap: "8px" }}>
                  {logAtual && (
                    <button
                      onClick={() => setModalLogDetalhe(logAtual)}
                      style={{
                        background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
                        border: "none",
                        color: "#fff",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        fontWeight: "800",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      🚀 Abrir em Modal & Anexar Foto
                    </button>
                  )}
                  {textoLogFicha && (
                    <button
                      onClick={() => setTextoLogFicha("")}
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        border: "1px solid #ef4444",
                        color: "#f87171",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        fontWeight: "700",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Resultado do Log Colado */}
            {logAtual && analise && (
              <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderBottom: `1px solid ${theme.border}`, paddingBottom: "14px" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#fff" }}>
                      🚗 {logAtual.veiculo_nome} <span style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "13px" }}>({logAtual.placa})</span>
                    </h4>
                    <div style={{ fontSize: "12px", color: theme.subtext, marginTop: "4px" }}>
                      🧑‍🔧 Técnico: <b>{logAtual.tecnico_nome}</b> {logAtual.tecnico_id ? `(ID: ${logAtual.tecnico_id})` : ""} · 👤 Dono: <b>{logAtual.dono_nome || "—"}</b>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", color: "#4ade80", fontWeight: "800", textTransform: "uppercase" }}>💰 Total a Cobrar</div>
                    <div style={{ fontSize: "22px", fontWeight: "900", color: "#4ade80" }}>
                      R$ {analise.totalACobrar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase" }}>
                    📋 Modificações Detectadas ({analise.itensCobrados.length} itens):
                  </div>

                  {analise.itensCobrados.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: theme.subtext, fontSize: "13px" }}>
                      Nenhuma peça identificada para cobrança (sem alterações em relação ao padrão).
                    </div>
                  ) : (
                    analise.itensCobrados.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: theme.card2,
                          border: `1px solid ${theme.border}`,
                          borderRadius: "10px",
                          padding: "10px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "18px" }}>{item.icone || "🛠️"}</span>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: "800", color: "#fff" }}>{item.descricao}</div>
                            {item.detalhe && <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>{item.detalhe}</div>}
                          </div>
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: "900", color: "#4ade80" }}>
                          R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* ABA: LOGS DE TUNAGEM */}
      {/* ========================================================================= */}
      {abaAtiva === "logs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "16px 20px" }}>
            <input
              type="text"
              placeholder="Buscar por placa, mecânico, cliente ou veículo..."
              value={buscaLogs}
              onChange={(e) => setBuscaLogs(e.target.value)}
              style={{ width: "100%", background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "10px 14px", borderRadius: "10px", fontSize: "13px" }}
            />
          </div>

          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${theme.border}` }}>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext }}>DATA & HORA</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext }}>TÉCNICO</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext }}>CLIENTE</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext }}>VEÍCULO & PLACA</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext, textAlign: "right" }}>VALOR</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext, textAlign: "center" }}>STATUS</th>
                  <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "800", color: theme.subtext, textAlign: "center" }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {logsTunagem
                  .filter((l) => {
                    if (!buscaLogs) return true;
                    const b = buscaLogs.toLowerCase();
                    return (
                      (l.placa && l.placa.toLowerCase().includes(b)) ||
                      (l.tecnico_nome && l.tecnico_nome.toLowerCase().includes(b)) ||
                      (l.dono_nome && l.dono_nome.toLowerCase().includes(b)) ||
                      (l.veiculo_nome && l.veiculo_nome.toLowerCase().includes(b))
                    );
                  })
                  .map((log) => {
                    const isCobrado = Boolean(log.cobrado);
                    return (
                      <tr
                        key={log.uuid}
                        style={{
                          borderBottom: `1px solid ${theme.border}`,
                          background: isCobrado ? "rgba(34, 197, 94, 0.02)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "14px 20px", fontSize: "12px", color: theme.subtext }}>
                          {log.data} {log.hora}
                        </td>
                        <td style={{ padding: "14px 20px", fontWeight: "700", color: "#fff" }}>
                          {log.tecnico_nome}
                        </td>
                        <td style={{ padding: "14px 20px", color: theme.subtext }}>
                          {log.dono_nome || "—"}
                        </td>
                        <td style={{ padding: "14px 20px", fontWeight: "800", color: "#38bdf8" }}>
                          {log.veiculo_nome} <span style={{ fontSize: "11px", color: theme.subtext }}>({log.placa})</span>
                        </td>
                        <td style={{ padding: "14px 20px", textAlign: "right", fontWeight: "900", color: "#4ade80" }}>
                          R$ {Number(log.valor_pago || log.valor_cobrado || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "14px 20px", textAlign: "center" }}>
                          {isCobrado ? (
                            <span
                              style={{
                                background: "rgba(34, 197, 94, 0.15)",
                                border: "1px solid #22c55e",
                                color: "#4ade80",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "800",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              ✅ Finalizado
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "rgba(245, 158, 11, 0.15)",
                                border: "1px solid #f59e0b",
                                color: "#fbbf24",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "800",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              ⏳ Pendente
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 20px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <button
                              onClick={() => setModalLogDetalhe(log)}
                              style={{
                                background: isCobrado
                                  ? "rgba(255,255,255,0.08)"
                                  : "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
                                border: isCobrado ? `1px solid ${theme.border}` : "none",
                                color: "#fff",
                                padding: "6px 14px",
                                borderRadius: "8px",
                                fontSize: "12px",
                                fontWeight: "800",
                                cursor: "pointer"
                              }}
                            >
                              {isCobrado ? "🔍 Ver Ficha" : "⚡ Abrir Ficha"}
                            </button>
                            {isCobrado && podeDesbloquear && (
                              <button
                                onClick={() => handleDesbloquearRapido(log)}
                                title="Desbloquear serviço para permitir novo registro em caso de erro"
                                style={{
                                  background: "rgba(239,68,68,0.12)",
                                  border: "1px solid rgba(239,68,68,0.3)",
                                  color: "#f87171",
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  fontWeight: "800",
                                  cursor: "pointer"
                                }}
                              >
                                🔓 Desbloquear
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA: QUADROS DE MECÂNICOS */}
      {/* ========================================================================= */}
      {acessoTotalCentral && abaAtiva === "quadros" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {mecanicas.map((mec) => {
              const vinculados = vinculos.filter((v) => v.mecanica_id === mec.id && !v.data_fim);
              return (
                <div key={mec.id} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: mec.cor, display: "flex", alignItems: "center", gap: "8px" }}>
                    {mec.icone} {mec.nome}
                  </h3>
                  <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {vinculados.length === 0 ? (
                      <div style={{ fontSize: "12px", color: theme.subtext }}>Nenhum mecânico vinculado</div>
                    ) : (
                      vinculados.map((v) => (
                        <div key={v.id} style={{ background: theme.card2, padding: "8px 12px", borderRadius: "8px", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: "700", color: "#fff" }}>{v.mecanico_nome}</span>
                          <span style={{ color: theme.subtext }}>ID: {v.mecanico_id}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETALHES DE TUNAGEM (EXTRATO DISCRIMINADO & ENVIO AO DISCORD) */}
      {/* ========================================================================= */}
      <ModalDetalheTunagem
        theme={theme}
        modalLogDetalhe={modalLogDetalhe}
        setModalLogDetalhe={setModalLogDetalhe}
        usuarioLogado={usuarioLogado}
        podeVerJsonBruto={acessoTotalCentral}
        onConcluido={() => carregarDados()}
      />

      {/* ========================================================================= */}
      {/* ABA: IMPORTADOR DE LOGS DISCORD (.JSON / TEXTO) */}
      {/* ========================================================================= */}
      {acessoTotalCentral && abaAtiva === "importar" && (
        <ImportadorLogsTunagem
          theme={theme}
          styles={styles}
          onImportacaoConcluida={() => {
            carregarDados();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* BANNER FLUTUANTE DE NOTIFICAÇÃO REALTIME DENTRO DA PÁGINA */}
      {/* ========================================================================= */}
      {notificacaoRealtime && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 10001,
            background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
            border: "2px solid #ec4899",
            borderRadius: "16px",
            padding: "16px 20px",
            boxShadow: "0 10px 30px rgba(236,72,153,0.4), 0 0 20px rgba(0,0,0,0.8)",
            maxWidth: "420px",
            animation: "fadeIn 0.3s ease-out",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "24px" }}>🚗</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", fontWeight: "900", color: "#f472b6", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {notificacaoRealtime.isMeu ? "🔔 Nova Tunagem Realizada por Você!" : "🔔 Nova Tunagem da Equipe"}
                  </span>
                  {!notificacaoRealtime.isMeu && (
                    <span style={{ fontSize: "10px", background: "rgba(236,72,153,0.25)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.5)", padding: "1px 6px", borderRadius: "6px", fontWeight: "800" }}>
                      👑 DONO / ADMIN
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "14px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
                  {notificacaoRealtime.log.veiculo_nome} <span style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "12px" }}>({notificacaoRealtime.log.placa})</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setNotificacaoRealtime(null)}
              style={{ background: "transparent", border: "none", color: theme.subtext, fontSize: "18px", cursor: "pointer", padding: "0 4px" }}
              title="Fechar"
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.3)", padding: "8px 12px", borderRadius: "8px" }}>
            <span style={{ fontSize: "12px", color: theme.subtext }}>
              🧑‍🔧 {notificacaoRealtime.log.tecnico_nome}
            </span>
            <span style={{ fontSize: "13px", fontWeight: "900", color: "#4ade80" }}>
              R$ {notificacaoRealtime.analise.totalACobrar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <button
            onClick={() => {
              setModalLogDetalhe(notificacaoRealtime.log);
              setNotificacaoRealtime(null);
            }}
            style={{
              background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
              border: "none",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: "10px",
              fontWeight: "900",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 14px rgba(236,72,153,0.35)"
            }}
          >
            ⚡ Abrir Ficha & Inserir Foto
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LISTAGEM DE TUNAGENS DE UM MECÂNICO */}
      {/* ========================================================================= */}
      {modalMecanicoLogs && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: theme.card, width: "100%", maxWidth: "920px", borderRadius: "20px", border: `1px solid ${theme.border}`, overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", background: theme.card2, borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800" }}>
                    🚗 Tunagens de {modalMecanicoLogs.tecnico.nome}
                  </h3>
                  <span style={{ background: `${modalMecanicoLogs.mecanica.cor}22`, border: `1px solid ${modalMecanicoLogs.mecanica.cor}`, color: modalMecanicoLogs.mecanica.cor, padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "800" }}>
                    {modalMecanicoLogs.mecanica.icone} {modalMecanicoLogs.mecanica.nome}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: theme.subtext, marginTop: "4px" }}>
                  ID: <b style={{ color: theme.text }}>{modalMecanicoLogs.tecnico.id}</b> · <b>{modalMecanicoLogs.tecnico.totalServicos}</b> serviços no período · Total a Repassar: <b style={{ color: "#4ade80" }}>R$ {modalMecanicoLogs.tecnico.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b>
                </div>
              </div>
              <button
                onClick={() => setModalMecanicoLogs(null)}
                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.border}`, color: theme.text, padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: "800", fontSize: "11px" }}
              >
                FECHAR
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${theme.border}` }}>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: "800", color: theme.subtext }}>DATA & HORA</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: "800", color: theme.subtext }}>DONO / CLIENTE</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: "800", color: theme.subtext }}>VEÍCULO & PLACA</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: "800", color: theme.subtext, textAlign: "right" }}>VALOR PAGO</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: "800", color: theme.subtext, textAlign: "center" }}>STATUS</th>
                    <th style={{ padding: "12px 16px", fontSize: "11px", fontWeight: "800", color: theme.subtext, textAlign: "center" }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {modalMecanicoLogs.logs.map((log) => {
                    const isCobrado = Boolean(log.cobrado);
                    return (
                      <tr
                        key={log.uuid}
                        onClick={() => setModalLogDetalhe(log)}
                        style={{ borderBottom: `1px solid ${theme.border}`, cursor: "pointer", transition: "background 0.2s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: theme.subtext }}>{log.data} {log.hora}</td>
                        <td style={{ padding: "12px 16px" }}>{log.dono_nome || "—"}</td>
                        <td style={{ padding: "12px 16px", fontWeight: "800", color: "#38bdf8" }}>{log.veiculo_nome} ({log.placa})</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "900", color: "#4ade80" }}>
                          R$ {Number(log.valor_pago || log.valor_cobrado || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          {isCobrado ? (
                            <span style={{ background: "rgba(34,197,94,0.15)", border: "1px solid #22c55e", color: "#4ade80", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" }}>
                              ✅ Finalizado
                            </span>
                          ) : (
                            <span style={{ background: "rgba(245,158,11,0.15)", border: "1px solid #f59e0b", color: "#fbbf24", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" }}>
                              ⏳ Pendente
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalLogDetalhe(log);
                            }}
                            style={{
                              background: isCobrado ? "rgba(255,255,255,0.08)" : "rgba(56, 189, 248, 0.12)",
                              border: isCobrado ? `1px solid ${theme.border}` : "1px solid rgba(56, 189, 248, 0.3)",
                              color: isCobrado ? "#fff" : "#38bdf8",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "800",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px"
                            }}
                          >
                            {isCobrado ? "🔍 Ver Ficha" : "⚡ Abrir Ficha"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
