import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const originalFrom = supabase.from.bind(supabase);

supabase.from = function fromSelectedDatabase(relation) {
  let mappedRelation = relation;

  if (typeof window !== "undefined") {
    const modoBanco = localStorage.getItem("reds_tabelas_novas");

    if (modoBanco === "true") {
      if (relation === "ponto_cidade") mappedRelation = "pc_1";
      else if (relation === "ponto_cidade_mecanica_2") mappedRelation = "pc_2";
      else if (relation === "ponto_cidade_mecanica_3") mappedRelation = "pc_3";
    } else if (modoBanco === "reds" && relation === "ponto_cidade") {
      mappedRelation = "ponto_cidade_reds";
    }
  }

  const builder = originalFrom(mappedRelation);
  const origInsert = builder.insert.bind(builder);
  builder.insert = function (values, options) {
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
            const { data: maxRows } = await originalFrom(mappedRelation)
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
            let retryQuery = originalFrom(mappedRelation).insert(retryValues, options);
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
  return builder;
};
