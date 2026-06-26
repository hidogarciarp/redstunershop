"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const MAPA_CORES_HEX = {
  amarelo: "#fbbf24", verde: "#22c55e", laranja: "#f97316", azul: "#3b82f6",
  rosa: "#ec4899", vermelho: "#ef4444", roxo: "#a855f7", cinza: "#94a3b8",
  areia: "#d6d3d1", branco: "#ffffff", preto: "#525252"
};

export default function DerbyPublic() {
  const [equipesEvento, setEquipesEvento] = useState([]);
  const [loading, setLoading] = useState(true);

  const theme = {
    bg: "#0f172a",
    card: "#1e293b",
    card2: "#18212f",
    border: "#334155",
    text: "#f8fafc",
    subtext: "#94a3b8",
    accent: "#ef4444"
  };

  useEffect(() => {
    buscarEquipesEvento();
  }, []);

  const buscarEquipesEvento = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("evento_equipes")
      .select("*, evento_membros(*)");
    if (data) setEquipesEvento(data);
    setLoading(false);
  };

  const grupos = {};
  equipesEvento.forEach(eq => {
    if (!grupos[eq.grupo]) grupos[eq.grupo] = [];
    grupos[eq.grupo].push(eq);
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0b0b0b", backgroundImage: "radial-gradient(circle at top, #2b1111 0%, #0b0b0b 70%)", fontFamily: "'Inter', sans-serif", color: theme.text, paddingBottom: "60px" }}>
      
      {/* HEADER DERBY STYLIZED (FLYER VIBE / IMAGES) */}
      <div style={{ width: "100%", padding: "60px 20px 80px", textAlign: "center", position: "relative", marginBottom: "40px", borderBottom: "4px solid #ef4444", backgroundImage: "linear-gradient(to bottom, rgba(11,11,11,0.5) 0%, rgba(11,11,11,1) 100%), url('/bg-derby.png')", backgroundSize: "cover", backgroundPosition: "center top", backgroundRepeat: "no-repeat" }}>
        
        <img src="/logo-derby.png" alt="Red's Tunershop" style={{ width: "100%", maxWidth: "380px", objectFit: "contain", marginBottom: "15px", filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.8))" }} />
        
        <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: "900", color: "#fff", margin: "0", textTransform: "uppercase", fontStyle: "italic", transform: "skew(-5deg)", textShadow: "4px 4px 0 #ef4444, 8px 8px 15px rgba(0,0,0,0.8)", lineHeight: "1" }}>
          <span style={{ color: "#facc15", textShadow: "4px 4px 0 #b45309" }}>DEMOLITION</span> DERBY
        </h1>
        
        <div style={{ display: "inline-block", background: "#ef4444", padding: "10px 30px", transform: "skew(-15deg)", marginTop: "20px", boxShadow: "0 0 20px rgba(239, 68, 68, 0.4)" }}>
           <h2 style={{ margin: 0, color: "#fff", fontSize: "clamp(1rem, 2vw, 1.5rem)", fontStyle: "italic", transform: "skew(15deg)", letterSpacing: "2px", fontWeight: "900" }}>SOBREVIVA AO CAOS</h2>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "50px", flexWrap: "wrap", zIndex: 10, position: "relative" }}>
           <div style={{ background: "rgba(0,0,0,0.8)", border: "1px solid #333", borderLeft: "4px solid #facc15", padding: "15px 25px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "15px", boxShadow: "0 10px 15px rgba(0,0,0,0.5)" }}>
             <span style={{ fontSize: "2rem" }}>📅</span>
             <div style={{ textAlign: "left" }}>
               <strong style={{ color: "#ef4444", fontSize: "24px", display: "block", lineHeight: "1" }}>19/04</strong>
               <span style={{ color: "#facc15", fontWeight: "bold", fontSize: "16px" }}>ÀS 17H</span>
             </div>
           </div>
           
           <div style={{ background: "rgba(0,0,0,0.8)", border: "1px solid #333", borderLeft: "4px solid #ef4444", padding: "15px 25px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 10px 15px rgba(0,0,0,0.5)" }}>
             <span style={{ fontSize: "2rem", color: "#ef4444" }}>📍</span>
             <strong style={{ color: "#fff", fontSize: "22px", letterSpacing: "1px" }}>MINERADORA</strong>
           </div>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>

        {loading ? (
          <div style={{ textAlign: "center", color: theme.subtext, marginTop: "50px" }}>Carregando equipes...</div>
        ) : Object.keys(grupos).length === 0 ? (
          <div style={{ textAlign: "center", color: theme.subtext, marginTop: "50px" }}>Nenhuma equipe registrada no momento.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            {Object.keys(grupos).sort((a, b) => a - b).map(grupo => {
              const isThisGroupFechado = grupos[grupo].some(eq => eq.grupo_fechado);
              
              return (
                <div key={grupo} style={{ background: "rgba(30, 41, 59, 0.4)", padding: "24px", borderRadius: "4px", border: `1px solid ${theme.border}`, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h3 style={{ margin: "0", display: "flex", alignItems: "center", gap: "10px", color: theme.text }}>
                      <span style={{ fontSize: "24px" }}>🏁</span> Grupo {grupo}
                    </h3>
                    {isThisGroupFechado && (
                      <span style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "700" }}>
                        🔒 Grupo Fechado
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                    {grupos[grupo].map(eq => {
                      const isCampeao = eq.posicao === "campeao";
                      const isVice = eq.posicao === "vice";
                      const borderColor = isCampeao ? "#fbbf24" : isVice ? "#94a3b8" : theme.border;
                      const corHex = MAPA_CORES_HEX[eq.cor?.toLowerCase()] || theme.border;

                      return (
                        <div key={eq.id} style={{ borderLeft: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`, borderTop: `6px solid ${corHex}`, borderRadius: "4px", padding: "20px", background: "rgba(0,0,0,0.5)", position: "relative", boxShadow: isCampeao ? "0 0 25px rgba(251, 191, 36, 0.3)" : isVice ? "0 0 20px rgba(148, 163, 184, 0.2)" : "none", transition: "transform 0.2s" }}>
                          
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                            <div>
                              <strong style={{ fontSize: "18px", display: "block", color: theme.text }}>{eq.nome_equipe}</strong>
                              <span style={{ display: "inline-block", color: theme.text, padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600", marginTop: "8px", textTransform: "capitalize", border: `2px solid ${corHex}`, background: `${corHex}15` }}>
                                {eq.cor}
                              </span>
                            </div>
                            {(isCampeao || isVice) && (
                              <span style={{ fontSize: "32px", animation: isCampeao ? "bounce 2s infinite" : "none" }} title={isCampeao ? "Campeã" : "Vice-Campeã"}>
                                {isCampeao ? "🏆" : "🥈"}
                              </span>
                            )}
                          </div>

                          <div style={{ background: theme.bg, borderRadius: "8px", padding: "12px" }}>
                            <div style={{ fontSize: "11px", letterSpacing: "1px", color: theme.subtext, marginBottom: "10px", fontWeight: "700" }}>ELENCO ({eq.evento_membros?.length || 0})</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {eq.evento_membros?.map(m => (
                                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", color: theme.text }}>
                                  <span><strong>{m.passaporte}</strong> - {m.eh_lider && "⭐ "} {m.nome}</span>
                                </div>
                              ))}
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
    </div>
  );
}
