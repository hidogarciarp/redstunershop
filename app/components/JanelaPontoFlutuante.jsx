"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { isAdminOuDono, isResponsavelPonto } from "../utils/helpers";
import ModalDetalheTunagem from "./ModalDetalheTunagem";

// Cache em memória para evitar que os pontos sumam ao re-renderizar
let cachePontosAbertos = [];
let cachePontosFinalizados = [];
let cacheCarregado = false;

export default function JanelaPontoFlutuante({ usuarioLogado, theme, isDarkMode }) {
  const [minimizado, setMinimizado] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("janela_ponto_flutuante_minimizado");
      if (saved !== null) return saved === "true";
    }
    return true;
  });

  const alternarMinimizado = useCallback((val) => {
    setMinimizado(val);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("janela_ponto_flutuante_minimizado", String(val));
    }
  }, []);

  const [abaAtiva, setAbaAtiva] = useState("abertos"); // "abertos" | "finalizados" | "todos"
  const [filtroOficina, setFiltroOficina] = useState("reds"); // "reds" | "todas" | "vespucci" | "harmony" | "dudark"
  const [filtroPeriodo, setFiltroPeriodo] = useState("hoje"); // "hoje" | "ontem" | "24h" | "3dias" | "7dias" | "custom"
  const [dataPersonalizada, setDataPersonalizada] = useState(() => new Date().toISOString().split("T")[0]);
  const [buscaTexto, setBuscaTexto] = useState("");
  const [pontosAbertos, setPontosAbertos] = useState(() => cachePontosAbertos);
  const [pontosFinalizados, setPontosFinalizados] = useState(() => cachePontosFinalizados);
  const [carregando, setCarregando] = useState(() => !cacheCarregado);
  const [agoraTs, setAgoraTs] = useState(Date.now());
  const [somAtivo, setSomAtivo] = useState(true);
  const [funcionarioInspecao, setFuncionarioInspecao] = useState(null);
  const [modalLogTunagemDetalhe, setModalLogTunagemDetalhe] = useState(null);
  const [atividadesPonto, setAtividadesPonto] = useState(null);
  const [carregandoAtividades, setCarregandoAtividades] = useState(false);
  const [hoveredLog, setHoveredLog] = useState(null); // { x, y, rawLog, item, preco, qtd, hora, acao, tipo }
  const [toastCopiado, setToastCopiado] = useState(null);
  const janelaRef = useRef(null);
  const arrasteRef = useRef(null);
  const [posicaoJanela, setPosicaoJanela] = useState(null);

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

  // Estados do Fechamento por Crash / Manual
  const [modoFecharCrash, setModoFecharCrash] = useState(false);
  const [saidaDataHoraCrash, setSaidaDataHoraCrash] = useState("");
  const [justificativaCrash, setJustificativaCrash] = useState("");
  const [printCrashBase64, setPrintCrashBase64] = useState(null);
  const [enviandoCrash, setEnviandoCrash] = useState(false);
  const [imagemZoom, setImagemZoom] = useState(null);

  // Permissão: Donos, Gerentes, Admins e Responsáveis pelo Ponto
  const podeAdministrarMonitor = Boolean(
    usuarioLogado &&
    (isAdminOuDono(usuarioLogado.role) ||
      isResponsavelPonto(usuarioLogado.role) ||
      (usuarioLogado.role && (
        usuarioLogado.role.includes("dono") ||
        usuarioLogado.role.includes("admin") ||
        usuarioLogado.role.includes("gerente") ||
        usuarioLogado.role.includes("resp_ponto")
      )))
  );
  const isAuthorized = Boolean(usuarioLogado);

  const iniciarArraste = useCallback((e) => {
    if (e.button !== 0 || e.target.closest("button, input, select, textarea, a")) return;
    const janela = janelaRef.current;
    if (!janela) return;
    const rect = janela.getBoundingClientRect();
    arrasteRef.current = { inicioX: e.clientX, inicioY: e.clientY, x: rect.left, y: rect.top, largura: rect.width, altura: rect.height };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }, []);

  const arrastarJanela = useCallback((e) => {
    const inicio = arrasteRef.current;
    if (!inicio) return;
    const margem = 8;
    const maxX = Math.max(margem, window.innerWidth - inicio.largura - margem);
    const maxY = Math.max(margem, window.innerHeight - inicio.altura - margem);
    setPosicaoJanela({
      x: Math.min(maxX, Math.max(margem, inicio.x + e.clientX - inicio.inicioX)),
      y: Math.min(maxY, Math.max(margem, inicio.y + e.clientY - inicio.inicioY))
    });
  }, []);

  const finalizarArraste = useCallback(() => {
    arrasteRef.current = null;
  }, []);

  // Helper para obter data/hora local atual formatada para datetime-local
  const getAgoraLocalISO = () => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  // Timer para atualizar os cronômetros a cada segundo e listener de abertura
  useEffect(() => {
    const timer = setInterval(() => {
      setAgoraTs(Date.now());
    }, 1000);

    const handleOpen = () => alternarMinimizado(false);
    window.addEventListener("abrir-monitor-ponto", handleOpen);

    return () => {
      clearInterval(timer);
      window.removeEventListener("abrir-monitor-ponto", handleOpen);
    };
  }, [alternarMinimizado]);

  // Helper para processar e comprimir imagem do comprovante para Base64 leve
  const processarImagemParaBase64 = (file) => {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("O arquivo selecionado não é uma imagem válida."));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width = Math.round((width * MAX_HEIGHT) / height);
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
            resolve(dataUrl);
          } catch (err) {
            resolve(e.target.result);
          }
        };
        img.onerror = () => reject(new Error("Erro ao carregar a imagem."));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
      reader.readAsDataURL(file);
    });
  };

  // Helper para colar imagem da área de transferência (Ctrl+V)
  const handleColarImagem = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          try {
            const base64 = await processarImagemParaBase64(file);
            setPrintCrashBase64(base64);
          } catch (err) {
            alert("❌ Erro ao colar imagem: " + err.message);
          }
        }
      }
    }
  };

  // Helper para tocar som de alerta (entrada, saída ou inatividade)
  const tocarSomNotificacao = (tipo = "entrada") => {
    if (!somAtivo) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      if (tipo === "entrada") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (tipo === "saida") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(783.99, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (tipo === "alerta" || tipo === "inativo") {
        // Alerta sonoro de inatividade: tom duplo de aviso
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.15); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
      }
    } catch (e) {}
  };

  // Parser de mensagens do Discord para extrair dados do ponto
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

  const carregarPontosRecentes = useCallback(async (silencioso = false) => {
    if (!silencioso && !cacheCarregado) setCarregando(true);
    try {
      let inicioFiltroISO;
      let fimFiltroISO = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      let lookbackMs = 36 * 60 * 60 * 1000;

      if (filtroPeriodo === "hoje") {
        const hojeObj = new Date();
        hojeObj.setHours(0, 0, 0, 0);
        inicioFiltroISO = hojeObj.toISOString();
        lookbackMs = 36 * 60 * 60 * 1000;
      } else if (filtroPeriodo === "ontem") {
        const ontemInicio = new Date();
        ontemInicio.setDate(ontemInicio.getDate() - 1);
        ontemInicio.setHours(0, 0, 0, 0);
        inicioFiltroISO = ontemInicio.toISOString();
        const ontemFim = new Date();
        ontemFim.setDate(ontemFim.getDate() - 1);
        ontemFim.setHours(23, 59, 59, 999);
        fimFiltroISO = ontemFim.toISOString();
        lookbackMs = 60 * 60 * 60 * 1000;
      } else if (filtroPeriodo === "24h") {
        inicioFiltroISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        lookbackMs = 36 * 60 * 60 * 1000;
      } else if (filtroPeriodo === "3dias") {
        inicioFiltroISO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        lookbackMs = 4 * 24 * 60 * 60 * 1000;
      } else if (filtroPeriodo === "7dias") {
        inicioFiltroISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        lookbackMs = 8 * 24 * 60 * 60 * 1000;
      } else if (filtroPeriodo === "custom" && dataPersonalizada) {
        const [yyyy, mm, dd] = dataPersonalizada.split("-");
        const dtInicio = new Date(`${yyyy}-${mm}-${dd}T00:00:00-03:00`);
        const dtFim = new Date(`${yyyy}-${mm}-${dd}T23:59:59-03:00`);
        inicioFiltroISO = dtInicio.toISOString();
        fimFiltroISO = dtFim.toISOString();
        const dtLookback = new Date(dtInicio.getTime() - 12 * 60 * 60 * 1000);
        lookbackMs = Date.now() - dtLookback.getTime();
      } else {
        inicioFiltroISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      }

      const lookbackISO = new Date(Date.now() - Math.max(lookbackMs, 36 * 60 * 60 * 1000)).toISOString();

      // 1. Logs de ponto
      const { data: logsDiscord, error } = await supabase
        .from("discord_log_messages")
        .select("*")
        .eq("log_type", "ponto")
        .gte("created_at", lookbackISO)
        .order("id", { ascending: true })
        .limit(2000);

      if (error) throw error;

      // 2. Logs de bancada para detectar última movimentação
      const { data: logsAtividades } = await supabase
        .from("discord_log_messages")
        .select("id, log_type, content, created_at")
        .eq("log_type", "bancada")
        .gte("created_at", lookbackISO)
        .order("id", { ascending: true });

      // 3. Logs de tunagem (prioriza logs_tunagem_reds)
      let logsTunagem = [];
      try {
        const { data: dataTunReds } = await supabase
          .from("logs_tunagem_reds")
          .select("tecnico_id, tecnico_nome, data, hora")
          .gte("data", lookbackISO.split("T")[0]);
        if (dataTunReds && dataTunReds.length > 0) {
          logsTunagem = dataTunReds;
        } else {
          const { data: dataTunGeral } = await supabase
            .from("logs_tunagem")
            .select("tecnico_id, tecnico_nome, data, hora")
            .gte("data", lookbackISO.split("T")[0]);
          logsTunagem = dataTunGeral || [];
        }
      } catch (e) {
        logsTunagem = [];
      }

      // 4. Logs de baú para detectar ações do mecânico
      const { data: logsBau } = await supabase
        .from("discord_log_messages")
        .select("id, log_type, content, created_at")
        .eq("log_type", "bau")
        .gte("created_at", lookbackISO)
        .order("id", { ascending: true });

      // Mapeia todas as atividades registradas por idJogo (bancada, tunagem e baú)
      const mapaAtividadesMecanico = {};
      const mapaTunagensMecanico = {};

      (logsAtividades || []).forEach((msg) => {
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

          if (!mapaTunagensMecanico[id]) mapaTunagensMecanico[id] = [];
          mapaTunagensMecanico[id].push(ts);
        }
      });

      Object.values(mapaTunagensMecanico).forEach((arr) => arr.sort((a, b) => a - b));

      (logsBau || []).forEach((msg) => {
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

      Object.values(mapaAtividadesMecanico).forEach((arr) => arr.sort((a, b) => a - b));

      const mapaMecanicos = {};

      (logsDiscord || []).forEach((msg) => {
        const parsed = parseDiscordPontoMessage(msg.content, msg.created_at, msg.embed_data);
        if (!parsed || !parsed.idJogo) return;

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

      const todosAbertos = [];
      const todosFinalizados = [];
      const chavesFinalizados = new Set();
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
                // Mais de 1h sem saída antes da nova entrada: sessão anterior encerrou por inatividade/crash!
                const ativsNaSessao = ativs.filter((ts) => ts >= entMs && ts <= (entMs + 24 * 60 * 60 * 1000) && ts < proxEntMs);
                let ultAtivMs = entMs;
                const teveAtividade = ativsNaSessao.length > 0;
                if (teveAtividade) {
                  ultAtivMs = ativsNaSessao[ativsNaSessao.length - 1];
                }

                pontoAtual.saida = new Date(ultAtivMs).toISOString();
                pontoAtual.isAutoFechadoInatividade = true;
                pontoAtual.duracaoMin = Math.max(1, Math.round((ultAtivMs - entMs) / 60000));
                pontoAtual.motivoAutoFechamento = teveAtividade
                  ? `Encerrado automaticamente por inatividade (> 60 min sem saída). Última atividade às ${new Date(ultAtivMs).toLocaleTimeString("pt-BR")}`
                  : `Encerrado automaticamente por inatividade (> 60 min sem movimentação desde a abertura).`;
              } else {
                pontoAtual.saida = ev.timestamp;
                pontoAtual.duracaoMin = Math.max(1, Math.round(diffMs / 60000));
              }

              const chaveAnt = pontoAtual.uuidSaida || `${pontoAtual.idJogo}_${pontoAtual.entrada}_${pontoAtual.saida}`;
              if (!chavesFinalizados.has(chaveAnt)) {
                chavesFinalizados.add(chaveAnt);
                todosFinalizados.push(pontoAtual);
              }
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
              const isDuplo = diffMs <= 60000;
              pontoAtual.saida = ev.timestamp;
              pontoAtual.uuidSaida = ev.uuid;
              pontoAtual.motivoCrash = ev.motivoCrash;
              pontoAtual.justificativa = ev.justificativa;
              pontoAtual.comprovanteImg = ev.comprovanteImg;
              pontoAtual.fechadoPor = ev.fechadoPor;
              pontoAtual.isDuploClique = isDuplo;
              pontoAtual.duracaoMin = Math.max(1, Math.round(diffMs / 60000));

              const chave = pontoAtual.uuidSaida || `${pontoAtual.idJogo}_${pontoAtual.entrada}_${pontoAtual.saida}`;
              if (!chavesFinalizados.has(chave)) {
                chavesFinalizados.add(chave);
                todosFinalizados.push(pontoAtual);
              }
              pontoAtual = null;
            } else {
              const pAvulso = {
                idJogo: mec.idJogo,
                nome: mec.nome,
                oficina: ev.oficina,
                oficinaId: ev.oficinaId,
                entrada: ev.timestamp,
                uuidEntrada: null,
                saida: ev.timestamp,
                uuidSaida: ev.uuid,
                duracaoMin: 1,
                isDuploClique: true,
                isAutoFechadoInatividade: false,
                motivoCrash: ev.motivoCrash,
                justificativa: ev.justificativa,
                comprovanteImg: ev.comprovanteImg,
                fechadoPor: ev.fechadoPor
              };
              const chave = ev.uuid || `${mec.idJogo}_${ev.timestamp}_saida_avulsa`;
              if (!chavesFinalizados.has(chave)) {
                chavesFinalizados.add(chave);
                todosFinalizados.push(pAvulso);
              }
            }
          }
        }

        // Se o ponto ficou sem saída: checa inatividade de 60 minutos (1 hora)
        if (pontoAtual && !pontoAtual.saida) {
          const entMs = new Date(pontoAtual.entrada).getTime();
          const ativsNaSessao = ativs.filter((ts) => ts >= entMs);
          let ultAtivMs = entMs;
          const teveAtividade = ativsNaSessao.length > 0;
          if (teveAtividade) {
            ultAtivMs = ativsNaSessao[ativsNaSessao.length - 1];
          }

          const agoraSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
          const hojeStr = agoraSP.toLocaleDateString("en-CA");
          const inicioHojeMs = new Date(`${hojeStr}T00:00:00-03:00`).getTime();
          const fimHojeMs = new Date(`${hojeStr}T23:59:59-03:00`).getTime();

          const tunagensDoMec = mapaTunagensMecanico[mec.idJogo] || [];
          const tunagensHoje = tunagensDoMec.filter((ts) => ts >= inicioHojeMs && ts <= fimHojeMs);
          const tunagensNaSessao = tunagensDoMec.filter((ts) => ts >= entMs);
          let ultTunagemMs = null;
          if (tunagensNaSessao.length > 0) {
            ultTunagemMs = tunagensNaSessao[tunagensNaSessao.length - 1];
          }

          pontoAtual.ultimaAtividadeMs = ultAtivMs;
          pontoAtual.qtdAtividadesSessao = ativsNaSessao.length;
          pontoAtual.ultimaTunagemMs = ultTunagemMs;
          pontoAtual.qtdTunagensSessao = tunagensNaSessao.length;
          pontoAtual.qtdTunagensHoje = tunagensHoje.length;

          const tempoDesdeUltimaMov = agora - ultAtivMs;

          if (tempoDesdeUltimaMov >= UMA_HORA_MS) {
            // Mais de 60 minutos sem movimentação: AUTO-FECHAMENTO POR CRASH/INATIVIDADE
            pontoAtual.saida = new Date(ultAtivMs).toISOString();
            pontoAtual.isAutoFechadoInatividade = true;
            pontoAtual.duracaoMin = Math.max(
              1,
              Math.round((ultAtivMs - entMs) / 60000)
            );
            pontoAtual.motivoAutoFechamento = teveAtividade
              ? `Encerrado automaticamente por inatividade (> 60 min sem movimentação). Última atividade registrada às ${new Date(ultAtivMs).toLocaleTimeString("pt-BR")}`
              : `Encerrado automaticamente por inatividade (> 60 min sem nenhuma atividade desde a entrada).`;

            const chaveAuto = `auto_${pontoAtual.idJogo}_${pontoAtual.entrada}_${pontoAtual.saida}`;
            if (!chavesFinalizados.has(chaveAuto)) {
              chavesFinalizados.add(chaveAuto);
              todosFinalizados.push(pontoAtual);
            }
          } else {
            todosAbertos.push(pontoAtual);
          }
        }
      });

      // Filtra os finalizados que pertencerem ao período selecionado
      const finalizadosPeriodo = todosFinalizados.filter((p) => {
        const entTs = p.entrada ? new Date(p.entrada).getTime() : 0;
        const saiTs = p.saida ? new Date(p.saida).getTime() : 0;
        const iniTs = new Date(inicioFiltroISO).getTime();
        const fimTs = new Date(fimFiltroISO).getTime();

        const entPeriodo = entTs >= iniTs && entTs <= fimTs;
        const saiPeriodo = saiTs >= iniTs && saiTs <= fimTs;
        return entPeriodo || saiPeriodo;
      });

      todosAbertos.sort((a, b) => new Date(b.entrada) - new Date(a.entrada));
      finalizadosPeriodo.sort((a, b) => new Date(b.saida) - new Date(a.saida));

      cachePontosAbertos = todosAbertos;
      cachePontosFinalizados = finalizadosPeriodo;
      cacheCarregado = true;

      setPontosAbertos(todosAbertos);
      setPontosFinalizados(finalizadosPeriodo);
    } catch (e) {
      console.error("Erro ao carregar pontos em tempo real:", e);
    } finally {
      setCarregando(false);
    }
  }, [filtroPeriodo, dataPersonalizada]);

  useEffect(() => {
    if (isAuthorized) {
      carregarPontosRecentes();
    }
  }, [isAuthorized, carregarPontosRecentes]);

  // Realtime subscription
  useEffect(() => {
    if (!isAuthorized) return;

    const canal = supabase
      .channel("janela-ponto-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "discord_log_messages" },
        () => {
          carregarPontosRecentes(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [isAuthorized, carregarPontosRecentes]);

  const abrirAuditoriaFuncionario = async (ponto) => {
    setFuncionarioInspecao(ponto);
    setModoFecharCrash(false);
    setJustificativaCrash("");
    setPrintCrashBase64(null);
    setSaidaDataHoraCrash(getAgoraLocalISO());
    setCarregandoAtividades(true);
    setAtividadesPonto(null);

    const dataEntradaISO = new Date(ponto.entrada).toISOString();
    const dataSaidaISO = ponto.saida ? new Date(ponto.saida).toISOString() : new Date().toISOString();

    try {
      let logsTunagem = [];
      try {
        const { data: dataTunReds } = await supabase
          .from("logs_tunagem_reds")
          .select("*")
          .or(`tecnico_id.eq.${ponto.idJogo},tecnico_nome.ilike.%${ponto.nome}%`)
          .gte("data", dataEntradaISO.split("T")[0]);
        if (dataTunReds && dataTunReds.length > 0) {
          logsTunagem = dataTunReds;
        } else {
          const { data: dataTunGeral } = await supabase
            .from("logs_tunagem")
            .select("*")
            .or(`tecnico_id.eq.${ponto.idJogo},tecnico_nome.ilike.%${ponto.nome}%`)
            .gte("data", dataEntradaISO.split("T")[0]);
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
            const ent = new Date(dataEntradaISO).getTime();
            const sai = new Date(dataSaidaISO).getTime();
            return dt >= ent - 60000 && dt <= sai + 60000;
          } catch (e) {
            return false;
          }
        })
        .map((t) => {
          const rawLogTunagem = t.raw_text || (
            `[TUNAGEM DE VEÍCULO]\n` +
            `[Oficina]: ${t.oficina_nome || "Red's Tunershop"}\n` +
            `[Baia]: ${t.baia_nome || "Tunagem"}\n` +
            `[Técnico]: ${t.tecnico_nome || ponto.nome} (ID: ${t.tecnico_id || ponto.idJogo})\n` +
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

      const { data: logsBau } = await supabase
        .from("discord_log_messages")
        .select("*")
        .eq("log_type", "bau")
        .gte("created_at", dataEntradaISO)
        .lte("created_at", dataSaidaISO)
        .order("id", { ascending: false });

      const bauItens = [];
      (logsBau || []).forEach((msg) => {
        const c = msg.content || "";
        if (c.includes(`[ID]: ${ponto.idJogo}`) || c.toLowerCase().includes(ponto.nome.toLowerCase())) {
          const retMatch = c.match(/\[RETIROU\]:\s*([^\n\r]+)/i);
          const colMatch = c.match(/\[COLOCOU\]:\s*([^\n\r]+)/i);
          const horaMatch = c.match(/\[DATA\]:\s*\d{2}\/\d{2}\/\d{4},\s*(\d{2}:\d{2}:\d{2})/i);
          const horaStr = horaMatch ? horaMatch[1] : new Date(msg.created_at).toLocaleTimeString("pt-BR");

          if (retMatch) {
            bauItens.push({ acao: "Retirou", item: retMatch[1].trim(), hora: horaStr, rawLog: c });
          }
          if (colMatch) {
            bauItens.push({ acao: "Colocou", item: colMatch[1].trim(), hora: horaStr, rawLog: c });
          }
        }
      });

      const { data: logsBancada } = await supabase
        .from("discord_log_messages")
        .select("*")
        .eq("log_type", "bancada")
        .gte("created_at", dataEntradaISO)
        .lte("created_at", dataSaidaISO)
        .order("id", { ascending: false });

      const bancadaItens = [];
      (logsBancada || []).forEach((msg) => {
        const c = msg.content || "";
        if (c.includes(`[ID]: ${ponto.idJogo}`) || (ponto.nome && c.toLowerCase().includes(ponto.nome.toLowerCase()))) {
          const itemMatch = c.match(/\[(?:ITEMNAME|ITEM|ITEMKEY)\]:\s*([^\n\r]+)/i);
          const qtdMatch = c.match(/\[(?:QUANTIDADE|QTD)\]:\s*(\d+)/i);
          const precoMatch = c.match(/\[(?:PRICE|VALOR|PRE[ÇC]O)\]:\s*([^\n\r]+)/i);
          const acaoMatch = c.match(/\[A[ÇC][ÃA]O\]:\s*([^\n\r]+)/i);
          const horaMatch = c.match(/\[DATA\]:\s*\d{2}\/\d{2}\/\d{4},\s*(\d{2}:\d{2}:\d{2})/i);
          const horaStr = horaMatch ? horaMatch[1] : new Date(msg.created_at).toLocaleTimeString("pt-BR");

          let precoFormatado = precoMatch ? precoMatch[1].trim() : "0";
          if (!precoFormatado.startsWith("$") && !precoFormatado.startsWith("R$")) {
            precoFormatado = `$${precoFormatado}`;
          }

          bancadaItens.push({
            item: itemMatch ? itemMatch[1].trim() : "Item de Bancada",
            qtd: qtdMatch ? qtdMatch[1].trim() : "1",
            preco: precoFormatado,
            acao: acaoMatch ? acaoMatch[1].trim() : "buy",
            hora: horaStr,
            rawLog: c
          });
        }
      });

      const { data: servicosGerais } = await supabase
        .from("servicos")
        .select("*")
        .eq("mecanico", ponto.nome)
        .gte("data", dataEntradaISO.split("T")[0]);

      setAtividadesPonto({
        tunagens: tunagensNoPeriodo,
        bau: bauItens,
        bancada: bancadaItens,
        servicos: servicosGerais || []
      });
    } catch (e) {
      console.error("Erro ao buscar atividades do ponto:", e);
    } finally {
      setCarregandoAtividades(false);
    }
  };

  const formatarTempo = (ms) => {
    if (ms <= 0) return "00:00:00";
    const totalSegundos = Math.floor(ms / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  };

  const aplicarFiltrosLista = (lista) => {
    let res = lista;
    if (filtroOficina !== "todas") {
      res = res.filter((p) => p.oficinaId === filtroOficina);
    }
    if (buscaTexto.trim()) {
      const b = buscaTexto.toLowerCase().trim();
      res = res.filter(
        (p) => (p.nome && p.nome.toLowerCase().includes(b)) || (p.idJogo && p.idJogo.includes(b))
      );
    }
    return res;
  };

  const pontosAbertosFiltrados = useMemo(
    () => aplicarFiltrosLista(pontosAbertos),
    [pontosAbertos, filtroOficina, buscaTexto]
  );

  const pontosFinalizadosFiltrados = useMemo(
    () => aplicarFiltrosLista(pontosFinalizados),
    [pontosFinalizados, filtroOficina, buscaTexto]
  );

  const todosDoDiaFiltrados = useMemo(() => {
    const mapa = new Map();
    pontosFinalizados.forEach((p) => {
      const key = p.uuidSaida || `${p.idJogo}_${p.entrada}_${p.saida}`;
      mapa.set(key, p);
    });
    pontosAbertos.forEach((p) => {
      const key = p.uuidEntrada || `${p.idJogo}_${p.entrada}_aberto`;
      mapa.set(key, p);
    });

    const todos = Array.from(mapa.values());
    todos.sort((a, b) => new Date(b.entrada) - new Date(a.entrada));
    return aplicarFiltrosLista(todos);
  }, [pontosAbertos, pontosFinalizados, filtroOficina, buscaTexto]);

  const isDono = Boolean(
    usuarioLogado &&
    (isAdminOuDono(usuarioLogado.role) ||
      (usuarioLogado.role && (
        usuarioLogado.role.includes("dono") ||
        usuarioLogado.role.includes("admin")
      )))
  );

  useEffect(() => {
    if (!podeAdministrarMonitor) {
      if (filtroOficina !== "reds") setFiltroOficina("reds");
      if (abaAtiva !== "fila") setAbaAtiva("fila");
    }
  }, [podeAdministrarMonitor, filtroOficina, abaAtiva]);

  const filaMecanicos = useMemo(() => {
    const pontosDaFila = isDono
      ? pontosAbertosFiltrados
      : aplicarFiltrosLista(pontosAbertos).filter((p) => p.oficinaId === "reds" || (p.oficina || "").toLowerCase().includes("red"));
    const lista = (pontosDaFila || []).map((p) => {
      const entMs = new Date(p.entrada).getTime();
      const refMs = p.ultimaTunagemMs || entMs;
      const tempoEsperaMs = Math.max(0, agoraTs - refMs);
      return {
        ...p,
        tempoEsperaMs,
        minutosEspera: Math.floor(tempoEsperaMs / 60000),
        referenciaMs: refMs
      };
    });
    // Quem está há mais tempo esperando fica no topo (1º lugar)
    lista.sort((a, b) => b.tempoEsperaMs - a.tempoEsperaMs);
    return lista;
  }, [pontosAbertosFiltrados, pontosAbertos, agoraTs, isDono, buscaTexto]);

  const handleConfirmarFechamentoCrash = async () => {
    if (!funcionarioInspecao) return;

    if (!justificativaCrash.trim()) {
      alert("⚠️ Por favor, preencha a justificativa da solicitação de fechamento do ponto (motivo do crash).");
      return;
    }

    if (!printCrashBase64) {
      alert("⚠️ É obrigatório anexar o print do crash ou comprovante.");
      return;
    }

    if (!saidaDataHoraCrash) {
      alert("⚠️ Por favor, informe a data e o horário de saída do crash.");
      return;
    }

    const dataSaidaObj = new Date(saidaDataHoraCrash);
    const dataEntradaObj = new Date(funcionarioInspecao.entrada);

    if (dataSaidaObj < dataEntradaObj) {
      alert("⚠️ O horário de saída do crash não pode ser anterior ao horário de entrada!");
      return;
    }

    setEnviandoCrash(true);
    try {
      const dia = String(dataSaidaObj.getDate()).padStart(2, "0");
      const mes = String(dataSaidaObj.getMonth() + 1).padStart(2, "0");
      const ano = dataSaidaObj.getFullYear();
      const hora = String(dataSaidaObj.getHours()).padStart(2, "0");
      const min = String(dataSaidaObj.getMinutes()).padStart(2, "0");
      const seg = String(dataSaidaObj.getSeconds()).padStart(2, "0");

      const dataFormatadaDiscord = `${dia}/${mes}/${ano}, ${hora}:${min}:${seg}`;
      const idJogo = funcionarioInspecao.idJogo;
      const nome = funcionarioInspecao.nome;
      const oficina = funcionarioInspecao.oficina || "Red's Tunershop";
      const dataSaidaISO = dataSaidaObj.toISOString();

      const contentDiscord = `[ID]: ${idJogo} ${nome} ( SAIU DE SERVIÇO - ${oficina} )\n[DATA]: ${dataFormatadaDiscord}\n[MOTIVO_CRASH]: ${justificativaCrash.trim()}\n[FECHADO_POR]: ${usuarioLogado?.nome || "Admin"}\n[UUID]: manual-crash-${Date.now()}`;

      const embedDataPayload = {
        motivo: "crash",
        justificativa: justificativaCrash.trim(),
        fechado_por_nome: usuarioLogado?.nome || "Administrador",
        fechado_por_id: usuarioLogado?.id || null,
        imagem_comprovante: printCrashBase64,
        horario_saida_manual: dataSaidaISO,
        tipo_fechamento: "manual_crash",
        criado_em: new Date().toISOString()
      };

      const { error: discordError } = await supabase.from("discord_log_messages").insert([
        {
          discord_id: String(Date.now()),
          channel_id: "manual-crash",
          mechanic_id: funcionarioInspecao.oficinaId || "reds",
          log_type: "ponto",
          author_name: `${usuarioLogado?.nome || "Admin"} (Fechamento Manual / Crash)`,
          content: contentDiscord,
          embed_data: embedDataPayload,
          created_at: dataSaidaISO
        }
      ]);

      if (discordError) throw discordError;

      try {
        await supabase
          .from("ponto_horas")
          .update({
            saida: dataSaidaISO,
            verificado: true,
            verificado_por: usuarioLogado?.nome || "Admin"
          })
          .eq("nome", nome)
          .is("saida", null);
      } catch (e) {
        console.warn("Aviso ao atualizar tabela ponto_horas:", e);
      }

      tocarSomNotificacao("saida");
      alert("✅ Ponto fechado com sucesso por motivo de Crash!");

      setModoFecharCrash(false);
      setJustificativaCrash("");
      setPrintCrashBase64(null);
      setFuncionarioInspecao(null);
      await carregarPontosRecentes();
    } catch (err) {
      console.error("Erro ao fechar ponto por crash:", err);
      alert("❌ Erro ao fechar ponto: " + (err.message || "Erro inesperado"));
    } finally {
      setEnviandoCrash(false);
    }
  };

  const copiarAdvertenciaDiscord = (ponto, atividades) => {
    const duracao = ponto.saida
      ? `${ponto.duracaoMin} minutos`
      : `${Math.round((Date.now() - new Date(ponto.entrada).getTime()) / 60000)} minutos (Ainda Aberto)`;

    const horaEntrada = new Date(ponto.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const horaSaida = ponto.saida
      ? new Date(ponto.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "Em aberto";

    const totalBau = atividades?.bau?.length || 0;
    const totalBancada = atividades?.bancada?.length || 0;
    const totalTunagens = atividades?.tunagens?.length || 0;

    let texto = `🚨 **NOTIFICAÇÃO DE DESCUMPRIMENTO DA REGRA DOS 30 MINUTOS** 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 **Mecânico:** ${ponto.nome} (ID: ${ponto.idJogo})
🏢 **Oficina:** ${ponto.oficina}
📅 **Data:** ${new Date(ponto.entrada).toLocaleDateString("pt-BR")}
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

  if (!isAuthorized) return null;

  return (
    <>
      {minimizado ? (
        <div
          onClick={() => alternarMinimizado(false)}
          style={{
            position: "fixed",
            bottom: "85px",
            right: "20px",
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1.5px solid rgba(56, 189, 248, 0.4)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.25)",
            borderRadius: "50px",
            padding: "8px 18px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            color: "#fff",
            fontFamily: "var(--font-geist-sans, sans-serif)",
            transition: "all 0.2s ease"
          }}
          title="Clique para abrir a Janela de Ponto em Tempo Real"
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: pontosAbertosFiltrados.length > 0 ? "#22c55e" : "#64748b",
              boxShadow: pontosAbertosFiltrados.length > 0 ? "0 0 10px #22c55e" : "none"
            }}
          />
          <span style={{ fontSize: "13px", fontWeight: "800", color: "#f8fafc" }}>
            {podeAdministrarMonitor ? "⏱️ Ponto:" : "🎯 Fila RED'S:"} <strong style={{ color: "#38bdf8" }}>{podeAdministrarMonitor ? pontosAbertosFiltrados.length : filaMecanicos.length}</strong> em serviço
          </span>
          {podeAdministrarMonitor && (() => {
            const inativosCount = pontosAbertosFiltrados.filter(
              (p) => agoraTs - (p.ultimaAtividadeMs || new Date(p.entrada).getTime()) >= 30 * 60 * 1000
            ).length;
            if (inativosCount > 0) {
              return (
                <span
                  style={{
                    fontSize: "11px",
                    background: "rgba(239, 68, 68, 0.25)",
                    border: "1px solid #ef4444",
                    padding: "2px 8px",
                    borderRadius: "20px",
                    color: "#fca5a5",
                    fontWeight: "900",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  🚨 {inativosCount} inativo{inativosCount > 1 ? "s" : ""}
                </span>
              );
            }
            return null;
          })()}
          {podeAdministrarMonitor && <span
            style={{
              fontSize: "11px",
              background: "rgba(255,255,255,0.1)",
              padding: "2px 8px",
              borderRadius: "20px",
              color: "#94a3b8",
              fontWeight: "700"
            }}
          >
            {pontosFinalizadosFiltrados.length} finalizados
          </span>}
        </div>
      ) : (
        <div
          ref={janelaRef}
          style={{
            position: "fixed",
            bottom: posicaoJanela ? "auto" : "85px",
            right: posicaoJanela ? "auto" : "20px",
            left: posicaoJanela ? `${posicaoJanela.x}px` : "auto",
            top: posicaoJanela ? `${posicaoJanela.y}px` : "auto",
            width: "390px",
            maxHeight: "570px",
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(16px)",
            border: "1.5px solid rgba(56, 189, 248, 0.4)",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(56, 189, 248, 0.2)",
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            color: "#fff",
            fontFamily: "var(--font-geist-sans, sans-serif)"
          }}
        >
          <div
            onPointerDown={iniciarArraste}
            onPointerMove={arrastarJanela}
            onPointerUp={finalizarArraste}
            onPointerCancel={finalizarArraste}
            style={{
              padding: "12px 16px",
              background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "grab",
              userSelect: "none",
              touchAction: "none"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>⚡</span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "900", color: "#f8fafc", letterSpacing: "0.3px" }}>
                  Monitor de Ponto em Tempo Real
                </div>
                <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "600" }}>
                  Auditoria de Expediente & 30 Minutos
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {podeAdministrarMonitor && <button
                onClick={() => window.dispatchEvent(new CustomEvent("navegar-pagina", { detail: "atividades" }))}
                style={{
                  background: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  color: "#38bdf8",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontWeight: "700"
                }}
                title="Abrir Registro Completo de Atividades"
              >
                📋 Histórico
              </button>}

              <button
                onClick={() => setSomAtivo(!somAtivo)}
                style={{
                  background: somAtivo ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                  border: `1px solid ${somAtivo ? "#22c55e" : "#ef4444"}`,
                  color: somAtivo ? "#4ade80" : "#f87171",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontWeight: "700"
                }}
                title={somAtivo ? "Som de Ponto Ativado" : "Som de Ponto Silenciado"}
              >
                {somAtivo ? "🔔" : "🔕"}
              </button>

              <button
                onClick={() => alternarMinimizado(true)}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  color: "#94a3b8",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: "700"
                }}
                title="Minimizar janela"
              >
                ➖
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "10px 14px 6px 14px",
              background: "rgba(0, 0, 0, 0.25)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: podeAdministrarMonitor ? "1fr 1fr" : "1fr", gap: "8px" }}>
              {podeAdministrarMonitor && <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>
                  Período
                </span>
                <select
                  value={filtroPeriodo}
                  onChange={(e) => setFiltroPeriodo(e.target.value)}
                  style={{
                    background: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#f8fafc",
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    outline: "none"
                  }}
                >
                  <option value="hoje">📅 Hoje (00:00 - 23:59)</option>
                  <option value="ontem">⏪ Ontem</option>
                  <option value="24h">⏱️ Últimas 24 Horas</option>
                  <option value="3dias">🗓️ Últimos 3 Dias</option>
                  <option value="7dias">🗓️ Últimos 7 Dias</option>
                  <option value="custom">📆 Data Específica...</option>
                </select>
              </div>}

              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>
                  Oficina
                </span>
                <select
                  value={filtroOficina}
                  onChange={(e) => setFiltroOficina(e.target.value)}
                  disabled={!isDono}
                  style={{
                    background: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#f8fafc",
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    outline: "none"
                  }}
                >
                  <option value="reds">🔴 Red's Tunershop</option>
                  {isDono && <option value="todas">⚙️ Todas as Oficinas</option>}
                  {isDono && <option value="vespucci">🟣 Vespucci</option>}
                  {isDono && <option value="harmony">🔵 Harmony</option>}
                  {isDono && <option value="dudark">🟡 Dudark</option>}
                </select>
              </div>
            </div>

            {podeAdministrarMonitor && filtroPeriodo === "custom" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(30, 41, 59, 0.7)",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border: "1px solid rgba(56, 189, 248, 0.3)"
                }}
              >
                <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "700", display: "flex", alignItems: "center", gap: "5px" }}>
                  📆 Selecionar Data:
                </span>
                <input
                  type="date"
                  value={dataPersonalizada}
                  onChange={(e) => setDataPersonalizada(e.target.value)}
                  style={{
                    background: "rgba(15, 23, 42, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    outline: "none",
                    colorScheme: "dark"
                  }}
                />
              </div>
            )}

            <input
              type="text"
              placeholder="🔍 Buscar mecânico por nome ou ID..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#fff",
                fontSize: "11px",
                padding: "5px 10px",
                borderRadius: "6px",
                outline: "none"
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: podeAdministrarMonitor ? "1fr 1fr 1fr 1.05fr" : "1fr",
                gap: "4px",
                background: "rgba(15, 23, 42, 0.6)",
                padding: "3px",
                borderRadius: "8px"
              }}
            >
              {podeAdministrarMonitor && <button
                onClick={() => setAbaAtiva("abertos")}
                style={{
                  background: abaAtiva === "abertos" ? "#0284c7" : "transparent",
                  border: "none",
                  color: abaAtiva === "abertos" ? "#fff" : "#94a3b8",
                  padding: "6px 2px",
                  borderRadius: "6px",
                  fontSize: "10.5px",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  transition: "all 0.15s"
                }}
              >
                <span>🟢</span>
                Abertos ({pontosAbertosFiltrados.length})
                {(() => {
                  const inatCount = pontosAbertosFiltrados.filter(
                    (p) => agoraTs - (p.ultimaAtividadeMs || new Date(p.entrada).getTime()) >= 30 * 60 * 1000
                  ).length;
                  if (inatCount > 0) {
                    return (
                      <span
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          padding: "1px 4px",
                          borderRadius: "4px",
                          fontSize: "9px",
                          fontWeight: "900"
                        }}
                      >
                        ⚠️{inatCount}
                      </span>
                    );
                  }
                  return null;
                })()}
              </button>}

              {podeAdministrarMonitor && <button
                onClick={() => setAbaAtiva("finalizados")}
                style={{
                  background: abaAtiva === "finalizados" ? "#0284c7" : "transparent",
                  border: "none",
                  color: abaAtiva === "finalizados" ? "#fff" : "#94a3b8",
                  padding: "6px 2px",
                  borderRadius: "6px",
                  fontSize: "10.5px",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  transition: "all 0.15s"
                }}
              >
                <span>🏁</span>
                Fechados ({pontosFinalizadosFiltrados.length})
              </button>}

              {podeAdministrarMonitor && <button
                onClick={() => setAbaAtiva("todos")}
                style={{
                  background: abaAtiva === "todos" ? "#0284c7" : "transparent",
                  border: "none",
                  color: abaAtiva === "todos" ? "#fff" : "#94a3b8",
                  padding: "6px 2px",
                  borderRadius: "6px",
                  fontSize: "10.5px",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  transition: "all 0.15s"
                }}
              >
                <span>📋</span>
                Todos ({todosDoDiaFiltrados.length})
              </button>}

              {(
                <button
                  onClick={() => setAbaAtiva("fila")}
                  style={{
                    background: abaAtiva === "fila" ? "#0284c7" : "transparent",
                    border: "none",
                    color: abaAtiva === "fila" ? "#fff" : "#94a3b8",
                    padding: "6px 2px",
                    borderRadius: "6px",
                    fontSize: "10.5px",
                    fontWeight: "800",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    transition: "all 0.15s"
                  }}
                  title="Fila de atendimento por tempo de espera"
                >
                  <span>🎯</span>
                  Fila ({filaMecanicos.length})
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              padding: "10px 14px",
              overflowY: "auto",
              maxHeight: "360px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            {carregando ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8", fontSize: "12px" }}>
                ⏳ Sincronizando pontos em tempo real...
              </div>
            ) : abaAtiva === "fila" ? (
              filaMecanicos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "35px 20px", color: "#64748b" }}>
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>🎯</div>
                  <div style={{ fontSize: "12px", fontWeight: "700" }}>Nenhum mecânico na fila no momento</div>
                  <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                    A fila de atendimento é gerada automaticamente com base nos mecânicos em serviço.
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      background: "rgba(56, 189, 248, 0.06)",
                      border: "1px solid rgba(56, 189, 248, 0.2)",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      fontSize: "10.5px",
                      color: "#93c5fd",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "4px"
                    }}
                  >
                    <span>🎯 <strong>Fila da Vez:</strong> Ordenado por maior tempo sem realizar serviços</span>
                    <span style={{ fontSize: "9px", color: "#cbd5e1", background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: "4px" }}>
                      {isDono ? "Todas as oficinas" : "🔴 Somente RED'S"}
                    </span>
                  </div>

                  {filaMecanicos.map((p, idx) => {
                    const posicao = idx + 1;
                    const isPrimeiro = posicao === 1;

                    return (
                      <div
                        key={p.uuidEntrada || idx}
                        onClick={() => podeAdministrarMonitor && abrirAuditoriaFuncionario(p)}
                        style={{
                          background: "rgba(255, 255, 255, 0.03)",
                          border: isPrimeiro
                            ? "1px solid rgba(56, 189, 248, 0.4)"
                            : "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: "10px",
                          padding: "10px 12px",
                          cursor: podeAdministrarMonitor ? "pointer" : "default",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "transform 0.15s, background 0.15s"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "translateX(3px)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "translateX(0px)")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "7px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: "800",
                              background: isPrimeiro
                                ? "rgba(56, 189, 248, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                              color: isPrimeiro ? "#38bdf8" : "#94a3b8",
                              border: isPrimeiro
                                ? "1px solid rgba(56, 189, 248, 0.35)"
                                : "1px solid rgba(255, 255, 255, 0.08)",
                              flexShrink: 0
                            }}
                          >
                            {posicao}º
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "13px", fontWeight: "800", color: "#f8fafc" }}>
                                {p.nome}
                              </span>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontFamily: "monospace",
                                  background: "rgba(255,255,255,0.08)",
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  color: "#94a3b8",
                                  fontWeight: "700"
                                }}
                              >
                                ID: {p.idJogo}
                              </span>
                              {isPrimeiro && (
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: "800",
                                    background: "rgba(56, 189, 248, 0.15)",
                                    color: "#38bdf8",
                                    border: "1px solid rgba(56, 189, 248, 0.3)",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.3px"
                                  }}
                                >
                                  PRÓXIMO DA VEZ
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                              {p.ultimaTunagemMs ? (
                                <>
                                  Último serviço:{" "}
                                  <strong style={{ color: "#e2e8f0" }}>
                                    {new Date(p.ultimaTunagemMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  </strong>
                                </>
                              ) : (
                                <>
                                  Sem serviços ainda • Entrou às{" "}
                                  <strong style={{ color: "#e2e8f0" }}>
                                    {new Date(p.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  </strong>
                                </>
                              )}
                              {" • "}
                              <span style={{ color: "#86efac" }}>
                                🚗 {p.qtdTunagensSessao || 0} no ponto{p.qtdTunagensHoje > (p.qtdTunagensSessao || 0) ? ` (${p.qtdTunagensHoje} hoje)` : ""}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "800",
                              fontFamily: "monospace",
                              color: isPrimeiro ? "#38bdf8" : "#cbd5e1",
                              background: "rgba(0,0,0,0.4)",
                              padding: "2px 7px",
                              borderRadius: "6px",
                              border: isPrimeiro ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)"
                            }}
                          >
                            ⏱️ {formatarTempo(p.tempoEsperaMs)}
                          </span>
                          <span
                            style={{
                              fontSize: "8.5px",
                              fontWeight: "700",
                              color: isPrimeiro ? "#38bdf8" : "#64748b",
                              textTransform: "uppercase"
                            }}
                          >
                            {isPrimeiro ? "A VEZ DO ATENDIMENTO" : `ESPERANDO HÁ ${p.minutosEspera}M`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )) : abaAtiva === "abertos" ? (
              pontosAbertosFiltrados.length === 0 ? (
                <div style={{ textAlign: "center", padding: "35px 20px", color: "#64748b" }}>
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>🌙</div>
                  <div style={{ fontSize: "12px", fontWeight: "700" }}>Nenhum ponto aberto no momento</div>
                  <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                    Mecânicos sem saída por mais de 2h de inatividade foram auto-encerrados.
                  </div>
                </div>
              ) : (
                pontosAbertosFiltrados.map((p, idx) => {
                  const entMs = new Date(p.entrada).getTime();
                  const msDecorrido = agoraTs - entMs;
                  const minutosDecorrido = Math.floor(msDecorrido / 60000);
                  const ultAtivMs = p.ultimaAtividadeMs || entMs;
                  const msSemAtividade = Math.max(0, agoraTs - ultAtivMs);
                  const minutosSemAtividade = Math.floor(msSemAtividade / 60000);
                  const isInativo30 = minutosSemAtividade >= 30;
                  const isMenor30 = minutosDecorrido < 30;

                  return (
                    <div
                      key={p.uuidEntrada || idx}
                      onClick={() => abrirAuditoriaFuncionario(p)}
                      style={{
                        background: isInativo30
                          ? "linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(185, 28, 28, 0.22) 100%)"
                          : isMenor30
                          ? "rgba(245, 158, 11, 0.08)"
                          : "rgba(34, 197, 94, 0.08)",
                        border: `1.5px solid ${
                          isInativo30
                            ? "#ef4444"
                            : isMenor30
                            ? "rgba(245, 158, 11, 0.35)"
                            : "rgba(34, 197, 94, 0.35)"
                        }`,
                        borderRadius: "10px",
                        padding: "10px 12px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "transform 0.15s, background 0.15s",
                        boxShadow: isInativo30 ? "0 0 14px rgba(239, 68, 68, 0.25)" : "none"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateX(3px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateX(0px)")}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "13px", fontWeight: "900", color: "#f8fafc" }}>{p.nome}</span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontFamily: "monospace",
                              background: "rgba(255,255,255,0.1)",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              color: "#38bdf8",
                              fontWeight: "700"
                            }}
                          >
                            ID: {p.idJogo}
                          </span>
                          {isInativo30 && (
                            <span
                              style={{
                                fontSize: "9.5px",
                                fontWeight: "900",
                                background: "#ef4444",
                                color: "#fff",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px"
                              }}
                            >
                              🚨 {minutosSemAtividade}m INATIVO
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                          Entrou às{" "}
                          <strong style={{ color: "#e2e8f0" }}>
                            {new Date(p.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </strong>{" "}
                          • <span style={{ color: "#cbd5e1" }}>{p.oficina}</span>
                          {" • "}
                          <span style={{ color: isInativo30 ? "#fca5a5" : "#94a3b8" }}>
                            {p.qtdAtividadesSessao > 0
                              ? `Última ação às ${new Date(ultAtivMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (${minutosSemAtividade}m atrás)`
                              : `Sem ações (${minutosSemAtividade}m)`}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "900",
                            fontFamily: "monospace",
                            color: isInativo30 ? "#fca5a5" : isMenor30 ? "#fbbf24" : "#4ade80",
                            background: "rgba(0,0,0,0.4)",
                            padding: "2px 6px",
                            borderRadius: "6px",
                            border: `1px solid ${
                              isInativo30
                                ? "rgba(239, 68, 68, 0.5)"
                                : isMenor30
                                ? "rgba(245, 158, 11, 0.4)"
                                : "rgba(34, 197, 94, 0.4)"
                            }`
                          }}
                        >
                          ⏱️ {formatarTempo(msDecorrido)}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: "800",
                            color: isInativo30 ? "#ef4444" : isMenor30 ? "#f59e0b" : "#22c55e",
                            textTransform: "uppercase"
                          }}
                        >
                          {isInativo30
                            ? `⚠️ Inativo há ${minutosSemAtividade}m`
                            : isMenor30
                            ? "⚠️ < 30 Minutos"
                            : "✅ Regular (Ativo)"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            ) : abaAtiva === "finalizados" ? (
              pontosFinalizadosFiltrados.length === 0 ? (
                <div style={{ textAlign: "center", padding: "35px 20px", color: "#64748b" }}>
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>📂</div>
                  <div style={{ fontSize: "12px", fontWeight: "700" }}>Nenhum ponto finalizado no período</div>
                </div>
              ) : (
                pontosFinalizadosFiltrados.map((p, idx) => {
                  const isMenor30 = p.duracaoMin < 30;
                  const isCrash = Boolean(p.motivoCrash);
                  const isDuplo = Boolean(p.isDuploClique);
                  const isAutoFechado = Boolean(p.isAutoFechadoInatividade);

                  return (
                    <div
                      key={p.uuidSaida || idx}
                      onClick={() => abrirAuditoriaFuncionario(p)}
                      style={{
                        background: isCrash
                          ? "rgba(239, 68, 68, 0.12)"
                          : isAutoFechado
                          ? "rgba(245, 158, 11, 0.12)"
                          : isDuplo
                          ? "rgba(245, 158, 11, 0.08)"
                          : isMenor30
                          ? "rgba(239, 68, 68, 0.08)"
                          : "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${
                          isCrash
                            ? "rgba(239, 68, 68, 0.5)"
                            : isAutoFechado
                            ? "rgba(245, 158, 11, 0.45)"
                            : isDuplo
                            ? "rgba(245, 158, 11, 0.35)"
                            : isMenor30
                            ? "rgba(239, 68, 68, 0.35)"
                            : "rgba(255, 255, 255, 0.08)"
                        }`,
                        borderRadius: "10px",
                        padding: "10px 12px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "transform 0.15s"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateX(3px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateX(0px)")}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "13px", fontWeight: "900", color: "#f8fafc" }}>{p.nome}</span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontFamily: "monospace",
                              background: "rgba(255,255,255,0.1)",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              color: "#38bdf8",
                              fontWeight: "700"
                            }}
                          >
                            ID: {p.idJogo}
                          </span>
                          {isCrash && (
                            <span
                              style={{
                                fontSize: "9px",
                                background: "#ef4444",
                                color: "#fff",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                fontWeight: "800"
                              }}
                            >
                              🚨 CRASH
                            </span>
                          )}
                          {isAutoFechado && (
                            <span
                              style={{
                                fontSize: "9px",
                                background: "rgba(245, 158, 11, 0.25)",
                                border: "1px solid #f59e0b",
                                color: "#fbbf24",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                fontWeight: "800"
                              }}
                            >
                              ⚠️ AUTO-FECHADO (CRASH)
                            </span>
                          )}
                          {isDuplo && !isAutoFechado && (
                            <span
                              style={{
                                fontSize: "9px",
                                background: "rgba(245, 158, 11, 0.25)",
                                border: "1px solid #f59e0b",
                                color: "#fbbf24",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                fontWeight: "800"
                              }}
                            >
                              ⚡ DUPLO CLIQUE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                          {new Date(p.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ➔{" "}
                          {new Date(p.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} •{" "}
                          <span>{p.oficina}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "900",
                            color: isCrash
                              ? "#fca5a5"
                              : isAutoFechado
                              ? "#fbbf24"
                              : isDuplo
                              ? "#fbbf24"
                              : isMenor30
                              ? "#f87171"
                              : "#4ade80",
                            background: isCrash
                              ? "rgba(239, 68, 68, 0.25)"
                              : isAutoFechado
                              ? "rgba(245, 158, 11, 0.2)"
                              : isDuplo
                              ? "rgba(245, 158, 11, 0.2)"
                              : isMenor30
                              ? "rgba(239, 68, 68, 0.15)"
                              : "rgba(34, 197, 94, 0.1)",
                            padding: "2px 6px",
                            borderRadius: "6px",
                            border: `1px solid ${
                              isCrash
                                ? "rgba(239, 68, 68, 0.5)"
                                : isAutoFechado
                                ? "rgba(245, 158, 11, 0.4)"
                                : isDuplo
                                ? "rgba(245, 158, 11, 0.4)"
                                : isMenor30
                                ? "rgba(239, 68, 68, 0.4)"
                                : "rgba(34, 197, 94, 0.3)"
                            }`
                          }}
                        >
                          ⏱ {p.duracaoMin} min
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: "800",
                            color: isCrash
                              ? "#f87171"
                              : isAutoFechado
                              ? "#f59e0b"
                              : isDuplo
                              ? "#f59e0b"
                              : isMenor30
                              ? "#ef4444"
                              : "#22c55e"
                          }}
                        >
                          {isCrash
                            ? "🚨 Fechado por Crash"
                            : isAutoFechado
                            ? "⚠️ Inatividade / Crash"
                            : isDuplo
                            ? "⚡ Saída Imediata"
                            : isMenor30
                            ? "⚠️ < 30 Minutos"
                            : "✅ Regular"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              todosDoDiaFiltrados.length === 0 ? (
                <div style={{ textAlign: "center", padding: "35px 20px", color: "#64748b" }}>
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>📋</div>
                  <div style={{ fontSize: "12px", fontWeight: "700" }}>Nenhum registro no período</div>
                </div>
              ) : (
                todosDoDiaFiltrados.map((p, idx) => {
                  const isAberto = !p.saida;
                  const entMs = new Date(p.entrada).getTime();
                  const msDecorrido = agoraTs - entMs;
                  const ultAtivMs = p.ultimaAtividadeMs || entMs;
                  const msSemAtividade = Math.max(0, agoraTs - ultAtivMs);
                  const minutosSemAtividade = Math.floor(msSemAtividade / 60000);
                  const isInativo30 = isAberto && minutosSemAtividade >= 30;

                  const minutos = isAberto ? Math.floor(msDecorrido / 60000) : p.duracaoMin;
                  const isMenor30 = minutos < 30;
                  const isCrash = Boolean(p.motivoCrash);
                  const isDuplo = Boolean(p.isDuploClique);
                  const isAutoFechado = Boolean(p.isAutoFechadoInatividade);

                  return (
                    <div
                      key={p.uuidEntrada || p.uuidSaida || idx}
                      onClick={() => abrirAuditoriaFuncionario(p)}
                      style={{
                        background: isCrash
                          ? "rgba(239, 68, 68, 0.12)"
                          : isAutoFechado
                          ? "rgba(245, 158, 11, 0.12)"
                          : isDuplo
                          ? "rgba(245, 158, 11, 0.1)"
                          : isAberto
                          ? isInativo30
                            ? "linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(185, 28, 28, 0.22) 100%)"
                            : isMenor30
                            ? "rgba(245, 158, 11, 0.08)"
                            : "rgba(34, 197, 94, 0.08)"
                          : isMenor30
                          ? "rgba(239, 68, 68, 0.08)"
                          : "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${
                          isCrash
                            ? "rgba(239, 68, 68, 0.5)"
                            : isAutoFechado
                            ? "rgba(245, 158, 11, 0.45)"
                            : isDuplo
                            ? "rgba(245, 158, 11, 0.4)"
                            : isAberto
                            ? isInativo30
                              ? "#ef4444"
                              : isMenor30
                              ? "rgba(245, 158, 11, 0.3)"
                              : "rgba(34, 197, 94, 0.3)"
                            : isMenor30
                            ? "rgba(239, 68, 68, 0.35)"
                            : "rgba(255, 255, 255, 0.08)"
                        }`,
                        borderRadius: "10px",
                        padding: "10px 12px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "transform 0.15s"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateX(3px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateX(0px)")}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "13px", fontWeight: "900", color: "#f8fafc" }}>{p.nome}</span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontFamily: "monospace",
                              background: "rgba(255,255,255,0.1)",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              color: "#38bdf8",
                              fontWeight: "700"
                            }}
                          >
                            ID: {p.idJogo}
                          </span>
                          {isInativo30 && (
                            <span
                              style={{
                                fontSize: "9.5px",
                                fontWeight: "900",
                                background: "#ef4444",
                                color: "#fff",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px"
                              }}
                            >
                              🚨 {minutosSemAtividade}m INATIVO
                            </span>
                          )}
                          {isCrash && (
                            <span
                              style={{
                                fontSize: "9px",
                                background: "#ef4444",
                                color: "#fff",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                fontWeight: "800"
                              }}
                            >
                              🚨 CRASH
                            </span>
                          )}
                          {isAutoFechado && (
                            <span
                              style={{
                                fontSize: "9px",
                                background: "rgba(245, 158, 11, 0.25)",
                                border: "1px solid #f59e0b",
                                color: "#fbbf24",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                fontWeight: "800"
                              }}
                            >
                              ⚠️ AUTO-FECHADO (CRASH)
                            </span>
                          )}
                          {isDuplo && !isAutoFechado && (
                            <span
                              style={{
                                fontSize: "9px",
                                background: "rgba(245, 158, 11, 0.25)",
                                border: "1px solid #f59e0b",
                                color: "#fbbf24",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                fontWeight: "800"
                              }}
                            >
                              ⚡ DUPLO CLIQUE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                          {isAberto ? (
                            <>
                              Entrou às{" "}
                              <strong style={{ color: "#e2e8f0" }}>
                                {new Date(p.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </strong>{" "}
                              • <span style={{ color: "#cbd5e1" }}>{p.oficina}</span>
                              {" • "}
                              <span style={{ color: isInativo30 ? "#fca5a5" : "#94a3b8" }}>
                                {p.qtdAtividadesSessao > 0
                                  ? `Última ação às ${new Date(ultAtivMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (${minutosSemAtividade}m atrás)`
                                  : `Sem ações (${minutosSemAtividade}m)`}
                              </span>
                            </>
                          ) : (
                            <>
                              {new Date(p.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{" "}
                              ➔ {new Date(p.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{" "}
                              • <span>{p.oficina}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "900",
                            fontFamily: isAberto ? "monospace" : "inherit",
                            color: isCrash
                              ? "#fca5a5"
                              : isAutoFechado
                              ? "#fbbf24"
                              : isDuplo
                              ? "#fbbf24"
                              : isAberto
                              ? isInativo30
                                ? "#fca5a5"
                                : isMenor30
                                ? "#fbbf24"
                                : "#4ade80"
                              : isMenor30
                              ? "#f87171"
                              : "#4ade80",
                            background: "rgba(0,0,0,0.4)",
                            padding: "2px 6px",
                            borderRadius: "6px"
                          }}
                        >
                          {isAberto ? `⏱️ ${formatarTempo(msDecorrido)}` : `⏱️ ${p.duracaoMin} min`}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: "800",
                            color: isCrash
                              ? "#f87171"
                              : isAutoFechado
                              ? "#f59e0b"
                              : isDuplo
                              ? "#f59e0b"
                              : isAberto
                              ? isInativo30
                                ? "#ef4444"
                                : "#38bdf8"
                              : isMenor30
                              ? "#ef4444"
                              : "#22c55e"
                          }}
                        >
                          {isCrash
                            ? "🚨 Fechado por Crash"
                            : isAutoFechado
                            ? "⚠️ Inatividade / Crash"
                            : isDuplo
                            ? "⚡ Saída Imediata"
                            : isAberto
                            ? isInativo30
                              ? `⚠️ Inativo há ${minutosSemAtividade}m`
                              : "🟢 EM SERVIÇO"
                            : isMenor30
                            ? "⚠️ < 30 Minutos"
                            : "🏁 Finalizado"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
      )}

      {funcionarioInspecao && (
        <div
          onPaste={handleColarImagem}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            background: "rgba(0, 0, 0, 0.78)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            fontFamily: "var(--font-geist-sans, sans-serif)",
            color: "#fff"
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1.5px solid rgba(56, 189, 248, 0.4)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 30px rgba(56, 189, 248, 0.25)",
              overflow: "hidden"
            }}
          >
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
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>🔍</span>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#f8fafc" }}>
                    Auditoria de Ponto: {funcionarioInspecao.nome}
                  </h3>
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
                    ID: {funcionarioInspecao.idJogo}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                  Oficina: <strong style={{ color: "#cbd5e1" }}>{funcionarioInspecao.oficina}</strong> • Entrada:{" "}
                  <strong>{new Date(funcionarioInspecao.entrada).toLocaleTimeString("pt-BR")}</strong>
                  {funcionarioInspecao.saida ? (
                    <>
                      {" "}
                      • Saída: <strong>{new Date(funcionarioInspecao.saida).toLocaleTimeString("pt-BR")}</strong>
                    </>
                  ) : (
                    <>
                      {" "}
                      • Status: <strong style={{ color: "#22c55e" }}>🟢 Em Serviço</strong>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setFuncionarioInspecao(null);
                  setModoFecharCrash(false);
                }}
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

            <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* ALERTA DE AUTO-FECHAMENTO POR INATIVIDADE / CRASH */}
              {funcionarioInspecao.isAutoFechadoInatividade && (
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(180, 83, 9, 0.22) 100%)",
                    border: "1.5px solid #f59e0b",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px"
                  }}
                >
                  <span style={{ fontSize: "22px", marginTop: "2px" }}>⚠️</span>
                  <div>
                    <strong style={{ fontSize: "13px", color: "#fbbf24" }}>
                      Ponto Auto-Encerrado por Inatividade / Crash (&gt; 2h)
                    </strong>
                    <div style={{ fontSize: "11.5px", color: "#fef3c7", marginTop: "3px", lineHeight: "1.4" }}>
                      Não houve registro de saída e o mecânico permaneceu mais de 2 horas sem novas movimentações.
                      O expediente foi finalizado automaticamente no horário da sua <strong>última atividade registrada às {new Date(funcionarioInspecao.saida).toLocaleTimeString("pt-BR")}</strong> (duração real calculada: <strong>{funcionarioInspecao.duracaoMin} minutos</strong>).
                    </div>
                  </div>
                </div>
              )}

              {/* ALERTA DE DUPLO CLIQUE / SAÍDA IMEDIATA (APENAS SE NÃO HOUVE ATIVIDADE) */}
              {funcionarioInspecao.isDuploClique &&
                !funcionarioInspecao.isAutoFechadoInatividade &&
                (!atividadesPonto || (atividadesPonto.bancada.length === 0 && atividadesPonto.bau.length === 0 && atividadesPonto.tunagens.length === 0)) && (
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(180, 83, 9, 0.2) 100%)",
                    border: "1.5px solid #f59e0b",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px"
                  }}
                >
                  <span style={{ fontSize: "20px" }}>⚡</span>
                  <div>
                    <strong style={{ fontSize: "12.5px", color: "#fbbf24" }}>
                      Duplo Clique / Entrada e Saída Instantânea
                    </strong>
                    <div style={{ fontSize: "11px", color: "#fef3c7", marginTop: "2px" }}>
                      O mecânico registrou entrada e saída no mesmo instante ou em menos de 1 minuto sem realizar nenhuma atividade.
                    </div>
                  </div>
                </div>
              )}

              {/* SE O PONTO ESTÁ FECHADO POR CRASH MANUAL */}
              {funcionarioInspecao.motivoCrash && (
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.25) 100%)",
                    border: "1.5px solid #ef4444",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "18px" }}>🚨</span>
                      <strong style={{ fontSize: "13px", color: "#fca5a5" }}>
                        Ponto Fechado Manualmente por Motivo de Crash
                      </strong>
                    </div>
                    {funcionarioInspecao.fechadoPor && (
                      <span style={{ fontSize: "11px", color: "#cbd5e1", background: "rgba(0,0,0,0.4)", padding: "2px 8px", borderRadius: "6px" }}>
                        Fechado por: <strong>{funcionarioInspecao.fechadoPor}</strong>
                      </span>
                    )}
                  </div>

                  {funcionarioInspecao.justificativa && (
                    <div style={{ fontSize: "12px", color: "#f1f5f9", background: "rgba(0,0,0,0.3)", padding: "8px 12px", borderRadius: "8px" }}>
                      <strong>Justificativa do Crash:</strong> {funcionarioInspecao.justificativa}
                    </div>
                  )}

                  {funcionarioInspecao.comprovanteImg && (
                    <div>
                      <div style={{ fontSize: "11px", color: "#cbd5e1", marginBottom: "6px", fontWeight: "700" }}>
                        📷 Print do Crash Anexado (clique para ampliar):
                      </div>
                      <img
                        src={funcionarioInspecao.comprovanteImg}
                        alt="Comprovante de Crash"
                        onClick={() => setImagemZoom(funcionarioInspecao.comprovanteImg)}
                        style={{
                          maxHeight: "140px",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.2)",
                          cursor: "zoom-in",
                          objectFit: "cover",
                          transition: "transform 0.2s"
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* FORMULÁRIO DE FECHAMENTO POR CRASH (QUANDO ABERTO) */}
              {!funcionarioInspecao.saida && modoFecharCrash && (
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(153, 27, 27, 0.25) 100%)",
                    border: "2px solid #ef4444",
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    boxShadow: "0 8px 24px rgba(239, 68, 68, 0.2)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "20px" }}>🚨</span>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "900", color: "#fca5a5" }}>
                          Solicitação de Fechamento de Ponto por Crash
                        </div>
                        <div style={{ fontSize: "11px", color: "#fecaca" }}>
                          Preencha o motivo da queda/crash e anexe o print comprovando o erro.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setModoFecharCrash(false)}
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        color: "#cbd5e1",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        cursor: "pointer",
                        fontWeight: "700"
                      }}
                    >
                      Cancelar
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#f8fafc" }}>
                      ⏰ Data e Horário de Saída do Ponto (Crash):
                    </label>
                    <input
                      type="datetime-local"
                      value={saidaDataHoraCrash}
                      onChange={(e) => setSaidaDataHoraCrash(e.target.value)}
                      style={{
                        background: "rgba(15, 23, 42, 0.9)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        color: "#fff",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "700",
                        outline: "none"
                      }}
                    />
                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                      Entrada registrada: {new Date(funcionarioInspecao.entrada).toLocaleString("pt-BR")}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#f8fafc" }}>
                      📝 Justificativa da Solicitação de Fechamento (Obrigatório):
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Descreva o motivo do crash ou solicitação (ex: Jogo crashou com erro D3D / queda de energia / desconexão repentina)..."
                      value={justificativaCrash}
                      onChange={(e) => setJustificativaCrash(e.target.value)}
                      style={{
                        background: "rgba(15, 23, 42, 0.9)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        color: "#fff",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        outline: "none",
                        resize: "vertical"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#f8fafc" }}>
                      📷 Print do Crash / Comprovante (Obrigatório):
                    </label>

                    {printCrashBase64 ? (
                      <div
                        style={{
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid rgba(34, 197, 94, 0.4)",
                          borderRadius: "8px",
                          padding: "10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <img
                            src={printCrashBase64}
                            alt="Preview do Print"
                            onClick={() => setImagemZoom(printCrashBase64)}
                            style={{
                              width: "70px",
                              height: "50px",
                              objectFit: "cover",
                              borderRadius: "6px",
                              cursor: "zoom-in",
                              border: "1px solid rgba(255,255,255,0.2)"
                            }}
                            title="Clique para ampliar"
                          />
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: "800", color: "#4ade80" }}>
                              ✅ Print anexado com sucesso!
                            </div>
                            <div style={{ fontSize: "10px", color: "#94a3b8" }}>Clique na miniatura para ampliar</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPrintCrashBase64(null)}
                          style={{
                            background: "rgba(239, 68, 68, 0.2)",
                            border: "1px solid #ef4444",
                            color: "#f87171",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "700",
                            cursor: "pointer"
                          }}
                        >
                          🗑️ Remover
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          border: "1.5px dashed rgba(239, 68, 68, 0.5)",
                          borderRadius: "8px",
                          padding: "14px",
                          textAlign: "center",
                          background: "rgba(0,0,0,0.3)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <span style={{ fontSize: "20px" }}>📎</span>
                        <div style={{ fontSize: "11px", color: "#e2e8f0", fontWeight: "700" }}>
                          Selecione o print do erro ou cole direto com <strong>Ctrl + V</strong>
                        </div>
                        <label
                          style={{
                            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                            color: "#fff",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "800",
                            cursor: "pointer",
                            marginTop: "4px",
                            display: "inline-block"
                          }}
                        >
                          Escolher Arquivo de Imagem
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const base64 = await processarImagemParaBase64(file);
                                  setPrintCrashBase64(base64);
                                } catch (err) {
                                  alert("❌ Erro ao ler imagem: " + err.message);
                                }
                              }
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setModoFecharCrash(false)}
                      disabled={enviandoCrash}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "none",
                        color: "#cbd5e1",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmarFechamentoCrash}
                      disabled={enviandoCrash}
                      style={{
                        background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                        border: "none",
                        color: "#fff",
                        padding: "8px 18px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "900",
                        cursor: enviandoCrash ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      {enviandoCrash ? "⏳ Registrando Fechamento..." : "💾 Confirmar Fechamento por Crash"}
                    </button>
                  </div>
                </div>
              )}

              {/* ALERTA DE INATIVIDADE EM TEMPO REAL (> 30 MINUTOS SEM AÇÃO) */}
              {!funcionarioInspecao.saida && (() => {
                const entMs = new Date(funcionarioInspecao.entrada).getTime();
                let ultAtivMs = funcionarioInspecao.ultimaAtividadeMs || entMs;
                let qtdAtivs = funcionarioInspecao.qtdAtividadesSessao || 0;

                if (atividadesPonto) {
                  const timestamps = [];
                  (atividadesPonto.tunagens || []).forEach((t) => {
                    if (t.data && t.hora) {
                      const ts = new Date(`${t.data}T${t.hora}-03:00`).getTime();
                      if (ts >= entMs) timestamps.push(ts);
                    }
                  });
                  (atividadesPonto.bancada || []).forEach((b) => {
                    if (b.rawLog) {
                      const dataMatch = b.rawLog.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}:\d{2})/i);
                      if (dataMatch) {
                        const [_, dStr, hStr] = dataMatch;
                        const [dia, mes, ano] = dStr.split("/");
                        const ts = new Date(`${ano}-${mes}-${dia}T${hStr}-03:00`).getTime();
                        if (ts >= entMs) timestamps.push(ts);
                      }
                    }
                  });
                  (atividadesPonto.bau || []).forEach((b) => {
                    if (b.rawLog) {
                      const dataMatch = b.rawLog.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}:\d{2})/i);
                      if (dataMatch) {
                        const [_, dStr, hStr] = dataMatch;
                        const [dia, mes, ano] = dStr.split("/");
                        const ts = new Date(`${ano}-${mes}-${dia}T${hStr}-03:00`).getTime();
                        if (ts >= entMs) timestamps.push(ts);
                      }
                    }
                  });
                  if (timestamps.length > 0) {
                    ultAtivMs = Math.max(ultAtivMs, ...timestamps);
                    qtdAtivs = timestamps.length;
                  }
                }

                const minSemAtividade = Math.floor((agoraTs - ultAtivMs) / 60000);
                const isInativo = minSemAtividade >= 30;

                if (!isInativo) return null;

                const horaUltimaAcao = new Date(ultAtivMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                return (
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)",
                      border: "2px solid #ef4444",
                      borderRadius: "12px",
                      padding: "14px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                      boxShadow: "0 0 16px rgba(239, 68, 68, 0.3)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "24px" }}>🚨</span>
                      <div>
                        <div style={{ fontSize: "13.5px", fontWeight: "900", color: "#fca5a5" }}>
                          Alerta de Inatividade: {minSemAtividade} minutos sem registrar ações!
                        </div>
                        <div style={{ fontSize: "11px", color: "#fecaca", marginTop: "2px" }}>
                          {qtdAtivs > 0
                            ? `Última movimentação registrada às ${horaUltimaAcao}. O mecânico pode ter caído da cidade (crash) ou ausentado-se do posto.`
                            : `Nenhuma atividade realizada desde a entrada às ${horaUltimaAcao}. O mecânico pode ter caído da cidade logo após bater o ponto.`}
                        </div>
                      </div>
                    </div>

                    {!modoFecharCrash && (
                      <button
                        onClick={() => {
                          setModoFecharCrash(true);
                          const dt = new Date(ultAtivMs);
                          const yyyy = dt.getFullYear();
                          const mm = String(dt.getMonth() + 1).padStart(2, "0");
                          const dd = String(dt.getDate()).padStart(2, "0");
                          const hh = String(dt.getHours()).padStart(2, "0");
                          const mi = String(dt.getMinutes()).padStart(2, "0");
                          setSaidaDataHoraCrash(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
                          setJustificativaCrash(`Queda da cidade / crash detectado por inatividade (> 30 min sem ações). Última atividade às ${dt.toLocaleTimeString("pt-BR")}.`);
                        }}
                        style={{
                          background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                          border: "none",
                          color: "#fff",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontSize: "11.5px",
                          fontWeight: "900",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        🚨 Encerrar por Queda / Crash
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* ALERTA DE INFRAÇÃO DA REGRA DOS 30 MINUTOS */}
              {(() => {
                const duracaoMin = funcionarioInspecao.saida
                  ? funcionarioInspecao.duracaoMin
                  : Math.floor((agoraTs - new Date(funcionarioInspecao.entrada).getTime()) / 60000);

                const temAtividadeBauOuBancada =
                  (atividadesPonto?.bau?.length || 0) > 0 || (atividadesPonto?.bancada?.length || 0) > 0;
                const isInfra30Min = duracaoMin < 30 && temAtividadeBauOuBancada;

                return (
                  <div
                    style={{
                      background: isInfra30Min
                        ? "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(153, 27, 27, 0.25) 100%)"
                        : "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(21, 128, 61, 0.15) 100%)",
                      border: `1.5px solid ${isInfra30Min ? "#ef4444" : "#22c55e"}`,
                      borderRadius: "12px",
                      padding: "14px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "16px" }}>{isInfra30Min ? "🚨" : "🛡️"}</span>
                        <strong style={{ fontSize: "13px", color: isInfra30Min ? "#fca5a5" : "#86efac" }}>
                          {isInfra30Min
                            ? "Possível Infração da Regra dos 30 Minutos!"
                            : "Ponto em Conformidade com as Regras"}
                        </strong>
                      </div>
                      <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "3px" }}>
                        Tempo de permanência no expediente: <strong>{duracaoMin} minutos</strong>.{" "}
                        {isInfra30Min
                          ? "O funcionário realizou retiradas de baú/bancada em menos de 30 minutos de serviço."
                          : "Ponto regular ou sem retiradas abusivas detectadas."}
                      </div>
                    </div>

                    {isInfra30Min && (
                      <button
                        onClick={() => copiarAdvertenciaDiscord(funcionarioInspecao, atividadesPonto)}
                        style={{
                          background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                          border: "none",
                          color: "#fff",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontWeight: "800",
                          fontSize: "11px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
                        }}
                      >
                        📋 Copiar Advertência Discord
                      </button>
                    )}
                  </div>
                );
              })()}

              {carregandoAtividades ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: "13px" }}>
                  ⏳ Cruzando logs de tunagem, baú e bancada do período...
                </div>
              ) : (
                <>
                  {/* SEÇÃO TUNAGENS */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "800", color: "#38bdf8", display: "flex", alignItems: "center", gap: "6px" }}>
                        🚗 Tunagens Realizadas ({atividadesPonto?.tunagens?.length || 0})
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "10.5px", color: "#86efac" }}>Passe o mouse ou clique para copiar 💬📋</span>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                          Total Cobrado:{" "}
                          <strong style={{ color: "#4ade80" }}>
                            R${" "}
                            {(atividadesPonto?.tunagens || [])
                              .reduce((acc, t) => acc + (t.valor_pago || 0), 0)
                              .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {atividadesPonto?.tunagens?.length === 0 ? (
                      <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", padding: "8px 0" }}>
                        Nenhuma tunagem de veículo registrada durante este ponto.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {atividadesPonto.tunagens.map((t, idx) => {
                          const logTexto = t.rawLog || t.raw_text || (
                            `[TUNAGEM DE VEÍCULO]\n` +
                            `[Oficina]: ${t.oficina_nome || "Red's Tunershop"}\n` +
                            `[Baia]: ${t.baia_nome || "Tunagem"}\n` +
                            `[Técnico]: ${t.tecnico_nome || funcionarioInspecao?.nome} (ID: ${t.tecnico_id || funcionarioInspecao?.idJogo})\n` +
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
                              key={t.uuid || idx}
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
                                background: "rgba(0,0,0,0.3)",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                border: "1px solid rgba(255,255,255,0.05)"
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = "rgba(34, 197, 94, 0.1)";
                                e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.35)";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = "rgba(0,0,0,0.3)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                              }}
                            >
                              <div>
                                <div style={{ fontSize: "12px", fontWeight: "800", color: "#f8fafc" }}>
                                  🚗 {t.veiculo_nome}{" "}
                                  <span style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "10px" }}>
                                    ({t.placa})
                                  </span>
                                </div>
                                <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                                  👤 Cliente: {t.dono_nome || "N/A"} • ⏱️ {t.hora}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {t.cobrado && (
                                  <span
                                    title="Serviço já finalizado"
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: "800",
                                      background: "rgba(34, 197, 94, 0.15)",
                                      border: "1px solid rgba(34, 197, 94, 0.4)",
                                      color: "#4ade80",
                                      padding: "2px 6px",
                                      borderRadius: "6px"
                                    }}
                                  >
                                    ✅ Finalizado
                                  </span>
                                )}
                                <span style={{ fontSize: "12px", fontWeight: "900", color: "#4ade80" }}>
                                  R$ {(Number(t.valor_pago) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                                <button
                                  type="button"
                                  title="Abrir Ficha de Tunagem Completa"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHoveredLog(null);
                                    setModalLogTunagemDetalhe(t);
                                  }}
                                  style={{
                                    background: "rgba(56, 189, 248, 0.15)",
                                    border: "1px solid rgba(56, 189, 248, 0.4)",
                                    color: "#38bdf8",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: "800",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    transition: "all 0.2s"
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = "rgba(56, 189, 248, 0.3)";
                                    e.currentTarget.style.borderColor = "#38bdf8";
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = "rgba(56, 189, 248, 0.15)";
                                    e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
                                  }}
                                >
                                  📋 Abrir Ficha
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SEÇÃO BAÚ */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "800", color: "#f59e0b", display: "flex", alignItems: "center", gap: "6px" }}>
                        📦 Movimentações no Baú ({atividadesPonto?.bau?.length || 0})
                      </span>
                      <span style={{ fontSize: "10.5px", color: "#fef08a" }}>Passe o mouse ou clique para copiar 💬📋</span>
                    </div>

                    {atividadesPonto?.bau?.length === 0 ? (
                      <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", padding: "8px 0" }}>
                        Nenhuma retirada ou colocação de item no baú durante este ponto.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {atividadesPonto.bau.map((b, idx) => {
                          const logTexto = b.rawLog || (
                            `\`\`\`ini\n` +
                            `[AÇÃO]: ${b.acao}\n` +
                            `[ITEM]: ${b.item}\n` +
                            `[ID]: ${funcionarioInspecao?.idJogo}\n` +
                            `[NOME COMPLETO]: ${funcionarioInspecao?.nome}\n` +
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
                                background: "rgba(0,0,0,0.3)",
                                padding: "6px 10px",
                                borderRadius: "6px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                border: "1px solid rgba(255,255,255,0.05)"
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = "rgba(245, 158, 11, 0.1)";
                                e.currentTarget.style.borderColor = "rgba(245, 158, 11, 0.35)";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = "rgba(0,0,0,0.3)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                              }}
                            >
                              <span style={{ fontSize: "11px", color: "#f8fafc" }}>
                                <strong style={{ color: b.acao === "Retirou" ? "#f87171" : "#4ade80" }}>
                                  [{b.acao}]
                                </strong>{" "}
                                {b.item}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#94a3b8" }}>
                                  ⏱️ {b.hora}
                                </span>
                                <span style={{ fontSize: "11px", color: "#94a3b8", opacity: 0.7 }}>📋</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SEÇÃO BANCADA */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "800", color: "#a855f7", display: "flex", alignItems: "center", gap: "6px" }}>
                        🛠️ Compras / Bancada ({atividadesPonto?.bancada?.length || 0})
                      </span>
                      <span style={{ fontSize: "10.5px", color: "#e9d5ff" }}>Passe o mouse ou clique para copiar 💬📋</span>
                    </div>

                    {atividadesPonto?.bancada?.length === 0 ? (
                      <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", padding: "8px 0" }}>
                        Nenhuma compra ou produção na bancada durante este ponto.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {atividadesPonto.bancada.map((bc, idx) => {
                          const logTexto = bc.rawLog || (
                            `\`\`\`ini\n` +
                            `[ITEMNAME]: ${bc.item}\n` +
                            `[ID]: ${funcionarioInspecao?.idJogo}\n` +
                            `[NOME COMPLETO]: ${funcionarioInspecao?.nome}\n` +
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
                                background: "rgba(0,0,0,0.3)",
                                padding: "6px 10px",
                                borderRadius: "6px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                border: "1px solid rgba(255,255,255,0.05)"
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = "rgba(192, 132, 252, 0.1)";
                                e.currentTarget.style.borderColor = "rgba(192, 132, 252, 0.35)";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = "rgba(0,0,0,0.3)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                              }}
                            >
                              <span style={{ fontSize: "11px", color: "#f8fafc" }}>
                                <strong style={{ color: "#c084fc" }}>{bc.qtd}x</strong> {bc.item}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: "800" }}>
                                  {bc.preco}
                                </span>
                                <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#94a3b8" }}>
                                  ⏱️ {bc.hora}
                                </span>
                                <span style={{ fontSize: "11px", color: "#94a3b8", opacity: 0.7 }}>📋</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div
              style={{
                padding: "12px 20px",
                background: "rgba(0,0,0,0.4)",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <div>
                {!funcionarioInspecao.saida && !modoFecharCrash && (
                  <button
                    onClick={() => {
                      setModoFecharCrash(true);
                      setSaidaDataHoraCrash(getAgoraLocalISO());
                    }}
                    style={{
                      background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                      border: "none",
                      color: "#fff",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: "900",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.35)"
                    }}
                  >
                    <span>🚨</span> Fechar Ponto (Crash / Manual)
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  setFuncionarioInspecao(null);
                  setModoFecharCrash(false);
                }}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  color: "#cbd5e1",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                Fechar Modal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Flutuante de Detalhes do Log Original (Discord Raw Log Tooltip) */}
      {hoveredLog && (
        <div
          style={{
            position: "fixed",
            zIndex: 1000000,
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
              fontSize: "11px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              color: "#e2e8f0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: "1.45",
              background: "rgba(0, 0, 0, 0.6)",
              padding: "8px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.08)",
              maxHeight: "340px",
              overflowY: "auto"
            }}
          >
            {hoveredLog.rawLog || (
              hoveredLog.tipo === "bau"
                ? `[ID]: ${funcionarioInspecao?.idJogo} ${funcionarioInspecao?.nome}\n[AÇÃO]: ${hoveredLog.acao}\n[ITEM]: ${hoveredLog.item}\n[HORA]: ${hoveredLog.hora}`
                : hoveredLog.tipo === "tunagem"
                ? `[ID]: ${funcionarioInspecao?.idJogo} ${funcionarioInspecao?.nome}\n[VEÍCULO]: ${hoveredLog.item}\n[VALOR]: ${hoveredLog.preco}\n[HORA]: ${hoveredLog.hora}`
                : `[ID]: ${funcionarioInspecao?.idJogo} ${funcionarioInspecao?.nome}\n[AÇÃO]: ${hoveredLog.acao || "buy"}\n[ITEM]: ${hoveredLog.item}\n[QUANTIDADE]: ${hoveredLog.qtd}\n[VALOR]: ${hoveredLog.preco}\n[HORA]: ${hoveredLog.hora}`
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

      {imagemZoom && (
        <div
          onClick={() => setImagemZoom(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20000,
            background: "rgba(0, 0, 0, 0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "30px",
            cursor: "zoom-out"
          }}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img
              src={imagemZoom}
              alt="Print Ampliado"
              style={{
                maxWidth: "100%",
                maxHeight: "90vh",
                borderRadius: "10px",
                border: "2px solid rgba(255,255,255,0.3)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.8)"
              }}
            />
            <button
              onClick={() => setImagemZoom(null)}
              style={{
                position: "absolute",
                top: "-15px",
                right: "-15px",
                background: "#ef4444",
                border: "2px solid #fff",
                color: "#fff",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                cursor: "pointer",
                fontWeight: "900",
                fontSize: "14px"
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Modal Detalhes da Tunagem (Ficha Completa) */}
      {modalLogTunagemDetalhe && (
        <ModalDetalheTunagem
          theme={theme}
          modalLogDetalhe={modalLogTunagemDetalhe}
          setModalLogDetalhe={setModalLogTunagemDetalhe}
          usuarioLogado={usuarioLogado}
          podeVerJsonBruto={true}
          onConcluido={() => {
            if (funcionarioInspecao) {
              abrirAuditoriaFuncionario(funcionarioInspecao);
            }
          }}
        />
      )}
    </>
  );
}
