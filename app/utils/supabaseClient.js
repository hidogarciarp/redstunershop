import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const client = createClient(supabaseUrl, supabaseKey);

const originalFrom = client.from;
client.from = function (relation) {
  let mappedRelation = relation;
  if (relation === "ponto_cidade") {
    mappedRelation = "ponto_cidade_reds";
  }
  return originalFrom.call(client, mappedRelation);
};

export const supabase = client;
