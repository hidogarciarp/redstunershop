import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../utils/supabaseClient";

function usePontoElapsed(pontoAtivo) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const entrada = pontoAtivo?.entrada;
    if (!entrada) {
      const limpar = window.setTimeout(() => setSegundos(0), 0);
      return () => window.clearTimeout(limpar);
    }
    const inicio = new Date(entrada).getTime();
    const atualizar = () => setSegundos(Math.max(0, Math.floor((Date.now() - inicio) / 1000)));
    const inicial = window.setTimeout(atualizar, 0);
    const intervalo = window.setInterval(atualizar, 1000);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(intervalo);
    };
  }, [pontoAtivo?.entrada]);

  return segundos;
}

export default function PontoPage({
  styles,
  theme,
  pontoAtivo,
  formatarCronometro,
  tempoSegundos,
  registrarPonto,
  solicitacoesPendentes,
  usuarioLogado,
  formatarHorario,
  historicoPonto,
  formatarData,
  formatarDataHora,
  calcularDuracao,
  editandoPontoId,
  setEditandoPontoId,
  novaSaidaDataInput,
  setNovaSaidaDataInput,
  novaSaidaInput,
  setNovaSaidaInput,
  novaSaidaJustificativa,
  setNovaSaidaJustificativa,
  userIsRespPonto,
  podeVerTodosPontos = false,
  solicitarEdicaoSaida,
  emServico,
  isAdminOuDono,
  userIsAdmin,
  fecharPontoAdmin,
  alternarVisibilidadePonto,
  apagarPonto,
  buscarHistoricoPonto,
  listaFuncionarios = [],
}) {
  const tempoPonto = usePontoElapsed(pontoAtivo);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");

  const [sessoesPonto, setSessoesPonto] = useState([]);
  const [carregandoSessoes, setCarregandoSessoes] = useState(false);

  const carregarSessoes = useCallback(async (filtrosCustom = {}) => {
    if (!usuarioLogado) return;
    setCarregandoSessoes(true);

    const nomeBusca = filtrosCustom.nome !== undefined ? filtrosCustom.nome : filtroNome;
    const inicioBusca = filtrosCustom.dataInicio !== undefined ? filtrosCustom.dataInicio : filtroInicio;
    const fimBusca = filtrosCustom.dataFim !== undefined ? filtrosCustom.dataFim : filtroFim;

    try {
      const idVal = usuarioLogado.id_jogo || usuarioLogado.idJogo || usuarioLogado.id;

      let queryAuditoria = supabase
        .from("sessoes_ponto_auditoria_reds")
        .select("*")
        .order("entrada", { ascending: false })
        .limit(2000);

      let queryCidade = supabase
        .from("ponto_cidade_reds")
        .select("*")
        .or("oculto.is.null,oculto.eq.false")
        .order("entrada", { ascending: false })
        .limit(2000);

      if (podeVerTodosPontos) {
        if (nomeBusca && nomeBusca.trim()) {
          const termo = nomeBusca.trim();
          const termoNum = !isNaN(Number(termo)) ? Number(termo) : null;

          if (termoNum) {
            queryAuditoria = queryAuditoria.or(`id_jogo.eq.${termo},nome.ilike.%${termo}%`);
            queryCidade = queryCidade.or(`id_jogo.eq.${termo},usuario_id.eq.${termo},nome.ilike.%${termo}%,nome_personagem.ilike.%${termo}%`);
          } else {
            queryAuditoria = queryAuditoria.ilike("nome", `%${termo}%`);
            queryCidade = queryCidade.or(`nome.ilike.%${termo}%,nome_personagem.ilike.%${termo}%`);
          }
        }
      } else {
        const condsAud = [];
        if (idVal && !isNaN(Number(idVal))) condsAud.push(`id_jogo.eq.${idVal}`);
        if (usuarioLogado.id && String(usuarioLogado.id) !== String(idVal) && !isNaN(Number(usuarioLogado.id))) {
          condsAud.push(`id_jogo.eq.${usuarioLogado.id}`);
        }
        if (usuarioLogado.nome) {
          condsAud.push(`nome.ilike.%${usuarioLogado.nome.trim()}%`);
        }
        if (condsAud.length > 0) {
          queryAuditoria = queryAuditoria.or(condsAud.join(","));
        }

        const condsCid = [];
        if (idVal && !isNaN(Number(idVal))) {
          condsCid.push(`usuario_id.eq.${idVal}`);
          condsCid.push(`id_jogo.eq.${idVal}`);
        } else if (usuarioLogado.id) {
          condsCid.push(`usuario_id.eq.${usuarioLogado.id}`);
        }
        if (usuarioLogado.nome) {
          condsCid.push(`nome.ilike.%${usuarioLogado.nome.trim()}%`);
          condsCid.push(`nome_personagem.ilike.%${usuarioLogado.nome.trim()}%`);
        }
        if (condsCid.length > 0) {
          queryCidade = queryCidade.or(condsCid.join(","));
        }
      }

      if (inicioBusca) {
        queryAuditoria = queryAuditoria.gte("entrada", `${inicioBusca}T00:00:00.000Z`);
        queryCidade = queryCidade.gte("entrada", `${inicioBusca}T00:00:00.000Z`);
      }
      if (fimBusca) {
        queryAuditoria = queryAuditoria.lte("entrada", `${fimBusca}T23:59:59.999Z`);
        queryCidade = queryCidade.lte("entrada", `${fimBusca}T23:59:59.999Z`);
      }

      const [{ data: dataAud, error: errAud }, { data: dataCid, error: errCid }] = await Promise.all([
        queryAuditoria,
        queryCidade
      ]);

      if (errAud) console.warn("Aviso ao buscar sessoes_ponto_auditoria_reds:", errAud);
      if (errCid) console.warn("Aviso ao buscar ponto_cidade_reds:", errCid);

      const mapa = new Map();

      (dataAud || []).forEach((r) => {
        const key = String(r.uuid_sessao || `${r.id_jogo}_${r.entrada}`);
        const durMin = r.duracao_min || ((r.entrada && r.saida) ? Math.round((new Date(r.saida) - new Date(r.entrada)) / 60000) : 0);
        let dataStr = "";
        try {
          dataStr = new Date(r.entrada).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        } catch (e) {
          dataStr = r.entrada ? r.entrada.substring(0, 10) : "";
        }
        mapa.set(key, {
          ...r,
          id: r.id || r.uuid_sessao,
          origem: "auditoria",
          data: dataStr,
          duracao_min: durMin,
          observacao: r.justificativa || r.motivo_crash || r.observacao || null
        });
      });

      (dataCid || []).forEach((r) => {
        const key = String(r.uuid_entrada || `${r.id_jogo || r.usuario_id || r.id}_${r.entrada}`);
        const existente = mapa.get(key);
        let dataStr = "";
        try {
          dataStr = new Date(r.entrada).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        } catch (e) {
          dataStr = r.entrada ? r.entrada.substring(0, 10) : "";
        }
        if (!existente) {
          const durMin = (r.entrada && r.saida) ? Math.round((new Date(r.saida) - new Date(r.entrada)) / 60000) : 0;
          mapa.set(key, {
            ...r,
            id: r.id || r.uuid_entrada,
            origem: "cidade",
            data: dataStr,
            id_jogo: r.id_jogo || r.usuario_id,
            nome: r.nome || r.nome_personagem,
            uuid_sessao: r.uuid_entrada,
            duracao_min: durMin,
            status_ponto: r.saida ? "normal" : "aberto"
          });
        } else {
          mapa.set(key, {
            ...r,
            ...existente,
            data: existente.data || dataStr,
            saida: r.saida || existente.saida,
            duracao_min: existente.duracao_min || ((r.entrada && r.saida) ? Math.round((new Date(r.saida) - new Date(r.entrada)) / 60000) : 0)
          });
        }
      });

      const sessoesOrdenadas = Array.from(mapa.values()).sort((a, b) => new Date(b.entrada) - new Date(a.entrada));
      setSessoesPonto(sessoesOrdenadas);
    } catch (e) {
      console.error("Erro ao carregar sessões de ponto:", e);
    } finally {
      setCarregandoSessoes(false);
    }
  }, [usuarioLogado, podeVerTodosPontos, filtroNome, filtroInicio, filtroFim]);

  useEffect(() => {
    carregarSessoes();
  }, [carregarSessoes]);

  const pertenceAoUsuario = useCallback(
    (registro) => {
      const uId = String(usuarioLogado?.id ?? "");
      const uIdJogo = String(usuarioLogado?.id_jogo ?? "");
      const uNome = (usuarioLogado?.nome || "").toLowerCase().trim();

      const regId = String(registro?.usuario_id || registro?.id_jogo || "");
      const regNome = (registro?.nome || registro?.nome_personagem || "").toLowerCase().trim();

      if (uId && (regId === uId || String(registro?.id) === uId)) return true;
      if (uIdJogo && regId === uIdJogo) return true;
      if (uNome && regNome && (regNome.includes(uNome) || uNome.includes(regNome))) return true;
      return false;
    },
    [usuarioLogado]
  );

  const sessoesVisiveis = useMemo(() => {
    if (podeVerTodosPontos) {
      if (!filtroNome.trim()) return sessoesPonto;
      const fn = filtroNome.toLowerCase().trim();
      return sessoesPonto.filter((s) =>
        (s.nome && s.nome.toLowerCase().includes(fn)) ||
        (s.id_jogo && String(s.id_jogo).includes(fn))
      );
    }
    return sessoesPonto.filter(pertenceAoUsuario);
  }, [podeVerTodosPontos, sessoesPonto, filtroNome, pertenceAoUsuario]);

  const [paginaAtualSessoes, setPaginaAtualSessoes] = useState(1);
  const ITENS_POR_PAGINA = 30;

  const totalPaginas = Math.max(1, Math.ceil(sessoesVisiveis.length / ITENS_POR_PAGINA));
  const sessoesPaginadas = useMemo(() => {
    const inicio = (paginaAtualSessoes - 1) * ITENS_POR_PAGINA;
    return sessoesVisiveis.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [sessoesVisiveis, paginaAtualSessoes]);

  useEffect(() => {
    setPaginaAtualSessoes(1);
  }, [filtroNome, filtroInicio, filtroFim, usuarioLogado]);

  const emServicoVisivel = useMemo(
    () => (podeVerTodosPontos ? emServico : emServico.filter(pertenceAoUsuario))
      .filter((p) => !p.oculto || isAdminOuDono(usuarioLogado?.role || "")),
    [podeVerTodosPontos, emServico, pertenceAoUsuario, isAdminOuDono, usuarioLogado?.role]
  );

  const obterLabelSemana = (dataStr) => {
    if (!dataStr) return { key: "", label: "" };
    const date = new Date(`${dataStr}T12:00:00`);
    const day = date.getDay();
    const diffParaSegunda = day === 0 ? -6 : 1 - day;
    const segunda = new Date(date);
    segunda.setDate(date.getDate() + diffParaSegunda);
    const domingo = new Date(segunda);
    domingo.setDate(segunda.getDate() + 6);

    const fmt = (d) => {
      const dia = String(d.getDate()).padStart(2, "0");
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const ano = d.getFullYear();
      return `${dia}/${mes}/${ano}`;
    };

    return {
      key: segunda.toLocaleDateString("en-CA"),
      label: `Semana ${fmt(segunda)} a ${fmt(domingo)}`
    };
  };

  const resumosSemanais = useMemo(() => {
    const semanas = {};

    sessoesVisiveis.forEach((reg) => {
      if (!reg.entrada || !reg.saida) return;
      let dataStr = "";
      try {
        dataStr = new Date(reg.entrada).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      } catch (e) {
        dataStr = reg.entrada ? reg.entrada.substring(0, 10) : "";
      }
      const { key, label } = obterLabelSemana(dataStr);
      if (!key) return;

      const diffMin = reg.duracao_min || ((new Date(reg.saida) - new Date(reg.entrada)) / 60000);
      if (diffMin > 0) {
        if (!semanas[key]) {
          semanas[key] = { key, label, totalMinutos: 0 };
        }
        semanas[key].totalMinutos += diffMin;
      }
    });

    return Object.values(semanas).sort((a, b) => b.key.localeCompare(a.key));
  }, [sessoesVisiveis]);

  const aplicarFiltros = () => {
    carregarSessoes({ nome: filtroNome, dataInicio: filtroInicio, dataFim: filtroFim });
    if (buscarHistoricoPonto) {
      buscarHistoricoPonto({ nome: filtroNome, dataInicio: filtroInicio, dataFim: filtroFim });
    }
  };

  const filtrarSemanaAtual = () => {
    const agora = new Date();
    const diaSemana = agora.getDay();
    const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    const segunda = new Date(agora);
    segunda.setDate(agora.getDate() + diffParaSegunda);
    const domingo = new Date(segunda);
    domingo.setDate(segunda.getDate() + 6);

    const inicio = segunda.toLocaleDateString("en-CA");
    const fim = domingo.toLocaleDateString("en-CA");
    
    setFiltroInicio(inicio);
    setFiltroFim(fim);
    carregarSessoes({ nome: filtroNome, dataInicio: inicio, dataFim: fim });
    if (buscarHistoricoPonto) {
      buscarHistoricoPonto({ nome: filtroNome, dataInicio: inicio, dataFim: fim });
    }
  };

  const limparFiltros = () => {
    setFiltroNome("");
    setFiltroInicio("");
    setFiltroFim("");
    carregarSessoes({ nome: "", dataInicio: "", dataFim: "" });
    if (buscarHistoricoPonto) {
      buscarHistoricoPonto();
    }
  };
  return (
    <div style={{ padding: "30px 40px", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ ...styles.whiteCard, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ fontSize: "12px", color: theme.subtext }}>Status na Cidade</div>
          <div style={{ fontWeight: "800", fontSize: "15px", color: pontoAtivo ? "#22c55e" : "#94a3b8" }}>
            {pontoAtivo ? "🟢 Em Serviço (Detectado no Jogo)" : "⚪ Fora de Serviço"}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: theme.subtext }}>Tempo em andamento</div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: pontoAtivo ? "#22c55e" : "rgba(255,255,255,0.4)" }}>
            {formatarCronometro(tempoPonto)}
          </div>
        </div>
        <div
          style={{
            background: pontoAtivo ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${pontoAtivo ? "#22c55e" : "rgba(255,255,255,0.15)"}`,
            color: pontoAtivo ? "#4ade80" : "#94a3b8",
            padding: "8px 14px",
            borderRadius: "8px",
            fontWeight: "800",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span>{pontoAtivo ? "⚡ Sincronizado com /ponto" : "💤 Inicie /ponto no jogo"}</span>
        </div>
      </div>

      {solicitacoesPendentes.filter((s) => s.usuario_id === usuarioLogado.id).length > 0 && (
        <div style={{ ...styles.whiteCard, marginBottom: "20px", borderLeft: "3px solid #facc15" }}>
          <div style={{ ...styles.cardHeader, color: "#facc15" }}>
            <span style={{ ...styles.dot, background: "#facc15" }}></span> Minhas Solicitações Pendentes
          </div>
          {solicitacoesPendentes
            .filter((s) => s.usuario_id === usuarioLogado.id)
            .map((s) => (
              <div key={s.id} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}`, fontSize: "13px" }}>
                <span style={{ color: theme.subtext }}>📅 {s.data_ponto}</span>
                {" · "}Nova saída: <b style={{ color: "#facc15" }}>{formatarHorario(s.nova_saida)}</b>
                {s.justificativa && <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>Motivo: {s.justificativa}</div>}
                {" · "}<span style={{ background: "#facc1520", color: "#facc15", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>⏳ Aguardando aprovação</span>
              </div>
            ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
        <div style={styles.whiteCard}>
          <div style={{ ...styles.cardHeader, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={styles.dot}></span> {podeVerTodosPontos ? "Histórico Geral" : "Meu Histórico"}
            </div>
            {podeVerTodosPontos && (
              <button
                onClick={limparFiltros}
                style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: "11px", fontWeight: "700" }}
              >
                🔄 Ver Todos
              </button>
            )}
          </div>

          {podeVerTodosPontos && (
            <div style={{ marginBottom: "16px", padding: "12px", background: theme.card2, borderRadius: "10px", border: `1px solid ${theme.border}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: theme.subtext, textTransform: "uppercase", fontWeight: "700" }}>Filtrar Funcionário</span>
                  <input
                    style={{ ...styles.input, padding: "6px 10px", fontSize: "13px" }}
                    placeholder="Nome do funcionário..."
                    value={filtroNome}
                    onChange={(e) => setFiltroNome(e.target.value)}
                    list="lista-funcionarios-ponto"
                  />
                  <datalist id="lista-funcionarios-ponto">
                    {listaFuncionarios.map((f) => (
                      <option key={f.id} value={f.nome} />
                    ))}
                  </datalist>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: theme.subtext, textTransform: "uppercase", fontWeight: "700" }}>Período</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} style={{ ...styles.input, padding: "6px 10px", fontSize: "12px" }} />
                    <input type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} style={{ ...styles.input, padding: "6px 10px", fontSize: "12px" }} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={aplicarFiltros}
                  style={{ background: "#2563eb", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                >
                  🔍 Filtrar
                </button>
                <button
                  onClick={filtrarSemanaAtual}
                  style={{ background: "#16a34a", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                >
                  📅 Esta Semana
                </button>
                <button
                  onClick={limparFiltros}
                  style={{ background: "#4b5563", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                >
                  🧹 Limpar
                </button>
              </div>
            </div>
          )}
          
          {resumosSemanais.length > 0 && (
            <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "10px", border: `1px solid ${theme.border}44` }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: theme.subtext, textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                📊 Resumo de Horas por Semana
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {resumosSemanais.map((sem, idx) => {
                  const h = Math.floor(sem.totalMinutos / 60);
                  const m = Math.round(sem.totalMinutos % 60);
                  const totalStr = `${h}h ${String(m).padStart(2, "0")}min`;
                  const atingiuMeta = sem.totalMinutos >= 240;
                  const corTexto = atingiuMeta ? "#22c55e" : "#ef4444";
                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                      <span style={{ color: corTexto, fontWeight: "600" }}>{sem.label}</span>
                      <b style={{ color: corTexto }}>{totalStr} total</b>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {carregandoSessoes ? (
            <div style={{ padding: "30px", textAlign: "center", color: theme.subtext }}>
              ⏳ Carregando sessões de ponto...
            </div>
          ) : sessoesVisiveis.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: theme.subtext }}>
              Nenhuma sessão de ponto encontrada.
            </div>
          ) : (
            sessoesPaginadas.map((reg) => {
              const agoraMs = Date.now();
              const sessaoMs = reg.entrada ? new Date(reg.entrada).getTime() : 0;
              const horasAtras = sessaoMs > 0 ? (agoraMs - sessaoMs) / 3600000 : 999;
              const isAberta = (!reg.saida || reg.status_ponto === "aberto") && horasAtras < 12;
              const semSaidaAntiga = (!reg.saida || reg.status_ponto === "aberto") && horasAtras >= 12;

              const durMin = reg.duracao_min || (reg.entrada && reg.saida ? Math.round((new Date(reg.saida) - new Date(reg.entrada)) / 60000) : 0);
              const h = Math.floor(durMin / 60);
              const m = Math.round(durMin % 60);
              const duracaoStr = durMin > 0 ? (h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`) : (reg.saida ? "0min" : isAberta ? "Em andamento" : "Sem saída");
              const dataRegStr = reg.data || (reg.entrada ? new Date(reg.entrada).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "");

              return (
                <div key={reg.id || reg.uuid_sessao} style={{ padding: "12px 0", borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <b style={{ fontSize: "14px", color: theme.text }}>{reg.nome || "Não informado"}</b>
                        {reg.id_jogo && (
                          <span style={{ fontSize: "11px", color: theme.subtext }}>#{reg.id_jogo}</span>
                        )}
                        {isAberta && (
                          <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                            🟢 Em Aberto
                          </span>
                        )}
                        {semSaidaAntiga && (
                          <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                            ⚠️ Sem saída oficial
                          </span>
                        )}
                        {reg.infracao_30min && (
                          <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                            ⚠️ &lt; 30min
                          </span>
                        )}
                        {reg.status_ponto && !["normal", "aberto"].includes(reg.status_ponto) && (
                          <span style={{ background: "rgba(234, 179, 8, 0.15)", color: "#eab308", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "700", border: "1px solid rgba(234, 179, 8, 0.3)" }}>
                            ⚡ {reg.status_ponto}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: "12px", color: theme.subtext, marginTop: "4px" }}>
                        📅 {formatarData(dataRegStr || reg.entrada)} · 🕒 {formatarHorario(reg.entrada)} → {reg.saida ? formatarDataHora(reg.saida) : "..."}
                      </div>

                      {(reg.observacao || reg.justificativa || reg.motivo_crash) && (
                        <div style={{ fontSize: "11px", color: "#facc15", marginTop: "3px" }}>
                          📝 {reg.observacao || reg.justificativa || reg.motivo_crash}
                        </div>
                      )}

                      {(reg.total_tunagens > 0 || reg.total_bancada > 0 || reg.total_bau > 0) && (
                        <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "3px", display: "flex", gap: "8px" }}>
                          {reg.total_tunagens > 0 && <span>🔧 {reg.total_tunagens} tunagens</span>}
                          {reg.total_bancada > 0 && <span>🧰 {reg.total_bancada} bancadas</span>}
                          {reg.total_bau > 0 && <span>📦 {reg.total_bau} baús</span>}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{
                        color: isAberta ? "#22c55e" : durMin >= 60 ? "#22c55e" : theme.accent,
                        fontWeight: "700",
                        fontSize: "13px"
                      }}>
                        {duracaoStr}
                      </span>
                      {editandoPontoId !== reg.id && (pertenceAoUsuario(reg) || userIsRespPonto) && (
                        <button
                          onClick={() => {
                            setEditandoPontoId(reg.id);
                            setNovaSaidaDataInput(dataRegStr);
                            setNovaSaidaInput(reg.saida ? new Date(reg.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "");
                            setNovaSaidaJustificativa("");
                          }}
                          style={{ background: "#1e40af20", color: "#60a5fa", border: "1px solid #1e40af", padding: "3px 9px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700" }}
                        >
                          ✏️ Editar Saída
                        </button>
                      )}
                    </div>
                  </div>

                  {editandoPontoId === reg.id && (
                    <div style={{ marginTop: "10px", background: theme.card2, borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: theme.subtext, fontWeight: "600" }}>
                        ✏️ Editar saída — <span style={{ color: "#60a5fa" }}>Entrada: {formatarData(dataRegStr || reg.entrada)} às {formatarHorario(reg.entrada)}</span>
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span style={{ fontSize: "10px", color: theme.subtext, textTransform: "uppercase", fontWeight: "700" }}>Data da saída</span>
                          <input type="date" value={novaSaidaDataInput} onChange={(e) => setNovaSaidaDataInput(e.target.value)} style={{ ...styles.input, width: "145px", padding: "6px 10px", fontSize: "13px" }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span style={{ fontSize: "10px", color: theme.subtext, textTransform: "uppercase", fontWeight: "700" }}>Hora da saída</span>
                          <input type="time" value={novaSaidaInput} onChange={(e) => setNovaSaidaInput(e.target.value)} style={{ ...styles.input, width: "120px", padding: "6px 10px", fontSize: "13px" }} />
                        </div>
                      </div>
                      {!userIsRespPonto && (
                        <div>
                          <span style={{ fontSize: "10px", color: "#facc15", textTransform: "uppercase", fontWeight: "700" }}>Motivo da solicitação *</span>
                          <textarea
                            style={{ ...styles.textarea, minHeight: "60px", marginTop: "4px", fontSize: "12px" }}
                            placeholder="Ex: Jogo crashou, cidade reiniciou, luz piscou, internet caiu..."
                            value={novaSaidaJustificativa}
                            onChange={(e) => setNovaSaidaJustificativa(e.target.value)}
                          />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={async () => {
                            await solicitarEdicaoSaida(reg);
                            carregarSessoes();
                          }}
                          style={{ background: "#16a34a", color: "#fff", border: "none", padding: "6px 13px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                        >
                          {userIsRespPonto ? "✅ Salvar" : "📨 Solicitar"}
                        </button>
                        <button
                          onClick={() => {
                            setEditandoPontoId(null);
                            setNovaSaidaInput("");
                            setNovaSaidaDataInput("");
                            setNovaSaidaJustificativa("");
                          }}
                          style={{ background: "#7f1d1d", color: "#fff", border: "none", padding: "6px 13px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                        >
                          Cancelar
                        </button>
                      </div>
                      {!userIsRespPonto && <span style={{ fontSize: "11px", color: theme.subtext }}>* Requer aprovação</span>}
                      <span style={{ fontSize: "11px", color: "#facc15" }}>💡 Se o ponto foi aberto antes da meia-noite e fechado depois, altere a data para o dia seguinte.</span>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {totalPaginas > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: `1px solid ${theme.border}44`, flexWrap: "wrap", gap: "10px" }}>
              <span style={{ fontSize: "12px", color: theme.subtext }}>
                Mostrando {Math.min((paginaAtualSessoes - 1) * ITENS_POR_PAGINA + 1, sessoesVisiveis.length)} a {Math.min(paginaAtualSessoes * ITENS_POR_PAGINA, sessoesVisiveis.length)} de {sessoesVisiveis.length} sessões
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  onClick={() => setPaginaAtualSessoes((p) => Math.max(1, p - 1))}
                  disabled={paginaAtualSessoes === 1}
                  style={{
                    background: paginaAtualSessoes === 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                    border: `1px solid ${theme.border}`,
                    color: paginaAtualSessoes === 1 ? "#555" : theme.text,
                    padding: "5px 12px",
                    borderRadius: "6px",
                    cursor: paginaAtualSessoes === 1 ? "not-allowed" : "pointer",
                    fontSize: "12px",
                    fontWeight: "700"
                  }}
                >
                  ◀ Anterior
                </button>
                <span style={{ fontSize: "12px", color: theme.text, fontWeight: "700", padding: "0 6px" }}>
                  {paginaAtualSessoes} / {totalPaginas}
                </span>
                <button
                  onClick={() => setPaginaAtualSessoes((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaAtualSessoes >= totalPaginas}
                  style={{
                    background: paginaAtualSessoes >= totalPaginas ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                    border: `1px solid ${theme.border}`,
                    color: paginaAtualSessoes >= totalPaginas ? "#555" : theme.text,
                    padding: "5px 12px",
                    borderRadius: "6px",
                    cursor: paginaAtualSessoes >= totalPaginas ? "not-allowed" : "pointer",
                    fontSize: "12px",
                    fontWeight: "700"
                  }}
                >
                  Próxima ▶
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.whiteCard}>
          <div style={styles.cardHeader}>
            <span style={styles.dot}></span> Pontos em Aberto
          </div>
          {emServicoVisivel.length > 0 ? (
            emServicoVisivel
              .map((p) => (
                <div key={p.id} style={{ background: "rgba(255,0,0,0.08)", padding: "10px", borderRadius: "10px", marginBottom: "10px", opacity: p.oculto ? 0.6 : 1 }}>
                  <b>
                    {p.nome} {p.oculto && <span style={{ fontSize: "11px", color: theme.accent }}>(Oculto)</span>}
                  </b>
                  <div style={{ fontSize: "12px", color: theme.subtext }}>Desde: {formatarHorario(p.entrada)}</div>
                  <div style={{ color: theme.accent, fontWeight: "700" }}>Em andamento</div>
                  {(userIsAdmin || userIsRespPonto || isAdminOuDono(usuarioLogado?.role || "")) && (
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => fecharPontoAdmin(p.id)}
                        style={{ background: "#16a34a", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                      >
                        ✅ Fechar
                      </button>
                      {isAdminOuDono(usuarioLogado?.role || "") && (
                        <button
                          onClick={() => alternarVisibilidadePonto(p)}
                          style={{
                            background: p.oculto ? "#10b981" : "#6b7280",
                            color: "#fff",
                            border: "none",
                            padding: "5px 10px",
                            borderRadius: "7px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "700",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.oculto ? "👁️ Desocultar" : "🙈 Ocultar"}
                        </button>
                      )}
                      {userIsAdmin && (
                        <button
                          onClick={() => apagarPonto(p.id)}
                          style={{ background: "#7f1d1d", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                        >
                          🗑️ Apagar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
          ) : (
            <p style={{ color: "#888", textAlign: "center" }}>Ninguém em serviço</p>
          )}
        </div>
      </div>
    </div>
  );
}
