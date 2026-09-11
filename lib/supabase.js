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

  return originalFrom(mappedRelation);
};
