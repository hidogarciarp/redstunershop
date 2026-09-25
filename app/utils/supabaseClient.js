import { createClient } from "@supabase/supabase-js";

// 1. Cliente de Produção (Banco Atual)
const prodUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const prodKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";
const prodClient = createClient(prodUrl, prodKey);

// 2. Cliente da Versão 2 (Banco Novo)
const v2Url =
  process.env.NEXT_PUBLIC_NEW_SUPABASE_URL ||
  "https://sxrfkbjbyjdmyyxbzobb.supabase.co";
const v2Key =
  process.env.NEXT_PUBLIC_NEW_SUPABASE_KEY ||
  "sb_publishable_et87L-NCrieyXmvteW84-w_v9cxAbjG";

const v2Client = createClient(v2Url, v2Key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Determina se a execução atual está no ambiente Legado de Backup (V1)
export const isV1Mode = () => {
  if (typeof window === "undefined") return false;
  return (
    window.location.pathname.startsWith("/v1") ||
    window.__REDS_V1_MODE__ === true
  );
};

// A Versão 2 (Tabelas Centralizadas no Lakehouse) agora é a versão padrão oficial de todo o sistema
export const isV2Mode = () => {
  return !isV1Mode();
};

// Parser para transformar mensagens brutas de ponto do Discord em registros legíveis de log_ponto_reds
function parsePontoDiscord(item) {
  if (!item) return null;
  const rawText = item.content || "";
  const createdAt = item.created_at;
  const clean = String(rawText).replace(/```ini/gi, "").replace(/```/g, "");
  const lines = clean.split("\n");
  let id = null,
    nome = null,
    tipo = null,
    dataParam = null,
    horaParam = null,
    uuid = null;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const matchId = l.match(
      /^\[ID\]:\s*(\d+)\s+(.+?)\s*\(\s*(ENTROU EM SERVI[ÇC]O|SAIU DE SERVI[ÇC]O)/i
    );
    if (matchId) {
      id = matchId[1].trim();
      nome = matchId[2].trim();
      tipo = matchId[3].toUpperCase().includes("ENTROU") ? "entrada" : "saida";
    }
    const matchData = l.match(
      /\[DATA\]:\s*(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*\[HORA\]:?|\s*,)?\s*(\d{2}:\d{2}:\d{2})/i
    );
    if (matchData) {
      const [, dd, mm, aaaa, hora] = matchData;
      dataParam = `${aaaa}-${mm}-${dd}`;
      horaParam = hora;
    }
    const matchUuid = l.match(/\[UUID\]:\s*([a-f0-9-]{36})/i);
    if (matchUuid) uuid = matchUuid[1].trim();
  }

  if (!tipo) {
    const upper = rawText.toUpperCase();
    if (upper.includes("ENTROU EM SERVIÇO") || upper.includes("ENTROU EM SERVICO")) {
      tipo = "entrada";
    } else if (upper.includes("SAIU DE SERVIÇO") || upper.includes("SAIU DE SERVICO")) {
      tipo = "saida";
    } else {
      tipo = "entrada";
    }
  }

  if (!id) {
    const altMatch = rawText.match(/ID\]?:\s*(\d+)\s*([^(\n]+)/i);
    if (altMatch) {
      id = altMatch[1].trim();
      nome = altMatch[2].trim();
    }
  }

  if (!dataParam && createdAt) {
    try {
      const d = new Date(createdAt);
      const sp = new Date(d.getTime() - 3 * 3600 * 1000);
      dataParam = sp.toISOString().split("T")[0];
      horaParam = sp.toISOString().split("T")[1].slice(0, 8);
    } catch {
      dataParam = createdAt.split("T")[0];
      horaParam = createdAt.slice(11, 19);
    }
  }

  return {
    discord_id: item.id,
    uuid: uuid || `discord-${item.id}`,
    id: id || "—",
    nome: nome || "Desconhecido",
    tipo: tipo || "entrada",
    data: dataParam || "—",
    hora: horaParam || "—",
    timestampz: createdAt,
    criado_em: createdAt,
    raw_content: rawText,
  };
}

// Mapeamento de relações legadas para as tabelas unificadas no Banco Novo
function getV2RelationConfig(relation) {
  const r = (relation || "").trim().toLowerCase();

  // EXCLUSÕES (compatibilidade silenciosa para evitar erros)
  if (r === "logs_excluidos_reds") {
    return { target: "logs_excluidos_reds", filter: null, isExcluidos: true };
  }

  // LOGS DE PONTO BRUTOS (DISCORD INDIVIDUAL - ENTRADAS E SAÍDAS)
  if (["log_ponto_reds", "logs_ponto_reds"].includes(r)) {
    return {
      target: "discord_log_messages",
      filter: { col: "channel_id", val: "1388991065226346718" },
      isPontoDiscord: true,
    };
  }

  // SESSÕES DE PONTO CALCULADAS (REDS)
  if (
    [
      "ponto_cidade",
      "ponto_cidade_reds",
      "pontos_reds",
      "sessoes_ponto_auditoria_reds",
      "log_ponto",
    ].includes(r)
  ) {
    return { target: "log_ponto", filter: { col: "mecanica_id", val: "reds" } };
  }

  // PONTO (OUTRAS MECÂNICAS)
  if (r === "ponto_cidade_mecanica_2") {
    return { target: "log_ponto", filter: { col: "mecanica_id", val: "harmony" } };
  }
  if (r === "ponto_cidade_mecanica_3") {
    return { target: "log_ponto", filter: { col: "mecanica_id", val: "dudark" } };
  }
  if (r === "ponto_cidade_mecanica_4") {
    return { target: "log_ponto", filter: { col: "mecanica_id", val: "vespucci" } };
  }

  // LOGS DE TUNAGEM AO VIVO (RED'S - DISCORD BOT)
  if (["logs_tunagem_reds", "log_tunagem_reds"].includes(r)) {
    return { target: "log_tunagem", filter: { col: "mecanica_id", val: "reds" } };
  }

  // TUNAGEM UNIFICADA / HISTÓRICO GERAL
  if (["logs_tunagem", "log_tunagem"].includes(r)) {
    return { target: "log_tunagem", filter: { col: "mecanica_id", val: "reds" } };
  }

  // BANCADA
  if (
    [
      "log_bancada_reds",
      "logs_bancada_reds",
      "logs_bancada",
      "log_bancada",
    ].includes(r)
  ) {
    return { target: "log_bancada", filter: { col: "mecanica_id", val: "reds" } };
  }

  // BAÚ
  if (
    [
      "logs_bau_reds",
      "log_bau_reds",
      "logs_bau",
      "log_bau",
    ].includes(r)
  ) {
    return { target: "log_bau", filter: { col: "mecanica_id", val: "reds" } };
  }

  // Todas as outras tabelas (usuarios, clientes, servicos, pagamentos_semanais,
  // vendas_nitro, notificacoes, configuracoes, discord_log_messages, etc.)
  // existem no Banco Novo com o mesmo nome exato.
  return { target: relation, filter: null };
}

function handleV2From(relation) {
  const config = getV2RelationConfig(relation);
  const { target, filter, isPontoDiscord, isExcluidos } = config;

  if (isExcluidos) {
    return {
      select: () => Promise.resolve({ data: [], error: null, count: 0 }),
      insert: () => Promise.resolve({ data: [], error: null }),
      upsert: () => Promise.resolve({ data: [], error: null }),
      delete: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
        in: () => Promise.resolve({ data: [], error: null }),
      }),
    };
  }

  // Todas as tabelas no Banco Novo (v2) utilizam v2Client
  const clientParaUso = v2Client;
  const builder = clientParaUso.from(target);

  // Intercepta .delete(...)
  const origDelete = builder.delete.bind(builder);
  builder.delete = function (...args) {
    let delBuilder = origDelete(...args);
    if (filter) {
      delBuilder = delBuilder.eq(filter.col, filter.val);
    }
    if (isPontoDiscord) {
      delBuilder = delBuilder.eq("log_type", "ponto");
      const origDelEq = delBuilder.eq.bind(delBuilder);
      delBuilder.eq = function (col, val) {
        if (col === "uuid") {
          if (String(val).startsWith("discord-")) {
            return origDelEq("id", val.replace("discord-", ""));
          }
          return delBuilder.ilike("content", `%${val}%`);
        }
        return origDelEq(col, val);
      };
      const origDelIn = delBuilder.in.bind(delBuilder);
      delBuilder.in = function (col, vals) {
        if (col === "uuid") {
          const discordIds = vals
            .filter((v) => String(v).startsWith("discord-"))
            .map((v) => v.replace("discord-", ""));
          if (discordIds.length > 0) {
            return origDelIn("id", discordIds);
          }
        }
        return origDelIn(col, vals);
      };
    }
    return delBuilder;
  };

  // Intercepta .select(...) para compatibilizar chamadas de colunas legadas
  const origSelect = builder.select.bind(builder);
  builder.select = function (...args) {
    let selectArgs = args;
    if (typeof args[0] === "string" && args[0] !== "*") {
      let cols = args[0];
      if (target === "log_ponto") {
        cols = cols
          .split(",")
          .map((c) => {
            const t = c.trim();
            if (t === "id_jogo") return "usuario_id";
            if (t === "nome_personagem") return "nome";
            if (t === "uuid_sessao") return "uuid_entrada";
            return t;
          })
          .join(", ");
      } else if (target === "log_bancada" || target === "log_bau") {
        cols = cols
          .split(",")
          .map((c) => {
            const t = c.trim();
            if (t === "id") return "usuario_id";
            if (t === "nome") return "usuario_nome";
            return t;
          })
          .join(", ");
        if (target === "log_bancada" && !cols.includes("item_craftado")) {
          cols += ", item_craftado, quantidade, raw_text";
        }
        if (target === "log_bau" && !cols.includes("item")) {
          cols += ", item, acao, quantidade, raw_text";
        }
      }
      selectArgs = [cols, ...args.slice(1)];
    }

    let filterBuilder = origSelect(...selectArgs);
    if (filter) {
      filterBuilder = filterBuilder.eq(filter.col, filter.val);
    }
    if (isPontoDiscord) {
      filterBuilder = filterBuilder.eq("log_type", "ponto");
    }

    // Intercepta .order(...)
    const origOrder = filterBuilder.order.bind(filterBuilder);
    filterBuilder.order = function (col, opts) {
      if (isPontoDiscord && ["timestampz", "data", "hora", "criado_em"].includes(col)) {
        return origOrder("created_at", opts);
      }
      if (target === "log_ponto") {
        if (col === "timestampz") return origOrder("entrada", opts);
        if (col === "id_jogo") return origOrder("usuario_id", opts);
        if (col === "nome_personagem") return origOrder("nome", opts);
      }
      if (target === "log_bancada" || target === "log_bau") {
        if (col === "id") return origOrder("usuario_id", opts);
        if (col === "nome") return origOrder("usuario_nome", opts);
      }
      return origOrder(col, opts);
    };

    // Intercepta .eq(...)
    const origEq = filterBuilder.eq.bind(filterBuilder);
    filterBuilder.eq = function (col, val) {
      if (isPontoDiscord) {
        if (col === "tipo") {
          if (val === "entrada") return filterBuilder.ilike("content", "%ENTROU EM SERVIÇO%");
          if (val === "saida") return filterBuilder.ilike("content", "%SAIU DE SERVIÇO%");
          if (val === "todos") return filterBuilder;
        }
        if (col === "uuid") {
          return filterBuilder.ilike("content", `%${val}%`);
        }
        if (col === "id") {
          return filterBuilder.or(
            `content.ilike.%[ID]: ${val} %,content.ilike.%(ID: ${val})%,content.ilike.%ID: ${val}%`
          );
        }
        if (col === "data") {
          return filterBuilder
            .gte("created_at", `${val}T00:00:00-03:00`)
            .lte("created_at", `${val}T23:59:59-03:00`);
        }
      }
      if (target === "log_ponto") {
        if (col === "tipo") {
          if (val === "todos") return filterBuilder;
          return origEq("tipo_fechamento", val);
        }
        if (col === "uuid") {
          return filterBuilder.or(`uuid_entrada.eq.${val},uuid_saida.eq.${val}`);
        }
        if (col === "id_jogo") {
          return origEq("usuario_id", parseInt(val, 10) || val);
        }
        if (col === "nome_personagem") {
          return origEq("nome", val);
        }
        if (col === "uuid_sessao") {
          return filterBuilder.or(`uuid_entrada.eq.${val},uuid_saida.eq.${val}`);
        }
      }
      if (target === "log_bancada" || target === "log_bau") {
        if (col === "id") {
          return origEq("usuario_id", String(val));
        }
        if (col === "nome") {
          return origEq("usuario_nome", String(val));
        }
      }
      return origEq(col, val);
    };

    // Intercepta .ilike(...)
    const origIlike = filterBuilder.ilike.bind(filterBuilder);
    filterBuilder.ilike = function (col, val) {
      if (isPontoDiscord && col === "nome") {
        return origIlike("content", val);
      }
      if (target === "log_ponto" && col === "nome_personagem") {
        return origIlike("nome", val);
      }
      if ((target === "log_bancada" || target === "log_bau") && col === "nome") {
        return origIlike("usuario_nome", val);
      }
      return origIlike(col, val);
    };

    // Intercepta .gte(...) e .lte(...) para datas em discord_log_messages
    const origGte = filterBuilder.gte.bind(filterBuilder);
    filterBuilder.gte = function (col, val) {
      if (isPontoDiscord && col === "data") {
        return origGte("created_at", `${val}T00:00:00-03:00`);
      }
      return origGte(col, val);
    };

    const origLte = filterBuilder.lte.bind(filterBuilder);
    filterBuilder.lte = function (col, val) {
      if (isPontoDiscord && col === "data") {
        return origLte("created_at", `${val}T23:59:59-03:00`);
      }
      return origLte(col, val);
    };

    // Intercepta .or(...) para compatibilidade de filtros complexos
    const origOr = filterBuilder.or.bind(filterBuilder);
    filterBuilder.or = function (filters, options) {
      if (isPontoDiscord || target === "log_ponto") {
        if (filters && filters.includes("oculto")) {
          return filterBuilder;
        }
      }
      if (target === "log_ponto" && filters) {
        let adapted = filters
          .replace(/\bid_jogo\./g, "usuario_id.")
          .replace(/\bnome_personagem\./g, "nome.")
          .replace(/\buuid_sessao\./g, "uuid_entrada.");
        return origOr(adapted, options);
      }
      if ((target === "log_bancada" || target === "log_bau") && filters) {
        let adapted = filters
          .replace(/\bid\./g, "usuario_id.")
          .replace(/\bnome\./g, "usuario_nome.");
        return origOr(adapted, options);
      }
      return origOr(filters, options);
    };

    // Intercepta .then(...) para enriquecer dados retornados
    const origThen = filterBuilder.then.bind(filterBuilder);
    filterBuilder.then = function (onfulfilled, onrejected) {
      return origThen((result) => {
        if (result && Array.isArray(result.data)) {
          if (isPontoDiscord) {
            result.data = result.data.map(parsePontoDiscord).filter(Boolean);
          } else {
            result.data = result.data.map((item) => {
              if (!item) return item;
              if (target === "log_bancada" || target === "log_bau") {
                const rawNome = item.usuario_nome || item.nome || "";
                const cleanNome = rawNome
                  .replace(/^\[(?:NOME COMPLETO|ITEMKEY|PRICE)\]:\s*/i, "")
                  .trim();
                let rawItem = item.item_craftado || item.item || "";
                let cleanItem = rawItem
                  .replace(/^\[(?:ITEMNAME|ITEMKEY)\]:\s*/i, "")
                  .trim();

                let acaoCalc = item.acao;
                let qtdCalc = item.quantidade || 1;
                let horaCalc = item.hora;

                if (target === "log_bau" && item.raw_text) {
                  const matchAcao =
                    item.raw_text.match(/\[(RETIROU|GUARDOU|COLOCOU|MOVIMENTOU)\]:?\s*(?:(\d+)\s*x\s+)?([^\n\r`]+)/i) ||
                    item.raw_text.match(/(?:^|\n)\s*(RETIROU|GUARDOU|COLOCOU|MOVIMENTOU):?\s*(?:(\d+)\s*x\s+)?([^\n\r`]+)/i);
                  if (matchAcao) {
                    acaoCalc = matchAcao[1].toUpperCase();
                    if (matchAcao[2]) qtdCalc = parseInt(matchAcao[2], 10);
                    if (matchAcao[3] && matchAcao[3].trim()) cleanItem = matchAcao[3].trim();
                  }
                  if (!horaCalc || horaCalc === "00:00:00") {
                    const matchHora =
                      item.raw_text.match(/\[DATA\]:\s*\d{2}\/\d{2}\/\d{4}(?:,\s*|\s+)(\d{2}:\d{2}:\d{2})/i) ||
                      item.raw_text.match(/\[HORA\]:\s*(\d{2}:\d{2}:\d{2})/i);
                    if (matchHora) horaCalc = matchHora[1];
                  }
                }

                let valorCalc = item.valor || item.valor_pago || 0;
                if (!valorCalc && item.raw_text) {
                  const matchPreco = item.raw_text.match(/\[PRICE\]:\s*([0-9.,]+)/i);
                  if (matchPreco) {
                    valorCalc = parseFloat(matchPreco[1].replace(/\./g, "").replace(",", ".")) || 0;
                  }
                }

                return {
                  ...item,
                  id: item.usuario_id || item.id,
                  usuario_id: item.usuario_id || item.id,
                  nome: cleanNome || "—",
                  usuario_nome: cleanNome || "—",
                  acao: acaoCalc || item.acao || "MOVIMENTOU",
                  item: cleanItem || item.item || item.item_craftado || "Item",
                  nome_item: cleanItem || item.item || item.item_craftado || "Item",
                  nomeItem: cleanItem || item.item || item.item_craftado || "Item",
                  item_craftado: cleanItem || item.item_craftado || item.item || "Item",
                  quantidade: qtdCalc,
                  qtd: qtdCalc,
                  hora: horaCalc || item.hora || "—",
                  valor: valorCalc,
                  preco: valorCalc,
                };
              }
              if (target === "log_ponto") {
                return {
                  ...item,
                  id: item.id,
                  id_jogo: item.usuario_id,
                  usuario_id: item.usuario_id,
                  nome_personagem: item.nome,
                  uuid_sessao: item.uuid_entrada || item.uuid,
                  uuid_entrada: item.uuid_entrada || item.uuid,
                  uuid_saida: item.uuid_saida,
                  duracaoMin: item.total_minutos,
                  duracao_min: item.total_minutos,
                  status_ponto: (item.tipo_fechamento || "normal").toLowerCase(),
                  statusPonto: (item.tipo_fechamento || "normal").toLowerCase(),
                  totalTunagens: item.qtd_tunagens || 0,
                  total_tunagens: item.qtd_tunagens || 0,
                  totalBancada: item.qtd_bancada || 0,
                  total_bancada: item.qtd_bancada || 0,
                  uuid: item.uuid_entrada || item.uuid,
                  tipo: item.tipo_fechamento || "sessao",
                  hora: item.entrada ? item.entrada.slice(11, 16) : "",
                };
              }
              return item;
            });
          }
        }
        return onfulfilled ? onfulfilled(result) : result;
      }, onrejected);
    };

    return filterBuilder;
  };

  // Intercepta .insert(...) e .upsert(...) para garantir integridade do mecanica_id
  const sanitizarPayloadV2 = (v) => {
    if (!v || typeof v !== "object") return;
    if (filter && !v[filter.col]) v[filter.col] = filter.val;
    if (target !== "discord_log_messages" && "mechanic_id" in v) {
      if (!v.mecanica_id) v.mecanica_id = v.mechanic_id;
      delete v.mechanic_id;
    }
    if (target === "log_tunagem" && !v.timestampz) {
      v.timestampz = new Date().toISOString();
    }
  };

  const origInsert = builder.insert.bind(builder);
  builder.insert = function (values, options) {
    if (values) {
      if (Array.isArray(values)) {
        values.forEach(sanitizarPayloadV2);
      } else if (typeof values === "object") {
        sanitizarPayloadV2(values);
      }
    }
    const query = origInsert(values, options);
    let selectCalled = false;
    let selectArgs = [];
    const origSelect = query.select ? query.select.bind(query) : null;
    if (origSelect) {
      query.select = function (...args) {
        selectCalled = true;
        selectArgs = args;
        return origSelect(...args);
      };
    }
    const origThen = query.then.bind(query);
    query.then = function (onfulfilled, onrejected) {
      return origThen(async (result) => {
        if (result?.error?.code === "23505" && result?.error?.message?.includes("_pkey")) {
          try {
            const { data: maxRows } = await clientParaUso
              .from(target)
              .select("id")
              .order("id", { ascending: false })
              .limit(1);
            const maxId = Number(maxRows?.[0]?.id) || 0;
            const nextId = maxId + 1;
            let retryValues;
            if (Array.isArray(values)) {
              retryValues = values.map((item, idx) => ({ id: nextId + idx, ...item }));
            } else {
              retryValues = { id: nextId, ...values };
            }
            let retryQuery = clientParaUso.from(target).insert(retryValues, options);
            if (selectCalled && retryQuery.select) {
              retryQuery = retryQuery.select(...selectArgs);
            }
            const retryResult = await retryQuery;
            return onfulfilled ? onfulfilled(retryResult) : retryResult;
          } catch (e) {
            return onfulfilled ? onfulfilled(result) : result;
          }
        }
        return onfulfilled ? onfulfilled(result) : result;
      }, onrejected);
    };
    return query;
  };

  const origUpsert = builder.upsert.bind(builder);
  builder.upsert = function (values, options) {
    if (values) {
      if (Array.isArray(values)) {
        values.forEach(sanitizarPayloadV2);
      } else if (typeof values === "object") {
        sanitizarPayloadV2(values);
      }
    }
    return origUpsert(values, options);
  };

  return builder;
}

// Proxy inteligente que roteia automaticamente para o Banco Novo quando em V2
export const supabase = new Proxy(prodClient, {
  get(target, prop) {
    const isV2 = isV2Mode();
    const activeClient = isV2 ? v2Client : prodClient;

    if (prop === "from") {
      return function (relation) {
        if (!isV2) {
          let mappedRelation = relation;
          if (relation === "ponto_cidade") {
            mappedRelation = "ponto_cidade_reds";
          }
          return prodClient.from(mappedRelation);
        }
        return handleV2From(relation);
      };
    }

    // Realtime (WebSockets)
    if (prop === "channel" || prop === "removeChannel" || prop === "removeAllChannels" || prop === "getChannels") {
      const fn = activeClient[prop];
      if (typeof fn === "function") {
        return fn.bind(activeClient);
      }
      return fn;
    }

    const val = activeClient[prop];
    if (typeof val === "function") {
      return val.bind(activeClient);
    }
    return val;
  },
});
