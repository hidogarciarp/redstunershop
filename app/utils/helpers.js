import { CARGOS_HIERARQUIA } from "./constants.js";

export const getPrimaryRole = (role) => {
  if (!role) return "estagiario";
  return role.split("|")[0].toLowerCase().trim();
};

export const getAtribuicoes = (role) => {
  if (!role) return [];
  return role.split("|").slice(1);
};

export const getLabelCargo = (role) => {
  const primary = getPrimaryRole(role);
  const cargo = CARGOS_HIERARQUIA.find((c) => c.value === primary);
  let label = cargo ? cargo.label : primary;
  const atr = getAtribuicoes(role).filter((a) => a !== "dono_secundario");
  if (atr.length > 0) {
    const atrLabels = atr.map((a) => {
      if (a === "gerente_rh") return "💜 Gerente RH";
      if (a === "resp_rh") return "👥 Resp. RH";
      if (a === "resp_ponto") return "📌 Resp. Ponto";
      if (a === "resp_eventos") return "📅 Resp. Eventos";
      if (a === "resp_tunagem") return "🔧 Resp. Tunagem";
      if (a === "resp_parcerias") return "🤝 Resp. Parcerias";
      if (a === "resp_financas") return "💰 Resp. Finanças";
      return a;
    });
    label += " | " + atrLabels.join(", ");
  }
  return label;
};

export const getNivel = (role) => {
  const primary = getPrimaryRole(role);
  const cargo = CARGOS_HIERARQUIA.find((c) => c.value === primary);
  return cargo ? cargo.nivel : 0;
};

export const isAdminOuDono = (role) => {
  const primary = getPrimaryRole(role);
  return primary === "admin" || primary === "dono";
};

export const isResponsavelPonto = (role) => {
  const primary = getPrimaryRole(role);
  return isAdminOuDono(role) || primary === "gerente_geral" || getAtribuicoes(role).includes("resp_ponto");
};

export const podeNotificar = (roleRemetente, roleDestinatario) => {
  return getNivel(roleRemetente) > getNivel(roleDestinatario);
};

export const podeSendNotif = (role) => getNivel(role) >= 2;

export const podeEditarFuncionario = (editorRole, alvoRole) => {
  const editorPrimary = getPrimaryRole(editorRole);
  const editorAtr = getAtribuicoes(editorRole);
  const editorNivel = getNivel(editorRole);
  const alvoNivel = getNivel(alvoRole);
  if (editorPrimary === "admin" || editorPrimary === "dono") return true;
  const isRH = editorPrimary === "gerente_rh" || editorAtr.includes("gerente_rh") || editorAtr.includes("resp_rh");
  if ((editorPrimary === "gerente_geral" || isRH) && alvoNivel < 6) return true;
  if (editorPrimary === "gerente" && alvoNivel < 5) return true;
  return false;
};

export const formatarTelefone = (v) => {
  const digits = v.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 3) return digits;
  return digits.slice(0, 3) + "-" + digits.slice(3);
};

/**
 * Retorna os parâmetros de Horário Obrigatório com base na data do dia.
 * - A partir de 07/09/2026 (inclusive): 18h às 23h (5 horas de pico)
 * - Até 06/09/2026 (inclusive): 19h às 22h (3 horas de pico)
 */
export const getHorarioObrigatorioParaData = (dateStr) => {
  if (!dateStr) {
    return {
      horaInicio: "18:00:00",
      horaFim: "23:00:00",
      horaInicioNum: 18,
      horaFimNum: 23,
      slotInicioIdx: 36, // 18:00
      slotFimIdx: 45,    // 22:30 (cobre até 23:00)
      totalHoras: 5,
      totalMinutos: 300,
      totalSlots30Min: 10,
      label: "18h às 23h",
      labelCurto: "18h-23h",
    };
  }

  const dStr = typeof dateStr === "string" ? dateStr.split("T")[0] : new Date(dateStr).toISOString().split("T")[0];
  if (dStr >= "2026-09-07") {
    return {
      horaInicio: "18:00:00",
      horaFim: "23:00:00",
      horaInicioNum: 18,
      horaFimNum: 23,
      slotInicioIdx: 36, // 18:00
      slotFimIdx: 45,    // 22:30 (cobre até 23:00)
      totalHoras: 5,
      totalMinutos: 300,
      totalSlots30Min: 10,
      label: "18h às 23h",
      labelCurto: "18h-23h",
    };
  }

  return {
    horaInicio: "19:00:00",
    horaFim: "22:00:00",
    horaInicioNum: 19,
    horaFimNum: 22,
    slotInicioIdx: 38, // 19:00
    slotFimIdx: 43,    // 21:30 (cobre até 22:00)
    totalHoras: 3,
    totalMinutos: 180,
    totalSlots30Min: 6,
    label: "19h às 22h",
    labelCurto: "19h-22h",
  };
};

export async function sincronizarPontosDiscordParaReds(supabaseClient, diasRetroativos = 15) {
  if (!supabaseClient) return;
  try {
    const dataLimite = new Date(Date.now() - diasRetroativos * 24 * 60 * 60 * 1000).toISOString();
    const { data: msgs, error } = await supabaseClient
      .from("discord_log_messages")
      .select("*")
      .eq("log_type", "ponto")
      .gte("created_at", dataLimite)
      .order("id", { ascending: true });

    if (error || !msgs || msgs.length === 0) return;

    const mapa = {};
    msgs.forEach((m) => {
      const c = m.content || "";
      const isEntrou = c.includes("ENTROU EM SERVIÇO");
      const isSaiu = c.includes("SAIU DE SERVIÇO");
      if (!isEntrou && !isSaiu) return;

      const match = c.match(/\[ID\]:\s*(\d+)\s+([^(]+)\(\s*(ENTROU EM SERVIÇO|SAIU DE SERVIÇO)\s*-\s*([^)]+)\)/i);
      let idJogo = "";
      let nome = "";
      let tipo = isEntrou ? "entrada" : "saida";
      let oficina = "Red's Tunershop";

      if (match) {
        idJogo = match[1].trim();
        nome = match[2].trim();
        oficina = match[4].trim();
      } else {
        const idMatch = c.match(/\[ID\]:\s*(\d+)/i);
        if (idMatch) idJogo = idMatch[1].trim();
        const nomeMatch = c.match(/\[ID\]:\s*\d+\s+([^(]+)/i);
        if (nomeMatch) nome = nomeMatch[1].trim();
        const ofcMatch = c.match(/-\s*([^)]+)\)/i);
        if (ofcMatch) oficina = ofcMatch[1].trim();
      }

      const ofcLower = (oficina || "").toLowerCase();
      if (!ofcLower.includes("red")) return;

      const dataMatch = c.match(/\[DATA\]:\s*(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}:\d{2})/i);
      let timestamp = m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString();

      if (dataMatch) {
        const [_, dataStr, horaStr] = dataMatch;
        const [dia, mes, ano] = dataStr.split("/");
        timestamp = new Date(`${ano}-${mes}-${dia}T${horaStr}-03:00`).toISOString();
      }

      const uuidMatch = c.match(/\[UUID\]:\s*([a-f0-9-]+)/i);
      const uuid = uuidMatch ? uuidMatch[1].trim() : null;

      if (!idJogo) return;
      if (!mapa[idJogo]) mapa[idJogo] = { idJogo, nome, eventos: [] };
      mapa[idJogo].eventos.push({ idJogo, nome, tipo, oficina, timestamp, uuid });
    });

    const sessoes = [];
    Object.values(mapa).forEach((m) => {
      m.eventos.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      let pontoAtual = null;

      m.eventos.forEach((ev) => {
        if (ev.tipo === "entrada") {
          if (pontoAtual) sessoes.push(pontoAtual);
          pontoAtual = {
            id: m.idJogo,
            nome: m.nome,
            entrada: ev.timestamp,
            saida: null,
            uuid_entrada: ev.uuid || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `auto-${Date.now()}-${Math.random()}`),
            uuid_saida: null,
            tempo: 0,
          };
        } else if (ev.tipo === "saida") {
          if (pontoAtual) {
            pontoAtual.saida = ev.timestamp;
            pontoAtual.uuid_saida = ev.uuid;
            const diffMin = Math.round((new Date(ev.timestamp) - new Date(pontoAtual.entrada)) / 60000);
            pontoAtual.tempo = Math.max(0, diffMin);
            sessoes.push(pontoAtual);
            pontoAtual = null;
          } else {
            sessoes.push({
              id: m.idJogo,
              nome: m.nome,
              entrada: ev.timestamp,
              saida: ev.timestamp,
              tempo: 0,
              uuid_entrada: ev.uuid || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `auto-${Date.now()}-${Math.random()}`),
              uuid_saida: ev.uuid,
            });
          }
        }
      });

      if (pontoAtual) sessoes.push(pontoAtual);
    });

    if (sessoes.length === 0) return;

    const { data: existentes } = await supabaseClient
      .from("pontos_reds")
      .select("id, entrada, saida, uuid_entrada")
      .gte("entrada", dataLimite);

    const mapaExistentes = new Map();
    (existentes || []).forEach((e) => {
      mapaExistentes.set(`${e.id}_${e.entrada}`, e);
    });

    const paraInserir = [];
    for (const s of sessoes) {
      const key = `${s.id}_${s.entrada}`;
      const ex = mapaExistentes.get(key);
      if (!ex) {
        paraInserir.push(s);
      } else if (!ex.saida && s.saida) {
        // Atualiza ponto que estava aberto e agora foi fechado
        await supabaseClient
          .from("pontos_reds")
          .update({ saida: s.saida, uuid_saida: s.uuid_saida, tempo: s.tempo })
          .eq("id", ex.id)
          .eq("entrada", ex.entrada);
      }
    }

    if (paraInserir.length > 0) {
      for (let i = 0; i < paraInserir.length; i += 50) {
        const lote = paraInserir.slice(i, i + 50);
        await supabaseClient
          .from("pontos_reds")
          .upsert(lote, { onConflict: "uuid_entrada" });
      }
    }

    // Sincroniza também na tabela sessoes_ponto_auditoria_reds para manter o Gerenciador do Banco e Auditoria 100% atualizados
    try {
      const auditRecords = sessoes.map((s) => ({
        uuid_sessao: s.uuid_entrada || `${s.id}_${s.entrada}`,
        id_jogo: String(s.id),
        nome: s.nome,
        oficina: "Red's Tunershop",
        oficina_id: "reds",
        entrada: s.entrada,
        saida: s.saida || null,
        duracao_min: s.tempo || 0,
        status_ponto: s.saida ? "normal" : "aberto"
      }));
      for (let i = 0; i < auditRecords.length; i += 50) {
        const lote = auditRecords.slice(i, i + 50);
        await supabaseClient
          .from("sessoes_ponto_auditoria_reds")
          .upsert(lote, { onConflict: "uuid_sessao" });
      }
    } catch (eAudit) {
      console.warn("Aviso ao atualizar sessoes_ponto_auditoria_reds:", eAudit?.message);
    }
  } catch (err) {
    console.warn("Sincronização de pontos discord para pontos_reds:", err.message);
  }
}