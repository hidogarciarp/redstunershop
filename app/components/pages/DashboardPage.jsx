import React, { useEffect, useState, useCallback } from "react";
import { REGRAS_PRECOS, TABELA_PRECOS } from "../../utils/constants";
import { supabase } from "../../utils/supabaseClient";
import { analisarServicoTunagem, TABELA_CAMALEAO } from "../../utils/calculadoraTunagem";
import { isAdminOuDono } from "../../utils/helpers";

export default function DashboardPage({
  styles,
  theme,
  passaporte,
  setPassaporte,
  cliente,
  setCliente,
  nomeMecanico,
  setNomeMecanico,
  autorizadoPor,
  setAutorizadoPor,
  camaleao1,
  setCamaleao1,
  camaleao2,
  setCamaleao2,
  camaleaoRodas,
  setCamaleaoRodas,
  quantidadeExtras,
  setQuantidadeExtras,
  fumaca,
  setFumaca,
  valorDigitadoEstetica,
  setValorDigitadoEstetica,
  formatarNumero,
  limparNumero,
  imagemPreview,
  handleFileChange,
  handlePasteEstetica,
  imagemPreview2,
  handleFileChange2,
  handlePasteEstetica2,
  kmGuincho,
  setKmGuincho,
  qtdReparos,
  setQtdReparos,
  qtdPneus,
  setQtdPneus,
  reboque,
  setReboque,
  reportBugs,
  setReportBugs,
  nomeVeiculoBugs,
  setNomeVeiculoBugs,
  descricaoBug,
  setDescricaoBug,
  previewBugs,
  handleFileBugs,
  handlePasteBugs,
  tabelas,
  servicosSelecionados,
  setServicosSelecionados,
  userPodeFinancas,
  adicionarNovoQuadro,
  listaAvisos,
  avisoSendoEditado,
  setAvisoSendoEditado,
  confirmarEdicaoQuadro,
  apagarQuadro,
  formatarTextoAvisos,
  calcularTotal,
  enviarParaDiscord,
  salvandoServico = false,
  historicoNitroRecente = [],
  formatarHorario,
  formatarDataHora,
  isDarkMode,
  blacklist = [],
  layoutPreferido = "lateral",
  usuarioLogado,
  setImagemPreview,
  setArquivoImagem,
  setImagemPreview2,
  setArquivoImagem2,
  tunagemRealtimeGlobal,
}) {
  const banInfo = blacklist.find(b => String(b.passaporte) === String(passaporte));
  const isBanido = !!banInfo;
  const avisoTopo = listaAvisos?.[0];
  const [avisoTopoOculto, setAvisoTopoOculto] = useState(false);

  useEffect(() => {
    setAvisoTopoOculto(false);
  }, [avisoTopo?.id]);

  // ===== AUTO-PREENCHIMENTO VIA LOGS DE TUNAGEM =====
  const isDonoAdmin = isAdminOuDono(usuarioLogado?.role) || usuarioLogado?.role?.includes("dono") || usuarioLogado?.role?.includes("admin");
  const [verTodosMecanicos, setVerTodosMecanicos] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("reds_dashboard_ver_todos_mecanicos") === "true";
    }
    return false;
  });

  const toggleVerTodosMecanicos = () => {
    setVerTodosMecanicos((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("reds_dashboard_ver_todos_mecanicos", String(next));
      }
      return next;
    });
  };

  const [logsRecentes, setLogsRecentes] = useState([]);
  const [carregandoLogs, setCarregandoLogs] = useState(false);
  const [logSelecionadoUuid, setLogSelecionadoUuid] = useState("");
  const [logAplicadoInfo, setLogAplicadoInfo] = useState(null);

  const carregarLogsRecentes = useCallback(async (mostrarTodos = verTodosMecanicos) => {
    const uId = String(usuarioLogado?.id || usuarioLogado?.id_jogo || "");
    const uNome = (usuarioLogado?.nome || nomeMecanico || "").trim();
    const canSeeAll = isDonoAdmin && mostrarTodos;

    if (!canSeeAll && !uId && !uNome) return;

    setCarregandoLogs(true);
    try {
      let query = supabase
        .from("logs_tunagem_reds")
        .select("*")
        .order("data", { ascending: false })
        .order("hora", { ascending: false })
        .limit(30);

      if (!canSeeAll) {
        if (uId && uNome) {
          query = query.or(`tecnico_id.eq.${uId},tecnico_nome.ilike.%${uNome}%`);
        } else if (uId) {
          query = query.eq("tecnico_id", uId);
        } else if (uNome) {
          query = query.ilike("tecnico_nome", `%${uNome}%`);
        }
      }

      const { data, error } = await query;
      if (!error && data) {
        setLogsRecentes(data);
      }
    } catch (e) {
      console.warn("Aviso ao carregar logs recentes para auto-preenchimento:", e);
    } finally {
      setCarregandoLogs(false);
    }
  }, [usuarioLogado, nomeMecanico, isDonoAdmin, verTodosMecanicos]);

  useEffect(() => {
    carregarLogsRecentes(verTodosMecanicos);

    const channel = supabase
      .channel("dashboard_logs_tunagem_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "logs_tunagem_reds" },
        (payload) => {
          if (payload.new) {
            const uId = String(usuarioLogado?.id || usuarioLogado?.id_jogo || "");
            const uNome = (usuarioLogado?.nome || nomeMecanico || "").toLowerCase().trim();
            const logTecId = String(payload.new.tecnico_id || "");
            const logTecNome = (payload.new.tecnico_nome || "").toLowerCase().trim();

            const isMeuLog = (uId && logTecId === uId) || (uNome && logTecNome.includes(uNome));

            if (isMeuLog || (isDonoAdmin && verTodosMecanicos)) {
              setLogsRecentes((prev) => {
                const filtered = prev.filter((l) => l.uuid !== payload.new.uuid);
                return [payload.new, ...filtered].slice(0, 30);
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregarLogsRecentes, usuarioLogado, nomeMecanico, isDonoAdmin, verTodosMecanicos]);

  // Quando uma notificação global de novo serviço chega em tempo real
  useEffect(() => {
    if (tunagemRealtimeGlobal?.log) {
      const novoLog = tunagemRealtimeGlobal.log;
      const isMeu = tunagemRealtimeGlobal.isMeu;

      if (isMeu || (isDonoAdmin && verTodosMecanicos)) {
        setLogsRecentes((prev) => {
          const filtered = prev.filter((l) => l.uuid !== novoLog.uuid);
          return [novoLog, ...filtered].slice(0, 30);
        });
      }
    }
  }, [tunagemRealtimeGlobal, isDonoAdmin, verTodosMecanicos]);

  const aplicarLogNoFormulario = (uuidEscolhido) => {
    setLogSelecionadoUuid(uuidEscolhido);
    if (!uuidEscolhido) {
      limparLogAplicado();
      return;
    }

    const log = logsRecentes.find((l) => l.uuid === uuidEscolhido);
    if (!log) return;

    // 1. Dados do Cliente e Veículo
    if (log.dono_id) setPassaporte(String(log.dono_id));
    if (log.dono_nome) {
      const nomeLog = log.dono_nome.trim();
      setCliente(nomeLog);

      // Substitui na base de dados de clientes pelo nome atualizado que veio da log
      if (log.dono_id) {
        const cid = Number(log.dono_id);
        (async () => {
          try {
            const { data: cliExistente } = await supabase
              .from("clientes")
              .select("id, nome")
              .eq("id", cid)
              .maybeSingle();

            if (cliExistente) {
              await supabase
                .from("clientes")
                .update({
                  nome: nomeLog,
                  ultima_alteracao: usuarioLogado?.id || null,
                  data_ultimo_servico: new Date().toISOString(),
                })
                .eq("id", cid);
            } else {
              await supabase
                .from("clientes")
                .insert({
                  id: cid,
                  nome: nomeLog,
                  total_gasto: 0,
                  ultima_alteracao: usuarioLogado?.id || null,
                  data_ultimo_servico: new Date().toISOString(),
                });
            }
          } catch (err) {
            console.warn("Aviso ao atualizar nome do cliente na base:", err);
          }
        })();
      }
    }

    // 2. Valor do Painel In-Game
    if (log.valor_pago !== undefined && log.valor_pago !== null) {
      setValorDigitadoEstetica(String(log.valor_pago));
    }

    // 3. Foto do serviço (se houver foto na log, exibe; se a log não tiver foto, exibe o campo em branco)
    if (typeof setImagemPreview === "function") {
      setImagemPreview(log.foto_url || null);
    }
    if (typeof setArquivoImagem === "function") {
      setArquivoImagem(null);
    }

    // 4. Analisar peças com o motor oficial de tunagem
    const analise = analisarServicoTunagem(log);
    const itens = analise.itensCobrados || [];
    const valorPagoNum = Number(log.valor_pago || 0);

    // 5. Camaleão (Primária, Secundária e Rodas)
    // Apenas marca se houve alteração real nesta sessão (detectada pelo diff oficial)
    let temCamaleao1 = false;
    let temCamaleao2 = false;
    let temCamaleaoRodas = false;

    itens.forEach((it) => {
      if (it.isCamaleao) {
        const desc = (it.descricao || "").toLowerCase();
        if (desc.includes("primária") || desc.includes("primaria")) temCamaleao1 = true;
        if (desc.includes("secundária") || desc.includes("secundaria")) temCamaleao2 = true;
        if (desc.includes("rodas") || desc.includes("roda")) temCamaleaoRodas = true;
      }
    });

    // Restrição matemática: Cada camaleão custa R$ 500 no painel in-game
    if (valorPagoNum > 0) {
      const maxCamaleao = Math.floor(valorPagoNum / 500);
      const countCamaleao = [temCamaleao1, temCamaleao2, temCamaleaoRodas].filter(Boolean).length;
      if (countCamaleao > maxCamaleao) {
        if (maxCamaleao === 0) {
          temCamaleao1 = false;
          temCamaleao2 = false;
          temCamaleaoRodas = false;
        } else if (maxCamaleao === 1) {
          if (temCamaleao1) { temCamaleao2 = false; temCamaleaoRodas = false; }
          else if (temCamaleao2) { temCamaleaoRodas = false; }
        } else if (maxCamaleao === 2) {
          if (temCamaleaoRodas) temCamaleaoRodas = false;
        }
      }
    }

    setCamaleao1(temCamaleao1);
    setCamaleao2(temCamaleao2);
    setCamaleaoRodas(temCamaleaoRodas);

    // 6. Fumaça de Pneu
    // Apenas marca se houve alteração real nesta sessão
    let temFumaca = false;
    if (itens.some((it) => (it.descricao || "").toLowerCase().includes("fumaça") && !it.descricao.toLowerCase().includes("remoção"))) {
      temFumaca = true;
    }
    // Restrição matemática: Fumaça custa R$ 5.000 no painel in-game. Se o valor pago for menor que 5.000, é matematicamente impossível.
    if (valorPagoNum > 0 && valorPagoNum < 5000) {
      temFumaca = false;
    }
    setFumaca(temFumaca);

    // 7. Extras
    let qtdExtrasFinal = 0;
    const itemExtra = itens.find((it) => (it.categoria || "") === "Acessórios" && (it.descricao || "").includes("Extra"));
    if (itemExtra) {
      const match = itemExtra.descricao.match(/(\d+)x/i);
      if (match) qtdExtrasFinal = Math.min(30, parseInt(match[1], 10));
    }
    // Restrição matemática: cada extra custa R$ 1.000 no painel
    if (valorPagoNum > 0) {
      const maxExtras = Math.floor(valorPagoNum / 1000);
      qtdExtrasFinal = Math.min(qtdExtrasFinal, maxExtras);
    }
    setQuantidadeExtras(qtdExtrasFinal);

    // 8. Performance (Motor, Freios, Transmissão, Suspensão, Blindagem, Turbo, Hidráulico)
    setServicosSelecionados((prev) => {
      const next = { ...prev };

      ["m0", "m1", "m2", "m3", "m4", "m5",
       "f0", "f1", "f2", "f3", "f4", "f5",
       "t0", "t1", "t2", "t3", "t4", "t5",
       "s0", "s1", "s2", "s3", "s4", "s5",
       "b0", "b1", "b2", "b3", "b4", "b5",
       "tu1", "h1"].forEach((k) => delete next[k]);

      itens.forEach((it) => {
        if (it.categoria === "Performance") {
          const desc = it.descricao || "";
          if (desc.startsWith("Motor")) {
            const m = desc.match(/Nível (\d)/i);
            const nivel = m ? m[1] : (desc.includes("Padrão") || desc.includes("Stock") ? "0" : null);
            if (nivel !== null) next["m" + nivel] = true;
          } else if (desc.startsWith("Freio")) {
            const m = desc.match(/Nível (\d)/i);
            const nivel = m ? m[1] : (desc.includes("Padrão") || desc.includes("Stock") ? "0" : null);
            if (nivel !== null) next["f" + nivel] = true;
          } else if (desc.startsWith("Transmissão")) {
            const m = desc.match(/Nível (\d)/i);
            const nivel = m ? m[1] : (desc.includes("Padrão") || desc.includes("Stock") ? "0" : null);
            if (nivel !== null) next["t" + nivel] = true;
          } else if (desc.startsWith("Suspensão") && !desc.includes("Hidráulica")) {
            const m = desc.match(/Nível (\d)/i);
            const nivel = m ? m[1] : (desc.includes("Padrão") || desc.includes("Stock") ? "0" : null);
            if (nivel !== null) next["s" + nivel] = true;
          } else if (desc.startsWith("Blindagem")) {
            const m = desc.match(/Nível (\d)/i);
            const nivel = m ? m[1] : (desc.includes("Padrão") || desc.includes("Stock") ? "0" : null);
            if (nivel !== null) next["b" + nivel] = true;
          } else if (desc.toLowerCase().includes("turbo")) {
            next["tu1"] = true;
          } else if (desc.toLowerCase().includes("hidráulic")) {
            next["h1"] = true;
          }
        }
      });

      return next;
    });

    if (typeof setNomeMecanico === "function" && log.tecnico_nome) {
      setNomeMecanico(log.tecnico_nome);
    }

    setLogAplicadoInfo({
      veiculo: log.veiculo_nome || log.veiculo_modelo || "Veículo",
      placa: log.placa || "Sem Placa",
      hora: log.hora ? log.hora.slice(0, 5) : "",
      valorPago: log.valor_pago || 0,
      itensQtd: itens.length,
      tecnicoNome: log.tecnico_nome || "",
      temFumaca: temFumaca,
      qtdExtras: qtdExtrasFinal,
      temCamaleao: temCamaleao1 || temCamaleao2 || temCamaleaoRodas,
    });
  };

  const limparLogAplicado = () => {
    setLogSelecionadoUuid("");
    setLogAplicadoInfo(null);
    setPassaporte("");
    setCliente("");
    if (typeof setNomeMecanico === "function" && usuarioLogado?.nome) {
      setNomeMecanico(usuarioLogado.nome);
    }
    setValorDigitadoEstetica("");
    setCamaleao1(false);
    setCamaleao2(false);
    setCamaleaoRodas(false);
    setFumaca(false);
    setQuantidadeExtras(0);
    setServicosSelecionados({});
    if (typeof setImagemPreview === "function") setImagemPreview(null);
    if (typeof setArquivoImagem === "function") setArquivoImagem(null);
    if (typeof setImagemPreview2 === "function") setImagemPreview2(null);
    if (typeof setArquivoImagem2 === "function") setArquivoImagem2(null);
  };

  return (
    <>
      {layoutPreferido === "lateral" && avisoTopo && !avisoTopoOculto && (
        <div style={{ margin: "18px 20px 0", padding: "13px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", borderRadius: "13px", border: "1px solid rgba(250,204,21,.3)", borderLeft: "4px solid #facc15", background: isDarkMode ? "rgba(30,24,8,.94)" : "rgba(255,251,235,.96)", boxShadow: "0 8px 24px rgba(0,0,0,.16)", color: theme.text }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", color: isDarkMode ? "#fde047" : "#a16207", fontSize: "13px", marginBottom: "4px" }}>{avisoTopo.titulo}</strong>
            <div style={{ color: theme.subtext, fontSize: "12px", lineHeight: 1.5 }}>{formatarTextoAvisos(avisoTopo.texto)}</div>
          </div>
          <button type="button" onClick={() => setAvisoTopoOculto(true)} title="Ocultar aviso" aria-label="Ocultar aviso" style={{ width: "28px", height: "28px", flexShrink: 0, borderRadius: "8px", border: `1px solid ${theme.border}`, background: theme.card2, color: theme.subtext, cursor: "pointer", fontSize: "17px", lineHeight: 1 }}>×</button>
        </div>
      )}
      <div style={styles.grid}>
        <section style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
          {/* SELETOR RÁPIDO: LOGS DE TUNAGEM RECENTES */}
          <div style={{
            ...styles.whiteCard,
            border: logAplicadoInfo 
              ? (isDarkMode ? "1.5px solid #10b981" : "1.5px solid #059669") 
              : (isDarkMode ? "1px solid rgba(255,255,255,0.1)" : `1px solid ${theme.border}`),
            background: logAplicadoInfo 
              ? (isDarkMode ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.04)") 
              : styles.whiteCard.background,
            boxShadow: logAplicadoInfo 
              ? "0 4px 20px rgba(16, 185, 129, 0.15)" 
              : styles.whiteCard.boxShadow,
            transition: "all 0.25s ease",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "16px" }}>⚡</span>
                <strong style={{ fontSize: "13.5px", fontWeight: "800", color: theme.text }}>
                  Pré-Preenchimento Automático via Log de Tunagem
                </strong>
                <span style={{ 
                  fontSize: "11px", 
                  fontWeight: "700", 
                  background: isDarkMode ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.15)", 
                  color: "#f59e0b", 
                  padding: "2px 8px", 
                  borderRadius: "6px" 
                }}>
                  FiveM Live
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {isDonoAdmin && (
                  <button
                    type="button"
                    onClick={toggleVerTodosMecanicos}
                    style={{
                      background: verTodosMecanicos 
                        ? (isDarkMode ? "rgba(139, 92, 246, 0.25)" : "rgba(139, 92, 246, 0.15)")
                        : (isDarkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)"),
                      border: `1px solid ${verTodosMecanicos ? "#8b5cf6" : theme.border}`,
                      color: verTodosMecanicos ? (isDarkMode ? "#c084fc" : "#7c3aed") : theme.subtext,
                      padding: "5px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s ease",
                    }}
                    title={verTodosMecanicos ? "Filtrando serviços de toda a oficina (Clique para ver apenas os seus)" : "Filtrando apenas seus serviços (Clique para ver de toda a oficina)"}
                  >
                    <span>{verTodosMecanicos ? "👥" : "👤"}</span>
                    <span>{verTodosMecanicos ? "Todos os Mecânicos" : "Apenas Meus"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => carregarLogsRecentes(verTodosMecanicos)}
                  disabled={carregandoLogs}
                  style={{
                    background: "transparent",
                    border: `1px solid ${theme.border}`,
                    color: theme.subtext,
                    padding: "5px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  title="Buscar novos logs agora"
                >
                  <span style={{ display: "inline-block", animation: carregandoLogs ? "spin 1s infinite linear" : "none" }}>🔄</span>
                  {carregandoLogs ? "Buscando..." : "Atualizar"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={logSelecionadoUuid}
                onChange={(e) => aplicarLogNoFormulario(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "260px",
                  background: theme.card2 || (isDarkMode ? "#1f1f1f" : "#f9fafb"),
                  border: `1px solid ${logAplicadoInfo ? "#10b981" : theme.border}`,
                  color: logSelecionadoUuid ? theme.text : theme.subtext,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: logSelecionadoUuid ? "700" : "500",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">
                  {carregandoLogs
                    ? "Carregando serviços recentes..."
                    : logsRecentes.length === 0
                    ? (verTodosMecanicos
                        ? "Nenhum log recente encontrado na oficina"
                        : "Nenhum log recente encontrado para o seu mecânico")
                    : "⚡ Selecione um serviço recente para pré-preencher o formulário..."}
                </option>
                {logsRecentes.map((l) => {
                  const hora = l.hora ? l.hora.slice(0, 5) : "";
                  const placa = l.placa || "S/ Placa";
                  const veiculo = l.veiculo_nome || l.veiculo_modelo || "Veículo";
                  const valor = Number(l.valor_pago || 0).toLocaleString("pt-BR");
                  const dono = l.dono_nome || (l.dono_id ? `ID #${l.dono_id}` : "Cliente");
                  const mecanicoInfo = (isDonoAdmin && verTodosMecanicos && l.tecnico_nome) ? ` — 🧑‍🔧 ${l.tecnico_nome}` : "";

                  return (
                    <option key={l.uuid} value={l.uuid}>
                      [{hora}] Placa: {placa} • {veiculo} • R$ {valor} ({dono}){mecanicoInfo}
                    </option>
                  );
                })}
              </select>

              {logAplicadoInfo && (
                <button
                  type="button"
                  onClick={limparLogAplicado}
                  style={{
                    background: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    color: "#ef4444",
                    padding: "9px 14px",
                    borderRadius: "10px",
                    fontSize: "12.5px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  title="Limpar formulário e desfazer seleção"
                >
                  <span>🧹</span> Limpar
                </button>
              )}
            </div>

            {logAplicadoInfo && (
              <div style={{
                marginTop: "12px",
                padding: "10px 14px",
                borderRadius: "10px",
                background: isDarkMode ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
                fontSize: "12.5px",
                color: isDarkMode ? "#34d399" : "#059669",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span>✅</span>
                  <span>
                    Pré-preenchido com sucesso: <b>{logAplicadoInfo.veiculo}</b> (Placa: <b>{logAplicadoInfo.placa}</b>)
                  </span>
                  {logAplicadoInfo.tecnicoNome && (
                    <span style={{ opacity: 0.9 }}>• 🧑‍🔧 <b>{logAplicadoInfo.tecnicoNome}</b></span>
                  )}
                  <span style={{ opacity: 0.85 }}>• Custo Painel: R$ {logAplicadoInfo.valorPago.toLocaleString("pt-BR")}</span>
                  <span style={{ opacity: 0.85 }}>• {logAplicadoInfo.itensQtd} itens detectados</span>
                  {logAplicadoInfo.temFumaca && (
                    <span style={{ background: isDarkMode ? "rgba(34, 197, 94, 0.2)" : "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", padding: "1px 7px", borderRadius: "6px", fontSize: "11px", fontWeight: "800", color: isDarkMode ? "#4ade80" : "#059669" }}>
                      💨 Fumaça
                    </span>
                  )}
                  {logAplicadoInfo.qtdExtras > 0 && (
                    <span style={{ background: isDarkMode ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.4)", padding: "1px 7px", borderRadius: "6px", fontSize: "11px", fontWeight: "800", color: isDarkMode ? "#93c5fd" : "#2563eb" }}>
                      🧩 {logAplicadoInfo.qtdExtras}x Extra(s)
                    </span>
                  )}
                  {logAplicadoInfo.temCamaleao && (
                    <span style={{ background: isDarkMode ? "rgba(168, 85, 247, 0.2)" : "rgba(168, 85, 247, 0.15)", border: "1px solid rgba(168, 85, 247, 0.4)", padding: "1px 7px", borderRadius: "6px", fontSize: "11px", fontWeight: "800", color: isDarkMode ? "#c084fc" : "#7c3aed" }}>
                      🦎 Camaleão
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "11px", fontWeight: "700", opacity: 0.85 }}>
                  Confira os dados abaixo e adicione o passaporte se necessário.
                </span>
              </div>
            )}
          </div>

          {/* INFORMAÇÕES DO CLIENTE */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Informações do Cliente
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "14px" }}>
              <div>
                <label style={styles.miniLabel}>Passaporte (ID)</label>
                {isBanido && (
                  <div style={{ 
                    background: "rgba(180,13,13,0.1)", 
                    border: "1px solid #b40d0d", 
                    borderRadius: "8px", 
                    padding: "8px", 
                    marginBottom: "8px",
                    fontSize: "11px"
                  }}>
                    <strong style={{ color: "#b40d0d", display: "block", marginBottom: "2px" }}>🚫 CLIENTE BANIDO</strong>
                    <span style={{ color: theme.text }}>{banInfo.motivo}</span>
                  </div>
                )}

                {historicoNitroRecente.length > 0 && (
                  <div style={{ 
                    position: "fixed",
                    top: "100px",
                    right: "30px",
                    zIndex: 9999,
                    width: "300px",
                    background: isDarkMode ? "rgba(10,10,10,0.98)" : "rgba(255,255,255,0.98)", 
                    border: `2px solid ${isDarkMode ? "#facc15" : "#b40d0d"}`, 
                    borderRadius: "16px", 
                    padding: "20px", 
                    boxShadow: isDarkMode ? "0 20px 40px rgba(0,0,0,0.8)" : "0 20px 40px rgba(0,0,0,0.15)",
                    backdropFilter: "blur(12px)",
                    fontSize: "13px",
                    color: theme.text,
                    animation: "fadeInRight 0.4s ease-out"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "15px" }}>
                      <span style={{ fontSize: "28px" }}>⚡</span>
                      <div>
                        <strong style={{ color: "#facc15", display: "block", fontSize: "15px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Nitro Recente</strong>
                        <span style={{ fontSize: "11px", color: theme.subtext }}>Últimas 12 horas de histórico</span>
                      </div>
                    </div>
                    
                    <div style={{ background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", borderRadius: "12px", padding: "14px", border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}` }}>
                      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        {historicoNitroRecente.map((h, i) => (
                          <li key={i} style={{ fontWeight: "700", color: isDarkMode ? "#fff" : "#000", fontSize: "13px" }}>
                            {formatarDataHora(h)}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ marginTop: "18px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", background: "rgba(250,204,21,0.1)", borderRadius: "8px" }}>
                      <span style={{ fontSize: "14px" }}>⚠️</span>
                      <span style={{ fontSize: "10px", color: "#facc15", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Atenção às regras de venda!
                      </span>
                    </div>

                    <style>{`
                      @keyframes fadeInRight {
                        from { opacity: 0; transform: translateX(50px); }
                        to { opacity: 1; transform: translateX(0); }
                      }
                    `}</style>
                  </div>
                )}
                <input
                  style={{ ...styles.input, border: isBanido ? `2px solid #b40d0d` : styles.input.border }}
                  placeholder="1234"
                  type="text"
                  inputMode="numeric"
                  value={passaporte}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setPassaporte(v);
                  }}
                />
              </div>
              <div>
                <label style={styles.miniLabel}>Nome do Cliente</label>
                <input
                  style={styles.input}
                  placeholder="Nome"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value.replace(/[0-9]/g, ""))}
                />
              </div>
              <div>
                <label style={styles.miniLabel}>Mecânico</label>
                <input style={{ ...styles.input, opacity: 0.7 }} value={nomeMecanico} readOnly />
              </div>
              <div>
                <label style={styles.miniLabel}>Autorizado Por</label>
                <input
                  style={styles.input}
                  placeholder="(Opcional)"
                  value={autorizadoPor}
                  onChange={(e) => setAutorizadoPor(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* VALOR DO PAINEL IN-GAME */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Valor do Painel In-Game
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "15px" }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: theme.text }}>
                  <input type="checkbox" checked={camaleao1} onChange={(e) => setCamaleao1(e.target.checked)} />
                  🦎 Camaleão Primária
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: theme.text }}>
                  <input type="checkbox" checked={camaleao2} onChange={(e) => setCamaleao2(e.target.checked)} />
                  🦎 Camaleão Secundária
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: theme.text }}>
                  <input type="checkbox" checked={camaleaoRodas} onChange={(e) => setCamaleaoRodas(e.target.checked)} />
                  🦎 Camaleão Rodas
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: theme.text, fontWeight: "600" }}>
                  <span>Extras</span>
                  <select
                    value={quantidadeExtras}
                    onChange={(e) => setQuantidadeExtras(Number(e.target.value))}
                    style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: "5px", padding: "2px 6px", outline: "none", cursor: "pointer" }}
                  >
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: theme.text }}>
                  <input type="checkbox" checked={fumaca} onChange={(e) => setFumaca(e.target.checked)} />
                  Fumaça
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: theme.green, fontWeight: "700" }}>R$</span>
                <input
                  style={styles.inputPrice}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatarNumero(valorDigitadoEstetica)}
                  onChange={(e) => setValorDigitadoEstetica(limparNumero(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* ESTÉTICA */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Extrato do Serviço
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>

              <div style={{ marginTop: "10px", padding: "12px", borderRadius: "10px", background: theme.card2, border: `1px solid ${theme.border}`, fontSize: "13px" }}>
              {(() => {
                  const rules = REGRAS_PRECOS.estetica;
                  const valorPainel = Number(valorDigitadoEstetica) || 0;
                  const somaExtrasPainel = quantidadeExtras * rules.painel_extra;
                  const valorExtrasFinal = quantidadeExtras * rules.valor_cliente_extra;
                  const valorFumacaPainel = fumaca ? rules.painel_fumaca : 0;
                  const valorFumacaFinal = fumaca ? rules.valor_cliente_fumaca : 0;
                  const qtdCamaleao = [camaleao1, camaleao2, camaleaoRodas].filter(Boolean).length;
                  const descontoCamaleao = qtdCamaleao * rules.painel_camaleao;

                  const todasPecas = Object.values(TABELA_PRECOS).flat();
                  const somaPainelPerformance = Object.keys(servicosSelecionados).reduce((acc, id) => {
                    if (!servicosSelecionados[id]) return acc;
                    const p = todasPecas.find((x) => x.id === id);
                    return acc + (p?.painel || 0);
                  }, 0);

                  // Itens de performance selecionados com seus preços ao cliente
                  const itensPerformance = Object.keys(servicosSelecionados)
                    .filter((id) => servicosSelecionados[id])
                    .map((id) => todasPecas.find((x) => x.id === id))
                    .filter(Boolean)
                    .filter((p) => p.preco > 0);

                  const custoPainelItensEspeciais = somaExtrasPainel + valorFumacaPainel + descontoCamaleao + somaPainelPerformance;
                  const isInconsistente = valorPainel > 0 && valorPainel < custoPainelItensEspeciais;

                  const valorBasePainel = Math.max(0, valorPainel - custoPainelItensEspeciais);
                  const valorEsteticaFinal = (valorBasePainel / rules.painel_referencia) * rules.valor_cliente_referencia;
                  const valorCamaleoes = qtdCamaleao * rules.valor_cliente_camaleao;
                  const totalEstetica = valorEsteticaFinal + valorCamaleoes + valorExtrasFinal + valorFumacaFinal;
                  const totalPerformance = itensPerformance.reduce((acc, p) => acc + p.preco, 0);

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {isInconsistente && (
                        <div style={{
                          padding: "10px 14px",
                          borderRadius: "8px",
                          background: "rgba(239, 68, 68, 0.12)",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                          color: "#ef4444",
                          fontSize: "12px",
                          fontWeight: "700",
                          marginBottom: "8px",
                          lineHeight: "1.4"
                        }}>
                          ⚠️ <strong>Inconsistência de Valores:</strong> O valor digitado do painel (R$ {valorPainel.toLocaleString("pt-BR")}) é menor que o custo mínimo in-game dos itens marcados (R$ {custoPainelItensEspeciais.toLocaleString("pt-BR")}). Fumaça, Camaleão ou Performance excedem o valor pago no jogo!
                        </div>
                      )}

                      {/* Performance */}
                      {itensPerformance.length > 0 && (
                        <>
                          <div style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
                            ⚙️ Performance
                          </div>
                          {itensPerformance.map((p) => (
                            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                              <span style={{ color: theme.text }}>
                                {p.nome}
                                {p.painel > 0 && (
                                  <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px" }}>
                                    (-R$ {p.painel.toLocaleString("pt-BR")})
                                  </span>
                                )}
                              </span>
                              <b style={{ color: theme.green }}>R$ {p.preco.toLocaleString("pt-BR")}</b>
                            </div>
                          ))}
                          <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: "2px", paddingTop: "4px", display: "flex", justifyContent: "space-between", fontWeight: "700", color: theme.subtext, fontSize: "12px" }}>
                            <span>
                              Subtotal Performance
                              {somaPainelPerformance > 0 && (
                                <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                                  (-R$ {somaPainelPerformance.toLocaleString("pt-BR")})
                                </span>
                              )}
                            </span>
                            <span>R$ {totalPerformance.toLocaleString("pt-BR")}</span>
                          </div>
                          <div style={{ height: "6px" }} />
                        </>
                      )}

                      {/* Estética */}
                      <div style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
                        🎨 Estética
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                        <span>
                          Estética base
                          {valorBasePainel > 0 && (
                            <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                              (-R$ {valorBasePainel.toLocaleString("pt-BR")})
                            </span>
                          )}
                        </span>
                        <b>R$ {valorEsteticaFinal.toLocaleString("pt-BR")}</b>
                      </div>
                      {valorCamaleoes > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                          <span>
                            🦎 Camaleão ({[camaleao1 && "Primária", camaleao2 && "Secundária", camaleaoRodas && "Rodas"].filter(Boolean).join(", ")})
                            <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                              (-R$ {descontoCamaleao.toLocaleString("pt-BR")})
                            </span>
                          </span>
                          <b>R$ {valorCamaleoes.toLocaleString("pt-BR")}</b>
                        </div>
                      )}
                      {valorExtrasFinal > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                          <span>
                            ✨ Extras ({quantidadeExtras}x)
                            <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                              (-R$ {somaExtrasPainel.toLocaleString("pt-BR")})
                            </span>
                          </span>
                          <b>R$ {valorExtrasFinal.toLocaleString("pt-BR")}</b>
                        </div>
                      )}
                      {valorFumacaFinal > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                          <span>
                            💨 Fumaça
                            <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                              (-R$ {valorFumacaPainel.toLocaleString("pt-BR")})
                            </span>
                          </span>
                          <b>R$ {valorFumacaFinal.toLocaleString("pt-BR")}</b>
                        </div>
                      )}

                      {/* Guincho / Atendimento */}
                      {(() => {
                        const km = Number(kmGuincho) || 0;
                        const custoGuincho = km > 0 ? REGRAS_PRECOS.guincho.valor_fixo + Math.ceil(km) * REGRAS_PRECOS.guincho.valor_km : 0;
                        const custoReparos = Number(qtdReparos) * REGRAS_PRECOS.guincho.valor_reparo;
                        const custoPneus = Number(qtdPneus) * REGRAS_PRECOS.guincho.valor_pneu;
                        const totalAtendimento = custoGuincho + custoReparos + custoPneus;
                        if (totalAtendimento === 0) return null;
                        return (
                          <>
                            <div style={{ height: "4px" }} />
                            <div style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
                              🚐 Atendimento
                            </div>
                            {custoGuincho > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                                <span>Guincho ({km} km)</span>
                                <b>R$ {custoGuincho.toLocaleString("pt-BR")}</b>
                              </div>
                            )}
                            {custoReparos > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                                <span>Kit Reparo ({qtdReparos}x)</span>
                                <b>R$ {custoReparos.toLocaleString("pt-BR")}</b>
                              </div>
                            )}
                            {custoPneus > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                                <span>Pneus ({qtdPneus}x)</span>
                                <b>R$ {custoPneus.toLocaleString("pt-BR")}</b>
                              </div>
                            )}
                            <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: "2px", paddingTop: "4px", display: "flex", justifyContent: "space-between", fontWeight: "700", color: theme.subtext, fontSize: "12px" }}>
                              <span>Subtotal Atendimento</span>
                              <span>R$ {totalAtendimento.toLocaleString("pt-BR")}</span>
                            </div>
                          </>
                        );
                      })()}

                      {/* Subtotal Estética */}
                      <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: "4px", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontWeight: "700", color: theme.subtext, fontSize: "12px" }}>
                        <span>
                          Subtotal Estética
                          {valorPainel > 0 && Math.max(0, valorPainel - somaPainelPerformance) > 0 && (
                            <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                              (-R$ {Math.max(0, valorPainel - somaPainelPerformance).toLocaleString("pt-BR")})
                            </span>
                          )}
                        </span>
                        <span>R$ {totalEstetica.toLocaleString("pt-BR")}</span>
                      </div>

                      {/* Total Geral */}
                      <div style={{ borderTop: `2px solid ${theme.accent}`, marginTop: "4px", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontWeight: "800", fontSize: "15px", color: theme.accent }}>
                        <span>Total Geral</span>
                        <span>R$ {calcularTotal().toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px", alignItems: "stretch" }}>
              <div style={{ ...styles.uploadArea, outline: "none", minWidth: 0 }} tabIndex={0} onPaste={handlePasteEstetica}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px", display: "block" }}>
                    {reboque ? "📸 Foto do Veículo Apreendido / Reboque" : "📸 Foto do VTuning / Referência"}
                  </span>
                  {imagemPreview && (
                    <>
                      <img 
                        src={imagemPreview} 
                        alt="preview" 
                        onError={() => {
                          console.warn("Imagem indisponível ou expirada no Discord:", imagemPreview);
                          if (typeof setImagemPreview === "function") setImagemPreview(null);
                        }}
                        style={{ borderRadius: "12px", maxHeight: "230px", maxWidth: "100%" }} 
                      />
                      <p style={{ color: theme.green, fontWeight: "700", margin: 0, fontSize: "13px" }}>✅ Imagem pronta!</p>
                    </>
                  )}
                  <label style={styles.uploadBtnLabel}>
                    {imagemPreview ? "🔄 Trocar imagem" : (reboque ? "📂 Clique ou COLE a foto do reboque" : "📂 Clique ou COLE (Ctrl+V) o print")}
                    <input type="file" accept="image/*" hidden onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              <div style={{ ...styles.uploadArea, outline: "none", minWidth: 0, borderColor: imagemPreview2 ? theme.green : theme.border }} tabIndex={0} onPaste={handlePasteEstetica2}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px", display: "block" }}>🚗 Foto do Resultado / Carro do Cliente <span style={{ color: theme.subtext, fontWeight: "400", textTransform: "none", fontSize: "10px" }}>(opcional)</span></span>
                  {imagemPreview2 && (
                    <>
                      <img 
                        src={imagemPreview2} 
                        alt="preview resultado" 
                        onError={() => {
                          console.warn("Imagem de resultado indisponível ou expirada no Discord:", imagemPreview2);
                          if (typeof setImagemPreview2 === "function") setImagemPreview2(null);
                        }}
                        style={{ borderRadius: "12px", maxHeight: "230px", maxWidth: "100%" }} 
                      />
                      <p style={{ color: theme.green, fontWeight: "700", margin: 0, fontSize: "13px" }}>✅ Foto do resultado pronta!</p>
                    </>
                  )}
                  <label style={{ ...styles.uploadBtnLabel, background: imagemPreview2 ? "rgba(43,255,0,0.08)" : undefined, borderColor: imagemPreview2 ? theme.green : undefined }}>
                    {imagemPreview2 ? "🔄 Trocar foto do resultado" : "📂 Clique ou COLE (Ctrl+V) o resultado"}
                    <input type="file" accept="image/*" hidden onChange={handleFileChange2} />
                  </label>
                </div>
              </div>
              </div>
            </div>
          </div>

          {/* GUINCHO */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Guincho / Atendimento
              <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "7px", cursor: "pointer", color: reboque ? theme.green : theme.subtext, fontSize: "12px", fontWeight: "800", textTransform: "none" }}>
                <input type="checkbox" checked={reboque} onChange={(e) => setReboque(e.target.checked)} />
                🚨 Serviço de Reboque (Apreensão)
              </label>
            </div>
            {reboque && (
              <div style={{ marginBottom: "12px", padding: "10px 12px", borderRadius: "9px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd", fontSize: "12px" }}>
                🚨 <b>Solicitação de Apreensão de Veículo pela Polícia:</b> somente a foto do serviço é obrigatória. Não é necessário informar dados do cliente.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px", opacity: reboque ? 0.45 : 1 }}>
              <div>
                <label style={styles.miniLabel}>Distância (KM)</label>
                <input
                  style={styles.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 5"
                  disabled={reboque}
                  value={formatarNumero(kmGuincho)}
                  onChange={(e) => setKmGuincho(limparNumero(e.target.value))}
                />
              </div>
              <div>
                <label style={styles.miniLabel}>Kit Reparo</label>
                <input
                  style={styles.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  disabled={reboque}
                  value={formatarNumero(qtdReparos)}
                  onChange={(e) => setQtdReparos(limparNumero(e.target.value))}
                />
              </div>
              <div>
                <label style={styles.miniLabel}>Pneus</label>
                <input
                  style={styles.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  disabled={reboque}
                  value={formatarNumero(qtdPneus)}
                  onChange={(e) => setQtdPneus(limparNumero(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* REPORTAR BUG */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Reportar Bug
            </div>
            <label style={{ cursor: "pointer", color: theme.text, display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
              <input type="checkbox" checked={reportBugs} onChange={(e) => setReportBugs(e.target.checked)} />
              Fazer um Report de Bug
            </label>
            {reportBugs && (
              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={styles.miniLabel}>Nome do Veículo</label>
                  <input
                    style={styles.input}
                    placeholder="Ex: Sultan RS"
                    value={nomeVeiculoBugs}
                    onChange={(e) => setNomeVeiculoBugs(e.target.value)}
                  />
                </div>
                <div>
                  <label style={styles.miniLabel}>Descrição do Bug</label>
                  <textarea
                    style={styles.textarea}
                    placeholder="Descreva o problema com detalhes..."
                    value={descricaoBug}
                    onChange={(e) => setDescricaoBug(e.target.value)}
                  />
                </div>
                <div style={{ ...styles.uploadArea, outline: "none" }} tabIndex={0} onPaste={handlePasteBugs}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    {previewBugs && (
                      <>
                        <img src={previewBugs} alt="bug" style={{ borderRadius: "8px", maxHeight: "120px" }} />
                        <p style={{ color: theme.green, fontWeight: "700", margin: 0, fontSize: "12px" }}>✅ Pronta!</p>
                      </>
                    )}
                    <label style={styles.uploadBtnLabel}>
                      {previewBugs ? "🔄 Trocar ou COLE (Ctrl+V)" : "📂 Enviar print ou COLE (Ctrl+V)"}
                      <input type="file" accept="image/*" hidden onChange={handleFileBugs} />
                    </label>
                  </div>
                </div>
                <small style={{ color: theme.subtext }}>⚠️ Solicite o nome na garagem</small>
              </div>
            )}
          </div>



          {/* PERFORMANCE */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Performance
            </div>
            <div style={styles.performanceGrid}>
              {["Motor", "Freios", "Transmissão", "Suspensão", "Blindagem", "Outros"].map((cat) => (
                <div key={cat}>
                  <p style={{ ...styles.miniLabel, color: theme.accent }}>{cat.toUpperCase()}</p>
                  {tabelas[cat].map((item) => (
                    <div key={item.id} style={styles.itemRow}>
                      <label style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer", fontSize: "13px" }}>
                        <input
                          type="checkbox"
                          checked={!!servicosSelecionados[item.id]}
                          onChange={() => {
                            setServicosSelecionados((p) => {
                              const next = { ...p };
                              if (cat === "Outros") {
                                if (next[item.id]) delete next[item.id];
                                else next[item.id] = true;
                              } else {
                                if (next[item.id]) {
                                  delete next[item.id];
                                } else {
                                  tabelas[cat].forEach((i) => delete next[i.id]);
                                  next[item.id] = true;
                                }
                              }
                              return next;
                            });
                          }}
                        />
                        {item.nome}
                      </label>
                      <span style={{ fontSize: "11px", color: theme.green, fontWeight: "700" }}>R$ {item.preco.toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ASIDE */}
        {layoutPreferido !== "lateral" && <aside style={{ width: "250px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          {userPodeFinancas() && (
            <button
              onClick={adicionarNovoQuadro}
              style={{
                background: theme.card2,
                border: `1px dashed ${theme.border}`,
                color: theme.text,
                padding: "10px",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "bold",
                width: "100%",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={(e) => (e.target.style.background = theme.card2)}
            >
              ➕ Adicionar Novo Quadro
            </button>
          )}

          {listaAvisos.map((aviso) => {
            const isEditando = avisoSendoEditado?.id === aviso.id;
            return (
              <div key={aviso.id} style={{ ...styles.whiteCard, padding: "14px", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  {isEditando ? (
                    <input
                      value={avisoSendoEditado.titulo}
                      onChange={(e) => setAvisoSendoEditado({ ...avisoSendoEditado, titulo: e.target.value })}
                      style={{ ...styles.input, width: "100%", padding: "4px 8px", fontSize: "13px", color: "#facc15", fontWeight: "bold", marginBottom: "6px" }}
                      placeholder="Título"
                    />
                  ) : (
                    <div style={{ ...styles.cardHeader, color: "#facc15", fontSize: "14px", marginBottom: "0", lineHeight: "1.2", flex: 1, wordWrap: "break-word" }}>
                      {aviso.titulo}
                    </div>
                  )}

                  {userPodeFinancas() && !isEditando && (
                    <button
                      style={{ background: "transparent", border: "none", color: theme.subtext, cursor: "pointer", fontSize: "12px", padding: "2px", marginLeft: "8px" }}
                      onClick={() => setAvisoSendoEditado({ ...aviso })}
                      title="Editar Quadro"
                    >
                      ✏️
                    </button>
                  )}
                </div>

                {isEditando ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <textarea
                      value={avisoSendoEditado.texto}
                      onChange={(e) => setAvisoSendoEditado({ ...avisoSendoEditado, texto: e.target.value })}
                      style={{ width: "100%", height: "200px", padding: "8px", borderRadius: "8px", background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, fontSize: "12px", resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        style={{ flex: 1, background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff", border: "none", padding: "6px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "11px" }}
                        onClick={confirmarEdicaoQuadro}
                      >
                        💾 Salvar
                      </button>
                      <button
                        style={{ flex: 1, background: "transparent", border: `1px solid ${theme.border}`, color: theme.text, padding: "6px", borderRadius: "6px", cursor: "pointer", fontSize: "11px" }}
                        onClick={() => setAvisoSendoEditado(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                    <button
                      style={{ background: "#7f1d1d", color: "#fff", border: "none", padding: "4px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "10px", marginTop: "4px" }}
                      onClick={() => apagarQuadro(aviso.id)}
                    >
                      🗑️ Deletar Quadro
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: "12px", color: theme.subtext, margin: "0", lineHeight: "1.5" }}>{formatarTextoAvisos(aviso.texto)}</p>
                )}
              </div>
            );
          })}
        </aside>}
      </div>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <div>
          <small style={{ color: theme.subtext, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>💰 Valor Total do Serviço</small>
          <br />
          <b style={{ color: theme.accent, fontSize: "24px", fontWeight: "800" }}>R$ {calcularTotal().toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b>
        </div>
        <button
          onClick={enviarParaDiscord}
          disabled={salvandoServico}
          style={{
            ...styles.btnRegister,
            opacity: salvandoServico ? 0.7 : 1,
            cursor: salvandoServico ? "not-allowed" : "pointer"
          }}
        >
          {salvandoServico ? "Registrando..." : (reboque ? "Registrar Apreensão →" : "Registrar Serviço →")}
        </button>
      </footer>
    </>
  );
}
