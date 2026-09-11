"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../utils/supabaseClient";
import { isAdminOuDono } from "../../utils/helpers";

export default function AtividadesMecanicosPage({
  styles,
  theme,
  usuarioLogado,
  listaFuncionarios = []
}) {
  // Verificação de permissão: Apenas Donos e Admins podem liberar infrações
  const userIsDono = Boolean(
    usuarioLogado?.role &&
    (usuarioLogado.role.includes("dono") ||
     usuarioLogado.role.includes("admin") ||
     (typeof isAdminOuDono === "function" && isAdminOuDono(usuarioLogado.role)))
  );

  // ===== ESTADOS DE FILTRO =====
  const [periodoPreset, setPeriodoPreset] = useState("hoje"); // "hoje" | "ontem" | "semana" | "semana_passada" | "mes" | "30dias" | "custom"
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().split("T")[0]);
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0]);
  const [filtroMecanico, setFiltroMecanico] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos"); // "todos" | "infracao_30min" | "infracao_liberada" | "crash" | "duplo_clique" | "inatividade" | "com_tunagem" | "com_bancada"

  // ===== ESTADOS DE DADOS =====
  const [sessoes, setSessoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagemSincronizacao, setMensagemSincronizacao] = useState(null);

  // Modal de Auditoria Detalhada
  const [sessaoSelecionada, setSessaoSelecionada] = useState(null);
  const [imagemZoom, setImagemZoom] = useState(null);
  const [hoveredLog, setHoveredLog] = useState(null); // { x, y, rawLog, item, preco, qtd, hora, acao, tipo }
  const [toastCopiado, setToastCopiado] = useState(null);

  const copiarLogItem = (texto, tipoNome) => {
    if (!texto) return;
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setToastCopiado(`Log de ${tipoNome || "atividade"} copiado com sucesso!`);
        setTimeout(() => {
          setToastCopiado(null);
        }, 2500);
      })
      .catch(() => {
        alert("Não foi possível copiar o log.");
      });
  };

  // Modal de Liberação de Infração (Exclusivo Donos)
  const [modalLiberar, setModalLiberar] = useState(null); // { sessao, motivo }
  const [salvandoLiberacao, setSalvandoLiberacao] = useState(false);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 25;

  // Ordenação
  const [ordenacaoColuna, setOrdenacaoColuna] = useState("entrada");
  const [ordenacaoDirecao, setOrdenacaoDirecao] = useState("desc");

  const handleOrdenar = (coluna) => {
    if (ordenacaoColuna === coluna) {
      setOrdenacaoDirecao((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setOrdenacaoColuna(coluna);
      setOrdenacaoDirecao(coluna === "mecanico" || coluna === "status" ? "asc" : "desc");
    }
    setPaginaAtual(1);
  };

  // Helper para datas por preset
  const atualizarDatasPorPreset = useCallback((preset) => {
    setPeriodoPreset(preset);
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
    } else if (preset === "semana") {
      const diaSem = hoje.getDay();
      const diffSeg = diaSem === 0 ? 6 : diaSem - 1;
      const segunda = new Date(hoje);
      segunda.setDate(hoje.getDate() - diffSeg);
      const domingo = new Date(segunda);
      domingo.setDate(segunda.getDate() + 6);
      setDataInicio(formatar(segunda));
      setDataFim(formatar(domingo));
    } else if (preset === "semana_passada") {
      const diaSem = hoje.getDay();
      const diffSeg = diaSem === 0 ? 6 : diaSem - 1;
      const segundaPassada = new Date(hoje);
      segundaPassada.setDate(hoje.getDate() - diffSeg - 7);
      const domingoPassado = new Date(segundaPassada);
      domingoPassado.setDate(segundaPassada.getDate() + 6);
      setDataInicio(formatar(segundaPassada));
      setDataFim(formatar(domingoPassado));
    } else if (preset === "mes") {
      const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      setDataInicio(formatar(primeiro));
      setDataFim(formatar(ultimo));
    } else if (preset === "30dias") {
      const d30 = new Date();
      d30.setDate(d30.getDate() - 30);
      setDataInicio(formatar(d30));
      setDataFim(formatar(hoje));
    }
  }, []);

  // Parser de mensagens de ponto do Discord (Reds)
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

    return {
      idJogo,
      nome,
      tipo,
      oficina,
      oficinaId,
      timestamp,
      uuid,
      motivoCrash,
      justificativa,
      comprovanteImg,
      fechadoPor,
      raw: content
    };
  };

  // Carregar e consolidar atividades do período
  const carregarAtividades = useCallback(async () => {
    setCarregando(true);
    setMensagemSincronizacao(null);
    try {
      const realInicio = (dataInicio && dataFim && dataInicio > dataFim) ? dataFim : (dataInicio || "2026-01-01");
      const realFim = (dataInicio && dataFim && dataInicio > dataFim) ? dataInicio : (dataFim || "2026-12-31");

      const iniISO = new Date(`${realInicio}T00:00:00-03:00`).toISOString();
      const fimISO = new Date(`${realFim}T23:59:59-03:00`).toISOString();
      const lookbackISO = new Date(new Date(iniISO).getTime() - 36 * 60 * 60 * 1000).toISOString();

      // Função auxiliar para paginação de consultas grandes
      const fetchAllPaginado = async (tabela, filterFn) => {
        let all = [];
        let page = 0;
        const pageSize = 1000;
        while (page < 35) {
          let q = supabase.from(tabela).select("*");
          q = filterFn(q);
          q = q.range(page * pageSize, (page + 1) * pageSize - 1);
          const { data, error } = await q;
          if (error) throw error;
          if (!data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < pageSize) break;
          page++;
        }
        return all;
      };

      // 0. Fast-path: Buscar sessões já consolidadas e salvas no banco
      const sessoesBanco = await fetchAllPaginado("sessoes_ponto_auditoria_reds", (q) =>
        q.eq("oficina_id", "reds")
          .gte("entrada", iniISO)
          .lte("entrada", fimISO)
          .order("entrada", { ascending: false })
      );

      if (sessoesBanco && sessoesBanco.length > 0) {
        const sessoesFormatadas = sessoesBanco.map((r) => {
          const det = r.detalhes_json || {};
          const isLiberada = det.infracao_liberada || false;
          const liberadaPor = det.infracao_liberada_por || null;
          const liberadaEm = det.infracao_liberada_em || null;
          const liberadaMotivo = det.infracao_liberada_motivo || null;
          const infracaoAtiva = isLiberada ? false : Boolean(r.infracao_30min);

          return {
            idJogo: r.id_jogo,
            nome: r.nome,
            oficina: r.oficina || "Red's Tunershop",
            oficinaId: r.oficina_id || "reds",
            entrada: r.entrada,
            saida: r.saida,
            uuidEntrada: r.uuid_sessao,
            uuidSaida: r.uuid_sessao,
            duracaoMin: r.duracao_min || 0,
            statusPonto: r.status_ponto || "normal",
            motivoCrash: r.motivo_crash,
            justificativa: r.justificativa,
            comprovanteImg: r.comprovante_img,
            fechadoPor: r.fechado_por,
            totalTunagens: r.total_tunagens || (det.tunagens ? det.tunagens.length : 0),
            valorTunagens: r.valor_tunagens || (det.tunagens ? det.tunagens.reduce((a, t) => a + (parseFloat(t.valor_pago || t.valor) || 0), 0) : 0),
            totalBancada: r.total_bancada || (det.bancada ? det.bancada.length : 0),
            valorBancada: r.valor_bancada || (det.bancada ? det.bancada.reduce((a, b) => a + (b.valor || 0), 0) : 0),
            totalBau: r.total_bau || (det.bau ? det.bau.length : 0),
            infracao30min: infracaoAtiva,
            infracaoOriginal: Boolean(r.infracao_30min),
            infracaoLiberada: isLiberada,
            infracaoLiberadaPor: liberadaPor,
            infracaoLiberadaEm: liberadaEm,
            infracaoLiberadaMotivo: liberadaMotivo,
            detalhes: det
          };
        });

        sessoesFormatadas.sort((a, b) => new Date(b.entrada) - new Date(a.entrada));
        setSessoes(sessoesFormatadas);
        setCarregando(false);
        return;
      }

      // 1. Buscar logs de ponto do Discord da REDS
      const logsDiscord = await fetchAllPaginado("discord_log_messages", (q) =>
        q.eq("log_type", "ponto")
          .eq("mechanic_id", "reds")
          .gte("created_at", lookbackISO)
          .lte("created_at", fimISO)
          .order("id", { ascending: true })
      );

      // 2. Buscar logs de bancada da REDS
      const logsBancada = await fetchAllPaginado("discord_log_messages", (q) =>
        q.eq("log_type", "bancada")
          .eq("mechanic_id", "reds")
          .gte("created_at", lookbackISO)
          .lte("created_at", fimISO)
          .order("id", { ascending: true })
      );

      // 3. Buscar logs de baú da REDS
      const logsBau = await fetchAllPaginado("discord_log_messages", (q) =>
        q.eq("log_type", "bau")
          .eq("mechanic_id", "reds")
          .gte("created_at", lookbackISO)
          .lte("created_at", fimISO)
          .order("id", { ascending: true })
      );

      // 4. Buscar logs de tunagem da REDS
      let logsTunagem = [];
      try {
        const { data: dataTunReds } = await supabase
          .from("logs_tunagem_reds")
          .select("*")
          .gte("data", realInicio)
          .lte("data", realFim);
        if (dataTunReds && dataTunReds.length > 0) {
          logsTunagem = dataTunReds;
        } else {
          const { data: dataTunGeral } = await supabase
            .from("logs_tunagem")
            .select("*")
            .eq("mechanic_id", "reds")
            .gte("data", realInicio)
            .lte("data", realFim);
          logsTunagem = dataTunGeral || [];
        }
      } catch (e) {
        logsTunagem = [];
      }

      // 5. Buscar sessões já salvas na tabela de auditoria (para recuperar status de infração liberada)
      const mapaAuditoriaSalva = {};
      try {
        const { data: dataAuditoria } = await supabase
          .from("sessoes_ponto_auditoria_reds")
          .select("uuid_sessao, infracao_30min, detalhes_json")
          .gte("entrada", lookbackISO)
          .lte("entrada", fimISO);

        (dataAuditoria || []).forEach((row) => {
          if (row.uuid_sessao) {
            mapaAuditoriaSalva[row.uuid_sessao] = row;
          }
        });
      } catch (err) {
        console.warn("Tabela sessoes_ponto_auditoria_reds:", err);
      }

      // Mapeia todas as atividades de bancada e tunagem por idJogo
      const mapaAtividadesMecanico = {};

      (logsBancada || []).forEach((msg) => {
        const c = msg.content || "";
        const idMatch = c.match(/\[ID\]:\s*(\d+)/i);
        const dataMatch = c.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}:\d{2})/i);
        let ts = msg.created_at;
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

      (logsTunagem || []).forEach((t) => {
        if (t.tecnico_id && t.data && t.hora) {
          const ts = new Date(`${t.data}T${t.hora}-03:00`).getTime();
          const id = String(t.tecnico_id).trim();
          if (!mapaAtividadesMecanico[id]) mapaAtividadesMecanico[id] = [];
          mapaAtividadesMecanico[id].push(ts);
        }
      });

      Object.values(mapaAtividadesMecanico).forEach((arr) => arr.sort((a, b) => a - b));

      // Agrupar eventos de ponto por mecânico
      const mapaMecanicos = {};
      (logsDiscord || []).forEach((msg) => {
        const parsed = parseDiscordPontoMessage(msg.content, msg.created_at, msg.embed_data);
        if (!parsed || !parsed.idJogo) return;
        if (parsed.oficinaId !== "reds") return;

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

      const sessoesConsolidadas = [];
      const chavesSessoes = new Set();
      const UMA_HORA_MS = 60 * 60 * 1000;
      const agora = Date.now();

      Object.values(mapaMecanicos).forEach((mec) => {
        mec.eventos.sort((a, b) => {
          const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          if (diff !== 0) return diff;
          if (a.tipo === "entrada" && b.tipo === "saida") return -1;
          if (a.tipo === "saida" && b.tipo === "entrada") return 1;
          return 0;
        });

        const evs = mec.eventos;
        const ativs = mapaAtividadesMecanico[mec.idJogo] || [];
        let pontoAtual = null;

        for (let i = 0; i < evs.length; i++) {
          const ev = evs[i];
          if (ev.tipo === "entrada") {
            if (pontoAtual) {
              const entMs = new Date(pontoAtual.entrada).getTime();
              const proxEntMs = new Date(ev.timestamp).getTime();
              const diffMs = proxEntMs - entMs;

              if (diffMs > UMA_HORA_MS) {
                // Mais de 1 hora entre entradas: encerra a anterior por inatividade/crash
                const ativsNaSessao = ativs.filter((ts) => ts >= entMs && ts <= (entMs + 24 * 60 * 60 * 1000) && ts < proxEntMs);
                let ultAtivMs = entMs;
                const teveAtividade = ativsNaSessao.length > 0;
                if (teveAtividade) {
                  ultAtivMs = ativsNaSessao[ativsNaSessao.length - 1];
                }

                pontoAtual.saida = new Date(ultAtivMs).toISOString();
                pontoAtual.isAutoFechadoInatividade = true;
                pontoAtual.statusPonto = "auto_inatividade";
                pontoAtual.duracaoMin = Math.max(1, Math.round((ultAtivMs - entMs) / 60000));
                pontoAtual.justificativa = teveAtividade
                  ? `Encerrado automaticamente por inatividade (> 60 min sem saída). Última atividade às ${new Date(ultAtivMs).toLocaleTimeString("pt-BR")}`
                  : `Encerrado automaticamente por inatividade (> 60 min sem movimentação desde a abertura).`;
              } else {
                pontoAtual.saida = ev.timestamp;
                pontoAtual.duracaoMin = Math.max(1, Math.round(diffMs / 60000));
              }

              const chaveAnt = pontoAtual.uuidSaida || `${pontoAtual.idJogo}_${pontoAtual.entrada}_${pontoAtual.saida}`;
              if (!chavesSessoes.has(chaveAnt)) {
                chavesSessoes.add(chaveAnt);
                sessoesConsolidadas.push(pontoAtual);
              }
            }
            pontoAtual = {
              idJogo: mec.idJogo,
              nome: mec.nome,
              oficina: ev.oficina || "Red's Tunershop",
              oficinaId: "reds",
              entrada: ev.timestamp,
              uuidEntrada: ev.uuid,
              saida: null,
              uuidSaida: null,
              duracaoMin: 0,
              statusPonto: "aberto",
              isDuploClique: false,
              isAutoFechadoInatividade: false,
              motivoCrash: null,
              justificativa: null,
              comprovanteImg: null,
              fechadoPor: null
            };
          } else if (ev.tipo === "saida") {
            if (pontoAtual) {
              const diffMs = new Date(ev.timestamp).getTime() - new Date(pontoAtual.entrada).getTime();
              const ehDuploClique = diffMs <= 60000;

              pontoAtual.saida = ev.timestamp;
              pontoAtual.uuidSaida = ev.uuid;
              pontoAtual.duracaoMin = Math.max(1, Math.round(diffMs / 60000));
              pontoAtual.isDuploClique = ehDuploClique;
              pontoAtual.statusPonto = ehDuploClique
                ? "duplo_clique"
                : ev.motivoCrash
                  ? "manual_crash"
                  : "normal";
              pontoAtual.motivoCrash = ev.motivoCrash;
              pontoAtual.justificativa = ev.justificativa;
              pontoAtual.comprovanteImg = ev.comprovanteImg;
              pontoAtual.fechadoPor = ev.fechadoPor;

              const chave = pontoAtual.uuidSaida || `${pontoAtual.idJogo}_${pontoAtual.entrada}_${pontoAtual.saida}`;
              if (!chavesSessoes.has(chave)) {
                chavesSessoes.add(chave);
                sessoesConsolidadas.push(pontoAtual);
              }
              pontoAtual = null;
            } else {
              const pAvulso = {
                idJogo: mec.idJogo,
                nome: mec.nome,
                oficina: ev.oficina || "Red's Tunershop",
                oficinaId: "reds",
                entrada: ev.timestamp,
                uuidEntrada: null,
                saida: ev.timestamp,
                uuidSaida: ev.uuid,
                duracaoMin: 1,
                statusPonto: ev.motivoCrash ? "manual_crash" : "duplo_clique",
                isDuploClique: true,
                isAutoFechadoInatividade: false,
                motivoCrash: ev.motivoCrash,
                justificativa: ev.justificativa,
                comprovanteImg: ev.comprovanteImg,
                fechadoPor: ev.fechadoPor
              };
              const chave = ev.uuid || `${mec.idJogo}_${ev.timestamp}_saida_avulsa`;
              if (!chavesSessoes.has(chave)) {
                chavesSessoes.add(chave);
                sessoesConsolidadas.push(pAvulso);
              }
            }
          }
        }

        // Ponto sem saída
        if (pontoAtual && !pontoAtual.saida) {
          const entMs = new Date(pontoAtual.entrada).getTime();
          const ativsNaSessao = ativs.filter((ts) => ts >= entMs);
          let ultAtivMs = entMs;
          const teveAtividade = ativsNaSessao.length > 0;
          if (teveAtividade) {
            ultAtivMs = ativsNaSessao[ativsNaSessao.length - 1];
          }
          const tempoDesdeUltimaMov = agora - ultAtivMs;

          if (tempoDesdeUltimaMov >= UMA_HORA_MS) {
            pontoAtual.saida = new Date(ultAtivMs).toISOString();
            pontoAtual.isAutoFechadoInatividade = true;
            pontoAtual.statusPonto = "auto_inatividade";
            pontoAtual.duracaoMin = Math.max(
              1,
              Math.round((ultAtivMs - entMs) / 60000)
            );
            pontoAtual.justificativa = teveAtividade
              ? `Encerrado automaticamente por inatividade (> 60 min sem movimentação). Última atividade registrada às ${new Date(ultAtivMs).toLocaleTimeString("pt-BR")}`
              : `Encerrado automaticamente por inatividade (> 60 min sem movimentação desde a abertura).`;

            const chaveAuto = `auto_${pontoAtual.idJogo}_${pontoAtual.entrada}_${pontoAtual.saida}`;
            if (!chavesSessoes.has(chaveAuto)) {
              chavesSessoes.add(chaveAuto);
              sessoesConsolidadas.push(pontoAtual);
            }
          } else {
            pontoAtual.duracaoMin = Math.max(
              0,
              Math.round((agora - new Date(pontoAtual.entrada).getTime()) / 60000)
            );
            sessoesConsolidadas.push(pontoAtual);
          }
        }
      });

      // Cruzamento de atividades (Bancada, Baú, Tunagem) para cada sessão
      const sessoesComAtividades = sessoesConsolidadas.map((sessao) => {
        const entTs = new Date(sessao.entrada).getTime();
        const saiTs = sessao.saida ? new Date(sessao.saida).getTime() : agora;
        const idStr = String(sessao.idJogo);
        const nomeLower = (sessao.nome || "").toLowerCase();

        // 1. Tunagens da sessão
        const tunagensSessao = logsTunagem
          .filter((t) => {
            if (!t.data || !t.hora) return false;
            const matchTecnico = String(t.tecnico_id) === idStr || (t.tecnico_nome && t.tecnico_nome.toLowerCase().includes(nomeLower));
            if (!matchTecnico) return false;
            try {
              const dtStr = `${t.data}T${t.hora}-03:00`;
              const dt = new Date(dtStr).getTime();
              return dt >= entTs - 60000 && dt <= saiTs + 60000;
            } catch (e) {
              return false;
            }
          })
          .map((t) => {
            const rawLogTunagem = t.raw_text || (
              `[TUNAGEM DE VEÍCULO]\n` +
              `[Oficina]: ${t.oficina_nome || "Red's Tunershop"}\n` +
              `[Baia]: ${t.baia_nome || "Tunagem"}\n` +
              `[Técnico]: ${t.tecnico_nome || sessao.nome} (ID: ${t.tecnico_id || sessao.idJogo})\n` +
              `[Dono]: ${t.dono_nome || "Cliente"} (ID: ${t.dono_id || "N/A"})\n` +
              `[Veículo]: ${t.veiculo_nome || "Veículo"} (${t.veiculo_modelo || "N/A"})\n` +
              `[Placa]: ${t.placa || "N/A"}\n` +
              `[Valor Pago]: R$ ${Number(t.valor_pago || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n` +
              (t.antes_json ? `[Antes]: ${typeof t.antes_json === "object" ? JSON.stringify(t.antes_json) : t.antes_json}\n` : "") +
              (t.depois_json ? `[Depois]: ${typeof t.depois_json === "object" ? JSON.stringify(t.depois_json) : t.depois_json}\n` : "") +
              `\`\`\`ini\n` +
              `[DATA]: ${t.data ? new Date(t.data + "T12:00:00").toLocaleDateString("pt-BR") : ""}, ${t.hora || ""}\n` +
              `[UUID]: ${t.uuid || "N/A"}\`\`\``
            );
            return {
              ...t,
              rawLog: rawLogTunagem
            };
          });

        // 2. Bancada da sessão
        const bancadaSessao = [];
        (logsBancada || []).forEach((msg) => {
          const c = msg.content || "";
          if (c.includes(`[ID]: ${sessao.idJogo}`) || (sessao.nome && c.toLowerCase().includes(nomeLower))) {
            const dataMatch = c.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}:\d{2})/i);
            let tsMsg = new Date(msg.created_at).getTime();
            if (dataMatch) {
              const [_, dStr, hStr] = dataMatch;
              const [dia, mes, ano] = dStr.split("/");
              tsMsg = new Date(`${ano}-${mes}-${dia}T${hStr}-03:00`).getTime();
            }

            if (tsMsg >= entTs - 60000 && tsMsg <= saiTs + 60000) {
              const itemMatch = c.match(/\[(?:ITEMNAME|ITEM|ITEMKEY)\]:\s*([^\n\r]+)/i);
              const qtdMatch = c.match(/\[(?:QUANTIDADE|QTD)\]:\s*(\d+)/i);
              const precoMatch = c.match(/\[(?:PRICE|VALOR|PRE[ÇC]O)\]:\s*([^\n\r]+)/i);
              const acaoMatch = c.match(/\[A[ÇC][ÃA]O\]:\s*([^\n\r]+)/i);
              const horaStr = dataMatch ? dataMatch[2] : new Date(msg.created_at).toLocaleTimeString("pt-BR");

              let precoFormatado = precoMatch ? precoMatch[1].trim() : "0";
              let precoNum = Number(precoFormatado.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) || 0;

              if (!precoFormatado.startsWith("$") && !precoFormatado.startsWith("R$")) {
                precoFormatado = `$${precoFormatado}`;
              }

              bancadaSessao.push({
                item: itemMatch ? itemMatch[1].trim() : "Item de Bancada",
                qtd: qtdMatch ? parseInt(qtdMatch[1]) : 1,
                preco: precoFormatado,
                precoNum,
                acao: acaoMatch ? acaoMatch[1].trim() : "buy",
                hora: horaStr,
                timestamp: tsMsg,
                rawLog: c
              });
            }
          }
        });

        // 3. Baú da sessão
        const bauSessao = [];
        (logsBau || []).forEach((msg) => {
          const c = msg.content || "";
          if (c.includes(`[ID]: ${sessao.idJogo}`) || (sessao.nome && c.toLowerCase().includes(nomeLower))) {
            const dataMatch = c.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}:\d{2})/i);
            let tsMsg = new Date(msg.created_at).getTime();
            if (dataMatch) {
              const [_, dStr, hStr] = dataMatch;
              const [dia, mes, ano] = dStr.split("/");
              tsMsg = new Date(`${ano}-${mes}-${dia}T${hStr}-03:00`).getTime();
            }

            if (tsMsg >= entTs - 60000 && tsMsg <= saiTs + 60000) {
              const retMatch = c.match(/\[RETIROU\]:\s*([^\n\r]+)/i);
              const colMatch = c.match(/\[COLOCOU\]:\s*([^\n\r]+)/i);
              const horaStr = dataMatch ? dataMatch[2] : new Date(msg.created_at).toLocaleTimeString("pt-BR");

              if (retMatch) {
                bauSessao.push({ acao: "Retirou", item: retMatch[1].trim(), hora: horaStr, timestamp: tsMsg, rawLog: c });
              }
              if (colMatch) {
                bauSessao.push({ acao: "Colocou", item: colMatch[1].trim(), hora: horaStr, timestamp: tsMsg, rawLog: c });
              }
            }
          }
        });

        // Cálculo de métricas da sessão
        const totalTunagens = tunagensSessao.length;
        const valorTunagens = tunagensSessao.reduce((acc, t) => acc + (Number(t.valor_pago) || 0), 0);
        const totalBancada = bancadaSessao.reduce((acc, b) => acc + b.qtd, 0);
        const valorBancada = bancadaSessao.reduce((acc, b) => acc + b.precoNum, 0);
        const totalBau = bauSessao.length;

        // Se teve qualquer atividade (bancada, baú ou tunagem), NÃO é duplo clique acidental
        const temAtividade = totalTunagens > 0 || totalBancada > 0 || totalBau > 0;
        const isRealmenteDuploClique = Boolean(sessao.isDuploClique) && !temAtividade;
        let statusPontoFinal = sessao.statusPonto;
        if (statusPontoFinal === "duplo_clique" && temAtividade) {
          statusPontoFinal = "normal";
        }

        // Identificador da sessão
        const uuidSessao = sessao.uuidSaida || sessao.uuidEntrada || `${sessao.idJogo}_${sessao.entrada}_${sessao.saida || "aberto"}`;
        const audSalva = mapaAuditoriaSalva[uuidSessao];
        const isLiberadaSalva = Boolean(audSalva?.detalhes_json?.infracao_liberada);
        const liberadaPor = audSalva?.detalhes_json?.infracao_liberada_por || null;
        const liberadaEm = audSalva?.detalhes_json?.infracao_liberada_em || null;
        const liberadaMotivo = audSalva?.detalhes_json?.infracao_liberada_motivo || null;

        // Regra dos 30 minutos: permanência < 30min E retirou itens no baú/bancada
        const infracaoDetectada = sessao.duracaoMin < 30 && (totalBau > 0 || totalBancada > 0);
        const infracaoAtiva = infracaoDetectada && !isLiberadaSalva;

        return {
          ...sessao,
          uuidSessao,
          isDuploClique: isRealmenteDuploClique,
          statusPonto: statusPontoFinal,
          totalTunagens,
          valorTunagens,
          totalBancada,
          valorBancada,
          totalBau,
          infracao30min: infracaoAtiva,
          infracaoOriginal: infracaoDetectada,
          infracaoLiberada: isLiberadaSalva,
          infracaoLiberadaPor: liberadaPor,
          infracaoLiberadaEm: liberadaEm,
          infracaoLiberadaMotivo: liberadaMotivo,
          detalhes: {
            tunagens: tunagensSessao,
            bancada: bancadaSessao,
            bau: bauSessao,
            infracao_liberada: isLiberadaSalva,
            infracao_liberada_por: liberadaPor,
            infracao_liberada_em: liberadaEm,
            infracao_liberada_motivo: liberadaMotivo
          }
        };
      });

      // Filtrar apenas as sessões dentro do intervalo de data selecionado
      const iniFiltroMs = new Date(`${realInicio}T00:00:00-03:00`).getTime();
      const fimFiltroMs = new Date(`${realFim}T23:59:59-03:00`).getTime();

      const sessoesPeriodo = sessoesComAtividades.filter((s) => {
        const ent = new Date(s.entrada).getTime();
        const sai = s.saida ? new Date(s.saida).getTime() : ent;
        return (ent >= iniFiltroMs && ent <= fimFiltroMs) || (sai >= iniFiltroMs && sai <= fimFiltroMs);
      });

      sessoesPeriodo.sort((a, b) => new Date(b.entrada) - new Date(a.entrada));
      setSessoes(sessoesPeriodo);
    } catch (e) {
      console.error("Erro ao carregar atividades dos mecânicos:", e);
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    carregarAtividades();
  }, [carregarAtividades]);

  // Função para Sincronizar / Salvar sessões na tabela sessoes_ponto_auditoria_reds
  const sincronizarComBanco = async () => {
    if (sessoes.length === 0) {
      alert("Nenhuma sessão encontrada para sincronizar no período selecionado.");
      return;
    }

    setSincronizando(true);
    setMensagemSincronizacao(null);
    try {
      const recordsToUpsert = sessoes.map((s) => {
        const uuidSessao = s.uuidSaida || s.uuidEntrada || `${s.idJogo}_${s.entrada}_${s.saida || "aberto"}`;
        return {
          uuid_sessao: uuidSessao,
          id_jogo: String(s.idJogo),
          nome: s.nome,
          oficina: s.oficina || "Red's Tunershop",
          oficina_id: "reds",
          entrada: s.entrada,
          saida: s.saida || null,
          duracao_min: s.duracaoMin,
          status_ponto: s.statusPonto || "normal",
          motivo_crash: s.motivoCrash || null,
          justificativa: s.justificativa || null,
          comprovante_img: s.comprovanteImg || null,
          fechado_por: s.fechadoPor || null,
          total_tunagens: s.totalTunagens || 0,
          valor_tunagens: s.valorTunagens || 0,
          total_bancada: s.totalBancada || 0,
          valor_bancada: s.valorBancada || 0,
          total_bau: s.totalBau || 0,
          infracao_30min: Boolean(s.infracao30min),
          detalhes_json: s.detalhes || {}
        };
      });

      const { data, error } = await supabase
        .from("sessoes_ponto_auditoria_reds")
        .upsert(recordsToUpsert, { onConflict: "uuid_sessao" });

      if (error) {
        throw error;
      }

      setMensagemSincronizacao({
        tipo: "sucesso",
        texto: `✅ ${recordsToUpsert.length} sessões de ponto sincronizadas com sucesso em sessoes_ponto_auditoria_reds!`
      });
    } catch (err) {
      console.warn("Aviso ao sincronizar sessoes_ponto_auditoria_reds:", err);
      setMensagemSincronizacao({
        tipo: "erro",
        texto: `⚠️ Não foi possível sincronizar na tabela (verifique se a migração sessoes_ponto_auditoria_reds foi executada no Supabase). As sessões continuam disponíveis em tempo real: ${err.message || ""}`
      });
    } finally {
      setSincronizando(false);
    }
  };

  // Sessões filtradas por mecânico (base para estatísticas)
  const sessoesBaseMecanico = useMemo(() => {
    let res = sessoes;
    if (filtroMecanico.trim()) {
      const b = filtroMecanico.toLowerCase().trim();
      res = res.filter(
        (s) => (s.nome && s.nome.toLowerCase().includes(b)) || (s.idJogo && String(s.idJogo).includes(b))
      );
    }
    return res;
  }, [sessoes, filtroMecanico]);

  // Estatísticas globais do período (ou do mecânico buscado)
  const metricas = useMemo(() => {
    const totalSessoes = sessoesBaseMecanico.length;
    const totalMinutos = sessoesBaseMecanico.reduce((acc, s) => acc + (s.duracaoMin || 0), 0);
    const horasTrabalhadas = Math.floor(totalMinutos / 60);
    const minutosRestantes = totalMinutos % 60;

    const mecanicosUnicos = new Set(sessoesBaseMecanico.map((s) => s.idJogo)).size;
    const totalTunagens = sessoesBaseMecanico.reduce((acc, s) => acc + (s.totalTunagens || 0), 0);
    const faturamentoTunagens = sessoesBaseMecanico.reduce((acc, s) => acc + (s.valorTunagens || 0), 0);
    const totalComprasBancada = sessoesBaseMecanico.reduce((acc, s) => acc + (s.totalBancada || 0), 0);
    const gastoBancada = sessoesBaseMecanico.reduce((acc, s) => acc + (s.valorBancada || 0), 0);
    const totalRetiradasBau = sessoesBaseMecanico.reduce((acc, s) => acc + (s.totalBau || 0), 0);
    const totalInfra30Min = sessoesBaseMecanico.filter((s) => s.infracao30min).length;
    const totalCrash = sessoesBaseMecanico.filter((s) => s.statusPonto === "manual_crash" || s.motivoCrash).length;
    const totalDuploClique = sessoesBaseMecanico.filter((s) => s.statusPonto === "duplo_clique" || s.isDuploClique).length;

    return {
      totalSessoes,
      horasTexto: `${horasTrabalhadas}h ${minutosRestantes}min`,
      mecanicosUnicos,
      totalTunagens,
      faturamentoTunagens,
      totalComprasBancada,
      gastoBancada,
      totalRetiradasBau,
      totalInfra30Min,
      totalCrash,
      totalDuploClique
    };
  }, [sessoesBaseMecanico]);

  // Filtros aplicados em memória (incluindo filtro de status/infração e ordenação)
  const sessoesFiltradas = useMemo(() => {
    let res = [...sessoesBaseMecanico];

    // Filtro de Status
    if (filtroStatus === "infracao_30min") {
      res = res.filter((s) => s.infracao30min);
    } else if (filtroStatus === "infracao_liberada") {
      res = res.filter((s) => s.infracaoLiberada);
    } else if (filtroStatus === "crash") {
      res = res.filter((s) => s.statusPonto === "manual_crash" || s.motivoCrash);
    } else if (filtroStatus === "duplo_clique") {
      res = res.filter((s) => s.statusPonto === "duplo_clique" || s.isDuploClique);
    } else if (filtroStatus === "inatividade") {
      res = res.filter((s) => s.statusPonto === "auto_inatividade" || s.isAutoFechadoInatividade);
    } else if (filtroStatus === "com_tunagem") {
      res = res.filter((s) => s.totalTunagens > 0);
    } else if (filtroStatus === "com_bancada") {
      res = res.filter((s) => s.totalBancada > 0);
    }

    // Ordenação
    if (ordenacaoColuna) {
      res.sort((a, b) => {
        let valA = 0;
        let valB = 0;
        let isString = false;

        switch (ordenacaoColuna) {
          case "mecanico":
            isString = true;
            valA = a.nome || "";
            valB = b.nome || "";
            break;
          case "entrada":
            valA = a.entrada ? new Date(a.entrada).getTime() : 0;
            valB = b.entrada ? new Date(b.entrada).getTime() : 0;
            break;
          case "saida":
            valA = a.saida ? new Date(a.saida).getTime() : 0;
            valB = b.saida ? new Date(b.saida).getTime() : 0;
            break;
          case "duracao":
            valA = a.duracaoMin || 0;
            valB = b.duracaoMin || 0;
            break;
          case "status":
            isString = true;
            valA = a.statusPonto || (a.saida ? "finalizado" : "aberto");
            valB = b.statusPonto || (b.saida ? "finalizado" : "aberto");
            break;
          case "tunagens":
            valA = a.totalTunagens || 0;
            valB = b.totalTunagens || 0;
            break;
          case "bancada":
            valA = a.totalBancada || 0;
            valB = b.totalBancada || 0;
            break;
          case "bau":
            valA = a.totalBau || 0;
            valB = b.totalBau || 0;
            break;
          case "infracao":
            valA = a.infracao30min ? 1 : 0;
            valB = b.infracao30min ? 1 : 0;
            break;
          default:
            valA = a.entrada ? new Date(a.entrada).getTime() : 0;
            valB = b.entrada ? new Date(b.entrada).getTime() : 0;
        }

        let cmp = 0;
        if (isString) {
          cmp = String(valA).localeCompare(String(valB), "pt-BR", { sensitivity: "base" });
        } else {
          cmp = valA > valB ? 1 : valA < valB ? -1 : 0;
        }

        return ordenacaoDirecao === "asc" ? cmp : -cmp;
      });
    }

    return res;
  }, [sessoesBaseMecanico, filtroStatus, ordenacaoColuna, ordenacaoDirecao]);

  // Paginação
  const totalPaginas = Math.ceil(sessoesFiltradas.length / itensPorPagina) || 1;
  const sessoesPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return sessoesFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [sessoesFiltradas, paginaAtual]);

  // Helper para copiar advertência Discord
  const copiarAdvertenciaDiscord = (sessao) => {
    const duracao = sessao.saida
      ? `${sessao.duracaoMin} minutos`
      : `${sessao.duracaoMin} minutos (Ainda Aberto)`;

    const horaEntrada = new Date(sessao.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const horaSaida = sessao.saida
      ? new Date(sessao.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "Em aberto";

    const totalBau = sessao.detalhes?.bau?.length || sessao.totalBau || 0;
    const totalBancada = sessao.detalhes?.bancada?.length || sessao.totalBancada || 0;
    const totalTunagens = sessao.detalhes?.tunagens?.length || sessao.totalTunagens || 0;

    const texto = `🚨 **NOTIFICAÇÃO DE DESCUMPRIMENTO DA REGRA DOS 30 MINUTOS** 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 **Mecânico:** ${sessao.nome} (ID: ${sessao.idJogo})
🏢 **Oficina:** ${sessao.oficina || "Red's Tunershop"}
📅 **Data:** ${new Date(sessao.entrada).toLocaleDateString("pt-BR")}
⏱️ **Expediente:** ${horaEntrada} até ${horaSaida} (${duracao})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 **Movimentações no Baú:** ${totalBau} ${totalBau > 0 ? "⚠️" : ""}
🛠️ **Compras/Bancada:** ${totalBancada} ${totalBancada > 0 ? "⚠️" : ""}
🚗 **Tunagens para Clientes:** ${totalTunagens}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ **Infração Detectada:** Foi verificado que o funcionário abriu expediente e permaneceu por menos de 30 minutos, realizando retiradas/compras de itens da oficina sem o cumprimento integral do período de serviço obrigatório.
*Atenção: É obrigatório cumprir o tempo mínimo de serviço de 30 minutos ao entrar em expediente.*`;

    navigator.clipboard
      .writeText(texto)
      .then(() => alert("📋 Advertência de 30 minutos copiada com sucesso! Cole no canal do Discord."))
      .catch(() => alert("❌ Erro ao copiar advertência."));
  };

  // Função para liberar infração (exclusivo para donos/admins)
  const executarLiberarInfracao = async (sessao, motivo) => {
    if (!userIsDono) {
      alert("Apenas os Donos têm permissão para liberar infrações.");
      return;
    }

    setSalvandoLiberacao(true);
    const uuid = sessao.uuidSessao || sessao.uuidSaida || sessao.uuidEntrada || `${sessao.idJogo}_${sessao.entrada}_${sessao.saida || "aberto"}`;
    const agoraISO = new Date().toISOString();
    const nomeDono = usuarioLogado?.nome || `ID: ${usuarioLogado?.idJogo || "Dono"}`;

    try {
      const { error } = await supabase
        .from("sessoes_ponto_auditoria_reds")
        .upsert({
          uuid_sessao: uuid,
          id_jogo: String(sessao.idJogo),
          nome: sessao.nome,
          oficina: sessao.oficina || "Red's Tunershop",
          oficina_id: "reds",
          entrada: sessao.entrada,
          saida: sessao.saida || null,
          duracao_min: sessao.duracaoMin,
          status_ponto: sessao.statusPonto || "normal",
          total_tunagens: sessao.totalTunagens || 0,
          valor_tunagens: sessao.valorTunagens || 0,
          total_bancada: sessao.totalBancada || 0,
          valor_bancada: sessao.valorBancada || 0,
          total_bau: sessao.totalBau || 0,
          infracao_30min: false,
          detalhes_json: {
            ...(sessao.detalhes || {}),
            infracao_original: true,
            infracao_liberada: true,
            infracao_liberada_por: nomeDono,
            infracao_liberada_em: agoraISO,
            infracao_liberada_motivo: motivo || "Autorizado pelos Donos"
          }
        }, { onConflict: "uuid_sessao" });

      if (error) {
        console.warn("Aviso ao persistir liberação na tabela de auditoria:", error);
      }

      // Atualiza estado local imediatamente
      const atualizador = (s) => {
        const sUuid = s.uuidSessao || s.uuidSaida || s.uuidEntrada || `${s.idJogo}_${s.entrada}_${s.saida || "aberto"}`;
        if (sUuid === uuid || (s.idJogo === sessao.idJogo && s.entrada === sessao.entrada)) {
          return {
            ...s,
            infracao30min: false,
            infracaoLiberada: true,
            infracaoLiberadaPor: nomeDono,
            infracaoLiberadaEm: agoraISO,
            infracaoLiberadaMotivo: motivo || "Autorizado pelos Donos",
            detalhes: {
              ...(s.detalhes || {}),
              infracao_liberada: true,
              infracao_liberada_por: nomeDono,
              infracao_liberada_em: agoraISO,
              infracao_liberada_motivo: motivo || "Autorizado pelos Donos"
            }
          };
        }
        return s;
      };

      setSessoes((prev) => prev.map(atualizador));
      if (sessaoSelecionada) {
        setSessaoSelecionada((prev) => (prev ? atualizador(prev) : null));
      }
      setModalLiberar(null);
    } catch (e) {
      console.error("Erro ao liberar infração:", e);
      alert("Ocorreu um erro ao salvar a liberação da infração.");
    } finally {
      setSalvandoLiberacao(false);
    }
  };

  // Função para revogar liberação de infração (exclusivo para donos/admins)
  const executarRevogarLiberacao = async (sessao) => {
    if (!userIsDono) {
      alert("Apenas os Donos têm permissão para revogar a liberação.");
      return;
    }

    if (!confirm(`Deseja revogar a liberação da infração de ${sessao.nome}? A infração voltará a ser exibida como ativa.`)) {
      return;
    }

    const uuid = sessao.uuidSessao || sessao.uuidSaida || sessao.uuidEntrada || `${sessao.idJogo}_${sessao.entrada}_${sessao.saida || "aberto"}`;

    try {
      await supabase
        .from("sessoes_ponto_auditoria_reds")
        .upsert({
          uuid_sessao: uuid,
          id_jogo: String(sessao.idJogo),
          nome: sessao.nome,
          oficina: sessao.oficina || "Red's Tunershop",
          oficina_id: "reds",
          entrada: sessao.entrada,
          saida: sessao.saida || null,
          duracao_min: sessao.duracaoMin,
          status_ponto: sessao.statusPonto || "normal",
          total_tunagens: sessao.totalTunagens || 0,
          valor_tunagens: sessao.valorTunagens || 0,
          total_bancada: sessao.totalBancada || 0,
          valor_bancada: sessao.valorBancada || 0,
          total_bau: sessao.totalBau || 0,
          infracao_30min: true,
          detalhes_json: {
            ...(sessao.detalhes || {}),
            infracao_liberada: false,
            infracao_liberada_por: null,
            infracao_liberada_em: null,
            infracao_liberada_motivo: null
          }
        }, { onConflict: "uuid_sessao" });

      const atualizador = (s) => {
        const sUuid = s.uuidSessao || s.uuidSaida || s.uuidEntrada || `${s.idJogo}_${s.entrada}_${s.saida || "aberto"}`;
        if (sUuid === uuid || (s.idJogo === sessao.idJogo && s.entrada === sessao.entrada)) {
          return {
            ...s,
            infracao30min: true,
            infracaoLiberada: false,
            infracaoLiberadaPor: null,
            infracaoLiberadaEm: null,
            infracaoLiberadaMotivo: null,
            detalhes: {
              ...(s.detalhes || {}),
              infracao_liberada: false,
              infracao_liberada_por: null,
              infracao_liberada_em: null,
              infracao_liberada_motivo: null
            }
          };
        }
        return s;
      };

      setSessoes((prev) => prev.map(atualizador));
      if (sessaoSelecionada) {
        setSessaoSelecionada((prev) => (prev ? atualizador(prev) : null));
      }
    } catch (e) {
      console.error("Erro ao revogar liberação:", e);
    }
  };

  // Exportar CSV
  const exportarCSV = () => {
    if (sessoesFiltradas.length === 0) {
      alert("Nenhum registro para exportar.");
      return;
    }

    const colunas = [
      "ID Jogo",
      "Nome Mecanico",
      "Data Entrada",
      "Hora Entrada",
      "Data Saida",
      "Hora Saida",
      "Duracao (Minutos)",
      "Status",
      "Total Tunagens",
      "Valor Tunagens",
      "Total Bancada",
      "Valor Bancada",
      "Total Bau",
      "Infracao 30 Minutos",
      "Motivo Crash",
      "Fechado Por"
    ];

    const linhas = sessoesFiltradas.map((s) => {
      const dEnt = new Date(s.entrada);
      const dSai = s.saida ? new Date(s.saida) : null;
      return [
        `"${s.idJogo}"`,
        `"${s.nome}"`,
        `"${dEnt.toLocaleDateString("pt-BR")}"`,
        `"${dEnt.toLocaleTimeString("pt-BR")}"`,
        dSai ? `"${dSai.toLocaleDateString("pt-BR")}"` : '""',
        dSai ? `"${dSai.toLocaleTimeString("pt-BR")}"` : '""',
        s.duracaoMin,
        `"${s.statusPonto}"`,
        s.totalTunagens || 0,
        s.valorTunagens || 0,
        s.totalBancada || 0,
        s.valorBancada || 0,
        s.totalBau || 0,
        s.infracao30min ? '"SIM"' : '"NAO"',
        `"${(s.justificativa || s.motivoCrash || "").replace(/"/g, '""')}"`,
        `"${(s.fechadoPor || "").replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [colunas.join(","), ...linhas].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `auditoria_atividades_reds_${dataInicio}_a_${dataFim}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: "24px 28px", color: "#f8fafc", fontFamily: "var(--font-geist-sans, sans-serif)" }}>
      {/* HEADER DA PÁGINA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "28px" }}>📋</span>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
                Registro & Auditoria de Atividades dos Mecânicos
              </h1>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "3px 0 0 0" }}>
                🔴 <strong>RED'S TUNERSHOP</strong> — Histórico consolidado de pontos, tunagens, bancada, baú e compliance da regra dos 30 minutos
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => window.dispatchEvent(new Event("abrir-monitor-ponto"))}
            style={{
              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(14, 165, 233, 0.3) 100%)",
              border: "1px solid #38bdf8",
              color: "#38bdf8",
              padding: "9px 16px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "800",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            ⚡ Monitor ao Vivo
          </button>

          <button
            onClick={sincronizarComBanco}
            disabled={sincronizando}
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "none",
              color: "#fff",
              padding: "9px 16px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "800",
              cursor: sincronizando ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)"
            }}
          >
            {sincronizando ? "⏳ Sincronizando..." : "💾 Salvar no Banco (Auditoria)"}
          </button>

          <button
            onClick={exportarCSV}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#cbd5e1",
              padding: "9px 16px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            📥 Exportar CSV
          </button>

          <button
            onClick={carregarAtividades}
            disabled={carregando}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#cbd5e1",
              padding: "9px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer"
            }}
            title="Recarregar dados"
          >
            🔄
          </button>
        </div>
      </div>

      {mensagemSincronizacao && (
        <div
          style={{
            background: mensagemSincronizacao.tipo === "sucesso" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
            border: `1px solid ${mensagemSincronizacao.tipo === "sucesso" ? "#10b981" : "#f59e0b"}`,
            color: mensagemSincronizacao.tipo === "sucesso" ? "#6ee7b7" : "#fcd34d",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "20px",
            fontSize: "12px",
            fontWeight: "600"
          }}
        >
          {mensagemSincronizacao.texto}
        </div>
      )}

      {/* KPI METRICS CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        
        {/* HORAS EM SERVIÇO */}
        <div 
          onClick={() => {
            setFiltroStatus("todos");
            setPaginaAtual(1);
          }}
          title="Clique para ver todas as sessões"
          style={{ 
            background: filtroStatus === "todos" ? "rgba(56, 189, 248, 0.12)" : "rgba(30, 41, 59, 0.6)", 
            border: `1.5px solid ${filtroStatus === "todos" ? "#38bdf8" : "rgba(255, 255, 255, 0.08)"}`, 
            borderRadius: "12px", 
            padding: "14px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: filtroStatus === "todos" ? "0 0 12px rgba(56, 189, 248, 0.2)" : "none"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>⏱️ Horas em Serviço</span>
            {filtroStatus === "todos" && (
              <span style={{ fontSize: "9px", background: "#38bdf8", color: "#0f172a", padding: "1px 6px", borderRadius: "10px", fontWeight: "900" }}>TODOS</span>
            )}
          </div>
          <div style={{ fontSize: "20px", fontWeight: "900", color: "#38bdf8", marginTop: "4px" }}>{metricas.horasTexto}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{metricas.totalSessoes} expedientes no total</div>
        </div>

        {/* MECÂNICOS ATIVOS */}
        <div 
          onClick={() => {
            setFiltroStatus("todos");
            setPaginaAtual(1);
          }}
          title="Clique para ver todas as sessões"
          style={{ 
            background: "rgba(30, 41, 59, 0.6)", 
            border: "1px solid rgba(255, 255, 255, 0.08)", 
            borderRadius: "12px", 
            padding: "14px",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>👥 Mecânicos Ativos</div>
          <div style={{ fontSize: "20px", fontWeight: "900", color: "#f8fafc", marginTop: "4px" }}>{metricas.mecanicosUnicos}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>trabalharam no período</div>
        </div>

        {/* TUNAGENS FEITAS */}
        <div 
          onClick={() => {
            setFiltroStatus(prev => prev === "com_tunagem" ? "todos" : "com_tunagem");
            setPaginaAtual(1);
          }}
          title="Clique para filtrar apenas sessões com tunagens"
          style={{ 
            background: filtroStatus === "com_tunagem" ? "rgba(34, 197, 94, 0.15)" : "rgba(30, 41, 59, 0.6)", 
            border: `1.5px solid ${filtroStatus === "com_tunagem" ? "#22c55e" : "rgba(255, 255, 255, 0.08)"}`, 
            borderRadius: "12px", 
            padding: "14px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: filtroStatus === "com_tunagem" ? "0 0 14px rgba(34, 197, 94, 0.25)" : "none"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>🚗 Tunagens Feitas</span>
            {filtroStatus === "com_tunagem" && (
              <span style={{ fontSize: "9px", background: "#22c55e", color: "#0f172a", padding: "1px 6px", borderRadius: "10px", fontWeight: "900" }}>FILTRADO</span>
            )}
          </div>
          <div style={{ fontSize: "20px", fontWeight: "900", color: "#22c55e", marginTop: "4px" }}>{metricas.totalTunagens}</div>
          <div style={{ fontSize: "11px", color: "#86efac", marginTop: "2px" }}>R$ {metricas.faturamentoTunagens.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
        </div>

        {/* COMPRAS BANCADA */}
        <div 
          onClick={() => {
            setFiltroStatus(prev => prev === "com_bancada" ? "todos" : "com_bancada");
            setPaginaAtual(1);
          }}
          title="Clique para filtrar apenas sessões com compras na bancada"
          style={{ 
            background: filtroStatus === "com_bancada" ? "rgba(192, 132, 252, 0.15)" : "rgba(30, 41, 59, 0.6)", 
            border: `1.5px solid ${filtroStatus === "com_bancada" ? "#c084fc" : "rgba(255, 255, 255, 0.08)"}`, 
            borderRadius: "12px", 
            padding: "14px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: filtroStatus === "com_bancada" ? "0 0 14px rgba(192, 132, 252, 0.25)" : "none"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>🛠️ Compras Bancada</span>
            {filtroStatus === "com_bancada" && (
              <span style={{ fontSize: "9px", background: "#c084fc", color: "#0f172a", padding: "1px 6px", borderRadius: "10px", fontWeight: "900" }}>FILTRADO</span>
            )}
          </div>
          <div style={{ fontSize: "20px", fontWeight: "900", color: "#c084fc", marginTop: "4px" }}>{metricas.totalComprasBancada} itens</div>
          <div style={{ fontSize: "11px", color: "#e9d5ff", marginTop: "2px" }}>${metricas.gastoBancada.toLocaleString("pt-BR")} investidos</div>
        </div>

        {/* INFRAÇÕES 30 MIN */}
        <div 
          onClick={() => {
            setFiltroStatus(prev => prev === "infracao_30min" ? "todos" : "infracao_30min");
            setPaginaAtual(1);
          }}
          title="Clique para filtrar apenas infrações da regra dos 30 min"
          style={{ 
            background: filtroStatus === "infracao_30min" 
              ? "rgba(239, 68, 68, 0.25)" 
              : metricas.totalInfra30Min > 0 
              ? "rgba(239, 68, 68, 0.12)" 
              : "rgba(30, 41, 59, 0.6)", 
            border: `1.5px solid ${filtroStatus === "infracao_30min" ? "#ef4444" : metricas.totalInfra30Min > 0 ? "rgba(239, 68, 68, 0.4)" : "rgba(255, 255, 255, 0.08)"}`, 
            borderRadius: "12px", 
            padding: "14px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: filtroStatus === "infracao_30min" 
              ? "0 0 16px rgba(239, 68, 68, 0.4)" 
              : metricas.totalInfra30Min > 0 
              ? "0 0 8px rgba(239, 68, 68, 0.15)" 
              : "none",
            transform: filtroStatus === "infracao_30min" ? "scale(1.02)" : "scale(1)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: metricas.totalInfra30Min > 0 ? "#fca5a5" : "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>🚨 Infrações 30 Min</span>
            {filtroStatus === "infracao_30min" && (
              <span style={{ fontSize: "9px", background: "#ef4444", color: "#fff", padding: "1px 6px", borderRadius: "10px", fontWeight: "900" }}>FILTRADO</span>
            )}
          </div>
          <div style={{ fontSize: "20px", fontWeight: "900", color: metricas.totalInfra30Min > 0 ? "#f87171" : "#22c55e", marginTop: "4px" }}>{metricas.totalInfra30Min}</div>
          <div style={{ fontSize: "11px", color: metricas.totalInfra30Min > 0 ? "#fca5a5" : "#64748b", marginTop: "2px" }}>
            {filtroStatus === "infracao_30min" ? "👉 Exibindo apenas infrações" : (metricas.totalInfra30Min > 0 ? "Retiradas em < 30min (Clique p/ filtrar)" : "Tudo em conformidade")}
          </div>
        </div>

        {/* CRASHES & DUPLO CLIQUE */}
        <div 
          onClick={() => {
            setFiltroStatus(prev => prev === "crash" ? "duplo_clique" : prev === "duplo_clique" ? "todos" : "crash");
            setPaginaAtual(1);
          }}
          title="Clique para alternar entre Crash e Duplo Clique"
          style={{ 
            background: (filtroStatus === "crash" || filtroStatus === "duplo_clique") ? "rgba(245, 158, 11, 0.18)" : "rgba(30, 41, 59, 0.6)", 
            border: `1.5px solid ${(filtroStatus === "crash" || filtroStatus === "duplo_clique") ? "#f59e0b" : "rgba(255, 255, 255, 0.08)"}`, 
            borderRadius: "12px", 
            padding: "14px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: (filtroStatus === "crash" || filtroStatus === "duplo_clique") ? "0 0 14px rgba(245, 158, 11, 0.25)" : "none"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>💥 Crashes & Duplo Clique</span>
            {(filtroStatus === "crash" || filtroStatus === "duplo_clique") && (
              <span style={{ fontSize: "9px", background: "#f59e0b", color: "#0f172a", padding: "1px 6px", borderRadius: "10px", fontWeight: "900" }}>
                {filtroStatus === "crash" ? "CRASHES" : "DUPLO CLIQUE"}
              </span>
            )}
          </div>
          <div style={{ fontSize: "20px", fontWeight: "900", color: "#fbbf24", marginTop: "4px" }}>{metricas.totalCrash} / {metricas.totalDuploClique}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Crashes / Duplo cliques</div>
        </div>
      </div>

      {/* PAINEL DE FILTROS */}
      <div style={{ background: "rgba(30, 41, 59, 0.4)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", padding: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
          {/* Preset Período */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Período</span>
            <select
              value={periodoPreset}
              onChange={(e) => atualizarDatasPorPreset(e.target.value)}
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#f8fafc",
                fontSize: "12px",
                fontWeight: "700",
                padding: "8px 12px",
                borderRadius: "8px",
                outline: "none"
              }}
            >
              <option value="hoje">📅 Hoje</option>
              <option value="ontem">⏪ Ontem</option>
              <option value="semana">🗓️ Esta Semana (Seg a Dom)</option>
              <option value="semana_passada">🗓️ Semana Passada</option>
              <option value="mes">📆 Este Mês</option>
              <option value="30dias">⏱️ Últimos 30 Dias</option>
              <option value="custom">⚙️ Intervalo Personalizado...</option>
            </select>
          </div>

          {/* Data Início e Fim */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>De</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setPeriodoPreset("custom");
                  setDataInicio(e.target.value);
                }}
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: "700",
                  padding: "7px 10px",
                  borderRadius: "8px",
                  outline: "none",
                  colorScheme: "dark"
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setPeriodoPreset("custom");
                  setDataFim(e.target.value);
                }}
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: "700",
                  padding: "7px 10px",
                  borderRadius: "8px",
                  outline: "none",
                  colorScheme: "dark"
                }}
              />
            </div>
          </div>

          {/* Busca por Mecânico */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "180px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Mecânico</span>
            <input
              type="text"
              placeholder="🔍 Buscar por nome ou ID..."
              value={filtroMecanico}
              onChange={(e) => {
                setFiltroMecanico(e.target.value);
                setPaginaAtual(1);
              }}
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                fontSize: "12px",
                padding: "7.5px 12px",
                borderRadius: "8px",
                outline: "none"
              }}
            />
          </div>

          {/* Filtro por Status / Infração */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Filtro Especial</span>
            <select
              value={filtroStatus}
              onChange={(e) => {
                setFiltroStatus(e.target.value);
                setPaginaAtual(1);
              }}
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#f8fafc",
                fontSize: "12px",
                fontWeight: "700",
                padding: "8px 12px",
                borderRadius: "8px",
                outline: "none"
              }}
            >
              <option value="todos">⚙️ Todas as Sessões ({sessoes.length})</option>
              <option value="infracao_30min">🚨 Apenas Infrações Ativas ({metricas.totalInfra30Min})</option>
              <option value="infracao_liberada">🛡️ Apenas Infrações Liberadas</option>
              <option value="crash">💥 Apenas Fechamentos por Crash</option>
              <option value="inatividade">💤 Apenas Fechados por Inatividade (&gt;2h)</option>
              <option value="duplo_clique">⚡ Apenas Duplo Clique</option>
              <option value="com_tunagem">🚗 Apenas com Tunagens</option>
              <option value="com_bancada">🛠️ Apenas com Compras de Bancada</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE SESSÕES / ATIVIDADES */}
      <div style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "14px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
        {carregando ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
            <span style={{ fontSize: "28px" }}>⏳</span>
            <p style={{ marginTop: "8px", fontSize: "14px" }}>Consolidando atividades, tunagens e compras do período...</p>
          </div>
        ) : sessoesFiltradas.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#64748b" }}>
            <span style={{ fontSize: "28px" }}>📭</span>
            <p style={{ marginTop: "8px", fontSize: "14px" }}>Nenhuma sessão de ponto encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "rgba(30, 41, 59, 0.9)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.5px" }}>
                  {[
                    { key: "mecanico", label: "Mecânico" },
                    { key: "entrada", label: "Entrada" },
                    { key: "saida", label: "Saída" },
                    { key: "duracao", label: "Duração" },
                    { key: "status", label: "Status" },
                    { key: "tunagens", label: "Tunagens" },
                    { key: "bancada", label: "Bancada" },
                    { key: "bau", label: "Baú" },
                    { key: "infracao", label: "Regra 30 Min" }
                  ].map((col) => {
                    const isAtivo = ordenacaoColuna === col.key;
                    return (
                      <th
                        key={col.key}
                        onClick={() => handleOrdenar(col.key)}
                        style={{
                          padding: "12px 16px",
                          cursor: "pointer",
                          userSelect: "none",
                          color: isAtivo ? "#38bdf8" : "#94a3b8",
                          transition: "color 0.15s, background 0.15s"
                        }}
                        title={`Clique para ordenar por ${col.label}`}
                        onMouseEnter={(e) => {
                          if (!isAtivo) e.currentTarget.style.color = "#f1f5f9";
                        }}
                        onMouseLeave={(e) => {
                          if (!isAtivo) e.currentTarget.style.color = "#94a3b8";
                        }}
                      >
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <span>{col.label}</span>
                          <span style={{ fontSize: "10px", color: isAtivo ? "#38bdf8" : "#475569", fontWeight: isAtivo ? "900" : "400" }}>
                            {isAtivo ? (ordenacaoDirecao === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sessoesPaginadas.map((s, idx) => {
                  const dEnt = new Date(s.entrada);
                  const dSai = s.saida ? new Date(s.saida) : null;

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                        background: s.infracao30min ? "rgba(239, 68, 68, 0.04)" : idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = s.infracao30min ? "rgba(239, 68, 68, 0.04)" : idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)")}
                    >
                      {/* MECÂNICO */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: "800", color: "#fff" }}>{s.nome}</div>
                        <span style={{ fontSize: "10px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "1px 6px", borderRadius: "4px", fontWeight: "700" }}>
                          ID: {s.idJogo}
                        </span>
                      </td>

                      {/* ENTRADA */}
                      <td style={{ padding: "12px 16px", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                        <div>{dEnt.toLocaleDateString("pt-BR")}</div>
                        <div style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace" }}>{dEnt.toLocaleTimeString("pt-BR")}</div>
                      </td>

                      {/* SAÍDA */}
                      <td style={{ padding: "12px 16px", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                        {dSai ? (
                          <>
                            <div>{dSai.toLocaleDateString("pt-BR")}</div>
                            <div style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace" }}>{dSai.toLocaleTimeString("pt-BR")}</div>
                          </>
                        ) : (
                          <span style={{ color: "#22c55e", fontWeight: "700" }}>🟢 Em Serviço</span>
                        )}
                      </td>

                      {/* DURAÇÃO */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontWeight: "800",
                            color: s.duracaoMin < 30 ? (s.totalBau > 0 || s.totalBancada > 0 ? "#f87171" : "#fbbf24") : "#4ade80",
                            background: "rgba(0,0,0,0.3)",
                            padding: "3px 8px",
                            borderRadius: "6px"
                          }}
                        >
                          ⏱️ {s.duracaoMin} min
                        </span>
                      </td>

                      {/* STATUS */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {s.isDuploClique || s.statusPonto === "duplo_clique" ? (
                          <span style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" }}>
                            ⚡ Duplo Clique
                          </span>
                        ) : s.statusPonto === "manual_crash" || s.motivoCrash ? (
                          <span style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" }}>
                            🚨 Crash Manual
                          </span>
                        ) : s.statusPonto === "auto_inatividade" || s.isAutoFechadoInatividade ? (
                          <span style={{ background: "rgba(148, 163, 184, 0.2)", color: "#cbd5e1", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" }}>
                            💤 Inatividade (&gt;2h)
                          </span>
                        ) : !s.saida ? (
                          <span style={{ background: "rgba(34, 197, 94, 0.2)", color: "#4ade80", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" }}>
                            🟢 Aberto
                          </span>
                        ) : (
                          <span style={{ background: "rgba(255, 255, 255, 0.08)", color: "#94a3b8", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "700" }}>
                            🏁 Finalizado
                          </span>
                        )}
                      </td>

                      {/* TUNAGENS */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {s.totalTunagens > 0 ? (
                          <div>
                            <strong style={{ color: "#22c55e" }}>🚗 {s.totalTunagens}x</strong>
                            <div style={{ fontSize: "10px", color: "#86efac" }}>R$ {(s.valorTunagens || 0).toLocaleString("pt-BR")}</div>
                          </div>
                        ) : (
                          <span style={{ color: "#64748b" }}>—</span>
                        )}
                      </td>

                      {/* BANCADA */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {s.totalBancada > 0 ? (
                          <div>
                            <strong style={{ color: "#c084fc" }}>🛠️ {s.totalBancada}x</strong>
                            <div style={{ fontSize: "10px", color: "#e9d5ff" }}>${(s.valorBancada || 0).toLocaleString("pt-BR")}</div>
                          </div>
                        ) : (
                          <span style={{ color: "#64748b" }}>—</span>
                        )}
                      </td>

                      {/* BAÚ */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {s.totalBau > 0 ? (
                          <span style={{ color: "#fbbf24", fontWeight: "700" }}>📦 {s.totalBau}x movs</span>
                        ) : (
                          <span style={{ color: "#64748b" }}>—</span>
                        )}
                      </td>

                      {/* REGRA 30 MIN */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {s.infracaoLiberada ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <span 
                              title={`Infração liberada por ${s.infracaoLiberadaPor || "Dono"}${s.infracaoLiberadaEm ? ` em ${new Date(s.infracaoLiberadaEm).toLocaleString("pt-BR")}` : ""}${s.infracaoLiberadaMotivo ? `\nMotivo: ${s.infracaoLiberadaMotivo}` : ""}`}
                              style={{ 
                                background: "rgba(16, 185, 129, 0.2)", 
                                border: "1px solid #10b981", 
                                color: "#6ee7b7", 
                                padding: "3px 8px", 
                                borderRadius: "6px", 
                                fontSize: "10px", 
                                fontWeight: "800", 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: "4px",
                                cursor: "help"
                              }}
                            >
                              🛡️ Liberada
                            </span>
                            {userIsDono && (
                              <button
                                onClick={() => executarRevogarLiberacao(s)}
                                title="Revogar liberação (Dono)"
                                style={{
                                  background: "rgba(255,255,255,0.06)",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  color: "#94a3b8",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  cursor: "pointer"
                                }}
                              >
                                ↩️
                              </button>
                            )}
                          </div>
                        ) : s.infracao30min ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", color: "#fca5a5", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              🚨 Infração
                            </span>
                            {userIsDono && (
                              <button
                                onClick={() => setModalLiberar({ sessao: s, motivo: "" })}
                                title="Liberar infração (Apenas Donos)"
                                style={{
                                  background: "rgba(34, 197, 94, 0.2)",
                                  border: "1px solid #22c55e",
                                  color: "#4ade80",
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  fontWeight: "800",
                                  cursor: "pointer"
                                }}
                              >
                                🔓 Liberar
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#86efac", fontSize: "11px", fontWeight: "700" }}>
                            🛡️ OK
                          </span>
                        )}
                      </td>

                      {/* AÇÕES */}
                      <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            onClick={() => setSessaoSelecionada(s)}
                            style={{
                              background: "rgba(56, 189, 248, 0.15)",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                              color: "#38bdf8",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "700",
                              cursor: "pointer"
                            }}
                            title="Auditar todas as movimentações e itens desta sessão"
                          >
                            🔍 Auditoria
                          </button>

                          {s.infracao30min && (
                            <button
                              onClick={() => copiarAdvertenciaDiscord(s)}
                              style={{
                                background: "rgba(239, 68, 68, 0.2)",
                                border: "1px solid #ef4444",
                                color: "#f87171",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "800",
                                cursor: "pointer"
                              }}
                              title="Copiar texto de advertência para o Discord"
                            >
                              📋
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
        )}

        {/* PAGINAÇÃO */}
        {totalPaginas > 1 && (
          <div style={{ padding: "12px 16px", background: "rgba(30, 41, 59, 0.7)", borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              Mostrando página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong> ({sessoesFiltradas.length} sessões)
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#cbd5e1",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  cursor: paginaAtual === 1 ? "not-allowed" : "pointer"
                }}
              >
                ◀ Anterior
              </button>
              <button
                onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#cbd5e1",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  cursor: paginaAtual === totalPaginas ? "not-allowed" : "pointer"
                }}
              >
                Próxima ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE AUDITORIA COMPLETA */}
      {sessaoSelecionada && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setSessaoSelecionada(null)}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1.5px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              color: "#fff",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "16px", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "800", textTransform: "uppercase" }}>
                  Auditoria Detalhada de Expediente
                </span>
                <h2 style={{ fontSize: "18px", fontWeight: "900", color: "#fff", margin: "4px 0" }}>
                  {sessaoSelecionada.nome} <span style={{ color: "#94a3b8", fontSize: "14px" }}>(ID: {sessaoSelecionada.idJogo})</span>
                </h2>
                <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
                  ⏱️ <strong>{sessaoSelecionada.duracaoMin} minutos de serviço</strong> &bull; {new Date(sessaoSelecionada.entrada).toLocaleTimeString("pt-BR")} até {sessaoSelecionada.saida ? new Date(sessaoSelecionada.saida).toLocaleTimeString("pt-BR") : "Aberto"}
                </div>
              </div>

              <button
                onClick={() => setSessaoSelecionada(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  color: "#cbd5e1",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                ✕
              </button>
            </div>

            {/* ALERTA DE 30 MIN / LIBERAÇÃO */}
            {sessaoSelecionada.infracaoLiberada ? (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1.5px solid #10b981", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "16px" }}>🛡️</span>
                    <strong style={{ color: "#6ee7b7", fontSize: "13px" }}>Infração da Regra dos 30 Minutos Liberada</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "#a7f3d0", marginTop: "4px" }}>
                    Liberado por: <strong>{sessaoSelecionada.infracaoLiberadaPor || "Dono"}</strong>
                    {sessaoSelecionada.infracaoLiberadaEm && ` em ${new Date(sessaoSelecionada.infracaoLiberadaEm).toLocaleString("pt-BR")}`}
                  </div>
                  {sessaoSelecionada.infracaoLiberadaMotivo && (
                    <div style={{ fontSize: "11px", color: "#d1fae5", marginTop: "2px", fontStyle: "italic" }}>
                      Motivo: "{sessaoSelecionada.infracaoLiberadaMotivo}"
                    </div>
                  )}
                </div>
                {userIsDono && (
                  <button
                    onClick={() => executarRevogarLiberacao(sessaoSelecionada)}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#fca5a5",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontWeight: "800",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    ↩️ Revogar Liberação
                  </button>
                )}
              </div>
            ) : sessaoSelecionada.infracao30min ? (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1.5px solid #ef4444", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <strong style={{ color: "#fca5a5", fontSize: "13px" }}>🚨 Infração da Regra dos 30 Minutos Detectada!</strong>
                  <div style={{ fontSize: "11px", color: "#fecaca", marginTop: "2px" }}>
                    O mecânico permaneceu apenas <strong>{sessaoSelecionada.duracaoMin} minutos</strong> e retirou itens da oficina.
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {userIsDono && (
                    <button
                      onClick={() => setModalLiberar({ sessao: sessaoSelecionada, motivo: "" })}
                      style={{
                        background: "#16a34a",
                        border: "none",
                        color: "#fff",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontWeight: "800",
                        fontSize: "11px",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      🔓 Liberar Infração (Dono)
                    </button>
                  )}
                  <button
                    onClick={() => copiarAdvertenciaDiscord(sessaoSelecionada)}
                    style={{
                      background: "#ef4444",
                      border: "none",
                      color: "#fff",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontWeight: "800",
                      fontSize: "11px",
                      cursor: "pointer",
                      whiteSpace: "nowrap"
                    }}
                  >
                    📋 Copiar Advertência
                  </button>
                </div>
              </div>
            ) : null}

            {/* SEÇÃO CRASH / FECHAMENTO MANUAL */}
            {(sessaoSelecionada.motivoCrash || sessaoSelecionada.statusPonto === "manual_crash" || sessaoSelecionada.statusPonto === "auto_inatividade") && (
              <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
                <span style={{ fontSize: "11px", color: "#fbbf24", fontWeight: "800", textTransform: "uppercase" }}>
                  📌 Justificativa & Registro de Fechamento
                </span>
                <div style={{ fontSize: "12px", color: "#fef3c7", marginTop: "6px" }}>
                  <strong>Justificativa:</strong> {sessaoSelecionada.justificativa || sessaoSelecionada.motivoCrash || "Fechamento manual registrado."}
                </div>
                {sessaoSelecionada.fechadoPor && (
                  <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "4px" }}>
                    <strong>Fechado por:</strong> {sessaoSelecionada.fechadoPor}
                  </div>
                )}
                {sessaoSelecionada.comprovanteImg && (
                  <div style={{ marginTop: "10px" }}>
                    <span style={{ fontSize: "11px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>
                      📸 Print do Crash anexado (clique para ampliar):
                    </span>
                    <img
                      src={sessaoSelecionada.comprovanteImg}
                      alt="Comprovante de crash"
                      style={{ maxWidth: "160px", maxHeight: "100px", borderRadius: "6px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)" }}
                      onClick={() => setImagemZoom(sessaoSelecionada.comprovanteImg)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* SEÇÃO TUNAGENS */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#22c55e", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>🚗 Tunagens no Expediente ({sessaoSelecionada.detalhes?.tunagens?.length || 0})</span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "11px", color: "#86efac" }}>Passe o mouse ou clique para copiar 💬📋</span>
                  <span style={{ fontSize: "13px", color: "#4ade80", fontWeight: "800" }}>R$ {(sessaoSelecionada.valorTunagens || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              {!sessaoSelecionada.detalhes?.tunagens?.length ? (
                <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>Nenhuma tunagem realizada nesta sessão.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {sessaoSelecionada.detalhes.tunagens.map((t, idx) => {
                    const logTexto = t.rawLog || t.raw_text || (
                      `[TUNAGEM DE VEÍCULO]\n` +
                      `[Oficina]: ${t.oficina_nome || "Red's Tunershop"}\n` +
                      `[Baia]: ${t.baia_nome || "Tunagem"}\n` +
                      `[Técnico]: ${t.tecnico_nome || sessaoSelecionada.nome} (ID: ${t.tecnico_id || sessaoSelecionada.idJogo})\n` +
                      `[Dono]: ${t.dono_nome || "Cliente"} (ID: ${t.dono_id || "N/A"})\n` +
                      `[Veículo]: ${t.veiculo_nome || "Veículo"} (${t.veiculo_modelo || "N/A"})\n` +
                      `[Placa]: ${t.placa || "N/A"}\n` +
                      `[Valor Pago]: R$ ${Number(t.valor_pago || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n` +
                      `\`\`\`ini\n` +
                      `[DATA]: ${t.data ? new Date(t.data + "T12:00:00").toLocaleDateString("pt-BR") : ""}, ${t.hora || ""}\n` +
                      `[UUID]: ${t.uuid || "N/A"}\`\`\``
                    );
                    return (
                      <div 
                        key={idx}
                        onClick={() => copiarLogItem(logTexto, "Tunagem")}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredLog({
                            x: rect.left + rect.width / 2,
                            y: rect.bottom,
                            rawLog: logTexto,
                            tipo: "tunagem",
                            item: `${t.veiculo_nome || "Veículo"} (${t.placa || ""})`,
                            preco: `R$ ${(Number(t.valor_pago) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                            hora: t.hora
                          });
                        }}
                        onMouseLeave={() => setHoveredLog(null)}
                        style={{ 
                          background: "rgba(255,255,255,0.03)", 
                          padding: "8px 12px", 
                          borderRadius: "8px", 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center", 
                          border: "1px solid rgba(255,255,255,0.05)",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = "rgba(34, 197, 94, 0.1)";
                          e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.35)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "#f8fafc" }}>
                            🚗 {t.veiculo_nome || "Veículo"} {t.placa ? `(${t.placa})` : ""}
                          </div>
                          <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                            Cliente: {t.dono_nome || "Não informado"} &bull; ⏱️ {t.hora || ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "800", color: "#4ade80" }}>
                            R$ {(Number(t.valor_pago) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span style={{ fontSize: "12px", color: "#94a3b8", opacity: 0.7 }}>📋</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SEÇÃO BANCADA */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#c084fc", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>🛠️ Compras de Bancada ({sessaoSelecionada.detalhes?.bancada?.length || 0})</span>
                <span style={{ fontSize: "11px", color: "#e9d5ff" }}>Passe o mouse ou clique para copiar 💬📋</span>
              </div>
              {!sessaoSelecionada.detalhes?.bancada?.length ? (
                <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>Nenhuma compra de bancada nesta sessão.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {sessaoSelecionada.detalhes.bancada.map((bc, idx) => {
                    const logTexto = bc.rawLog || (
                      `\`\`\`ini\n` +
                      `[ITEMNAME]: ${bc.item}\n` +
                      `[ID]: ${sessaoSelecionada?.idJogo}\n` +
                      `[NOME COMPLETO]: ${sessaoSelecionada?.nome}\n` +
                      `[AÇÃO]: ${bc.acao || "buy"}\n` +
                      `[QUANTIDADE]: ${bc.qtd}\n` +
                      `[PRICE]: ${bc.preco}\n` +
                      `[HORA]: ${bc.hora}\`\`\``
                    );
                    return (
                      <div 
                        key={idx} 
                        onClick={() => copiarLogItem(logTexto, "Bancada")}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredLog({
                            x: rect.left + rect.width / 2,
                            y: rect.bottom,
                            rawLog: logTexto,
                            tipo: "bancada",
                            item: bc.item,
                            preco: bc.preco,
                            qtd: bc.qtd,
                            hora: bc.hora,
                            acao: bc.acao
                          });
                        }}
                        onMouseLeave={() => setHoveredLog(null)}
                        style={{ 
                          background: "rgba(255,255,255,0.03)", 
                          padding: "8px 12px", 
                          borderRadius: "8px", 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center", 
                          border: "1px solid rgba(255,255,255,0.05)",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = "rgba(192, 132, 252, 0.1)";
                          e.currentTarget.style.borderColor = "rgba(192, 132, 252, 0.35)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                        }}
                      >
                        <span style={{ fontSize: "12px", color: "#f8fafc" }}>
                          <strong style={{ color: "#c084fc" }}>{bc.qtd}x</strong> {bc.item}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "800", color: "#22c55e" }}>{bc.preco}</span>
                          <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace" }}>⏱️ {bc.hora}</span>
                          <span style={{ fontSize: "12px", color: "#94a3b8", opacity: 0.7 }}>📋</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SEÇÃO BAÚ */}
            <div>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#fbbf24", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>📦 Movimentações de Baú ({sessaoSelecionada.detalhes?.bau?.length || 0})</span>
                <span style={{ fontSize: "11px", color: "#fef08a" }}>Passe o mouse ou clique para copiar 💬📋</span>
              </div>
              {!sessaoSelecionada.detalhes?.bau?.length ? (
                <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>Nenhuma movimentação de baú nesta sessão.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {sessaoSelecionada.detalhes.bau.map((b, idx) => {
                    const logTexto = b.rawLog || (
                      `\`\`\`ini\n` +
                      `[AÇÃO]: ${b.acao}\n` +
                      `[ITEM]: ${b.item}\n` +
                      `[ID]: ${sessaoSelecionada?.idJogo}\n` +
                      `[NOME COMPLETO]: ${sessaoSelecionada?.nome}\n` +
                      `[HORA]: ${b.hora}\`\`\``
                    );
                    return (
                      <div 
                        key={idx} 
                        onClick={() => copiarLogItem(logTexto, "Baú")}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredLog({
                            x: rect.left + rect.width / 2,
                            y: rect.bottom,
                            rawLog: logTexto,
                            tipo: "bau",
                            item: b.item,
                            acao: b.acao,
                            hora: b.hora
                          });
                        }}
                        onMouseLeave={() => setHoveredLog(null)}
                        style={{ 
                          background: "rgba(255,255,255,0.03)", 
                          padding: "8px 12px", 
                          borderRadius: "8px", 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center", 
                          border: "1px solid rgba(255,255,255,0.05)",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = "rgba(245, 158, 11, 0.1)";
                          e.currentTarget.style.borderColor = "rgba(245, 158, 11, 0.35)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                        }}
                      >
                        <span style={{ fontSize: "12px", color: "#f8fafc" }}>
                          <strong style={{ color: b.acao === "Retirou" ? "#f87171" : "#4ade80" }}>[{b.acao}]</strong> {b.item}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace" }}>⏱️ {b.hora}</span>
                          <span style={{ fontSize: "12px", color: "#94a3b8", opacity: 0.7 }}>📋</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LIBERAÇÃO DE INFRAÇÃO (EXCLUSIVO DONOS) */}
      {modalLiberar && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
            padding: "20px"
          }}
          onClick={() => !salvandoLiberacao && setModalLiberar(null)}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1.5px solid #22c55e",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "520px",
              padding: "24px",
              color: "#fff",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <span style={{ fontSize: "24px" }}>🔓</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#4ade80" }}>
                  Liberar Infração dos 30 Minutos
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>
                  Permissão exclusiva para Donos da oficina
                </p>
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#f8fafc" }}>
                👤 {modalLiberar.sessao.nome} <span style={{ color: "#94a3b8" }}>(ID: {modalLiberar.sessao.idJogo})</span>
              </div>
              <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "4px" }}>
                ⏱️ <strong>{modalLiberar.sessao.duracaoMin} min de serviço</strong> &bull; {new Date(modalLiberar.sessao.entrada).toLocaleTimeString("pt-BR")}
              </div>
              <div style={{ fontSize: "11px", color: "#fbbf24", marginTop: "4px" }}>
                📦 Baú: {modalLiberar.sessao.totalBau}x &bull; 🛠️ Bancada: {modalLiberar.sessao.totalBancada} itens
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#cbd5e1", marginBottom: "6px", textTransform: "uppercase" }}>
                Motivo / Justificativa da Liberação (Opcional):
              </label>
              <textarea
                value={modalLiberar.motivo || ""}
                onChange={(e) => setModalLiberar({ ...modalLiberar, motivo: e.target.value })}
                placeholder="Ex: Autorizado para conserto externo de veículo de cliente..."
                rows={3}
                style={{
                  width: "100%",
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "8px",
                  padding: "10px",
                  color: "#fff",
                  fontSize: "12px",
                  outline: "none",
                  resize: "vertical"
                }}
              />

              {/* Sugestões rápidas de motivo */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {[
                  "🚗 Autorizado p/ conserto externo",
                  "🛠️ Retirada emergencial cliente VIP",
                  "⚙️ Teste de bancada / estoque",
                  "🤝 Acordo prévio com Dono"
                ].map((sugestao, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => setModalLiberar({ ...modalLiberar, motivo: sugestao })}
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#94a3b8",
                      fontSize: "10px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      cursor: "pointer"
                    }}
                  >
                    {sugestao}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={salvandoLiberacao}
                onClick={() => setModalLiberar(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#cbd5e1",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvandoLiberacao}
                onClick={() => executarLiberarInfracao(modalLiberar.sessao, modalLiberar.motivo)}
                style={{
                  background: "#16a34a",
                  border: "none",
                  color: "#fff",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "800",
                  cursor: salvandoLiberacao ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {salvandoLiberacao ? "Salvando..." : "✅ Confirmar Liberação"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZOOM DE IMAGEM */}
      {imagemZoom && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.92)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setImagemZoom(null)}
        >
          <img src={imagemZoom} alt="Zoom comprovante" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "8px", boxShadow: "0 0 30px rgba(0,0,0,0.8)" }} />
        </div>
      )}

      {/* TOOLTIP FLUTUANTE DE LOG DA COMPRA/BAÚ/TUNAGEM */}
      {hoveredLog && (
        <div
          style={{
            position: "fixed",
            top: Math.min(typeof window !== "undefined" ? window.innerHeight - 280 : 500, hoveredLog.y + 10),
            left: Math.min(typeof window !== "undefined" ? window.innerWidth - 440 : 600, Math.max(20, hoveredLog.x - 210)),
            background: "#090d16",
            border: `1.5px solid ${hoveredLog.tipo === "bau" ? "#f59e0b" : hoveredLog.tipo === "tunagem" ? "#22c55e" : "#c084fc"}`,
            borderRadius: "10px",
            padding: "12px 14px",
            color: "#f8fafc",
            boxShadow: `0 12px 35px rgba(0, 0, 0, 0.9), 0 0 20px ${hoveredLog.tipo === "bau" ? "rgba(245, 158, 11, 0.25)" : hoveredLog.tipo === "tunagem" ? "rgba(34, 197, 94, 0.25)" : "rgba(192, 132, 252, 0.25)"}`,
            zIndex: 9999999,
            pointerEvents: "none",
            minWidth: "300px",
            maxWidth: "460px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "14px" }}>
                {hoveredLog.tipo === "bau" ? "📦" : hoveredLog.tipo === "tunagem" ? "🚗" : "🛠️"}
              </span>
              <strong style={{ fontSize: "11px", color: hoveredLog.tipo === "bau" ? "#fbbf24" : hoveredLog.tipo === "tunagem" ? "#4ade80" : "#c084fc", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {hoveredLog.tipo === "bau" ? "Log de Movimentação do Baú" : hoveredLog.tipo === "tunagem" ? "Log de Tunagem de Veículo" : "Log da Compra na Bancada"}
              </strong>
            </div>
            <span style={{ fontSize: "10px", color: "#94a3b8" }}>📋 Clique para copiar</span>
          </div>
          <pre
            style={{
              margin: 0,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "11px",
              color: "#e2e8f0",
              lineHeight: "1.45",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "rgba(0, 0, 0, 0.6)",
              padding: "8px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              maxHeight: "340px",
              overflowY: "auto"
            }}
          >
            {hoveredLog.rawLog || (
              hoveredLog.tipo === "bau"
                ? `[ID]: ${sessaoSelecionada?.idJogo} ${sessaoSelecionada?.nome}\n[AÇÃO]: ${hoveredLog.acao}\n[ITEM]: ${hoveredLog.item}\n[HORA]: ${hoveredLog.hora}`
                : hoveredLog.tipo === "tunagem"
                ? `[ID]: ${sessaoSelecionada?.idJogo} ${sessaoSelecionada?.nome}\n[VEÍCULO]: ${hoveredLog.item}\n[VALOR]: ${hoveredLog.preco}\n[HORA]: ${hoveredLog.hora}`
                : `[ID]: ${sessaoSelecionada?.idJogo} ${sessaoSelecionada?.nome}\n[AÇÃO]: ${hoveredLog.acao || "buy"}\n[ITEM]: ${hoveredLog.item}\n[QUANTIDADE]: ${hoveredLog.qtd}\n[VALOR]: ${hoveredLog.preco}\n[HORA]: ${hoveredLog.hora}`
            )}
          </pre>
        </div>
      )}

      {/* TOAST DE FEEDBACK DE CÓPIA */}
      {toastCopiado && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "linear-gradient(135deg, #0f172a, #1e1b4b)",
            border: "1px solid #818cf8",
            borderRadius: "10px",
            padding: "12px 20px",
            color: "#f8fafc",
            fontSize: "13px",
            fontWeight: "700",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(99, 102, 241, 0.35)",
            zIndex: 99999999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeIn 0.2s ease-out"
          }}
        >
          <span>✨</span>
          <span>{toastCopiado}</span>
        </div>
      )}
    </div>
  );
}
