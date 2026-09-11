import React, { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export default function AdminPage({
  styles,
  theme,
  userIsAdmin,
  novoIdAdmin,
  setNovoIdAdmin,
  novoNomeAdmin,
  setNovoNomeAdmin,
  novoCargoAdmin,
  setNovoCargoAdmin,
  CARGOS_HIERARQUIA,
  ATRIBUICOES_DISPONIVEIS,
  novoCargoAtribuicoes,
  setNovoCargoAtribuicoes,
  cadastrarMecanico,
  buscarListaFuncionarios,
  buscaFuncionario,
  setBuscaFuncionario,
  listaFuncionarios,
  podeEditarFuncionario,
  userRole,
  editandoFuncionarioId,
  editFuncNovoId,
  setEditFuncNovoId,
  editFuncNome,
  setEditFuncNome,
  editFuncTelefone,
  setEditFuncTelefone,
  formatarTelefone,
  editFuncCargo,
  setEditFuncCargo,
  editFuncStatus,
  setEditFuncStatus,
  editFuncAdmissao,
  setEditFuncAdmissao,
  editFuncDemissao,
  setEditFuncDemissao,
  isAdminOuDono,
  getPrimaryRole,
  editFuncAtribuicoes,
  setEditFuncAtribuicoes,
  atualizarFuncionario,
  setEditandoFuncionarioId,
  getLabelCargo,
  iniciarEdicaoFuncionario,
  periodoDesempenho,
  setPeriodoDesempenho,
  dadosGrafico,
  legendaPeriodo,
  usuariosOnline,
  emServico,
  formatarHorario,
  fecharPontoAdmin,
  alternarVisibilidadePonto,
  apagarPonto,
  usuarioLogado,
  ranking,
  periodoRankingClientes,
  setPeriodoRankingClientes,
  rankingClientes,
  SeletorPeriodo,
}) {
  const [logsUsuario, setLogsUsuario] = useState(null);

  if (!userIsAdmin) return null;

  const primaryRole = getPrimaryRole(userRole);
  const podeContratar = isAdminOuDono(userRole) || primaryRole === "gerente_rh" || userRole?.includes("gerente_rh");

  return (
    <div style={{ padding: "30px 40px", maxWidth: "1400px", margin: "0 auto" }}>
      <h2 style={{ color: theme.text, margin: "0 0 24px", fontWeight: "800" }}>⚙️ Painel Administrativo</h2>

      <div style={{ display: "grid", gridTemplateColumns: podeContratar ? "1fr 1fr" : "1fr", gap: "24px", marginBottom: "24px" }}>
        {/* AUTORIZAR MECÂNICO */}
        {podeContratar && (
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Autorizar Novo Funcionário
            </div>
            <label style={styles.miniLabel}>ID PASSAPORTE</label>
            <input style={styles.input} placeholder="Ex: 1234" value={novoIdAdmin} onChange={(e) => setNovoIdAdmin(e.target.value)} />
            <label style={{ ...styles.miniLabel, marginTop: "14px" }}>NOME COMPLETO</label>
            <input style={styles.input} placeholder="Nome do funcionário" value={novoNomeAdmin} onChange={(e) => setNovoNomeAdmin(e.target.value)} />
            <label style={{ ...styles.miniLabel, marginTop: "14px" }}>CARGO</label>
            <select style={styles.select} value={novoCargoAdmin} onChange={(e) => setNovoCargoAdmin(e.target.value)}>
              {CARGOS_HIERARQUIA.filter((c) => {
                if (isAdminOuDono(userRole)) return true;
                return c.nivel < 6; // gerente_rh level is 6, so they can hire up to level 5 (supervisor/gerente)
              }).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <label style={{ ...styles.miniLabel, marginTop: "14px" }}>ATRIBUIÇÕES ESPECIAIS</label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {ATRIBUICOES_DISPONIVEIS.map((a) => (
                <label
                  key={a.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    cursor: "pointer",
                    fontSize: "13px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: novoCargoAtribuicoes.includes(a.value) ? "#1e40af30" : theme.card2,
                    border: `1px solid ${novoCargoAtribuicoes.includes(a.value) ? "#3b82f6" : theme.border}`,
                    color: theme.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={novoCargoAtribuicoes.includes(a.value)}
                    onChange={() =>
                      setNovoCargoAtribuicoes((prev) => (prev.includes(a.value) ? prev.filter((v) => v !== a.value) : [...prev, a.value]))
                    }
                  />
                  {a.label}
                </label>
              ))}
            </div>
            <div style={{ marginTop: "10px", padding: "10px 14px", background: theme.card2, borderRadius: "8px", fontSize: "12px", color: theme.subtext }}>
              <b style={{ color: theme.text }}>Role final:</b> {novoCargoAdmin}
              {novoCargoAtribuicoes.length > 0 ? "|" + novoCargoAtribuicoes.join("|") : ""}
            </div>
            <button style={styles.btnPrimary} onClick={cadastrarMecanico}>
              AUTORIZAR FUNCIONÁRIO
            </button>
          </div>
        )}

        {/* LISTA DE FUNCIONÁRIOS */}
        <div style={{ ...styles.whiteCard, maxHeight: "500px", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={styles.cardHeader}>
              <span style={{ ...styles.dot, background: "#38bdf8" }}></span> <span style={{ color: "#38bdf8" }}>👨‍🔧 Lista de Funcionários</span>
            </div>
            <button onClick={buscarListaFuncionarios} style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "6px 12px", fontSize: "11px" }}>
              🔄
            </button>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <input
              style={{ ...styles.input, fontSize: "12px", padding: "8px 12px" }}
              placeholder="🔍 Filtrar por nome ou ID..."
              value={buscaFuncionario}
              onChange={(e) => setBuscaFuncionario(e.target.value)}
            />
          </div>
          {listaFuncionarios
            .filter((f) => {
              if (!buscaFuncionario) return true;
              const termo = buscaFuncionario.toLowerCase();
              return (
                f.nome?.toLowerCase().includes(termo) ||
                String(f.id).includes(termo) ||
                (f.ids_antigos && f.ids_antigos.toLowerCase().includes(termo)) ||
                (f.nomes_antigos && f.nomes_antigos.toLowerCase().includes(termo))
              );
            })
            .map((func) => {
              const podeEditar = podeEditarFuncionario(userRole, func.role);
              const estandoEditando = editandoFuncionarioId === func.id;
              return (
                <div key={func.id} style={{ borderBottom: `1px solid ${theme.border}`, padding: "10px 0" }}>
                  {estandoEditando ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: theme.card2, padding: "12px", borderRadius: "10px" }}>
                      <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "700", marginBottom: "4px" }}>✏️ Editando ID {func.id}</div>
                      <div>
                        <label style={styles.miniLabel}>ID (PASSAPORTE)</label>
                        <input style={{ ...styles.input, fontSize: "13px", padding: "8px 12px" }} value={editFuncNovoId} onChange={(e) => setEditFuncNovoId(e.target.value)} type="number" />
                      </div>
                      <div>
                        <label style={styles.miniLabel}>NOME</label>
                        <input style={{ ...styles.input, fontSize: "13px", padding: "8px 12px" }} value={editFuncNome} onChange={(e) => setEditFuncNome(e.target.value)} />
                      </div>
                      <div>
                        <label style={styles.miniLabel}>TELEFONE (xxx-xxx)</label>
                        <input
                          style={{ ...styles.input, fontSize: "13px", padding: "8px 12px" }}
                          placeholder="Ex: 123-456"
                          value={editFuncTelefone}
                          onChange={(e) => setEditFuncTelefone(formatarTelefone(e.target.value))}
                          maxLength={7}
                        />
                      </div>
                      <div>
                        <label style={styles.miniLabel}>CARGO</label>
                        <select style={{ ...styles.select, fontSize: "13px", padding: "8px 12px" }} value={editFuncCargo} onChange={(e) => setEditFuncCargo(e.target.value)}>
                          {CARGOS_HIERARQUIA.filter((c) => {
                            if (isAdminOuDono(userRole)) return true;
                            if (getPrimaryRole(userRole) === "gerente_geral") return c.nivel < 6;
                            if (getPrimaryRole(userRole) === "gerente") return c.nivel < 5;
                            return false;
                          }).map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={styles.miniLabel}>STATUS</label>
                        <select style={{ ...styles.select, fontSize: "13px", padding: "8px 12px" }} value={editFuncStatus} onChange={(e) => setEditFuncStatus(e.target.value)}>
                          <option value="ativo">✅ Ativo</option>
                          <option value="inativo">❌ Inativo</option>
                          <option value="demitido">👋 Demitido</option>
                          <option value="outros">🚫 Outros (Staff, etc.)</option>
                        </select>
                      </div>
                      <div>
                        <label style={styles.miniLabel}>DATA DE ADMISSÃO</label>
                        <input
                          type="text"
                          placeholder="Ex: 2025-01-01, 2026-06-15"
                          style={{ ...styles.input, fontSize: "13px", padding: "8px 12px" }}
                          value={editFuncAdmissao}
                          onChange={(e) => setEditFuncAdmissao(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={styles.miniLabel}>DATA DE DEMISSÃO</label>
                        <input
                          type="text"
                          placeholder="Ex: 2025-06-01, 2026-06-29"
                          style={{ ...styles.input, fontSize: "13px", padding: "8px 12px" }}
                          value={editFuncDemissao}
                          onChange={(e) => setEditFuncDemissao(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={styles.miniLabel}>ATRIBUIÇÕES</label>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {ATRIBUICOES_DISPONIVEIS.map((a) => (
                            <label
                              key={a.value}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                                cursor: "pointer",
                                fontSize: "12px",
                                padding: "5px 10px",
                                borderRadius: "7px",
                                background: editFuncAtribuicoes.includes(a.value) ? "#1e40af30" : theme.inputBg,
                                border: `1px solid ${editFuncAtribuicoes.includes(a.value) ? "#3b82f6" : theme.border}`,
                                color: theme.text,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={editFuncAtribuicoes.includes(a.value)}
                                onChange={() =>
                                  setEditFuncAtribuicoes((prev) => (prev.includes(a.value) ? prev.filter((v) => v !== a.value) : [...prev, a.value]))
                                }
                              />
                              {a.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => atualizarFuncionario(func.id)} style={{ background: "#16a34a", color: "#fff", border: "none", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>
                          ✅ Salvar
                        </button>
                        <button onClick={() => setEditandoFuncionarioId(null)} style={{ background: "#444", color: "#fff", border: "none", padding: "7px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>
                          ✕ Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "13px" }}>{func.nome}</div>
                        <div style={{ fontSize: "11px", color: theme.subtext }}>
                          ID: {func.id}
                          {func.telefone && <span style={{ marginLeft: "8px", color: "#38bdf8" }}>📞 {func.telefone}</span>}
                          {func.status === "inativo" && <span style={{ marginLeft: "8px", color: "#ef4444", fontWeight: "bold" }}>[INATIVO]</span>}
                          {func.status === "demitido" && <span style={{ marginLeft: "8px", color: "#ef4444", fontWeight: "bold" }}>[DEMITIDO]</span>}
                          {func.status === "outros" && <span style={{ marginLeft: "8px", color: "#f97316", fontWeight: "bold" }}>[OUTROS]</span>}
                        </div>
                        <div style={{ fontSize: "10px", color: theme.subtext, marginTop: "2px", opacity: 0.8 }}>
                          {func.data_admissao && <span style={{ marginRight: "8px" }}>📅 Admissão: {new Date(func.data_admissao + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                          {func.data_demissao && <span>📅 Demissão: {new Date(func.data_demissao + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                        </div>
                        {(func.ids_antigos || func.nomes_antigos) && (
                          <div style={{ fontSize: "10px", color: theme.subtext, marginTop: "2px", opacity: 0.8 }}>
                            {func.ids_antigos && <span>IDs Anteriores: {func.ids_antigos}</span>}
                            {func.ids_antigos && func.nomes_antigos && <span style={{ margin: "0 6px" }}>|</span>}
                            {func.nomes_antigos && <span>Nomes Anteriores: {func.nomes_antigos}</span>}
                          </div>
                        )}
                        <div style={{ fontSize: "11px", color: "#f97316", fontWeight: "600", marginTop: "2px" }}>{getLabelCargo(func.role)}</div>
                      </div>
                      {podeEditar && (
                        <button
                          onClick={() => iniciarEdicaoFuncionario(func)}
                          style={{ background: "#1e40af20", color: "#60a5fa", border: "1px solid #1e40af", padding: "5px 11px", borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          {listaFuncionarios.filter((f) => {
            if (!buscaFuncionario) return true;
            const termo = buscaFuncionario.toLowerCase();
            return (
              f.nome?.toLowerCase().includes(termo) ||
              String(f.id).includes(termo) ||
              (f.ids_antigos && f.ids_antigos.toLowerCase().includes(termo)) ||
              (f.nomes_antigos && f.nomes_antigos.toLowerCase().includes(termo))
            );
          }).length === 0 && (
            <p style={{ color: theme.subtext, textAlign: "center", padding: "20px 0", fontSize: "13px" }}>Nenhum funcionário encontrado.</p>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "20px" }}>
        {/* GRÁFICO DESEMPENHO */}
        <div style={styles.whiteCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ ...styles.cardHeader, margin: 0 }}>
              <span style={styles.dot}></span> Desempenho Mecânicos
            </div>
            <SeletorPeriodo valor={periodoDesempenho} onChange={setPeriodoDesempenho} />
          </div>
          {dadosGrafico.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dadosGrafico}>
                <XAxis dataKey="nome" tick={{ fill: theme.subtext, fontSize: 11 }} />
                <YAxis tick={{ fill: theme.subtext, fontSize: 11 }} />
                <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "8px", color: theme.text }} formatter={(v) => [`${v}h`, "Horas"]} />
                <Line type="monotone" dataKey="horas" stroke={theme.accent} strokeWidth={2} dot={{ fill: theme.accent, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: theme.subtext, textAlign: "center", padding: "40px 0" }}>Sem dados para o período selecionado.</p>
          )}
          <div style={{ marginTop: "8px", textAlign: "center", fontSize: "11px", color: theme.subtext }}>{legendaPeriodo(periodoDesempenho)}</div>
        </div>

        {/* ONLINE */}
        <div style={styles.whiteCard}>
          <div style={styles.cardHeader}>
            <span style={styles.dot}></span> Mecânicos Online
          </div>
          {usuariosOnline.length > 0 ? (
            usuariosOnline.map((u) => (
              <div key={u.usuario_id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                <span>🟢 {u.nome}</span>
                <b style={{ color: "#22c55e" }}>Online</b>
              </div>
            ))
          ) : (
            <p style={{ color: "#888", textAlign: "center" }}>Ninguém online</p>
          )}
        </div>

        {/* EM SERVIÇO */}
        <div style={styles.whiteCard}>
          <div style={styles.cardHeader}>
            <span style={styles.dot}></span> Em Serviço
          </div>
          {emServico.length > 0 ? (
            emServico.map((u) => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${theme.border}`, opacity: u.oculto ? 0.6 : 1 }}>
                <span>
                  ⏱️ {u.nome} {u.oculto && <span style={{ fontSize: "11px", color: theme.accent }}>(Oculto)</span>} <span style={{ fontSize: "11px", color: theme.subtext }}>desde {formatarHorario(u.entrada)}</span>
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => fecharPontoAdmin(u.id)} style={{ background: "#16a34a", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>
                    ✅ Fechar
                  </button>
                  {isAdminOuDono(usuarioLogado?.role || "") && (
                    <button
                      onClick={() => alternarVisibilidadePonto(u)}
                      style={{ background: u.oculto ? "#10b981" : "#6b7280", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                    >
                      {u.oculto ? "👁️" : "🙈"}
                    </button>
                  )}
                  <button onClick={() => apagarPonto(u.id)} style={{ background: "#7f1d1d", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>
                    🗑️ Apagar
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: "#888", textAlign: "center" }}>Ninguém em serviço</p>
          )}
        </div>

        {/* RANKING HORAS */}
        <div style={styles.whiteCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ ...styles.cardHeader, margin: 0 }}>
              <span style={styles.dot}></span> Ranking de Horas
            </div>
            <SeletorPeriodo valor={periodoDesempenho} onChange={setPeriodoDesempenho} />
          </div>
          {ranking.length > 0 ? (
            ranking.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: "800", fontSize: "13px", color: i === 0 ? "#facc15" : i === 1 ? "#94a3b8" : i === 2 ? "#b87333" : theme.subtext, minWidth: "24px" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <span 
                    style={{ cursor: "pointer", color: theme.text }}
                    onClick={() => setLogsUsuario(r)}
                    title="Clique para ver os registros"
                  >
                    {r.nome}
                  </span>
                  {r.estrelas > 0 && <span style={{ marginLeft: "6px", fontSize: "11px", background: "rgba(250,204,21,0.15)", color: "#facc15", padding: "1px 6px", borderRadius: "6px", fontWeight: "900" }}>⭐ {r.estrelas}</span>}
                </span>
                <b style={{ color: "#22c55e" }}>
                  {(() => {
                    if (r.total_minutos == undefined || isNaN(r.total_minutos) || r.total_minutos <= 0) return "00:00";
                    const mins = Math.round(r.total_minutos);
                    return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
                  })()}
                </b>
              </div>
            ))
          ) : (
            <p style={{ color: "#888", textAlign: "center", padding: "16px 0" }}>Sem dados para o período.</p>
          )}
          <div style={{ marginTop: "8px", textAlign: "center", fontSize: "11px", color: theme.subtext }}>{legendaPeriodo(periodoDesempenho)}</div>
        </div>

        {/* RANKING MELHORES CLIENTES */}
        <div style={styles.whiteCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ ...styles.cardHeader, margin: 0 }}>
              <span style={{ ...styles.dot, background: "#facc15" }}></span>
              <span style={{ color: "#facc15" }}>🏆 Melhores Clientes</span>
            </div>
            <SeletorPeriodo valor={periodoRankingClientes} onChange={setPeriodoRankingClientes} />
          </div>
          {rankingClientes.length > 0 ? (
            rankingClientes.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: "800", fontSize: "13px", color: i === 0 ? "#facc15" : i === 1 ? "#94a3b8" : i === 2 ? "#b87333" : theme.subtext, minWidth: "24px" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>{c.cliente_nome || "Sem nome"}</div>
                    <div style={{ fontSize: "11px", color: theme.subtext }}>ID {c.cliente_id}</div>
                  </div>
                </span>
                <b style={{ color: "#22c55e", fontSize: "14px" }}>R$ {(c.total_gasto || 0).toLocaleString("pt-BR")}</b>
              </div>
            ))
          ) : (
            <p style={{ color: "#888", textAlign: "center", padding: "16px 0" }}>Sem dados para o período.</p>
          )}
          <div style={{ marginTop: "8px", textAlign: "center", fontSize: "11px", color: theme.subtext }}>{legendaPeriodo(periodoRankingClientes)}</div>
        </div>
      </div>

      {/* MODAL DE LOGS */}
      {logsUsuario && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", zIndex: 9999,
          display: "flex", justifyContent: "center", alignItems: "center", padding: "20px"
        }}>
          <div style={{ ...styles.whiteCard, width: "100%", maxWidth: "600px", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ ...styles.cardHeader, margin: 0 }}>
                <span style={{ ...styles.dot, background: "#38bdf8" }}></span>
                Registros de {logsUsuario.nome}
              </div>
              <button onClick={() => setLogsUsuario(null)} style={{ background: "transparent", border: "none", color: theme.text, fontSize: "16px", cursor: "pointer", fontWeight: "bold" }}>✕</button>
            </div>
            
            <div style={{ overflowY: "auto", flex: 1, paddingRight: "8px" }}>
              {logsUsuario.logs && logsUsuario.logs.length > 0 ? (
                logsUsuario.logs.map((log, i) => {
                  const dEntrada = log.entrada ? new Date(log.entrada) : null;
                  const dSaida = log.saida ? new Date(log.saida) : null;
                  const diff = dEntrada && dSaida ? (dSaida - dEntrada) / 60000 : 0;
                  const mins = Math.round(diff);
                  const duracao = diff > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : "—";
                  
                  return (
                    <div key={log.id || i} style={{ padding: "10px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: i % 2 === 0 ? "transparent" : theme.card2 }}>
                      <div>
                        <div style={{ fontSize: "11px", color: theme.subtext, marginBottom: "2px" }}>
                          {dEntrada ? dEntrada.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
                          {log.id_jogo && <span style={{ marginLeft: "8px", fontFamily: "monospace" }}>#{log.id_jogo}</span>}
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ color: "#22c55e", fontWeight: "700" }}>{dEntrada ? dEntrada.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—"}</span>
                          <span style={{ color: theme.subtext }}>→</span>
                          <span style={{ color: "#ef4444", fontWeight: "700" }}>{dSaida ? dSaida.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—"}</span>
                        </div>
                      </div>
                      <div style={{ fontWeight: "800", color: "#38bdf8", fontSize: "14px" }}>
                        {duracao}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: theme.subtext, textAlign: "center", padding: "20px 0" }}>Nenhum log encontrado.</p>
              )}
            </div>
            
            <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: `1px solid ${theme.border}`, textAlign: "right" }}>
              <button onClick={() => setLogsUsuario(null)} style={{ ...styles.btnPrimary, width: "auto", margin: 0, padding: "8px 24px" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
