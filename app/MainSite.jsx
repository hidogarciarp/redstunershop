"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "./utils/supabaseClient";
import { CARGOS_HIERARQUIA, ATRIBUICOES_DISPONIVEIS, TABELA_PRECOS, REGRAS_PRECOS, CURSOS_OBRIGATORIOS } from "./utils/constants";
import {
  getPrimaryRole,
  getAtribuicoes,
  getLabelCargo,
  getNivel,
  isAdminOuDono,
  isResponsavelPonto,
  podeNotificar,
  podeSendNotif,
  podeEditarFuncionario,
  formatarTelefone
} from "./utils/helpers";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import HeaderBar, { TopHeaderBar } from "./components/HeaderBar";
import ModalNotificacao from "./components/ModalNotificacao";
import LoginPage from "./components/pages/LoginPage";
import MinhaContaPage from "./components/pages/MinhaContaPage";
import NotificacoesPage from "./components/pages/NotificacoesPage";
import AlterarSenhaPage from "./components/pages/AlterarSenhaPage";
import BloqueadoFinanceiroPage from "./components/pages/BloqueadoFinanceiroPage";
import PagamentosPage from "./components/pages/PagamentosPage";
import ClientesPage from "./components/pages/ClientesPage";
import HierarquiaPage from "./components/pages/HierarquiaPage";
import FinancasPage from "./components/pages/FinancasPage";
import PontoPage from "./components/pages/PontoPage";
import AdminPage from "./components/pages/AdminPage";
import DashboardPage from "./components/pages/DashboardPage";
import BlacklistPage from "./components/pages/BlacklistPage";
import PontoAdminPage from "./components/pages/PontoAdminPage";
import DbAdminPage from "./components/pages/DbAdminPage";
import TunagemPage from "./components/pages/TunagemPage";
import BonificacaoPage from "./components/pages/BonificacaoPage";
import AtividadesMecanicosPage from "./components/pages/AtividadesMecanicosPage";
import JanelaPontoFlutuante from "./components/JanelaPontoFlutuante";
import RelatorioPage from "./components/pages/RelatorioPage";
import RelatorioPublicoPage from "./components/pages/RelatorioPublicoPage";
import OutrasMecanicasPage from "./components/pages/OutrasMecanicasPage";
import ControleVendasPage from "./components/pages/ControleVendasPage";
import BotPage from "./components/pages/BotPage";
import CandidaturasPage from "./components/pages/CandidaturasPage";
import RecrutamentoPage from "./components/pages/RecrutamentoPage";
import MissoesPage from "./components/pages/MissoesPage";
import AvisosPage from "./components/pages/AvisosPage";
import OuvidoriaPage from "./components/pages/OuvidoriaPage";
import CursosPage from "./components/pages/CursosPage";
import ModalDetalheTunagem from "./components/ModalDetalheTunagem";
import { analisarServicoTunagem, parseLogsTunagemTexto } from "./utils/calculadoraTunagem";

const PAGINAS_OCULTAS = new Set([
  "financas", "cursos", "missoes", "relatorio-publico",
  "outras-mecanicas", "recrutamento", "evento-derby",
  "evento-triathlon", "pagamentos"
]);

async function otimizarImagem(file) {
  if (!file || typeof window === "undefined" || !file.type || !file.type.startsWith("image/")) return file;
  if (file.size <= 2 * 1024 * 1024) return file;
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxDim = 1920;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  } catch (_) {
    return file;
  }
}

export function MainSite({ isV2 = false } = {}) {
  const isModoV2 = isV2 || (typeof window !== "undefined" && window.location.pathname.startsWith("/v2"));

  // ===== STATES =====
  const [paginaAtual, setPaginaAtual] = useState("login");
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [cargoVisualizacao, setCargoVisualizacao] = useState("");
  const [sessionCarregada, setSessionCarregada] = useState(false);
  const [idInputLogin, setIdInputLogin] = useState("");
  const [senhaInputLogin, setSenhaInputLogin] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [carregandoLogin, setCarregandoLogin] = useState(false);
  const [novaSenhaInput, setNovaSenhaInput] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [layoutPreferido, setLayoutPreferido] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("reds_layout_preferido") || "lateral";
    }
    return "lateral";
  });

  const [v2BannerMinimizado, setV2BannerMinimizado] = useState(false);
  const [v2BannerFechado, setV2BannerFechado] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__REDS_V2_MODE__ = isModoV2;
    }
  }, [isModoV2]);

  useEffect(() => {
    if (isModoV2 && sessionCarregada && usuarioLogado) {
      const role = usuarioLogado?.role || "";
      const primary = role.split("|")[0];
      const isAllowed = primary === "admin" || primary === "dono" || role.includes("admin") || role.includes("dono");
      if (!isAllowed) {
        alert("🚫 Acesso restrito: A Versão 2 (Tabelas Novas) é exclusiva para Donos e Administradores durante os testes.");
        window.location.href = "/";
      }
    }
  }, [isModoV2, sessionCarregada, usuarioLogado]);

  useEffect(() => {
    if (!usuarioLogado || getPrimaryRole(usuarioLogado.role || "") !== "dono") {
      setCargoVisualizacao("");
    }
  }, [usuarioLogado?.id, usuarioLogado?.role]);

  const normalizarLayoutPreferido = (layout) => (
    layout === "topo" || layout === "lateral" ? layout : "lateral"
  );

  const aplicarLayoutDoUsuario = (usuario) => {
    if (usuario?.layout_preferido) {
      const normalizado = normalizarLayoutPreferido(usuario.layout_preferido);
      setLayoutPreferido(normalizado);
      if (typeof window !== "undefined") {
        localStorage.setItem("reds_layout_preferido", normalizado);
      }
    }
  };

  const alterarLayoutPreferido = async (valorOuUpdater) => {
    const novoLayout = normalizarLayoutPreferido(
      typeof valorOuUpdater === "function" ? valorOuUpdater(layoutPreferido) : valorOuUpdater
    );

    setLayoutPreferido(novoLayout);
    if (typeof window !== "undefined") {
      localStorage.setItem("reds_layout_preferido", novoLayout);
    }

    if (!usuarioLogado?.id) return;

    const usuarioAtualizado = { ...usuarioLogado, layout_preferido: novoLayout };
    setUsuarioLogado(usuarioAtualizado);
    if (typeof window !== "undefined") {
      localStorage.setItem("reds_session_user", JSON.stringify(usuarioAtualizado));
    }

    try {
      await supabase
        .from("usuarios")
        .update({ layout_preferido: novoLayout })
        .eq("id", usuarioLogado.id);
    } catch (e) {
      console.error("Erro ao salvar preferência de layout:", e);
    }
  };


  const [clientesLista, setClientesLista] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [novoNomeCliente, setNovoNomeCliente] = useState("");
  const [usuariosMapa, setUsuariosMapa] = useState({});
  const [buscaId, setBuscaId] = useState("");
  const [historicoClienteId, setHistoricoClienteId] = useState(null);
  const [historicoClienteDados, setHistoricoClienteDados] = useState([]);

  const [listaAvisos, setListaAvisos] = useState([]);
  const [avisoSendoEditado, setAvisoSendoEditado] = useState(null);

  const [novoIdAdmin, setNovoIdAdmin] = useState("");
  const [novoNomeAdmin, setNovoNomeAdmin] = useState("");
  const [novoCargoAdmin, setNovoCargoAdmin] = useState("estagiario");
  const [novoCargoAtribuicoes, setNovoCargoAtribuicoes] = useState([]);

  const [cliente, setCliente] = useState("");
  const [passaporte, setPassaporte] = useState("");
  const [nomeMecanico, setNomeMecanico] = useState("");
  const [autorizadoPor, setAutorizadoPor] = useState("");
  const [gastoCliente, setGastoCliente] = useState(0);
  const [valorDigitadoEstetica, setValorDigitadoEstetica] = useState(0);
  const [arquivoImagem, setArquivoImagem] = useState(null);
  const [imagemPreview, setImagemPreview] = useState(null);
  const [arquivoImagem2, setArquivoImagem2] = useState(null);
  const [imagemPreview2, setImagemPreview2] = useState(null);
  const [servicosSelecionados, setServicosSelecionados] = useState({});
  const [camaleao1, setCamaleao1] = useState(false);
  const [camaleao2, setCamaleao2] = useState(false);
  const [camaleaoRodas, setCamaleaoRodas] = useState(false);
  const [quantidadeExtras, setQuantidadeExtras] = useState(0);
  const [fumaca, setFumaca] = useState(false);
  const [kmGuincho, setKmGuincho] = useState(0);
  const [qtdReparos, setQtdReparos] = useState(0);
  const [qtdPneus, setQtdPneus] = useState(0);
  const [reboque, setReboque] = useState(false);
  const [salvandoServico, setSalvandoServico] = useState(false);

  const [pontoAtivo, setPontoAtivo] = useState(null);
  // O cronômetro é atualizado localmente apenas nos componentes que o exibem.
  // Manter este valor estático evita renderizar novamente toda a aplicação a cada segundo.
  const tempoSegundos = 0;
  const [totalMinutosTrabalhados, setTotalMinutosTrabalhados] = useState(0);
  const [historicoPonto, setHistoricoPonto] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  const [semRodaImportada, setSemRodaImportada] = useState(false);
  const [nomeVeiculoRoda, setNomeVeiculoRoda] = useState("");
  const [imagemRoda, setImagemRoda] = useState(null);
  const [previewRoda, setPreviewRoda] = useState(null);

  const [reportBugs, setReportBugs] = useState(false);
  const [nomeVeiculoBugs, setNomeVeiculoBugs] = useState("");
  const [descricaoBug, setDescricaoBug] = useState("");
  const [imagemBugs, setImagemBugs] = useState(null);
  const [previewBugs, setPreviewBugs] = useState(null);

  const [paginaClientes, setPaginaClientes] = useState(0);
  const [temMaisClientes, setTemMaisClientes] = useState(true);
  const [ordemClientesStr, setOrdemClientesStr] = useState("id_asc");
  const [paginaHistorico, setPaginaHistorico] = useState(0);
  const [temMaisHistorico, setTemMaisHistorico] = useState(true);

  const [historicoAdmin, setHistoricoAdmin] = useState([]);
  const [filtroFuncionario, setFiltroFuncionario] = useState("");
  const [ranking, setRanking] = useState([]);
  const [usuariosOnline, setUsuariosOnline] = useState([]);
  const [emServico, setEmServico] = useState([]);

  const [nomePagamento, setNomePagamento] = useState("");
  const [idPagamento, setIdPagamento] = useState("");
  const [valorPagamento, setValorPagamento] = useState("");
  const [descricaoPagamento, setDescricaoPagamento] = useState("");
  const [tipoPagamento, setTipoPagamento] = useState("salario");
  const [valorPagamentoRegistro, setValorPagamentoRegistro] = useState("");
  const [observacaoPagamento, setObservacaoPagamento] = useState("");
  const [imagemPagamento, setImagemPagamento] = useState(null);
  const [previewPagamento, setPreviewPagamento] = useState(null);

  const [editandoPontoId, setEditandoPontoId] = useState(null);
  const [novaSaidaInput, setNovaSaidaInput] = useState("");
  const [novaSaidaDataInput, setNovaSaidaDataInput] = useState("");
  const [novaSaidaJustificativa, setNovaSaidaJustificativa] = useState("");
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState([]);

  const [periodoDesempenho, setPeriodoDesempenho] = useState("semana");

  // ===== STATES: NOTIFICAÇÕES =====
  const [notificacaoPendente, setNotificacaoPendente] = useState(null);
  const [tunagemRealtimeGlobal, setTunagemRealtimeGlobal] = useState(null);
  const [notificacoesServicos, setNotificacoesServicos] = useState([]);
  const painelNotificacoesRef = useRef(null);
  const [bancadaRealtimeGlobal, setBancadaRealtimeGlobal] = useState(null);
  const [logTunagemParaAbrir, setLogTunagemParaAbrir] = useState(null);
  const [notificarTodasTunagens, setNotificarTodasTunagens] = useState(true);
  const [historicoNotificacoes, setHistoricoNotificacoes] = useState([]);
  const [logSelecionadoUuid, setLogSelecionadoUuid] = useState("");

  const adicionarNotificacaoServico = (log, analise, isMeu) => {
    const id = String(log.uuid || log.id || log.discord_message_id || `${log.placa || "veiculo"}-${log.created_at || Date.now()}`);
    const temPerformance = (analise?.itens || []).some((item) => /motor|freio|c[aâ]mbio|suspens|blindagem|turbo/i.test(item.nome || item.item || ""));
    const notificacao = {
      id,
      tipo: temPerformance ? "Tunagem" : "Estética",
      log,
      analise,
      isMeu,
      recebidaEm: new Date().toISOString(),
    };
    setNotificacoesServicos((atuais) => [notificacao, ...atuais.filter((item) => item.id !== id)].slice(0, 50));
  };

  useEffect(() => {
    const savedNotifPref = localStorage.getItem("reds_notif_todas_tunagens");
    if (savedNotifPref !== null) {
      setNotificarTodasTunagens(savedNotifPref === "true");
    }

    const handleNav = (e) => {
      if (e.detail) setPaginaAtual(e.detail);
    };
    window.addEventListener("navegar-pagina", handleNav);
    return () => window.removeEventListener("navegar-pagina", handleNav);
  }, []);

  // Mantém o bot do Render ativo via ping silencioso a cada 4 minutos enquanto o site estiver aberto
  useEffect(() => {
    const pingBotKeepAlive = async () => {
      try {
        await fetch("/api/bot/health", { cache: "no-store" });
      } catch {}
    };

    const initialTimer = setTimeout(pingBotKeepAlive, 15_000);
    const interval = setInterval(pingBotKeepAlive, 240_000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const toggleNotificarTodasTunagens = () => {
    setNotificarTodasTunagens((prev) => {
      const novo = !prev;
      localStorage.setItem("reds_notif_todas_tunagens", String(novo));
      return novo;
    });
  };
  const [notifIdFuncionario, setNotifIdFuncionario] = useState("");
  const [notifMensagem, setNotifMensagem] = useState("");
  const [notifFuncionarioInfo, setNotifFuncionarioInfo] = useState(null);
  const [notifBuscando, setNotifBuscando] = useState(false);
  const [notifAnonimo, setNotifAnonimo] = useState(false);

  // ===== STATES: NOTIFICAÇÃO EM MASSA =====
  const [notifModoMassa, setNotifModoMassa] = useState(false);
  const [notifMassaMensagem, setNotifMassaMensagem] = useState("");
  const [notifMassaNiveis, setNotifMassaNiveis] = useState([]);
  const [notifMassaTodos, setNotifMassaTodos] = useState(false);
  const [notifMassaAnonimo, setNotifMassaAnonimo] = useState(false);
  const [notifMassaEnviando, setNotifMassaEnviando] = useState(false);

  // ===== STATES: RANKINGS =====
  const [rankingClientes, setRankingClientes] = useState([]);
  const [rankingServicos, setRankingServicos] = useState([]);
  const [rankingGuincho, setRankingGuincho] = useState([]);
  const [periodoRankingClientes, setPeriodoRankingClientes] = useState("semana");
  const [periodoRankingServicos, setPeriodoRankingServicos] = useState("semana");
  const [periodoRankingGuincho, setPeriodoRankingGuincho] = useState("semana");

  // ===== STATES: LISTA DE FUNCIONÁRIOS =====
  const [listaFuncionarios, setListaFuncionarios] = useState([]);
  const [editandoFuncionarioId, setEditandoFuncionarioId] = useState(null);
  const [editFuncNovoId, setEditFuncNovoId] = useState("");
  const [editFuncNome, setEditFuncNome] = useState("");
  const [editFuncCargo, setEditFuncCargo] = useState("estagiario");
  const [editFuncAtribuicoes, setEditFuncAtribuicoes] = useState([]);
  const [editFuncTelefone, setEditFuncTelefone] = useState("");
  const [editFuncStatus, setEditFuncStatus] = useState("ativo");
  const [editFuncAdmissao, setEditFuncAdmissao] = useState("");
  const [editFuncDemissao, setEditFuncDemissao] = useState("");
  const [buscaFuncionario, setBuscaFuncionario] = useState("");

  // ===== STATES: BLACKLIST =====
  const [blacklist, setBlacklist] = useState([]);
  const [blacklistCarregando, setBlacklistCarregando] = useState(false);

  // ===== STATES: CONTROLE VENDAS (NITRO + DRIFT) =====
  const [nitroLogs, setNitroLogs] = useState([]);
  const [nitroLogsCarregando, setNitroLogsCarregando] = useState(false);
  const [nitroLogsError, setNitroLogsError] = useState(false);
  const [driftLogs, setDriftLogs] = useState([]);
  const [driftLogsCarregando, setDriftLogsCarregando] = useState(false);
  const [driftLogsError, setDriftLogsError] = useState(false);

  // ===== STATES: PONTO CIDADE =====
  const [registrosCidade,          setRegistrosCidade]          = useState([]);
  const [registrosCidadeCarregando, setRegistrosCidadeCarregando] = useState(false);
  const [registrosOcultos,         setRegistrosOcultos]         = useState([]);
  const [registrosOcultosCarregando, setRegistrosOcultosCarregando] = useState(false);

  // ===== STATES: RELATÓRIO DE HORAS =====
  const [registrosRelatorio,          setRegistrosRelatorio]          = useState([]);
  const [registrosRelatorioM2,        setRegistrosRelatorioM2]        = useState([]);
  const [registrosRelatorioM3,        setRegistrosRelatorioM3]        = useState([]);
  const [registrosRelatorioM4,        setRegistrosRelatorioM4]        = useState([]);
  const [registrosRelatorioCarregando, setRegistrosRelatorioCarregando] = useState(false);

  // Estados para filtro ao navegar do relatório para o ponto
  const [filtroPontoNome, setFiltroPontoNome] = useState("");
  const [filtroPontoStatus, setFiltroPontoStatus] = useState("todos");
  const [filtroPontoDataIni, setFiltroPontoDataIni] = useState("");
  const [filtroPontoDataFim, setFiltroPontoDataFim] = useState("");
  const [relatorioCompartilhadoId, setRelatorioCompartilhadoId] = useState(null);

  // ===== STATES: MAPA DE ROLES PARA NOTIFICAÇÕES =====
  const [usuariosRoleMapa, setUsuariosRoleMapa] = useState({});

  // ===== STATES: HIERARQUIA =====
  const [hierarquiaFuncionarios, setHierarquiaFuncionarios] = useState([]);

  // ===== STATES: FINANÇAS =====
  const [financasFuncionarios, setFinancasFuncionarios] = useState([]);
  const [pagamentosSemanais, setPagamentosSemanais] = useState([]);
  const [editandoFinancaId, setEditandoFinancaId] = useState(null);
  const [editFinancaValor, setEditFinancaValor] = useState("");
  const [editFinancaVencimento, setEditFinancaVencimento] = useState("");
  const [editFinancaRenovacao, setEditFinancaRenovacao] = useState(true);
  const [financasCarregando, setFinancasCarregando] = useState(false);

  // ===== STATES: MINHA CONTA =====
  const [meusServicos, setMeusServicos] = useState([]);
  const [minhasNotificacoes, setMinhasNotificacoes] = useState([]);
  const [meusPagamentos, setMeusPagamentos] = useState([]);
  const [meusTopClientes, setMeusTopClientes] = useState([]);
  const [reportValorSemanal, setReportValorSemanal] = useState("");
  const [reportObsSemanal, setReportObsSemanal] = useState("");
  const [reportLinkSemanal, setReportLinkSemanal] = useState("");
  const [minhaContaCarregando, setMinhaContaCarregando] = useState(false);
  const [candidaturas, setCandidaturas] = useState([]);
  const [candidaturasCarregando, setCandidaturasCarregando] = useState(false);
  
  const [curriculos, setCurriculos] = useState([]);
  const [curriculosCarregando, setCurriculosCarregando] = useState(false);
  const [historicoNitroRecente, setHistoricoNitroRecente] = useState([]);

  // ===== STATES: MISSÕES =====
  const [missoes, setMissoes] = useState([]);
  const [missaoParticipacoes, setMissaoParticipacoes] = useState([]);

  const buscarMissoes = async (incluirInativas = false) => {
    let query = supabase.from("missoes").select("*").order("criado_em", { ascending: false });
    if (!incluirInativas) {
      query = query.eq("ativa", true);
    }
    const { data } = await query;
    if (data) setMissoes(data);
  };

  const buscarParticipacoesMissao = async (missaoId) => {
    const { data } = await supabase.from("missao_participacoes").select("*").eq("missao_id", missaoId).order("criado_em", { ascending: false });
    if (data) setMissaoParticipacoes(data);
  };

  const registrarParticipacao = async (missaoId, fotoBase64, observacao) => {
    const { error } = await supabase.from("missao_participacoes").insert({
      missao_id: missaoId,
      usuario_id: usuarioLogado?.id,
      nome_usuario: usuarioLogado?.nome,
      observacao: observacao || null,
      foto_base64: fotoBase64 || null,
    });
    if (error) alert("Erro ao registrar: " + error.message);
  };

  const aprovarParticipacao = async (id, aprovado) => {
    // Buscar a participação para saber missao_id e estado anterior
    const { data: part } = await supabase
      .from("missao_participacoes")
      .select("missao_id, aprovado")
      .eq("id", id)
      .maybeSingle();

    // Atualizar status da participação
    const { error } = await supabase.from("missao_participacoes").update({
      aprovado,
      aprovado_por: usuarioLogado?.id,
      aprovado_em: new Date().toISOString(),
    }).eq("id", id);
    if (error) { alert("Erro ao aprovar: " + error.message); return; }

    // Ajustar progresso da missão
    if (part?.missao_id) {
      const { data: missao } = await supabase
        .from("missoes")
        .select("progresso, meta")
        .eq("id", part.missao_id)
        .maybeSingle();

      if (missao) {
        let delta = 0;
        if (aprovado && !part.aprovado) delta = +1;       // aprovando → +1
        else if (!aprovado && part.aprovado) delta = -1;  // rejeitando algo aprovado → -1

        if (delta !== 0) {
          const novoProgresso = Math.min(missao.meta, Math.max(0, missao.progresso + delta));
          await supabase.from("missoes").update({ progresso: novoProgresso }).eq("id", part.missao_id);
        }
      }
    }
  };

  const atualizarProgressoMissao = async (id, progresso) => {
    const { error } = await supabase.from("missoes").update({ progresso }).eq("id", id);
    if (error) alert("Erro ao atualizar progresso: " + error.message);
  };

  const deletarParticipacao = async (id) => {
    if (!window.confirm("Tem certeza que deseja apagar este registro? Esta ação não pode ser desfeita.")) return;

    // Buscar participação para saber se estava aprovada
    const { data: part } = await supabase
      .from("missao_participacoes")
      .select("missao_id, aprovado")
      .eq("id", id)
      .maybeSingle();

    // Se estava aprovada, decrementar o progresso
    if (part?.aprovado && part?.missao_id) {
      const { data: missao } = await supabase
        .from("missoes")
        .select("progresso")
        .eq("id", part.missao_id)
        .maybeSingle();
      if (missao) {
        const novoProgresso = Math.max(0, missao.progresso - 1);
        await supabase.from("missoes").update({ progresso: novoProgresso }).eq("id", part.missao_id);
      }
    }

    const { error } = await supabase.from("missao_participacoes").delete().eq("id", id);
    if (error) alert("Erro ao apagar registro: " + error.message);
  };

  const criarMissao = async (dados) => {
    const { error } = await supabase.from("missoes").insert({
      ...dados,
      meta: parseInt(dados.meta) || 100,
      pontos_recompensa: parseInt(dados.pontos_recompensa) || 150,
      data_expiracao: dados.data_expiracao ? new Date(dados.data_expiracao).toISOString() : null,
      criado_por: usuarioLogado?.id,
    });
    if (error) alert("Erro ao criar missão: " + error.message);
  };

  const editarMissao = async (id, dados) => {
    const { error } = await supabase.from("missoes").update({
      titulo: dados.titulo,
      descricao: dados.descricao || null,
      meta: parseInt(dados.meta) || 100,
      pontos_recompensa: parseInt(dados.pontos_recompensa) || 150,
      data_expiracao: dados.data_expiracao ? new Date(dados.data_expiracao).toISOString() : null,
    }).eq("id", id);
    if (error) alert("Erro ao editar missão: " + error.message);
  };

  const finalizarMissao = async (id) => {
    if (!confirm("⚠️ Tem certeza que deseja ENCERRAR esta missão? Ela deixará de ser visível para os funcionários, mas os dados não serão apagados.")) return;
    const { error } = await supabase.from("missoes").update({ ativa: false }).eq("id", id);
    if (error) alert("❌ Erro ao encerrar: " + error.message);
    else {
      alert("✅ Missão encerrada e arquivada com sucesso!");
      buscarMissoes();
    }
  };

  const dadosGrafico = ranking.map((r) => ({
    nome: r.nome,
    horas: Math.round(r.total_minutos / 60),
  }));

  const WEBHOOK_ESTETICA = "/api/discord?tipo=estetica";
  const WEBHOOK_TUNAGEM = "/api/discord?tipo=tunagem";
  const WEBHOOK_VENDAS = "/api/discord?tipo=vendas";
  const WEBHOOK_GUINCHO = "/api/discord?tipo=guincho";
  const WEBHOOK_REBOQUE = "/api/discord?tipo=reboque";
  const WEBHOOK_RODAS = "/api/discord?tipo=rodas";
  const WEBHOOK_REPORT = "/api/discord?tipo=report";
  const WEBHOOK_PAGAMENTOS = "/api/discord?tipo=pagamentos";
  const WEBHOOK_CAIXA2 = "/api/discord?tipo=caixa2";

  const tabelas = TABELA_PRECOS;
  const rules = REGRAS_PRECOS;

  const listaExtras = Array.from({ length: 30 }, (_, i) => ({
    id: `extra_${i + 1}`,
    nome: `Extra ${i + 1}`,
    preco: 1000,
  }));

  // ===== FUNÇÕES UTILITÁRIAS =====





  const buscarMeusPagamentos = async (forceId) => {
    const idParaBusca = forceId || usuarioLogado?.id;
    if (!idParaBusca) return;
    
    const { data, error } = await supabase
      .from("pagamentos_semanais")
      .select("*")
      .eq("funcionario_id", idParaBusca)
      .order("criado_em", { ascending: false });
    if (!error) setMeusPagamentos(data || []);
  };

  const buscarDadosUsuario = async () => {
    if (!usuarioLogado?.id) return;
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", usuarioLogado.id)
      .maybeSingle();
    if (!error && data) {
      setUsuarioLogado(data);
      // Atualiza também no localStorage para persistir
      localStorage.setItem("mecanico_auth", JSON.stringify(data));
      buscarMeusPagamentos();
    }
  };

  const renderMensagemComLinks = (texto) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return texto.split(urlRegex).map((parte, index) => {
      if (parte.match(urlRegex)) {
        return (
          <a key={index} href={parte} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-block", background: "#2563eb", color: "#fff", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", textDecoration: "none", marginLeft: "6px", marginTop: "4px" }}>
            🔗 LINK
          </a>
        );
      }
      return parte;
    });
  };

  const formatarNumero = (valor) => {
    if (!valor) return "";
    return Number(valor).toLocaleString("pt-BR");
  };

  const limparNumero = (valor) => valor.replace(/\D/g, "");

  const formatarCronometro = (segundos) => {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatarHoras = (minutos) => {
    const minsRounded = Math.round(minutos);
    const h = Math.floor(minsRounded / 60);
    const m = minsRounded % 60;
    return `${h}h ${m}min`;
  };

  const formatarHorario = (isoString) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  };

  const formatarDataHora = (isoString) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  };

  const formatarData = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const formatarTextoAvisos = (texto) => {
    if (!texto) return "";
    return texto.split("\n").map((linha, i) => {
      let parts = linha.split(/(\*\*.*?\*\*|__.*?__|\*.*?\*|#.*?#)/g);
      return (
        <span key={i}>
          {parts.map((p, j) => {
            if (p.startsWith("**") && p.endsWith("**")) {
              return <strong key={j} style={{ color: theme.text }}>{p.slice(2, -2)}</strong>;
            } else if (p.startsWith("__") && p.endsWith("__")) {
              return <u key={j} style={{ color: theme.text }}>{p.slice(2, -2)}</u>;
            } else if (p.startsWith("*") && p.endsWith("*")) {
              return <em key={j} style={{ color: theme.text }}>{p.slice(1, -1)}</em>;
            } else if (p.startsWith("#") && p.endsWith("#")) {
              return <span key={j} style={{ fontSize: "15px", color: theme.accent, display: "block", marginTop: "8px", fontWeight: "800" }}>{p.slice(1, -1)}</span>;
            }
            return p;
          })}
          <br />
        </span>
      );
    });
  };

  const calcularDuracao = (entrada, saida) => {
    if (!entrada || !saida) return null;
    const diff = (new Date(saida) - new Date(entrada)) / 60000;
    return formatarHoras(diff);
  };

  const limparFormulario = () => {
    setCliente("");
    setPassaporte("");
    setAutorizadoPor("");
    setValorDigitadoEstetica(0);
    setArquivoImagem(null);
    setImagemPreview(null);
    setArquivoImagem2(null);
    setImagemPreview2(null);
    setServicosSelecionados({});
    setCamaleao1(false);
    setCamaleao2(false);
    setCamaleaoRodas(false);
    setQuantidadeExtras(0);
    setFumaca(false);
    setKmGuincho(0);
    setQtdReparos(0);
    setQtdPneus(0);
    setReboque(false);
    setLogSelecionadoUuid("");
  };

  const getPeriodoFiltro = (periodo) => {
    if (periodo === "total") return null;
    const agoraSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    if (periodo === "semana") {
      const diaSemana = agoraSP.getDay();
      const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
      const segunda = new Date(agoraSP);
      segunda.setDate(agoraSP.getDate() - diasDesdeSegunda);
      const domingo = new Date(segunda);
      domingo.setDate(segunda.getDate() + 6);
      return { inicio: segunda.toLocaleDateString("en-CA"), fim: domingo.toLocaleDateString("en-CA") };
    }
    if (periodo === "mes") {
      const ano = agoraSP.getFullYear();
      const mes = agoraSP.getMonth();
      const primeiro = new Date(ano, mes, 1);
      const ultimo = new Date(ano, mes + 1, 0);
      return { inicio: primeiro.toLocaleDateString("en-CA"), fim: ultimo.toLocaleDateString("en-CA") };
    }
    return null;
  };

  // ===== FUNÇÕES DE BANCO =====

  const buscarUsuarioNoBanco = async (idDigitado) => {
    try {
      if (!idDigitado || typeof idDigitado === "object") return null;
      const idStr = String(idDigitado).trim();
      if (!idStr) return null;
      const idNum = parseInt(idStr, 10);
      
      let user = null;
      if (!isNaN(idNum)) {
        const { data, error } = await supabase.from("usuarios").select("*").eq("id", idNum).maybeSingle();
        if (!error && data) user = data;
      }

      if (!user && Array.isArray(listaFuncionarios) && listaFuncionarios.length > 0) {
        user = listaFuncionarios.find(
          (f) => String(f.id) === idStr || String(f.id_jogo) === idStr || String(f.idJogo) === idStr
        ) || null;
      }

      return user;
    } catch (err) {
      console.error("Erro ao buscar usuário no banco:", err);
      if (Array.isArray(listaFuncionarios) && listaFuncionarios.length > 0) {
        return listaFuncionarios.find(
          (f) => String(f.id) === String(idDigitado).trim() || String(f.id_jogo) === String(idDigitado).trim() || String(f.idJogo) === String(idDigitado).trim()
        ) || null;
      }
      return null;
    }
  };

  const buscarTodosUsuarios = async () => {
    const { data } = await supabase.from("usuarios").select("id, nome, role");
    return data || [];
  };

  const buscarCliente = async (id) => {
    if (!id) { setCliente(""); setGastoCliente(0); return; }
    const { data } = await supabase.from("clientes").select("*").eq("id", Number(id)).maybeSingle();
    if (data) {
      setCliente((nomeAtual) => {
        // Se o nome atual já estiver preenchido (ex: vindo da log de serviço mais recente),
        // preserva o nome atual para não ser rebaixado por um registro antigo
        if (nomeAtual && nomeAtual.trim() && nomeAtual.trim().toLowerCase() !== data.nome?.trim().toLowerCase()) {
          return nomeAtual;
        }
        return data.nome || nomeAtual || "";
      });
      setGastoCliente(data.total_gasto || 0);
    } else {
      setCliente((nomeAtual) => nomeAtual || "");
      setGastoCliente(0);
    }
  };

  const buscarClientePorId = async () => {
    if (!buscaId) return buscarClientes();

    if (isNaN(Number(buscaId))) {
      const { data } = await supabase.from("clientes").select("*").ilike("nome", `%${buscaId}%`);
      if (data) setClientesLista(data);
    } else {
      const idNum = Number(buscaId);
      const { data } = await supabase.from("clientes").select("*").eq("id", idNum);
      if (data && data.length > 0) {
        setClientesLista(data);
      } else {
        const { data: dataLike } = await supabase.from("clientes").select("*").gte("id", idNum).lt("id", idNum + 1000000);
        if (dataLike) setClientesLista(dataLike);
      }
    }
  };

  const buscarClientes = async (limparFlag, ordemForcada = null) => {
    const isLimpando = limparFlag === true || typeof limparFlag !== 'boolean';
    const paginaAlvo = isLimpando ? 0 : paginaClientes;
    const ordemAtual = ordemForcada || ordemClientesStr; // Usaremos uma var de ref ou passaremos direto

    let query = supabase.from("clientes").select("*");

    if (ordemAtual === "nome_asc") {
      query = query.order("nome", { ascending: true });
    } else if (ordemAtual === "recentes") {
      query = query.order("data_ultimo_servico", { ascending: false, nullsFirst: false }).order("id", { ascending: false });
    } else {
      query = query.order("id", { ascending: true });
    }

    const { data } = await query.range(paginaAlvo * 30, (paginaAlvo + 1) * 30 - 1);

    if (data) {
      if (isLimpando) {
        setClientesLista(data);
        setPaginaClientes(1);
      } else {
        setClientesLista(prev => [...prev, ...data]);
        setPaginaClientes(prev => prev + 1);
      }
      setTemMaisClientes(data.length === 30);
    }
  };

  const buscarServicosCliente = async (clienteId) => {
    if (historicoClienteId === clienteId) {
      setHistoricoClienteId(null);
      setHistoricoClienteDados([]);
      return;
    }
    setHistoricoClienteId(clienteId);
    setHistoricoClienteDados([]);
    const { data } = await supabase.from("servicos").select("*").eq("cliente_id", clienteId).order("data", { ascending: false }).limit(20);
    if (data) setHistoricoClienteDados(data);
  };

  const buscarQuadroAvisos = async () => {
    const { data } = await supabase.from("configuracoes").select("quadro_avisos").eq("id", 1).maybeSingle();

    if (data && data.quadro_avisos) {
      try {
        const parsed = JSON.parse(data.quadro_avisos);
        if (Array.isArray(parsed)) {
          setListaAvisos(parsed);
          return;
        }
      } catch (e) {
        setListaAvisos([{ id: "default_old", titulo: "📢 QUADRO DE AVISOS", texto: data.quadro_avisos }]);
        return;
      }
    }
    setListaAvisos([{ id: "default_new", titulo: "📢 QUADRO DE AVISOS", texto: "⚠️ Nenhum aviso no momento." }]);
  };

  const salvarQuadroAvisos = async (novaLista) => {
    const stringified = JSON.stringify(novaLista);
    const { error } = await supabase.from("configuracoes").upsert({ id: 1, quadro_avisos: stringified });
    if (error) {
      alert("❌ Erro ao salvar quadros: " + error.message);
    } else {
      setListaAvisos(novaLista);
    }
  };

  const adicionarNovoQuadro = () => {
    const novoQuadro = { id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`, titulo: "📢 NOVO QUADRO", texto: "Escreva aqui..." };
    const novaLista = [novoQuadro, ...listaAvisos];
    salvarQuadroAvisos(novaLista);
    setAvisoSendoEditado(novoQuadro);
  };

  const apagarQuadro = (id) => {
    if (window.confirm("🗑️ Apagar este quadro de avisos em definitivo?")) {
      const novaLista = listaAvisos.filter(q => q.id !== id);
      salvarQuadroAvisos(novaLista);
      setAvisoSendoEditado(null);
    }
  };

  const confirmarEdicaoQuadro = () => {
    if (!avisoSendoEditado) return;
    const novaLista = listaAvisos.map(q => q.id === avisoSendoEditado.id ? avisoSendoEditado : q);
    salvarQuadroAvisos(novaLista);
    setAvisoSendoEditado(null);
  };

  const buscarUsuarios = async () => {
    const { data } = await supabase.from("usuarios").select("id, nome");
    if (data) {
      const mapa = {};
      data.forEach((u) => { mapa[u.id] = u.nome; });
      setUsuariosMapa(mapa);
    }
  };

  const buscarUsuariosComRole = async () => {
    try {
      const { data, error } = await supabase.from("usuarios").select("id, nome, role");
      if (error) throw error;
      const mapa = {};
      (Array.isArray(data) ? data : []).forEach((u) => {
        if (u?.id !== undefined && u?.id !== null) mapa[u.id] = { nome: u.nome || "Usuário", role: u.role || "" };
      });
      setUsuariosRoleMapa(mapa);
    } catch (error) {
      console.error("Erro ao carregar cargos das notificações:", error);
      setUsuariosRoleMapa({});
    }
  };

  const COLUNAS_PUBLICAS_USUARIOS = [
    "id",
    "nome",
    "role",
    "telefone",
    "oculto_hierarquia",
    "bloqueado_financeiro",
    "valor_semanal",
    "data_vencimento",
    "renovacao_auto",
    "credito_24h_disponivel",
    "credito_24h_usado_em",
    "discord_id",
    "status",
    "data_admissao",
    "ids_antigos",
    "nomes_antigos",
    "avatar_url",
    "staff_por",
    "data_demissao",
    "layout_preferido",
    "curso_estagiario_concluido",
    "curso_estagiario_concluido_em",
    "curso_estagiario_removido_em",
    "curso_estagiario_removido_por",
    "curso_tunagem_concluido",
    "curso_tunagem_concluido_em",
    "curso_tunagem_removido_em",
    "curso_tunagem_removido_por",
    "cursos_concluidos"
  ].join(",");

  const buscarListaFuncionarios = async () => {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select(COLUNAS_PUBLICAS_USUARIOS)
        .order("nome", { ascending: true });
      if (error) {
        console.error("Erro ao buscar lista de funcionários:", error.message, error);
      } else {
        console.log("Funcionários buscados com sucesso:", data ? data.length : 0, "registros.");
        if (data) setListaFuncionarios(data);
      }
    } catch (err) {
      console.error("Exceção ao buscar lista de funcionários:", err);
    }
  };

  const iniciarEdicaoFuncionario = (func) => {
    setEditandoFuncionarioId(func.id);
    setEditFuncNovoId(func.id);
    setEditFuncNome(func.nome || "");
    setEditFuncCargo(getPrimaryRole(func.role));
    setEditFuncAtribuicoes(getAtribuicoes(func.role));
    setEditFuncTelefone(func.telefone || "");
    setEditFuncStatus(func.status || "ativo");
    setEditFuncAdmissao(func.data_admissao || "");
    setEditFuncDemissao(func.data_demissao || "");
  };

  const atualizarFuncionario = async (id) => {
    if (!editFuncNome.trim()) { alert("⚠️ Informe o nome do funcionário!"); return; }
    if (!editFuncNovoId) { alert("⚠️ Informe o ID do funcionário!"); return; }
    let roleCompleto = editFuncCargo;
    if (editFuncAtribuicoes.length > 0) roleCompleto += "|" + editFuncAtribuicoes.join("|");
    
    const funcOriginal = listaFuncionarios.find(f => f.id === id);
    let novosIdsAntigos = funcOriginal?.ids_antigos || "";
    let novosNomesAntigos = funcOriginal?.nomes_antigos || "";

    if (parseInt(editFuncNovoId) !== id) {
      novosIdsAntigos = novosIdsAntigos ? `${novosIdsAntigos}, ${id}` : `${id}`;
    }

    if (editFuncNome.trim() !== funcOriginal?.nome) {
      novosNomesAntigos = novosNomesAntigos ? `${novosNomesAntigos}, ${funcOriginal?.nome}` : `${funcOriginal?.nome}`;
    }

    const updateData = { 
      id: parseInt(editFuncNovoId),
      nome: editFuncNome.trim(), 
      role: roleCompleto, 
      telefone: editFuncTelefone || null, 
      status: editFuncStatus,
      data_admissao: editFuncAdmissao || null,
      data_demissao: editFuncDemissao || null,
      ids_antigos: novosIdsAntigos,
      nomes_antigos: novosNomesAntigos
    };

    if (parseInt(editFuncNovoId) !== id) {
      const userExist = await buscarUsuarioNoBanco(editFuncNovoId);
      if (userExist) {
        alert("❌ Este ID já está em uso por outro funcionário!");
        return;
      }
    }

    const { error } = await supabase.from("usuarios").update(updateData).eq("id", id);
    if (error) { alert("❌ Erro ao atualizar: " + error.message); return; }
    alert("✅ Funcionário atualizado com sucesso!");
    setEditandoFuncionarioId(null);
    setEditFuncNovoId("");
    setEditFuncNome("");
    setEditFuncCargo("estagiario");
    setEditFuncAtribuicoes([]);
    setEditFuncTelefone("");
    setEditFuncStatus("ativo");
    buscarListaFuncionarios();
  };

  const atualizarNomeCliente = async (id) => {
    if (!usuarioLogado) { alert("⚠️ Usuário não identificado!"); return; }
    if (!novoNomeCliente) { alert("⚠️ Informe o nome do cliente!"); return; }
    await supabase.from("clientes").update({ nome: novoNomeCliente, ultima_alteracao: usuarioLogado.id }).eq("id", id);
    setEditandoId(null);
    setNovoNomeCliente("");
    buscarClientes();
  };

  const deletarCliente = async (id, nome) => {
    if (!usuarioLogado) { alert("⚠️ Usuário não identificado!"); return; }
    if (confirm(`⚠️ TEM CERTEZA?\n\nDeseja realmente apagar o cliente "${nome}" (ID ${id})?\nEsta ação apagará o registro dele permanentemente.`)) {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) {
        alert("❌ Erro ao excluir cliente: " + error.message);
      } else {
        alert(`✅ Cliente "${nome}" apagado com sucesso!`);
        buscarClientes();
      }
    }
  };

  const salvarNoBanco = async (usuario) => {
    const { error } = await supabase.from("usuarios").insert([usuario]);
    if (error) alert("Erro ao salvar: " + error.message);
  };

  const encerrarSessao = (mensagem = "") => {
    localStorage.removeItem("reds_session_user");
    localStorage.removeItem("reds_session_page");
    setUsuarioLogado(null);
    setPaginaAtual("login");
    if (mensagem) alert(mensagem);
  };

  const atualizarSenhaNoBanco = async (id, novaSenha) => {
    try {
      const res = await fetch("/api/auth/alterar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, novaSenha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Erro ao atualizar senha");
        return false;
      }
      encerrarSessao();
      return true;
    } catch (e) {
      console.warn("Falha na rota /api/auth/alterar-senha, usando fallback:", e);
      const { error } = await supabase.from("usuarios").update({ senha: novaSenha }).eq("id", id);
      if (error) {
        alert("Erro ao atualizar senha");
        return false;
      }
      encerrarSessao();
      return true;
    }
  };

  const userPodeGerenciarCursos = () => Boolean(
    isAdminOuDono(usuarioLogado?.role) ||
    (usuarioLogado?.role && (
      usuarioLogado.role.includes("gerente_geral") ||
      usuarioLogado.role.includes("gerente_rh") ||
      usuarioLogado.role.includes("resp_rh") ||
      usuarioLogado.role.includes("dono") ||
      usuarioLogado.role.includes("admin")
    ))
  );

  const montarUpdateCurso = (cursoId, concluido, removidoPor = null, cursosConcluidosAtuais = usuarioLogado?.cursos_concluidos || {}) => {
    const curso = (CURSOS_OBRIGATORIOS || []).find((item) => item.id === cursoId);
    const updateData = {
      cursos_concluidos: {
        ...cursosConcluidosAtuais,
        [cursoId]: concluido ? new Date().toISOString() : null,
      },
    };
    if (curso && curso.campo) {
      const prefixo = curso.campo.replace("_concluido", "");
      updateData[curso.campo] = concluido;
      updateData[`${prefixo}_concluido_em`] = concluido ? new Date().toISOString() : null;
      updateData[`${prefixo}_removido_em`] = concluido ? null : new Date().toISOString();
      updateData[`${prefixo}_removido_por`] = concluido ? null : removidoPor;
    }
    return updateData;
  };

  const concluirCurso = async (cursoId) => {
    if (!usuarioLogado?.id) return;
    const updateData = montarUpdateCurso(cursoId, true);
    if (!updateData) return;

    const { error } = await supabase.from("usuarios").update(updateData).eq("id", usuarioLogado.id);
    if (error) {
      alert("❌ Erro ao concluir curso: " + error.message);
      return;
    }

    const usuarioAtualizado = { ...usuarioLogado, ...updateData };
    setUsuarioLogado(usuarioAtualizado);
    if (typeof window !== "undefined") {
      localStorage.setItem("reds_session_user", JSON.stringify(usuarioAtualizado));
    }
    alert("✅ Curso concluído! Liberação atualizada.");
    if (cursoId === "estagiario") {
      setPaginaAtual("dashboard");
    }
  };

  const alterarCursoFuncionario = async (funcionarioId, cursoId, concluido) => {
    if (!funcionarioId) return;
    const funcionarioAtual = listaFuncionarios.find((func) => String(func.id) === String(funcionarioId));
    const updateData = montarUpdateCurso(cursoId, concluido, usuarioLogado?.id || null, funcionarioAtual?.cursos_concluidos || {});
    if (!updateData) return;

    const { error } = await supabase.from("usuarios").update(updateData).eq("id", funcionarioId);
    if (error) {
      alert("❌ Erro ao atualizar curso: " + error.message);
      return;
    }

    if (String(funcionarioId) === String(usuarioLogado?.id)) {
      const usuarioAtualizado = { ...usuarioLogado, ...updateData };
      setUsuarioLogado(usuarioAtualizado);
      if (typeof window !== "undefined") {
        localStorage.setItem("reds_session_user", JSON.stringify(usuarioAtualizado));
      }
    }

    buscarListaFuncionarios();
    alert(concluido ? "✅ Curso liberado para o funcionário." : "⚠️ Curso removido. O funcionário precisará refazer.");
  };

  const realizarLogin = async (idDigitado, senhaDigitada) => {
    setErroLogin("");
    setCarregandoLogin(true);
    try {
      const idLimpo = (idDigitado || "").toString().trim();
      const senhaLimpa = (senhaDigitada || "").toString().trim();
      if (!idLimpo || !senhaLimpa) {
        setErroLogin("Preencha o ID e a senha.");
        return;
      }

      // Autenticação segura pelo servidor Next.js
      let res;
      try {
        res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: idLimpo, senha: senhaLimpa }),
        });
      } catch (netErr) {
        console.warn("Falha de rede na rota /api/auth/login:", netErr);
      }

      if (res) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErroLogin(data?.error || "Erro ao realizar login.");
          return;
        }

        const usuario = data.usuario;
        if (data.primeiroAcesso) {
          alert("Primeiro acesso detectado! Por favor, altere sua senha.");
          setUsuarioLogado(usuario);
          setPaginaAtual("alterar-senha");
          return;
        }

        if (data.sucesso && usuario) {
          // ===== VERIFICAR BLOQUEIO FINANCEIRO =====
          if (usuario.bloqueado_financeiro) {
            const usadoEm = usuario.credito_24h_usado_em;
            const dentroJanela = usadoEm && (Date.now() - new Date(usadoEm).getTime()) < 24 * 3600 * 1000;
            if (!dentroJanela) {
              setUsuarioLogado(usuario);
              setNomeMecanico(usuario.nome);
              buscarMeusPagamentos(usuario.id);
              setPaginaAtual("bloqueado-financeiro");
              return;
            }
          }
          aplicarLayoutDoUsuario(usuario);
          setUsuarioLogado(usuario);
          setNomeMecanico(usuario.nome);
          setPaginaAtual("dashboard");
          return;
        }
      }

      // Fallback de contingência caso o endpoint local falhe
      const usuario = await buscarUsuarioNoBanco(idLimpo);
      if (usuario) {
        if (usuario.status === "inativo" || usuario.status === "demitido") {
          setErroLogin("Acesso negado. Seu usuário está inativo ou demitido. Contate um administrador.");
          return;
        }
        
        // Evita erro de 'Cannot read properties of null (reading toString)'
        const senhaDb = (usuario.senha || usuario.id).toString().trim();
        const idDb = usuario.id.toString().trim();
        
        if (senhaDb === idDb && senhaLimpa === idDb) {
          alert("Primeiro acesso detectado! Por favor, altere sua senha.");
          setUsuarioLogado(usuario);
          setPaginaAtual("alterar-senha");
        } else if (senhaDb === senhaLimpa) {
          // ===== VERIFICAR BLOQUEIO FINANCEIRO =====
          if (usuario.bloqueado_financeiro) {
            const usadoEm = usuario.credito_24h_usado_em;
            const dentroJanela = usadoEm && (Date.now() - new Date(usadoEm).getTime()) < 24 * 3600 * 1000;
            if (!dentroJanela) {
              setUsuarioLogado(usuario);
              setNomeMecanico(usuario.nome);
              buscarMeusPagamentos(usuario.id);
              setPaginaAtual("bloqueado-financeiro");
              return;
            }
          }
          aplicarLayoutDoUsuario(usuario);
          setUsuarioLogado(usuario);
          setNomeMecanico(usuario.nome);
          setPaginaAtual("dashboard");
        } else {
          setErroLogin("Senha incorreta. Verifique sua senha.");
        }
      } else {
        setErroLogin("ID não autorizado ou inexistente. Contate um administrador.");
      }
    } catch (err) {
      console.error(err);
      setErroLogin("Erro de conexão ao tentar entrar. Tente novamente.");
    } finally {
      setCarregandoLogin(false);
    }
  };

  const cadastrarMecanico = async () => {
    if (!novoIdAdmin || !novoNomeAdmin || !novoCargoAdmin) return alert("Preencha tudo!");
    let roleCompleto = novoCargoAdmin.toLowerCase();
    if (novoCargoAtribuicoes.length > 0) {
      roleCompleto += "|" + novoCargoAtribuicoes.join("|");
    }
    await salvarNoBanco({ id: parseInt(novoIdAdmin), senha: novoIdAdmin, role: roleCompleto, nome: novoNomeAdmin });
    alert(`Funcionário ${novoNomeAdmin} autorizado como ${getLabelCargo(roleCompleto)}!`);
    setNovoIdAdmin("");
    setNovoNomeAdmin("");
    setNovoCargoAdmin("estagiario");
    setNovoCargoAtribuicoes([]);
    buscarListaFuncionarios();
  };

  const salvarCliente = async (totalServico) => {
    if (!cliente || !passaporte) return;
    const id = Number(passaporte);
    const mecanicoId = usuarioLogado?.id;
    const now = new Date().toISOString();
    const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
    if (data) {
      await supabase.from("clientes").update({ nome: cliente, total_gasto: (data.total_gasto || 0) + totalServico, ultima_alteracao: mecanicoId, data_ultimo_servico: now }).eq("id", id);
    } else {
      await supabase.from("clientes").insert({ id, nome: cliente, total_gasto: totalServico, ultima_alteracao: mecanicoId, data_ultimo_servico: now });
    }
  };

  const salvarServico = async (tipo, valorTotal, linkDiscord = null, detalhesServico = null) => {
    if (!usuarioLogado) return;
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    await supabase.from("servicos").insert({
      funcionario_id: usuarioLogado.id,
      funcionario_nome: usuarioLogado.nome,
      cliente_id: passaporte ? Number(passaporte) : null,
      cliente_nome: cliente || (detalhesServico?.includes("Apreensão") || detalhesServico?.includes("Reboque") ? "Apreensão Policial" : null),
      tipo,
      valor_total: valorTotal,
      data: hoje,
      criado_em: new Date().toISOString(),
      link_imagem: linkDiscord,
      detalhes: detalhesServico
    });
  };

  const buscarTotalHoras = async () => {
    if (!usuarioLogado) return;
    const { data, error } = await supabase.rpc("calcular_total_horas", { p_usuario_id: usuarioLogado.id });
    if (!error) {
      const minutos = Array.isArray(data) ? data[0]?.total_minutos : data;
      setTotalMinutosTrabalhados(minutos || 0);
    }
  };

  const verificarPontoAtivo = async () => {
    if (!usuarioLogado) return;
    try {
      const { data: logs, error } = await supabase
        .from("discord_log_messages")
        .select("id, content, created_at")
        .eq("log_type", "ponto")
        .ilike("content", `%[ID]: ${usuarioLogado.id}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const getLogTimestamp = (l) => {
        const c = l.content || "";
        const dataMatch = c.match(/\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/i);
        if (dataMatch) {
          const [_, dia, mes, ano, hora, min, seg] = dataMatch;
          return new Date(`${ano}-${mes}-${dia}T${hora}:${min}:${seg}-03:00`).getTime();
        }
        return new Date(l.created_at).getTime();
      };

      const userLogs = (logs || []).filter((l) => {
        const c = l.content || "";
        const idMatch = c.match(/\[ID\]:\s*(\d+)/i);
        return idMatch && String(idMatch[1]).trim() === String(usuarioLogado.id).trim();
      });

      userLogs.sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a));

      const userLog = userLogs[0];

      if (userLog) {
        const c = userLog.content || "";
        const isEntrou = c.includes("ENTROU EM SERVIÇO");
        const isSaiu = c.includes("SAIU DE SERVIÇO");

        if (isEntrou && !isSaiu) {
          const ts = getLogTimestamp(userLog);
          const dtEntrada = new Date(ts);
          if (Date.now() - dtEntrada.getTime() < 18 * 60 * 60 * 1000) {
            const novaEntradaISO = dtEntrada.toISOString();
            setPontoAtivo((prev) => {
              if (prev && prev.entrada === novaEntradaISO && String(prev.usuario_id) === String(usuarioLogado.id)) {
                return prev;
              }
              return {
                entrada: novaEntradaISO,
                usuario_id: usuarioLogado.id,
                nome: usuarioLogado.nome,
                rawLog: c
              };
            });
            return;
          }
        }
      }
      setPontoAtivo((prev) => (prev ? null : prev));
    } catch (e) {
      console.error("Erro ao verificar ponto ativo do jogo:", e);
    }
  };

  const buscarHistoricoPonto = async ({ nome = filtroPontoNome, dataInicio = filtroPontoDataIni, dataFim = filtroPontoDataFim, apenasMeus = false } = {}) => {
    if (!usuarioLogado) return;
    setCarregandoHistorico(true);

    const cargoRealPonto = usuarioLogado?.role || "";
    const roleConsulta = getPrimaryRole(cargoRealPonto) === "dono" && cargoVisualizacao
      ? cargoVisualizacao
      : cargoRealPonto;
    const podeVerTodosPontos = getNivel(roleConsulta) >= 5 && !apenasMeus;

    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    try {
      while (hasMore && allData.length < 30000) {
        let query = supabase.from("ponto_horas").select("*").order("entrada", { ascending: false });

        if (podeVerTodosPontos) {
          if (nome.trim()) {
            const n = `%${nome.trim()}%`;
            query = query.or(`nome.ilike.${n},nome_personagem.ilike.${n}`);
          }
          if (dataInicio) query = query.gte("data", dataInicio);
          if (dataFim) query = query.lte("data", dataFim);
          
          query = query.range(page * pageSize, (page + 1) * pageSize - 1);
        } else {
          query = query.eq("usuario_id", usuarioLogado.id).range(page * pageSize, (page + 1) * pageSize - 1);
        }

        const { data, error } = await query;
        if (error) {
          console.error("Erro ao buscar histórico do site:", error.message);
          hasMore = false;
        } else if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
          // Se não for admin, ele já pega tudo do usuário de uma vez na maioria dos casos, mas mantemos o loop por segurança
        } else {
          hasMore = false;
        }
      }
      setHistoricoPonto(allData);
    } catch (e) {
      console.error("Erro fatal no histórico do site:", e);
    } finally {
      setCarregandoHistorico(false);
    }
  };

  const registrarPonto = async () => {
    if (!usuarioLogado) return alert("Faça login primeiro!");
    const agora = new Date();
    const hoje = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    try {
      const { data: pontoAberto, error } = await supabase.from("ponto_horas").select("*").eq("usuario_id", usuarioLogado.id).is("saida", null).maybeSingle();
      if (error) throw error;
      if (!pontoAberto) {
        const { error: insertError } = await supabase.from("ponto_horas").insert([{ usuario_id: usuarioLogado.id, nome: usuarioLogado.nome, entrada: agora.toISOString(), data: hoje }]);
        if (insertError) throw insertError;
        alert("✅ Ponto de ENTRADA registrado!");
        buscarNotificacaoPendente();
      } else {
        const { error: updateError } = await supabase.from("ponto_horas").update({ saida: agora.toISOString() }).eq("id", pontoAberto.id);
        if (updateError) throw updateError;
        alert("🏁 Ponto de SAÍDA registrado!");
        buscarNotificacaoPendente();
      }
      buscarTotalHoras();
      buscarHistoricoPonto();
      verificarPontoAtivo();
    } catch (err) {
      console.error("Erro no ponto:", err);
      alert("Erro ao salvar ponto.");
    }
  };

  const verificarRegistroPonto = async (pontoId, verificadoPor) => {
    const { error } = await supabase.from("ponto_horas").update({ verificado: true, verificado_por: verificadoPor }).eq("id", pontoId);
    if (error) { alert("❌ Erro ao verificar ponto."); return; }
    buscarHistoricoAdmin();
    buscarHistoricoPonto();
  };

  const desverificarRegistroPonto = async (pontoId) => {
    const { error } = await supabase.from("ponto_horas").update({ verificado: false, verificado_por: null }).eq("id", pontoId);
    if (error) { alert("❌ Erro ao remover verificação."); return; }
    buscarHistoricoAdmin();
    buscarHistoricoPonto();
  };

  const buscarRankingComPeriodo = async (periodo) => {
    const { data: todosUsuarios } = await supabase.from("usuarios").select("nome, nomes_antigos, status");
    const nomesInativos = [];
    const mapaNomes = {};

    if (todosUsuarios) {
      todosUsuarios.forEach((u) => {
        if (u.status === "inativo") nomesInativos.push(u.nome);
        mapaNomes[u.nome] = u.nome;
        if (u.nomes_antigos) {
          u.nomes_antigos.split(",").forEach((nomeAntigo) => {
            const nomeLimpo = nomeAntigo.trim();
            if (nomeLimpo) mapaNomes[nomeLimpo] = u.nome;
          });
        }
      });
    }

    const filtro = getPeriodoFiltro(periodo);
    
    // 1. Buscar horas da cidade (Log da Cidade) - Busca em lotes
    let dataCidade = [];
    let pageC = 0;
    const pageSize = 1000;
    let hasMoreC = true;
    while (hasMoreC && dataCidade.length < 50000) {
      let q = supabase.from("ponto_cidade_reds").select("*").not("saida", "is", null).or("oculto.is.null,oculto.eq.false").order("id", { ascending: true }).range(pageC * pageSize, (pageC + 1) * pageSize - 1);
      if (filtro) q = q.gte("data", filtro.inicio).lte("data", filtro.fim);
      const { data, error } = await q;
      if (error || !data || data.length === 0) hasMoreC = false;
      else { dataCidade = [...dataCidade, ...data]; if (data.length < pageSize) hasMoreC = false; else pageC++; }
    }

    // 2. Buscar estrelas do site (Contador de Estrelas) - Busca em lotes
    let dataEstrelas = [];
    let pageE = 0;
    let hasMoreE = true;
    while (hasMoreE && dataEstrelas.length < 50000) {
      let q = supabase.from("ponto_horas").select("nome, estrela").eq("estrela", true).range(pageE * pageSize, (pageE + 1) * pageSize - 1);
      if (filtro) q = q.gte("data", filtro.inicio).lte("data", filtro.fim);
      const { data, error } = await q;
      if (error || !data || data.length === 0) hasMoreE = false;
      else { dataEstrelas = [...dataEstrelas, ...data]; if (data.length < pageSize) hasMoreE = false; else pageE++; }
    }

    if (dataCidade) {
      const totais = {};
      
      // Somar horas da cidade
      dataCidade.forEach((p) => {
        const nomeAtual = mapaNomes[p.nome] || p.nome;
        if (nomesInativos.includes(nomeAtual)) return;
        const minutos = (new Date(p.saida) - new Date(p.entrada)) / 60000;
        if (minutos > 0) {
          if (!totais[nomeAtual]) totais[nomeAtual] = { nome: nomeAtual, total_minutos: 0, estrelas: 0, logs: [] };
          totais[nomeAtual].total_minutos += minutos;
          totais[nomeAtual].logs.push(p);
        }
      });

      // Contar estrelas
      if (dataEstrelas) {
        dataEstrelas.forEach((p) => {
          const nomeAtual = mapaNomes[p.nome] || p.nome;
          if (totais[nomeAtual]) {
            totais[nomeAtual].estrelas++;
          } else if (!nomesInativos.includes(nomeAtual)) {
            totais[nomeAtual] = { nome: nomeAtual, total_minutos: 0, estrelas: 1, logs: [] };
          }
        });
      }

      const rankingCalculado = Object.values(totais)
        .map((item) => ({ 
          nome: item.nome, 
          total_minutos: Math.round(item.total_minutos),
          estrelas: item.estrelas,
          logs: item.logs ? item.logs.sort((a,b) => new Date(b.entrada) - new Date(a.entrada)) : []
        }))
        // Ordenar puramente por minutos totais da cidade
        .sort((a, b) => b.total_minutos - a.total_minutos);
        
      setRanking(rankingCalculado);
    }
  };

  const buscarRanking = async () => { await buscarRankingComPeriodo("total"); };

  const buscarRankingClientes = async (periodo) => {
    const filtro = getPeriodoFiltro(periodo);
    if (!filtro) {
      const { data } = await supabase.from("clientes").select("*");
      if (data) {
        const ordenados = data
          .map((c) => ({
            cliente_id: c.id,
            cliente_nome: c.nome,
            total_gasto: c.total_gasto || c.total || 0,
            count: 0
          }))
          .sort((a, b) => b.total_gasto - a.total_gasto)
          .slice(0, 10);
        setRankingClientes(ordenados);
      }
      return;
    }
    let query = supabase.from("servicos").select("cliente_id, cliente_nome, valor_total");
    query = query.gte("data", filtro.inicio).lte("data", filtro.fim);
    const { data } = await query;
    if (data) {
      const totais = {};
      data.forEach((s) => {
        const key = `${s.cliente_id}`;
        if (!totais[key]) totais[key] = { cliente_id: s.cliente_id, cliente_nome: s.cliente_nome, total_gasto: 0, count: 0 };
        totais[key].total_gasto += Number(s.valor_total) || 0;
        totais[key].count++;
      });
      setRankingClientes(Object.values(totais).sort((a, b) => b.total_gasto - a.total_gasto).slice(0, 10));
    }
  };

  const buscarRankingServicos = async (periodo) => {
    const { data: todosUsuarios } = await supabase.from("usuarios").select("nome, nomes_antigos, status");
    const nomesInativos = [];
    const mapaNomes = {};

    if (todosUsuarios) {
      todosUsuarios.forEach((u) => {
        if (u.status === "inativo") nomesInativos.push(u.nome);
        mapaNomes[u.nome] = u.nome;
        if (u.nomes_antigos) {
          u.nomes_antigos.split(",").forEach((nomeAntigo) => {
            const nomeLimpo = nomeAntigo.trim();
            if (nomeLimpo) mapaNomes[nomeLimpo] = u.nome;
          });
        }
      });
    }

    const filtro = getPeriodoFiltro(periodo);
    let query = supabase.from("servicos").select("funcionario_id, funcionario_nome").neq("tipo", "guincho");
    if (filtro) query = query.gte("data", filtro.inicio).lte("data", filtro.fim);
    const { data } = await query;
    if (data) {
      const contagens = {};
      data.forEach((s) => {
        const nomeAtual = mapaNomes[s.funcionario_nome] || s.funcionario_nome;
        if (nomesInativos.includes(nomeAtual)) return;
        if (!contagens[nomeAtual]) contagens[nomeAtual] = { nome: nomeAtual, count: 0 };
        contagens[nomeAtual].count++;
      });
      setRankingServicos(Object.values(contagens).sort((a, b) => b.count - a.count));
    }
  };

  const buscarRankingGuincho = async (periodo) => {
    const { data: todosUsuarios } = await supabase.from("usuarios").select("nome, nomes_antigos, status");
    const nomesInativos = [];
    const mapaNomes = {};

    if (todosUsuarios) {
      todosUsuarios.forEach((u) => {
        if (u.status === "inativo") nomesInativos.push(u.nome);
        mapaNomes[u.nome] = u.nome;
        if (u.nomes_antigos) {
          u.nomes_antigos.split(",").forEach((nomeAntigo) => {
            const nomeLimpo = nomeAntigo.trim();
            if (nomeLimpo) mapaNomes[nomeLimpo] = u.nome;
          });
        }
      });
    }

    const filtro = getPeriodoFiltro(periodo);
    let query = supabase.from("servicos").select("funcionario_id, funcionario_nome").eq("tipo", "guincho");
    if (filtro) query = query.gte("data", filtro.inicio).lte("data", filtro.fim);
    const { data } = await query;
    if (data) {
      const contagens = {};
      data.forEach((s) => {
        const nomeAtual = mapaNomes[s.funcionario_nome] || s.funcionario_nome;
        if (nomesInativos.includes(nomeAtual)) return;
        if (!contagens[nomeAtual]) contagens[nomeAtual] = { nome: nomeAtual, count: 0 };
        contagens[nomeAtual].count++;
      });
      setRankingGuincho(Object.values(contagens).sort((a, b) => b.count - a.count));
    }
  };

  // ===== FUNÇÕES DE NOTIFICAÇÃO =====

  const buscarNotificacaoPendente = async () => {
    if (!usuarioLogado?.id) return;
    try {
      const uid = usuarioLogado.id;
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("funcionario_id", uid)
        .is("lido_em", null)
        .order("criado_em", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!error) {
        setNotificacaoPendente(data || null);
      }
    } catch (err) {
      console.error("Erro ao buscar notificacao pendente:", err);
    }
  };

  const confirmarLeituraNotificacao = async () => {
    if (!notificacaoPendente) return;
    await supabase.from("notificacoes").update({ lido_em: new Date().toISOString() }).eq("id", notificacaoPendente.id);
    setNotificacaoPendente(null);
    setTimeout(() => buscarNotificacaoPendente(), 500);
  };

  const buscarFuncionarioParaNotif = async () => {
    if (!notifIdFuncionario) return;
    setNotifBuscando(true);
    const funcionario = await buscarUsuarioNoBanco(notifIdFuncionario);
    setNotifFuncionarioInfo(funcionario || null);
    if (!funcionario) alert("⚠️ Funcionário não encontrado!");
    setNotifBuscando(false);
  };

  const enviarNotificacao = async (idParam, msgParam, anonimoParam) => {
    const isExplicitCall = (typeof idParam === "string" || typeof idParam === "number") && String(idParam).trim() !== "";
    const targetId = isExplicitCall ? idParam : notifIdFuncionario;
    const targetMsg = (typeof msgParam === "string" ? msgParam : notifMensagem);
    const isAnonimo = typeof anonimoParam === "boolean" ? anonimoParam : notifAnonimo;

    if (!targetId || !targetMsg?.trim()) {
      alert("⚠️ Informe o ID do funcionário e escreva a mensagem!");
      return false;
    }
    
    let funcionario = null;
    if (isExplicitCall) {
      funcionario = await buscarUsuarioNoBanco(targetId);
    } else {
      funcionario = notifFuncionarioInfo || await buscarUsuarioNoBanco(notifIdFuncionario);
    }

    if (!funcionario) { alert("⚠️ Funcionário não encontrado!"); return false; }

    const nivelRemetente = getNivel(usuarioLogado.role);
    const nivelDestinatario = getNivel(funcionario.role);
    if (!isAdminOuDono(usuarioLogado.role) && nivelRemetente <= nivelDestinatario) {
      alert("⚠️ Você só pode notificar funcionários de cargo inferior ao seu!");
      return false;
    }

    const nomeExibido = isAnonimo ? "Anônimo" : usuarioLogado.nome;
    const { error } = await supabase.from("notificacoes").insert({
      admin_id: usuarioLogado.id,
      admin_nome: nomeExibido,
      admin_id_real: usuarioLogado.id,
      anonimo: isAnonimo,
      funcionario_id: funcionario.id,
      funcionario_nome: funcionario.nome,
      mensagem: targetMsg.trim(),
      criado_em: new Date().toISOString(),
    });

    if (error) { 
      alert("❌ Erro ao enviar notificação: " + error.message); 
      return false; 
    }

    if (!isExplicitCall) {
      alert(`✅ Notificação enviada para ${funcionario.nome}!`);
      setNotifIdFuncionario("");
      setNotifMensagem("");
      setNotifFuncionarioInfo(null);
      setNotifAnonimo(false);
    }
    
    buscarHistoricoNotificacoes();
    return true;
  };

  const enviarNotificacaoMassa = async () => {
    if (!notifMassaMensagem.trim()) { alert("⚠️ Escreva a mensagem!"); return; }
    if (!notifMassaTodos && notifMassaNiveis.length === 0) { alert("⚠️ Selecione os destinatários!"); return; }

    setNotifMassaEnviando(true);
    const todos = await buscarTodosUsuarios();
    const meuNivel = getNivel(usuarioLogado.role);

    let destinatarios = todos.filter((u) => u.id !== usuarioLogado.id);

    if (!notifMassaTodos) {
      destinatarios = destinatarios.filter((u) => notifMassaNiveis.includes(getPrimaryRole(u.role)));
    }

    if (!isAdminOuDono(usuarioLogado.role)) {
      destinatarios = destinatarios.filter((u) => getNivel(u.role) < meuNivel);
    }

    if (destinatarios.length === 0) { alert("⚠️ Nenhum destinatário encontrado."); setNotifMassaEnviando(false); return; }

    const nomeExibido = notifMassaAnonimo ? "Anônimo" : usuarioLogado.nome;
    const agora = new Date().toISOString();
    const registros = destinatarios.map((u) => ({
      admin_id: usuarioLogado.id,
      admin_nome: nomeExibido,
      admin_id_real: usuarioLogado.id,
      anonimo: notifMassaAnonimo,
      funcionario_id: u.id,
      funcionario_nome: u.nome,
      mensagem: notifMassaMensagem.trim(),
      criado_em: agora,
    }));

    const { error } = await supabase.from("notificacoes").insert(registros);
    if (error) { alert("❌ Erro ao enviar: " + error.message); setNotifMassaEnviando(false); return; }
    alert(`✅ Notificação enviada para ${destinatarios.length} funcionário(s)!`);
    setNotifMassaMensagem("");
    setNotifMassaNiveis([]);
    setNotifMassaTodos(false);
    setNotifMassaAnonimo(false);
    buscarHistoricoNotificacoes();
    setNotifMassaEnviando(false);
  };

  const apagarNotificacao = async (notifId) => {
    const confirmar = window.confirm("Tem certeza que deseja APAGAR esta notificação?");
    if (!confirmar) return;
    const { error } = await supabase.from("notificacoes").delete().eq("id", notifId);
    if (error) { alert("❌ Erro ao apagar a notificação."); }
    else { 
      alert("🗑️ Notificação apagada com sucesso!"); 
      buscarHistoricoNotificacoes(); 
    }
  };

  const buscarHistoricoNotificacoes = async () => {
    try {
      const { data, error } = await supabase.from("notificacoes").select("*").order("criado_em", { ascending: false }).limit(200);
      if (error) throw error;
      setHistoricoNotificacoes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar histórico de notificações:", error);
      setHistoricoNotificacoes([]);
    }
  };

  // Gerenciamento de status online migrado para Supabase Realtime Presence (0 gravações/leituras de disco)
  const ficarOnline = async () => {};
  const buscarOnline = async () => {};
  const limparOffline = async () => {};

  const buscarEmServico = async () => {
    const { data } = await supabase.from("ponto_horas").select("*").is("saida", null);
    if (data) setEmServico(data);
  };

  const fecharPontoAdmin = async (pontoId) => {
    const confirmar = window.confirm("Deseja fechar este ponto agora?");
    if (!confirmar) return;
    const agora = new Date().toISOString();
    const { error } = await supabase.from("ponto_horas").update({ saida: agora }).eq("id", pontoId);
    if (error) { alert("❌ Erro ao fechar o ponto."); }
    else { alert("✅ Ponto fechado com sucesso!"); buscarEmServico(); buscarHistoricoPonto(); verificarPontoAtivo(); buscarTotalHoras(); buscarHistoricoAdmin(); }
  };

  const apagarPonto = async (pontoId) => {
    const confirmar = window.confirm("Tem certeza que deseja APAGAR este ponto? Esta ação não pode ser desfeita.");
    if (!confirmar) return;
    const { error } = await supabase.from("ponto_horas").delete().eq("id", pontoId);
    if (error) { alert("❌ Erro ao apagar o ponto."); }
    else { 
      alert("🗑️ Ponto apagado com sucesso!"); 
      buscarEmServico(); 
      buscarHistoricoPonto(); 
      verificarPontoAtivo(); 
      buscarTotalHoras(); 
      buscarHistoricoAdmin(); 
      if (buscarPontoCidade) {
        buscarPontoCidade({ 
          nome: filtroPontoNome, 
          dataInicio: filtroPontoDataIni, 
          dataFim: filtroPontoDataFim 
        });
      }
    }
  };

  const alternarVisibilidadePonto = async (ponto) => {
    const novoOculto = !ponto.oculto;
    const { error } = await supabase.from("ponto_horas").update({ oculto: novoOculto }).eq("id", ponto.id);
    if (error) { 
      alert("❌ Erro ao alterar visibilidade do ponto."); 
    } else { 
      buscarEmServico(); 
      buscarHistoricoAdmin(); 
      buscarHistoricoPonto(); 
    }
  };

  const apagarPagamento = async (pagId) => {
    const confirmar = window.confirm("Tem certeza que deseja apagar este pagamento?");
    if (!confirmar) return;

    const { error } = await supabase
      .from("pagamentos_semanais")
      .delete()
      .eq("id", pagId);

    if (error) {
      alert("❌ Erro ao apagar pagamento.");
    } else {
      alert("🗑️ Pagamento apagado!");
      buscarPagamentosSemanais(); // recarrega lista
    }
  };

  // ===== BLACKLIST ACTIONS =====
  const buscarBlacklist = async () => {
    setBlacklistCarregando(true);
    const { data, error } = await supabase.from("blacklist").select("*").order("criado_em", { ascending: false });
    if (!error && data) setBlacklist(data);
    setBlacklistCarregando(false);
  };

  const adicionarBlacklist = async (idCli, motivo) => {
    if (!idCli || !motivo.trim()) return alert("⚠️ Informe o ID e o motivo!");
    const { error } = await supabase.from("blacklist").insert([{
      passaporte: String(idCli),
      motivo: motivo.trim(),
      criado_por: usuarioLogado.nome,
      criado_em: new Date().toISOString()
    }]);
    if (error) {
      if (error.code === "23505") alert("⚠️ Este cliente já está na blacklist!");
      else alert("❌ Erro ao adicionar na blacklist.");
    } else {
      alert("🚫 Cliente adicionado à blacklist!");
      buscarBlacklist();
    }
  };

  const removerBlacklist = async (id) => {
    const { error } = await supabase.from("blacklist").delete().eq("id", id);
    if (error) alert("❌ Erro ao remover da blacklist.");
    else {
      alert("✅ Cliente removido da blacklist!");
      buscarBlacklist();
    }
  };

  const isClienteBanido = (id) => {
    return blacklist.some((b) => String(b.passaporte) === String(id));
  };

  const buscarHistoricoAdmin = async (limparFlag) => {
    const isLimpando = limparFlag === true || typeof limparFlag !== 'boolean';
    const paginaAlvo = isLimpando ? 0 : paginaHistorico;
    const { data } = await supabase.from("ponto_horas").select("*").order("data", { ascending: false }).order("entrada", { ascending: false })
      .range(paginaAlvo * 30, (paginaAlvo + 1) * 30 - 1);

    if (data) {
      if (isLimpando) {
        setHistoricoAdmin(data);
        setPaginaHistorico(1);
      } else {
        setHistoricoAdmin(prev => [...prev, ...data]);
        setPaginaHistorico(prev => prev + 1);
      }
      setTemMaisHistorico(data.length === 30);
    }
  };

  const buscarSolicitacoesPendentes = async () => {
    if (!usuarioLogado) return;
    const { data } = await supabase.from("solicitacoes_ponto").select("*").eq("status", "pendente").order("criado_em", { ascending: false });
    if (data) setSolicitacoesPendentes(data);
  };

  const montarISOComData = (dataPonto, horaStr) => {
    return new Date(`${dataPonto}T${horaStr}:00-03:00`).toISOString();
  };

  const solicitarEdicaoSaida = async (ponto) => {
    if (!novaSaidaInput) return alert("⚠️ Informe o horário de saída!");
    const dataParaUsar = novaSaidaDataInput || ponto.data;
    const novaISO = montarISOComData(dataParaUsar, novaSaidaInput);
    const entradaDate = new Date(ponto.entrada);
    const saidaDate = new Date(novaISO);
    if (saidaDate <= entradaDate) {
      alert("⚠️ A saída não pode ser anterior à entrada!\n\nSe o ponto foi aberto antes da meia-noite e fechado depois, selecione o dia seguinte no campo de data.");
      return;
    }

    const podeEditar = isAdminOuDono(usuarioLogado.role) || isResponsavelPonto(usuarioLogado.role);

    if (podeEditar) {
      if (ponto.origem === "auditoria" || ponto.uuid_sessao) {
        const durMin = Math.max(0, Math.round((saidaDate - entradaDate) / 60000));
        if (ponto.uuid_sessao) {
          await supabase.from("sessoes_ponto_auditoria_reds").update({ saida: novaISO, duracao_min: durMin }).eq("uuid_sessao", ponto.uuid_sessao);
          await supabase.from("ponto_cidade_reds").update({ saida: novaISO }).eq("uuid_entrada", ponto.uuid_sessao);
        } else if (ponto.id) {
          await supabase.from("sessoes_ponto_auditoria_reds").update({ saida: novaISO, duracao_min: durMin }).eq("id", ponto.id);
        }
        alert("✅ Saída atualizada!");
        setEditandoPontoId(null);
        setNovaSaidaInput("");
        setNovaSaidaDataInput("");
        setNovaSaidaJustificativa("");
        buscarHistoricoAdmin();
        buscarHistoricoPonto();
        buscarEmServico();
        buscarTotalHoras();
      } else {
        const { error } = await supabase.from("ponto_horas").update({ saida: novaISO }).eq("id", ponto.id);
        if (error) { alert("❌ Erro ao atualizar saída."); }
        else {
          alert("✅ Saída atualizada!");
          setEditandoPontoId(null);
          setNovaSaidaInput("");
          setNovaSaidaDataInput("");
          setNovaSaidaJustificativa("");
          buscarHistoricoAdmin();
          buscarHistoricoPonto();
          buscarEmServico();
          buscarTotalHoras();
        }
      }
    } else {
      if (!novaSaidaJustificativa.trim()) {
        alert("⚠️ Informe a justificativa da solicitação!");
        return;
      }
      const { error } = await supabase.from("solicitacoes_ponto").insert([{
        ponto_id: ponto.id,
        usuario_id: usuarioLogado.id,
        nome_usuario: usuarioLogado.nome,
        data_ponto: ponto.data,
        saida_atual: ponto.saida || null,
        nova_saida: novaISO,
        justificativa: novaSaidaJustificativa.trim(),
        status: "pendente",
        criado_em: new Date().toISOString(),
      }]);
      if (error) { alert("❌ Erro ao enviar solicitação."); }
      else {
        alert("📨 Solicitação enviada! Aguarde aprovação.");
        setEditandoPontoId(null);
        setNovaSaidaInput("");
        setNovaSaidaDataInput("");
        setNovaSaidaJustificativa("");
      }
    }
  };

  const aprovarSolicitacao = async (sol) => {
    const { error: updatePonto } = await supabase.from("ponto_horas").update({ saida: sol.nova_saida }).eq("id", sol.ponto_id);
    if (updatePonto) { alert("❌ Erro ao aplicar saída."); return; }
    await supabase.from("solicitacoes_ponto").update({ status: "aprovado", aprovado_por: usuarioLogado.id }).eq("id", sol.id);
    alert("✅ Solicitação aprovada e saída aplicada!");
    buscarSolicitacoesPendentes();
    buscarHistoricoAdmin();
    buscarEmServico();
    buscarTotalHoras();
  };

  const rejeitarSolicitacao = async (solId) => {
    await supabase.from("solicitacoes_ponto").update({ status: "rejeitado", aprovado_por: usuarioLogado.id }).eq("id", solId);
    alert("❌ Solicitação rejeitada.");
    buscarSolicitacoesPendentes();
  };

  // ===== PONTO ADMIN: IMPORTAÇÃO DE LOGS DA CIDADE =====
  // Usa tabela separada (pontos_reds), independente do ponto declarado (ponto_horas)
  const importarSessoesParaBanco = async (sessoes) => {
    if (!sessoes || sessoes.length === 0) {
      return { inseridos: 0, duplicados: 0, erros: 0 };
    }

    let inseridos = 0;
    let duplicados = 0;
    let erros = 0;

    for (const s of sessoes) {
      let existenteId = null;

      // 1. Tentar achar pelo UUID de entrada
      if (s.uuid_entrada) {
        const { data: existente } = await supabase
          .from("pontos_reds")
          .select("id")
          .eq("uuid_entrada", s.uuid_entrada)
          .maybeSingle();
        if (existente) existenteId = existente.id;
      }

      // 2. Se não achou pelo UUID, tentar achar por id_jogo + mesmo minuto de entrada
      if (!existenteId && s.entrada) {
        const dEntrada = new Date(s.entrada);
        const inicioMin = new Date(new Date(dEntrada).setSeconds(0, 0)).toISOString();
        const fimMin = new Date(new Date(dEntrada).setSeconds(59, 999)).toISOString();

        const { data: existente } = await supabase
          .from("pontos_reds")
          .select("id")
          .eq("id_jogo", s.id_jogo)
          .gte("entrada", inicioMin)
          .lte("entrada", fimMin)
          .maybeSingle();
        
        if (existente) existenteId = existente.id;
      }

      const registro = {
        usuario_id: s.usuario_id || null,
        nome: s.nome,
        nome_personagem: s.nome_personagem,
        id_jogo: s.id_jogo,
        entrada: s.entrada,
        saida: s.saida || null,
        data: s.data,
        uuid_entrada: s.uuid_entrada || null,
        uuid_saida: s.uuid_saida || null,
        importado_por: s.importado_por || null,
        verificado: !!(s.uuid_entrada && s.uuid_saida),
      };

      if (existenteId) {
        // Se já existe, atualizamos (FORÇAR SOBRESCREVER)
        const { error } = await supabase.from("pontos_reds").update(registro).eq("id", existenteId);
        if (error) {
          console.error("Erro ao atualizar pontos_reds:", error.message);
          erros++;
        } else {
          duplicados++; // Contamos como 'atualizado/duplicado' para o resumo
        }
      } else {
        // Se não existe, inserimos
        const { error } = await supabase.from("pontos_reds").insert([registro]);
        if (error) {
          console.error("Erro ao inserir pontos_reds:", error.message);
          erros++;
        } else {
          inseridos++;
        }
      }
    }

    return { inseridos, duplicados, erros };
  };

  const buscarPontoCidade = async ({ nome = "", dataInicio = "", dataFim = "", trazerTudo = false } = {}) => {
    setRegistrosCidadeCarregando(true);
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    // Se não informou período e não pediu tudo (trazerTudo = false), limita da segunda-feira da semana passada até hoje
    let dataInicioEfetiva = dataInicio;
    if (!dataInicio && !dataFim && !trazerTudo) {
      const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const diaSemana = agora.getDay();
      const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
      const segundaSemanaPassada = new Date(agora);
      segundaSemanaPassada.setDate(agora.getDate() - diasDesdeSegunda - 7);
      dataInicioEfetiva = segundaSemanaPassada.toLocaleDateString("en-CA"); // YYYY-MM-DD
    }

    try {
      while (hasMore && allData.length < 30000) {
        let query = supabase
          .from("ponto_cidade_reds")
          .select("*")
          .or("oculto.is.null,oculto.eq.false")   // exclui registros ocultos
          .order("entrada", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (nome.trim()) {
          const nomeLike = `%${nome.trim()}%`;
          query = query.or(`nome.ilike.${nomeLike},nome_personagem.ilike.${nomeLike},id_jogo.ilike.${nomeLike}`);
        }
        if (dataInicioEfetiva) query = query.gte("data", dataInicioEfetiva);
        if (dataFim)           query = query.lte("data", dataFim);

        const { data, error } = await query;
        if (error) {
          console.error("Erro ao buscar logs da cidade:", error.message);
          hasMore = false;
        } else if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }
      setRegistrosCidade(allData);
    } catch (e) {
      console.error("Erro fatal na busca em lotes:", e);
    } finally {
      setRegistrosCidadeCarregando(false);
      // Buscar também registros do site para conciliação
      buscarHistoricoPonto({ nome, dataInicio, dataFim });
    }
  };

  const clonarPontoCidadeParaSite = async (logCidade) => {
    if (!logCidade.saida) {
      alert("⚠️ Não é possível clonar um ponto que ainda está aberto na cidade.");
      return;
    }

    const { error } = await supabase.from("ponto_horas").insert({
      usuario_id: logCidade.usuario_id,
      nome: logCidade.nome,
      entrada: logCidade.entrada,
      saida: logCidade.saida,
      data: logCidade.data,
      verificado: true
    });

    if (error) {
      alert("❌ Erro ao clonar ponto: " + error.message);
      return;
    }

    alert("✅ Ponto clonado com sucesso!");
    // Atualizar usando os filtros globais atuais para manter a visão do admin consistente
    if (buscarPontoCidade) {
      buscarPontoCidade({ 
        nome: filtroPontoNome, 
        dataInicio: filtroPontoDataIni, 
        dataFim: filtroPontoDataFim 
      });
    }
  };

  const buscarPontoCidadeOcultos = async () => {
    setRegistrosOcultosCarregando(true);
    const { data } = await supabase
      .from("ponto_cidade_reds")
      .select("*")
      .eq("oculto", true)
      .order("entrada", { ascending: false });
    if (data) setRegistrosOcultos(data);
    setRegistrosOcultosCarregando(false);
  };

  const atualizarPontoCidade = async (id, campos) => {
    const { error } = await supabase.from("pontos_reds").update(campos).eq("id", id);
    return { error };
  };

  const deletarPontoCidade = async (id) => {
    const { error } = await supabase.from("pontos_reds").delete().eq("id", id);
    return { error };
  };

  const buscarRelatorio = async ({ dataInicio = "", dataFim = "" } = {}) => {
    setRegistrosRelatorioCarregando(true);
    
    const fetchTableData = async (tableName) => {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore && allData.length < 50000) {
        let query = supabase
          .from(tableName)
          .select("*")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (tableName === "pontos_reds") {
          query = query.order("entrada", { ascending: true });
          if (dataInicio) query = query.gte("entrada", `${dataInicio}T00:00:00-03:00`);
          if (dataFim) {
            const dtF = new Date(`${dataFim}T12:00:00-03:00`);
            dtF.setDate(dtF.getDate() + 1);
            const diaSeg = dtF.toLocaleDateString("en-CA");
            query = query.lte("entrada", `${diaSeg}T09:00:00-03:00`);
          }
        } else {
          query = query.or("oculto.is.null,oculto.eq.false").order("id", { ascending: true });
          if (dataInicio) query = query.gte("data", dataInicio);
          if (dataFim)    query = query.lte("data", dataFim);
        }
        
        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }
      return allData;
    };

    try {
      const [dataM1, dataM2, dataM3, dataM4] = await Promise.all([
        fetchTableData("pontos_reds"),
        fetchTableData("ponto_cidade_mecanica_2"),
        fetchTableData("ponto_cidade_mecanica_3"),
        fetchTableData("ponto_cidade_mecanica_4"),
      ]);
      setRegistrosRelatorio(dataM1);
      setRegistrosRelatorioM2(dataM2);
      setRegistrosRelatorioM3(dataM3);
      setRegistrosRelatorioM4(dataM4);
    } catch (err) {
      console.error("Erro ao buscar relatórios em lotes:", err);
    } finally {
      setRegistrosRelatorioCarregando(false);
    }
  };



  // ===== CONTROLE VENDAS (NITRO + DRIFT): INTEGRAÇÃO SUPABASE =====
  const buscarNitroLogs = async ({ nome = "", dataInicio = null, dataFim = null } = {}) => {
    setNitroLogsCarregando(true);
    setNitroLogsError(false);
    try {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore && allData.length < 20000) {
        let query = supabase.from("vendas_nitro_cidade").select("*").order("data_compra", { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
        if (dataInicio) query = query.gte("data_compra", `${dataInicio}T00:00:00-03:00`);
        if (dataFim) query = query.lte("data_compra", `${dataFim}T23:59:59-03:00`);
        const { data, error } = await query;
        if (error) {
          if (error.code === '42P01') {
            setNitroLogsError(true);
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
      
      setNitroLogs(res);
    } catch (err) {
      console.error("Erro ao buscar logs de nitro:", err);
    }
    setNitroLogsCarregando(false);
  };

  const importarNitroLogsParaBanco = async (sessoesNitro) => {
    if (!sessoesNitro || sessoesNitro.length === 0) return { inseridos: 0, duplicados: 0, erros: 0 };
    let inseridos = 0; let duplicados = 0; let erros = 0;

    for (const compra of sessoesNitro) {
      if (!compra.uuid_log) { erros++; continue; }
      
      const { data: ext } = await supabase.from("vendas_nitro_cidade").select("id").eq("uuid_log", compra.uuid_log).maybeSingle();
      if (ext) { duplicados++; continue; }

      const payload = { ...compra, importado_por: usuarioLogado?.id || null };
      const { error } = await supabase.from("vendas_nitro_cidade").insert([payload]);
      
      if (error) erros++;
      else inseridos++;
    }
    return { inseridos, duplicados, erros };
  };

  const atualizarLinksNitro = async (id, { link_venda, link_bancada }) => {
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
        if (dataInicio) query = query.gte("data_compra", `${dataInicio}T00:00:00-03:00`);
        if (dataFim) query = query.lte("data_compra", `${dataFim}T23:59:59-03:00`);
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
  };

  // ===== FUNÇÕES: HIERARQUIA =====

  const buscarHierarquia = async () => {
    const { data } = await supabase
      .from("usuarios")
      .select("id, nome, role, telefone, oculto_hierarquia")
      .order("nome", { ascending: true });
    if (data) setHierarquiaFuncionarios(data);
  };

  const toggleOcultoHierarquia = async (funcId, atualOculto) => {
    const { error } = await supabase
      .from("usuarios")
      .update({ oculto_hierarquia: !atualOculto })
      .eq("id", funcId);
    if (error) { alert("❌ Erro: " + error.message); return; }
    buscarHierarquia();
  };

  // ===== FUNÇÕES: FINANÇAS =====

  const buscarFinancas = async () => {
    setFinancasCarregando(true);
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore && allData.length < 5000) {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .or("status.is.null,status.neq.inativo")
        .order("id", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...data];
        if (data.length < pageSize) hasMore = false;
        else page++;
      }
    }
    if (allData.length > 0) {
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      let houveAlteracao = false;

      // Mapear dados para processar bloqueios e renovações localmente
      const dadosProcessados = await Promise.all(allData.map(async (f) => {
        const dVenc = f.data_vencimento ? new Date(f.data_vencimento + "T12:00:00") : null;
        const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        
        // Regra de isenção por data de admissão
        let isentoPorAdmissao = false;
        if (f.data_admissao && f.data_vencimento) {
          const adm = new Date(f.data_admissao + "T12:00:00");
          const diaS = adm.getDay();
          const diffS = diaS === 0 ? -6 : 1 - diaS;
          const segAdm = new Date(adm); segAdm.setDate(adm.getDate() + diffS);
          const domAdm = new Date(segAdm); domAdm.setDate(segAdm.getDate() + 6);
          
          const ven = new Date(f.data_vencimento + "T12:00:00");
          // Se a semana do vencimento é a mesma ou anterior à semana de admissão, não cobra
          if (ven <= domAdm) isentoPorAdmissao = true;
        }

        const vencido = f.data_vencimento && f.data_vencimento < hoje && f.valor_semanal > 0 && !isentoPorAdmissao;
        
        if (vencido) {
          const updateData = {};
          let alterouEste = false;

          // Bloquear se ainda não estiver bloqueado
          if (!f.bloqueado_financeiro) {
            updateData.bloqueado_financeiro = true;
            alterouEste = true;
          }

          // Se renovação automática ativada: avança vencimento +7 dias
          if (f.renovacao_auto && f.data_vencimento) {
            const dataAtual = new Date(f.data_vencimento + "T12:00:00");
            dataAtual.setDate(dataAtual.getDate() + 7);
            updateData.data_vencimento = dataAtual.toLocaleDateString("en-CA");
            alterouEste = true;
          }

          if (alterouEste) {
            houveAlteracao = true;
            const { error } = await supabase.from("usuarios").update(updateData).eq("id", f.id);
            
            if (!error) {
              // Se renovou, gera log de cobrança
              const dVen = new Date((updateData.data_vencimento || f.data_vencimento) + "T12:00:00");
              const diaS = dVen.getDay();
              const diffS = diaS === 0 ? -6 : 1 - diaS;
              const seg = new Date(dVen); seg.setDate(dVen.getDate() + diffS);
              const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
              const labelSemana = `Semana de ${seg.toLocaleDateString("pt-BR").slice(0, 5)} até ${dom.toLocaleDateString("pt-BR").slice(0, 5)}`;

              await supabase.from("pagamentos_semanais").insert({
                funcionario_id: f.id,
                funcionario_nome: f.nome,
                valor: f.valor_semanal,
                confirmado: false,
                observacao: `Cobrança automática - ${labelSemana}`
              });

              return { ...f, ...updateData };
            }
          }
        } else if (f.bloqueado_financeiro) {
          // Se não está vencido mas está marcado como bloqueado no banco, desbloqueia automaticamente
          houveAlteracao = true;
          await supabase.from("usuarios").update({ bloqueado_financeiro: false }).eq("id", f.id);
          return { ...f, bloqueado_financeiro: false };
        }
        return f;
      }));

      setFinancasFuncionarios(dadosProcessados);
      if (houveAlteracao) buscarPagamentosSemanais();
    }
    setFinancasCarregando(false);
  };

  const buscarPagamentosSemanais = async () => {
    const { data } = await supabase
      .from("pagamentos_semanais")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(3000);
    if (data) setPagamentosSemanais(data);
  };

  const iniciarEdicaoFinanca = (func) => {
    setEditandoFinancaId(func.id);
    setEditFinancaValor(func.valor_semanal ? String(func.valor_semanal) : "");
    setEditFinancaVencimento(func.data_vencimento || "");
    setEditFinancaRenovacao(func.renovacao_auto !== false);
  };

  const salvarFinancaFuncionario = async (funcId) => {
    const updateData = {
      renovacao_auto: editFinancaRenovacao,
    };
    const val = (editFinancaValor === "" || editFinancaValor === "0") ? 0 : Number(String(editFinancaValor).replace(/\D/g, ""));
    updateData.valor_semanal = val;

    if (val === 0) {
      updateData.data_vencimento = null;
    } else if (editFinancaVencimento) {
      updateData.data_vencimento = editFinancaVencimento;
    }
    const { error } = await supabase.from("usuarios").update(updateData).eq("id", funcId);
    if (error) { alert("❌ Erro ao salvar: " + error.message); return; }
    alert("✅ Configuração de cobrança salva!");
    setEditandoFinancaId(null);
    buscarFinancas();
    if (funcId === usuarioLogado?.id) buscarDadosUsuario();
  };

  const registrarPagamentoManual = async (funcId, funcNome, valor, semanaLabel, linkComprovante, dataDomingo = null) => {
    const agora = new Date().toISOString();
    const { error } = await supabase.from("pagamentos_semanais").insert({
      funcionario_id: funcId,
      funcionario_nome: funcNome,
      valor: valor,
      confirmado: true,
      confirmado_por: usuarioLogado.id,
      confirmado_em: agora,
      comprovante_link: linkComprovante,
      observacao: `Registro Manual Retroativo - ${semanaLabel}`
    });

    if (error) {
      alert("❌ Erro ao registrar pagamento: " + error.message);
      return;
    }

    // Lógica de atualização de vencimento automática
    if (dataDomingo) {
      const { data: user } = await supabase.from("usuarios").select("data_vencimento").eq("id", funcId).single();
      if (user && (!user.data_vencimento || user.data_vencimento < dataDomingo)) {
        // Se pagou o domingo X, o vencimento é o domingo X + 7
        const dataV = new Date(dataDomingo + "T12:00:00");
        dataV.setDate(dataV.getDate() + 7);
        const novaDataStr = dataV.toLocaleDateString("en-CA");

        await supabase.from("usuarios").update({ 
          data_vencimento: novaDataStr,
          bloqueado_financeiro: false 
        }).eq("id", funcId);
      }
    }

    alert("✅ Pagamento retroativo registrado e confirmado!");
    buscarPagamentosSemanais();
    buscarFinancas();
  };

  const confirmarPagamentoSemanal = async (pagId, funcId, funcNome, linkComprovante = null, dataDomingo = null) => {
    const agora = new Date().toISOString();
    
    // 1. Atualizar o registro de pagamento
    const { error: errorPag } = await supabase
      .from("pagamentos_semanais")
      .update({ 
        confirmado: true, 
        confirmado_por: usuarioLogado.id, 
        confirmado_em: agora,
        comprovante_link: linkComprovante 
      })
      .eq("id", pagId);

    if (errorPag) {
      alert("❌ Erro ao confirmar pagamento: " + errorPag.message);
      return;
    }

    // 2. Lógica de atualização de vencimento do funcionário
    // Só avançamos o vencimento se o Domingo dessa semana for maior que o vencimento atual dele
    const func = financasFuncionarios.find((f) => f.id === funcId);
    
    let deveAtualizarVencimento = false;
    let novaDataVencimento = null;

    if (dataDomingo) {
      if (!func?.data_vencimento || func.data_vencimento < dataDomingo) {
        deveAtualizarVencimento = true;
        // Se pagou o domingo X, o vencimento é o domingo X + 7
        const dataV = new Date(dataDomingo + "T12:00:00");
        dataV.setDate(dataV.getDate() + 7);
        novaDataVencimento = dataV.toLocaleDateString("en-CA");
      }
    } else {
      // Fallback para quando não temos dataDomingo (lista de confirmação geral)
      const hoje = new Date();
      const vencoAntigo = func?.data_vencimento ? new Date(func.data_vencimento + "T12:00:00") : hoje;
      const base = vencoAntigo > hoje ? vencoAntigo : hoje;
      const nova = new Date(base);
      const diasAteDomingo = 7 - nova.getDay();
      nova.setDate(nova.getDate() + (diasAteDomingo === 0 ? 7 : diasAteDomingo));
      novaDataVencimento = nova.toLocaleDateString("en-CA");
      deveAtualizarVencimento = true;
    }

    const updateData = {
      bloqueado_financeiro: false,
      credito_24h_disponivel: true,
      credito_24h_usado_em: null,
    };

    if (deveAtualizarVencimento && novaDataVencimento) {
      updateData.data_vencimento = novaDataVencimento;
    }

    await supabase.from("usuarios").update(updateData).eq("id", funcId);

    alert(`✅ Pagamento de ${funcNome} confirmado! Acesso atualizado.`);
    buscarFinancas();
    buscarPagamentosSemanais();
    if (funcId === usuarioLogado?.id) buscarDadosUsuario();
  };

  const atualizarVencimentoManual = async (funcId, novaData) => {
    const { error } = await supabase.from("usuarios").update({ data_vencimento: novaData }).eq("id", funcId);
    if (error) {
      alert("❌ Erro ao atualizar vencimento.");
    } else {
      alert(`✅ Vencimento atualizado para ${novaData}`);
      buscarFinancas();
    }
  };

  const desbloquearFuncionario = async (funcId, funcNome) => {
    const confirmar = window.confirm(`Deseja desbloquear o acesso de ${funcNome}?`);
    if (!confirmar) return;

    // 🔹 pega dados atuais
    const func = financasFuncionarios.find((f) => f.id === funcId);

    let novaData = null;

    if (func?.data_vencimento) {
      const hoje = new Date();
      const vencoAntigo = new Date(func.data_vencimento + "T12:00:00");
      const base = vencoAntigo > hoje ? vencoAntigo : hoje;

      const dataAtual = new Date(base);
      const diasAteDomingo = 7 - dataAtual.getDay();
      dataAtual.setDate(dataAtual.getDate() + (diasAteDomingo === 0 ? 7 : diasAteDomingo));
      novaData = dataAtual.toLocaleDateString("en-CA");
    } else {
      // Se não tinha vencimento, joga para o próximo domingo
      const nova = new Date();
      const diasAteDomingo = 7 - nova.getDay();
      nova.setDate(nova.getDate() + (diasAteDomingo === 0 ? 7 : diasAteDomingo));
      novaData = nova.toLocaleDateString("en-CA");
    }

    const { error } = await supabase
      .from("usuarios")
      .update({
        bloqueado_financeiro: false,
        data_vencimento: novaData,
      })
      .eq("id", funcId);

    if (error) {
      alert("❌ Erro: " + error.message);
      return;
    }

    alert(`✅ ${funcNome} desbloqueado + vencimento atualizado!`);
    buscarFinancas();
    if (funcId === usuarioLogado?.id) buscarDadosUsuario();
  };

  const alterarDataVencimento = async (funcId, novaData) => {
    const { error } = await supabase
      .from("usuarios")
      .update({ data_vencimento: novaData })
      .eq("id", funcId);
    if (error) { alert("❌ Erro ao alterar data: " + error.message); return; }
    buscarFinancas();
  };

  // ===== FUNÇÕES: CRÉDITO 24H (BLOQUEIO) =====

  const usarCredito24h = async () => {
    if (!usuarioLogado?.credito_24h_disponivel) {
      alert("❌ Crédito de liberação temporária não disponível. Contate um administrador.");
      return;
    }
    const agora = new Date().toISOString();
    const { error } = await supabase
      .from("usuarios")
      .update({ credito_24h_disponivel: false, credito_24h_usado_em: agora })
      .eq("id", usuarioLogado.id);
    if (error) { alert("❌ Erro ao usar crédito: " + error.message); return; }
    setUsuarioLogado((prev) => ({ ...prev, credito_24h_disponivel: false, credito_24h_usado_em: agora }));
    setNomeMecanico(usuarioLogado.nome);
    setPaginaAtual("dashboard");
  };

  // ===== FUNÇÕES: MINHA CONTA =====

  const buscarMeusServicos = async () => {
    if (!usuarioLogado) return;
    const { data } = await supabase
      .from("servicos")
      .select("*")
      .eq("funcionario_id", usuarioLogado.id)
      .order("criado_em", { ascending: false })
      .limit(5000);
    if (data) setMeusServicos(data);
  };

  const buscarMinhasNotificacoes = async () => {
    if (!usuarioLogado) return;
    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("funcionario_id", usuarioLogado.id)
      .order("criado_em", { ascending: false })
      .limit(50);
    if (data) setMinhasNotificacoes(data);
  };

  const darEstrelaPonto = async (pontoId, valor) => {
    const { error } = await supabase.from("ponto_horas").update({ estrela: valor }).eq("id", pontoId);
    if (!error) {
      setHistoricoPonto(prev => prev.map(p => p.id === pontoId ? { ...p, estrela: valor } : p));
    } else {
      console.error("Erro ao dar estrela:", error);
      alert("Erro ao salvar estrela: " + error.message);
    }
    return { error };
  };

  const buscarMeusTopClientes = async () => {
    if (!usuarioLogado) return;
    const { data } = await supabase
      .from("servicos")
      .select("cliente_id, cliente_nome, valor_total")
      .eq("funcionario_id", usuarioLogado.id);
    if (data) {
      const totais = {};
      data.forEach((s) => {
        if (!s.cliente_id) return;
        if (!totais[s.cliente_id])
          totais[s.cliente_id] = { cliente_id: s.cliente_id, cliente_nome: s.cliente_nome, total_gasto: 0, count: 0 };
        totais[s.cliente_id].total_gasto += Number(s.valor_total) || 0;
        totais[s.cliente_id].count++;
      });
      setMeusTopClientes(Object.values(totais).sort((a, b) => b.total_gasto - a.total_gasto).slice(0, 10));
    }
  };

  const reportarPagamentoSemanal = async (semanaSelecionada) => {
    if (!reportValorSemanal) { alert("⚠️ Informe o valor pago!"); return; }
    const valor = Number(String(reportValorSemanal).replace(/\D/g, ""));
    if (!valor) { alert("⚠️ Valor inválido!"); return; }
    
    let obs = reportObsSemanal.trim();
    if (typeof semanaSelecionada === 'string' && semanaSelecionada) {
      obs = `[${semanaSelecionada}] ${obs}`.trim();
    }

    const { error } = await supabase.from("pagamentos_semanais").insert({
      funcionario_id: usuarioLogado.id,
      funcionario_nome: usuarioLogado.nome,
      valor,
      observacao: obs || null,
      confirmado: false,
      comprovante_link: reportLinkSemanal.trim() || null,
      criado_em: new Date().toISOString(),
    });
    if (error) { alert("❌ Erro ao reportar pagamento: " + error.message); return; }
    alert("✅ Pagamento reportado! Aguarde confirmação do administrador para liberar o acesso.");
    buscarMeusPagamentos();
    setReportValorSemanal("");
    setReportObsSemanal("");
    setReportLinkSemanal("");
  };

  const atualizarComprovanteDossie = async (pagId, link) => {
    if (!link || !link.trim()) { alert("⚠️ Informe o link do comprovante!"); return; }
    const { error } = await supabase
      .from("pagamentos_semanais")
      .update({ comprovante_link: link.trim() })
      .eq("id", pagId);
    
    if (error) { alert("❌ Erro ao atualizar: " + error.message); return; }
    alert("✅ Comprovante enviado com sucesso!");
    buscarMeusPagamentos();
  };

  // ===== FUNÇÕES: CANDIDATURAS =====

  const buscarCandidaturas = async () => {
    setCandidaturasCarregando(true);
    const { data, error } = await supabase
      .from("candidaturas")
      .select("*")
      .order("criado_em", { ascending: false });
    if (!error && data) {
      setCandidaturas(data);
    }
    setCandidaturasCarregando(false);
  };

  const enviarCandidatura = async (dados) => {
    if (!usuarioLogado) return false;
    const { error } = await supabase.from("candidaturas").insert({
      usuario_id: usuarioLogado.id,
      usuario_nome: usuarioLogado.nome,
      area: dados.area,
      area_titulo: dados.area_titulo,
      carta_apresentacao: dados.carta,
      justificativa: dados.justificativa,
      status: "pendente",
      criado_em: new Date().toISOString()
    });

    if (error) {
      alert("❌ Erro ao enviar candidatura: " + error.message);
      return false;
    }
    alert("✅ Sua candidatura foi enviada com sucesso! Aguarde a análise do RH.");
    buscarCandidaturas();
    return true;
  };

  const analisarCandidatura = async (id, status, feedback) => {
    const { error } = await supabase
      .from("candidaturas")
      .update({
        status,
        feedback_admin: feedback,
        analisado_por: usuarioLogado.id,
        analisado_em: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      alert("❌ Erro ao processar: " + error.message);
      return;
    }
    alert(`✅ Candidatura ${status === "aprovada" ? "aprovada" : "rejeitada"}!`);
    buscarCandidaturas();
  };

  // ===== FUNÇÕES: RECRUTAMENTO (CURRICULOS) =====

  const buscarCurriculos = async () => {
    setCurriculosCarregando(true);
    const { data, error } = await supabase.from("curriculos").select("*").order("criado_em", { ascending: false });
    if (!error && data) setCurriculos(data);
    setCurriculosCarregando(false);
  };

  const salvarCurriculo = async (dados) => {
    const { error } = await supabase.from("curriculos").insert({
      nome: dados.nome,
      telefone: dados.telefone,
      disponibilidade: dados.disponibilidade,
      data_envio: dados.data_envio || null,
      obs: dados.obs || "",
      criado_em: new Date().toISOString(),
      contatado: false
    });
    if (error) { alert("❌ Erro ao salvar currículo: " + error.message); return false; }
    buscarCurriculos();
    return true;
  };

  const deletarCurriculo = async (id) => {
    if (!window.confirm("Tem certeza que deseja APAGAR este currículo?")) return;
    const { error } = await supabase.from("curriculos").delete().eq("id", id);
    if (!error) buscarCurriculos();
  };

  const toggleContatadoCurriculo = async (id, statusAtual) => {
    const { error } = await supabase.from("curriculos").update({ contatado: !statusAtual }).eq("id", id);
    if (!error) buscarCurriculos();
  };

  const atualizarCurriculo = async (id, novosDados) => {
    const { error } = await supabase.from("curriculos").update({
      nome: novosDados.nome,
      telefone: novosDados.telefone,
      disponibilidade: novosDados.disponibilidade,
      data_envio: novosDados.data_envio,
      obs: novosDados.obs
    }).eq("id", id);
    if (error) { alert("❌ Erro ao atualizar currículo: " + error.message); return false; }
    buscarCurriculos();
    return true;
  };

  const verificarNitroCliente = async (id) => {
    if (!id || isNaN(id)) { setHistoricoNitroRecente([]); return; }
    const dozeHorasAtras = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    
    // Agora busca APENAS na nossa tabela interna de vendas de nitro
    const { data, error } = await supabase
      .from("vendas_nitro")
      .select("criado_em")
      .eq("cliente_id", Number(id))
      .gte("criado_em", dozeHorasAtras)
      .order("criado_em", { ascending: false });

    if (!error && data) {
      setHistoricoNitroRecente(data.map(l => l.criado_em));
    } else {
      setHistoricoNitroRecente([]);
    }
  };

  const salvarVendaNitro = async (clienteId, clienteNome, valor) => {
    if (!usuarioLogado) return;
    await supabase.from("vendas_nitro").insert({
      cliente_id: Number(clienteId),
      cliente_nome: clienteNome,
      mecanico_id: usuarioLogado.id,
      mecanico_nome: usuarioLogado.nome,
      valor: valor,
      criado_em: new Date().toISOString()
    });
  };

  const calcularTotal = () => {
    const rules = REGRAS_PRECOS;
    let somaPeças = 0;
    let somaCamaleao = 0;
    if (camaleao1) somaCamaleao += rules.estetica.valor_cliente_camaleao;
    if (camaleao2) somaCamaleao += rules.estetica.valor_cliente_camaleao;
    if (camaleaoRodas) somaCamaleao += rules.estetica.valor_cliente_camaleao;

    const somaExtrasPainel = quantidadeExtras * rules.estetica.painel_extra;
    const somaExtrasFinal = quantidadeExtras * rules.estetica.valor_cliente_extra;
    const somaFumacaFinal = fumaca ? rules.estetica.valor_cliente_fumaca : 0;

    const todasPeças = Object.values(TABELA_PRECOS).flat();

    // Soma o valor de painel de todos os itens de performance selecionados
    let somaPainelPerformance = 0;
    Object.keys(servicosSelecionados).forEach((id) => {
      if (servicosSelecionados[id]) {
        const p = todasPeças.find((x) => x.id === id);
        if (p) {
          somaPeças += p.preco;
          somaPainelPerformance += p.painel || 0;
        }
      }
    });

    const km = Number(kmGuincho) || 0;
    const custoGuincho = km > 0 ? rules.guincho.valor_fixo + Math.ceil(km) * rules.guincho.valor_km : 0;

    const qtdCamaleao = [camaleao1, camaleao2, camaleaoRodas].filter(Boolean).length;
    const descontoCamaleao = qtdCamaleao * rules.estetica.painel_camaleao;

    // Valor base in-game: deduz fumaça, extras, camaleão E itens de performance
    const valorBaseEsteticaPainel = Math.max(0, Number(valorDigitadoEstetica) - (fumaca ? rules.estetica.painel_fumaca : 0) - somaExtrasPainel - descontoCamaleao - somaPainelPerformance);

    // Cálculo de proporção (Regra de Três) solicitado pelo usuário
    const valorEsteticaFinal = (valorBaseEsteticaPainel / rules.estetica.painel_referencia) * rules.estetica.valor_cliente_referencia;

    return (
      valorEsteticaFinal +
      somaPeças +
      somaCamaleao +
      somaExtrasFinal +
      somaFumacaFinal +
      custoGuincho +
      Number(qtdReparos) * rules.guincho.valor_reparo +
      Number(qtdPneus) * rules.guincho.valor_pneu
    );
  };

  // ===== ENVIO DISCORD =====

  const handleFilePagamento = (e) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImagemPagamento(file);
      setPreviewPagamento(URL.createObjectURL(file));
    }
  };

  const handlePastePagamento = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) handleFilePagamento({ target: { files: [file] } });
        return;
      }
    }
  };

  const limparFormularioPagamento = () => {
    setValorPagamentoRegistro("");
    setObservacaoPagamento("");
    setImagemPagamento(null);
    setPreviewPagamento(null);
  };

  const enviarRegistroPagamento = async (semanaSelecionada) => {
    if (!usuarioLogado) { alert("⚠️ Usuário não identificado."); return; }
    if (!valorPagamentoRegistro) { alert("⚠️ Informe o valor do pagamento."); return; }
    if (!imagemPagamento) { alert("⚠️ Envie a foto do comprovante."); return; }
    const valorNumerico = Number(String(valorPagamentoRegistro).replace(/\D/g, ""));
    if (!valorNumerico || valorNumerico <= 0) { alert("⚠️ Informe um valor válido."); return; }
      const embed = {
        title: "💸 REGISTRO DE PAGAMENTO",
        color: 5763719,
        fields: [
          { name: "👨‍🔧 Funcionário", value: usuarioLogado.nome || "Não informado", inline: true },
          { name: "🪪 ID", value: String(usuarioLogado.id || "N/A"), inline: true },
          { name: "💰 Valor", value: `$${valorNumerico.toLocaleString("pt-BR")}`, inline: true },
          { 
            name: "📝 Observação", 
            value: (semanaSelecionada ? `[${semanaSelecionada}] ` : "") + (observacaoPagamento?.trim() || "Sem observações."), 
            inline: false 
          },
        ],
        image: { url: "attachment://comprovante.png" },
        footer: { text: "RED'S TUNERSHOP - Registro de Pagamentos" },
        timestamp: new Date(),
      };
      try {
        const formData = new FormData();
        formData.append("payload_json", JSON.stringify({ embeds: [embed] }));
        formData.append("files[0]", imagemPagamento, "comprovante.png");

      // Segundo FormData separado pois the blob pode ser consumido no primeiro fetch
      const formData2 = new FormData();
      formData2.append("payload_json", JSON.stringify({ embeds: [embed] }));
      formData2.append("files[0]", imagemPagamento, "comprovante.png");

      const [res1, res2] = await Promise.all([
        fetch(WEBHOOK_PAGAMENTOS + "?wait=true", { method: "POST", body: formData }),
        fetch(WEBHOOK_CAIXA2 + "?wait=true", { method: "POST", body: formData2 }),
      ]);

      if (!res1.ok && !res2.ok) { alert("❌ Erro ao enviar pagamento para o Discord."); return; }

      // Tentar capturar o link da mensagem do Discord
      let linkDiscord = "";
      try {
        const data = await res1.json();
        const msgId = data.id;
        // Se o Discord não retornar channel_id ou guild_id, tentamos pegar da URL ou usamos o ID conhecido do servidor
        const chanId = data.channel_id || WEBHOOK_PAGAMENTOS?.split("/webhooks/")[1]?.split("/")[0];
        const gldId = data.guild_id || "1486119705814106307";

        if (msgId && chanId) {
          linkDiscord = `https://discord.com/channels/${gldId}/${chanId}/${msgId}`;
        } else if (data.embeds?.[0]?.image?.url) {
          linkDiscord = data.embeds[0].image.url;
        } else if (data.attachments?.[0]?.url) {
          linkDiscord = data.attachments[0].url;
        }
      } catch (e) { console.log("Erro ao ler JSON do Discord", e); }

      // Verificar se já existe um registro pendente sem comprovante para esta semana
      let registroExistente = null;
      if (semanaSelecionada) {
        const { data: ext } = await supabase
          .from("pagamentos_semanais")
          .select("id")
          .eq("funcionario_id", usuarioLogado.id)
          .eq("confirmado", false)
          .is("comprovante_link", null)
          .ilike("observacao", `%${semanaSelecionada}%`)
          .limit(1)
          .maybeSingle();
        registroExistente = ext;
      }

      if (registroExistente) {
        await supabase
          .from("pagamentos_semanais")
          .update({
            valor: valorNumerico,
            comprovante_link: linkDiscord,
            observacao: `[${semanaSelecionada}] ` + (observacaoPagamento?.trim() || "")
          })
          .eq("id", registroExistente.id);
      } else {
        await supabase.from("pagamentos_semanais").insert({
          funcionario_id: usuarioLogado.id,
          funcionario_nome: usuarioLogado.nome,
          valor: valorNumerico,
          confirmado: false,
          comprovante_link: linkDiscord,
          observacao: (semanaSelecionada ? `[${semanaSelecionada}] ` : "") + (observacaoPagamento?.trim() || "")
        });
      }

      alert("✅ Pagamento registrado com sucesso! Aguarde a confirmação do financeiro.");
      limparFormularioPagamento();
      buscarPagamentosSemanais();
    } catch (error) {
      alert("❌ Erro de conexão ao enviar pagamento.");
    }
  };

  const enviarParaDiscord = async () => {
    if (salvandoServico) return;
    try {
      if (reportBugs) {
        if (!passaporte) { alert("⚠️ Informe o ID do cliente!"); return; }
        if (!imagemBugs) { alert("⚠️ Envie a imagem!"); return; }
        if (!nomeVeiculoBugs) { alert("⚠️ Informe o nome do veículo!"); return; }
        setSalvandoServico(true);
        const formData = new FormData();
        const embedFields = [
          { name: "🚗 Veículo", value: nomeVeiculoBugs },
          { name: "👤 Cliente", value: `${cliente} (ID: ${passaporte})` },
          { name: "👨‍🔧 Mecânico", value: nomeMecanico || usuarioLogado?.nome || "Mecânico" },
        ];
        if (descricaoBug.trim()) embedFields.push({ name: "📝 Descrição do Bug", value: descricaoBug });
        const embed = { title: "🚨 VEÍCULO COM BUGS ", color: 16711680, fields: embedFields, image: { url: "attachment://veiculo.png" }, timestamp: new Date() };
        formData.append("payload_json", JSON.stringify({ embeds: [embed] }));
        formData.append("files[0]", imagemBugs, "veiculo.png");
        const response = await fetch(WEBHOOK_REPORT, { method: "POST", body: formData });
        if (WEBHOOK_RODAS) await fetch(WEBHOOK_RODAS, { method: "POST", body: formData });
        if (!response.ok) { alert("❌ Erro ao enviar report!"); setSalvandoServico(false); return; }
        alert("✅ Report enviado!");
        setReportBugs(false); setNomeVeiculoBugs(""); setDescricaoBug(""); setImagemBugs(null); setPreviewBugs(null);
        setSalvandoServico(false);
        return;
      }

      const temReboque = Boolean(reboque);
      if (!temReboque && (!cliente || !passaporte)) { alert("⚠️ Preencha o nome e o ID do cliente antes de registrar!"); return; }
      if (temReboque && !arquivoImagem) { alert("⚠️ Envie a foto da apreensão / serviço de reboque!"); return; }

      // Verificação de Blacklist
      if (passaporte && isClienteBanido(passaporte)) {
        const banInfo = blacklist.find(b => String(b.passaporte) === String(passaporte));
        alert(`🚫 OPERAÇÃO BLOQUEADA!\n\nEste cliente está na BLACKLIST.\nMotivo: ${banInfo?.motivo || "Não informado"}`);
        return;
      }

      const temGuincho = temReboque || Number(kmGuincho) > 0 || Number(qtdReparos) > 0 || Number(qtdPneus) > 0;
      const temEstetica = Number(valorDigitadoEstetica) > 0 || camaleao1 || camaleao2 || camaleaoRodas || quantidadeExtras > 0 || fumaca;
      const temAlgumaPeca = Object.values(servicosSelecionados).some((v) => v === true);
      const total = calcularTotal();
      if (cliente && passaporte) await salvarCliente(total);

      const soGuincho = temGuincho && !temEstetica && !temAlgumaPeca;
      const temItensVenda = servicosSelecionados["n1"] || servicosSelecionados["d1"] || servicosSelecionados["rd1"];
      const temPerformance = Object.keys(servicosSelecionados).some((id) => servicosSelecionados[id] && id !== "n1" && id !== "d1" && id !== "rd1");

      const roleBase = usuarioLogado?.role?.split("|")[0]?.toLowerCase()?.trim();
      if ((roleBase === "estagiario" || roleBase === "jovem_aprendiz") && temPerformance && !autorizadoPor.trim()) {
        alert("⚠️ Estagiários e Jovens Aprendizes precisam preencher quem liberou a tunagem de Performance no campo 'Autorizado Por'!");
        return;
      }

      if (!temEstetica && !temAlgumaPeca && !temGuincho) { alert("⚠️ O formulário está vazio!"); return; }
      if ((temEstetica || temPerformance) && !arquivoImagem) { alert("⚠️ É obrigatório enviar uma imagem para serviços de estética ou tunagem!"); return; }
      if ((camaleao1 || camaleao2 || camaleaoRodas || quantidadeExtras > 0 || fumaca) && Number(valorDigitadoEstetica) <= 0) { alert("⚠️ Ao selecionar Camaleão ou outros extras, informe o valor do painel in-game."); return; }

      setSalvandoServico(true);

      const rulesLocal = REGRAS_PRECOS;
      const somaExtras = quantidadeExtras * (rulesLocal.estetica?.painel_extra || 1000);
      const somaExtrasFinal = quantidadeExtras * (rulesLocal.estetica?.valor_cliente_extra || 3500);
      const valorFumacaPainel = fumaca ? (rulesLocal.estetica?.painel_fumaca || 5000) : 0;
      const valorFumacaFinal = fumaca ? (rulesLocal.estetica?.valor_cliente_fumaca || 9000) : 0;
      const valorPainel = Number(valorDigitadoEstetica) || 0;

      // Soma o valor de painel dos itens de performance selecionados
      const todasPecasDiscord = Object.values(tabelas).flat();
      const somaPainelPerformanceDiscord = Object.keys(servicosSelecionados).reduce((acc, id) => {
        if (!servicosSelecionados[id]) return acc;
        const p = todasPecasDiscord.find((x) => x.id === id);
        return acc + (p?.painel || 0);
      }, 0);

      const qtdCamaleaoDiscord = [camaleao1, camaleao2, camaleaoRodas].filter(Boolean).length;
      const descontoCamaleaoDiscord = qtdCamaleaoDiscord * (rulesLocal.estetica?.painel_camaleao || 500);
      const custoMinimoPainel = somaExtras + valorFumacaPainel + descontoCamaleaoDiscord + somaPainelPerformanceDiscord;

      if (valorPainel > 0 && valorPainel < custoMinimoPainel) {
        alert(`⚠️ Inconsistência matemática: O valor do painel in-game (R$ ${valorPainel.toLocaleString("pt-BR")}) não cobre o custo dos itens selecionados (R$ ${custoMinimoPainel.toLocaleString("pt-BR")})! Fumaça, camaleão ou performance excedem o valor pago.`);
        setSalvandoServico(false);
        return;
      }

      const valorBaseEstetica = Math.max(0, valorPainel - custoMinimoPainel);
      const valorBaseEsteticaCliente = (valorBaseEstetica / rulesLocal.estetica.painel_referencia) * rulesLocal.estetica.valor_cliente_referencia;
      const valorCamaleaoCliente = qtdCamaleaoDiscord * (rulesLocal.estetica?.valor_cliente_camaleao || 10000);
      const valorEsteticaFinal = valorBaseEsteticaCliente + valorCamaleaoCliente + somaExtrasFinal + valorFumacaFinal;

      const todasPeças = Object.values(tabelas).flat();
      const nomesServicos = Object.keys(servicosSelecionados).filter((id) => servicosSelecionados[id]).map((id) => todasPeças.find((p) => p.id === id)?.nome).join(", ");

      let webhookDestino = WEBHOOK_ESTETICA;
      if (temReboque) webhookDestino = WEBHOOK_REBOQUE || WEBHOOK_GUINCHO || WEBHOOK_ESTETICA;
      else if (soGuincho) webhookDestino = WEBHOOK_GUINCHO || WEBHOOK_ESTETICA;
      else if (temItensVenda && !temPerformance) webhookDestino = null;
      else if (temPerformance) webhookDestino = WEBHOOK_TUNAGEM || WEBHOOK_ESTETICA;

      const tituloRelatorio = temReboque
        ? "🚨 APREENSÃO DE VEÍCULO (REBOQUE)"
        : soGuincho
        ? "🚗 CONTROLE DE GUINCHO"
        : temPerformance
        ? "🛠️ RELATÓRIO DE PERFORMANCE"
        : "🎨 RELATÓRIO DE ESTÉTICA";

      const corEmbed = temReboque ? 3447003 : temPerformance ? 15105570 : 3447003;

      const camaleoesSelecionados = [
        camaleao1 ? "Primária" : null,
        camaleao2 ? "Secundária" : null,
        camaleaoRodas ? "Rodas" : null,
      ].filter(Boolean);

      const embedVendas = {
        title: "💰 REGISTRO DE VENDA", color: 5763719,
        fields: [
          { name: "👤 Cliente", value: cliente && passaporte ? `${cliente} (ID: ${passaporte})` : "Não informado", inline: true },
          { name: "👨‍🔧 Mecânico", value: nomeMecanico || usuarioLogado?.nome || "Mecânico", inline: true },
          { name: "📦 Produto", value: [servicosSelecionados["n1"] ? "Nitro" : null, servicosSelecionados["d1"] ? "Kit Drift" : null, servicosSelecionados["rd1"] ? "Removedor Kit Drift" : null].filter(Boolean).join(", ") },
          { name: "💰 Valor Total", value: `R$ ${total.toLocaleString("pt-BR")}` },
        ],
        timestamp: new Date(),
      };

      const fields = [
        { name: "👨‍🔧 Mecânico", value: nomeMecanico || usuarioLogado?.nome || "Mecânico", inline: true },
        { name: "👤 Cliente", value: cliente && passaporte ? `${cliente} (ID: ${passaporte})` : (temReboque ? "Solicitação Policial (Apreensão)" : "Não informado"), inline: true },
        { name: "✅ Autorizado por", value: autorizadoPor || (temReboque ? "Polícia Militar / Civil" : "N/A"), inline: true },
        { name: "💰 Total Final", value: temReboque ? "**R$ 0,00 (Apreensão)**" : `**R$ ${total.toLocaleString("pt-BR")}**`, inline: false },
      ];
      if (temReboque) fields.push({ name: "🚨 Tipo de Atendimento", value: "Apreensão de Veículo (Reboque)", inline: true });
      else if (!soGuincho && valorEsteticaFinal > 0) fields.push({ name: "🎨 Estética", value: `R$ ${valorEsteticaFinal.toLocaleString("pt-BR")}`, inline: true });
      if (camaleoesSelecionados.length > 0) fields.push({ name: "🦎 Camaleão", value: camaleoesSelecionados.join(", "), inline: true });
      if (fumaca) fields.push({ name: "💨 Fumaça", value: "Instalada (Personalizada)", inline: true });
      if (quantidadeExtras > 0) fields.push({ name: "🧩 Extras", value: `${quantidadeExtras}x instalado(s)`, inline: true });
      if (temPerformance) fields.push({ name: "⚙️ Peças Instaladas", value: nomesServicos || "Nenhuma", inline: false });
      if (!temReboque && temGuincho) fields.push({ name: "🚗 Guincho", value: `${kmGuincho} KM (x2)`, inline: true }, { name: "🔧 Reparos", value: `${qtdReparos}`, inline: true }, { name: "🛞 Pneus", value: `${qtdPneus}`, inline: true });

      const img1 = await otimizarImagem(arquivoImagem);
      const img2 = await otimizarImagem(arquivoImagem2);

      const imagePayload = img1
        ? { url: "attachment://print_veiculo.png" }
        : (imagemPreview && String(imagemPreview).startsWith("http") ? { url: imagemPreview } : null);

      const thumbnailPayload = img2
        ? { url: "attachment://resultado_cliente.png" }
        : (imagemPreview2 && String(imagemPreview2).startsWith("http") ? { url: imagemPreview2 } : null);

      const discordEmbed = {
        title: tituloRelatorio,
        color: corEmbed,
        fields,
        ...(imagePayload ? { image: imagePayload } : {}),
        ...(thumbnailPayload ? { thumbnail: thumbnailPayload } : {}),
        footer: { text: "RED'S TUNERSHOP - Sistema de Logs" },
        timestamp: new Date(),
      };

      const formData = new FormData();
      formData.append("payload_json", JSON.stringify({ embeds: [discordEmbed] }));
      if (img1) formData.append("files[0]", img1, "print_veiculo.png");
      if (img2) formData.append("files[1]", img2, "resultado_cliente.png");

      let response = { ok: true };
      let linkDiscord = (imagemPreview && String(imagemPreview).startsWith("http")) ? imagemPreview : "";

      if (webhookDestino) {
        const separador = webhookDestino.includes("?") ? "&" : "?";
        const urlFinal = webhookDestino.includes("wait=") ? webhookDestino : `${webhookDestino}${separador}wait=true`;
        response = await fetch(urlFinal, { method: "POST", body: formData });
        if (response.ok) {
          try {
            const data = await response.json();
            const msgId = data.id;
            const chanId = data.channel_id || (webhookDestino.includes("/webhooks/") ? webhookDestino.split("/webhooks/")[1]?.split("/")[0] : null);
            const gldId = data.guild_id || "1486119705814106307";

            const urlImagemDireta = data.embeds?.[0]?.image?.url || data.attachments?.[0]?.url || (imagemPreview && String(imagemPreview).startsWith("http") ? imagemPreview : null);

            if (msgId && chanId) {
              linkDiscord = `https://discord.com/channels/${gldId}/${chanId}/${msgId}`;
            } else if (urlImagemDireta) {
              linkDiscord = urlImagemDireta;
            }

            // Atualiza foto_url no log de tunagem caso este serviço tenha sido pré-preenchido
            if (logSelecionadoUuid && urlImagemDireta) {
              try {
                await supabase.from("logs_tunagem_reds").update({ foto_url: urlImagemDireta, cobrado: true }).eq("uuid", logSelecionadoUuid);
                await supabase.from("logs_tunagem").update({ foto_url: urlImagemDireta, cobrado: true }).eq("uuid", logSelecionadoUuid);
              } catch (errFoto) {
                console.warn("Aviso ao vincular foto_url ao log de tunagem:", errFoto);
              }
            }
          } catch (e) { console.log("Erro ao ler JSON do Discord", e); }
        } else {
          const erroTexto = await response.text().catch(() => "");
          console.error("Erro no envio para o Discord:", response.status, erroTexto);
          let msgAmigavel = `Erro ${response.status} ao enviar para o Discord.`;
          if (response.status === 413) {
            msgAmigavel = "A imagem selecionada é muito pesada (acima do limite). Tente tirar um print com resolução menor.";
          } else if (erroTexto) {
            try {
              const j = JSON.parse(erroTexto);
              if (j.error) msgAmigavel = j.error;
            } catch (_) {}
          }
          alert("❌ " + msgAmigavel);
          return;
        }
      }

      if (response.ok) {
        // Gerar detalhes do serviço
        let detalhesServico = "";
        if (temReboque) {
          detalhesServico = "Apreensão de Veículo (Reboque Policial)";
        } else if (soGuincho) {
          detalhesServico = `Guincho: ${kmGuincho}KM | Reparos: ${qtdReparos} | Pneus: ${qtdPneus}`;
        } else if (temItensVenda && !temPerformance && !temEstetica) {
          detalhesServico = "Venda de Itens";
        } else {
          const det = [];
          if (temPerformance && nomesServicos) det.push(nomesServicos);
          if (temEstetica) {
            if (valorBaseEstetica > 0) det.push("Estética Base");
            if (camaleoesSelecionados.length > 0) det.push(`Camaleão (${camaleoesSelecionados.length}x)`);
            if (quantidadeExtras > 0) det.push(`Extra (${quantidadeExtras}x)`);
            if (fumaca) det.push("Fumaça");
          }
          detalhesServico = det.length > 0 ? det.join(", ") : (temPerformance ? "Performance" : "Estética Visual");
        }

        if (soGuincho) await salvarServico("guincho", total, linkDiscord, detalhesServico);
        else if (temPerformance) await salvarServico("tunagem", total, linkDiscord, detalhesServico);
        else if (temEstetica) await salvarServico("estetica", total, linkDiscord, detalhesServico);
        else if (temItensVenda) await salvarServico("venda", total, linkDiscord, detalhesServico);

        // Registro específico para a nova tabela de Nitro
        if (servicosSelecionados["n1"]) {
          await salvarVendaNitro(passaporte, cliente, total);
        }

        buscarNotificacaoPendente();
        alert(temReboque ? "✅ Apreensão / Reboque registrado com sucesso!" : "✅ Serviço registrado com sucesso!");
        limparFormulario();
      }

      if (temItensVenda && WEBHOOK_VENDAS) {
        await fetch(WEBHOOK_VENDAS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [embedVendas] }) });
      }
    } catch (err) {
      console.error("Erro ao registrar serviço:", err);
      alert("❌ Erro ao registrar serviço: " + (err?.message || "Falha desconhecida"));
    } finally {
      setSalvandoServico(false);
    }
  };

  // ===== USE EFFECTS =====

  useEffect(() => {
    // Verificar se é uma URL de relatório compartilhado publicamente via hash
    const hash = window.location.hash;
    if (hash && hash.startsWith("#/share/comparativo-mecanicas")) {
      const match = hash.match(/[?&]id=([a-f0-9-]{36})/i);
      if (match && match[1]) {
        setRelatorioCompartilhadoId(match[1]);
        setPaginaAtual("relatorio-publico");
        return;
      }
    }

    buscarQuadroAvisos();
    const restaurarSessao = async () => {
      const salvo = localStorage.getItem("reds_session_user");
      const pag = localStorage.getItem("reds_session_page");
      if (!salvo) {
        setSessionCarregada(true);
        return;
      }
      try {
        const cache = JSON.parse(salvo);
        const atual = await buscarUsuarioNoBanco(cache.id);
        const senhaMudou = String(atual?.senha ?? atual?.id) !== String(cache?.senha ?? cache?.id);
        if (!atual || atual.status === "inativo" || senhaMudou) {
          localStorage.removeItem("reds_session_user");
          localStorage.removeItem("reds_session_page");
          setPaginaAtual("login");
          return;
        }
        aplicarLayoutDoUsuario(atual);
        setUsuarioLogado(atual);
        setNomeMecanico(atual.nome);
        setPaginaAtual(pag && pag !== "login" && !PAGINAS_OCULTAS.has(pag) ? pag : "dashboard");
      } catch (_) {
        localStorage.removeItem("reds_session_user");
        localStorage.removeItem("reds_session_page");
      } finally {
        setSessionCarregada(true);
      }
    };
    restaurarSessao();
    buscarBlacklist();
  }, []);

  useEffect(() => {
    if (!sessionCarregada) return;
    if (usuarioLogado) {
      localStorage.setItem("reds_session_user", JSON.stringify(usuarioLogado));
      localStorage.setItem("reds_session_page", paginaAtual);
    } else {
      localStorage.removeItem("reds_session_user");
      localStorage.removeItem("reds_session_page");
    }
  }, [usuarioLogado, paginaAtual, sessionCarregada]);

  useEffect(() => {
    if (!usuarioLogado?.id || !sessionCarregada) return;

    let ativo = true;
    const usuarioId = usuarioLogado.id;
    const senhaSessao = String(usuarioLogado.senha ?? usuarioLogado.id);
    const statusSessao = String(usuarioLogado.status || "ativo");

    const aplicarUsuarioAtualizado = (atual) => {
      if (!ativo) return;
      if (!atual || atual.status === "inativo" || String(atual.senha ?? atual.id) !== senhaSessao || String(atual.status || "ativo") !== statusSessao) {
        encerrarSessao("Sua senha ou seu status foi alterado. Entre novamente para continuar.");
        return;
      }

      if (String(atual.role || "") !== String(usuarioLogado.role || "") || atual.nome !== usuarioLogado.nome || atual.avatar_url !== usuarioLogado.avatar_url) {
        aplicarLayoutDoUsuario(atual);
        setUsuarioLogado(atual);
        setNomeMecanico(atual.nome);
        localStorage.setItem("reds_session_user", JSON.stringify(atual));
      }
    };

    const validarSessao = async () => {
      const { data, error } = await supabase.from("usuarios").select("*").eq("id", usuarioId).maybeSingle();
      if (!error) aplicarUsuarioAtualizado(data);
    };

    const canalSessao = supabase
      .channel(`sessao-perfil-${usuarioId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "usuarios", filter: `id=eq.${usuarioId}` }, ({ new: atual }) => aplicarUsuarioAtualizado(atual))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "usuarios", filter: `id=eq.${usuarioId}` }, () => aplicarUsuarioAtualizado(null))
      .subscribe();

    const validarVisibilidade = () => {
      if (document.visibilityState === "visible") validarSessao();
    };
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") validarSessao();
    }, 120000);
    window.addEventListener("focus", validarSessao);
    document.addEventListener("visibilitychange", validarVisibilidade);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("focus", validarSessao);
      document.removeEventListener("visibilitychange", validarVisibilidade);
      supabase.removeChannel(canalSessao);
    };
  }, [usuarioLogado?.id, usuarioLogado?.senha, usuarioLogado?.status, usuarioLogado?.role, sessionCarregada]);

  useEffect(() => {
    if (!passaporte) return;
    const timeout = setTimeout(() => { buscarCliente(passaporte); }, 1000);
    return () => clearTimeout(timeout);
  }, [passaporte]);

  useEffect(() => {
    if (paginaAtual === "clientes" && usuarioLogado) { buscarClientes(true); buscarUsuarios(); }
  }, [paginaAtual, usuarioLogado]);

  useEffect(() => {
    if (paginaAtual === "admin" && usuarioLogado) {
      buscarOnline();
      buscarRankingComPeriodo(periodoDesempenho);
      buscarEmServico();
      buscarHistoricoAdmin(true);
      buscarSolicitacoesPendentes();
      buscarRankingClientes(periodoRankingClientes);
      buscarRankingServicos(periodoRankingServicos);
      buscarRankingGuincho(periodoRankingGuincho);
      buscarListaFuncionarios();
      buscarUsuariosComRole();
    }
  }, [paginaAtual, usuarioLogado]);

  useEffect(() => {
    if (paginaAtual === "notificacoes" && usuarioLogado) {
      buscarHistoricoNotificacoes();
      buscarUsuariosComRole();
    }
  }, [paginaAtual, usuarioLogado]);

  useEffect(() => {
    if (paginaAtual === "hierarquia" && usuarioLogado) {
      buscarHierarquia();
    }
    if (paginaAtual === "blacklist" && usuarioLogado) {
      buscarBlacklist();
    }
    if (paginaAtual === "ponto-admin" && usuarioLogado) {
      buscarListaFuncionarios();
      buscarPontoCidade();
    }
    if (paginaAtual === "relatorio" && usuarioLogado) {
      buscarListaFuncionarios();
    }
    if (paginaAtual === "nitro-admin" && usuarioLogado) {
      buscarListaFuncionarios();
    }
  }, [paginaAtual, usuarioLogado]);

  useEffect(() => {
    if (paginaAtual === "financas" && usuarioLogado) {
      buscarFinancas();
      buscarPagamentosSemanais();
    }
    if (paginaAtual === "candidaturas" && usuarioLogado) {
      buscarCandidaturas();
    }
    if (paginaAtual === "evento-derby" && usuarioLogado) {
      buscarEquipesEvento();
    }
    if (paginaAtual === "evento-triathlon" && usuarioLogado) {
      buscarTriParticipantes();
    }
    if (paginaAtual === "pagamentos" && usuarioLogado) {
      buscarMeusPagamentos();
    }
  }, [paginaAtual, usuarioLogado]);

  useEffect(() => {
    if (paginaAtual === "minha-conta" && usuarioLogado) {
      setMinhaContaCarregando(true);
      Promise.all([
        buscarMeusServicos(),
        buscarMinhasNotificacoes(),
        buscarMeusTopClientes(),
        buscarHistoricoPonto({ apenasMeus: true }),
        buscarMeusPagamentos(),
      ]).finally(() => setMinhaContaCarregando(false));
    }
  }, [paginaAtual, usuarioLogado]);

  useEffect(() => { if (paginaAtual === "admin" && usuarioLogado) buscarRankingComPeriodo(periodoDesempenho); }, [periodoDesempenho]);
  useEffect(() => { if (paginaAtual === "admin" && usuarioLogado) buscarRankingClientes(periodoRankingClientes); }, [periodoRankingClientes]);
  useEffect(() => { if (paginaAtual === "admin" && usuarioLogado) buscarRankingServicos(periodoRankingServicos); }, [periodoRankingServicos]);
  useEffect(() => { if (paginaAtual === "admin" && usuarioLogado) buscarRankingGuincho(periodoRankingGuincho); }, [periodoRankingGuincho]);

  useEffect(() => {
    if (paginaAtual === "ponto" && usuarioLogado) { buscarSolicitacoesPendentes(); }
  }, [paginaAtual, usuarioLogado]);

  // Verificar notificações pendentes ao trocar de página
  useEffect(() => {
    if (usuarioLogado && paginaAtual !== "login") {
      buscarNotificacaoPendente();
    }
  }, [paginaAtual]);

  useEffect(() => {
    if (usuarioLogado) {
      buscarTotalHoras(); buscarHistoricoPonto(); verificarPontoAtivo(); buscarRanking(); buscarEmServico(); buscarNotificacaoPendente();
    }
  }, [usuarioLogado]);

  useEffect(() => {
    if (!usuarioLogado) return;

    verificarPontoAtivo();
    const intervalPonto = setInterval(() => {
      if (document.visibilityState === "visible") {
        verificarPontoAtivo();
      }
    }, 120000);

    const handleVisibilidadePonto = () => {
      if (document.visibilityState === "visible") {
        verificarPontoAtivo();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilidadePonto);

    const canalPontoRealtime = supabase
      .channel("global-ponto-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "discord_log_messages" }, (payload) => {
        const novo = payload.new;
        if (novo && novo.log_type === "ponto") {
          verificarPontoAtivo();
        }
      })
      .subscribe();

    return () => {
      clearInterval(intervalPonto);
      document.removeEventListener("visibilitychange", handleVisibilidadePonto);
      supabase.removeChannel(canalPontoRealtime);
    };
  }, [usuarioLogado]);

  // Usuários Online em tempo real via Presence (100% em memória, zero gravação/leitura de disco)
  useEffect(() => {
    if (!usuarioLogado?.id) return;

    const canalPresence = supabase.channel("online-users", {
      config: {
        presence: {
          key: String(usuarioLogado.id),
        },
      },
    });

    const atualizarListaOnline = () => {
      const state = canalPresence.presenceState();
      const onlineMap = new Map();
      for (const key in state) {
        const presences = state[key];
        if (Array.isArray(presences) && presences.length > 0) {
          const user = presences[0];
          if (user && user.usuario_id) {
            onlineMap.set(String(user.usuario_id), user);
          }
        }
      }
      setUsuariosOnline(Array.from(onlineMap.values()));
    };

    canalPresence
      .on("presence", { event: "sync" }, atualizarListaOnline)
      .on("presence", { event: "join" }, atualizarListaOnline)
      .on("presence", { event: "leave" }, atualizarListaOnline)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await canalPresence.track({
            usuario_id: usuarioLogado.id,
            nome: usuarioLogado.nome,
            role: usuarioLogado.role || "",
          });
        }
      });

    return () => {
      try {
        canalPresence.untrack();
      } catch (_) {}
      supabase.removeChannel(canalPresence);
    };
  }, [usuarioLogado?.id, usuarioLogado?.nome, usuarioLogado?.role]);

  // Listener Realtime + Polling Contínuo de Notificações (Garante recebimento instantâneo em qualquer janela ou aba)
  useEffect(() => {
    if (!usuarioLogado?.id) return;
    const uidStr = String(usuarioLogado.id).trim();

    // 1. Busca imediata
    buscarNotificacaoPendente();

    // 2. Canal Realtime individual para o usuário
    const canalNome = `canal-notif-usuario-${uidStr}-${Date.now()}`;
    const canal = supabase
      .channel(canalNome)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes" },
        (payload) => {
          const nova = payload.new;
          if (!nova) return;
          if (String(nova.funcionario_id).trim() === uidStr && !nova.lido_em) {
            setNotificacaoPendente(nova);
            try {
              const AudioCtx = window.AudioContext || window.webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
                gain.gain.setValueAtTime(0.25, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
                osc.start();
                osc.stop(ctx.currentTime + 0.35);
              }
            } catch (_) {}
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          buscarNotificacaoPendente();
        }
      });

    // 3. Polling de contingência a cada 60s se a aba estiver ativa (Realtime já entrega instantâneo)
    const intervalNotif = setInterval(() => {
      if (document.visibilityState === "visible") {
        buscarNotificacaoPendente();
      }
    }, 60000);

    // 4. Checar instantaneamente ao focar na janela ou mudar de aba
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        buscarNotificacaoPendente();
      }
    };
    const handleFocus = () => {
      buscarNotificacaoPendente();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      supabase.removeChannel(canal);
      clearInterval(intervalNotif);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [usuarioLogado?.id]);

  // Listener Realtime Global de Tunagens (Funciona em QUALQUER página do site!)
  useEffect(() => {
    if (!usuarioLogado) return;

    const canalTunagemDirect = supabase
      .channel("global-tunagem-direct")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs_tunagem" }, (payload) => {
        const novoLog = payload.new;
        if (!novoLog) return;

        // FILTRO ESTRITO: Apenas tunagens da RED'S TUNERSHOP
        const ofcLower = (novoLog.oficina_nome || "").toLowerCase();
        const isReds = ofcLower.includes("red") || 
                       (novoLog.discord_channel_id === "1544859496701108325") ||
                       (novoLog.mechanic_id === "reds" && !ofcLower);

        if (!isReds) return; // Ignora qualquer outra mecânica (SaltLab, Beach, Vespucci, etc.)!

        const isMeu = usuarioLogado?.id && (String(novoLog.tecnico_id) === String(usuarioLogado.id) || String(novoLog.mechanic_id) === String(usuarioLogado.id));
        const isAdmin = usuarioLogado?.role === "admin" || usuarioLogado?.role === "dono" || usuarioLogado?.role === "gerente";
        const deveNotificar = isMeu || (isAdmin && notificarTodasTunagens);

        if (deveNotificar) {
          const analise = analisarServicoTunagem(novoLog.antes_json, novoLog.depois_json, novoLog.valor_pago || 0);
          setTunagemRealtimeGlobal({ log: novoLog, analise, isMeu, isAdmin });
          adicionarNotificacaoServico(novoLog, analise, isMeu);

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

    const canalDiscordServicos = supabase
      .channel("global-discord-servicos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "discord_log_messages" }, async (payload) => {
        const msg = payload.new;
        if (!msg || !msg.content) return;

        if (msg.content.includes("[TUNAGEM DE VEÍCULO]") || msg.log_type === "servicos" || msg.log_type === "tunagem") {
          // Ignora tunagens de teste, sem dono ou simuladas
          if (msg.content.includes("NÃO SALVO") || msg.content.includes("TUNAGEM SEM DONO") || msg.content.includes("Simulador")) {
            return;
          }

          const logsParsed = parseLogsTunagemTexto(msg.content);
          if (logsParsed && logsParsed.length > 0) {
            const novoLog = logsParsed[0];
            if (novoLog.tecnico_id === "0" || (novoLog.tecnico_nome && novoLog.tecnico_nome.toLowerCase().includes("simulador"))) {
              return;
            }
            novoLog.discord_message_id = msg.discord_id || msg.id;
            novoLog.discord_channel_id = msg.channel_id;

            // Determina a oficina real
            const oficina = (novoLog.oficina_nome || "").toLowerCase();
            const msgContent = (msg.content || "").toLowerCase();
            const isBeachOuVespucci = oficina.includes("beach") || oficina.includes("vespucci") || msgContent.includes("beach") || msgContent.includes("vespucci");
            const isHarmony = oficina.includes("harmony") || msgContent.includes("harmony");
            const isDudarkOuSalt = oficina.includes("dudark") || oficina.includes("salt") || oficina.includes("lab") || msgContent.includes("dudark") || msgContent.includes("salt") || msgContent.includes("lab");

            let targetMechanic = "outras";
            if (isBeachOuVespucci) {
              targetMechanic = "vespucci";
            } else if (isHarmony) {
              targetMechanic = "harmony";
            } else if (isDudarkOuSalt) {
              targetMechanic = "dudark";
            } else if (oficina.includes("red") || msgContent.includes("red's") || msgContent.includes("reds")) {
              targetMechanic = "reds";
            } else if (msg.mechanic_id && msg.mechanic_id.toLowerCase().includes("red") && !isBeachOuVespucci && !isHarmony && !isDudarkOuSalt) {
              targetMechanic = "reds";
            } else if (novoLog.discord_channel_id === "1544859496701108325" && !isBeachOuVespucci && !isHarmony && !isDudarkOuSalt) {
              targetMechanic = "reds";
            } else if (msg.mechanic_id) {
              targetMechanic = msg.mechanic_id;
            } else if (oficina) {
              targetMechanic = oficina.replace(/\s+/g, '_');
            }
            novoLog.mechanic_id = targetMechanic;

            // Salva na tabela geral (a tabela central compartilhada)
            await supabase.from("logs_tunagem").upsert([novoLog], { onConflict: "uuid" });

            // Apenas e estritamente eventos confirmados da RED'S vão para logs_tunagem_reds e geram alertas
            const isRealmenteReds = targetMechanic === "reds" && !isBeachOuVespucci && !isHarmony && !isDudarkOuSalt && (oficina.includes("red") || msgContent.includes("red's") || msgContent.includes("reds") || novoLog.discord_channel_id === "1544859496701108325");
            if (isRealmenteReds) {
              try {
                await supabase.from("logs_tunagem_reds").upsert([novoLog], { onConflict: "uuid" });
              } catch (e) {}

              const isMeu = usuarioLogado?.id && (String(novoLog.tecnico_id) === String(usuarioLogado.id) || String(novoLog.mechanic_id) === String(usuarioLogado.id));
              const isAdmin = usuarioLogado?.role === "admin" || usuarioLogado?.role === "dono" || usuarioLogado?.role === "gerente";
              const deveNotificar = isMeu || (isAdmin && notificarTodasTunagens);

              if (deveNotificar) {
                const analise = analisarServicoTunagem(novoLog.antes_json, novoLog.depois_json, novoLog.valor_pago || 0);
                setTunagemRealtimeGlobal({ log: novoLog, analise, isMeu, isAdmin });
                adicionarNotificacaoServico(novoLog, analise, isMeu);

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
            }
          }
        }

        // Logs de baú e bancada permanecem disponíveis nos módulos próprios,
        // sem popup, som ou notificação global como os serviços.
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalTunagemDirect);
      supabase.removeChannel(canalDiscordServicos);
    };
  }, [usuarioLogado, notificarTodasTunagens]);

  const [vagasAtivas, setVagasAtivas] = useState({});

  const buscarConfigVagas = async () => {
    const { data, error } = await supabase.from("config_vagas").select("*");
    if (!error && data) {
      const config = {};
      data.forEach(v => config[v.area_id] = v.ativa);
      setVagasAtivas(config);
    }
  };

  const toggleVaga = async (areaId) => {
    const novoStatus = !vagasAtivas[areaId];
    const { error } = await supabase
      .from("config_vagas")
      .upsert({ area_id: areaId, ativa: novoStatus });
    
    if (!error) {
      setVagasAtivas(prev => ({ ...prev, [areaId]: novoStatus }));
    }
  };

  useEffect(() => {
    if (usuarioLogado) {
      verificarPontoAtivo();
      buscarConfigVagas();
    }
  }, [usuarioLogado, paginaAtual]);

  useEffect(() => {
    if (paginaAtual === "dashboard" && passaporte && servicosSelecionados["n1"]) {
      verificarNitroCliente(passaporte);
    } else {
      setHistoricoNitroRecente([]);
    }
  }, [paginaAtual, passaporte, servicosSelecionados["n1"]]);

  // ===== HANDLERS DE ARQUIVO =====

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) { const f = e.target.files[0]; setArquivoImagem(f); setImagemPreview(URL.createObjectURL(f)); }
  };

  const handleFileChange2 = (e) => {
    if (e.target.files?.[0]) { const f = e.target.files[0]; setArquivoImagem2(f); setImagemPreview2(URL.createObjectURL(f)); }
  };

  const handleFileBugs = (e) => {
    const file = e.target.files[0];
    if (file) { setImagemBugs(file); const reader = new FileReader(); reader.onloadend = () => setPreviewBugs(reader.result); reader.readAsDataURL(file); }
  };

  const handlePasteBugs = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) { e.preventDefault(); const file = items[i].getAsFile(); if (file) handleFileBugs({ target: { files: [file] } }); return; }
    }
  };

  const handlePasteEstetica = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) { e.preventDefault(); const file = items[i].getAsFile(); if (file) handleFileChange({ target: { files: [file] } }); return; }
    }
  };

  const handlePasteEstetica2 = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) { e.preventDefault(); const file = items[i].getAsFile(); if (file) handleFileChange2({ target: { files: [file] } }); return; }
    }
  };




  // ===============================
  // ABA: EVENTO - RED'S DEMOLITION DERBY
  // PRONTO PARA COLAR NO SEU ARQUIVO
  // ===============================

  // 🔥 ADICIONE NOS STATES (junto com os outros)
  const [equipesEvento, setEquipesEvento] = useState([]);
  const [membrosEquipe, setMembrosEquipe] = useState([]);
  const [nomeEquipe, setNomeEquipe] = useState("");
  const [corEquipe, setCorEquipe] = useState("");
  const [grupoEquipe, setGrupoEquipe] = useState(null);
  const [passaporteMembro, setPassaporteMembro] = useState("");
  const [nomeMembro, setNomeMembro] = useState("");
  const [ehLider, setEhLider] = useState(false);
  const [grupoCriacao, setGrupoCriacao] = useState(1);

  // ===============================
  // ABA: EVENTO - TRIATHLON
  // ===============================
  const [triParticipantes, setTriParticipantes] = useState([]);
  const [triPassaporte, setTriPassaporte] = useState("");
  const [triNome, setTriNome] = useState("");
  const [triRodadaCriacao, setTriRodadaCriacao] = useState(1);
  const ultimoTriPassaporteBuscado = useRef(null);

  const CORES_EVENTO = [
    "amarelo", "verde", "laranja", "azul", "rosa", "vermelho", "roxo", "cinza", "areia", "branco", "preto"
  ];

  const MAPA_CORES_HEX = {
    amarelo: "#fbbf24", verde: "#22c55e", laranja: "#f97316", azul: "#3b82f6",
    rosa: "#ec4899", vermelho: "#b40d0d", roxo: "#a855f7", cinza: "#94a3b8",
    areia: "#d6d3d1", branco: "#ffffff", preto: "#525252"
  };

  const getCoresDisponiveis = () => {
    if (!equipesEvento || equipesEvento.length === 0) return CORES_EVENTO;
    const usadas = equipesEvento.filter(e => e.grupo === grupoCriacao).map(e => e.cor);
    return CORES_EVENTO.filter(c => !usadas.includes(c));
  };

  const coresDisponiveis = getCoresDisponiveis();

  useEffect(() => {
    if (equipesEvento.length > 0) {
      const isAtualFechado = equipesEvento.some(e => e.grupo === grupoCriacao && e.grupo_fechado);
      if (isAtualFechado) {
        const gruposFechados = new Set(equipesEvento.filter(e => e.grupo_fechado).map(e => e.grupo));
        let proximoAberto = 1;
        while (gruposFechados.has(proximoAberto)) {
          proximoAberto++;
        }
        setGrupoCriacao(proximoAberto);
      }
    }
  }, [equipesEvento, grupoCriacao]);

  // ===============================
  // 🔎 BUSCAR EQUIPES
  // ===============================
  const buscarEquipesEvento = async () => {
    const { data } = await supabase
      .from("evento_equipes")
      .select("*, evento_membros(*)");
    if (data) setEquipesEvento(data);
  };

  // ===============================
  // DEFINIR GRUPO - FUNÇÃO REMOVIDA
  // (Agora o usuário define na interface)
  // ===============================

  // ===============================
  // 👤 BUSCAR / CRIAR CLIENTE
  // ===============================
  const buscarOuCriarClienteEvento = async (id) => {
    if (ultimoPassaporteBuscado.current === id) return;

    ultimoPassaporteBuscado.current = id;

    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", Number(id))
      .maybeSingle();

    if (data) {
      setNomeMembro(data.nome);
    } else {
      setNomeMembro("");
    }

    // ❌ NUNCA faça isso:
    // setPassaporteMembro(...)
  };

  // ===============================
  // ➕ ADICIONAR MEMBRO
  // ===============================
  const adicionarMembroEquipe = async () => {
    if (!passaporteMembro) return alert("Informe o passaporte");

    const { data } = await supabase
      .from("evento_membros")
      .select("*")
      .eq("passaporte", Number(passaporteMembro));

    if (data.length > 0) return alert("Esse ID já está em outra equipe!");

    if (membrosEquipe.some(m => m.passaporte === Number(passaporteMembro))) {
      return alert("Esse membro já foi adicionado nesta equipe!");
    }

    if (membrosEquipe.length >= 4) return alert("Máximo de 4 membros");

    if (ehLider && membrosEquipe.some(m => m.eh_lider)) {
      return alert("Já existe um líder!");
    }

    await supabase.from("clientes").upsert({ id: Number(passaporteMembro), nome: nomeMembro });

    setMembrosEquipe(prev => ([
      ...prev,
      {
        passaporte: Number(passaporteMembro),
        nome: nomeMembro,
        eh_lider: ehLider
      }
    ]));

    setPassaporteMembro("");
    setNomeMembro("");
    setEhLider(false);
  };

  // ===============================
  // ❌ REMOVER MEMBRO
  // ===============================
  const removerMembro = (index) => {
    if (membrosEquipe.length <= 2) {
      return alert("Equipe precisa de no mínimo 2 membros");
    }
    setMembrosEquipe(prev => prev.filter((_, i) => i !== index));
  };

  // ===============================
  // 💾 SALVAR EQUIPE
  // ===============================
  const salvarEquipeEvento = async () => {
    if (membrosEquipe.length < 2) return alert("Mínimo 2 membros");

    const isGrupoAtualFechado = equipesEvento.some(e => e.grupo === grupoCriacao && e.grupo_fechado);
    if (isGrupoAtualFechado) return alert(`O Grupo ${grupoCriacao} já está fechado!`);

    const lider = membrosEquipe.filter(m => m.eh_lider);
    if (lider.length !== 1) return alert("Precisa ter 1 líder");

    if (!corEquipe) return alert("Selecione uma cor");

    let grupo = grupoCriacao;
    setGrupoEquipe(grupo);

    const { data: equipe, error } = await supabase
      .from("evento_equipes")
      .insert({
        nome_equipe: nomeEquipe,
        cor: corEquipe,
        grupo,
        lider_id: lider[0].passaporte
      })
      .select()
      .single();

    if (error) return alert("Erro ao criar equipe");

    const membrosInsert = membrosEquipe.map(m => ({
      equipe_id: equipe.id,
      passaporte: m.passaporte,
      nome: m.nome,
      eh_lider: m.eh_lider
    }));

    await supabase.from("evento_membros").insert(membrosInsert);

    alert("Equipe criada com sucesso!");

    setNomeEquipe("");
    setCorEquipe("");
    setMembrosEquipe([]);

    buscarEquipesEvento();
  };

  // ===============================
  // 🖥️ UI DA ABA
  // ===============================

  const ultimoPassaporteBuscado = useRef(null);

  const renderEventoDerby = () => {
    const isGrupoAtualFechado = equipesEvento.some(e => e.grupo === grupoCriacao && e.grupo_fechado);

    const fecharGrupoAtual = async () => {
      const confirmar = window.confirm(`Deseja fechar o Grupo ${grupoCriacao} permanentemente? Não será mais possível adicionar equipes neste grupo.`);
      if (!confirmar) return;

      const { error } = await supabase
        .from("evento_equipes")
        .update({ grupo_fechado: true })
        .eq("grupo", grupoCriacao);

      if (error) {
        alert("❌ Erro ao fechar grupo! " + error.message);
        return;
      }

      alert(`🔐 Grupo ${grupoCriacao} fechado com sucesso!`);
      buscarEquipesEvento();
    };

    const abrirGrupoDb = async (grupoVigente) => {
      const confirmar = window.confirm(`Deseja reabrir o Grupo ${grupoVigente}? Se reaberto, você poderá criar ou excluir times dele novamente.`);
      if (!confirmar) return;

      const { error } = await supabase
        .from("evento_equipes")
        .update({ grupo_fechado: false })
        .eq("grupo", grupoVigente);

      if (error) {
        alert("❌ Erro ao reabrir grupo! " + error.message);
        return;
      }

      alert(`🔓 Grupo ${grupoVigente} reaberto com sucesso!`);
      buscarEquipesEvento();
    };

    const grupos = {};

    equipesEvento.forEach(eq => {
      if (!grupos[eq.grupo]) grupos[eq.grupo] = [];
      grupos[eq.grupo].push(eq);
    });

    return (
      <div style={styles.dashContainer}>
        <ModalNotificacao /><AppHeaderBar />
        <div style={{ padding: "30px 40px" }}>
          <div style={styles.whiteCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
              <button style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }} onClick={() => setPaginaAtual("dashboard")}>⬅ Voltar</button>
              <h3 style={{ margin: 0, fontSize: "18px" }}>🏁 RED's Demolition Derby</h3>
            </div>

            {/* ========================= */}
            {/* 🧾 FORMULÁRIO */}
            {/* ========================= */}

            <div style={{ background: theme.card2, padding: "24px", borderRadius: "12px", border: `1px solid ${theme.border}`, marginBottom: "40px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
                <h4 style={{ margin: "0", color: theme.text, fontSize: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ color: theme.accent }}>1.</span> Informações da Equipe
                </h4>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  {isGrupoAtualFechado ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#b40d0d", background: "#b40d0d22", padding: "6px 12px", borderRadius: "8px" }}>🔒 GRUPO FECHADO</span>
                      <button onClick={() => abrirGrupoDb(grupoCriacao)} style={{ background: "transparent", color: "#22c55e", border: "1px solid #22c55e", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>🔓 Reabrir</button>
                    </div>
                  ) : (
                    <button onClick={fecharGrupoAtual} style={{ background: "transparent", color: "#b40d0d", border: "1px solid #b40d0d", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>🔒 Fechar Grupo</button>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: theme.card, padding: "6px 12px", borderRadius: "8px", border: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: theme.text }}>Destino:</span>
                    <button onClick={() => setGrupoCriacao(Math.max(1, grupoCriacao - 1))} style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: "6px", width: "24px", height: "24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>-</button>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: theme.accent, width: "65px", textAlign: "center" }}>Grupo {grupoCriacao}</span>
                    <button onClick={() => setGrupoCriacao(grupoCriacao + 1)} style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: "6px", width: "24px", height: "24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>+</button>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "30px" }}>
                <input
                  style={{ flex: 1, minWidth: "200px", padding: "12px 16px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, outline: "none", fontSize: "14px" }}
                  placeholder="Nome da equipe..."
                  value={nomeEquipe}
                  onChange={(e) => setNomeEquipe(e.target.value)}
                />

                <select
                  style={{ flex: 1, minWidth: "200px", padding: "12px 16px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, outline: "none", cursor: "pointer", fontSize: "14px" }}
                  value={corEquipe}
                  onChange={(e) => setCorEquipe(e.target.value)}
                >
                  <option value="">🎨 Selecione a cor</option>
                  {coresDisponiveis.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <h4 style={{ margin: "0 0 16px 0", color: theme.text, fontSize: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ color: theme.accent }}>2.</span> Montar Elenco (Mín: 2 / Máx: 4)
              </h4>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", background: isDarkMode ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.5)", padding: "16px", borderRadius: "10px", border: `1px dashed ${theme.border}` }}>
                <input
                  style={{ width: "130px", padding: "10px 14px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, outline: "none", fontSize: "14px", textAlign: "center" }}
                  placeholder="Passaporte"
                  value={passaporteMembro}
                  onChange={(e) => {
                    const valor = e.target.value.replace(/\D/g, "");
                    if (valor === passaporteMembro) return;
                    setPassaporteMembro(valor);
                    if (valor.length < 2) { setNomeMembro(""); return; }
                    clearTimeout(window._buscaClienteDelay);
                    window._buscaClienteDelay = setTimeout(() => { buscarOuCriarClienteEvento(valor); }, 600);
                  }}
                />

                <input
                  style={{ flex: 1, minWidth: "150px", padding: "10px 14px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.card, color: theme.text, outline: "none", fontSize: "14px" }}
                  placeholder="Nome do Cliente (Editável)"
                  value={nomeMembro}
                  onChange={(e) => setNomeMembro(e.target.value)}
                />

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: theme.text, background: ehLider ? "#fbbf2422" : "transparent", padding: "10px 14px", borderRadius: "6px", border: `1px solid ${ehLider ? "#fbbf24" : "transparent"}`, fontSize: "14px", transition: "all 0.2s" }}>
                  <input
                    type="checkbox"
                    checked={ehLider}
                    onChange={(e) => setEhLider(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  /> ⭐ Líder
                </label>

                <button
                  onClick={adicionarMembroEquipe}
                  style={{ background: theme.accent, color: "#fff", border: "none", padding: "10px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", whiteSpace: "nowrap", fontSize: "14px", transition: "filter 0.2s" }}
                  onMouseEnter={(e) => e.target.style.filter = "brightness(1.1)"}
                  onMouseLeave={(e) => e.target.style.filter = "brightness(1)"}
                >
                  ➕ Adicionar
                </button>
              </div>

              {membrosEquipe.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {membrosEquipe.map((m, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", background: theme.bg, border: `1px solid ${theme.border}`, padding: "8px 14px", borderRadius: "20px", fontSize: "14px", color: theme.text, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                        <span><strong>{m.passaporte}</strong> - {m.nome}</span>
                        {m.eh_lider && <span title="Líder" style={{ marginLeft: "4px" }}>⭐</span>}
                        <button onClick={() => removerMembro(i)} style={{ background: "none", border: "none", color: "#b40d0d", cursor: "pointer", padding: "0 4px", fontSize: "14px", display: "flex", alignItems: "center" }} title="Remover">✖</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: "30px", borderTop: `1px solid ${theme.border}`, paddingTop: "24px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={salvarEquipeEvento}
                  style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff", border: "none", padding: "12px 28px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "15px", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 14px rgba(34, 197, 94, 0.3)", transition: "transform 0.2s, box-shadow 0.2s" }}
                  onMouseEnter={(e) => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 6px 20px rgba(34, 197, 94, 0.4)"; }}
                  onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 4px 14px rgba(34, 197, 94, 0.3)"; }}
                >
                  💾 Confirmar Criação da Equipe
                </button>
              </div>
            </div>

            {/* ========================= */}
            {/* 📊 LISTA DE EQUIPES */}
            {/* ========================= */}

            <h3 style={{ borderBottom: `1px solid ${theme.border}`, paddingBottom: "10px", marginTop: "40px" }}>Equipes criadas</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "30px", marginTop: "20px" }}>
              {Object.keys(grupos).sort((a, b) => a - b).map(grupo => {
                const isThisGroupFechado = grupos[grupo].some(eq => eq.grupo_fechado);
                return (
                  <div key={grupo} style={{ background: theme.card2, padding: "24px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                      <h3 style={{ margin: "0", display: "flex", alignItems: "center", gap: "10px", color: theme.text }}>
                        <span style={{ fontSize: "24px" }}>🏁</span> Grupo {grupo}
                      </h3>
                      {isThisGroupFechado && (
                        <button onClick={() => abrirGrupoDb(grupo)} style={{ background: "transparent", color: "#22c55e", border: "1px solid #22c55e", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                          🔓 Reabrir Grupo
                        </button>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                      {grupos[grupo].map(eq => {
                        const isCampeao = eq.posicao === "campeao";
                        const isVice = eq.posicao === "vice";
                        const borderColor = isCampeao ? "#fbbf24" : isVice ? "#94a3b8" : theme.border;
                        const corHex = MAPA_CORES_HEX[eq.cor?.toLowerCase()] || theme.border;

                        return (
                          <div key={eq.id} style={{ borderLeft: `2px solid ${borderColor}`, borderRight: `2px solid ${borderColor}`, borderBottom: `2px solid ${borderColor}`, borderTop: `6px solid ${corHex}`, borderRadius: "12px", padding: "20px", background: theme.card, position: "relative", boxShadow: isCampeao ? "0 0 20px rgba(251, 191, 36, 0.15)" : isVice ? "0 0 20px rgba(148, 163, 184, 0.1)" : "none", transition: "transform 0.2s" }}>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                              <div>
                                <strong style={{ fontSize: "18px", display: "block", color: theme.text }}>{eq.nome_equipe}</strong>
                                <span style={{ display: "inline-block", color: theme.text, padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600", marginTop: "8px", textTransform: "capitalize", border: `2px solid ${corHex}`, background: isDarkMode ? `${corHex}15` : `${corHex}20` }}>
                                  {eq.cor}
                                </span>
                              </div>
                              {(isCampeao || isVice) && (
                                <span style={{ fontSize: "32px", animation: isCampeao ? "bounce 2s infinite" : "none" }} title={isCampeao ? "Campeã" : "Vice-Campeã"}>
                                  {isCampeao ? "🏆" : "🥈"}
                                </span>
                              )}
                            </div>

                            <div style={{ background: theme.bg, borderRadius: "8px", padding: "12px", marginBottom: "20px" }}>
                              <div style={{ fontSize: "11px", letterSpacing: "1px", color: theme.subtext, marginBottom: "10px", fontWeight: "700" }}>ELENCO ({eq.evento_membros?.length || 0})</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {eq.evento_membros?.map(m => (
                                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", color: theme.text }}>
                                    <span><strong>{m.passaporte}</strong> - {m.eh_lider && "⭐ "} {m.nome}</span>
                                    <button
                                      onClick={() => removerMembroDB(m.id, eq.id)}
                                      style={{ background: "none", border: "none", color: theme.subtext, cursor: eq.grupo_fechado ? "not-allowed" : "pointer", padding: "4px", fontSize: "12px", opacity: eq.grupo_fechado ? 0.3 : 1 }}
                                      disabled={eq.grupo_fechado}
                                      title={eq.grupo_fechado ? "Bloqueado pelo Grupo" : "Remover"}
                                    >✖</button>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", flexWrap: "wrap" }}>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button onClick={() => definirPosicaoEquipe(eq.id, "campeao")} style={{ background: isCampeao ? "#fbbf24" : "transparent", border: `1px solid #fbbf24`, color: isCampeao ? "#000" : theme.text, padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", transition: "all 0.2s" }}>
                                  🏆
                                </button>
                                <button onClick={() => definirPosicaoEquipe(eq.id, "vice")} style={{ background: isVice ? "#94a3b8" : "transparent", border: `1px solid #94a3b8`, color: isVice ? "#000" : theme.text, padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", transition: "all 0.2s" }}>
                                  🥈
                                </button>
                              </div>
                              <button
                                onClick={() => deletarEquipe(eq.id)}
                                style={{ background: "transparent", color: eq.grupo_fechado ? "#94a3b8" : "#b40d0d", padding: "8px 14px", border: `1px solid ${eq.grupo_fechado ? '#94a3b8' : '#b40d0d'}`, borderRadius: "8px", cursor: eq.grupo_fechado ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "600", opacity: eq.grupo_fechado ? 0.5 : 1 }}
                                disabled={eq.grupo_fechado}
                              >
                                Excluir
                              </button>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const deletarEquipe = async (id) => {
    const equipe = equipesEvento.find(e => e.id === id);
    if (equipe && equipe.grupo_fechado) {
      return alert("🚫 Ação bloqueada: Não é possível excluir equipes de um grupo fechado.");
    }

    const confirmar = window.confirm("Deseja apagar essa equipe?");
    if (!confirmar) return;

    await supabase.from("evento_equipes").delete().eq("id", id);

    buscarEquipesEvento();
  };

  const removerMembroDB = async (membroId, equipeId) => {
    const equipe = equipesEvento.find(e => e.id === equipeId);
    if (equipe && equipe.grupo_fechado) {
      return alert("🚫 Ação bloqueada: Não é possível remover membros de uma equipe em um grupo fechado.");
    }

    const { data } = await supabase
      .from("evento_membros")
      .select("*")
      .eq("equipe_id", equipeId);

    if (data.length <= 2) {
      return alert("Equipe não pode ter menos de 2 membros");
    }

    await supabase.from("evento_membros").delete().eq("id", membroId);

    buscarEquipesEvento();
  };

  const definirPosicaoEquipe = async (equipeId, posicaoDesejada) => {
    const equipe = equipesEvento.find(e => e.id === equipeId);
    if (!equipe) return;

    if (posicaoDesejada !== null && equipe.posicao !== posicaoDesejada) {
      const jaExiste = equipesEvento.find(e => e.grupo === equipe.grupo && e.posicao === posicaoDesejada);
      if (jaExiste) {
        return alert(`O Grupo ${equipe.grupo} já possui um ${posicaoDesejada === 'campeao' ? 'Campeão' : 'Vice-Campeão'}! Remova-o primeiro da equipe "${jaExiste.nome_equipe}".`);
      }
    }

    if (equipe.posicao === posicaoDesejada) {
      const confirmar = window.confirm(`Deseja remover o título de ${posicaoDesejada === 'campeao' ? 'Campeão' : 'Vice'} desta equipe?`);
      if (!confirmar) return;
    }

    const novaPosicao = equipe.posicao === posicaoDesejada ? null : posicaoDesejada;

    const { error } = await supabase
      .from("evento_equipes")
      .update({ posicao: novaPosicao })
      .eq("id", equipeId);

    if (error) {
      alert("❌ Erro ao atualizar posição: " + error.message);
      return;
    }

    buscarEquipesEvento();
  };


  // ===============================
  // 🏊 TRIATHLON - FUNÇÕES
  // ===============================

  const buscarTriParticipantes = async () => {
    const { data } = await supabase
      .from("triathlon_participantes")
      .select("*")
      .order("rodada", { ascending: true })
      .order("posicao", { ascending: true, nullsFirst: false });
    if (data) setTriParticipantes(data);
  };

  const buscarClienteTriathlon = async (id) => {
    if (ultimoTriPassaporteBuscado.current === id) return;
    ultimoTriPassaporteBuscado.current = id;
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", Number(id))
      .maybeSingle();
    if (data) {
      setTriNome(data.nome);
    } else {
      setTriNome("");
    }
  };

  const adicionarTriParticipante = async () => {
    if (!triPassaporte) return alert("Informe o passaporte");
    if (!triNome) return alert("Informe o nome do participante");

    // Verificar na memória (cache local)
    const jaInscritoLocal = triParticipantes.find(p => {
      if (triRodadaCriacao <= 3) return p.passaporte === Number(triPassaporte) && p.rodada <= 3;
      return p.passaporte === Number(triPassaporte) && p.rodada === 4;
    });
    
    if (jaInscritoLocal) {
      return alert(`Este participante já está inscrito na Rodada ${jaInscritoLocal.rodada}!`);
    }

    // Verificar direto no banco para evitar race conditions (duplo clique)
    const { data: jaInscritoDB } = await supabase
      .from("triathlon_participantes")
      .select("rodada")
      .eq("passaporte", Number(triPassaporte))
      .in("rodada", triRodadaCriacao <= 3 ? [1, 2, 3] : [4])
      .maybeSingle();
      
    if (jaInscritoDB) {
      return alert(`Este participante já está inscrito na Rodada ${jaInscritoDB.rodada}!`);
    }

    // Verificar limite por rodada (10 para rodadas 1-3)
    if (triRodadaCriacao <= 3) {
      const naRodada = triParticipantes.filter(p => p.rodada === triRodadaCriacao);
      if (naRodada.length >= 10) return alert(`Rodada ${triRodadaCriacao} já possui 10 participantes (máximo)!`);
    }

    // Verificar se rodada está fechada
    const rodadaFechada = triParticipantes.some(p => p.rodada === triRodadaCriacao && p.rodada_fechada);
    if (rodadaFechada) return alert(`Rodada ${triRodadaCriacao} está fechada!`);

    // Upsert no clientes
    await supabase.from("clientes").upsert({ id: Number(triPassaporte), nome: triNome });

    const { error } = await supabase
      .from("triathlon_participantes")
      .insert({
        passaporte: Number(triPassaporte),
        nome: triNome,
        rodada: triRodadaCriacao
      });

    if (error) return alert("Erro ao inscrever: " + error.message);

    alert("✅ Participante inscrito com sucesso!");
    setTriPassaporte("");
    setTriNome("");
    ultimoTriPassaporteBuscado.current = null;
    buscarTriParticipantes();
  };

  const removerTriParticipante = async (id) => {
    const part = triParticipantes.find(p => p.id === id);
    if (part && part.rodada_fechada) return alert("Não é possível remover participantes de uma rodada fechada.");
    if (!window.confirm("Deseja remover este participante?")) return;
    await supabase.from("triathlon_participantes").delete().eq("id", id);
    buscarTriParticipantes();
  };

  const definirPosicaoTri = async (id, posicao) => {
    const part = triParticipantes.find(p => p.id === id);
    if (!part) return;

    // Toggle: se já tem essa posição, remover
    if (part.posicao === posicao) {
      if (!window.confirm(`Remover a posição ${posicao}° deste participante?`)) return;
      await supabase.from("triathlon_participantes").update({ posicao: null, classificado: false }).eq("id", id);
      buscarTriParticipantes();
      return;
    }

    // Verificar se já existe alguém com essa posição na mesma rodada
    const jaExiste = triParticipantes.find(p => p.rodada === part.rodada && p.posicao === posicao);
    if (jaExiste) {
      return alert(`Já existe um ${posicao}° lugar na Rodada ${part.rodada}: ${jaExiste.nome}. Remova-o primeiro.`);
    }

    const isClassificado = posicao <= 3 && part.rodada <= 3;
    await supabase.from("triathlon_participantes").update({ posicao, classificado: isClassificado }).eq("id", id);
    buscarTriParticipantes();
  };

  const fecharRodadaTri = async (rodada) => {
    if (!window.confirm(`Deseja fechar a Rodada ${rodada === 4 ? 'Final' : rodada}? Não será mais possível adicionar/remover participantes.`)) return;
    const { error } = await supabase
      .from("triathlon_participantes")
      .update({ rodada_fechada: true })
      .eq("rodada", rodada);
    if (error) return alert("Erro: " + error.message);
    alert(`🔐 Rodada ${rodada === 4 ? 'Final' : rodada} fechada!`);
    buscarTriParticipantes();
  };

  const abrirRodadaTri = async (rodada) => {
    if (!window.confirm(`Reabrir Rodada ${rodada === 4 ? 'Final' : rodada}?`)) return;
    const { error } = await supabase
      .from("triathlon_participantes")
      .update({ rodada_fechada: false })
      .eq("rodada", rodada);
    if (error) return alert("Erro: " + error.message);
    alert(`🔓 Rodada ${rodada === 4 ? 'Final' : rodada} reaberta!`);
    buscarTriParticipantes();
  };

  const classificarParaFinal = async () => {
    // Pegar todos os classificados (top 3 de cada rodada 1-3)
    const classificados = triParticipantes.filter(p => p.classificado && p.rodada <= 3);
    if (classificados.length === 0) return alert("Nenhum participante classificado ainda!");

    // Verificar se já existem participantes na final
    const jaFinal = triParticipantes.filter(p => p.rodada === 4);
    if (jaFinal.length > 0) return alert("A rodada final já possui participantes! Remova-os primeiro para recriá-la.");

    const inserts = classificados.map(c => ({
      passaporte: c.passaporte,
      nome: c.nome,
      rodada: 4
    }));

    const { error } = await supabase.from("triathlon_participantes").insert(inserts);
    if (error) return alert("Erro: " + error.message);
    alert(`🏆 ${inserts.length} participantes classificados para a Final!`);
    buscarTriParticipantes();
  };

  // ===============================
  // 🏊 TRIATHLON - UI
  // ===============================

  const renderEventoTriathlon = () => {
    const isRodadaAtualFechada = triParticipantes.some(p => p.rodada === triRodadaCriacao && p.rodada_fechada);

    const rodadas = {};
    triParticipantes.forEach(p => {
      if (!rodadas[p.rodada]) rodadas[p.rodada] = [];
      rodadas[p.rodada].push(p);
    });

    // Sort dentro de cada rodada
    Object.keys(rodadas).forEach(r => {
      rodadas[r].sort((a, b) => {
        if (a.posicao && b.posicao) return a.posicao - b.posicao;
        if (a.posicao) return -1;
        if (b.posicao) return 1;
        return 0;
      });
    });

    const RODADA_LABELS = { 1: "Rodada 1", 2: "Rodada 2", 3: "Rodada 3", 4: "Grande Final" };
    const MEDALHAS = { 1: "🥇", 2: "🥈", 3: "🥉" };
    const totalClassificados = triParticipantes.filter(p => p.classificado && p.rodada <= 3).length;

    return (
      <div style={styles.dashContainer}>
        <ModalNotificacao /><AppHeaderBar />
        <div style={{ padding: "30px 40px" }}>
          <div style={styles.whiteCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
              <button style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }} onClick={() => setPaginaAtual("dashboard")}>⬅ Voltar</button>
              <h3 style={{ margin: 0, fontSize: "18px" }}>🏊 Red's Triathlon</h3>
              <span style={{ color: theme.subtext, fontSize: "13px" }}>23/05 às 20h30</span>
            </div>

            {/* FORMULÁRIO */}
            <div style={{ background: theme.card2, padding: "24px", borderRadius: "12px", border: `1px solid ${theme.border}`, marginBottom: "40px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
                <h4 style={{ margin: "0", color: theme.text, fontSize: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ color: "#0ea5e9" }}>1.</span> Inscrever Participante
                </h4>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  {isRodadaAtualFechada ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#ef4444", background: "#ef444422", padding: "6px 12px", borderRadius: "8px" }}>🔒 RODADA FECHADA</span>
                      <button onClick={() => abrirRodadaTri(triRodadaCriacao)} style={{ background: "transparent", color: "#22c55e", border: "1px solid #22c55e", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>🔓 Reabrir</button>
                    </div>
                  ) : (
                    <button onClick={() => fecharRodadaTri(triRodadaCriacao)} style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>🔒 Fechar Rodada</button>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: theme.card, padding: "6px 12px", borderRadius: "8px", border: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: theme.text }}>Destino:</span>
                    <button onClick={() => setTriRodadaCriacao(Math.max(1, triRodadaCriacao - 1))} style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: "6px", width: "24px", height: "24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>-</button>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#0ea5e9", width: "80px", textAlign: "center" }}>{triRodadaCriacao === 4 ? "Final" : `Rodada ${triRodadaCriacao}`}</span>
                    <button onClick={() => setTriRodadaCriacao(Math.min(4, triRodadaCriacao + 1))} style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: "6px", width: "24px", height: "24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>+</button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", background: isDarkMode ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.5)", padding: "16px", borderRadius: "10px", border: `1px dashed ${theme.border}` }}>
                <input
                  style={{ width: "130px", padding: "10px 14px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, outline: "none", fontSize: "14px", textAlign: "center" }}
                  placeholder="Passaporte"
                  value={triPassaporte}
                  onChange={(e) => {
                    const valor = e.target.value.replace(/\D/g, "");
                    if (valor === triPassaporte) return;
                    setTriPassaporte(valor);
                    if (valor.length < 2) { setTriNome(""); return; }
                    clearTimeout(window._buscaTriDelay);
                    window._buscaTriDelay = setTimeout(() => { buscarClienteTriathlon(valor); }, 600);
                  }}
                />
                <input
                  style={{ flex: 1, minWidth: "150px", padding: "10px 14px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.card, color: theme.text, outline: "none", fontSize: "14px" }}
                  placeholder="Nome do Participante"
                  value={triNome}
                  onChange={(e) => setTriNome(e.target.value)}
                />
                <button
                  onClick={adicionarTriParticipante}
                  style={{ background: "#0ea5e9", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", whiteSpace: "nowrap", fontSize: "14px", transition: "filter 0.2s" }}
                  onMouseEnter={(e) => e.target.style.filter = "brightness(1.1)"}
                  onMouseLeave={(e) => e.target.style.filter = "brightness(1)"}
                >
                  ➕ Inscrever
                </button>
              </div>

              {/* Info de vagas */}
              {triRodadaCriacao <= 3 && (
                <div style={{ marginTop: "12px", fontSize: "13px", color: theme.subtext }}>
                  💡 Vagas na Rodada {triRodadaCriacao}: <strong style={{ color: "#0ea5e9" }}>{10 - (rodadas[triRodadaCriacao]?.length || 0)}</strong> / 10 restantes
                </div>
              )}
            </div>

            {/* BOTÃO CLASSIFICAR PARA FINAL */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "30px", flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={classificarParaFinal}
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #f97316)",
                  color: "#fff", border: "none", padding: "12px 24px",
                  borderRadius: "8px", cursor: "pointer", fontWeight: "bold",
                  fontSize: "14px", display: "flex", alignItems: "center", gap: "8px",
                  boxShadow: "0 4px 14px rgba(245,158,11,0.3)",
                  transition: "transform 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.transform = "translateY(-2px)"}
                onMouseLeave={(e) => e.target.style.transform = "translateY(0)"}
              >
                🏆 Gerar Rodada Final ({totalClassificados} classificados)
              </button>
              <span style={{ fontSize: "12px", color: theme.subtext }}>
                Envia os top 3 de cada rodada para a Final
              </span>
            </div>

            {/* LISTA POR RODADAS */}
            <h3 style={{ borderBottom: `1px solid ${theme.border}`, paddingBottom: "10px", marginTop: "20px" }}>Participantes inscritos</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "30px", marginTop: "20px" }}>
              {[1, 2, 3, 4].filter(r => rodadas[r]).map(rodadaNum => {
                const isFinal = rodadaNum === 4;
                const isRodadaFechada = rodadas[rodadaNum].some(p => p.rodada_fechada);
                const accentColor = isFinal ? "#f59e0b" : rodadaNum === 1 ? "#0ea5e9" : rodadaNum === 2 ? "#8b5cf6" : "#22c55e";

                return (
                  <div key={rodadaNum} style={{ background: theme.card2, padding: "24px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
                      <h3 style={{ margin: "0", display: "flex", alignItems: "center", gap: "10px", color: theme.text }}>
                        <span style={{ fontSize: "24px" }}>{isFinal ? "🏆" : "🏁"}</span>
                        <span style={{ color: accentColor }}>{RODADA_LABELS[rodadaNum]}</span>
                        <span style={{ color: theme.subtext, fontSize: "13px", fontWeight: "400" }}>({rodadas[rodadaNum].length} participante{rodadas[rodadaNum].length !== 1 ? "s" : ""})</span>
                      </h3>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {isRodadaFechada ? (
                          <>
                            <span style={{ fontSize: "12px", fontWeight: "700", color: "#ef4444", background: "#ef444415", padding: "4px 10px", borderRadius: "8px" }}>🔒 Fechada</span>
                            <button onClick={() => abrirRodadaTri(rodadaNum)} style={{ background: "transparent", color: "#22c55e", border: "1px solid #22c55e", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>🔓 Reabrir</button>
                          </>
                        ) : (
                          <button onClick={() => fecharRodadaTri(rodadaNum)} style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>🔒 Fechar</button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                      {rodadas[rodadaNum].map(p => {
                        const medalha = MEDALHAS[p.posicao];
                        const isTop3 = p.posicao && p.posicao <= 3;
                        const cardBorder = isTop3
                          ? p.posicao === 1 ? "#fbbf24" : p.posicao === 2 ? "#94a3b8" : "#cd7f32"
                          : theme.border;

                        return (
                          <div key={p.id} style={{
                            display: "flex", alignItems: "center", gap: "14px",
                            background: theme.card, border: `1px solid ${cardBorder}`,
                            borderLeft: `4px solid ${cardBorder}`,
                            borderRadius: "10px", padding: "14px 18px",
                            boxShadow: isTop3 ? `0 0 15px ${cardBorder}20` : "none",
                            transition: "transform 0.2s"
                          }}>
                            {/* Avatar / posição */}
                            <div style={{
                              width: "38px", height: "38px", borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: isTop3 ? `${cardBorder}22` : `${theme.bg}`,
                              border: `2px solid ${isTop3 ? cardBorder : theme.border}`,
                              fontSize: medalha ? "18px" : "13px", fontWeight: "800",
                              color: theme.text, flexShrink: 0
                            }}>
                              {medalha || (p.posicao || "—")}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <strong style={{ fontSize: "14px", color: theme.text }}>{p.passaporte}</strong>
                                <span style={{ color: theme.subtext, fontSize: "14px" }}>—</span>
                                <span style={{ fontSize: "14px", color: theme.text }}>{p.nome}</span>
                                {p.classificado && !isFinal && (
                                  <span style={{ background: "#22c55e22", color: "#22c55e", fontSize: "10px", fontWeight: "800", padding: "2px 6px", borderRadius: "4px", border: "1px solid #22c55e44" }}>✅ CLASSIFICADO</span>
                                )}
                              </div>
                            </div>

                            {/* Ações */}
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                              {[1, 2, 3].map(pos => (
                                <button
                                  key={pos}
                                  onClick={() => definirPosicaoTri(p.id, pos)}
                                  style={{
                                    background: p.posicao === pos ? (pos === 1 ? "#fbbf24" : pos === 2 ? "#94a3b8" : "#cd7f32") : "transparent",
                                    border: `1px solid ${pos === 1 ? "#fbbf24" : pos === 2 ? "#94a3b8" : "#cd7f32"}`,
                                    color: p.posicao === pos ? "#000" : theme.text,
                                    padding: "6px 10px", borderRadius: "6px",
                                    cursor: "pointer", fontSize: "12px", fontWeight: "600",
                                    transition: "all 0.2s"
                                  }}
                                >
                                  {MEDALHAS[pos]}
                                </button>
                              ))}
                              <button
                                onClick={() => removerTriParticipante(p.id)}
                                style={{
                                  background: "transparent",
                                  color: p.rodada_fechada ? "#94a3b8" : "#ef4444",
                                  padding: "6px 10px", border: `1px solid ${p.rodada_fechada ? '#94a3b8' : '#ef4444'}`,
                                  borderRadius: "6px", cursor: p.rodada_fechada ? "not-allowed" : "pointer",
                                  fontSize: "12px", fontWeight: "600",
                                  opacity: p.rodada_fechada ? 0.5 : 1
                                }}
                                disabled={p.rodada_fechada}
                              >
                                ✖
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };



  const theme = {
    bg: isDarkMode ? "#0f0f0f" : "#f0f2f5",
    card: isDarkMode ? "#1a1a1a" : "#ffffff",
    card2: isDarkMode ? "#222222" : "#f8f9fa",
    text: isDarkMode ? "#f0f0f0" : "#1a1a1a",
    subtext: isDarkMode ? "#888" : "#666",
    border: isDarkMode ? "#2e2e2e" : "#e0e0e0",
    inputBg: isDarkMode ? "#2a2a2a" : "#f5f5f5",
    accent: "#b40d0d",
    green: "#2bff00",
  };

  const styles = {
    dashContainer: { background: theme.bg, minHeight: "100vh", width: "100%", maxWidth: "none", overflowX: "hidden", boxSizing: "border-box", paddingBottom: "100px", fontFamily: "'Inter', sans-serif", transition: "background 0.3s" },
    topBar: { background: isDarkMode ? "rgba(10,10,10,0.92)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap", borderBottom: `1px solid ${theme.border}`, position: "relative", zIndex: 200, minHeight: "76px", boxShadow: isDarkMode ? "0 10px 30px rgba(0,0,0,0.28)" : "0 10px 30px rgba(15,23,42,0.06)" },
    navBtn: (ativa, cor = theme.accent) => ({ background: ativa ? (isDarkMode ? `${cor}18` : `${cor}10`) : (isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.02)"), border: `1px solid ${ativa ? `${cor}55` : theme.border}`, cursor: "pointer", color: ativa ? (isDarkMode ? "#fff" : "#111") : theme.subtext, fontWeight: ativa ? "700" : "600", fontSize: "13px", padding: "9px 14px", borderRadius: "12px", transition: "all 0.2s ease", letterSpacing: "0.2px", whiteSpace: "nowrap", boxShadow: ativa ? `0 0 0 1px ${cor}22 inset` : "none" }),
    logo: { color: "#fff", fontWeight: "900", fontSize: "15px", letterSpacing: "1.8px" },
    grid: { display: "flex", flexDirection: "row-reverse", gap: "25px", padding: "30px 20px", justifyContent: "center", alignItems: "stretch", width: "100%", maxWidth: "none", minWidth: 0, boxSizing: "border-box" },
    whiteCard: { background: theme.card, padding: "24px", borderRadius: "16px", justifyContent: "center", boxShadow: isDarkMode ? "0 2px 20px rgba(0,0,0,0.4)" : "0 2px 20px rgba(0,0,0,0.06)", color: theme.text, border: `1px solid ${theme.border}` },
    cardHeader: { fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.5px" },
    dot: { width: "7px", height: "7px", background: theme.accent, borderRadius: "50%", flexShrink: 0 },
    performanceGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "25px" },
    itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${theme.border}` },
    miniLabel: { fontSize: "10px", fontWeight: "700", color: theme.subtext, marginBottom: "6px", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" },
    input: { width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, boxSizing: "border-box", fontSize: "14px", outline: "none", transition: "border 0.2s" },
    select: { width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, boxSizing: "border-box", fontSize: "14px", outline: "none", cursor: "pointer" },
    textarea: { width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, boxSizing: "border-box", fontSize: "14px", outline: "none", resize: "vertical", minHeight: "80px", fontFamily: "inherit" },
    inputPrice: { width: "130px", padding: "10px 14px", borderRadius: "10px", border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, textAlign: "right", fontWeight: "700", fontSize: "14px" },
    uploadArea: { border: `2px dashed ${theme.border}`, borderRadius: "12px", padding: "18px", textAlign: "center", background: theme.inputBg },
    uploadBtnLabel: { background: isDarkMode ? "#2e2e2e" : "#efefef", border: `1px solid ${theme.border}`, padding: "9px 18px", borderRadius: "9px", cursor: "pointer", fontSize: "12px", color: theme.text, fontWeight: "600", display: "inline-block" },
    footer: { position: "fixed", bottom: 0, left: "var(--reds-sidebar-width, 0px)", width: "calc(100% - var(--reds-sidebar-width, 0px))", background: isDarkMode ? "rgba(20,20,20,0.97)" : "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", padding: "14px clamp(20px, 4vw, 60px)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", borderTop: `1px solid ${theme.border}`, boxSizing: "border-box", zIndex: 500, transition: "left .22s ease, width .22s ease" },
    btnRegister: { background: "linear-gradient(135deg, #b40d0d, #b40d0d)", color: "white", border: "none", padding: "13px 32px", borderRadius: "12px", fontWeight: "700", cursor: "pointer", fontSize: "14px", letterSpacing: "0.5px", boxShadow: "0 4px 15px rgba(180,13,13,0.3)" },
    btnPrimary: { background: "linear-gradient(135deg, #b40d0d, #b40d0d)", color: "white", border: "none", padding: "12px", borderRadius: "10px", width: "100%", marginTop: "14px", fontWeight: "700", cursor: "pointer", fontSize: "14px" },
    loginCentral: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "20px", position: "relative", overflow: "hidden", backgroundColor: "#050505" },
    btnPeriodo: (ativo) => ({ background: ativo ? theme.accent : theme.inputBg, color: ativo ? "#fff" : theme.subtext, border: `1px solid ${ativo ? theme.accent : theme.border}`, padding: "5px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: ativo ? "700" : "500", transition: "all 0.2s" }),
  };

  const NavBtn = ({ id, label, cor }) => (
    <button style={styles.navBtn(paginaAtual === id, cor)} onClick={() => setPaginaAtual(id)}>{label}</button>
  );

  const SeletorPeriodo = ({ valor, onChange }) => (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      <button style={styles.btnPeriodo(valor === "semana")} onClick={() => onChange("semana")}>📅 Semana</button>
      <button style={styles.btnPeriodo(valor === "mes")} onClick={() => onChange("mes")}>🗓️ Mês</button>
      <button style={styles.btnPeriodo(valor === "total")} onClick={() => onChange("total")}>♾️ Total</button>
    </div>
  );

  const legendaPeriodo = (p) => {
    if (p === "semana") return "📅 Semana atual (Seg → Dom)";
    if (p === "mes") return "🗓️ Mês atual (1º ao último dia)";
    return "♾️ Todos os registros";
  };

  // Permissões derivadas do usuário logado
  const cargoReal = usuarioLogado?.role || "";
  const podeVisualizarComo = getPrimaryRole(cargoReal) === "dono";
  const userRole = podeVisualizarComo && cargoVisualizacao ? cargoVisualizacao : cargoReal;
  const usuarioParaInterface = usuarioLogado && userRole !== cargoReal
    ? { ...usuarioLogado, role: userRole }
    : usuarioLogado;
  const userNivel = getNivel(userRole);
  const userIsAdmin = isAdminOuDono(userRole);
  const userPodeAdmin = userIsAdmin || (userRole && (
    userRole.includes("gerente_geral") ||
    userRole.includes("gerente") ||
    userRole.includes("gerente_rh") ||
    userRole.includes("resp_rh")
  ));
  const userIsRespPonto = isResponsavelPonto(userRole);
  const userPodeNotificar = podeSendNotif(userRole);
  const userPodeVerRemetente = userNivel >= 6;
  const userPodeEditarAvisos = userPodeAdmin;
  const userPodeFinancas = () => {
    const p = getPrimaryRole(userRole);
    const atr = getAtribuicoes(userRole);
    return p === "admin" || p === "dono" || p === "gerente_geral" || atr.includes("resp_financas");
  };

  // Banner Global de Notificação de Tunagens
  const GlobalTunagemBanner = () => {
    if (!tunagemRealtimeGlobal) return null;
    const isDonoAdmin = isAdminOuDono(usuarioLogado?.role);

    return (
      <div
        style={{
          position: "fixed",
          top: "24px",
          right: "24px",
          zIndex: 999999,
          background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
          border: "2px solid #ec4899",
          borderRadius: "16px",
          padding: "16px 20px",
          boxShadow: "0 10px 30px rgba(236,72,153,0.4), 0 0 25px rgba(0,0,0,0.8)",
          maxWidth: "420px",
          width: "calc(100vw - 48px)",
          animation: "fadeIn 0.3s ease-out",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "26px" }}>🚗</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: "900", color: "#f472b6", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {tunagemRealtimeGlobal.isMeu ? "🔔 Nova Tunagem Realizada por Você!" : "🔔 Nova Tunagem da Equipe"}
                </span>
                {!tunagemRealtimeGlobal.isMeu && (
                  <span style={{ fontSize: "10px", background: "rgba(236,72,153,0.25)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.5)", padding: "1px 6px", borderRadius: "6px", fontWeight: "800" }}>
                    👑 DONO / ADMIN
                  </span>
                )}
              </div>
              <div style={{ fontSize: "15px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
                {tunagemRealtimeGlobal.log.veiculo_nome} <span style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "12px" }}>({tunagemRealtimeGlobal.log.placa})</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setTunagemRealtimeGlobal(null)}
            style={{ background: "transparent", border: "none", color: theme.subtext, fontSize: "20px", cursor: "pointer", padding: "0 4px", lineHeight: "1" }}
            title="Fechar Notificação"
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.35)", padding: "8px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: "12px", color: theme.subtext, display: "flex", alignItems: "center", gap: "6px" }}>
            🧑‍🔧 <strong style={{ color: "#fff" }}>{tunagemRealtimeGlobal.log.tecnico_nome}</strong>
          </span>
          <span style={{ fontSize: "14px", fontWeight: "900", color: "#4ade80" }}>
            R$ {tunagemRealtimeGlobal.analise.totalACobrar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Opção para o Dono/Admin alternar o recebimento de alertas de funcionários */}
        {isDonoAdmin && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.15)" }}>
            <span style={{ fontSize: "11px", color: theme.subtext }}>
              Alertas de funcionários:
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNotificarTodasTunagens();
              }}
              style={{
                background: notificarTodasTunagens ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                border: `1px solid ${notificarTodasTunagens ? "#22c55e" : "#ef4444"}`,
                color: notificarTodasTunagens ? "#4ade80" : "#f87171",
                fontSize: "11px",
                fontWeight: "800",
                borderRadius: "6px",
                padding: "2px 8px",
                cursor: "pointer"
              }}
            >
              {notificarTodasTunagens ? "🟢 Ativado" : "🔴 Desativado"}
            </button>
          </div>
        )}

        <button
          onClick={() => {
            if (tunagemRealtimeGlobal?.log) {
              setLogTunagemParaAbrir(tunagemRealtimeGlobal.log);
            }
            setTunagemRealtimeGlobal(null);
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
    );
  };

  const PainelNotificacoesServicos = () => {
    return (
      <div ref={painelNotificacoesRef} style={{ position: "fixed", top: layoutPreferido === "topo" ? "76px" : "74px", right: "20px", zIndex: 1000000, width: "min(430px, calc(100vw - 32px))", maxHeight: "min(620px, calc(100vh - 100px))", overflow: "hidden", display: "none", flexDirection: "column", background: "#111318", border: "1px solid rgba(255,255,255,.14)", borderRadius: "16px", boxShadow: "0 24px 70px rgba(0,0,0,.65)" }}>
        <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <div><strong style={{ color: "#fff" }}>Serviços recebidos</strong><div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>Tunagens e estéticas em tempo real</div></div>
          <div style={{ display: "flex", gap: "8px" }}>
            {notificacoesServicos.length > 0 && <button onClick={() => setNotificacoesServicos([])} style={{ border: 0, background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: "11px" }}>Limpar</button>}
            <button onClick={() => { if (painelNotificacoesRef.current) painelNotificacoesRef.current.style.display = "none"; }} aria-label="Fechar notificações" style={{ width: "30px", height: "30px", borderRadius: "8px", border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.05)", color: "#fff", cursor: "pointer" }}>×</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "8px" }}>
          {notificacoesServicos.length === 0 ? <div style={{ padding: "32px 16px", color: "#94a3b8", textAlign: "center" }}>Nenhum serviço novo.</div> : notificacoesServicos.map((item) => (
            <button key={item.id} onClick={() => { setLogTunagemParaAbrir(item.log); if (painelNotificacoesRef.current) painelNotificacoesRef.current.style.display = "none"; }} style={{ width: "100%", padding: "12px", marginBottom: "7px", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 12px", textAlign: "left", borderRadius: "11px", border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)", color: "#fff", cursor: "pointer" }}>
              <span><b style={{ color: item.tipo === "Estética" ? "#38bdf8" : "#f472b6" }}>{item.tipo}</b> · {item.log.veiculo_nome || "Veículo"} {item.log.placa ? `(${item.log.placa})` : ""}<small style={{ display: "block", color: "#94a3b8", marginTop: "5px" }}>{item.log.tecnico_nome || "Mecânico não informado"}</small></span>
              <strong style={{ color: "#4ade80", whiteSpace: "nowrap" }}>R$ {(item.analise?.totalACobrar || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Banner Global de Notificação de Bancada (Dono e Gerência)
  const GlobalBancadaBanner = () => {
    if (!bancadaRealtimeGlobal) return null;
    return (
      <div
        style={{
          position: "fixed",
          top: tunagemRealtimeGlobal ? "180px" : "24px",
          right: "24px",
          zIndex: 999999,
          background: "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
          border: "2px solid #22c55e",
          borderRadius: "16px",
          padding: "14px 18px",
          boxShadow: "0 10px 30px rgba(34,197,94,0.35), 0 0 25px rgba(0,0,0,0.8)",
          maxWidth: "400px",
          width: "calc(100vw - 48px)",
          animation: "fadeIn 0.3s ease-out",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🛠️</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: "900", color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  🔔 Compra na Bancada
                </span>
                <span style={{ fontSize: "9.5px", background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.4)", padding: "1px 5px", borderRadius: "5px", fontWeight: "800" }}>
                  RED'S
                </span>
              </div>
              <div style={{ fontSize: "14px", fontWeight: "900", color: "#fff", marginTop: "2px" }}>
                {bancadaRealtimeGlobal.quantidade}x {bancadaRealtimeGlobal.item}
              </div>
            </div>
          </div>

          <button
            onClick={() => setBancadaRealtimeGlobal(null)}
            style={{ background: "transparent", border: "none", color: "#888", fontSize: "18px", cursor: "pointer", padding: "0 4px", lineHeight: "1" }}
            title="Fechar Notificação"
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.4)", padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "6px" }}>
            🧑‍🔧 <strong style={{ color: "#fff" }}>{bancadaRealtimeGlobal.nome}</strong> {bancadaRealtimeGlobal.id ? `(ID: ${bancadaRealtimeGlobal.id})` : ""}
          </span>
          <span style={{ fontSize: "13px", fontWeight: "900", color: "#22c55e" }}>
            {bancadaRealtimeGlobal.preco > 0 ? `R$ ${bancadaRealtimeGlobal.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Grátis / Craft"}
          </span>
        </div>
      </div>
    );
  };

  // Modal de Notificação Global
  const AppModalNotificacao = () => (
    <ModalNotificacao
      notificacaoPendente={notificacaoPendente}
      isDarkMode={isDarkMode}
      theme={theme}
      formatarDataHora={formatarDataHora}
      renderMensagemComLinks={renderMensagemComLinks}
      confirmarLeituraNotificacao={confirmarLeituraNotificacao}
    />
  );

  // Header reutilizável
  const AppHeaderBar = () => (
    <>
      <AppModalNotificacao />
      {layoutPreferido === "topo" ? (
        <TopHeaderBar
          paginaAtual={paginaAtual}
          setPaginaAtual={setPaginaAtual}
          pontoAtivo={pontoAtivo}
          tempoSegundos={tempoSegundos}
          formatarCronometro={formatarCronometro}
          registrarPonto={registrarPonto}
          usuarioLogado={usuarioParaInterface}
          setUsuarioLogado={setUsuarioLogado}
          getLabelCargo={getLabelCargo}
          userPodeNotificar={userPodeNotificar}
          userPodeFinancas={userPodeFinancas()}
          userIsAdmin={userIsAdmin}
          userRole={userRole}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          layoutPreferido={layoutPreferido}
          setLayoutPreferido={alterarLayoutPreferido}
          serviceNotificationCount={notificacoesServicos.length}
          onOpenServiceNotifications={() => { const painel = painelNotificacoesRef.current; if (painel) painel.style.display = painel.style.display === "flex" ? "none" : "flex"; }}
          podeVisualizarComo={podeVisualizarComo}
          cargoVisualizacao={cargoVisualizacao}
          onVisualizarComo={(cargo) => { setCargoVisualizacao(cargo); setPaginaAtual("dashboard"); }}
          cargosVisualizacao={CARGOS_HIERARQUIA}
        />
      ) : (
        <HeaderBar
          paginaAtual={paginaAtual}
          setPaginaAtual={setPaginaAtual}
          theme={theme}
          styles={styles}
          pontoAtivo={pontoAtivo}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          tempoSegundos={tempoSegundos}
          formatarCronometro={formatarCronometro}
          registrarPonto={registrarPonto}
          usuarioLogado={usuarioParaInterface}
          setUsuarioLogado={setUsuarioLogado}
          getLabelCargo={getLabelCargo}
          userPodeNotificar={userPodeNotificar}
          userPodeFinancas={userPodeFinancas()}
          userIsAdmin={userIsAdmin}
          userRole={userRole}
          layoutPreferido={layoutPreferido}
          setLayoutPreferido={alterarLayoutPreferido}
          serviceNotificationCount={notificacoesServicos.length}
          onOpenServiceNotifications={() => { const painel = painelNotificacoesRef.current; if (painel) painel.style.display = painel.style.display === "flex" ? "none" : "flex"; }}
          podeVisualizarComo={podeVisualizarComo}
          cargoVisualizacao={cargoVisualizacao}
          onVisualizarComo={(cargo) => { setCargoVisualizacao(cargo); setPaginaAtual("dashboard"); }}
          cargosVisualizacao={CARGOS_HIERARQUIA}
        />
      )}
      <GlobalTunagemBanner />
      <PainelNotificacoesServicos />
      {podeVisualizarComo && cargoVisualizacao && (
        <div style={{ position: "fixed", left: layoutPreferido === "lateral" ? "286px" : "18px", bottom: paginaAtual === "dashboard" ? "85px" : "18px", zIndex: 1000001, display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "11px", background: "rgba(30,41,59,.97)", border: "1px solid rgba(56,189,248,.55)", boxShadow: "0 12px 35px rgba(0,0,0,.45)", color: "#e0f2fe", fontSize: "11px", fontWeight: 800 }}>
          <span>Visualizando como: {getLabelCargo(cargoVisualizacao)}</span>
          <button type="button" onClick={() => { setCargoVisualizacao(""); setPaginaAtual("dashboard"); }} style={{ border: "1px solid rgba(125,211,252,.4)", background: "rgba(14,165,233,.16)", color: "#bae6fd", borderRadius: "7px", padding: "5px 8px", cursor: "pointer", fontSize: "10px", fontWeight: 900 }}>Voltar para Dono</button>
        </div>
      )}
      {isModoV2 && !v2BannerFechado && (
        v2BannerMinimizado ? (
          <div
            onClick={() => setV2BannerMinimizado(false)}
            title="Modo V2 Ativo (Tabelas Centralizadas) - Clique para expandir opções"
            style={{
              position: "fixed",
              bottom: paginaAtual === "dashboard" ? "145px" : "85px",
              right: "20px",
              zIndex: 9998,
              background: "linear-gradient(135deg, rgba(6,78,59,0.96) 0%, rgba(15,23,42,0.96) 100%)",
              border: "1px solid rgba(52,211,153,0.7)",
              color: "#6ee7b7",
              padding: "6px 14px",
              borderRadius: "20px",
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
              fontSize: "11.5px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backdropFilter: "blur(12px)",
              fontFamily: "'Inter', sans-serif",
              transition: "transform 0.15s ease"
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            <span>🚀 V2 Beta</span>
          </div>
        ) : (
          <div style={{
            position: "fixed",
            bottom: paginaAtual === "dashboard" ? "145px" : "85px",
            right: "20px",
            zIndex: 9998,
            background: "linear-gradient(135deg, rgba(6,78,59,0.96) 0%, rgba(15,23,42,0.96) 100%)",
            border: "1px solid rgba(52,211,153,0.7)",
            color: "#ecfdf5",
            padding: "9px 14px",
            borderRadius: "12px",
            boxShadow: "0 12px 35px rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "12px",
            fontWeight: 800,
            backdropFilter: "blur(14px)",
            fontFamily: "'Inter', sans-serif"
          }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981", flexShrink: 0 }} />
            <div>
              <div style={{ color: "#6ee7b7", fontSize: "12px", letterSpacing: "0.4px" }}>🚀 MODO V2 (NOVAS TABELAS)</div>
              <div style={{ color: "#a7f3d0", fontSize: "10px", fontWeight: 500 }}>Base: log_ponto • log_tunagem • log_bancada • log_bau</div>
            </div>
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              style={{
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#fff",
                borderRadius: "8px",
                padding: "5px 10px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 800,
                marginLeft: "2px"
              }}
            >
              Voltar para V1
            </button>
            <button
              type="button"
              onClick={() => setV2BannerMinimizado(true)}
              title="Minimizar aviso"
              style={{
                background: "transparent",
                border: "none",
                color: "#a7f3d0",
                cursor: "pointer",
                fontSize: "15px",
                padding: "2px 5px",
                lineHeight: 1
              }}
            >
              –
            </button>
            <button
              type="button"
              onClick={() => setV2BannerFechado(true)}
              title="Fechar aviso nesta sessão"
              style={{
                background: "transparent",
                border: "none",
                color: "#a7f3d0",
                cursor: "pointer",
                fontSize: "13px",
                padding: "2px 5px",
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        )
      )}
      <JanelaPontoFlutuante
        usuarioLogado={usuarioParaInterface}
        theme={theme}
        isDarkMode={isDarkMode}
      />
      {paginaAtual !== "tunagem" && (
        <ModalDetalheTunagem
          theme={theme}
          modalLogDetalhe={logTunagemParaAbrir}
          setModalLogDetalhe={setLogTunagemParaAbrir}
          usuarioLogado={usuarioParaInterface}
        />
      )}
    </>
  );

  // ===== PÁGINA: RECRUTAMENTO =====
  if (paginaAtual === "recrutamento") {
    return (
      <RecrutamentoPage
        styles={styles}
        theme={theme}
        usuarioLogado={usuarioParaInterface}
        isAdminOuDono={isAdminOuDono}
        curriculos={curriculos}
        buscarCurriculos={buscarCurriculos}
        salvarCurriculo={salvarCurriculo}
        deletarCurriculo={deletarCurriculo}
        toggleContatadoCurriculo={toggleContatadoCurriculo}
        atualizarCurriculo={atualizarCurriculo}
        curriculosCarregando={curriculosCarregando}
        formatarDataHora={formatarDataHora}
        AppHeaderBar={AppHeaderBar}
        AppModalNotificacao={AppModalNotificacao}
      />
    );
  }

  // ===== PÁGINA: LOGIN =====
  if (paginaAtual === "login") {
    return (
      <LoginPage
        idInputLogin={idInputLogin}
        setIdInputLogin={setIdInputLogin}
        senhaInputLogin={senhaInputLogin}
        setSenhaInputLogin={setSenhaInputLogin}
        realizarLogin={realizarLogin}
        erroLogin={erroLogin}
        setErroLogin={setErroLogin}
        carregandoLogin={carregandoLogin}
      />
    );
  }

  // ===== PÁGINA: ALTERAR SENHA =====
  if (paginaAtual === "alterar-senha") {
    return (
      <AlterarSenhaPage
        styles={styles}
        novaSenhaInput={novaSenhaInput}
        setNovaSenhaInput={setNovaSenhaInput}
        atualizarSenhaNoBanco={atualizarSenhaNoBanco}
        usuarioLogado={usuarioLogado}
        setPaginaAtual={setPaginaAtual}
      />
    );
  }

  // ===== PÁGINA: BLOQUEADO FINANCEIRO =====
  if (paginaAtual === "bloqueado-financeiro") {
    return (
      <BloqueadoFinanceiroPage
        styles={styles}
        theme={theme}
        usuarioLogado={usuarioLogado}
        formatarData={formatarData}
        reportValorSemanal={reportValorSemanal}
        setReportValorSemanal={setReportValorSemanal}
        reportObsSemanal={reportObsSemanal}
        setReportObsSemanal={setReportObsSemanal}
        reportLinkSemanal={reportLinkSemanal}
        setReportLinkSemanal={setReportLinkSemanal}
        reportarPagamentoSemanal={reportarPagamentoSemanal}
        usarCredito24h={usarCredito24h}
        setUsuarioLogado={setUsuarioLogado}
        setPaginaAtual={setPaginaAtual}
        meusPagamentos={meusPagamentos}
        buscarMeusPagamentos={buscarMeusPagamentos}
        // Novas props para upload automático
        valorPagamentoRegistro={valorPagamentoRegistro}
        setValorPagamentoRegistro={setValorPagamentoRegistro}
        observacaoPagamento={observacaoPagamento}
        setObservacaoPagamento={setObservacaoPagamento}
        previewPagamento={previewPagamento}
        handleFilePagamento={handleFilePagamento}
        handlePastePagamento={handlePastePagamento}
        enviarRegistroPagamento={enviarRegistroPagamento}
      />
    );
  }

  // ===== PÁGINA: PAGAMENTOS =====
  if (paginaAtual === "pagamentos") {
    return (
      <PagamentosPage
        styles={styles}
        theme={theme}
        usuarioLogado={usuarioParaInterface}
        valorPagamentoRegistro={valorPagamentoRegistro}
        setValorPagamentoRegistro={setValorPagamentoRegistro}
        observacaoPagamento={observacaoPagamento}
        setObservacaoPagamento={setObservacaoPagamento}
        handlePastePagamento={handlePastePagamento}
        handleFilePagamento={handleFilePagamento}
        previewPagamento={previewPagamento}
        enviarRegistroPagamento={enviarRegistroPagamento}
        meusPagamentos={meusPagamentos}
        AppHeaderBar={AppHeaderBar}
        AppModalNotificacao={AppModalNotificacao}
      />
    );
  }

  if (paginaAtual === "evento-derby") return renderEventoDerby();
  if (paginaAtual === "evento-triathlon") return renderEventoTriathlon();

  // ===== PÁGINA: CLIENTES =====
  if (paginaAtual === "clientes") {
    return (
      <ClientesPage
        styles={styles}
        theme={theme}
        userIsAdmin={userIsAdmin}
        setPaginaAtual={setPaginaAtual}
        buscaId={buscaId}
        setBuscaId={setBuscaId}
        buscarClientePorId={buscarClientePorId}
        buscarClientes={buscarClientes}
        clientesLista={clientesLista}
        editandoId={editandoId}
        setEditandoId={setEditandoId}
        novoNomeCliente={novoNomeCliente}
        setNovoNomeCliente={setNovoNomeCliente}
        usuariosMapa={usuariosMapa}
        historicoClienteId={historicoClienteId}
        historicoClienteDados={historicoClienteDados}
        formatarDataHora={formatarDataHora}
        formatarData={formatarData}
        atualizarNomeCliente={atualizarNomeCliente}
        buscarServicosCliente={buscarServicosCliente}
        deletarCliente={deletarCliente}
        temMaisClientes={temMaisClientes}
        ordemClientesStr={ordemClientesStr}
        setOrdemClientesStr={setOrdemClientesStr}
        AppHeaderBar={AppHeaderBar}
        AppModalNotificacao={AppModalNotificacao}
      />
    );
  }

  // ===== PÁGINA: HIERARQUIA =====
  if (paginaAtual === "hierarquia") {
    return (
      <HierarquiaPage
        styles={styles}
        theme={theme}
        hierarquiaFuncionarios={hierarquiaFuncionarios}
        CARGOS_HIERARQUIA={CARGOS_HIERARQUIA}
        getPrimaryRole={getPrimaryRole}
        buscarHierarquia={buscarHierarquia}
        getAtribuicoes={getAtribuicoes}
        userIsAdmin={userIsAdmin}
        toggleOcultoHierarquia={toggleOcultoHierarquia}
        getLabelCargo={getLabelCargo}
        AppHeaderBar={AppHeaderBar}
        AppModalNotificacao={AppModalNotificacao}
      />
    );
  }

  // ===== PÁGINA: CANDIDATURAS =====
  if (paginaAtual === "candidaturas") {
    return (
      <CandidaturasPage
        styles={styles}
        theme={theme}
        usuarioLogado={usuarioParaInterface}
        isAdminOuDono={isAdminOuDono}
        candidaturas={candidaturas}
        buscarCandidaturas={buscarCandidaturas}
        enviarCandidatura={enviarCandidatura}
        analisarCandidatura={analisarCandidatura}
        candidaturasCarregando={candidaturasCarregando}
        formatarDataHora={formatarDataHora}
        vagasAtivas={vagasAtivas}
        toggleVaga={toggleVaga}
        userIsAdmin={userIsAdmin}
        AppHeaderBar={AppHeaderBar}
        AppModalNotificacao={AppModalNotificacao}
      />
    );
  }


  // ===== PÁGINA: FINANÇAS =====
  if (paginaAtual === "financas") {
    return (
      <FinancasPage
        styles={styles}
        theme={theme}
        userPodeFinancas={userPodeFinancas}
        setPaginaAtual={setPaginaAtual}
        buscarFinancas={buscarFinancas}
        buscarPagamentosSemanais={buscarPagamentosSemanais}
        financasCarregando={financasCarregando}
        pagamentosSemanais={pagamentosSemanais}
        formatarDataHora={formatarDataHora}
        confirmarPagamentoSemanal={confirmarPagamentoSemanal}
        registrarPagamentoManual={registrarPagamentoManual}
        financasFuncionarios={financasFuncionarios}
        getLabelCargo={getLabelCargo}
        editandoFinancaId={editandoFinancaId}
        editFinancaValor={editFinancaValor}
        setEditFinancaValor={setEditFinancaValor}
        editFinancaVencimento={editFinancaVencimento}
        setEditFinancaVencimento={setEditFinancaVencimento}
        editFinancaRenovacao={editFinancaRenovacao}
        setEditFinancaRenovacao={setEditFinancaRenovacao}
        salvarFinancaFuncionario={salvarFinancaFuncionario}
        setEditandoFinancaId={setEditandoFinancaId}
        formatarData={formatarData}
        iniciarEdicaoFinanca={iniciarEdicaoFinanca}
        desbloquearFuncionario={desbloquearFuncionario}
        isAdminOuDono={isAdminOuDono}
        usuarioLogado={usuarioLogado}
        apagarPagamento={apagarPagamento}
        atualizarVencimentoManual={atualizarVencimentoManual}
        enviarNotificacao={enviarNotificacao}
        AppHeaderBar={AppHeaderBar}
        AppModalNotificacao={AppModalNotificacao}
      />
    );
  }

  // ===== PÁGINA: MINHA CONTA =====
  if (paginaAtual === "minha-conta") {
    return (
      <MinhaContaPage
        supabase={supabase}
        styles={styles}
        theme={theme}
        formatarDataHora={formatarDataHora}
        formatarHorario={formatarHorario}
        calcularDuracao={calcularDuracao}
        formatarData={formatarData}
        formatarHoras={formatarHoras}
        usuarioLogado={usuarioParaInterface}
        layoutPreferido={layoutPreferido}
        setLayoutPreferido={alterarLayoutPreferido}
        meusServicos={meusServicos}
        historicoPonto={historicoPonto}
        minhaContaCarregando={minhaContaCarregando}
        setMinhaContaCarregando={setMinhaContaCarregando}
        buscarMeusServicos={buscarMeusServicos}
        buscarMinhasNotificacoes={buscarMinhasNotificacoes}
        buscarMeusTopClientes={buscarMeusTopClientes}
        buscarHistoricoPonto={buscarHistoricoPonto}
        buscarDadosUsuario={buscarDadosUsuario}
        atualizarSenhaNoBanco={atualizarSenhaNoBanco}
        reportValorSemanal={reportValorSemanal}
        setReportValorSemanal={setReportValorSemanal}
        reportObsSemanal={reportObsSemanal}
        setReportObsSemanal={setReportObsSemanal}
        reportLinkSemanal={reportLinkSemanal}
        setReportLinkSemanal={setReportLinkSemanal}
        reportarPagamentoSemanal={reportarPagamentoSemanal}
        meusTopClientes={meusTopClientes}
        minhasNotificacoes={minhasNotificacoes}
        meusPagamentos={meusPagamentos}
        atualizarComprovanteDossie={atualizarComprovanteDossie}
        AppHeaderBar={AppHeaderBar}
        AppModalNotificacao={AppModalNotificacao}
      />
    );
  }

  // ===== PÁGINA: NOTIFICAÇÕES =====
  if (paginaAtual === "notificacoes") {
    return (
      <NotificacoesPage
        usuarioLogado={usuarioParaInterface}
        styles={styles}
        theme={theme}
        formatarDataHora={formatarDataHora}
        userPodeNotificar={userPodeNotificar}
        setPaginaAtual={setPaginaAtual}
        getNivel={getNivel}
        userRole={userRole}
        CARGOS_HIERARQUIA={CARGOS_HIERARQUIA}
        userIsAdmin={userIsAdmin}
        historicoNotificacoes={historicoNotificacoes}
        usuariosRoleMapa={usuariosRoleMapa}
        userPodeVerRemetente={userPodeVerRemetente}
        notifModoMassa={notifModoMassa}
        setNotifModoMassa={setNotifModoMassa}
        notifIdFuncionario={notifIdFuncionario}
        setNotifIdFuncionario={setNotifIdFuncionario}
        setNotifFuncionarioInfo={setNotifFuncionarioInfo}
        buscarFuncionarioParaNotif={buscarFuncionarioParaNotif}
        notifBuscando={notifBuscando}
        notifFuncionarioInfo={notifFuncionarioInfo}
        getLabelCargo={getLabelCargo}
        notifMensagem={notifMensagem}
        setNotifMensagem={setNotifMensagem}
        notifAnonimo={notifAnonimo}
        setNotifAnonimo={setNotifAnonimo}
        enviarNotificacao={enviarNotificacao}
        notifMassaTodos={notifMassaTodos}
        setNotifMassaTodos={setNotifMassaTodos}
        setNotifMassaNiveis={setNotifMassaNiveis}
        notifMassaNiveis={notifMassaNiveis}
        notifMassaMensagem={notifMassaMensagem}
        setNotifMassaMensagem={setNotifMassaMensagem}
        notifMassaAnonimo={notifMassaAnonimo}
        setNotifMassaAnonimo={setNotifMassaAnonimo}
        enviarNotificacaoMassa={enviarNotificacaoMassa}
        notifMassaEnviando={notifMassaEnviando}
        buscarHistoricoNotificacoes={buscarHistoricoNotificacoes}
        buscarUsuariosComRole={buscarUsuariosComRole}
        apagarNotificacao={apagarNotificacao}
        AppHeaderBar={AppHeaderBar}
        AppModalNotificacao={AppModalNotificacao}
      />
    );
  }

  // ===== PÁGINA: PONTO ADMIN =====
  if (paginaAtual === "ponto-admin") {
    if (!userIsAdmin && !userIsRespPonto) {
      return (
        <div style={styles.dashContainer}>
          <AppHeaderBar />
          <div style={{ padding: "40px", textAlign: "center", color: theme.text }}>
            <h2>🚫 Acesso Negado</h2>
            <button style={{ ...styles.btnPrimary, width: "auto", padding: "12px 28px" }} onClick={() => setPaginaAtual("dashboard")}>Voltar ao Dashboard</button>
          </div>
        </div>
      );
    }
    return (
      <div style={styles.dashContainer}>
        <AppHeaderBar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <PontoAdminPage
            styles={styles}
            theme={theme}
            usuarioLogado={usuarioParaInterface}
            listaFuncionarios={listaFuncionarios}
            importarSessoesParaBanco={importarSessoesParaBanco}
            registrosCidade={registrosCidade}
            registrosSite={historicoPonto}
            registrosCidadeCarregando={registrosCidadeCarregando}
            buscarPontoCidade={buscarPontoCidade}
            formatarDataHora={formatarDataHora}
            calcularDuracao={calcularDuracao}
            atualizarPontoCidade={atualizarPontoCidade}
            deletarPontoCidade={deletarPontoCidade}
            registrosOcultos={registrosOcultos}
            registrosOcultosCarregando={registrosOcultosCarregando}
            buscarPontoCidadeOcultos={buscarPontoCidadeOcultos}
            darEstrelaPonto={darEstrelaPonto}
            apagarPonto={apagarPonto}
            clonarPontoCidadeParaSite={clonarPontoCidadeParaSite}
            filtroNomeInicial={filtroPontoNome}
            setFiltroNomeInicial={setFiltroPontoNome}
            filtroStatusInicial={filtroPontoStatus}
            setFiltroStatusInicial={setFiltroPontoStatus}
            filtroDataIniInicial={filtroPontoDataIni}
            setFiltroDataIniInicial={setFiltroPontoDataIni}
            filtroDataFimInicial={filtroPontoDataFim}
            setFiltroDataFimInicial={setFiltroPontoDataFim}
            buscarHistoricoPonto={buscarHistoricoPonto}
          />
        </main>
      </div>
    );
  }

  // ===== PÁGINA: BANCO DE DADOS =====
  if (paginaAtual === "db-admin") {
    if (!userIsAdmin && !userIsRespPonto) {
      return (
        <div style={styles.dashContainer}>
          <AppHeaderBar />
          <div style={{ padding: "40px", textAlign: "center", color: theme.text }}>
            <h2>🚫 Acesso Negado</h2>
            <button style={{ ...styles.btnPrimary, width: "auto", padding: "12px 28px" }} onClick={() => setPaginaAtual("dashboard")}>Voltar ao Dashboard</button>
          </div>
        </div>
      );
    }
    return (
      <div style={styles.dashContainer}>
        <AppHeaderBar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <DbAdminPage theme={theme} styles={styles} />
        </main>
      </div>
    );
  }

  // ===== PÁGINA: TUNAGENS & REPASSES =====
  if (paginaAtual === "tunagens") {
    return (
      <div style={styles.dashContainer}>
        <AppHeaderBar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <TunagemPage
            theme={theme}
            styles={styles}
            usuarioLogado={usuarioParaInterface}
            notificarTodasTunagens={notificarTodasTunagens}
            toggleNotificarTodasTunagens={toggleNotificarTodasTunagens}
            isAdminOuDono={isAdminOuDono}
            logTunagemParaAbrir={logTunagemParaAbrir}
            setLogTunagemParaAbrir={setLogTunagemParaAbrir}
          />
        </main>
      </div>
    );
  }

  // ===== PÁGINA: BONIFICAÇÃO =====
  if (paginaAtual === "bonificacao") {
    return (
      <div style={styles.dashContainer}>
        <AppHeaderBar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <BonificacaoPage
            theme={theme}
            styles={styles}
            usuarioLogado={usuarioParaInterface}
            listaFuncionarios={listaFuncionarios}
          />
        </main>
      </div>
    );
  }

  // ===== PÁGINA: REGISTRO & AUDITORIA DE ATIVIDADES =====
  if (paginaAtual === "atividades") {
    return (
      <div style={styles.dashContainer}>
        <AppHeaderBar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <AtividadesMecanicosPage
            theme={theme}
            styles={styles}
            usuarioLogado={usuarioParaInterface}
            listaFuncionarios={listaFuncionarios}
          />
        </main>
      </div>
    );
  }

  // ===== PÁGINA: MISSÕES =====
  if (paginaAtual === "missoes") {
    return (
      <div style={styles.dashContainer}>
        <AppHeaderBar />
        <main style={{ flex: 1, overflowY: "auto" }}>
          <MissoesPage
            theme={theme}
            styles={styles}
            usuarioLogado={usuarioParaInterface}
            userIsAdmin={userIsAdmin}
            userRole={userRole}
            missoes={missoes}
            missaoParticipacoes={missaoParticipacoes}
            buscarMissoes={buscarMissoes}
            buscarParticipacoesMissao={buscarParticipacoesMissao}
            registrarParticipacao={registrarParticipacao}
            aprovarParticipacao={aprovarParticipacao}
            deletarParticipacao={deletarParticipacao}
            atualizarProgressoMissao={atualizarProgressoMissao}
            criarMissao={criarMissao}
            editarMissao={editarMissao}
            finalizarMissao={finalizarMissao}
          />
        </main>
      </div>
    );
  }

  // ===== PÁGINA: AVISOS =====
  if (paginaAtual === "avisos") {
    return (
      <div style={styles.dashContainer}>
        <AppModalNotificacao />
        <AppHeaderBar />
        <AvisosPage
          styles={styles}
          theme={theme}
          userPodeEditarAvisos={userPodeEditarAvisos}
          listaAvisos={listaAvisos}
          avisoSendoEditado={avisoSendoEditado}
          setAvisoSendoEditado={setAvisoSendoEditado}
          confirmarEdicaoQuadro={confirmarEdicaoQuadro}
          apagarQuadro={apagarQuadro}
          adicionarNovoQuadro={adicionarNovoQuadro}
          formatarTextoAvisos={formatarTextoAvisos}
          setPaginaAtual={setPaginaAtual}
        />
      </div>
    );
  }

  // ===== PÁGINA: OUVIDORIA =====
  if (paginaAtual === "ouvidoria") {
    return (
      <div style={styles.dashContainer}>
        <AppModalNotificacao />
        <AppHeaderBar />
        <OuvidoriaPage
          styles={styles}
          theme={theme}
          usuarioLogado={usuarioParaInterface}
        />
      </div>
    );
  }

  // ===== PÁGINA: CURSOS =====
  if (paginaAtual === "cursos") {
    return (
      <div style={styles.dashContainer}>
        <AppModalNotificacao />
        <AppHeaderBar />
        <CursosPage
          supabase={supabase}
          styles={styles}
          theme={theme}
          usuarioLogado={usuarioParaInterface}
          listaFuncionarios={listaFuncionarios}
          buscarListaFuncionarios={buscarListaFuncionarios}
          concluirCurso={concluirCurso}
          alterarCursoFuncionario={alterarCursoFuncionario}
          podeGerenciarCursos={userPodeGerenciarCursos()}
          elegibilidadeTunagem={typeof elegibilidadeTunagem !== "undefined" ? elegibilidadeTunagem : {}}
          formatarHoras={typeof formatarHoras !== "undefined" ? formatarHoras : (h => h)}
          getLabelCargo={getLabelCargo}
        />
      </div>
    );
  }

  // ===== PÁGINA: RELATÓRIO PÚBLICO (SEM LOGIN OU PREVIEW) =====
  if (paginaAtual === "relatorio-publico") {
    return (
      <RelatorioPublicoPage
        sharedId={relatorioCompartilhadoId}
        onVoltar={() => setPaginaAtual("relatorio")}
      />
    );
  }

  // ===== PÁGINA: RELATÓRIO =====
  if (paginaAtual === "relatorio") {
    if (!userIsAdmin) {
      return (
        <div style={styles.dashContainer}>
          <AppHeaderBar />
          <div style={{ padding: "40px", textAlign: "center", color: theme.text }}>
            <h2>🚫 Acesso Negado</h2>
            <button style={{ ...styles.btnPrimary, width: "auto", padding: "12px 28px" }} onClick={() => setPaginaAtual("dashboard")}>Voltar ao Dashboard</button>
          </div>
        </div>
      );
    }
    return (
      <div style={styles.dashContainer}>
        <AppHeaderBar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <RelatorioPage
            styles={styles}
            theme={theme}
            usuarioLogado={usuarioParaInterface}
            listaFuncionarios={listaFuncionarios}
            buscarRelatorio={buscarRelatorio}
            registrosRelatorio={registrosRelatorio}
            registrosRelatorioM2={registrosRelatorioM2}
            registrosRelatorioM3={registrosRelatorioM3}
            registrosRelatorioM4={registrosRelatorioM4}
            relatorioCarregando={registrosRelatorioCarregando}
            onVerDetalhesPonto={(nome, ini, fim, status = "todos") => {
              setFiltroPontoNome(nome);
              setFiltroPontoStatus(status);
              setFiltroPontoDataIni(ini);
              setFiltroPontoDataFim(fim);
              setPaginaAtual("ponto-admin");
            }}
          />
        </main>
      </div>
    );
  }

  // ===== PÁGINA: OUTRAS MECÂNICAS =====
  if (paginaAtual === "outras-mecanicas") {
    if (!userIsAdmin) {
      return (
        <div style={styles.dashContainer}>
          <AppHeaderBar />
          <div style={{ padding: "40px", textAlign: "center", color: theme.text }}>
            <h2>🚫 Acesso Negado</h2>
            <button style={{ ...styles.btnPrimary, width: "auto", padding: "12px 28px" }} onClick={() => setPaginaAtual("dashboard")}>Voltar ao Dashboard</button>
          </div>
        </div>
      );
    }
    return (
      <div style={styles.dashContainer}>
        <AppHeaderBar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <OutrasMecanicasPage
            styles={styles}
            theme={theme}
            usuarioLogado={usuarioParaInterface}
          />
        </main>
      </div>
    );
  }

  if (paginaAtual === "nitro-admin") {
    if (!userRole || (!userRole.includes("admin") && !userRole.includes("dono") && !userRole.includes("gerente_geral") && !userRole.includes("financeiro"))) {
      return (
        <div style={styles.dashContainer}>
          <AppHeaderBar />
          <div style={{ padding: "40px", textAlign: "center", color: theme.text }}>
            <h2>🚫 Acesso Negado</h2>
            <button style={{ ...styles.btnPrimary, width: "auto", padding: "12px 28px" }} onClick={() => setPaginaAtual("dashboard")}>Voltar ao Dashboard</button>
          </div>
        </div>
      );
    }
    return (
      <div style={styles.dashContainer}>
        <AppHeaderBar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <ControleVendasPage
            theme={theme}
            usuarioLogado={usuarioParaInterface}
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
          />
        </main>
      </div>
    );
  }
  
  return (
    <div style={styles.dashContainer}>

      <ModalNotificacao />

      <AppHeaderBar />

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* TOP BAR */}


        {/* ===== PÁGINA: BLACKLIST ===== */}
        {paginaAtual === "blacklist" ? (
          <BlacklistPage
            styles={styles}
            theme={theme}
            blacklist={blacklist}
            blacklistCarregando={blacklistCarregando}
            adicionarBlacklist={adicionarBlacklist}
            removerBlacklist={removerBlacklist}
            userNivel={userNivel}
          />
        ) : paginaAtual === "ponto" ? (
          <PontoPage
            styles={styles}
            theme={theme}
            pontoAtivo={pontoAtivo}
            formatarCronometro={formatarCronometro}
            tempoSegundos={tempoSegundos}
            registrarPonto={registrarPonto}
            solicitacoesPendentes={solicitacoesPendentes}
            usuarioLogado={usuarioParaInterface}
            formatarHorario={formatarHorario}
            historicoPonto={historicoPonto}
            formatarData={formatarData}
            formatarDataHora={formatarDataHora}
            calcularDuracao={calcularDuracao}
            editandoPontoId={editandoPontoId}
            setEditandoPontoId={setEditandoPontoId}
            novaSaidaDataInput={novaSaidaDataInput}
            setNovaSaidaDataInput={setNovaSaidaDataInput}
            novaSaidaInput={novaSaidaInput}
            setNovaSaidaInput={setNovaSaidaInput}
            novaSaidaJustificativa={novaSaidaJustificativa}
            setNovaSaidaJustificativa={setNovaSaidaJustificativa}
            userIsRespPonto={userIsRespPonto}
            podeVerTodosPontos={userNivel >= 5}
            solicitarEdicaoSaida={solicitarEdicaoSaida}
            emServico={emServico}
            isAdminOuDono={isAdminOuDono}
            userIsAdmin={userIsAdmin}
            fecharPontoAdmin={fecharPontoAdmin}
            alternarVisibilidadePonto={alternarVisibilidadePonto}
            apagarPonto={apagarPonto}
            buscarHistoricoPonto={buscarHistoricoPonto}
            listaFuncionarios={listaFuncionarios}
          />
        ) : paginaAtual === "bot" ? (
          userIsAdmin ? (
            <BotPage styles={styles} theme={theme} />
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: theme.text }}>
              <h2>🚫 Acesso Negado</h2>
              <button style={{ ...styles.btnPrimary, width: "auto", padding: "12px 28px" }} onClick={() => setPaginaAtual("dashboard")}>Voltar ao Dashboard</button>
            </div>
          )
        ) : paginaAtual === "admin" ? (
          userPodeAdmin ? (
            <AdminPage
              styles={styles}
              theme={theme}
              userIsAdmin={userPodeAdmin}
              novoIdAdmin={novoIdAdmin}
              setNovoIdAdmin={setNovoIdAdmin}
              novoNomeAdmin={novoNomeAdmin}
              setNovoNomeAdmin={setNovoNomeAdmin}
              novoCargoAdmin={novoCargoAdmin}
              setNovoCargoAdmin={setNovoCargoAdmin}
              CARGOS_HIERARQUIA={CARGOS_HIERARQUIA}
              ATRIBUICOES_DISPONIVEIS={ATRIBUICOES_DISPONIVEIS}
              novoCargoAtribuicoes={novoCargoAtribuicoes}
              setNovoCargoAtribuicoes={setNovoCargoAtribuicoes}
              cadastrarMecanico={cadastrarMecanico}
              buscarListaFuncionarios={buscarListaFuncionarios}
              buscaFuncionario={buscaFuncionario}
              setBuscaFuncionario={setBuscaFuncionario}
              listaFuncionarios={listaFuncionarios}
              podeEditarFuncionario={podeEditarFuncionario}
              userRole={userRole}
              editandoFuncionarioId={editandoFuncionarioId}
              editFuncNovoId={editFuncNovoId}
              setEditFuncNovoId={setEditFuncNovoId}
              editFuncNome={editFuncNome}
              setEditFuncNome={setEditFuncNome}
              editFuncTelefone={editFuncTelefone}
              setEditFuncTelefone={setEditFuncTelefone}
              formatarTelefone={formatarTelefone}
              editFuncCargo={editFuncCargo}
              setEditFuncCargo={setEditFuncCargo}
              editFuncStatus={editFuncStatus}
              setEditFuncStatus={setEditFuncStatus}
              editFuncAdmissao={editFuncAdmissao}
              setEditFuncAdmissao={setEditFuncAdmissao}
              editFuncDemissao={editFuncDemissao}
              setEditFuncDemissao={setEditFuncDemissao}
              isAdminOuDono={isAdminOuDono}
              getPrimaryRole={getPrimaryRole}
              editFuncAtribuicoes={editFuncAtribuicoes}
              setEditFuncAtribuicoes={setEditFuncAtribuicoes}
              atualizarFuncionario={atualizarFuncionario}
              setEditandoFuncionarioId={setEditandoFuncionarioId}
              getLabelCargo={getLabelCargo}
              iniciarEdicaoFuncionario={iniciarEdicaoFuncionario}
              periodoDesempenho={periodoDesempenho}
              setPeriodoDesempenho={setPeriodoDesempenho}
              dadosGrafico={dadosGrafico}
              legendaPeriodo={legendaPeriodo}
              usuariosOnline={usuariosOnline}
              emServico={emServico}
              formatarHorario={formatarHorario}
              fecharPontoAdmin={fecharPontoAdmin}
              alternarVisibilidadePonto={alternarVisibilidadePonto}
              apagarPonto={apagarPonto}
              usuarioLogado={usuarioParaInterface}
              ranking={ranking}
              periodoRankingClientes={periodoRankingClientes}
              setPeriodoRankingClientes={setPeriodoRankingClientes}
              rankingClientes={rankingClientes}
              SeletorPeriodo={SeletorPeriodo}
            />
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: theme.text }}>
              <h2>🚫 Acesso Negado</h2>
              <button style={{ ...styles.btnPrimary, width: "auto", padding: "12px 28px" }} onClick={() => setPaginaAtual("dashboard")}>Voltar ao Dashboard</button>
            </div>
          )
        ) : (
          <DashboardPage
            styles={styles}
            theme={theme}
            passaporte={passaporte}
            setPassaporte={setPassaporte}
            cliente={cliente}
            setCliente={setCliente}
            nomeMecanico={nomeMecanico}
            setNomeMecanico={setNomeMecanico}
            autorizadoPor={autorizadoPor}
            setAutorizadoPor={setAutorizadoPor}
            camaleao1={camaleao1}
            setCamaleao1={setCamaleao1}
            camaleao2={camaleao2}
            setCamaleao2={setCamaleao2}
            camaleaoRodas={camaleaoRodas}
            setCamaleaoRodas={setCamaleaoRodas}
            quantidadeExtras={quantidadeExtras}
            setQuantidadeExtras={setQuantidadeExtras}
            fumaca={fumaca}
            setFumaca={setFumaca}
            valorDigitadoEstetica={valorDigitadoEstetica}
            setValorDigitadoEstetica={setValorDigitadoEstetica}
            formatarNumero={formatarNumero}
            limparNumero={limparNumero}
            imagemPreview={imagemPreview}
            handleFileChange={handleFileChange}
            handlePasteEstetica={handlePasteEstetica}
            imagemPreview2={imagemPreview2}
            handleFileChange2={handleFileChange2}
            handlePasteEstetica2={handlePasteEstetica2}
            kmGuincho={kmGuincho}
            setKmGuincho={setKmGuincho}
            qtdReparos={qtdReparos}
            setQtdReparos={setQtdReparos}
            qtdPneus={qtdPneus}
            setQtdPneus={setQtdPneus}
            reboque={reboque}
            setReboque={setReboque}
            reportBugs={reportBugs}
            setReportBugs={setReportBugs}
            nomeVeiculoBugs={nomeVeiculoBugs}
            setNomeVeiculoBugs={setNomeVeiculoBugs}
            descricaoBug={descricaoBug}
            setDescricaoBug={setDescricaoBug}
            previewBugs={previewBugs}
            handleFileBugs={handleFileBugs}
            handlePasteBugs={handlePasteBugs}
            tabelas={tabelas}
            servicosSelecionados={servicosSelecionados}
            setServicosSelecionados={setServicosSelecionados}
            userPodeFinancas={userPodeFinancas}
            adicionarNovoQuadro={adicionarNovoQuadro}
            listaAvisos={listaAvisos}
            avisoSendoEditado={avisoSendoEditado}
            setAvisoSendoEditado={setAvisoSendoEditado}
            confirmarEdicaoQuadro={confirmarEdicaoQuadro}
            apagarQuadro={apagarQuadro}
            formatarTextoAvisos={formatarTextoAvisos}
            calcularTotal={calcularTotal}
            enviarParaDiscord={enviarParaDiscord}
            salvandoServico={salvandoServico}
            historicoNitroRecente={historicoNitroRecente}
            formatarHorario={formatarHorario}
            formatarDataHora={formatarDataHora}
            isDarkMode={isDarkMode}
            blacklist={blacklist}
            layoutPreferido={layoutPreferido}
            usuarioLogado={usuarioParaInterface}
            setImagemPreview={setImagemPreview}
            setArquivoImagem={setArquivoImagem}
            setImagemPreview2={setImagemPreview2}
            setArquivoImagem2={setArquivoImagem2}
            tunagemRealtimeGlobal={tunagemRealtimeGlobal}
            logSelecionadoUuid={logSelecionadoUuid}
            setLogSelecionadoUuid={setLogSelecionadoUuid}
          />
        )}
      </main>
    </div>
  );
}
export default MainSite;
