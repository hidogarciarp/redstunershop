import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../utils/supabaseClient";

// Helper: Calcula intersecção da sessão com o horário obrigatório (18:00 às 23:00 - Fuso Brasília)
function calcularMinutosPico(entradaStr, saidaStr) {
  if (!entradaStr || !saidaStr) return 0;
  const tEnt = new Date(entradaStr).getTime();
  const tSai = new Date(saidaStr).getTime();
  if (isNaN(tEnt) || isNaN(tSai) || tSai <= tEnt) return 0;

  let picoMin = 0;
  const dCur = new Date(tEnt);
  const dEnd = new Date(tSai);
  dCur.setHours(0, 0, 0, 0);

  while (dCur <= dEnd) {
    const ano = dCur.getFullYear();
    const mes = String(dCur.getMonth() + 1).padStart(2, "0");
    const dia = String(dCur.getDate()).padStart(2, "0");
    const dataStr = `${ano}-${mes}-${dia}`;

    const limiteInicio = new Date(`${dataStr}T18:00:00-03:00`).getTime();
    const limiteFim = new Date(`${dataStr}T23:00:00-03:00`).getTime();

    const start = Math.max(tEnt, limiteInicio);
    const end = Math.min(tSai, limiteFim);
    if (end > start) {
      picoMin += (end - start) / 60000;
    }
    dCur.setDate(dCur.getDate() + 1);
  }
  return picoMin;
}

// Formata minutos em "Xh Ymin"
function formatarMinutos(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return `${h}h ${resto.toString().padStart(2, "0")}m`;
}

// Retorna as semanas (Segunda a Domingo) contidas no intervalo
function gerarSemanasDoIntervalo(inicioStr, fimStr) {
  if (!inicioStr || !fimStr) return [];
  const [aI, mI, dI] = inicioStr.split("-").map(Number);
  const [aF, mF, dF] = fimStr.split("-").map(Number);

  let cur = new Date(aI, mI - 1, dI, 12, 0, 0);
  const end = new Date(aF, mF - 1, dF, 12, 0, 0);

  // Ajusta cur para a segunda-feira da semana de início
  const diaSemanaIni = cur.getDay(); // 0 = Dom, 1 = Seg ...
  const recuoSegunda = diaSemanaIni === 0 ? 6 : diaSemanaIni - 1;
  cur.setDate(cur.getDate() - recuoSegunda);

  const semanas = [];
  let index = 1;

  while (cur <= end) {
    const seg = new Date(cur);
    const dom = new Date(cur);
    dom.setDate(dom.getDate() + 6);

    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fmtBr = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

    semanas.push({
      numero: index++,
      label: `Semana ${index - 1} (${fmtBr(seg)} a ${fmtBr(dom)})`,
      inicio: fmt(seg),
      fim: fmt(dom),
    });

    cur.setDate(cur.getDate() + 7);
  }

  return semanas;
}

export default function SorteioPage({ styles, theme, usuarioLogado, setPaginaAtual }) {
  const isDono = useMemo(() => {
    const role = (usuarioLogado?.role || "").toLowerCase();
    return role.includes("dono") || role.includes("admin");
  }, [usuarioLogado]);

  // Carrega configurações pré-definidas ou salvas
  const [premiacao, setPremiacao] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("reds_sorteio_premiacao") || "🏆 1º Lugar: R$ 500.000 + 1 Carro VIP";
    }
    return "🏆 1º Lugar: R$ 500.000 + 1 Carro VIP";
  });

  const [tipoPeriodo, setTipoPeriodo] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("reds_sorteio_tipo_periodo") || "quinzenal";
    }
    return "quinzenal";
  });

  const [dataInicio, setDataInicio] = useState(() => {
    if (typeof window !== "undefined") {
      const salvo = localStorage.getItem("reds_sorteio_data_inicio");
      if (salvo) return salvo;
    }
    const hoje = new Date();
    const duasSemanasAtras = new Date(hoje.getTime() - 14 * 86400000);
    return duasSemanasAtras.toISOString().split("T")[0];
  });

  const [dataFim, setDataFim] = useState(() => {
    if (typeof window !== "undefined") {
      const salvo = localStorage.getItem("reds_sorteio_data_fim");
      if (salvo) return salvo;
    }
    return new Date().toISOString().split("T")[0];
  });

  const [excluirDonos, setExcluirDonos] = useState(() => {
    if (typeof window !== "undefined") {
      const salvo = localStorage.getItem("reds_sorteio_excluir_donos");
      return salvo !== null ? salvo === "true" : true;
    }
    return true;
  });

  const [tetoAtivo, setTetoAtivo] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("reds_sorteio_teto_ativo") === "true";
    }
    return false;
  });

  const [tetoValor, setTetoValor] = useState(() => {
    if (typeof window !== "undefined") {
      const salvo = localStorage.getItem("reds_sorteio_teto_valor");
      return salvo ? Number(salvo) : 30;
    }
    return 30;
  });

  // Homologação / Validação Oficial salva no localStorage
  const [sorteioHomologado, setSorteioHomologado] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const salvo = localStorage.getItem("reds_sorteio_homologado");
        return salvo ? JSON.parse(salvo) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [modoVisao, setModoVisao] = useState("admin"); // "admin" | "funcionario"
  const [filtroBusca, setFiltroBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sessoes, setSessoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Roleta Interativa
  const [modalRoleta, setModalRoleta] = useState(false);
  const [roletaGirando, setRoletaGirando] = useState(false);
  const [candidatoDestaque, setCandidatoDestaque] = useState(null);
  const [vencedorSorteado, setVencedorSorteado] = useState(null);
  const [historicoVencedores, setHistoricoVencedores] = useState([]);
  const animIntervalRef = useRef(null);

  // Salva alterações de config no localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("reds_sorteio_premiacao", premiacao);
      localStorage.setItem("reds_sorteio_tipo_periodo", tipoPeriodo);
      localStorage.setItem("reds_sorteio_data_inicio", dataInicio);
      localStorage.setItem("reds_sorteio_data_fim", dataFim);
      localStorage.setItem("reds_sorteio_excluir_donos", String(excluirDonos));
      localStorage.setItem("reds_sorteio_teto_ativo", String(tetoAtivo));
      localStorage.setItem("reds_sorteio_teto_valor", String(tetoValor));
    }
  }, [premiacao, tipoPeriodo, dataInicio, dataFim, excluirDonos, tetoAtivo, tetoValor]);

  // Aplica atalhos de período rápido
  const aplicarAtalhoPeriodo = (tipo) => {
    setTipoPeriodo(tipo);
    const hoje = new Date();
    const fmt = (d) => d.toISOString().split("T")[0];

    if (tipo === "quinzenal") {
      const dIni = new Date(hoje.getTime() - 14 * 86400000);
      setDataInicio(fmt(dIni));
      setDataFim(fmt(hoje));
    } else if (tipo === "mensal") {
      const dIni = new Date(hoje.getTime() - 28 * 86400000);
      setDataInicio(fmt(dIni));
      setDataFim(fmt(hoje));
    } else if (tipo === "mes_atual") {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      setDataInicio(fmt(primeiroDia));
      setDataFim(fmt(hoje));
    }
  };

  // Carrega sessões de ponto e lista de usuários
  const carregarDadosSorteio = async () => {
    setCarregando(true);
    setFeedbackMsg("");
    try {
      const [resSessoes, resUsers] = await Promise.all([
        supabase
          .from("log_ponto")
          .select("id, usuario_id, nome, entrada, saida, data, total_minutos, mecanica_id")
          .gte("data", dataInicio)
          .lte("data", dataFim)
          .eq("mecanica_id", "reds"),
        supabase
          .from("usuarios")
          .select("id, nome, role, status, oculto_hierarquia"),
      ]);

      if (resSessoes.error) throw resSessoes.error;
      if (resUsers.error) throw resUsers.error;

      setSessoes(resSessoes.data || []);
      setUsuarios(resUsers.data || []);
      setFeedbackMsg("✅ Dados recalculados com sucesso!");
      setTimeout(() => setFeedbackMsg(""), 3500);
    } catch (err) {
      console.error("Erro ao carregar dados do sorteio:", err);
      setFeedbackMsg("❌ Erro ao buscar dados de sessões.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosSorteio();
  }, [dataInicio, dataFim]);

  // Semanas do período
  const semanasPeriodo = useMemo(() => {
    return gerarSemanasDoIntervalo(dataInicio, dataFim);
  }, [dataInicio, dataFim]);

  // Processamento e Cálculo dos Tickets por Usuário
  const resultadoCalculado = useMemo(() => {
    if (!usuarios || usuarios.length === 0) return { ranking: [], totalTicketsPool: 0 };

    const mapaUsuarios = new Map();

    // Inicializa todos os usuários ativos
    usuarios.forEach((u) => {
      if (u.status && u.status !== "ativo") return;
      if (u.oculto_hierarquia) return;

      const roleLower = (u.role || "").toLowerCase();
      const ehDono = roleLower.includes("dono") || roleLower.includes("admin");
      if (excluirDonos && ehDono) return;

      mapaUsuarios.set(String(u.id), {
        id: String(u.id),
        nome: u.nome,
        role: u.role || "Mecânico",
        ehDono,
        totalMinutosGeral: 0,
        totalMinutosPicoGeral: 0,
        semanasDetalhadas: [],
        ticketsTotal: 0,
        ticketsBase: 0,
        ticketsPico: 0,
        semanasElegiveis: 0,
      });
    });

    // Processa semana a semana
    semanasPeriodo.forEach((sem) => {
      const sessoesSemana = sessoes.filter((s) => {
        const d = s.data || (s.entrada ? s.entrada.split("T")[0] : "");
        return d >= sem.inicio && d <= sem.fim;
      });

      // Agrupa minutos nesta semana por usuário
      const minPorUserNaSemana = {};

      sessoesSemana.forEach((s) => {
        const uid = String(s.usuario_id);
        if (!minPorUserNaSemana[uid]) {
          minPorUserNaSemana[uid] = { totalMin: 0, picoMin: 0 };
        }
        const mTot = s.total_minutos || (s.saida && s.entrada ? (new Date(s.saida) - new Date(s.entrada)) / 60000 : 0);
        minPorUserNaSemana[uid].totalMin += Math.max(0, mTot);
        minPorUserNaSemana[uid].picoMin += calcularMinutosPico(s.entrada, s.saida);
      });

      // Aplica a regra de negócio do sorteio:
      // Apenas quem tiver feito 4h+ (240 min) na semana ganha tickets
      mapaUsuarios.forEach((user, uid) => {
        const dadosSem = minPorUserNaSemana[uid] || { totalMin: 0, picoMin: 0 };
        const bateuMinimo = dadosSem.totalMin >= 240;

        let tBase = 0;
        let tPico = 0;
        let tSemana = 0;

        if (bateuMinimo) {
          tBase = Math.floor(dadosSem.totalMin / 60);
          tPico = Math.floor(dadosSem.picoMin / 60);
          tSemana = tBase + tPico;
          if (tetoAtivo && tetoValor > 0) {
            tSemana = Math.min(tSemana, tetoValor);
          }
        }

        user.totalMinutosGeral += dadosSem.totalMin;
        user.totalMinutosPicoGeral += dadosSem.picoMin;
        user.ticketsBase += tBase;
        user.ticketsPico += tPico;
        user.ticketsTotal += tSemana;
        if (bateuMinimo) user.semanasElegiveis++;

        user.semanasDetalhadas.push({
          semana: sem.label,
          totalMin: dadosSem.totalMin,
          picoMin: dadosSem.picoMin,
          bateuMinimo,
          ticketsBase: tBase,
          ticketsPico: tPico,
          ticketsSemana: tSemana,
        });
      });
    });

    // Ordena pelo total de tickets (decrescente)
    const ranking = Array.from(mapaUsuarios.values()).sort((a, b) => {
      if (b.ticketsTotal !== a.ticketsTotal) return b.ticketsTotal - a.ticketsTotal;
      return b.totalMinutosGeral - a.totalMinutosGeral;
    });

    const totalTicketsPool = ranking.reduce((acc, u) => acc + u.ticketsTotal, 0);

    // Calcula chance percentual de cada um
    ranking.forEach((u) => {
      u.chancePct = totalTicketsPool > 0 ? (u.ticketsTotal / totalTicketsPool) * 100 : 0;
    });

    return { ranking, totalTicketsPool };
  }, [usuarios, sessoes, semanasPeriodo, excluirDonos, tetoAtivo, tetoValor]);

  // Homologar e travar o sorteio como oficial no localStorage
  const homologarSorteio = () => {
    const payload = {
      validadoEm: new Date().toISOString(),
      validadoPor: usuarioLogado?.nome || "Diretoria Reds",
      premiacao,
      tipoPeriodo,
      dataInicio,
      dataFim,
      excluirDonos,
      tetoAtivo,
      tetoValor,
      totalTicketsPool: resultadoCalculado.totalTicketsPool,
      ranking: resultadoCalculado.ranking,
    };

    localStorage.setItem("reds_sorteio_homologado", JSON.stringify(payload));
    setSorteioHomologado(payload);
    setFeedbackMsg("🎉 Sorteio homologado com sucesso! Os bilhetes oficiais estão travados.");
    setTimeout(() => setFeedbackMsg(""), 4000);
  };

  // Copia mensagem pronta para colar no canal de avisos do Discord
  const copiarTextoDiscord = () => {
    const dataIniBr = dataInicio.split("-").reverse().join("/");
    const dataFimBr = dataFim.split("-").reverse().join("/");

    let msg = `🎟️ **SORTEIO OFICIAL - RED'S TUNERSHOP** 🎟️\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🏆 **Premiação:** ${premiacao}\n`;
    msg += `📅 **Período de Apuração:** ${dataIniBr} até ${dataFimBr}\n\n`;
    msg += `📋 **Regras de Bilhetes:**\n`;
    msg += `• Mínimo de 4h semanais para validar bilhetes daquela semana\n`;
    msg += `• 1 bilhete a cada 60min trabalhados na semana\n`;
    msg += `• +1 bilhete adicional por cada 60min no Horário Obrigatório (18h às 23h)\n`;
    if (tetoAtivo) msg += `• Teto máximo semanal: ${tetoValor} bilhetes/semana\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🎫 **BILHETES ACUMULADOS:**\n\n`;

    const ranking = (sorteioHomologado?.ranking || resultadoCalculado.ranking).filter((u) => u.ticketsTotal > 0);

    if (ranking.length === 0) {
      msg += `*Nenhum funcionário elegível ou com tickets no período ainda.*\n`;
    } else {
      ranking.forEach((u, i) => {
        const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "▫️";
        msg += `${medalha} **${u.nome}** (ID: ${u.id}) — **${u.ticketsTotal} bilhetes** (${u.chancePct.toFixed(1)}% de chance)\n`;
      });
    }

    msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🎲 Total de bilhetes concorrendo: **${sorteioHomologado?.totalTicketsPool || resultadoCalculado.totalTicketsPool}**\n`;
    msg += `Boa sorte a todos os mecânicos da Reds! 🚗💨`;

    navigator.clipboard.writeText(msg);
    setFeedbackMsg("📋 Anúncio copiado para a área de transferência! Cole no Discord.");
    setTimeout(() => setFeedbackMsg(""), 4000);
  };

  // Executa o sorteio com animação de roleta
  const iniciarGiroRoleta = () => {
    const rankingAtivo = (sorteioHomologado?.ranking || resultadoCalculado.ranking).filter((u) => u.ticketsTotal > 0);
    if (rankingAtivo.length === 0) {
      alert("Nenhum funcionário possui bilhetes válidos para sortear.");
      return;
    }

    // Cria o tambor de bilhetes onde cada funcionário entra N vezes (N = tickets)
    const tamborBilhetes = [];
    rankingAtivo.forEach((u) => {
      for (let i = 0; i < u.ticketsTotal; i++) {
        tamborBilhetes.push(u);
      }
    });

    // Escolhe o vencedor aleatoriamente baseado no peso
    const indiceSorteado = Math.floor(Math.random() * tamborBilhetes.length);
    const vencedorReal = tamborBilhetes[indiceSorteado];

    setRoletaGirando(true);
    setVencedorSorteado(null);

    // Animação de rotação com desaceleração (easing)
    let velocidade = 50;
    let tempoTotal = 0;
    const duracaoTotal = 4500; // 4.5 segundos girando

    const girarPasso = () => {
      const candidatoRandomico = rankingAtivo[Math.floor(Math.random() * rankingAtivo.length)];
      setCandidatoDestaque(candidatoRandomico);

      tempoTotal += velocidade;
      if (tempoTotal < duracaoTotal) {
        // Desacelera nos últimos 1.5s
        if (tempoTotal > duracaoTotal - 1500) {
          velocidade += 35;
        }
        animIntervalRef.current = setTimeout(girarPasso, velocidade);
      } else {
        // Para no vencedor oficial
        setCandidatoDestaque(vencedorReal);
        setVencedorSorteado(vencedorReal);
        setRoletaGirando(false);
        setHistoricoVencedores((prev) => [
          {
            vencedor: vencedorReal,
            dataHora: new Date().toLocaleTimeString("pt-BR"),
            lugar: prev.length + 1,
          },
          ...prev,
        ]);
      }
    };

    girarPasso();
  };

  // Dados do funcionário logado
  const dadosMeuBilhete = useMemo(() => {
    const lista = sorteioHomologado?.ranking || resultadoCalculado.ranking;
    return lista.find((u) => String(u.id) === String(usuarioLogado?.id));
  }, [sorteioHomologado, resultadoCalculado, usuarioLogado]);

  const listaExibicao = (sorteioHomologado?.ranking || resultadoCalculado.ranking).filter((u) => {
    if (!filtroBusca) return true;
    const termo = filtroBusca.toLowerCase();
    return u.nome.toLowerCase().includes(termo) || String(u.id).includes(termo);
  });

  return (
    <div style={{ ...styles.dashContainer, padding: "24px 32px", maxWidth: "1280px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* Barra de Notificação de Feedback */}
      {feedbackMsg && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 999999,
          background: "rgba(15, 23, 42, 0.95)", border: "1.5px solid #22c55e",
          color: "#fff", padding: "12px 20px", borderRadius: "10px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)", fontWeight: "700", fontSize: "14px",
          animation: "fadeIn 0.3s ease"
        }}>
          {feedbackMsg}
        </div>
      )}

      {/* Cabeçalho da Página */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => setPaginaAtual("dashboard")}
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#cbd5e1", padding: "6px 14px", borderRadius: "8px", cursor: "pointer",
                fontSize: "12px", fontWeight: "700"
              }}
            >
              ← Voltar
            </button>
            <h1 style={{ color: "#ffffff", margin: 0, fontWeight: "900", fontSize: "24px", fontFamily: "'Outfit', sans-serif" }}>
              🎟️ Sistema de Sorteios & Bilhetes da Reds
            </h1>
          </div>
          <p style={{ color: theme.subtext, margin: "6px 0 0 0", fontSize: "13px" }}>
            Incentivo por produtividade e presença no horário de funcionamento obrigatório (18h às 23h).
          </p>
        </div>

        {/* Botão de Alternar Visão (exclusivo para Dono) */}
        {isDono && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", color: theme.subtext, fontWeight: "600" }}>Modo de Visualização:</span>
            <div style={{ display: "flex", background: "rgba(0,0,0,0.4)", padding: "3px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <button
                onClick={() => setModoVisao("admin")}
                style={{
                  background: modoVisao === "admin" ? "#8b181e" : "transparent",
                  color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px",
                  fontSize: "12px", fontWeight: "800", cursor: "pointer"
                }}
              >
                🛠️ Painel do Dono
              </button>
              <button
                onClick={() => setModoVisao("funcionario")}
                style={{
                  background: modoVisao === "funcionario" ? "#8b181e" : "transparent",
                  color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px",
                  fontSize: "12px", fontWeight: "800", cursor: "pointer"
                }}
              >
                👤 Visão do Mecânico
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CARD 1: BANNER DE PREMIAÇÃO OFICIAL */}
      <div style={{
        background: "linear-gradient(135deg, rgba(139, 24, 30, 0.4) 0%, rgba(20, 20, 20, 0.95) 100%)",
        border: "1.5px solid rgba(245, 158, 11, 0.4)",
        boxShadow: "0 8px 32px rgba(139, 24, 30, 0.2)",
        borderRadius: "16px", padding: "24px", marginBottom: "24px", position: "relative"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ flex: "1 1 320px" }}>
            <span style={{
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              color: "#000", fontWeight: "900", fontSize: "11px", padding: "3px 10px",
              borderRadius: "20px", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px"
            }}>
              ⭐ Premiação do Período
            </span>

            {isDono && modoVisao === "admin" ? (
              <div style={{ marginTop: "6px" }}>
                <label style={{ fontSize: "12px", color: "#fcd34d", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                  Defina o texto do prêmio (aparece destacado para todos):
                </label>
                <input
                  type="text"
                  value={premiacao}
                  onChange={(e) => setPremiacao(e.target.value)}
                  placeholder="Ex: 🏆 1º Lugar: R$ 500.000 + 1 Carro VIP"
                  style={{
                    width: "100%", maxWidth: "600px", padding: "10px 14px",
                    background: "rgba(0,0,0,0.6)", border: "1px solid rgba(245, 158, 11, 0.5)",
                    borderRadius: "8px", color: "#fff", fontSize: "16px", fontWeight: "800"
                  }}
                />
              </div>
            ) : (
              <h2 style={{ color: "#fef08a", margin: "4px 0", fontSize: "22px", fontWeight: "900", fontFamily: "'Outfit', sans-serif" }}>
                {premiacao || "Premiação a definir pela diretoria"}
              </h2>
            )}

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "12px", fontSize: "13px", color: "#cbd5e1" }}>
              <span>📅 Período: <strong>{dataInicio.split("-").reverse().join("/")}</strong> até <strong>{dataFim.split("-").reverse().join("/")}</strong></span>
              <span>🎫 Total de Bilhetes no Tambor: <strong style={{ color: "#22c55e" }}>{sorteioHomologado?.totalTicketsPool || resultadoCalculado.totalTicketsPool} bilhetes</strong></span>
              {sorteioHomologado && (
                <span style={{ color: "#4ade80", fontWeight: "700" }}>
                  ✅ Sorteio Homologado em {new Date(sorteioHomologado.validadoEm).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </div>

          {/* Botões de Ação Rápida no Topo */}
          {isDono && modoVisao === "admin" && (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={homologarSorteio}
                style={{
                  background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                  color: "#fff", border: "none", padding: "10px 18px", borderRadius: "10px",
                  fontWeight: "900", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                  boxShadow: "0 4px 14px rgba(34,197,94,0.3)"
                }}
              >
                ✅ Homologar Sorteio
              </button>

              <button
                onClick={() => setModalRoleta(true)}
                style={{
                  background: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
                  color: "#000", border: "none", padding: "10px 18px", borderRadius: "10px",
                  fontWeight: "900", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                  boxShadow: "0 4px 14px rgba(245,158,11,0.3)"
                }}
              >
                🎲 Abrir Roleta / Sortear
              </button>

              <button
                onClick={copiarTextoDiscord}
                style={{
                  background: "rgba(59, 130, 246, 0.2)",
                  color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.4)",
                  padding: "10px 16px", borderRadius: "10px",
                  fontWeight: "800", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
                }}
              >
                📋 Copiar p/ Discord
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SEÇÃO DO FUNCIONÁRIO (SEUS TICKETS E CHANCES) */}
      {(modoVisao === "funcionario" || !isDono) && (
        <div style={{
          background: "rgba(22, 22, 22, 0.9)", border: "1.5px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "14px", padding: "20px", marginBottom: "24px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#38bdf8", textTransform: "uppercase", letterSpacing: "1px" }}>Seu Desempenho no Sorteio</span>
              <h3 style={{ margin: "2px 0 0 0", color: "#fff", fontSize: "18px", fontWeight: "800" }}>
                {dadosMeuBilhete ? dadosMeuBilhete.nome : usuarioLogado?.nome}
              </h3>
            </div>
            {dadosMeuBilhete && dadosMeuBilhete.ticketsTotal > 0 ? (
              <span style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "800" }}>
                Elegível ao Sorteio ✅
              </span>
            ) : (
              <span style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "800" }}>
                Abaixo do mínimo de 4h na semana ❌
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: theme.subtext }}>Seus Bilhetes</div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: "#f59e0b", margin: "4px 0" }}>
                🎟️ {dadosMeuBilhete?.ticketsTotal || 0}
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext }}>
                {dadosMeuBilhete ? `${dadosMeuBilhete.ticketsBase} base + ${dadosMeuBilhete.ticketsPico} pico` : "0 base + 0 pico"}
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: theme.subtext }}>Sua Chance Estimada</div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: "#38bdf8", margin: "4px 0" }}>
                {dadosMeuBilhete?.chancePct ? `${dadosMeuBilhete.chancePct.toFixed(1)}%` : "0.0%"}
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext }}>
                de {sorteioHomologado?.totalTicketsPool || resultadoCalculado.totalTicketsPool} bilhetes totais
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: theme.subtext }}>Horas no Período</div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#fff", margin: "8px 0" }}>
                ⏱️ {formatarMinutos(dadosMeuBilhete?.totalMinutosGeral || 0)}
              </div>
              <div style={{ fontSize: "11px", color: "#4ade80", fontWeight: "700" }}>
                ⭐ {formatarMinutos(dadosMeuBilhete?.totalMinutosPicoGeral || 0)} no pico (18h-23h)
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: theme.subtext }}>Semanas com 4h+ Batidas</div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#fff", margin: "8px 0" }}>
                📅 {dadosMeuBilhete?.semanasElegiveis || 0} / {semanasPeriodo.length}
              </div>
              <div style={{ fontSize: "11px", color: theme.subtext }}>
                {dadosMeuBilhete?.semanasElegiveis === semanasPeriodo.length ? "Todas semanas pontuadas!" : "Apenas semanas válidas pontuam"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAINEL DE CONFIGURAÇÕES E AUDITORIA (VISÍVEL APENAS PARA DONO NO MODO ADMIN) */}
      {isDono && modoVisao === "admin" && (
        <div style={{
          background: "rgba(18, 18, 18, 0.95)", border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "14px", padding: "20px", marginBottom: "24px"
        }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#fff", fontSize: "16px", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
            ⚙️ Configurações & Auditoria do Período
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", alignItems: "end" }}>
            {/* Seletor de Tipo de Período */}
            <div>
              <label style={{ fontSize: "12px", color: theme.subtext, fontWeight: "700", display: "block", marginBottom: "6px" }}>Atalhos de Período:</label>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => aplicarAtalhoPeriodo("quinzenal")}
                  style={{
                    flex: 1, padding: "8px 6px", borderRadius: "6px", cursor: "pointer",
                    background: tipoPeriodo === "quinzenal" ? "#8b181e" : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "11.5px", fontWeight: "700"
                  }}
                >
                  Quinzenal (14d)
                </button>
                <button
                  onClick={() => aplicarAtalhoPeriodo("mensal")}
                  style={{
                    flex: 1, padding: "8px 6px", borderRadius: "6px", cursor: "pointer",
                    background: tipoPeriodo === "mensal" ? "#8b181e" : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "11.5px", fontWeight: "700"
                  }}
                >
                  Mensal (28d)
                </button>
                <button
                  onClick={() => aplicarAtalhoPeriodo("mes_atual")}
                  style={{
                    flex: 1, padding: "8px 6px", borderRadius: "6px", cursor: "pointer",
                    background: tipoPeriodo === "mes_atual" ? "#8b181e" : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "11.5px", fontWeight: "700"
                  }}
                >
                  Mês Atual
                </button>
              </div>
            </div>

            {/* Data Início */}
            <div>
              <label style={{ fontSize: "12px", color: theme.subtext, fontWeight: "700", display: "block", marginBottom: "6px" }}>Data Início:</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => { setDataInicio(e.target.value); setTipoPeriodo("personalizado"); }}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: "8px",
                  background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff", fontSize: "13px", fontWeight: "700"
                }}
              />
            </div>

            {/* Data Fim */}
            <div>
              <label style={{ fontSize: "12px", color: theme.subtext, fontWeight: "700", display: "block", marginBottom: "6px" }}>Data Fim:</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => { setDataFim(e.target.value); setTipoPeriodo("personalizado"); }}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: "8px",
                  background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff", fontSize: "13px", fontWeight: "700"
                }}
              />
            </div>

            {/* Botão Recalcular */}
            <div>
              <button
                onClick={carregarDadosSorteio}
                disabled={carregando}
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px",
                  background: carregando ? "rgba(255,255,255,0.1)" : "rgba(59, 130, 246, 0.2)",
                  border: "1px solid rgba(59, 130, 246, 0.4)", color: "#60a5fa",
                  fontWeight: "800", fontSize: "13px", cursor: carregando ? "not-allowed" : "pointer"
                }}
              >
                {carregando ? "🔄 Calculando..." : "🔄 Recalcular Período"}
              </button>
            </div>
          </div>

          {/* Opções de Regra de Negócio */}
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginTop: "18px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {/* Checkbox Excluir Donos */}
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#e2e8f0", fontWeight: "700" }}>
              <input
                type="checkbox"
                checked={excluirDonos}
                onChange={(e) => setExcluirDonos(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#8b181e" }}
              />
              Excluir Donos & Administradores do sorteio (Recomendado)
            </label>

            {/* Checkbox Teto Máximo */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#e2e8f0", fontWeight: "700" }}>
                <input
                  type="checkbox"
                  checked={tetoAtivo}
                  onChange={(e) => setTetoAtivo(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#8b181e" }}
                />
                Ativar teto máximo semanal de bilhetes
              </label>

              {tetoAtivo && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={tetoValor}
                    onChange={(e) => setTetoValor(Math.max(1, Number(e.target.value)))}
                    style={{
                      width: "60px", padding: "4px 8px", background: "rgba(0,0,0,0.5)",
                      border: "1px solid #f59e0b", color: "#fff", borderRadius: "6px",
                      fontSize: "12px", fontWeight: "800", textAlign: "center"
                    }}
                  />
                  <span style={{ fontSize: "12px", color: theme.subtext }}>bilhetes/semana</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REGRAS CLARAS DO SORTEIO */}
      <div style={{
        background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "12px", padding: "16px", marginBottom: "24px"
      }}>
        <div style={{ fontWeight: "800", fontSize: "13px", color: "#f8fafc", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
          📖 Regras Oficiais de Acúmulo de Bilhetes:
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px", fontSize: "12px", color: "#94a3b8" }}>
          <div>
            <strong style={{ color: "#38bdf8" }}>1. Corte Semanal de 4h:</strong> Para que uma semana pontue, o mecânico precisa ter cumprido no mínimo 4h (240 min) nela. Semanas abaixo de 4h concedem 0 bilhetes.
          </div>
          <div>
            <strong style={{ color: "#22c55e" }}>2. Bilhetes Base:</strong> 1 bilhete a cada 60 minutos de trabalho acumulados nas semanas elegíveis.
          </div>
          <div>
            <strong style={{ color: "#f59e0b" }}>3. Bônus Horário Obrigatório:</strong> +1 bilhete adicional por cada 60 minutos cumpridos entre 18:00 e 23:00 (Fuso de Brasília).
          </div>
          <div>
            <strong style={{ color: "#a855f7" }}>4. Semanas Independentes:</strong> Se o mecânico não atingir o mínimo em uma semana do mês, ele ainda concorre com os bilhetes conquistados nas outras semanas!
          </div>
        </div>
      </div>

      {/* TABELA DE TRANSPARÊNCIA / RANKING DE BILHETES */}
      <div style={{
        background: "rgba(18, 18, 18, 0.95)", border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px", overflow: "hidden"
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px"
        }}>
          <div>
            <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: "800" }}>
              📊 Ranking Oficial de Bilhetes ({listaExibicao.length} mecânicos listados)
            </h3>
            <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>
              Ordenado pela maior quantidade de bilhetes acumulados no período.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="text"
              placeholder="Buscar por nome ou ID..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              style={{
                padding: "8px 14px", background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px",
                color: "#fff", fontSize: "12px", width: "220px"
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "rgba(255, 255, 255, 0.03)", color: theme.subtext, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th style={{ padding: "12px 16px", width: "50px", textAlign: "center" }}>Pos</th>
                <th style={{ padding: "12px 16px" }}>Mecânico</th>
                <th style={{ padding: "12px 16px" }}>Cargo</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Horas Totais</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Horas Pico (18h-23h)</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Semanas 4h+</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Base + Bônus</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Total de Bilhetes</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Chance de Ganhar</th>
              </tr>
            </thead>
            <tbody>
              {listaExibicao.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: "32px", textAlign: "center", color: theme.subtext }}>
                    Nenhum funcionário encontrado no período.
                  </td>
                </tr>
              ) : (
                listaExibicao.map((u, idx) => {
                  const ehMeuUser = String(u.id) === String(usuarioLogado?.id);
                  const temTickets = u.ticketsTotal > 0;

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: ehMeuUser
                          ? "rgba(139, 24, 30, 0.15)"
                          : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                        transition: "background 0.15s ease"
                      }}
                    >
                      <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "900", color: idx === 0 ? "#f59e0b" : idx === 1 ? "#cbd5e1" : idx === 2 ? "#b45309" : theme.subtext }}>
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: "800", color: ehMeuUser ? "#fca5a5" : "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                          {u.nome}
                          {ehMeuUser && <span style={{ background: "#8b181e", color: "#fff", fontSize: "9px", padding: "1px 5px", borderRadius: "4px" }}>VOCÊ</span>}
                        </div>
                        <div style={{ fontSize: "11px", color: theme.subtext }}>ID: #{u.id}</div>
                      </td>

                      <td style={{ padding: "12px 16px", color: "#94a3b8", fontSize: "12px" }}>
                        {u.role.replace(/\|/g, " • ")}
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700", color: "#f8fafc" }}>
                        {formatarMinutos(u.totalMinutosGeral)}
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700", color: u.totalMinutosPicoGeral > 0 ? "#f59e0b" : theme.subtext }}>
                        {formatarMinutos(u.totalMinutosPicoGeral)}
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span style={{
                          background: u.semanasElegiveis > 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                          color: u.semanasElegiveis > 0 ? "#4ade80" : "#f87171",
                          border: `1px solid ${u.semanasElegiveis > 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                          padding: "2px 8px", borderRadius: "6px", fontSize: "11.5px", fontWeight: "800"
                        }}>
                          {u.semanasElegiveis} / {semanasPeriodo.length}
                        </span>
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "center", color: theme.subtext, fontSize: "12px" }}>
                        {u.ticketsBase} base + {u.ticketsPico} pico
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span style={{
                          background: temTickets ? "rgba(245, 158, 11, 0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${temTickets ? "rgba(245, 158, 11, 0.4)" : "rgba(255,255,255,0.08)"}`,
                          color: temTickets ? "#fef08a" : "#64748b",
                          padding: "4px 12px", borderRadius: "10px", fontWeight: "900", fontSize: "13px"
                        }}>
                          🎟️ {u.ticketsTotal}
                        </span>
                      </td>

                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                          <div style={{ width: "70px", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, u.chancePct)}%`, height: "100%", background: "linear-gradient(90deg, #38bdf8, #22c55e)", borderRadius: "3px" }} />
                          </div>
                          <span style={{ fontWeight: "800", color: temTickets ? "#38bdf8" : theme.subtext, minWidth: "46px", textAlign: "right" }}>
                            {u.chancePct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ROLETA DO SORTEIO AO VIVO */}
      {modalRoleta && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999999,
          background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "linear-gradient(145deg, #18181b 0%, #09090b 100%)",
            border: "1.5px solid rgba(245, 158, 11, 0.5)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            borderRadius: "20px", maxWidth: "640px", width: "100%", padding: "32px",
            textAlign: "center", position: "relative"
          }}>
            {/* Fechar Modal */}
            <button
              onClick={() => {
                if (roletaGirando) return;
                clearTimeout(animIntervalRef.current);
                setModalRoleta(false);
              }}
              disabled={roletaGirando}
              style={{
                position: "absolute", top: "16px", right: "16px",
                background: "rgba(255,255,255,0.06)", border: "none", color: "#cbd5e1",
                width: "32px", height: "32px", borderRadius: "50%", cursor: roletaGirando ? "not-allowed" : "pointer",
                fontSize: "14px", fontWeight: "900", display: "grid", placeItems: "center"
              }}
            >
              ✕
            </button>

            <span style={{
              background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b",
              border: "1px solid rgba(245, 158, 11, 0.3)", padding: "4px 12px",
              borderRadius: "20px", fontSize: "11px", fontWeight: "900", textTransform: "uppercase"
            }}>
              🎲 Sorteador Oficial ao Vivo
            </span>

            <h2 style={{ color: "#fff", margin: "12px 0 4px 0", fontSize: "24px", fontWeight: "900", fontFamily: "'Outfit', sans-serif" }}>
              {premiacao}
            </h2>
            <p style={{ color: theme.subtext, fontSize: "13px", margin: "0 0 24px 0" }}>
              Cada bilhete tem 1 chance igual no tambor do sorteio.
            </p>

            {/* Display Visual do Candidato / Vencedor */}
            <div style={{
              background: vencedorSorteado ? "linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(139,24,30,0.3) 100%)" : "rgba(255,255,255,0.03)",
              border: `2px solid ${vencedorSorteado ? "#22c55e" : roletaGirando ? "#f59e0b" : "rgba(255,255,255,0.1)"}`,
              borderRadius: "16px", padding: "28px 20px", margin: "0 auto 24px auto",
              minHeight: "130px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s ease"
            }}>
              {vencedorSorteado ? (
                <>
                  <div style={{ fontSize: "14px", fontWeight: "900", color: "#4ade80", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
                    🎉 VENCEDOR(A) DO SORTEIO! 🎉
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: "900", color: "#fff", margin: "4px 0" }}>
                    {vencedorSorteado.nome}
                  </div>
                  <div style={{ fontSize: "13px", color: "#cbd5e1" }}>
                    ID: #{vencedorSorteado.id} • Concorreu com <strong>{vencedorSorteado.ticketsTotal} bilhetes</strong> ({vencedorSorteado.chancePct.toFixed(1)}% de chance)
                  </div>
                </>
              ) : candidatoDestaque ? (
                <>
                  <div style={{ fontSize: "12px", color: theme.subtext, marginBottom: "4px" }}>
                    {roletaGirando ? "🎲 Girando bilhetes..." : "Pronto para sortear"}
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: "900", color: roletaGirando ? "#fef08a" : "#fff" }}>
                    {candidatoDestaque.nome}
                  </div>
                  <div style={{ fontSize: "12px", color: theme.subtext }}>
                    {candidatoDestaque.ticketsTotal} bilhetes acumulados
                  </div>
                </>
              ) : (
                <div style={{ color: theme.subtext, fontSize: "14px" }}>
                  Clique em <strong>"Girar Sorteio"</strong> para sortear o ganhador
                </div>
              )}
            </div>

            {/* Botão de Girar */}
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button
                onClick={iniciarGiroRoleta}
                disabled={roletaGirando}
                style={{
                  background: roletaGirando
                    ? "rgba(255,255,255,0.1)"
                    : "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
                  color: "#000", border: "none", padding: "14px 32px", borderRadius: "12px",
                  fontWeight: "900", fontSize: "16px", cursor: roletaGirando ? "not-allowed" : "pointer",
                  boxShadow: roletaGirando ? "none" : "0 8px 24px rgba(245, 158, 11, 0.4)",
                  display: "flex", alignItems: "center", gap: "8px"
                }}
              >
                {roletaGirando ? "🎰 Sorteando..." : "🎲 Girar Sorteio Agora!"}
              </button>
            </div>

            {/* Histórico dos Sorteados (se houver mais de 1 lugar) */}
            {historicoVencedores.length > 0 && (
              <div style={{ marginTop: "24px", textAlign: "left", background: "rgba(0,0,0,0.4)", borderRadius: "10px", padding: "14px" }}>
                <div style={{ fontSize: "12px", color: theme.subtext, fontWeight: "800", marginBottom: "8px" }}>
                  Histórico de Sorteios desta rodada:
                </div>
                {historicoVencedores.map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color: "#fff", fontWeight: "700" }}>
                      {h.lugar}º Sorteado: <strong>{h.vencedor.nome}</strong> (#{h.vencedor.id})
                    </span>
                    <span style={{ color: theme.subtext }}>{h.dataHora} • {h.vencedor.ticketsTotal} bilhetes</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
