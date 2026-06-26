"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const MEDALHAS = { 1: "🥇", 2: "🥈", 3: "🥉" };
const RODADA_LABELS = { 1: "Rodada 1", 2: "Rodada 2", 3: "Rodada 3", 4: "Grande Final" };

export default function TriathlonPublic() {
  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buscarParticipantes();
  }, []);

  const buscarParticipantes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("triathlon_participantes")
      .select("*")
      .order("rodada", { ascending: true })
      .order("posicao", { ascending: true, nullsFirst: false });
    if (data) setParticipantes(data);
    setLoading(false);
  };

  // Agrupar por rodada
  const rodadas = {};
  participantes.forEach(p => {
    if (!rodadas[p.rodada]) rodadas[p.rodada] = [];
    rodadas[p.rodada].push(p);
  });

  // Ordenar participantes em cada rodada: quem tem posição primeiro, depois os sem posição
  Object.keys(rodadas).forEach(r => {
    rodadas[r].sort((a, b) => {
      if (a.posicao && b.posicao) return a.posicao - b.posicao;
      if (a.posicao) return -1;
      if (b.posicao) return 1;
      return 0;
    });
  });

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#050d1a",
      backgroundImage: "radial-gradient(ellipse at top, #0c2d5a 0%, #050d1a 60%)",
      fontFamily: "'Inter', sans-serif",
      color: "#f0f4f8",
      paddingBottom: "60px"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{
        width: "100%",
        padding: "60px 20px 80px",
        textAlign: "center",
        position: "relative",
        marginBottom: "40px",
        borderBottom: "4px solid #0ea5e9",
        background: "linear-gradient(to bottom, rgba(5,13,26,0.3) 0%, rgba(5,13,26,1) 100%), linear-gradient(135deg, #0c2d5a 0%, #1e1b4b 50%, #0c2d5a 100%)"
      }}>
        {/* Decorative elements */}
        <div style={{
          position: "absolute", top: "20px", left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: "12px", opacity: 0.15, fontSize: "clamp(3rem, 8vw, 6rem)"
        }}>
          <span>🏊</span><span>🚴</span><span>🏃</span>
        </div>

        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "16px",
            marginBottom: "10px", fontSize: "clamp(1.5rem, 4vw, 2.5rem)"
          }}>
            <span style={{ filter: "drop-shadow(0 4px 8px rgba(14,165,233,0.5))" }}>🏊</span>
            <span style={{ filter: "drop-shadow(0 4px 8px rgba(249,115,22,0.5))" }}>🚴</span>
            <span style={{ filter: "drop-shadow(0 4px 8px rgba(34,197,94,0.5))" }}>🏃</span>
          </div>

          <h1 style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            fontWeight: "900",
            color: "#fff",
            margin: "0",
            textTransform: "uppercase",
            fontStyle: "italic",
            transform: "skew(-3deg)",
            textShadow: "3px 3px 0 #0ea5e9, 6px 6px 15px rgba(0,0,0,0.8)",
            lineHeight: "1",
            letterSpacing: "2px"
          }}>
            <span style={{ color: "#0ea5e9", textShadow: "3px 3px 0 #0369a1" }}>RED'S</span>{" "}
            <span style={{ color: "#f97316", textShadow: "3px 3px 0 #c2410c" }}>TRIATHLON</span>
          </h1>

          <div style={{
            display: "inline-block",
            background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
            padding: "10px 30px",
            transform: "skew(-15deg)",
            marginTop: "20px",
            boxShadow: "0 0 30px rgba(14, 165, 233, 0.4)"
          }}>
            <h2 style={{
              margin: 0,
              color: "#fff",
              fontSize: "clamp(0.9rem, 2vw, 1.4rem)",
              fontStyle: "italic",
              transform: "skew(15deg)",
              letterSpacing: "3px",
              fontWeight: "900"
            }}>SUPERE SEUS LIMITES</h2>
          </div>

          <div style={{
            display: "flex", justifyContent: "center", gap: "20px",
            marginTop: "50px", flexWrap: "wrap", zIndex: 10, position: "relative"
          }}>
            <div style={{
              background: "rgba(0,0,0,0.8)", border: "1px solid #1e3a5f",
              borderLeft: "4px solid #0ea5e9", padding: "15px 25px",
              borderRadius: "4px", display: "flex", alignItems: "center",
              gap: "15px", boxShadow: "0 10px 15px rgba(0,0,0,0.5)"
            }}>
              <span style={{ fontSize: "2rem" }}>📅</span>
              <div style={{ textAlign: "left" }}>
                <strong style={{ color: "#0ea5e9", fontSize: "24px", display: "block", lineHeight: "1" }}>23/05</strong>
                <span style={{ color: "#f97316", fontWeight: "bold", fontSize: "16px" }}>ÀS 20H30</span>
              </div>
            </div>

            <div style={{
              background: "rgba(0,0,0,0.8)", border: "1px solid #1e3a5f",
              borderLeft: "4px solid #f97316", padding: "15px 25px",
              borderRadius: "4px", display: "flex", alignItems: "center",
              gap: "15px", boxShadow: "0 10px 15px rgba(0,0,0,0.5)"
            }}>
              <span style={{ fontSize: "2rem" }}>🏅</span>
              <div style={{ textAlign: "left" }}>
                <strong style={{ color: "#fff", fontSize: "16px", display: "block" }}>3 RODADAS</strong>
                <span style={{ color: "#94a3b8", fontSize: "13px" }}>TOP 3 → FINAL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>

        {/* COMO FUNCIONA */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "50px"
        }}>
          {[
            { icon: "1️⃣", title: "Rodadas 1-3", desc: "10 participantes por rodada competem entre si", color: "#0ea5e9" },
            { icon: "🏆", title: "Top 3 Classifica", desc: "Os 3 primeiros de cada rodada avançam", color: "#f97316" },
            { icon: "⭐", title: "Grande Final", desc: "9 classificados disputam o título final", color: "#22c55e" },
          ].map((item, i) => (
            <div key={i} style={{
              background: "rgba(14, 165, 233, 0.06)",
              border: "1px solid rgba(14, 165, 233, 0.15)",
              borderTop: `3px solid ${item.color}`,
              borderRadius: "8px",
              padding: "20px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>{item.icon}</div>
              <strong style={{ color: item.color, fontSize: "14px", letterSpacing: "1px" }}>{item.title}</strong>
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: "8px 0 0", lineHeight: "1.4" }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#94a3b8", marginTop: "50px" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px", animation: "pulse 2s infinite" }}>🏊</div>
            Carregando participantes...
          </div>
        ) : Object.keys(rodadas).length === 0 ? (
          <div style={{
            textAlign: "center", color: "#94a3b8", marginTop: "50px",
            background: "rgba(14,165,233,0.05)", padding: "40px", borderRadius: "12px",
            border: "1px dashed rgba(14,165,233,0.2)"
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏊‍♂️</div>
            <p style={{ margin: 0, fontSize: "16px" }}>Nenhum participante registrado no momento.</p>
            <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#64748b" }}>As inscrições serão exibidas aqui assim que abertas.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            {[1, 2, 3, 4].filter(r => rodadas[r]).map(rodadaNum => {
              const isFinal = rodadaNum === 4;
              const isRodadaFechada = rodadas[rodadaNum].some(p => p.rodada_fechada);
              const accentColor = isFinal ? "#f59e0b" : rodadaNum === 1 ? "#0ea5e9" : rodadaNum === 2 ? "#8b5cf6" : "#22c55e";

              return (
                <div key={rodadaNum} style={{
                  background: isFinal
                    ? "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(249,115,22,0.04))"
                    : "rgba(14, 36, 64, 0.4)",
                  padding: "24px",
                  borderRadius: "8px",
                  border: `1px solid ${isFinal ? "rgba(245,158,11,0.3)" : "rgba(14,165,233,0.15)"}`,
                  position: "relative",
                  ...(isFinal ? { boxShadow: "0 0 40px rgba(245,158,11,0.1)" } : {})
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: "20px"
                  }}>
                    <h3 style={{
                      margin: "0",
                      display: "flex", alignItems: "center", gap: "10px",
                      color: "#fff", fontSize: "18px"
                    }}>
                      <span style={{ fontSize: "24px" }}>{isFinal ? "🏆" : "🏁"}</span>
                      <span style={{ color: accentColor, fontWeight: "900" }}>
                        {RODADA_LABELS[rodadaNum]}
                      </span>
                      <span style={{ color: "#64748b", fontSize: "14px", fontWeight: "400" }}>
                        ({rodadas[rodadaNum].length} participante{rodadas[rodadaNum].length !== 1 ? "s" : ""})
                      </span>
                    </h3>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {isRodadaFechada && (
                        <span style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "#ef4444",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          padding: "4px 10px", borderRadius: "8px",
                          fontSize: "12px", fontWeight: "700"
                        }}>
                          🔒 Encerrada
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "12px"
                  }}>
                    {rodadas[rodadaNum].map((p, idx) => {
                      const isClassificado = p.classificado;
                      const posicaoNum = p.posicao;
                      const medalha = MEDALHAS[posicaoNum];
                      const isTop3 = posicaoNum && posicaoNum <= 3;

                      const cardBorder = isTop3
                        ? posicaoNum === 1 ? "#fbbf24" : posicaoNum === 2 ? "#94a3b8" : "#cd7f32"
                        : isClassificado ? "#22c55e" : "rgba(14,165,233,0.15)";

                      return (
                        <div key={p.id} style={{
                          display: "flex", alignItems: "center", gap: "14px",
                          background: isTop3
                            ? `linear-gradient(135deg, ${cardBorder}08, ${cardBorder}04)`
                            : "rgba(0,0,0,0.3)",
                          border: `1px solid ${cardBorder}`,
                          borderLeft: `4px solid ${cardBorder}`,
                          borderRadius: "8px",
                          padding: "14px 18px",
                          transition: "transform 0.2s, box-shadow 0.2s",
                          ...(isTop3 ? { boxShadow: `0 0 15px ${cardBorder}15` } : {})
                        }}>
                          {/* Posição / Número */}
                          <div style={{
                            width: "40px", height: "40px",
                            borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: isTop3
                              ? `linear-gradient(135deg, ${cardBorder}, ${cardBorder}aa)`
                              : "rgba(14,165,233,0.1)",
                            border: `2px solid ${isTop3 ? cardBorder : "rgba(14,165,233,0.2)"}`,
                            fontSize: medalha ? "20px" : "14px",
                            fontWeight: "900",
                            color: isTop3 ? (posicaoNum === 1 ? "#000" : "#fff") : "#64748b",
                            flexShrink: 0
                          }}>
                            {medalha || (posicaoNum || "—")}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              display: "flex", alignItems: "center", gap: "8px",
                              flexWrap: "wrap"
                            }}>
                              <strong style={{
                                fontSize: "15px", color: "#fff",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                              }}>
                                {p.nome}
                              </strong>
                              {isClassificado && !isFinal && (
                                <span style={{
                                  background: "rgba(34,197,94,0.15)",
                                  color: "#22c55e",
                                  fontSize: "10px", fontWeight: "800",
                                  padding: "2px 8px", borderRadius: "4px",
                                  letterSpacing: "0.5px",
                                  border: "1px solid rgba(34,197,94,0.3)"
                                }}>
                                  ✅ CLASSIFICADO
                                </span>
                              )}
                            </div>
                            <div style={{
                              fontSize: "12px", color: "#64748b",
                              marginTop: "2px"
                            }}>
                              ID: <strong style={{ color: "#94a3b8" }}>{p.passaporte}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
