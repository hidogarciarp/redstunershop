import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../../utils/supabaseClient";
import ModalDetalheTunagem from "../ModalDetalheTunagem";

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

const parseDiscordPontoMessage = (content, createdAt, embedData) => {
  if (!content) return null;
  const isEntrou = content.includes("ENTROU EM SERVIÇO");
  const isSaiu = content.includes("SAIU DE SERVIÇO");
  if (!isEntrou && !isSaiu) return null;

  const regexIdNomeOficina = /\[ID\]:\s*(\d+)\s+([^(]+?)\s*\(\s*(?:ENTROU\s+EM|SAIU\s+DE)\s+SERVIÇO\s*-\s*([^)]+)\)/i;
  const match = content.match(regexIdNomeOficina);

  let idJogo = "";
  let nome = "";
  let tipo = isEntrou ? "entrada" : "saida";
  let oficina = "Red's Tunershop";

  if (match) {
    idJogo = match[1].trim();
    nome = match[2].trim();
    oficina = match[3].trim();
  } else {
    const idMatch = content.match(/\[ID\]:\s*(\d+)/i);
    if (idMatch) idJogo = idMatch[1].trim();
    const nomeMatch = content.match(/\[ID\]:\s*\d+\s+([^(]+)/i);
    if (nomeMatch) nome = nomeMatch[1].trim();
    const ofcMatch = content.match(/-\s*([^)]+)\)/i);
    if (ofcMatch) oficina = ofcMatch[1].trim();
  }

  const dataMatch = content.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}:\d{2})/i);
  let timestamp = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();

  if (dataMatch) {
    const [_, dataStr, horaStr] = dataMatch;
    const [dia, mes, ano] = dataStr.split("/");
    timestamp = new Date(`${ano}-${mes}-${dia}T${horaStr}-03:00`).toISOString();
  }

  const uuidMatch = content.match(/\[UUID\]:\s*([a-f0-9-]+)/i);
  const uuid = uuidMatch ? uuidMatch[1].trim() : null;

  const ofcLower = (oficina || "").toLowerCase();
  let oficinaId = "outras";
  if (ofcLower.includes("red")) oficinaId = "reds";
  else if (ofcLower.includes("beach") || ofcLower.includes("vespucci")) oficinaId = "vespucci";
  else if (ofcLower.includes("harmony")) oficinaId = "harmony";
  else if (ofcLower.includes("dudark") || ofcLower.includes("salt") || ofcLower.includes("lab")) oficinaId = "dudark";

  let motivoCrash = null;
  let justificativa = null;
  let comprovanteImg = null;
  let fechadoPor = null;

  if (embedData) {
    const dataObj = Array.isArray(embedData) ? embedData[0] : embedData;
    if (dataObj && (dataObj.motivo === "crash" || dataObj.tipo_fechamento === "manual_crash")) {
      motivoCrash = "crash";
      justificativa = dataObj.justificativa;
      comprovanteImg = dataObj.imagem_comprovante;
      fechadoPor = dataObj.fechado_por_nome;
    }
  }

  if (!motivoCrash && content.includes("[MOTIVO_CRASH]:")) {
    const motMatch = content.match(/\[MOTIVO_CRASH\]:\s*([^\n\r]+)/i);
    if (motMatch) {
      motivoCrash = "crash";
      justificativa = motMatch[1].trim();
    }
    const fechMatch = content.match(/\[FECHADO_POR\]:\s*([^\n\r]+)/i);
    if (fechMatch) fechadoPor = fechMatch[1].trim();
  }

  return { idJogo, nome, tipo, oficina, oficinaId, timestamp, uuid, motivoCrash, justificativa, comprovanteImg, fechadoPor };
};

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
  const [pontosAbertosAoVivo, setPontosAbertosAoVivo] = useState([]);
  const [pontoSelecionadoAuditoria, setPontoSelecionadoAuditoria] = useState(null);
  const [carregandoAtividadesPonto, setCarregandoAtividadesPonto] = useState(false);
  const [atividadesPontoSelecionado, setAtividadesPontoSelecionado] = useState(null);
  const [modalLogTunagemDetalhe, setModalLogTunagemDetalhe] = useState(null);
  const [abaAtividadeModal, setAbaAtividadeModal] = useState("todas");

  const abrirHistoricoPeriodo = async (ponto) => {
    if (!ponto) return;
    setPontoSelecionadoAuditoria(ponto);
    setCarregandoAtividadesPonto(true);
    setAtividadesPontoSelecionado(null);
    setAbaAtividadeModal("todas");

    const entTs = ponto.entrada ? new Date(ponto.entrada).getTime() : 0;
    const saiTs = ponto.saida ? new Date(ponto.saida).getTime() : Date.now();
    const dataDiaStr = ponto.data || (ponto.entrada ? ponto.entrada.substring(0, 10) : "");

    try {
      // 1. Logs de tunagem
      let logsTunagem = [];
      try {
        let queryTunReds = supabase
          .from("logs_tunagem_reds")
          .select("*")
          .gte("data", dataDiaStr)
          .lte("data", ponto.saida ? new Date(saiTs).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : dataDiaStr);

        if (ponto.id_jogo) {
          queryTunReds = queryTunReds.or(`tecnico_id.eq.${ponto.id_jogo},tecnico_nome.ilike.%${ponto.nome || ""}%`);
        } else if (ponto.nome) {
          queryTunReds = queryTunReds.ilike("tecnico_nome", `%${ponto.nome}%`);
        }

        const { data: dataTunReds } = await queryTunReds;
        if (dataTunReds && dataTunReds.length > 0) {
          logsTunagem = dataTunReds;
        } else {
          let queryTunGeral = supabase
            .from("logs_tunagem")
            .select("*")
            .gte("data", dataDiaStr)
            .lte("data", ponto.saida ? new Date(saiTs).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : dataDiaStr);

          if (ponto.id_jogo) {
            queryTunGeral = queryTunGeral.or(`tecnico_id.eq.${ponto.id_jogo},tecnico_nome.ilike.%${ponto.nome || ""}%`);
          } else if (ponto.nome) {
            queryTunGeral = queryTunGeral.ilike("tecnico_nome", `%${ponto.nome}%`);
          }
          const { data: dataTunGeral } = await queryTunGeral;
          logsTunagem = dataTunGeral || [];
        }
      } catch (e) {
        logsTunagem = [];
      }

      const tunagensNoPeriodo = (logsTunagem || [])
        .filter((t) => {
          if (!t.data || !t.hora) return false;
          try {
            const dtStr = `${t.data}T${t.hora}-03:00`;
            const dt = new Date(dtStr).getTime();
            return dt >= entTs - 60000 && dt <= saiTs + 60000;
          } catch (e) {
            return false;
          }
        })
        .map((t) => ({
          ...t,
          tipo: "tunagem",
          hora: t.hora || ""
        }));

      // 2. Logs de Bancada (discord_log_messages)
      const lookbackMargemIni = new Date(entTs - 2 * 60000).toISOString();
      const lookbackMargemFim = new Date(saiTs + 2 * 60000).toISOString();

      const { data: logsBancada } = await supabase
        .from("discord_log_messages")
        .select("*")
        .eq("log_type", "bancada")
        .gte("created_at", lookbackMargemIni)
        .lte("created_at", lookbackMargemFim)
        .order("id", { ascending: true });

      const bancadaItens = [];
      (logsBancada || []).forEach((msg) => {
        const c = msg.content || "";
        const idStr = String(ponto.id_jogo || "");
        const matchId = idStr && (c.includes(`[ID]: ${idStr}`) || c.includes(`ID]: ${idStr}`) || c.match(new RegExp(`\\[ID\\]:\\s*${idStr}\\b`, "i")));
        const matchNome = ponto.nome && c.toLowerCase().includes(ponto.nome.toLowerCase());

        if (matchId || matchNome) {
          const itemMatch = c.match(/\[(?:ITEMNAME|ITEM|ITEMKEY)\]:\s*([^\n\r]+)/i);
          const qtdMatch = c.match(/\[(?:QUANTIDADE|QTD)\]:\s*(\d+)/i);
          const precoMatch = c.match(/\[(?:PRICE|VALOR|PRE[ÇC]O)\]:\s*([^\n\r]+)/i);
          const acaoMatch = c.match(/\[A[ÇC][ÃA]O\]:\s*([^\n\r]+)/i);
          const horaMatch = c.match(/\[DATA\]:\s*\d{2}\/\d{2}\/\d{4},\s*(\d{2}:\d{2}:\d{2})/i);
          const horaStr = horaMatch ? horaMatch[1] : new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

          let precoFormatado = precoMatch ? precoMatch[1].trim() : "0";
          if (!precoFormatado.startsWith("$") && !precoFormatado.startsWith("R$")) {
            precoFormatado = `$${precoFormatado}`;
          }

          bancadaItens.push({
            tipo: "bancada",
            item: itemMatch ? itemMatch[1].trim() : "Item de Bancada",
            qtd: qtdMatch ? qtdMatch[1].trim() : "1",
            preco: precoFormatado,
            acao: acaoMatch ? acaoMatch[1].trim() : "compra",
            hora: horaStr,
            rawLog: c
          });
        }
      });

      // 3. Logs de Baú (discord_log_messages)
      const { data: logsBau } = await supabase
        .from("discord_log_messages")
        .select("*")
        .eq("log_type", "bau")
        .gte("created_at", lookbackMargemIni)
        .lte("created_at", lookbackMargemFim)
        .order("id", { ascending: true });

      const bauItens = [];
      (logsBau || []).forEach((msg) => {
        const c = msg.content || "";
        const idStr = String(ponto.id_jogo || "");
        const matchId = idStr && (c.includes(`[ID]: ${idStr}`) || c.includes(`ID]: ${idStr}`) || c.match(new RegExp(`\\[ID\\]:\\s*${idStr}\\b`, "i")));
        const matchNome = ponto.nome && c.toLowerCase().includes(ponto.nome.toLowerCase());

        if (matchId || matchNome) {
          const retMatch = c.match(/\[RETIROU\]:\s*([^\n\r]+)/i);
          const colMatch = c.match(/\[COLOCOU\]:\s*([^\n\r]+)/i);
          const horaMatch = c.match(/\[DATA\]:\s*\d{2}\/\d{2}\/\d{4},\s*(\d{2}:\d{2}:\d{2})/i);
          const horaStr = horaMatch ? horaMatch[1] : new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

          if (retMatch) {
            bauItens.push({ tipo: "bau", acao: "Retirou", item: retMatch[1].trim(), hora: horaStr, rawLog: c });
          }
          if (colMatch) {
            bauItens.push({ tipo: "bau", acao: "Colocou", item: colMatch[1].trim(), hora: horaStr, rawLog: c });
          }
        }
      });

      setAtividadesPontoSelecionado({
        tunagens: tunagensNoPeriodo,
        bancada: bancadaItens,
        bau: bauItens
      });
    } catch (err) {
      console.error("Erro ao carregar atividades do período:", err);
      setAtividadesPontoSelecionado({ tunagens: [], bancada: [], bau: [] });
    } finally {
      setCarregandoAtividadesPonto(false);
    }
  };

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

      let lookbackDiscordMs = 72 * 60 * 60 * 1000;
      if (inicioBusca) {
        const msInicio = new Date(`${inicioBusca}T00:00:00-03:00`).getTime();
        if (!isNaN(msInicio) && Date.now() - msInicio > lookbackDiscordMs) {
          lookbackDiscordMs = Date.now() - msInicio + 24 * 60 * 60 * 1000;
        }
      }
      const lookbackDiscord = new Date(Date.now() - Math.min(lookbackDiscordMs, 7 * 24 * 60 * 60 * 1000)).toISOString();

      let queryDiscord = supabase
        .from("discord_log_messages")
        .select("*")
        .eq("log_type", "ponto")
        .gte("created_at", lookbackDiscord)
        .order("id", { ascending: true })
        .limit(2000);

      let queryAtividades = supabase
        .from("discord_log_messages")
        .select("id, log_type, content, created_at")
        .in("log_type", ["bancada", "bau"])
        .gte("created_at", lookbackDiscord)
        .order("id", { ascending: true })
        .limit(2000);

      let queryTunagemRecente = supabase
        .from("logs_tunagem_reds")
        .select("tecnico_id, tecnico_nome, data, hora")
        .gte("data", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split("T")[0]);

      const [
        { data: dataAud, error: errAud },
        { data: dataCid, error: errCid },
        { data: dataDiscord, error: errDiscord },
        { data: dataAtivs },
        { data: dataTun }
      ] = await Promise.all([
        queryAuditoria,
        queryCidade,
        queryDiscord,
        queryAtividades,
        queryTunagemRecente
      ]);

      if (errAud) console.warn("Aviso ao buscar sessoes_ponto_auditoria_reds:", errAud);
      if (errCid) console.warn("Aviso ao buscar ponto_cidade_reds:", errCid);
      if (errDiscord) console.warn("Aviso ao buscar discord_log_messages ponto:", errDiscord);

      // Mapeia atividades de mecânicos para detecção de inatividade / auto-fechamento
      const mapaAtividadesMecanico = {};
      (dataAtivs || []).forEach((msg) => {
        const c = msg.content || "";
        const idMatch = c.match(/\[ID\]:\s*(\d+)/i);
        let ts = msg.created_at;
        const dataMatch = c.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}:\d{2})/i);
        if (dataMatch) {
          const [_, dStr, hStr] = dataMatch;
          const [dia, mes, ano] = dStr.split("/");
          ts = new Date(`${ano}-${mes}-${dia}T${hStr}-03:00`).toISOString();
        }
        if (idMatch) {
          const id = idMatch[1].trim();
          if (!mapaAtividadesMecanico[id]) mapaAtividadesMecanico[id] = [];
          mapaAtividadesMecanico[id].push(new Date(ts).getTime());
        }
      });

      (dataTun || []).forEach((t) => {
        if (t.tecnico_id && t.data && t.hora) {
          const id = String(t.tecnico_id).trim();
          const ts = new Date(`${t.data}T${t.hora}-03:00`).getTime();
          if (!isNaN(ts)) {
            if (!mapaAtividadesMecanico[id]) mapaAtividadesMecanico[id] = [];
            mapaAtividadesMecanico[id].push(ts);
          }
        }
      });

      Object.values(mapaAtividadesMecanico).forEach((arr) => arr.sort((a, b) => a - b));

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

      // Processar eventos em tempo real vindos diretamente do Discord (últimos dias)
      const mapaMecanicos = {};
      (dataDiscord || []).forEach((msg) => {
        const parsed = parseDiscordPontoMessage(msg.content, msg.created_at, msg.embed_data);
        if (!parsed || !parsed.idJogo) return;
        if (parsed.oficinaId && parsed.oficinaId !== "reds") return;

        if (!mapaMecanicos[parsed.idJogo]) {
          mapaMecanicos[parsed.idJogo] = {
            idJogo: parsed.idJogo,
            nome: parsed.nome,
            eventos: []
          };
        }
        mapaMecanicos[parsed.idJogo].nome = parsed.nome || mapaMecanicos[parsed.idJogo].nome;
        mapaMecanicos[parsed.idJogo].eventos.push(parsed);
      });

      const sessoesFechadasRealtime = [];
      const sessoesAbertasRealtime = [];

      Object.values(mapaMecanicos).forEach((mec) => {
        const evs = [...mec.eventos].sort((a, b) => {
          const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          if (diff !== 0) return diff;
          // Se mesmo timestamp exato: SAIU fecha a sessão anterior antes de novo ENTROU
          if (a.tipo === "saida" && b.tipo === "entrada") return -1;
          if (a.tipo === "entrada" && b.tipo === "saida") return 1;
          return 0;
        });

        let pontoAtual = null;

        evs.forEach((ev) => {
          if (ev.tipo === "entrada") {
            if (pontoAtual) {
              const diffMs = new Date(ev.timestamp) - new Date(pontoAtual.entrada);
              pontoAtual.saida = ev.timestamp;
              pontoAtual.duracaoMin = Math.max(1, Math.round(diffMs / 60000));
              sessoesFechadasRealtime.push(pontoAtual);
            }
            pontoAtual = {
              idJogo: mec.idJogo,
              nome: mec.nome,
              oficina: ev.oficina,
              oficinaId: ev.oficinaId,
              entrada: ev.timestamp,
              uuidEntrada: ev.uuid,
              saida: null,
              uuidSaida: null,
              duracaoMin: 0,
              motivoCrash: null,
              justificativa: null,
              comprovanteImg: null,
              fechadoPor: null
            };
          } else if (ev.tipo === "saida") {
            if (pontoAtual) {
              const diffMs = new Date(ev.timestamp) - new Date(pontoAtual.entrada);
              pontoAtual.saida = ev.timestamp;
              pontoAtual.uuidSaida = ev.uuid;
              pontoAtual.duracaoMin = Math.max(1, Math.round(diffMs / 60000));
              pontoAtual.motivoCrash = ev.motivoCrash;
              pontoAtual.justificativa = ev.justificativa;
              pontoAtual.comprovanteImg = ev.comprovanteImg;
              pontoAtual.fechadoPor = ev.fechadoPor;
              sessoesFechadasRealtime.push(pontoAtual);
              pontoAtual = null;
            } else {
              sessoesFechadasRealtime.push({
                idJogo: mec.idJogo,
                nome: mec.nome,
                oficina: ev.oficina,
                oficinaId: ev.oficinaId,
                entrada: ev.timestamp,
                uuidEntrada: null,
                saida: ev.timestamp,
                uuidSaida: ev.uuid,
                duracaoMin: 1,
                motivoCrash: ev.motivoCrash,
                justificativa: ev.justificativa,
                comprovanteImg: ev.comprovanteImg,
                fechadoPor: ev.fechadoPor
              });
            }
          }
        });

        if (pontoAtual && !pontoAtual.saida) {
          const entMs = new Date(pontoAtual.entrada).getTime();
          const ativs = mapaAtividadesMecanico[mec.idJogo] || [];
          const ativsNaSessao = ativs.filter((ts) => ts >= entMs);
          const agoraMs = Date.now();
          const ultAtivMs = ativsNaSessao.length > 0 ? ativsNaSessao[ativsNaSessao.length - 1] : entMs;
          const tempoSemAtividade = agoraMs - ultAtivMs;

          // Se está há mais de 60 minutos sem nenhuma atividade registrada:
          // O mecânico saiu do jogo sem bater /ponto ou crashou/duplo clique acidental
          const isAbandonadoOuInativo = tempoSemAtividade >= 60 * 60 * 1000;

          if (isAbandonadoOuInativo) {
            if (ativsNaSessao.length > 0) {
              pontoAtual.saida = new Date(ultAtivMs).toISOString();
              pontoAtual.duracaoMin = Math.max(1, Math.round((ultAtivMs - entMs) / 60000));
              pontoAtual.observacao = `Encerrado por inatividade (> 60 min sem movimentação).`;
              sessoesFechadasRealtime.push(pontoAtual);
            } else {
              pontoAtual.saida = new Date(entMs + 60000).toISOString();
              pontoAtual.duracaoMin = 1;
              pontoAtual.observacao = `Duplo clique / Inativo (> 60 min sem ações).`;
              sessoesFechadasRealtime.push(pontoAtual);
            }
          } else {
            // Ponto realmente em andamento!
            sessoesAbertasRealtime.push({
              id: pontoAtual.uuidEntrada || `ao_vivo_${pontoAtual.idJogo}_${pontoAtual.entrada}`,
              id_jogo: pontoAtual.idJogo,
              usuario_id: pontoAtual.idJogo,
              nome: pontoAtual.nome,
              entrada: pontoAtual.entrada,
              oficina: pontoAtual.oficina,
              oficinaId: pontoAtual.oficinaId,
              status_ponto: "aberto"
            });
          }
        }
      });

      setPontosAbertosAoVivo(sessoesAbertasRealtime);

      sessoesFechadasRealtime.forEach((sessao) => {
        if (inicioBusca && sessao.entrada < `${inicioBusca}T00:00:00.000Z`) return;
        if (fimBusca && sessao.entrada > `${fimBusca}T23:59:59.999Z`) return;

        const jaExiste = Array.from(mapa.values()).some((s) => {
          if (sessao.uuidEntrada && (s.uuid_sessao === sessao.uuidEntrada || s.uuid_entrada === sessao.uuidEntrada)) {
            return true;
          }
          const mesmoId = String(s.id_jogo || s.usuario_id || "") === String(sessao.idJogo);
          if (!mesmoId) return false;
          const entS = new Date(s.entrada).getTime();
          const entNova = new Date(sessao.entrada).getTime();
          return Math.abs(entS - entNova) < 120000;
        });

        if (!jaExiste) {
          let dataStr = "";
          try {
            dataStr = new Date(sessao.entrada).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          } catch (e) {
            dataStr = sessao.entrada ? sessao.entrada.substring(0, 10) : "";
          }

          const key = `discord_${sessao.idJogo}_${sessao.entrada}`;
          mapa.set(key, {
            id: sessao.uuidEntrada || key,
            uuid_sessao: sessao.uuidEntrada,
            origem: "discord_realtime",
            data: dataStr,
            id_jogo: sessao.idJogo,
            nome: sessao.nome,
            entrada: sessao.entrada,
            saida: sessao.saida,
            duracao_min: sessao.duracaoMin,
            status_ponto: "normal",
            observacao: sessao.justificativa || sessao.motivoCrash || null,
            motivo_crash: sessao.motivoCrash || null,
            comprovante_img: sessao.comprovanteImg || null
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

  const handleFecharPontoAoVivo = async (ponto) => {
    const confirmar = window.confirm(`Deseja realmente encerrar o ponto de ${ponto.nome}?`);
    if (!confirmar) return;

    try {
      const agoraISO = new Date().toISOString();
      const dataDiaStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      if (typeof ponto.id === "number") {
        await fecharPontoAdmin(ponto.id);
      } else {
        const durMin = Math.max(1, Math.round((Date.now() - new Date(ponto.entrada).getTime()) / 60000));
        await supabase.from("ponto_horas").insert([
          {
            nome: ponto.nome,
            usuario_id: ponto.usuario_id || ponto.id_jogo,
            data_ponto: dataDiaStr,
            entrada: ponto.entrada,
            saida: agoraISO,
            duracao_minutos: durMin,
            verificado: true,
            verificado_por: usuarioLogado?.nome || "Admin"
          }
        ]);

        if (ponto.id_jogo) {
          await supabase
            .from("ponto_cidade_reds")
            .update({ saida: agoraISO })
            .eq("id_jogo", String(ponto.id_jogo))
            .is("saida", null);
        }
      }

      alert("✅ Ponto encerrado com sucesso!");
      await carregarSessoes();
    } catch (err) {
      console.error("Erro ao fechar ponto ao vivo:", err);
      alert("❌ Ocorreu um erro ao encerrar o ponto.");
    }
  };

  useEffect(() => {
    carregarSessoes();
  }, [carregarSessoes]);

  useEffect(() => {
    const canal = supabase
      .channel("ponto-page-discord-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "discord_log_messages",
          filter: "log_type=eq.ponto",
        },
        () => {
          carregarSessoes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
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

  const emServicoVisivel = useMemo(() => {
    const lista = [...pontosAbertosAoVivo];
    (emServico || []).forEach((p) => {
      const pId = String(p.id_jogo || p.usuario_id || p.id || "");
      if (pId && !lista.some((x) => String(x.id_jogo || x.usuario_id || x.id || "") === pId)) {
        lista.push(p);
      }
    });
    return (podeVerTodosPontos ? lista : lista.filter(pertenceAoUsuario))
      .filter((p) => !p.oculto || isAdminOuDono(usuarioLogado?.role || ""));
  }, [podeVerTodosPontos, pontosAbertosAoVivo, emServico, pertenceAoUsuario, isAdminOuDono, usuarioLogado?.role]);

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
                <div
                  key={reg.id || reg.uuid_sessao}
                  onClick={() => abrirHistoricoPeriodo(reg)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    marginBottom: "10px",
                    border: `1px solid ${theme.border}`,
                    background: "rgba(255, 255, 255, 0.02)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                    e.currentTarget.style.borderColor = theme.border;
                  }}
                  title="Clique para ver o histórico e atividades deste período"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
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

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap" }}>
                      <span style={{
                        color: isAberta ? "#22c55e" : durMin >= 30 ? "#22c55e" : theme.accent,
                        fontWeight: "700",
                        fontSize: "13px"
                      }}>
                        {duracaoStr}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirHistoricoPeriodo(reg);
                        }}
                        style={{
                          background: "rgba(56, 189, 248, 0.12)",
                          color: "#38bdf8",
                          border: "1px solid rgba(56, 189, 248, 0.3)",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "700",
                          whiteSpace: "nowrap",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title="Ver atividades realizadas durante este período"
                      >
                        🔍 Ver Histórico
                      </button>
                      {editandoPontoId !== reg.id && (pertenceAoUsuario(reg) || userIsRespPonto) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditandoPontoId(reg.id);
                            setNovaSaidaDataInput(dataRegStr);
                            setNovaSaidaInput(reg.saida ? new Date(reg.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "");
                            setNovaSaidaJustificativa("");
                          }}
                          style={{ background: "#1e40af20", color: "#60a5fa", border: "1px solid #1e40af", padding: "4px 9px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}
                        >
                          ✏️ Editar Saída
                        </button>
                      )}
                    </div>
                  </div>

                  {editandoPontoId === reg.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: "10px", background: theme.card2, borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}
                    >
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
                        onClick={() => handleFecharPontoAoVivo(p)}
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

      {/* Modal de Histórico e Atividades do Período */}
      {pontoSelecionadoAuditoria && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setPontoSelecionadoAuditoria(null)}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1.5px solid rgba(56, 189, 248, 0.4)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "740px",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.2)",
              overflow: "hidden",
              color: "#fff"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "18px" }}>🔍</span>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#f8fafc" }}>
                    Histórico do Período: {pontoSelecionadoAuditoria.nome}
                  </h3>
                  {pontoSelecionadoAuditoria.id_jogo && (
                    <span
                      style={{
                        background: "rgba(56, 189, 248, 0.2)",
                        border: "1px solid #38bdf8",
                        color: "#38bdf8",
                        fontSize: "11px",
                        fontFamily: "monospace",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: "700"
                      }}
                    >
                      ID: {pontoSelecionadoAuditoria.id_jogo}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "800",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: (pontoSelecionadoAuditoria.duracao_min || 0) >= 30 ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      color: (pontoSelecionadoAuditoria.duracao_min || 0) >= 30 ? "#4ade80" : "#fca5a5",
                      border: `1px solid ${(pontoSelecionadoAuditoria.duracao_min || 0) >= 30 ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`
                    }}
                  >
                    ⏱️ {pontoSelecionadoAuditoria.duracao_min || 0} min
                  </span>
                </div>

                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  📅 {formatarData(pontoSelecionadoAuditoria.data || pontoSelecionadoAuditoria.entrada)} · 🕒 Entrada:{" "}
                  <strong style={{ color: "#f1f5f9" }}>{formatarHorario(pontoSelecionadoAuditoria.entrada)}</strong> → Saída:{" "}
                  <strong style={{ color: "#f1f5f9" }}>{pontoSelecionadoAuditoria.saida ? formatarHorario(pontoSelecionadoAuditoria.saida) : "Em andamento"}</strong>
                </div>
              </div>

              <button
                onClick={() => setPontoSelecionadoAuditoria(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  color: "#94a3b8",
                  borderRadius: "8px",
                  width: "32px",
                  height: "32px",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ✕
              </button>
            </div>

            {/* Conteúdo */}
            <div style={{ padding: "18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Alerta de Infração < 30min */}
              {(pontoSelecionadoAuditoria.duracao_min !== undefined && pontoSelecionadoAuditoria.duracao_min < 30 && pontoSelecionadoAuditoria.saida) && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1.5px solid #ef4444",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px"
                  }}
                >
                  <span style={{ fontSize: "20px" }}>🚨</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#fca5a5" }}>
                      Turno curto: Menos de 30 minutos ({pontoSelecionadoAuditoria.duracao_min} min)
                    </div>
                    <div style={{ fontSize: "11px", color: "#fecaca" }}>
                      Histórico detalhado de atividades registradas pelo funcionário neste intervalo:
                    </div>
                  </div>
                </div>
              )}

              {/* Observação / Justificativa / Crash se houver */}
              {(pontoSelecionadoAuditoria.observacao || pontoSelecionadoAuditoria.justificativa || pontoSelecionadoAuditoria.motivo_crash) && (
                <div
                  style={{
                    background: "rgba(234, 179, 8, 0.12)",
                    border: "1px solid rgba(234, 179, 8, 0.4)",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    fontSize: "12px",
                    color: "#fef08a"
                  }}
                >
                  📝 <strong>Observação:</strong> {pontoSelecionadoAuditoria.observacao || pontoSelecionadoAuditoria.justificativa || pontoSelecionadoAuditoria.motivo_crash}
                </div>
              )}

              {carregandoAtividadesPonto ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
                  <div style={{ fontSize: "13px", fontWeight: "700" }}>Buscando atividades registradas no período...</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    Consultando logs de tunagem, bancada e movimentações de baú.
                  </div>
                </div>
              ) : atividadesPontoSelecionado && (
                <>
                  {(() => {
                    const totalTun = atividadesPontoSelecionado.tunagens.length;
                    const totalBan = atividadesPontoSelecionado.bancada.length;
                    const totalBau = atividadesPontoSelecionado.bau.length;
                    const totalGeral = totalTun + totalBan + totalBau;

                    return (
                      <>
                        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px", flexWrap: "wrap" }}>
                          <button
                            onClick={() => setAbaAtividadeModal("todas")}
                            style={{
                              background: abaAtividadeModal === "todas" ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${abaAtividadeModal === "todas" ? "#38bdf8" : "rgba(255,255,255,0.1)"}`,
                              color: abaAtividadeModal === "todas" ? "#38bdf8" : "#94a3b8",
                              padding: "5px 12px",
                              borderRadius: "7px",
                              fontSize: "12px",
                              fontWeight: "800",
                              cursor: "pointer"
                            }}
                          >
                            Todas ({totalGeral})
                          </button>
                          <button
                            onClick={() => setAbaAtividadeModal("tunagens")}
                            style={{
                              background: abaAtividadeModal === "tunagens" ? "rgba(34, 197, 94, 0.2)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${abaAtividadeModal === "tunagens" ? "#22c55e" : "rgba(255,255,255,0.1)"}`,
                              color: abaAtividadeModal === "tunagens" ? "#4ade80" : "#94a3b8",
                              padding: "5px 12px",
                              borderRadius: "7px",
                              fontSize: "12px",
                              fontWeight: "800",
                              cursor: "pointer"
                            }}
                          >
                            🚗 Tunagens ({totalTun})
                          </button>
                          <button
                            onClick={() => setAbaAtividadeModal("bancada")}
                            style={{
                              background: abaAtividadeModal === "bancada" ? "rgba(168, 85, 247, 0.2)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${abaAtividadeModal === "bancada" ? "#a855f7" : "rgba(255,255,255,0.1)"}`,
                              color: abaAtividadeModal === "bancada" ? "#c084fc" : "#94a3b8",
                              padding: "5px 12px",
                              borderRadius: "7px",
                              fontSize: "12px",
                              fontWeight: "800",
                              cursor: "pointer"
                            }}
                          >
                            🧰 Bancada ({totalBan})
                          </button>
                          <button
                            onClick={() => setAbaAtividadeModal("bau")}
                            style={{
                              background: abaAtividadeModal === "bau" ? "rgba(245, 158, 11, 0.2)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${abaAtividadeModal === "bau" ? "#f59e0b" : "rgba(255,255,255,0.1)"}`,
                              color: abaAtividadeModal === "bau" ? "#fbbf24" : "#94a3b8",
                              padding: "5px 12px",
                              borderRadius: "7px",
                              fontSize: "12px",
                              fontWeight: "800",
                              cursor: "pointer"
                            }}
                          >
                            📦 Baú ({totalBau})
                          </button>
                        </div>

                        {totalGeral === 0 && (
                          <div style={{ padding: "30px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: "26px", marginBottom: "6px" }}>⚪</div>
                            <div style={{ fontSize: "14px", fontWeight: "700", color: "#cbd5e1" }}>
                              Nenhuma atividade registrada neste período
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                              O mecânico não realizou tunagens, compras/produções na bancada nem movimentações de baú durante este ponto.
                            </div>
                          </div>
                        )}

                        {/* Tunagens */}
                        {(abaAtividadeModal === "todas" || abaAtividadeModal === "tunagens") && totalTun > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ fontSize: "12px", fontWeight: "800", color: "#4ade80", textTransform: "uppercase" }}>
                              🚗 Tunagens Realizadas ({totalTun})
                            </div>
                            {atividadesPontoSelecionado.tunagens.map((t, idx) => (
                              <div
                                key={t.uuid || idx}
                                style={{
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: "8px",
                                  padding: "10px 14px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: "13px", fontWeight: "800", color: "#f8fafc" }}>
                                    {t.veiculo_nome || "Veículo"}{" "}
                                    {t.placa && (
                                      <span style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "11px" }}>
                                        ({t.placa})
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                                    👤 Cliente: <strong>{t.dono_nome || "Cliente"}</strong> • 🕒 Horário: <strong>{t.hora || "—"}</strong>
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <span style={{ fontSize: "13px", fontWeight: "900", color: "#4ade80" }}>
                                    R$ {Number(t.valor_pago || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </span>
                                  <button
                                    onClick={() => setModalLogTunagemDetalhe(t)}
                                    style={{
                                      background: "rgba(56, 189, 248, 0.15)",
                                      border: "1px solid rgba(56, 189, 248, 0.4)",
                                      color: "#38bdf8",
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      fontSize: "11px",
                                      fontWeight: "800",
                                      cursor: "pointer"
                                    }}
                                  >
                                    📋 Ver Ficha
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Bancada */}
                        {(abaAtividadeModal === "todas" || abaAtividadeModal === "bancada") && totalBan > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ fontSize: "12px", fontWeight: "800", color: "#c084fc", textTransform: "uppercase" }}>
                              🧰 Itens de Bancada ({totalBan})
                            </div>
                            {atividadesPontoSelecionado.bancada.map((b, idx) => (
                              <div
                                key={idx}
                                style={{
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: "8px",
                                  padding: "8px 12px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                              >
                                <div>
                                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#f8fafc" }}>
                                    {b.item}
                                  </span>{" "}
                                  <span style={{ fontSize: "11px", color: "#a855f7", fontWeight: "800" }}>
                                    x{b.qtd}
                                  </span>
                                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                    🕒 {b.hora} · Ação: {b.acao}
                                  </div>
                                </div>
                                <span style={{ fontSize: "12px", fontWeight: "800", color: "#e2e8f0" }}>
                                  {b.preco}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Baú */}
                        {(abaAtividadeModal === "todas" || abaAtividadeModal === "bau") && totalBau > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ fontSize: "12px", fontWeight: "800", color: "#fbbf24", textTransform: "uppercase" }}>
                              📦 Movimentações no Baú ({totalBau})
                            </div>
                            {atividadesPontoSelecionado.bau.map((b, idx) => (
                              <div
                                key={idx}
                                style={{
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: "8px",
                                  padding: "8px 12px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                              >
                                <div>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: "800",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      background: b.acao === "Retirou" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)",
                                      color: b.acao === "Retirou" ? "#fca5a5" : "#86efac",
                                      marginRight: "8px"
                                    }}
                                  >
                                    {b.acao}
                                  </span>
                                  <span style={{ fontSize: "12px", color: "#f8fafc", fontWeight: "600" }}>
                                    {b.item}
                                  </span>
                                </div>
                                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                  🕒 {b.hora}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhe da Tunagem */}
      {modalLogTunagemDetalhe && (
        <ModalDetalheTunagem
          theme={theme}
          modalLogDetalhe={modalLogTunagemDetalhe}
          setModalLogDetalhe={setModalLogTunagemDetalhe}
          usuarioLogado={usuarioLogado}
          podeVerJsonBruto={false}
        />
      )}
    </div>
  );
}
