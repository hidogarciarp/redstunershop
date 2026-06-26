import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://prperurjtvayjrazdxvh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBycGVydXJqdHZheWpyYXpkeHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjEwMzUsImV4cCI6MjA5MDU5NzAzNX0.MDk7Pm5fYQ_18GPUDv0R360y_M1eBaJ2-zKHPhmQOJ0";
const supabase = createClient(supabaseUrl, supabaseKey);

function obterLabelSemana(dataStr) {
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
}

async function run() {
  const agora = new Date("2026-06-15T18:25:08-03:00"); // Time from prompt
  const dataLimite = new Date(agora);
  dataLimite.setDate(agora.getDate() - 60);
  const dataLimiteStr = dataLimite.toLocaleDateString("en-CA");
  const { key: dataLimiteSemanaInicio } = obterLabelSemana(dataLimiteStr);
  const dataQueryInicio = dataLimiteSemanaInicio || dataLimiteStr;

  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("ponto_cidade")
      .select("usuario_id, nome, entrada, saida, data")
      .or("oculto.is.null,oculto.eq.false")
      .gte("data", dataQueryInicio)
      .order("id", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

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

  const func = { id: 171, nome: "Corina Castro", data_admissao: "2026-04-16" };

  const logsFunc = allData.filter(reg => {
    if (reg.usuario_id && String(reg.usuario_id) === String(func.id)) return true;
    if (reg.nome && func.nome && reg.nome.toLowerCase().trim() === func.nome.toLowerCase().trim()) return true;
    return false;
  });

  const dataLimite60 = new Date(agora);
  dataLimite60.setDate(agora.getDate() - 60);
  const dataAdmissao = func.data_admissao ? new Date(`${func.data_admissao}T12:00:00`) : null;
  const dataInicioAvaliacao = dataAdmissao && dataAdmissao > dataLimite60 ? dataAdmissao : dataLimite60;

  const semanasPossiveis = {};
  let temp = new Date(dataInicioAvaliacao);
  const hojeStr = agora.toLocaleDateString("en-CA");

  while (temp <= agora) {
    const yyyymmdd = temp.toLocaleDateString("en-CA");
    const { key, label } = obterLabelSemana(yyyymmdd);
    if (key) {
      semanasPossiveis[key] = { label, totalMinutos: 0 };
    }
    temp.setDate(temp.getDate() + 7);
  }
  const { key: hojeKey, label: hojeLabel } = obterLabelSemana(hojeStr);
  if (hojeKey) {
    semanasPossiveis[hojeKey] = { label: hojeLabel, totalMinutos: 0 };
  }

  logsFunc.forEach(reg => {
    if (!reg.entrada || !reg.saida) return;
    const { key } = obterLabelSemana(reg.data);
    if (key && semanasPossiveis[key] !== undefined) {
      const diff = (new Date(reg.saida) - new Date(reg.entrada)) / 60000;
      if (diff > 0) {
        semanasPossiveis[key].totalMinutos += diff;
      }
    }
  });

  console.log("Semanas possíveis e minutos acumulados (PATCHED):");
  console.log(semanasPossiveis);

  let semanasComPoucasHoras = 0;
  const detalheSemanas = [];
  Object.keys(semanasPossiveis).forEach(weekKey => {
    const { key: semanaAtualKey } = obterLabelSemana(hojeStr);
    if (weekKey === semanaAtualKey) {
      detalheSemanas.push({ weekKey, info: semanasPossiveis[weekKey], status: "IGNORADA (semana atual)" });
      return;
    }

    if (func.data_admissao) {
      const { key: admWeekKey } = obterLabelSemana(func.data_admissao);
      if (weekKey === admWeekKey && func.data_admissao > admWeekKey) {
        detalheSemanas.push({ weekKey, info: semanasPossiveis[weekKey], status: "IGNORADA (contratação no meio da semana)" });
        return;
      }
    }

    const totalMinutos = semanasPossiveis[weekKey].totalMinutos;
    const temPouco = totalMinutos < 240;
    if (temPouco) {
      semanasComPoucasHoras++;
    }
    detalheSemanas.push({ weekKey, info: semanasPossiveis[weekKey], status: temPouco ? "POUCAS HORAS (<4h)" : "OK" });
  });

  console.log("Detalhe semanas (PATCHED):", detalheSemanas);
  console.log("Total semanas com poucas horas:", semanasComPoucasHoras);
  console.log("Alerta ativado?", semanasComPoucasHoras >= 3);
}

run();
