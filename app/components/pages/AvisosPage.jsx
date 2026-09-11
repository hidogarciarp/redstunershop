import React from "react";

export default function AvisosPage({
  styles,
  theme,
  userPodeEditarAvisos,
  listaAvisos = [],
  avisoSendoEditado,
  setAvisoSendoEditado,
  confirmarEdicaoQuadro,
  apagarQuadro,
  adicionarNovoQuadro,
  formatarTextoAvisos,
  setPaginaAtual
}) {
  return (
    <div style={styles.dashContainer}>
      <div style={{ padding: "30px 40px", maxWidth: "900px", margin: "0 auto" }}>
        
        {/* Title & Back Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <button
              onClick={() => setPaginaAtual("dashboard")}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ffffff",
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "600",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.1)"}
              onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.05)"}
            >
              ← Voltar
            </button>
            <h2 style={{ color: "#ffffff", margin: 0, fontWeight: "800", fontSize: "22px", fontFamily: "'Outfit', sans-serif" }}>
              📢 Quadro de Avisos
            </h2>
          </div>

          {userPodeEditarAvisos && (
            <button
              onClick={adicionarNovoQuadro}
              style={{
                background: "linear-gradient(135deg, #8b181e 0%, #5b0f13 100%)",
                border: "none",
                color: "#ffffff",
                padding: "10px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "700",
                boxShadow: "0 4px 12px rgba(139,24,30,0.3)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-1px)";
                e.target.style.boxShadow = "0 6px 16px rgba(139,24,30,0.5)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "none";
                e.target.style.boxShadow = "0 4px 12px rgba(139,24,30,0.3)";
              }}
            >
              ➕ Adicionar Novo Quadro
            </button>
          )}
        </div>

        {/* Notices list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {listaAvisos.length === 0 ? (
            <div style={{ ...styles.whiteCard, textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.4)" }}>
              Nenhum aviso no momento.
            </div>
          ) : (
            listaAvisos.map((aviso) => {
              const isEditando = avisoSendoEditado?.id === aviso.id;
              return (
                <div key={aviso.id} style={styles.whiteCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    
                    {isEditando ? (
                      <input
                        value={avisoSendoEditado.titulo}
                        onChange={(e) => setAvisoSendoEditado({ ...avisoSendoEditado, titulo: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "#0a0a0a",
                          color: "#facc15",
                          border: "1px solid rgba(255,255,255,0.1)",
                          fontSize: "14px",
                          fontWeight: "bold",
                          marginBottom: "10px",
                          outline: "none"
                        }}
                        placeholder="Título do Aviso"
                      />
                    ) : (
                      <div style={{ fontSize: "16px", fontWeight: "800", color: "#facc15", display: "flex", alignItems: "center", gap: "10px", fontFamily: "'Outfit', sans-serif" }}>
                        <span style={{ width: "6px", height: "6px", background: "#facc15", borderRadius: "50%" }}></span>
                        {aviso.titulo}
                      </div>
                    )}

                    {userPodeEditarAvisos && !isEditando && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#ffffff", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
                          onClick={() => setAvisoSendoEditado({ ...aviso })}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
                          onClick={() => apagarQuadro(aviso.id)}
                        >
                          🗑️ Apagar
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditando ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <textarea
                        value={avisoSendoEditado.texto}
                        onChange={(e) => setAvisoSendoEditado({ ...avisoSendoEditado, texto: e.target.value })}
                        style={{
                          width: "100%",
                          height: "180px",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          background: "#0a0a0a",
                          color: "#ffffff",
                          border: "1px solid rgba(255,255,255,0.1)",
                          fontSize: "13px",
                          resize: "vertical",
                          outline: "none"
                        }}
                        placeholder="Texto do aviso..."
                      />
                      <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                        <button
                          onClick={confirmarEdicaoQuadro}
                          style={{
                            background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                            color: "#ffffff",
                            border: "none",
                            padding: "8px 20px",
                            borderRadius: "6px",
                            fontWeight: "700",
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          💾 Salvar
                        </button>
                        <button
                          onClick={() => setAvisoSendoEditado(null)}
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#ffffff",
                            padding: "8px 20px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "rgba(255, 255, 255, 0.75)",
                      lineHeight: "1.6",
                      whiteSpace: "pre-line"
                    }}>
                      {formatarTextoAvisos(aviso.texto)}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
