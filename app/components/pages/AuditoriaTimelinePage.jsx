"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../utils/supabaseClient";

// Configurações visuais por mecânica
const MECANICAS = [
  { id: "reds", label: "Red's Tunershop", cor: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", icon: "🔴" },
  { id: "vespucci", label: "Vespucci", cor: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", icon: "🔵" },
  { id: "harmony", label: "Harmony", cor: "#eab308", bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.35)", icon: "🟡" },
  { id: "dudark", label: "Dudark", cor: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.35)", icon: "🟣" },
];

const fmtHora = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
};

const fmtDataHora = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
};

const fmtDuracao = (minutos) => {
  if (minutos === null || minutos === undefined) return "—";
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
};

const fmtDinheiro = (v) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
};

export default function AuditoriaTimelinePage({ theme, styles, usuarioLogado }) {
  // Filtros Globais
  const [mecanicaSelecionada, setMecanicaSelecionada] = useState("reds");
  const [filtroPeriodo, setFiltroPeriodo] = useState("30d"); // hoje | ontem | 7d | 15d | 30d | custom
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0]);
  const [buscaMecanico, setBuscaMecanico] = useState("");
  const [filtroAnomalia, setFiltroAnomalia] = useState("todas"); // todas | suspeitas | sem_saida | gap_longo | longa | ajustadas

  // Dados
  const [sessoesPonto, setSessoesPonto] = useState([]);
  const [carregandoSessoes, setCarregandoSessoes] = useState(false);
  const [sessaoAtiva, setSessaoAtiva] = useState(null);

  // Timeline do mecânico
  const [timelineEventos, setTimelineEventos] = useState([]);
  const [carregandoTimeline, setCarregandoTimeline] = useState(false);

  // Ações Manuais / Modais
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [toastMensagem, setToastMensagem] = useState(null);
  const [modalHorarioManual, setModalHorarioManual] = useState(false);
  const [horarioManualInput, setHorarioManualInput] = useState("");
  const [motivoManualInput, setMotivoManualInput] = useState("");

  const mostrarToast = (msg, tipo = "sucesso") => {
    setToastMensagem({ msg, tipo });
    setTimeout(() => setToastMensagem(null), 3500);
  };

  const executarSincronizacao = async () => {
    setSincronizando(true);
    try {
      const res = await fetch("/api/sincronizar-unificadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dias: 3 }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Falha na sincronização");

      const { tunagens, bancada, bau, pontos, ajustesPreservados } = data.relatorio || {};
      mostrarToast(
        `⚡ Sincronizado: ${pontos || 0} pontos, ${tunagens || 0} tunagens, ${bancada || 0} bancadas, ${bau || 0} baú!`,
        "sucesso"
      );
      await carregarSessoes();
      if (sessaoAtiva) {
        await carregarTimeline(sessaoAtiva);
      }
    } catch (err) {
      console.error("Erro ao sincronizar:", err);
      mostrarToast(err.message || "Erro ao sincronizar dados do Discord.", "erro");
    } finally {
      setSincronizando(false);
    }
  };

  // Helper para datas por preset
  const alterarPeriodoPreset = (preset) => {
    setFiltroPeriodo(preset);
    const hoje = new Date();
    const formatar = (d) => d.toISOString().split("T")[0];

    if (preset === "hoje") {
      const hStr = formatar(hoje);
      setDataInicio(hStr);
      setDataFim(hStr);
    } else if (preset === "ontem") {
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      const oStr = formatar(ontem);
      setDataInicio(oStr);
      setDataFim(oStr);
    } else if (preset === "7d") {
      const d = new Date(hoje.getTime() - 7 * 24 * 3600 * 1000);
      setDataInicio(formatar(d));
      setDataFim(formatar(hoje));
    } else if (preset === "15d") {
      const d = new Date(hoje.getTime() - 15 * 24 * 3600 * 1000);
      setDataInicio(formatar(d));
      setDataFim(formatar(hoje));
    } else if (preset === "30d") {
      const d = new Date(hoje.getTime() - 30 * 24 * 3600 * 1000);
      setDataInicio(formatar(d));
      setDataFim(formatar(hoje));
    }
  };

  // 1. CARREGAR SESSÕES DE PONTO
  const carregarSessoes = useCallback(async () => {
    setCarregandoSessoes(true);
    try {
      const res = await fetch(
        `/api/ponto/sessoes?mecanica=${encodeURIComponent(mecanicaSelecionada)}&inicio=${encodeURIComponent(dataInicio)}&fim=${encodeURIComponent(dataFim)}`
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Falha ao buscar sessões");

      setSessoesPonto(json.data || []);

      // Se havia uma sessão ativa, atualiza seus dados caso ainda esteja na lista
      if (sessaoAtiva) {
        const atualizada = (json.data || []).find((s) => s.id === sessaoAtiva.id);
        if (atualizada) setSessaoAtiva(atualizada);
      }
    } catch (e) {
      console.error("Erro ao carregar sessões de log_ponto:", e);
      mostrarToast(`Erro ao carregar sessões: ${e.message || "Falha na requisição"}`, "erro");
    } finally {
      setCarregandoSessoes(false);
    }
  }, [mecanicaSelecionada, dataInicio, dataFim, sessaoAtiva?.id]);

  useEffect(() => {
    carregarSessoes();
  }, [mecanicaSelecionada, dataInicio, dataFim]);

  // 2. DIAGNÓSTICO DE ANOMALIAS DAS SESSÕES
  const sessoesClassificadas = useMemo(() => {
    return sessoesPonto.map((s) => {
      const totalMin = Number(s.total_minutos) || 0;
      const semSaida = !s.saida || s.tipo_fechamento === "EM_ABERTO";
      const fechadoCrash = s.tipo_fechamento && s.tipo_fechamento.includes("CRASH");
      const reinicio09h = s.tipo_fechamento && s.tipo_fechamento.includes("REINICIO_09H");
      const ajustadoManual = s.tipo_fechamento === "AJUSTE_MANUAL";

      // Gap de inatividade suspeito: ponto com mais de 3 horas mas pouca ou nenhuma atividade comprovada
      const gapSuspeito = totalMin > 180 && (s.total_atividades || 0) <= 1;
      const duracaoExcessiva = totalMin > 360; // Mais de 6 horas
      const duploClique = totalMin < 2 && s.tipo_fechamento === "DUPLO_CLIQUE_CANCELADO";

      let anomaliaTipo = null;
      let anomaliaTexto = null;

      if (ajustadoManual) {
        anomaliaTipo = "ajustado";
        anomaliaTexto = "Ajustado Manualmente";
      } else if (semSaida) {
        anomaliaTipo = "sem_saida";
        anomaliaTexto = "Ponto Sem Saída Batida";
      } else if (fechadoCrash) {
        anomaliaTipo = "fechado_crash";
        anomaliaTexto = "Fechado por Crash/Inatividade";
      } else if (reinicio09h) {
        anomaliaTipo = "reinicio_09h";
        anomaliaTexto = "Fechado no Reinício das 09h";
      } else if (gapSuspeito) {
        anomaliaTipo = "gap_longo";
        anomaliaTexto = "Ponto Longo sem Atividades Comprovadas";
      } else if (duracaoExcessiva) {
        anomaliaTipo = "longa";
        anomaliaTexto = "Duração Excessiva (> 6h)";
      } else if (duploClique) {
        anomaliaTipo = "duplo_clique";
        anomaliaTexto = "Duplo Clique Cancelado";
      }

      const ehSuspeita = Boolean(anomaliaTipo && anomaliaTipo !== "ajustado");

      return {
        ...s,
        ehSuspeita,
        anomaliaTipo,
        anomaliaTexto,
      };
    });
  }, [sessoesPonto]);

  // Filtragem na lista de sessões
  const sessoesFiltradas = useMemo(() => {
    return sessoesClassificadas.filter((s) => {
      // Filtro de busca de texto
      if (buscaMecanico.trim()) {
        const q = buscaMecanico.toLowerCase();
        const bateNome = s.nome && s.nome.toLowerCase().includes(q);
        const bateId = String(s.usuario_id).includes(q);
        if (!bateNome && !bateId) return false;
      }

      // Filtro por anomalia
      if (filtroAnomalia === "suspeitas") return s.ehSuspeita;
      if (filtroAnomalia === "sem_saida") return s.anomaliaTipo === "sem_saida";
      if (filtroAnomalia === "gap_longo") return s.anomaliaTipo === "gap_longo";
      if (filtroAnomalia === "longa") return s.anomaliaTipo === "longa";
      if (filtroAnomalia === "ajustadas") return s.anomaliaTipo === "ajustado";

      return true;
    });
  }, [sessoesClassificadas, buscaMecanico, filtroAnomalia]);

  // 3. CARREGAR TIMELINE CRONOLÓGICA DO MECÂNICO NO DIA
  const carregarTimeline = useCallback(async (sessao) => {
    if (!sessao) return;
    setCarregandoTimeline(true);
    setSessaoAtiva(sessao);

    const usuarioId = sessao.usuario_id;
    const dataDia = sessao.data;
    const mecanicaId = sessao.mecanica_id;

    // Janela de busca: do início do dia até o final do dia (com margem de 1 dia para pegar sessões noturnas)
    const diaDate = new Date(`${dataDia}T00:00:00-03:00`);
    const diaSeguinte = new Date(diaDate.getTime() + 36 * 3600 * 1000);
    const inicioBusca = diaDate.toISOString();
    const fimBusca = diaSeguinte.toISOString();

    try {
      const res = await fetch(
        `/api/ponto/timeline?mecanica_id=${encodeURIComponent(mecanicaId)}&usuario_id=${encodeURIComponent(usuarioId)}&inicio=${encodeURIComponent(inicioBusca)}&fim=${encodeURIComponent(fimBusca)}`
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Falha ao carregar linha do tempo");

      const eventos = [];

      // Mapear Pontos
      (json.pontos || []).forEach((p) => {
        eventos.push({
          id: `ponto_ent_${p.id}`,
          sessaoId: p.id,
          tipo: "PONTO_ENTRADA",
          timestamp: p.entrada,
          titulo: "🟢 Entrou em Serviço",
          descricao: `Ponto iniciado no Discord / FiveM`,
          uuid: p.uuid_entrada,
          isCurrentSession: p.id === sessao.id,
          podeSerSaida: false,
        });

        if (p.saida) {
          eventos.push({
            id: `ponto_sai_${p.id}`,
            sessaoId: p.id,
            tipo: "PONTO_SAIDA",
            timestamp: p.saida,
            titulo: p.tipo_fechamento === "AJUSTE_MANUAL" ? "🔧 Saída Ajustada Manualmente" : "🔴 Saiu de Serviço",
            descricao: `Fechamento: ${p.tipo_fechamento || "NORMAL"} (${fmtDuracao(p.total_minutos)})`,
            uuid: p.uuid_saida,
            isCurrentSession: p.id === sessao.id,
            podeSerSaida: true,
          });
        }
      });

      // Mapear Tunagens
      (json.tunagens || []).forEach((t) => {
        eventos.push({
          id: `tun_${t.uuid}`,
          tipo: "TUNAGEM",
          timestamp: t.timestampz,
          titulo: `🚗 Tunagem: ${t.veiculo_nome || t.veiculo_modelo || "Veículo"}`,
          descricao: `Cliente: ${t.dono_nome || "—"} | Placa: ${t.placa || "—"} | Cobrado: ${fmtDinheiro(t.valor_pago)}`,
          uuid: t.uuid,
          fotoUrl: t.foto_url,
          podeSerSaida: true,
        });
      });

      // Mapear Bancada
      (json.bancada || []).forEach((b) => {
        eventos.push({
          id: `banc_${b.uuid}`,
          tipo: "BANCADA",
          timestamp: b.timestampz,
          titulo: `🛠️ Bancada: ${b.item_craftado}`,
          descricao: `Produziu ${b.quantidade}x unidades`,
          uuid: b.uuid,
          podeSerSaida: true,
        });
      });

      // Mapear Baú
      (json.bau || []).forEach((bau) => {
        const isGuardou = bau.acao === "GUARDOU";
        eventos.push({
          id: `bau_${bau.uuid}`,
          tipo: "BAU",
          timestamp: bau.timestampz,
          titulo: `📦 Baú: ${isGuardou ? "Guardou" : "Retirou"} ${bau.item}`,
          descricao: `Ação registrada no baú (${bau.acao})`,
          uuid: bau.uuid,
          podeSerSaida: true,
        });
      });

      // Ordenar rigorosamente cronológico com desempate semântico
      // Se dois eventos têm o mesmo segundo, a ordem natural é:
      // Entrada (1) -> Ações de serviço (Baú: 2, Bancada: 3, Tunagem: 4) -> Saída (5)
      const PRIORIDADE_TIPO = {
        PONTO_ENTRADA: 1,
        BAU: 2,
        BANCADA: 3,
        TUNAGEM: 4,
        PONTO_SAIDA: 5,
      };

      eventos.sort((a, b) => {
        const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (diff !== 0) return diff;
        const pA = PRIORIDADE_TIPO[a.tipo] || 3;
        const pB = PRIORIDADE_TIPO[b.tipo] || 3;
        return pA - pB;
      });

      // Calcular gaps entre eventos consecutivos
      const eventosComGap = [];
      for (let i = 0; i < eventos.length; i++) {
        const ev = eventos[i];
        if (i > 0) {
          const anterior = eventos[i - 1];
          const diffMin = Math.round((new Date(ev.timestamp) - new Date(anterior.timestamp)) / 60000);
          if (diffMin > 45) {
            eventosComGap.push({
              isGap: true,
              id: `gap_${i}`,
              minutos: diffMin,
              texto: `⏳ Intervalo de ${fmtDuracao(diffMin)} sem nenhum log registrado`,
            });
          }
        }
        eventosComGap.push(ev);
      }

      setTimelineEventos(eventosComGap);
    } catch (e) {
      console.error("Erro ao carregar timeline:", e);
      mostrarToast("Erro ao carregar linha do tempo do mecânico.", "erro");
    } finally {
      setCarregandoTimeline(false);
    }
  }, []);

  // 4. AÇÃO: DEFINIR SAÍDA COM 1 CLIQUE
  const aplicarSaidaManual = async (targetTimestamp, motivoOrigem, uuidOrigem = null) => {
    if (!sessaoAtiva) return;
    setSalvandoAjuste(true);

    const dEntrada = new Date(sessaoAtiva.entrada);
    const dSaida = new Date(targetTimestamp);

    if (dSaida <= dEntrada) {
      mostrarToast("A saída precisa ser posterior à entrada da sessão!", "alerta");
      setSalvandoAjuste(false);
      return;
    }

    const diffSeg = Math.max(0, Math.round((dSaida - dEntrada) / 1000));
    const diffMin = Math.round(diffSeg / 60);

    const nomeAdmin = usuarioLogado?.nome || "Admin";
    const obs = `Ajustado manualmente por ${nomeAdmin} com base em: ${motivoOrigem}${uuidOrigem ? ` [${uuidOrigem}]` : ""}.`;

    try {
      const res = await fetch("/api/ponto/ajustar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessaoId: sessaoAtiva.id,
          saida: dSaida.toISOString(),
          uuidSaida: uuidOrigem || `MANUAL_${Date.now()}`,
          totalMinutos: diffMin,
          totalSegundos: diffSeg,
          observacao: obs,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Erro ao salvar ajuste");

      mostrarToast(`✅ Ponto de ${sessaoAtiva.nome} ajustado para ${fmtDuracao(diffMin)} com sucesso!`, "sucesso");

      // Recarrega a sessão e a timeline
      const sessaoAtualizada = {
        ...sessaoAtiva,
        saida: dSaida.toISOString(),
        tipo_fechamento: "AJUSTE_MANUAL",
        total_minutos: diffMin,
        total_segundos: diffSeg,
        observacao: obs,
        anomaliaTipo: "ajustado",
        anomaliaTexto: "Ajustado Manualmente",
        ehSuspeita: false,
      };

      setSessaoAtiva(sessaoAtualizada);
      await carregarSessoes();
      await carregarTimeline(sessaoAtualizada);
    } catch (e) {
      console.error("Erro ao aplicar saída manual:", e);
      mostrarToast("Erro ao gravar ajuste manual no banco.", "erro");
    } finally {
      setSalvandoAjuste(false);
      setModalHorarioManual(false);
    }
  };

  // 5. AÇÃO: APLICAR COM +15 MIN DE TOLERÂNCIA
  const aplicarSaidaComTolerancia = (baseTimestamp, motivo, uuid) => {
    const d = new Date(new Date(baseTimestamp).getTime() + 15 * 60 * 1000);
    aplicarSaidaManual(d.toISOString(), `${motivo} (+15min de tolerância pós-serviço)`, uuid);
  };

  // Contadores de Anomalias para os badges dos botões de filtro
  const contadores = useMemo(() => {
    let suspeitas = 0;
    let semSaida = 0;
    let gapLongo = 0;
    let longa = 0;
    let ajustadas = 0;

    sessoesClassificadas.forEach((s) => {
      if (s.ehSuspeita) suspeitas++;
      if (s.anomaliaTipo === "sem_saida") semSaida++;
      if (s.anomaliaTipo === "gap_longo") gapLongo++;
      if (s.anomaliaTipo === "longa") longa++;
      if (s.anomaliaTipo === "ajustado") ajustadas++;
    });

    return { suspeitas, semSaida, gapLongo, longa, ajustadas, total: sessoesClassificadas.length };
  }, [sessoesClassificadas]);

  return (
    <div style={{ color: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      {/* ─── TOAST NOTIFICAÇÃO ─── */}
      {toastMensagem && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            zIndex: 999999,
            background: toastMensagem.tipo === "erro" ? "#991b1b" : toastMensagem.tipo === "alerta" ? "#854d0e" : "#065f46",
            border: `1px solid ${toastMensagem.tipo === "erro" ? "#ef4444" : toastMensagem.tipo === "alerta" ? "#eab308" : "#34d399"}`,
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "700",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          {toastMensagem.msg}
        </div>
      )}

      {/* ─── BARRA DE FILTROS SUPERIOR ─── */}
      <div
        style={{
          background: "#121214",
          border: `1px solid ${theme.border}33`,
          borderRadius: "12px",
          padding: "14px 18px",
          marginBottom: "16px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Seletor de Mecânicas */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Mecânica:</span>
          <div style={{ display: "flex", gap: "6px" }}>
            {MECANICAS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMecanicaSelecionada(m.id)}
                style={{
                  background: mecanicaSelecionada === m.id ? m.bg : "rgba(255,255,255,0.03)",
                  border: `1px solid ${mecanicaSelecionada === m.id ? m.border : `${theme.border}44`}`,
                  color: mecanicaSelecionada === m.id ? m.cor : theme.subtext,
                  padding: "6px 12px",
                  borderRadius: "7px",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Período e Busca */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={filtroPeriodo}
            onChange={(e) => alterarPeriodoPreset(e.target.value)}
            style={{
              background: "#18181c",
              border: `1px solid ${theme.border}55`,
              color: "#fff",
              padding: "7px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600",
            }}
          >
            <option value="hoje">Hoje</option>
            <option value="ontem">Ontem</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="15d">Últimos 15 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>

          <input
            type="text"
            placeholder="Buscar mecânico ou ID..."
            value={buscaMecanico}
            onChange={(e) => setBuscaMecanico(e.target.value)}
            style={{
              background: "#18181c",
              border: `1px solid ${theme.border}55`,
              color: "#fff",
              padding: "7px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              width: "190px",
            }}
          />

          <button
            onClick={carregarSessoes}
            disabled={carregandoSessoes || sincronizando}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${theme.border}66`,
              color: "#fff",
              padding: "7px 14px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            {carregandoSessoes ? "Carregando..." : "🔄 Atualizar"}
          </button>

          <button
            onClick={executarSincronizacao}
            disabled={sincronizando || carregandoSessoes}
            title="Puxa os registros mais recentes de ponto, tunagem, bancada e baú direto do Discord para as tabelas"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
              color: "#fff",
              padding: "7px 14px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
            }}
          >
            {sincronizando ? "⏳ Sincronizando..." : "⚡ Sincronizar Discord"}
          </button>
        </div>
      </div>

      {/* ─── FILTRO INTELIGENTE DE ANOMALIAS (AUDIT QUEUE) ─── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {[
          { id: "todas", label: "Todas as Sessões", count: contadores.total, cor: "#94a3b8" },
          { id: "suspeitas", label: "⚠️ Todas Suspeitas", count: contadores.suspeitas, cor: "#f59e0b", badge: true },
          { id: "gap_longo", label: "⏳ Gap > 3h sem Atividade", count: contadores.gapLongo, cor: "#eab308" },
          { id: "sem_saida", label: "🚨 Sem Saída Batida", count: contadores.semSaida, cor: "#ef4444" },
          { id: "longa", label: "⏱️ Duração Longa (+6h)", count: contadores.longa, cor: "#ec4899" },
          { id: "ajustadas", label: "✅ Ajustadas Manualmente", count: contadores.ajustadas, cor: "#10b981" },
        ].map((f) => {
          const ativo = filtroAnomalia === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltroAnomalia(f.id)}
              style={{
                background: ativo ? `${f.cor}25` : "rgba(255,255,255,0.025)",
                border: `1px solid ${ativo ? f.cor : `${theme.border}44`}`,
                color: ativo ? "#fff" : theme.subtext,
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "11.5px",
                fontWeight: ativo ? "800" : "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.15s",
              }}
            >
              <span>{f.label}</span>
              <span
                style={{
                  background: ativo ? f.cor : "rgba(255,255,255,0.08)",
                  color: ativo ? "#000" : "#fff",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "10px",
                  fontWeight: "900",
                }}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── GRID PRINCIPAL: ESQUERDA (SESSÕES) | DIREITA (TIMELINE) ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "18px", alignItems: "start" }}>
        {/* =========================================================================
            COLUNA ESQUERDA: LISTA DE SESSÕES
        ========================================================================= */}
        <div
          style={{
            background: "#131316",
            border: `1px solid ${theme.border}33`,
            borderRadius: "12px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 250px)",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${theme.border}33`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "#fff" }}>
              Sessões de Ponto ({sessoesFiltradas.length})
            </span>
            <span style={{ fontSize: "10.5px", color: theme.subtext }}>Clique para ver a timeline</span>
          </div>

          <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
            {carregandoSessoes ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: theme.subtext, fontSize: "12px" }}>
                Carregando sessões de ponto...
              </div>
            ) : sessoesFiltradas.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: theme.subtext, fontSize: "12px" }}>
                Nenhuma sessão encontrada para este filtro.
              </div>
            ) : (
              sessoesFiltradas.map((s) => {
                const selecionada = sessaoAtiva?.id === s.id;
                const isAjustada = s.anomaliaTipo === "ajustado";

                return (
                  <div
                    key={s.id}
                    onClick={() => carregarTimeline(s)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "9px",
                      background: selecionada ? "rgba(239,68,68,0.14)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${selecionada ? "rgba(239,68,68,0.6)" : s.ehSuspeita ? "rgba(245,158,11,0.3)" : `${theme.border}33`}`,
                      marginBottom: "8px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                      <div style={{ fontWeight: "700", fontSize: "12.5px", color: selecionada ? "#fff" : "#f1f5f9" }}>
                        {s.nome}
                      </div>
                      <span style={{ fontSize: "11px", color: theme.subtext, fontFamily: "monospace" }}>
                        #{s.usuario_id}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: theme.subtext, marginBottom: "6px" }}>
                      <span>📅 {s.data}</span>
                      <span style={{ color: "#34d399", fontWeight: "700" }}>{fmtHora(s.entrada)}</span>
                      <span>➔</span>
                      <span style={{ color: s.saida ? "#f87171" : "#eab308", fontWeight: "700" }}>
                        {s.saida ? fmtHora(s.saida) : "Em Aberto"}
                      </span>
                      <span style={{ fontWeight: "800", color: "#fff", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: "4px" }}>
                        {fmtDuracao(s.total_minutos)}
                      </span>
                    </div>

                    {/* Badge de Anomalia ou Ajuste */}
                    {s.anomaliaTexto && (
                      <div style={{ marginTop: "4px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "10px",
                            fontWeight: "800",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: isAjustada ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                            color: isAjustada ? "#34d399" : "#fbbf24",
                            border: `1px solid ${isAjustada ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.35)"}`,
                          }}
                        >
                          {isAjustada ? "✅ " : "⚠️ "} {s.anomaliaTexto}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* =========================================================================
            COLUNA DIREITA: LINHA DO TEMPO CRONOLÓGICA (TIMELINE VISUAL)
        ========================================================================= */}
        <div
          style={{
            background: "#131316",
            border: `1px solid ${theme.border}33`,
            borderRadius: "12px",
            padding: "20px",
            minHeight: "500px",
            maxHeight: "calc(100vh - 250px)",
            overflowY: "auto",
          }}
        >
          {!sessaoAtiva ? (
            <div style={{ textAlign: "center", padding: "80px 20px", color: theme.subtext }}>
              <div style={{ fontSize: "40px", marginBottom: "14px" }}>⏱️</div>
              <h3 style={{ fontSize: "16px", color: "#fff", fontWeight: "800", marginBottom: "6px" }}>
                Selecione uma sessão de ponto na lista à esquerda
              </h3>
              <p style={{ fontSize: "12px", maxWidth: "420px", margin: "0 auto", lineHeight: 1.5 }}>
                A linha do tempo carregará todos os logs brutos daquele mecânico no dia (<strong>Ponto</strong>, <strong>Tunagens</strong>, <strong>Bancada</strong> e <strong>Baú</strong>) para você definir com 1 clique o término oficial da sessão.
              </p>
            </div>
          ) : (
            <div>
              {/* CABEÇALHO DA SESSÃO SELECIONADA */}
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${theme.border}44`,
                  borderRadius: "10px",
                  padding: "16px",
                  marginBottom: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h2 style={{ fontSize: "16px", fontWeight: "800", color: "#fff", margin: 0 }}>
                      {sessaoAtiva.nome}
                    </h2>
                    <span style={{ fontSize: "11px", color: theme.subtext, fontFamily: "monospace" }}>
                      ID: #{sessaoAtiva.usuario_id}
                    </span>
                    <span style={{ background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "5px", fontSize: "11px", color: "#cbd5e1" }}>
                      📅 {sessaoAtiva.data}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "14px", marginTop: "8px", fontSize: "11.5px" }}>
                    <span>Entrada: <strong style={{ color: "#34d399" }}>{fmtHora(sessaoAtiva.entrada)}</strong></span>
                    <span>Saída Atual: <strong style={{ color: sessaoAtiva.saida ? "#f87171" : "#eab308" }}>{sessaoAtiva.saida ? fmtHora(sessaoAtiva.saida) : "Em Aberto"}</strong></span>
                    <span>Duração: <strong style={{ color: "#fff" }}>{fmtDuracao(sessaoAtiva.total_minutos)}</strong></span>
                    <span>Status: <strong style={{ color: "#cbd5e1" }}>{sessaoAtiva.tipo_fechamento || "NORMAL"}</strong></span>
                  </div>

                  {sessaoAtiva.observacao && (
                    <div style={{ marginTop: "6px", fontSize: "10.5px", color: "#facc15" }}>
                      ℹ️ {sessaoAtiva.observacao}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      setHorarioManualInput(sessaoAtiva.saida ? fmtHora(sessaoAtiva.saida) : "");
                      setMotivoManualInput("Ajuste manual de horário");
                      setModalHorarioManual(true);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${theme.border}66`,
                      color: "#fff",
                      padding: "8px 14px",
                      borderRadius: "7px",
                      fontSize: "11.5px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    ✏️ Digitar Horário Manual
                  </button>
                </div>
              </div>

              {/* TÍTULO DA TIMELINE */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <span style={{ fontSize: "13px", fontWeight: "800", color: "#fff" }}>
                  Linha do Tempo de Atividades no Dia ({timelineEventos.filter((e) => !e.isGap).length} registros)
                </span>
                <span style={{ fontSize: "11px", color: theme.subtext }}>
                  Clique em &quot;Definir como Saída&quot; ao lado de qualquer log comprovado
                </span>
              </div>

              {/* ITENS DA TIMELINE */}
              {carregandoTimeline ? (
                <div style={{ padding: "60px 20px", textAlign: "center", color: theme.subtext, fontSize: "12px" }}>
                  Carregando eventos do mecânico...
                </div>
              ) : timelineEventos.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center", color: theme.subtext, fontSize: "12px" }}>
                  Nenhum log encontrado para este mecânico nesta data.
                </div>
              ) : (
                <div style={{ position: "relative", paddingLeft: "24px" }}>
                  {/* Linha vertical conectora */}
                  <div
                    style={{
                      position: "absolute",
                      left: "8px",
                      top: "10px",
                      bottom: "10px",
                      width: "2px",
                      background: "rgba(255,255,255,0.1)",
                    }}
                  />

                  {timelineEventos.map((item, idx) => {
                    // GAP VISUAL DE INATIVIDADE
                    if (item.isGap) {
                      return (
                        <div
                          key={item.id || idx}
                          style={{
                            margin: "12px 0 12px -16px",
                            padding: "8px 14px",
                            background: "rgba(234,179,8,0.08)",
                            border: "1px dashed rgba(234,179,8,0.35)",
                            borderRadius: "8px",
                            color: "#facc15",
                            fontSize: "11px",
                            fontWeight: "700",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          {item.texto}
                        </div>
                      );
                    }

                    // CORES E ÍCONES POR TIPO DE LOG
                    let corDot = "#94a3b8";
                    let bgCard = "rgba(255,255,255,0.02)";
                    let borderCard = `${theme.border}33`;

                    if (item.tipo === "PONTO_ENTRADA") {
                      corDot = "#22c55e";
                      bgCard = "rgba(34,197,94,0.06)";
                      borderCard = "rgba(34,197,94,0.25)";
                    } else if (item.tipo === "PONTO_SAIDA") {
                      corDot = "#ef4444";
                      bgCard = "rgba(239,68,68,0.06)";
                      borderCard = "rgba(239,68,68,0.25)";
                    } else if (item.tipo === "TUNAGEM") {
                      corDot = "#38bdf8";
                      bgCard = "rgba(56,189,248,0.06)";
                      borderCard = "rgba(56,189,248,0.25)";
                    } else if (item.tipo === "BANCADA") {
                      corDot = "#fbbf24";
                      bgCard = "rgba(251,191,36,0.06)";
                      borderCard = "rgba(251,191,36,0.25)";
                    } else if (item.tipo === "BAU") {
                      corDot = "#a855f7";
                      bgCard = "rgba(168,85,247,0.06)";
                      borderCard = "rgba(168,85,247,0.25)";
                    }

                    const isDentroDoSessao =
                      sessaoAtiva.saida &&
                      new Date(item.timestamp) >= new Date(sessaoAtiva.entrada) &&
                      new Date(item.timestamp) <= new Date(sessaoAtiva.saida);

                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          position: "relative",
                          marginBottom: "12px",
                        }}
                      >
                        {/* Ponto / Marcador na Linha */}
                        <div
                          style={{
                            position: "absolute",
                            left: "-20px",
                            top: "14px",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: corDot,
                            boxShadow: `0 0 8px ${corDot}`,
                          }}
                        />

                        {/* Card do Evento */}
                        <div
                          style={{
                            background: bgCard,
                            border: `1px solid ${borderCard}`,
                            borderRadius: "10px",
                            padding: "12px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "10px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: "220px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                              <span style={{ fontSize: "12px", fontWeight: "800", color: "#fff" }}>
                                {fmtHora(item.timestamp)}
                              </span>
                              <span style={{ fontSize: "12px", fontWeight: "700", color: corDot }}>
                                {item.titulo}
                              </span>
                              {isDentroDoSessao && (
                                <span style={{ fontSize: "9.5px", background: "rgba(34,197,94,0.15)", color: "#4ade80", padding: "1px 5px", borderRadius: "4px", fontWeight: "800" }}>
                                  DURANTE O PONTO
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: "11.5px", color: "#cbd5e1" }}>
                              {item.descricao}
                            </div>

                            {item.uuid && (
                              <div style={{ fontSize: "9.5px", fontFamily: "monospace", color: "#64748b", marginTop: "3px" }}>
                                UUID: {item.uuid}
                              </div>
                            )}
                          </div>

                          {/* BOTÕES DE AÇÃO RÁPIDA DE 1 CLIQUE */}
                          {item.podeSerSaida && (
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              <button
                                disabled={salvandoAjuste}
                                onClick={() => aplicarSaidaManual(item.timestamp, item.titulo, item.uuid)}
                                title="Define este exato minuto como o fim do ponto do mecânico"
                                style={{
                                  background: "rgba(239,68,68,0.15)",
                                  border: "1px solid rgba(239,68,68,0.5)",
                                  color: "#fca5a5",
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  transition: "all 0.15s",
                                }}
                              >
                                ✂️ Definir como Saída
                              </button>

                              <button
                                disabled={salvandoAjuste}
                                onClick={() => aplicarSaidaComTolerancia(item.timestamp, item.titulo, item.uuid)}
                                title="Adiciona 15 minutos de tolerância pós-serviço e define como saída"
                                style={{
                                  background: "rgba(234,179,8,0.15)",
                                  border: "1px solid rgba(234,179,8,0.5)",
                                  color: "#fef08a",
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                }}
                              >
                                +15min
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL DIGITAR HORÁRIO MANUAL ─── */}
      {modalHorarioManual && sessaoAtiva && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            zIndex: 1000000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#16161a",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "14px",
              maxWidth: "460px",
              width: "100%",
              padding: "24px",
              color: "#fff",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.border}44`, paddingBottom: "12px", marginBottom: "16px" }}>
              <div style={{ fontSize: "15px", fontWeight: "800" }}>✏️ Digitar Horário de Saída Manual</div>
              <button onClick={() => setModalHorarioManual(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ fontSize: "12px", color: theme.subtext, marginBottom: "14px" }}>
              Mecânico: <strong style={{ color: "#fff" }}>{sessaoAtiva.nome}</strong> | Entrada: <strong style={{ color: "#34d399" }}>{fmtDataHora(sessaoAtiva.entrada)}</strong>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: "700", marginBottom: "6px", color: "#cbd5e1" }}>
                Horário da Saída (HH:MM ou HH:MM:SS):
              </label>
              <input
                type="text"
                placeholder="Ex: 17:45:00"
                value={horarioManualInput}
                onChange={(e) => setHorarioManualInput(e.target.value)}
                style={{
                  width: "100%",
                  background: "#121215",
                  border: `1px solid ${theme.border}66`,
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontFamily: "monospace",
                }}
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: "700", marginBottom: "6px", color: "#cbd5e1" }}>
                Motivo / Justificativa:
              </label>
              <input
                type="text"
                placeholder="Ex: Conversado via Discord, encerrou expediente às 17h45"
                value={motivoManualInput}
                onChange={(e) => setMotivoManualInput(e.target.value)}
                style={{
                  width: "100%",
                  background: "#121215",
                  border: `1px solid ${theme.border}66`,
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setModalHorarioManual(false)}
                style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#cbd5e1", padding: "8px 16px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvandoAjuste || !horarioManualInput.trim()}
                onClick={() => {
                  const horaStr = horarioManualInput.trim();
                  // Monta o timestamp ISO combinando a data da sessão com o horário digitado
                  let horaFormatada = horaStr;
                  if (horaStr.length === 5) horaFormatada = `${horaStr}:00`;
                  const isoNovo = `${sessaoAtiva.data}T${horaFormatada}-03:00`;
                  aplicarSaidaManual(isoNovo, motivoManualInput || "Ajuste manual digitado");
                }}
                style={{
                  background: "#ef4444",
                  border: "none",
                  color: "#fff",
                  padding: "8px 20px",
                  borderRadius: "7px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "800",
                }}
              >
                {salvandoAjuste ? "Salvando..." : "Salvar Ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
