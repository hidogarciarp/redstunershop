"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";

function fmtMin(totalMin) {
  if (!totalMin || totalMin <= 0) return "0h 00min";
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

function fmtBR(isoDate) {
  return isoDate ? new Date(isoDate + "T12:00:00").toLocaleDateString("pt-BR") : "";
}

function calcularMetricasMecanica(registros, diasPeriodo) {
  let totalMin = 0;
  const pessoasUnicas = new Set();
  let sessoes = 0;

  registros.forEach(reg => {
    if (reg.oculto) return;
    if (reg.entrada) {
      const dEntrada = new Date(reg.entrada);
      const dSaida = reg.saida ? new Date(reg.saida) : new Date();
      const diff = (dSaida - dEntrada) / 60000;
      if (diff > 0) {
        totalMin += diff;
        sessoes++;
      }
      if (reg.nome_personagem || reg.nome) {
        pessoasUnicas.add(reg.nome_personagem || reg.nome);
      }
    }
  });

  let slotsCobertos = 0;
  let slotsObrigatoriosCobertos = 0;
  const totalSlots = diasPeriodo.length * 48;
  const totalSlotsObrigatorios = diasPeriodo.length * 6;

  if (totalSlots > 0) {
    diasPeriodo.forEach(dia => {
      for (let h = 0; h < 24; h++) {
        const hStr = String(h).padStart(2, "0");
        const nextHStr = String(h + 1).padStart(2, "0");
        
        const start1 = new Date(`${dia}T${hStr}:00:00`).getTime();
        const end1 = new Date(`${dia}T${hStr}:30:00`).getTime();
        
        const start2 = new Date(`${dia}T${hStr}:30:00`).getTime();
        let end2;
        if (h === 23) {
          const base = new Date(`${dia}T00:00:00`).getTime();
          end2 = base + 24 * 60 * 60 * 1000;
        } else {
          end2 = new Date(`${dia}T${nextHStr}:00:00`).getTime();
        }

        let coberto1 = false;
        let coberto2 = false;

        for (let i = 0; i < registros.length; i++) {
          const reg = registros[i];
          if (reg.oculto) continue;
          if (!reg.entrada) continue;

          const tEntrada = new Date(reg.entrada).getTime();
          const tSaida = reg.saida ? new Date(reg.saida).getTime() : Date.now();

          if (Math.max(tEntrada, start1) < Math.min(tSaida, end1)) {
            coberto1 = true;
          }
          if (Math.max(tEntrada, start2) < Math.min(tSaida, end2)) {
            coberto2 = true;
          }

          if (coberto1 && coberto2) break;
        }

        const ehObrigatorio = h >= 19 && h <= 21;

        if (coberto1) {
          slotsCobertos++;
          if (ehObrigatorio) slotsObrigatoriosCobertos++;
        }
        if (coberto2) {
          slotsCobertos++;
          if (ehObrigatorio) slotsObrigatoriosCobertos++;
        }
      }
    });
  }

  const taxaCobertura = totalSlots > 0 ? (slotsCobertos / totalSlots) * 100 : 0;
  const taxaCoberturaObrigatoria = totalSlotsObrigatorios > 0 ? (slotsObrigatoriosCobertos / totalSlotsObrigatorios) * 100 : 0;
  
  const minutosObrigatoriosTotais = diasPeriodo.length * 180;
  const minutosObrigatoriosCobertos = (slotsObrigatoriosCobertos / (diasPeriodo.length * 6 || 1)) * minutosObrigatoriosTotais;
  const minutosObrigatoriosNaoCumpridos = Math.max(0, minutosObrigatoriosTotais - minutosObrigatoriosCobertos);

  return {
    totalMin,
    sessoes,
    funcionariosAtivos: pessoasUnicas.size,
    taxaCobertura,
    taxaCoberturaObrigatoria,
    minutosCobertos: (slotsCobertos / 2) * 60,
    minutosObrigatoriosNaoCumpridos
  };
}

function calcularSlotsGenerico(registros, dia) {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    const hStr = String(h).padStart(2, "0");
    const nextHStr = String(h + 1).padStart(2, "0");
    
    slots.push({
      label: `${hStr}:00 - ${hStr}:30`,
      start: new Date(`${dia}T${hStr}:00:00`),
      end: new Date(`${dia}T${hStr}:30:00`)
    });
    
    let endVal;
    if (h === 23) {
      const base = new Date(`${dia}T00:00:00`).getTime();
      const proximoDia = new Date(base + 24 * 60 * 60 * 1000);
      const proximoDiaStr = proximoDia.toLocaleDateString("en-CA");
      endVal = new Date(`${proximoDiaStr}T00:00:00`);
    } else {
      endVal = new Date(`${dia}T${nextHStr}:00:00`);
    }
    
    slots.push({
      label: `${hStr}:30 - ${nextHStr === "24" ? "00" : nextHStr}:00`,
      start: new Date(`${dia}T${hStr}:30:00`),
      end: endVal
    });
  }

  return slots.map(slot => {
    const funcionariosTrabalhando = [];
    registros.forEach(reg => {
      if (reg.oculto) return;
      if (!reg.entrada) return;
      
      const entradaDate = new Date(reg.entrada);
      const saidaDate = reg.saida ? new Date(reg.saida) : new Date();
      
      if (entradaDate < slot.end && saidaDate > slot.start) {
        let funcNome = reg.nome || reg.nome_personagem || `ID: ${reg.id_jogo}`;
        if (!funcionariosTrabalhando.some(f => f.nome === funcNome)) {
          funcionariosTrabalhando.push({
            nome: funcNome,
            idJogo: reg.id_jogo
          });
        }
      }
    });
    
    return {
      ...slot,
      coberto: funcionariosTrabalhando.length > 0,
      funcionarios: funcionariosTrabalhando
    };
  });
}

export default function RelatorioPublicoPage({ sharedId }) {
  const [relatorioInfo, setRelatorioInfo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [registrosM1, setRegistrosM1] = useState([]);
  const [registrosM2, setRegistrosM2] = useState([]);
  const [registrosM3, setRegistrosM3] = useState([]);

  useEffect(() => {
    async function carregarDados() {
      try {
        setCarregando(true);
        // Buscar informações do link compartilhado
        const { data: linkInfo, error: linkError } = await supabase
          .from("relatorios_compartilhados")
          .select("*")
          .eq("id", sharedId)
          .maybeSingle();

        if (linkError) throw linkError;
        if (!linkInfo) {
          setErro("O relatório solicitado não foi encontrado ou o compartilhamento foi revogado.");
          setCarregando(false);
          return;
        }

        setRelatorioInfo(linkInfo);

        const inicioISO = new Date(`${linkInfo.data_inicio}T00:00:00-03:00`).toISOString();
        const fimISO = new Date(`${linkInfo.data_fim}T23:59:59-03:00`).toISOString();

        // Buscar pontos das 3 mecânicas
        const [resM1, resM2, resM3] = await Promise.all([
          supabase.from("ponto_cidade").select("*").gte("entrada", inicioISO).lte("entrada", fimISO).eq("oculto", false),
          supabase.from("ponto_cidade_mecanica_2").select("*").gte("entrada", inicioISO).lte("entrada", fimISO).eq("oculto", false),
          supabase.from("ponto_cidade_mecanica_3").select("*").gte("entrada", inicioISO).lte("entrada", fimISO).eq("oculto", false)
        ]);

        const filtrarManuais = (regs) => {
          if (!linkInfo.excluir_manuais) return regs;
          return regs.filter(r => r.uuid_entrada && r.uuid_saida);
        };

        setRegistrosM1(filtrarManuais(resM1.data || []));
        setRegistrosM2(filtrarManuais(resM2.data || []));
        setRegistrosM3(filtrarManuais(resM3.data || []));

      } catch (err) {
        console.error("Erro ao carregar dados do relatório:", err);
        setErro("Falha ao se comunicar com o banco de dados. Detalhes: " + err.message);
      } finally {
        setCarregando(false);
      }
    }

    if (sharedId) carregarDados();
  }, [sharedId]);

  if (carregando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0f172a", color: "#fff" }}>
        <div style={{ fontSize: "16px", fontWeight: "700" }}>⏳ Carregando relatório compartilhado...</div>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0f172a", color: "#fff", padding: "20px", textAlign: "center" }}>
        <span style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</span>
        <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#f87171" }}>Link Inválido ou Revogado</h2>
        <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "8px", maxWidth: "450px" }}>{erro}</p>
      </div>
    );
  }

  // Calcular métricas
  const diasPeriodo = [];
  const startObj = new Date(`${relatorioInfo.data_inicio}T12:00:00`);
  const endObj = new Date(`${relatorioInfo.data_fim}T12:00:00`);
  let atual = new Date(startObj);
  while (atual <= endObj) {
    diasPeriodo.push(atual.toLocaleDateString("en-CA"));
    atual.setDate(atual.getDate() + 1);
  }

  const metricasM1 = calcularMetricasMecanica(registrosM1, diasPeriodo);
  const metricasM2 = calcularMetricasMecanica(registrosM2, diasPeriodo);
  const metricasM3 = calcularMetricasMecanica(registrosM3, diasPeriodo);

  const rankingMecanicas = [
    { id: "m1", nome: "RED's Tunershop", cor: "#ef4444", ...metricasM1 },
    { id: "m2", nome: "Harmony", cor: "#eab308", ...metricasM2 },
    { id: "m3", nome: "Dudark", cor: "#38bdf8", ...metricasM3 },
  ].sort((a, b) => b.taxaCobertura - a.taxaCobertura || b.totalMin - a.totalMin);

  const coberturaComparativa = {};
  diasPeriodo.forEach(dia => {
    coberturaComparativa[dia] = {
      m1: calcularSlotsGenerico(registrosM1, dia),
      m2: calcularSlotsGenerico(registrosM2, dia),
      m3: calcularSlotsGenerico(registrosM3, dia),
    };
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      color: "#f8fafc",
      padding: "40px 20px",
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "900", color: "#38bdf8", margin: 0 }}>
              Relatório Comparativo de Atividades entre Mecânicas
            </h1>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0 0" }}>
              Período: {fmtBR(relatorioInfo.data_inicio)} – {fmtBR(relatorioInfo.data_fim)}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="no-print"
            style={{
              background: "#0284c7", color: "#fff", border: "none",
              padding: "8px 18px", borderRadius: "8px", cursor: "pointer",
              fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px"
            }}
          >
            🖨️ Imprimir / PDF
          </button>
        </div>

        {/* Podium de Ranking */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h3 style={{ color: "#f8fafc", fontSize: "18px", fontWeight: "800", marginBottom: "8px" }}>
            🏆 Ranking de Funcionamento Geral (Tempo Aberto)
          </h3>
          <p style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "24px" }}>
            Baseado no percentual de tempo de cobertura em que a oficina teve pelo menos 1 funcionário trabalhando no período completo.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", justifyContent: "center", alignItems: "flex-end", maxWidth: "850px", margin: "0 auto" }}>
            {rankingMecanicas[1] && (
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "16px", border: "1px solid rgba(192, 192, 192, 0.2)", padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", order: 2, minHeight: "220px", justifyContent: "center", position: "relative", flex: "1 1 220px", maxWidth: "240px" }}>
                <div style={{ position: "absolute", top: "-15px", fontSize: "32px" }}>🥈</div>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "rgba(192, 192, 192, 0.8)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>2º Lugar</span>
                <h4 style={{ color: rankingMecanicas[1].cor, fontSize: "17px", fontWeight: "800", marginBottom: "12px" }}>{rankingMecanicas[1].nome}</h4>
                <div style={{ fontSize: "28px", fontWeight: "900", color: "#f8fafc" }}>{rankingMecanicas[1].taxaCobertura.toFixed(1)}%</div>
                <span style={{ fontSize: "12px", color: "#f8fafc", fontWeight: "600", marginTop: "12px" }}>Funcionamento: {fmtMin(rankingMecanicas[1].minutosCobertos)}</span>
              </div>
            )}

            {rankingMecanicas[0] && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "20px", border: "1.5px solid rgba(250, 204, 21, 0.4)", padding: "32px 20px", display: "flex", flexDirection: "column", alignItems: "center", order: 1, minHeight: "260px", justifyContent: "center", position: "relative", transform: "scale(1.03)", flex: "1 1 250px", maxWidth: "280px" }}>
                <div style={{ position: "absolute", top: "-20px", fontSize: "40px" }}>🥇</div>
                <span style={{ fontSize: "12px", fontWeight: "900", color: "#facc15", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "8px" }}>🏆 Campeã</span>
                <h4 style={{ color: rankingMecanicas[0].cor, fontSize: "21px", fontWeight: "900", marginBottom: "12px" }}>{rankingMecanicas[0].nome}</h4>
                <div style={{ fontSize: "36px", fontWeight: "900", color: "#facc15" }}>{rankingMecanicas[0].taxaCobertura.toFixed(1)}%</div>
                <span style={{ fontSize: "13px", color: "#f8fafc", fontWeight: "700", marginTop: "16px" }}>Funcionamento: {fmtMin(rankingMecanicas[0].minutosCobertos)}</span>
              </div>
            )}

            {rankingMecanicas[2] && (
              <div style={{ background: "rgba(255,255,255,0.01)", borderRadius: "16px", border: "1px solid rgba(205, 127, 50, 0.2)", padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", order: 3, minHeight: "190px", justifyContent: "center", position: "relative", flex: "1 1 220px", maxWidth: "240px" }}>
                <div style={{ position: "absolute", top: "-15px", fontSize: "28px" }}>🥉</div>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "rgba(205, 127, 50, 0.8)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>3º Lugar</span>
                <h4 style={{ color: rankingMecanicas[2].cor, fontSize: "15px", fontWeight: "800", marginBottom: "12px" }}>{rankingMecanicas[2].nome}</h4>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#f8fafc" }}>{rankingMecanicas[2].taxaCobertura.toFixed(1)}%</div>
                <span style={{ fontSize: "11px", color: "#f8fafc", fontWeight: "600", marginTop: "8px" }}>Funcionamento: {fmtMin(rankingMecanicas[2].minutosCobertos)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabela de Desempenho */}
        <div style={{ background: "rgba(30, 41, 59, 0.7)", borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.05)", overflowX: "auto", marginBottom: "32px" }}>
          <h4 style={{ color: "#f8fafc", fontSize: "14px", fontWeight: "700", marginBottom: "16px" }}>📋 Tabela Comparativa de Desempenho</h4>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Mecânica</th>
                <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Cob. Geral</th>
                <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Tempo Aberto (Geral)</th>
                <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Cob. Obrigatória (19h-22h)</th>
                <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Falta Obrigatório</th>
                <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Total Horas Staff</th>
                <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Sessões</th>
                <th style={{ padding: "10px", color: "#94a3b8", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Funcionários</th>
              </tr>
            </thead>
            <tbody>
              {rankingMecanicas.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", height: "48px" }}>
                  <td style={{ padding: "10px", fontWeight: "800", color: m.cor }}>{m.nome}</td>
                  <td style={{ padding: "10px", fontWeight: "700", color: "#f8fafc" }}>{m.taxaCobertura.toFixed(1)}%</td>
                  <td style={{ padding: "10px", color: "#f8fafc" }}>{fmtMin(m.minutosCobertos)}</td>
                  <td style={{ padding: "10px", fontWeight: "700", color: "#f8fafc" }}>{m.taxaCoberturaObrigatoria.toFixed(1)}%</td>
                  <td style={{ padding: "10px", color: "#f87171", fontWeight: "700" }}>{fmtMin(m.minutosObrigatoriosNaoCumpridos)}</td>
                  <td style={{ padding: "10px", color: "#f8fafc" }}>{fmtMin(m.totalMin)}</td>
                  <td style={{ padding: "10px", color: "#f8fafc" }}>{m.sessoes}</td>
                  <td style={{ padding: "10px", color: "#f8fafc" }}>{m.funcionariosAtivos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Linha do Tempo Comparativa */}
        <div style={{ background: "rgba(30, 41, 59, 0.7)", borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.05)", overflowX: "auto" }}>
          <h4 style={{ color: "#f8fafc", fontSize: "14px", fontWeight: "700", marginBottom: "16px" }}>📅 Comparativo Linear de Cobertura (Linha do Tempo)</h4>
          <div style={{ minWidth: "920px" }}>
            
            {/* Headers */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
              <div style={{ width: "160px", flexShrink: 0 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                <div style={{ gridColumn: "span 12", background: "rgba(168,85,247,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#c084fc", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                  🌑 Madrugada
                </div>
                <div style={{ gridColumn: "span 12", background: "rgba(251,191,36,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#fcd34d", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                  🌅 Manhã
                </div>
                <div style={{ gridColumn: "span 12", background: "rgba(249,115,22,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#fdba74", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                  ☀️ Tarde
                </div>
                <div style={{ gridColumn: "span 12", background: "rgba(59,130,246,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderBottom: "none", padding: "4px 2px", textAlign: "center", fontSize: "10px", fontWeight: "800", color: "#60a5fa", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}>
                  🌙 Noite
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ width: "160px", fontWeight: "800", fontSize: "11px", color: "#94a3b8" }}>MECÂNICA / DIA</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} style={{ gridColumn: "span 2", textAlign: "left", fontSize: "10px", color: "#38bdf8", borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "2px" }}>
                    {String(h).padStart(2, "0")}h
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            {diasPeriodo.map(dia => {
              const dataObj = new Date(`${dia}T12:00:00`);
              const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "short" });
              const [, mes, diaNum] = dia.split("-");
              const labelDia = `${diaSemana.toUpperCase().replace(".", "")} (${diaNum}/${mes})`;

              const slotsM1 = coberturaComparativa[dia]?.m1 || [];
              const slotsM2 = coberturaComparativa[dia]?.m2 || [];
              const slotsM3 = coberturaComparativa[dia]?.m3 || [];

              const renderRowModal = (slots, colorActive, labelMecanica) => {
                return (
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                    <div style={{ width: "160px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ 
                        width: "8px", 
                        height: "8px", 
                        borderRadius: "50%", 
                        background: colorActive 
                      }} />
                      <span style={{ fontSize: "10px", color: "#f8fafc", fontWeight: "700" }}>{labelMecanica}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(48, 1fr)", flex: 1, gap: "3px" }}>
                      {slots.map((slot, idx) => {
                        const ehObrigatorio = idx >= 38 && idx <= 43;
                        const tooltipText = `${ehObrigatorio ? "⭐ [Horário Obrigatório 19h-22h] " : ""}${slot.label} (${labelMecanica})\n${slot.coberto ? `🟢 Coberto por:\n${slot.funcionarios.map(f => `• ${f.nome}`).join("\n")}` : `🔴 Sem cobertura${ehObrigatorio ? " (FALHA NO HORÁRIO OBRIGATÓRIO)" : ""}`}`;
                        
                        let emptyColor = "";
                        let emptyBorder = "";
                        if (idx < 12) {
                          emptyColor = "rgba(168,85,247,0.03)";
                          emptyBorder = "rgba(168,85,247,0.15)";
                        } else if (idx < 24) {
                          emptyColor = "rgba(251,191,36,0.03)";
                          emptyBorder = "rgba(251,191,36,0.15)";
                        } else if (idx < 36) {
                          emptyColor = "rgba(249,115,22,0.03)";
                          emptyBorder = "rgba(249,115,22,0.15)";
                        } else {
                          emptyColor = "rgba(59,130,246,0.03)";
                          emptyBorder = "rgba(59,130,246,0.15)";
                        }

                        return (
                          <div
                            key={idx}
                            title={tooltipText}
                            style={{
                              height: "16px",
                              borderRadius: "4px",
                              background: slot.coberto ? colorActive : emptyColor,
                              border: ehObrigatorio
                                ? `2px solid ${slot.coberto ? "#facc15" : "#f87171"}`
                                : `1px solid ${slot.coberto ? colorActive : emptyBorder}`,
                              boxShadow: ehObrigatorio && !slot.coberto ? "0 0 6px rgba(248,113,113,0.8)" : "none",
                              cursor: "pointer",
                              position: "relative",
                              transition: "transform 0.1s ease, box-shadow 0.1s ease"
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.transform = "scale(1.3)";
                              e.currentTarget.style.zIndex = 10;
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.zIndex = 1;
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              };

              return (
                <div key={dia} style={{ marginBottom: "16px", padding: "12px", background: "rgba(255,255,255,0.01)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: "12px", fontWeight: "800", color: "#f8fafc", marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" }}>
                    {labelDia}
                  </div>
                  {renderRowModal(slotsM1, "#ef4444", "RED's")}
                  {renderRowModal(slotsM2, "#eab308", "Harmony")}
                  {renderRowModal(slotsM3, "#38bdf8", "Dudark")}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          html, body {
            height: auto;
          }
        }
      `}} />
    </div>
  );
}
