import React from "react";

export default function HierarquiaPage({
  styles,
  theme,
  hierarquiaFuncionarios,
  CARGOS_HIERARQUIA,
  getPrimaryRole,
  buscarHierarquia,
  getAtribuicoes,
  userIsAdmin,
  toggleOcultoHierarquia,
  getLabelCargo,
  AppHeaderBar,
  AppModalNotificacao,
}) {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  // Agrupar por nível
  const visiveis = hierarquiaFuncionarios.filter((f) => !f.oculto_hierarquia);
  const ocultosAdmin = hierarquiaFuncionarios.filter((f) => f.oculto_hierarquia);

  const grupos = CARGOS_HIERARQUIA.slice()
    .reverse()
    .map((cargo) => ({
      cargo,
      membros: visiveis.filter((f) => getPrimaryRole(f.role) === cargo.value),
    }))
    .filter((g) => g.membros.length > 0);

  return (
    <div style={styles.dashContainer}>
      <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <AppModalNotificacao />
      <AppHeaderBar />
      <div style={{ padding: "30px 40px", maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ color: theme.text, margin: 0, fontWeight: "800" }}>🏛️ Hierarquia de Funcionários</h2>
          <button
            onClick={buscarHierarquia}
            style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "9px 18px", fontSize: "12px" }}
          >
            🔄 Atualizar
          </button>
        </div>

        {grupos.map(({ cargo, membros }) => (
          <div
            key={cargo.value}
            style={{
              ...styles.whiteCard,
              marginBottom: "20px",
              borderLeft: `4px solid ${cargo.nivel >= 7 ? "#facc15" : cargo.nivel >= 5 ? "#f97316" : cargo.nivel >= 3 ? "#38bdf8" : theme.accent}`,
            }}
          >
            <div
              style={{
                ...styles.cardHeader,
                color: cargo.nivel >= 7 ? "#facc15" : cargo.nivel >= 5 ? "#f97316" : cargo.nivel >= 3 ? "#38bdf8" : theme.text,
              }}
            >
              <span
                style={{
                  ...styles.dot,
                  background:
                    cargo.nivel >= 7 ? "#facc15" : cargo.nivel >= 5 ? "#f97316" : cargo.nivel >= 3 ? "#38bdf8" : theme.accent,
                }}
              ></span>
              {cargo.label}
              <span
                style={{
                  marginLeft: "8px",
                  background: theme.card2,
                  border: `1px solid ${theme.border}`,
                  borderRadius: "20px",
                  padding: "2px 10px",
                  fontSize: "11px",
                  color: theme.subtext,
                  fontWeight: "600",
                }}
              >
                Nível {cargo.nivel} · {membros.length} {membros.length === 1 ? "membro" : "membros"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
              {membros.map((func) => {
                const atribuicoes = getAtribuicoes(func.role);
                return (
                  <div
                    key={func.id}
                    style={{
                      background: theme.card2,
                      border: `1px solid ${theme.border}`,
                      borderRadius: "12px",
                      padding: "14px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "14px", color: theme.text }}>{func.nome}</div>
                      <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>ID: {func.id}</div>
                      {atribuicoes.length > 0 && (
                        <div style={{ fontSize: "11px", color: "#f97316", marginTop: "2px", fontWeight: "600" }}>
                          {atribuicoes
                            .map((a) =>
                              a === "resp_ponto"
                                ? "📌 Resp. Ponto"
                                : a === "resp_tunagem"
                                ? "🔧 Resp. Tunagem"
                                : a === "resp_financas"
                                ? "💰 Resp. Finanças"
                                : a
                            )
                            .join(" · ")}
                        </div>
                      )}
                      {func.telefone && (
                        <div style={{ fontSize: "12px", color: "#38bdf8", marginTop: "4px", fontWeight: "600" }}>
                          📞 {func.telefone}
                        </div>
                      )}
                      {!func.telefone && (
                        <div style={{ fontSize: "11px", color: theme.border, marginTop: "4px" }}>📞 Sem telefone</div>
                      )}
                    </div>
                    {userIsAdmin && (
                      <button
                        onClick={() => toggleOcultoHierarquia(func.id, false)}
                        title="Ocultar da hierarquia"
                        style={{
                          background: "#7f1d1d20",
                          border: "1px solid #7f1d1d",
                          color: "#ef4444",
                          padding: "5px 10px",
                          borderRadius: "7px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: "700",
                          whiteSpace: "nowrap",
                          marginLeft: "8px",
                        }}
                      >
                        👁️ Ocultar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Usuários ocultos — visível apenas para admin/dono */}
        {userIsAdmin && ocultosAdmin.length > 0 && (
          <div style={{ ...styles.whiteCard, borderLeft: `4px solid #374151`, marginBottom: "20px", opacity: 0.7 }}>
            <div style={{ ...styles.cardHeader, color: "#6b7280" }}>
              <span style={{ ...styles.dot, background: "#374151" }}></span>
              👻 Ocultos da Hierarquia
              <span
                style={{
                  fontSize: "11px",
                  color: theme.subtext,
                  marginLeft: "8px",
                  background: theme.card2,
                  border: `1px solid ${theme.border}`,
                  borderRadius: "20px",
                  padding: "2px 10px",
                }}
              >
                Visível apenas para Admin/Dono
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
              {ocultosAdmin.map((func) => (
                <div
                  key={func.id}
                  style={{
                    background: theme.card2,
                    border: `1px solid #374151`,
                    borderRadius: "12px",
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px", color: "#6b7280" }}>👻 {func.nome}</div>
                    <div style={{ fontSize: "11px", color: "#4b5563" }}>
                      ID: {func.id} · {getLabelCargo(func.role)}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleOcultoHierarquia(func.id, true)}
                    style={{
                      background: "#14532d20",
                      border: "1px solid #14532d",
                      color: "#22c55e",
                      padding: "5px 10px",
                      borderRadius: "7px",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: "700",
                      marginLeft: "8px",
                    }}
                  >
                    👁️ Exibir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {hierarquiaFuncionarios.length === 0 && (
          <div style={{ ...styles.whiteCard, textAlign: "center", padding: "50px" }}>
            <p style={{ color: theme.subtext }}>Carregando hierarquia...</p>
          </div>
        )}
      </div>
    </div>
  );
}
