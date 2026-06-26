export default function HeaderBar({
  paginaAtual,
  setPaginaAtual,
  theme,
  styles,
  pontoAtivo,
  isDarkMode,
  setIsDarkMode,
  tempoSegundos,
  formatarCronometro,
  registrarPonto,
  usuarioLogado,
  setUsuarioLogado,
  getLabelCargo,
  userPodeNotificar,
  userPodeFinancas,
  userIsAdmin,
  userRole
}) {
  const primaryNav = [
    { id: "dashboard", label: "🏠 Dashboard", cor: "#b40d0d" },
    { id: "ponto", label: "⏱️ Ponto", cor: theme.green },
    { id: "hierarquia", label: "🏛️ Hierarquia", cor: "#38bdf8" },
    { id: "minha-conta", label: "👤 Minha Conta", cor: "#a78bfa" },
    { id: "evento-derby", label: "🏁 Derby", cor: "#b40d0d" },
    { id: "evento-triathlon", label: "🏊 Triathlon", cor: "#0ea5e9" },
    { id: "candidaturas", label: "📢 Candidaturas", cor: "#3b82f6" },
    { id: "missoes", label: "🎯 Missões", cor: "#f97316" },
    ...(userPodeNotificar ? [{ id: "notificacoes", label: "🔔 Notificações", cor: "#f97316" }] : []),
    { id: "pagamentos", label: "💸 Pagamentos", cor: "#38f862" },
  ];

  const userPodeNitro = userRole && (userRole.includes("admin") || userRole.includes("dono") || userRole.includes("gerente_geral") || userRole.includes("financeiro"));

  const secondaryNav = [
    ...(userPodeFinancas ? [{ id: "financas", label: "💰 Finanças", cor: "#22c55e" }] : []),
    ...(userIsAdmin
      ? [
        { id: "clientes",    label: "👥 Clientes",    cor: "#facc15" },
        { id: "bot",         label: "🤖 Bot",         cor: "#ff0000" },
      ]
      : []),
    ...(userIsAdmin || (userRole && (
        userRole.includes("gerente_geral") ||
        userRole.includes("gerente") ||
        userRole.includes("gerente_rh") ||
        userRole.includes("resp_rh")
      ))
      ? [
        { id: "admin",       label: "⚙️ Admin",        cor: "#ff0000" },
      ]
      : []),
    ...(userIsAdmin || (userRole && (userRole.includes("gerente_geral") || userRole.includes("resp_ponto")))
      ? [{ id: "ponto-admin", label: "📋 Ponto Admin",  cor: "#f97316" }]
      : []),
    ...(userIsAdmin
      ? [
        { id: "relatorio",   label: "📊 Relatório",   cor: "#a78bfa" },
        { id: "outras-mecanicas", label: "⚙️ Outras Mecânicas", cor: "#14b8a6" },
      ]
      : []),
    ...(userRole && (userRole.includes("gerente") || userRole.includes("dono") || userRole.includes("admin"))
      ? [{ id: "blacklist", label: "🚫 Blacklist", cor: "#b40d0d" }]
      : []),
    ...(userPodeNitro
      ? [{ id: "nitro-admin", label: "📈 Controle Vendas", cor: "#14b8a6" }]
      : []),
    { id: "recrutamento", label: "📝 Recrutamento", cor: "#f97316" },
  ];

  const currentTitle =
    paginaAtual === "dashboard"
      ? "🏠Dashboard"
      : paginaAtual === "ponto"
        ? "⏱️Ponto"
        : paginaAtual === "hierarquia"
          ? "🏛️Hierarquia"
          : paginaAtual === "evento-derby"
            ? "🏁Derby"
            : paginaAtual === "evento-triathlon"
              ? "🏊Triathlon"
              : paginaAtual === "minha-conta"
                ? "👤Minha Conta"
                : paginaAtual === "notificacoes"
                  ? "🔔Notificações"
                  : paginaAtual === "pagamentos"
                    ? "💸Pagamentos"
                    : paginaAtual === "financas"
                      ? "💰Finanças"
                      : paginaAtual === "clientes"
                        ? "👥Clientes"
                        : paginaAtual === "admin"
                          ? "⚙️Admin"
                          : paginaAtual === "bot"
                            ? "🤖Bot"
                            : paginaAtual === "blacklist"
                              ? "🚫Blacklist"
                              : paginaAtual === "ponto-admin"
                                ? "📋Ponto Admin"
                                : paginaAtual === "relatorio"
                                  ? "📊Relatório"
                                  : paginaAtual === "outras-mecanicas"
                                    ? "🛠️Outras Mecânicas"
                                  : paginaAtual === "nitro-admin"
                                    ? "📈Controle Vendas"
                                    : paginaAtual === "candidaturas"
                                      ? "📢Candidaturas"
                                      : paginaAtual === "missoes"
                                        ? "🎯Missões"
                                        : paginaAtual === "recrutamento"
                                          ? "📝Recrutamento"
                                          : "Painel";

  // Botão de navegação interno reutilizado
  const NavBtn = ({ id, label, cor }) => (
    <button style={styles.navBtn(paginaAtual === id, cor)} onClick={() => setPaginaAtual(id)}>
      {label}
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        input[type="checkbox"] { appearance: none; -webkit-appearance: none; width: 17px; height: 17px; border: 2px solid #444; border-radius: 4px; background-color: transparent; display: inline-grid; place-content: center; cursor: pointer; vertical-align: middle; transition: 0.15s; flex-shrink: 0; }
        input[type="checkbox"]:checked { background-color: #125a00 !important; border-color: #125a00 !important; }
        input[type="checkbox"]::before { content: ""; width: 9px; height: 9px; transform: scale(0); transition: 100ms transform ease-in-out; box-shadow: inset 1em 1em white; clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%); }
        input[type="checkbox"]:checked::before { transform: scale(1); }
        input[type="checkbox"]:hover { border-color: #d0ff00; }
        input:focus, textarea:focus, select:focus { border-color: #d32f2f !important; box-shadow: 0 0 0 3px rgba(211,47,47,0.12); }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }
        select option { background: #1a1a1a; color: #f0f0f0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      `}</style>
      <header
        style={{
          ...styles.topBar,
          padding: "10px 18px",
          minHeight: "unset",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                minWidth: "max-content",
              }}
            >
              <span
                style={{
                  ...styles.logo,
                  lineHeight: 1,
                  fontSize: "16px",
                  color: "#ef4444",
                  whiteSpace: "nowrap",
                }}
              >
                RED'S TUNERSHOP
              </span>
              <span style={{ color: theme.border, fontWeight: "700" }}>|</span>
              <span
                style={{
                  fontSize: "14px",
                  color: theme.subtext,
                  fontWeight: "700",
                  letterSpacing: "0.3px",
                  whiteSpace: "nowrap"
                }}
              >
                {currentTitle}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "3px", flexWrap: "wrap" }}>
              {[...primaryNav, ...secondaryNav].map((item) => (
                <NavBtn key={item.id} id={item.id} label={item.label} cor={item.cor} />
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "12px",
                border: `1px solid ${pontoAtivo ? "rgba(34,197,94,0.45)" : "rgba(250,204,21,0.30)"}`,
                background: pontoAtivo
                  ? isDarkMode
                    ? "rgba(22,163,74,0.15)"
                    : "rgba(22,163,74,0.08)"
                  : isDarkMode
                    ? "rgba(250,204,21,0.08)"
                    : "rgba(250,204,21,0.10)",
                boxShadow: pontoAtivo ? "0 8px 22px rgba(34,197,94,0.16)" : "none",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "800",
                  color: pontoAtivo ? "#22c55e" : "#facc15",
                  whiteSpace: "nowrap",
                }}
              >
                {pontoAtivo ? `⏱ ${formatarCronometro(tempoSegundos)}` : "⚠ Abrir ponto"}
              </span>
              <button
                onClick={registrarPonto}
                style={{
                  background: pontoAtivo
                    ? "linear-gradient(135deg, #ef4444, #f87171)"
                    : "linear-gradient(135deg, #facc15, #f59e0b)",
                  color: pontoAtivo ? "#fff" : "#111827",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  fontWeight: "800",
                  cursor: "pointer",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  boxShadow: pontoAtivo
                    ? "0 10px 20px rgba(239,68,68,0.24)"
                    : "0 10px 20px rgba(245,158,11,0.18)",
                }}
              >
                {pontoAtivo ? "Finalizar" : "Abrir"}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 10px",
                borderRadius: "12px",
                border: `1px solid ${theme.border}`,
                background: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.72)",
              }}
            >
              <div style={{ textAlign: "right", lineHeight: 1.2 }}>
                <div
                  style={{
                    color: theme.text,
                    fontWeight: "800",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  👤 {usuarioLogado?.nome}
                </div>
                <div
                  style={{
                    color: "#f59e0b",
                    fontWeight: "800",
                    fontSize: "10px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getLabelCargo(userRole)}
                </div>
              </div>

              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                style={{
                  background:
                    "linear-gradient(135deg, rgba(250,204,21,0.22), rgba(245,158,11,0.18))",
                  border: `1px solid ${theme.border}`,
                  padding: "8px 12px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  color: theme.text,
                  fontWeight: "800",
                  whiteSpace: "nowrap",
                  fontSize: "12px",
                }}
              >
                {isDarkMode ? "☀️ Claro" : "🌙 Escuro"}
              </button>

              <button
                onClick={() => { setUsuarioLogado(null); setPaginaAtual("login"); }}
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: `1px solid rgba(239, 68, 68, 0.4)`,
                  padding: "8px 12px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  color: "#ef4444",
                  fontWeight: "800",
                  whiteSpace: "nowrap",
                  fontSize: "12px",
                  marginLeft: "4px"
                }}
              >
                🚪 Sair
              </button>
            </div>
          </div>
        </div>
      </header >
    </>
  );
}
