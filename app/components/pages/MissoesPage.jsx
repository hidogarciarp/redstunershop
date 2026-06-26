import React, { useState, useRef, useEffect } from "react";

export default function MissoesPage({
  theme, styles,
  usuarioLogado, userIsAdmin, userRole,
  missoes, missaoParticipacoes,
  buscarMissoes, buscarParticipacoesMissao,
  registrarParticipacao, aprovarParticipacao, deletarParticipacao,
  atualizarProgressoMissao, criarMissao, editarMissao, finalizarMissao,
}) {
  const [abaSelecionada, setAbaSelecionada] = useState(null);
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [obsRegistro, setObsRegistro] = useState("");
  const [fotoRegistro, setFotoRegistro] = useState(null);
  const [previewRegistro, setPreviewRegistro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [showCriar, setShowCriar] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formMissao, setFormMissao] = useState({ titulo: "", descricao: "", meta: 100, pontos_recompensa: 150, data_expiracao: "" });
  const [editProgress, setEditProgress] = useState(null);
  const [novoProgresso, setNovoProgresso] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [mostrarEncerradas, setMostrarEncerradas] = useState(false);
  const fileInputRef = useRef(null);

  // Fechar lightbox com ESC
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Carregar missões ao montar ou trocar filtro
  useEffect(() => {
    buscarMissoes(mostrarEncerradas);
  }, [mostrarEncerradas]);

  // Carregar participações da primeira missão quando a lista carregar
  useEffect(() => {
    if (missoes.length > 0) {
      const id = abaSelecionada || missoes[0].id;
      buscarParticipacoesMissao(id);
    }
  }, [missoes]);

  const podeGerenciar = userIsAdmin || (userRole && (userRole.includes("dono") || userRole.includes("gerente_geral")));

  const missaoAtual = abaSelecionada ? missoes.find(m => m.id === abaSelecionada) : missoes[0];
  const participacoes = missaoParticipacoes || [];
  const minhasParticipacoes = participacoes.filter(p => p.usuario_id === usuarioLogado?.id);
  const pendentes = participacoes.filter(p => !p.aprovado);

  // Ranking: agrupa aprovações por usuário
  const rankingMap = {};
  participacoes.filter(p => p.aprovado).forEach(p => {
    if (!rankingMap[p.usuario_id]) rankingMap[p.usuario_id] = { nome: p.nome_usuario, count: 0 };
    rankingMap[p.usuario_id].count++;
  });
  const ranking = Object.entries(rankingMap).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count);

  const handleFoto = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { setFotoRegistro(e.target.result); setPreviewRegistro(e.target.result); };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
    if (item) handleFoto(item.getAsFile());
  };

  const handleEnviarRegistro = async () => {
    if (!missaoAtual) return;
    setEnviando(true);
    await registrarParticipacao(missaoAtual.id, fotoRegistro, obsRegistro);
    setShowRegistrar(false); setObsRegistro(""); setFotoRegistro(null); setPreviewRegistro(null);
    await buscarParticipacoesMissao(missaoAtual.id);
    setEnviando(false);
  };

  const handleSalvarProgresso = async () => {
    if (!editProgress) return;
    await atualizarProgressoMissao(editProgress, parseInt(novoProgresso));
    setEditProgress(null); setNovoProgresso("");
    await buscarMissoes(mostrarEncerradas);
    if (missaoAtual) await buscarParticipacoesMissao(missaoAtual.id);
  };

  const handleSalvarMissao = async () => {
    if (editando) await editarMissao(editando, formMissao);
    else await criarMissao(formMissao);
    setShowCriar(false); setEditando(null);
    setFormMissao({ titulo: "", descricao: "", meta: 100, pontos_recompensa: 150, data_expiracao: "" });
    await buscarMissoes(mostrarEncerradas);
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";

  const card = { ...styles.whiteCard, padding: "20px", marginBottom: "16px" };
  const btn = (bg, color = "#fff") => ({
    background: bg, color, border: "none", padding: "8px 18px",
    borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "13px",
  });

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: theme.text }}>🎯 Missões {mostrarEncerradas && <span style={{ color: theme.accent, fontSize: "14px" }}>(Histórico)</span>}</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: theme.subtext }}>
            {mostrarEncerradas ? "Visualizando histórico de missões encerradas." : "Acompanhe e participe das missões coletivas da mecânica."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {podeGerenciar && (
            <button 
              style={{ ...btn(mostrarEncerradas ? "rgba(250,204,21,0.2)" : theme.card2), border: `1px solid ${mostrarEncerradas ? "#facc15" : theme.border}`, color: mostrarEncerradas ? "#facc15" : theme.text }}
              onClick={() => { setMostrarEncerradas(!mostrarEncerradas); setAbaSelecionada(null); }}
            >
              {mostrarEncerradas ? "👁️ Ver Ativas" : "📜 Ver Histórico"}
            </button>
          )}
          {podeGerenciar && (
            <button style={btn("linear-gradient(135deg,#b40d0d,#ef4444)")} onClick={() => { setShowCriar(true); setEditando(null); setFormMissao({ titulo: "", descricao: "", meta: 100, pontos_recompensa: 150, data_expiracao: "" }); }}>
              ＋ Nova Missão
            </button>
          )}
        </div>
      </div>

      {/* Tabs de missões */}
      {(missoes.length > 1 || (missoes.length === 1 && mostrarEncerradas)) && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {missoes.map(m => (
            <button key={m.id} onClick={() => { setAbaSelecionada(m.id); buscarParticipacoesMissao(m.id); }}
              style={{ ...btn(abaSelecionada === m.id || (!abaSelecionada && m.id === missoes[0]?.id) ? theme.accent : theme.card2), color: theme.text, border: `1px solid ${theme.border}`, opacity: m.ativa ? 1 : 0.7 }}>
              {!m.ativa && "📁 "}{m.titulo}
            </button>
          ))}
        </div>
      )}

      {!missaoAtual ? (
        <div style={{ ...card, textAlign: "center", padding: "48px", opacity: 0.6 }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎯</div>
          <div style={{ color: theme.text, fontWeight: "700" }}>Nenhuma missão ativa no momento.</div>
        </div>
      ) : (
        <>
          {/* Card da Missão */}
          <div style={{ ...card, borderLeft: `4px solid ${theme.accent}`, background: theme.card2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "800", fontSize: "20px", color: theme.text }}>{missaoAtual.titulo}</div>
                {missaoAtual.descricao && <div style={{ fontSize: "13px", color: theme.subtext, marginTop: "6px" }}>{missaoAtual.descricao}</div>}
                {missaoAtual.data_expiracao && (
                  <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "8px" }}>🕐 Expira em: <b style={{ color: theme.text }}>{fmtDate(missaoAtual.data_expiracao)}</b></div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ background: "rgba(250,204,21,0.15)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: "10px", padding: "8px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "18px", fontWeight: "900", color: "#facc15" }}>{missaoAtual.pontos_recompensa} ⭐</div>
                  <div style={{ fontSize: "9px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Recompensa</div>
                </div>
                {podeGerenciar && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <button style={{ ...btn(theme.card2), border: `1px solid ${theme.border}`, color: theme.subtext, fontSize: "11px", width: "100%" }}
                      onClick={() => { setEditando(missaoAtual.id); setFormMissao({ titulo: missaoAtual.titulo, descricao: missaoAtual.descricao || "", meta: missaoAtual.meta, pontos_recompensa: missaoAtual.pontos_recompensa, data_expiracao: missaoAtual.data_expiracao?.slice(0,16) || "" }); setShowCriar(true); }}>
                      ✏️ Editar
                    </button>
                    <button style={{ ...btn("rgba(239,68,68,0.1)"), border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "11px", width: "100%" }}
                      onClick={() => finalizarMissao(missaoAtual.id)}>
                      🛑 Encerrar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de progresso */}
            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: theme.subtext }}>
                  Progresso: <b style={{ color: theme.text, fontSize: "16px" }}>{missaoAtual.progresso}</b>
                  <span style={{ color: theme.subtext }}> / {missaoAtual.meta}</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "800" }}>
                    {Math.round((missaoAtual.progresso / missaoAtual.meta) * 100)}%
                  </span>
                  {podeGerenciar && (
                    editProgress === missaoAtual.id ? (
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input type="number" value={novoProgresso} onChange={e => setNovoProgresso(e.target.value)}
                          style={{ ...styles.input, width: "80px", padding: "4px 8px", fontSize: "13px" }} min={0} max={missaoAtual.meta} />
                        <button style={btn("#22c55e")} onClick={handleSalvarProgresso}>✓</button>
                        <button style={btn(theme.card2, theme.subtext)} onClick={() => setEditProgress(null)}>✕</button>
                      </div>
                    ) : (
                      <button style={{ ...btn(theme.card2), border: `1px solid ${theme.border}`, color: theme.subtext, fontSize: "11px", padding: "4px 10px" }}
                        onClick={() => { setEditProgress(missaoAtual.id); setNovoProgresso(String(missaoAtual.progresso)); }}>
                        ✏️ Editar progresso
                      </button>
                    )
                  )}
                </div>
              </div>
              <div style={{ height: "10px", borderRadius: "10px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (missaoAtual.progresso / missaoAtual.meta) * 100)}%`, background: "linear-gradient(90deg,#ef4444,#b40d0d)", borderRadius: "10px", transition: "width 0.4s ease" }} />
              </div>
            </div>
          </div>

          {/* Botão Registrar */}
          <div style={{ marginBottom: "20px" }}>
            <button style={btn("linear-gradient(135deg,#22c55e,#16a34a)", "#fff")} onClick={() => setShowRegistrar(v => !v)}>
              {showRegistrar ? "✕ Cancelar" : "📸 Registrar minha participação"}
            </button>
          </div>

          {/* Formulário de registro */}
          {showRegistrar && (
            <div style={{ ...card }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: theme.text, marginBottom: "14px" }}>📋 Novo Registro de Participação</div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Observação (opcional)</label>
                <textarea value={obsRegistro} onChange={e => setObsRegistro(e.target.value)} rows={2}
                  placeholder="Ex: Doei na clínica X às 14h..."
                  style={{ ...styles.input, width: "100%", resize: "vertical", marginTop: "4px", fontSize: "13px" }} />
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>Foto / Comprovante</label>
                <div
                  tabIndex={0} onPaste={handlePaste}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ marginTop: "6px", border: `2px dashed ${previewRegistro ? "#22c55e" : theme.border}`, borderRadius: "12px", padding: "20px", textAlign: "center", cursor: "pointer", background: theme.card2, outline: "none" }}>
                  {previewRegistro
                    ? <img src={previewRegistro} alt="preview" style={{ maxHeight: "200px", maxWidth: "100%", borderRadius: "8px" }} />
                    : <div style={{ color: theme.subtext, fontSize: "13px" }}>📎 Clique para selecionar ou <b>Ctrl+V</b> para colar</div>
                  }
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFoto(e.target.files[0])} />
                {previewRegistro && <button style={{ ...btn(theme.card2, theme.subtext), border: `1px solid ${theme.border}`, marginTop: "6px", fontSize: "11px" }} onClick={() => { setFotoRegistro(null); setPreviewRegistro(null); }}>🗑 Remover foto</button>}
              </div>
              <button disabled={enviando} style={btn("linear-gradient(135deg,#22c55e,#16a34a)")} onClick={handleEnviarRegistro}>
                {enviando ? "⏳ Enviando..." : "✅ Enviar Registro"}
              </button>
            </div>
          )}

          {/* Grid: Meus Registros + Ranking */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>

            {/* Meus Registros */}
            <div style={card}>
              <div style={{ fontWeight: "800", fontSize: "14px", color: theme.text, marginBottom: "12px" }}>📋 Meus Registros</div>
              {minhasParticipacoes.length === 0
                ? <div style={{ color: theme.subtext, fontSize: "13px", opacity: 0.6 }}>Nenhum registro enviado ainda.</div>
                : minhasParticipacoes.map(p => (
                  <div key={p.id} style={{ padding: "10px", borderRadius: "10px", background: theme.card2, border: `1px solid ${p.aprovado ? "rgba(34,197,94,0.3)" : theme.border}`, marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: theme.subtext }}>{fmtDate(p.criado_em)}</span>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: p.aprovado ? "#22c55e" : "#facc15" }}>
                        {p.aprovado ? "✅ Aprovado" : "⏳ Aguardando"}
                      </span>
                    </div>
                    {p.observacao && <div style={{ fontSize: "12px", color: theme.subtext, marginTop: "4px" }}>{p.observacao}</div>}
                    {p.foto_base64 && <img src={p.foto_base64} alt="comprovante" onClick={() => setLightboxSrc(p.foto_base64)} style={{ marginTop: "8px", maxWidth: "100%", maxHeight: "120px", borderRadius: "6px", cursor: "zoom-in", display: "block" }} />}
                  </div>
                ))
              }
            </div>

            {/* Ranking */}
            <div style={card}>
              <div style={{ fontWeight: "800", fontSize: "14px", color: theme.text, marginBottom: "12px" }}>🏆 Ranking de Participações</div>
              {ranking.length === 0
                ? <div style={{ color: theme.subtext, fontSize: "13px", opacity: 0.6 }}>Nenhuma participação aprovada ainda.</div>
                : ranking.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", background: i === 0 ? "rgba(250,204,21,0.08)" : theme.card2, border: `1px solid ${i === 0 ? "rgba(250,204,21,0.25)" : theme.border}`, marginBottom: "6px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: i === 0 ? "#facc15" : i === 1 ? "#94a3b8" : i === 2 ? "#f97316" : theme.border, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "13px", color: i < 3 ? "#111" : theme.subtext, flexShrink: 0 }}>
                      {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                    </div>
                    <div style={{ flex: 1, fontWeight: "700", fontSize: "13px", color: theme.text }}>{r.nome}</div>
                    <div style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "3px 10px", borderRadius: "6px", fontWeight: "800", fontSize: "13px" }}>
                      {r.count}x
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Painel Admin: Comprovantes Pendentes */}
          {podeGerenciar && pendentes.length > 0 && (
            <div style={card}>
              <div style={{ fontWeight: "800", fontSize: "14px", color: "#f97316", marginBottom: "14px" }}>⏳ Comprovantes Pendentes ({pendentes.length})</div>
              {pendentes.map(p => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "start", padding: "12px", borderRadius: "12px", background: theme.card2, border: `1px solid ${theme.border}`, marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontWeight: "700", color: theme.text, fontSize: "13px" }}>{p.nome_usuario}</div>
                    <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>{fmtDate(p.criado_em)}</div>
                    {p.observacao && <div style={{ fontSize: "12px", color: theme.subtext, marginTop: "4px" }}>{p.observacao}</div>}
                    {p.foto_base64 && <img src={p.foto_base64} alt="comprovante" onClick={() => setLightboxSrc(p.foto_base64)} style={{ marginTop: "8px", maxWidth: "300px", maxHeight: "160px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "zoom-in" }} />}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <button style={btn("#22c55e")} onClick={async () => { await aprovarParticipacao(p.id, true); await Promise.all([buscarMissoes(), buscarParticipacoesMissao(missaoAtual.id)]); }}>✅ Aprovar</button>
                    <button style={btn("rgba(239,68,68,0.15)", "#ef4444")} onClick={async () => { await aprovarParticipacao(p.id, false); await Promise.all([buscarMissoes(), buscarParticipacoesMissao(missaoAtual.id)]); }}>✕ Rejeitar</button>
                    <button style={{ ...btn("rgba(100,100,100,0.1)", theme.subtext), border: `1px solid ${theme.border}`, fontSize: "11px" }} onClick={async () => { await deletarParticipacao(p.id); await Promise.all([buscarMissoes(), buscarParticipacoesMissao(missaoAtual.id)]); }}>🗑 Apagar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Painel Admin: Registros Aprovados */}
          {podeGerenciar && participacoes.filter(p => p.aprovado).length > 0 && (
            <div style={card}>
              <div style={{ fontWeight: "800", fontSize: "14px", color: "#22c55e", marginBottom: "14px" }}>✅ Registros Aprovados ({participacoes.filter(p => p.aprovado).length})</div>
              {participacoes.filter(p => p.aprovado).map(p => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "start", padding: "12px", borderRadius: "12px", background: theme.card2, border: "1px solid rgba(34,197,94,0.2)", marginBottom: "10px" }}>
                  <div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontWeight: "700", color: theme.text, fontSize: "13px" }}>{p.nome_usuario}</span>
                      <span style={{ fontSize: "10px", background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "2px 8px", borderRadius: "6px", fontWeight: "700" }}>✅ aprovado</span>
                    </div>
                    <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "2px" }}>{fmtDate(p.criado_em)}</div>
                    {p.observacao && <div style={{ fontSize: "12px", color: theme.subtext, marginTop: "4px" }}>{p.observacao}</div>}
                    {p.foto_base64 && <img src={p.foto_base64} alt="comprovante" onClick={() => setLightboxSrc(p.foto_base64)} style={{ marginTop: "8px", maxWidth: "300px", maxHeight: "160px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "zoom-in" }} />}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <button
                      style={{ ...btn("rgba(250,204,21,0.1)", "#facc15"), border: "1px solid rgba(250,204,21,0.3)", fontSize: "11px", whiteSpace: "nowrap" }}
                      onClick={async () => { await aprovarParticipacao(p.id, false); await Promise.all([buscarMissoes(), buscarParticipacoesMissao(missaoAtual.id)]); }}
                    >↩ Cancelar aprovação</button>
                    <button
                      style={{ ...btn("rgba(239,68,68,0.1)", "#ef4444"), border: "1px solid rgba(239,68,68,0.3)", fontSize: "11px" }}
                      onClick={async () => { await deletarParticipacao(p.id); await Promise.all([buscarMissoes(), buscarParticipacoesMissao(missaoAtual.id)]); }}
                    >🗑 Apagar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal criar/editar missão */}
      {showCriar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: theme.card, borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "520px", border: `1px solid ${theme.border}` }}>
            <h2 style={{ margin: "0 0 20px", color: theme.text, fontSize: "18px" }}>{editando ? "✏️ Editar Missão" : "🎯 Nova Missão"}</h2>
            {[
              { label: "Título *", key: "titulo", type: "text", placeholder: "Ex: Doação de Sangue" },
              { label: "Descrição", key: "descricao", type: "textarea", placeholder: "Descrição da missão..." },
              { label: "Meta (quantidade)", key: "meta", type: "number" },
              { label: "Pontos de Recompensa", key: "pontos_recompensa", type: "number" },
              { label: "Data de Expiração", key: "data_expiracao", type: "datetime-local" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "10px", color: theme.subtext, fontWeight: "700", textTransform: "uppercase" }}>{label}</label>
                {type === "textarea"
                  ? <textarea rows={3} value={formMissao[key]} onChange={e => setFormMissao(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={{ ...styles.input, width: "100%", resize: "vertical", marginTop: "4px" }} />
                  : <input type={type} value={formMissao[key]} onChange={e => setFormMissao(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={{ ...styles.input, width: "100%", marginTop: "4px" }} />
                }
              </div>
            ))}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button style={btn(theme.card2, theme.subtext)} onClick={() => { setShowCriar(false); setEditando(null); }}>Cancelar</button>
              <button style={btn("linear-gradient(135deg,#b40d0d,#ef4444)")} onClick={handleSalvarMissao}>
                {editando ? "💾 Salvar" : "🚀 Criar Missão"}
              </button>
            </div>
          </div>
        </div>
      )}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: "24px" }}
        >
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img src={lightboxSrc} alt="comprovante ampliado" style={{ maxWidth: "90vw", maxHeight: "88vh", borderRadius: "12px", boxShadow: "0 8px 60px rgba(0,0,0,0.8)", display: "block" }} />
            <button
              onClick={() => setLightboxSrc(null)}
              style={{ position: "absolute", top: "-14px", right: "-14px", width: "32px", height: "32px", borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", lineHeight: 1 }}
            >✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
