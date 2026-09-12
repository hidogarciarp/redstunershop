import React from "react";

export default function NotificacoesPage({
  usuarioLogado = null,
  styles = {},
  theme = {},
  formatarDataHora = (valor) => valor || "—",
  userPodeNotificar,
  setPaginaAtual,
  getNivel = () => 0,
  userRole = "",
  CARGOS_HIERARQUIA = [],
  userIsAdmin,
  historicoNotificacoes = [],
  usuariosRoleMapa = {},
  userPodeVerRemetente,
  notifModoMassa,
  setNotifModoMassa,
  notifIdFuncionario,
  setNotifIdFuncionario,
  setNotifFuncionarioInfo,
  buscarFuncionarioParaNotif,
  notifBuscando,
  notifFuncionarioInfo,
  getLabelCargo,
  notifMensagem,
  setNotifMensagem,
  notifAnonimo,
  setNotifAnonimo,
  enviarNotificacao,
  notifMassaTodos,
  setNotifMassaTodos,
  setNotifMassaNiveis,
  notifMassaNiveis = [],
  notifMassaMensagem,
  setNotifMassaMensagem,
  notifMassaAnonimo,
  setNotifMassaAnonimo,
  enviarNotificacaoMassa,
  notifMassaEnviando,
  buscarHistoricoNotificacoes,
  buscarUsuariosComRole,
  apagarNotificacao,
  AppHeaderBar,
  AppModalNotificacao,
}) {
  if (!usuarioLogado || !userPodeNotificar)
    return (
      <div style={styles.dashContainer}>
        <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <AppModalNotificacao />
        <AppHeaderBar />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <div style={styles.whiteCard}>
            <h2>🚫 Acesso Negado</h2>
            <button style={styles.btnPrimary} onClick={() => setPaginaAtual("dashboard")}>
              Voltar
            </button>
          </div>
        </div>
      </div>
    );

  const meuNivel = getNivel(userRole);
  const cargosDisponiveis = Array.isArray(CARGOS_HIERARQUIA) ? CARGOS_HIERARQUIA : [];
  const cargosQuePosoNotificar = cargosDisponiveis.filter((c) => userIsAdmin || Number(c?.nivel || 0) < meuNivel);
  const mapaUsuarios = usuariosRoleMapa && typeof usuariosRoleMapa === "object" ? usuariosRoleMapa : {};
  const listaNotificacoes = Array.isArray(historicoNotificacoes) ? historicoNotificacoes : [];
  const niveisSelecionados = Array.isArray(notifMassaNiveis) ? notifMassaNiveis : [];

  const notificacoesFiltradas = listaNotificacoes.filter((n) => {
    if (!n || typeof n !== "object") return false;
    const senderInfo = mapaUsuarios[n.admin_id_real || n.admin_id];
    if (!senderInfo) return userPodeVerRemetente;
    const senderNivel = getNivel(senderInfo.role);
    return senderNivel <= meuNivel;
  });

  return (
    <div style={styles.dashContainer}>
      <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <AppModalNotificacao />
      <AppHeaderBar />

      <div style={{ padding: "30px 40px", maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        <h2 style={{ color: theme.text, margin: 0, fontWeight: "800" }}>🔔 Notificações</h2>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setNotifModoMassa(false)}
            style={{
              ...styles.btnPrimary,
              width: "auto",
              marginTop: 0,
              padding: "10px 20px",
              background: !notifModoMassa ? "linear-gradient(135deg, #92400e, #f97316)" : theme.inputBg,
              color: !notifModoMassa ? "#fff" : theme.subtext,
              border: `1px solid ${!notifModoMassa ? "#f97316" : theme.border}`,
            }}
          >
            👤 Envio Individual
          </button>
          <button
            onClick={() => setNotifModoMassa(true)}
            style={{
              ...styles.btnPrimary,
              width: "auto",
              marginTop: 0,
              padding: "10px 20px",
              background: notifModoMassa ? "linear-gradient(135deg, #4c1d95, #7c3aed)" : theme.inputBg,
              color: notifModoMassa ? "#fff" : theme.subtext,
              border: `1px solid ${notifModoMassa ? "#7c3aed" : theme.border}`,
            }}
          >
            📢 Envio em Massa
          </button>
        </div>

        {!notifModoMassa && (
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Enviar Notificação para Funcionário
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.miniLabel}>ID DO FUNCIONÁRIO</label>
                  <input
                    style={styles.input}
                    placeholder="Ex: 1234"
                    value={notifIdFuncionario}
                    onChange={(e) => {
                      setNotifIdFuncionario(e.target.value.replace(/\D/g, ""));
                      setNotifFuncionarioInfo(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && buscarFuncionarioParaNotif()}
                  />
                </div>
                <button
                  onClick={buscarFuncionarioParaNotif}
                  style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "11px 20px", background: "linear-gradient(135deg, #1e3a5f, #1d4ed8)" }}
                  disabled={notifBuscando}
                >
                  {notifBuscando ? "..." : "🔍 Buscar"}
                </button>
              </div>

              {notifFuncionarioInfo && (
                <div style={{ background: "#16a34a18", border: "1px solid #16a34a", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", color: "#22c55e", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>✅</span>
                  <span>
                    Encontrado: <b>{notifFuncionarioInfo.nome}</b> (ID: {notifFuncionarioInfo.id}) — {getLabelCargo(notifFuncionarioInfo.role)}
                  </span>
                  {notifFuncionarioInfo && !userIsAdmin && getNivel(userRole) <= getNivel(notifFuncionarioInfo.role) && (
                    <span style={{ color: "#ef4444", fontWeight: "700" }}>⚠️ Cargo igual ou superior — você não pode notificar este funcionário.</span>
                  )}
                </div>
              )}

              <div>
                <label style={styles.miniLabel}>MENSAGEM</label>
                <textarea
                  style={{ ...styles.textarea, minHeight: "120px" }}
                  placeholder="Escreva a notificação que o funcionário deverá confirmar a leitura..."
                  value={notifMensagem}
                  onChange={(e) => setNotifMensagem(e.target.value)}
                />
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: notifAnonimo ? "#78350f20" : theme.card2,
                  border: `1px solid ${notifAnonimo ? "#f59e0b" : theme.border}`,
                  fontSize: "13px",
                  color: theme.text,
                  transition: "all 0.2s",
                }}
              >
                <input type="checkbox" checked={notifAnonimo} onChange={(e) => setNotifAnonimo(e.target.checked)} />
                <div>
                  <div style={{ fontWeight: "700", color: notifAnonimo ? "#fbbf24" : theme.text }}>🎭 Envio Anônimo</div>
                  <div style={{ fontSize: "11px", color: theme.subtext }}>Seu nome ficará oculto para o funcionário. Apenas Gerente Geral e acima poderão ver quem enviou.</div>
                </div>
              </label>

              <button onClick={() => enviarNotificacao()} style={{ ...styles.btnPrimary, marginTop: 0, background: "linear-gradient(135deg, #92400e, #f97316)" }}>
                🔔 ENVIAR NOTIFICAÇÃO
              </button>
            </div>
          </div>
        )}

        {notifModoMassa && (
          <div style={{ ...styles.whiteCard, borderLeft: "3px solid #7c3aed" }}>
            <div style={{ ...styles.cardHeader, color: "#a78bfa" }}>
              <span style={{ ...styles.dot, background: "#7c3aed" }}></span> Envio em Massa
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={styles.miniLabel}>DESTINATÁRIOS</label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "12px", fontSize: "14px", color: theme.text }}>
                  <input
                    type="checkbox"
                    checked={notifMassaTodos}
                    onChange={(e) => {
                      setNotifMassaTodos(e.target.checked);
                      if (e.target.checked) setNotifMassaNiveis([]);
                    }}
                  />
                  <b>Todos os funcionários</b>
                  {!userIsAdmin && <span style={{ fontSize: "11px", color: theme.subtext }}>(apenas os de cargo abaixo do seu)</span>}
                </label>

                {!notifMassaTodos && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px", background: theme.card2, borderRadius: "10px", border: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: "11px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Selecionar cargos:</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                      {cargosQuePosoNotificar.map((cargo) => (
                        <label
                          key={cargo.value}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            cursor: "pointer",
                            fontSize: "13px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: niveisSelecionados.includes(cargo.value) ? "#7c3aed30" : theme.inputBg,
                            border: `1px solid ${niveisSelecionados.includes(cargo.value) ? "#7c3aed" : theme.border}`,
                            color: theme.text,
                            transition: "all 0.15s",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={niveisSelecionados.includes(cargo.value)}
                            onChange={() => setNotifMassaNiveis((prev) => {
                              const lista = Array.isArray(prev) ? prev : [];
                              return lista.includes(cargo.value) ? lista.filter((v) => v !== cargo.value) : [...lista, cargo.value];
                            })}
                          />
                          {cargo.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={styles.miniLabel}>MENSAGEM</label>
                <textarea
                  style={{ ...styles.textarea, minHeight: "120px" }}
                  placeholder="Mensagem enviada para todos os selecionados..."
                  value={notifMassaMensagem}
                  onChange={(e) => setNotifMassaMensagem(e.target.value)}
                />
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: notifMassaAnonimo ? "#78350f20" : theme.card2,
                  border: `1px solid ${notifMassaAnonimo ? "#f59e0b" : theme.border}`,
                  fontSize: "13px",
                  color: theme.text,
                }}
              >
                <input type="checkbox" checked={notifMassaAnonimo} onChange={(e) => setNotifMassaAnonimo(e.target.checked)} />
                <div>
                  <div style={{ fontWeight: "700", color: notifMassaAnonimo ? "#fbbf24" : theme.text }}>🎭 Envio Anônimo</div>
                  <div style={{ fontSize: "11px", color: theme.subtext }}>Os funcionários verão como &quot;Anônimo&quot;. Gerente Geral e acima verão o remetente real.</div>
                </div>
              </label>

              <button
                onClick={enviarNotificacaoMassa}
                disabled={notifMassaEnviando}
                style={{ ...styles.btnPrimary, marginTop: 0, background: notifMassaEnviando ? "#444" : "linear-gradient(135deg, #4c1d95, #7c3aed)" }}
              >
                {notifMassaEnviando ? "⏳ Enviando..." : "📢 ENVIAR PARA TODOS SELECIONADOS"}
              </button>
            </div>
          </div>
        )}

        <div style={styles.whiteCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Histórico de Notificações
            </div>
            <button
              onClick={() => {
                buscarHistoricoNotificacoes();
                buscarUsuariosComRole();
              }}
              style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "8px 16px", fontSize: "12px" }}
            >
              🔄 Atualizar
            </button>
          </div>
          {notificacoesFiltradas.length === 0 ? (
            <p style={{ color: theme.subtext, textAlign: "center", padding: "30px 0" }}>Nenhuma notificação para exibir.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: theme.card2, color: theme.subtext, textAlign: "left" }}>
                    {userPodeVerRemetente && <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontWeight: "700", textTransform: "uppercase", fontSize: "11px" }}>Remetente</th>}
                    {userIsAdmin && <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontWeight: "700", textTransform: "uppercase", fontSize: "11px" }}>Real (admin)</th>}
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontWeight: "700", textTransform: "uppercase", fontSize: "11px" }}>Funcionário</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontWeight: "700", textTransform: "uppercase", fontSize: "11px" }}>Mensagem</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontWeight: "700", textTransform: "uppercase", fontSize: "11px" }}>Enviado em</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontWeight: "700", textTransform: "uppercase", fontSize: "11px" }}>Status</th>
                    <th style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, fontWeight: "700", textTransform: "uppercase", fontSize: "11px", textAlign: "center" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {notificacoesFiltradas.map((n) => (
                    <tr key={n.id} style={{ borderBottom: `1px solid ${theme.border}`, background: n.lido_em ? "transparent" : "#f9731608" }}>
                      {userPodeVerRemetente && (
                        <td style={{ padding: "10px 12px", fontWeight: "600", color: theme.text }}>{n.anonimo ? <span style={{ color: "#f59e0b" }}>🎭 Anônimo</span> : n.admin_nome}</td>
                      )}
                      {userIsAdmin && (
                        <td style={{ padding: "10px 12px", fontSize: "12px", color: theme.subtext }}>{n.anonimo ? <span style={{ color: "#f97316" }}>ID: {n.admin_id_real || n.admin_id}</span> : "—"}</td>
                      )}
                      <td style={{ padding: "10px 12px", color: theme.text }}>
                        <div>{n.funcionario_nome}</div>
                        <div style={{ fontSize: "11px", color: theme.subtext }}>ID: {n.funcionario_id}</div>
                      </td>
                      <td style={{ padding: "10px 12px", color: theme.text, maxWidth: "260px" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }} title={n.mensagem}>
                          {n.mensagem}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", color: theme.subtext, fontSize: "12px", whiteSpace: "nowrap" }}>{formatarDataHora(n.criado_em)}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {n.lido_em ? (
                          <span style={{ background: "#16a34a20", color: "#22c55e", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>✅ Confirmado</span>
                        ) : (
                          <span style={{ background: "#f9731620", color: "#f97316", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>⏳ Pendente</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        {(userIsAdmin || n.admin_id_real === usuarioLogado?.id || n.admin_id === usuarioLogado?.id) && (
                          <button 
                            onClick={() => apagarNotificacao(n.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", opacity: 0.6, transition: "opacity 0.2s" }}
                            onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                            onMouseOut={(e) => e.currentTarget.style.opacity = 0.6}
                            title="Apagar esta notificação"
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
