import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Parse .env.local manually
const envFile = fs.readFileSync(".env.local", "utf8");
const env = {};
envFile.split("\n").forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore && allData.length < 50000) {
    let query = supabase
      .from("ponto_cidade")
      .select("*")
      .or("oculto.is.null,oculto.eq.false")
      .order("id", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    const { data, error } = await query;
    if (error) {
      console.error(error);
      return;
    }
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      if (data.length < pageSize) hasMore = false;
      else page++;
    } else {
      hasMore = false;
    }
  }

  console.log("Total records fetched:", allData.length);
  const ids = allData.map(r => r.id);
  const uniqueIds = new Set(ids);
  console.log("Unique IDs count:", uniqueIds.size);
  
  if (ids.length !== uniqueIds.size) {
    console.log("DUPLICATES FOUND IN FETCHED DATA!");
    const seen = new Set();
    const dups = [];
    ids.forEach(id => {
      if (seen.has(id)) {
        dups.push(id);
      }
      seen.add(id);
    });
    console.log("Duplicate IDs:", dups);
  }
}
run();
