import React, { useState } from "react";
import { supabase } from "../../utils/supabaseClient";

export default function ClientesPage({
  styles,
  theme,
  userIsAdmin,
  setPaginaAtual,
  buscaId,
  setBuscaId,
  buscarClientePorId,
  buscarClientes,
  clientesLista,
  editandoId,
  setEditandoId,
  novoNomeCliente,
  setNovoNomeCliente,
  usuariosMapa,
  historicoClienteId,
  historicoClienteDados,
  formatarDataHora,
  formatarData,
  atualizarNomeCliente,
  buscarServicosCliente,
  deletarCliente,
  temMaisClientes,
  ordemClientesStr,
  setOrdemClientesStr,
  AppHeaderBar,
  AppModalNotificacao,
}) {
  const [servicoSelecionado, setServicoSelecionado] = useState(null);
  const [isEditingServico, setIsEditingServico] = useState(false);
  const [tipoEditado, setTipoEditado] = useState("");
  const [valorEditado, setValorEditado] = useState("");
  const [detalhesEditados, setDetalhesEditados] = useState("");

  const abrirServico = (s) => {
    setServicoSelecionado(s);
    setIsEditingServico(false);
  };

  const fecharModal = () => {
    setServicoSelecionado(null);
    setIsEditingServico(false);
  };

  const iniciarEdicao = (servico) => {
    setIsEditingServico(true);
    setTipoEditado(servico.tipo || "");
    setValorEditado(servico.valor_total || 0);
    setDetalhesEditados(servico.detalhes || "");
  };

  const deletarServico = async (servico) => {
    if (!confirm(`⚠️ TEM CERTEZA?\n\nDeseja realmente apagar este serviço de R$ ${Number(servico.valor_total).toLocaleString("pt-BR")}?\nEsta ação é irreversível.`)) {
      return;
    }
    
    try {
      const { error } = await supabase.from("servicos").delete().eq("id", servico.id);
      if (error) {
        alert("❌ Erro ao deletar serviço: " + error.message);
        return;
      }
      
      alert("✅ Serviço deletado com sucesso!");
      
      // Recalcular gasto do cliente
      const { data: servicos } = await supabase
        .from("servicos")
        .select("valor_total")
        .eq("cliente_id", servico.cliente_id);
      
      const novoTotal = servicos ? servicos.reduce((acc, s) => acc + (Number(s.valor_total) || 0), 0) : 0;
      
      await supabase
        .from("clientes")
        .update({ total_gasto: novoTotal })
        .eq("id", servico.cliente_id);
      
      fecharModal();
      
      // Atualiza histórico na tela
      if (buscarServicosCliente) {
        await buscarServicosCliente(servico.cliente_id);
        await buscarServicosCliente(servico.cliente_id);
      }
      
      if (buscarClientes) {
        buscarClientes(true);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao processar requisição: " + err.message);
    }
  };

  const salvarEdicaoServico = async (servico) => {
    if (!tipoEditado) {
      alert("⚠️ Informe o tipo de serviço!");
      return;
    }
    
    try {
      const { error } = await supabase
        .from("servicos")
        .update({
          tipo: tipoEditado.toLowerCase(),
          valor_total: Number(valorEditado),
          detalhes: detalhesEditados
        })
        .eq("id", servico.id);
        
      if (error) {
        alert("❌ Erro ao atualizar serviço: " + error.message);
        return;
      }
      
      alert("✅ Serviço atualizado com sucesso!");
      
      // Recalcular gasto do cliente
      const { data: servicos } = await supabase
        .from("servicos")
        .select("valor_total")
        .eq("cliente_id", servico.cliente_id);
      
      const novoTotal = servicos ? servicos.reduce((acc, s) => acc + (Number(s.valor_total) || 0), 0) : 0;
      
      await supabase
        .from("clientes")
        .update({ total_gasto: novoTotal })
        .eq("id", servico.cliente_id);
        
      fecharModal();
      
      // Atualizar histórico na tela
      if (buscarServicosCliente) {
        await buscarServicosCliente(servico.cliente_id);
        await buscarServicosCliente(servico.cliente_id);
      }
      
      if (buscarClientes) {
        buscarClientes(true);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao salvar alterações: " + err.message);
    }
  };

  if (!userIsAdmin) {
    return (
      <div style={styles.dashContainer}>
        <AppHeaderBar />
        <div style={{ padding: "40px", color: "#fff", textAlign: "center" }}>
          <h2>Acesso Negado</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dashContainer}>
      <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <AppModalNotificacao />
      <AppHeaderBar />
      <div style={{ padding: "30px 40px" }}>
        <div style={styles.whiteCard}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
            <button
              style={{
                background: theme.card2,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
              }}
              onClick={() => setPaginaAtual("dashboard")}
            >
              ← Voltar
            </button>
            <h3 style={{ margin: 0, fontSize: "18px" }}>👥 Lista de Clientes</h3>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "24px" }}>
            <input
              style={{ ...styles.input, flex: 1, minWidth: "200px" }}
              placeholder="Buscar por Nome ou ID..."
              value={buscaId}
              onChange={(e) => setBuscaId(e.target.value)}
            />
            <select
              style={{ ...styles.input, width: "auto" }}
              value={ordemClientesStr}
              onChange={(e) => {
                const val = e.target.value;
                setOrdemClientesStr(val);
                buscarClientes(true, val);
              }}
            >
              <option value="id_asc">Ordenar por: ID (Crescente)</option>
              <option value="nome_asc">Ordenar por: Nome (A-Z)</option>
              <option value="recentes">Ordenar por: Serviços Recentes</option>
            </select>
            <button onClick={buscarClientePorId} style={{ ...styles.btnPrimary, width: "auto", marginTop: 0 }}>
              Buscar
            </button>
            <button onClick={() => buscarClientes(true)} style={{ ...styles.btnPrimary, width: "auto", marginTop: 0 }}>
              Limpar
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", marginTop: "20px" }}>
            {clientesLista.map((c) => (
              <div
                key={c.id}
                style={{
                  background: theme.card2,
                  border: `1px solid ${theme.border}`,
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 15px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.05)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      color: "#ef4444",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "800",
                      letterSpacing: "1px",
                    }}
                  >
                    ID {c.id}
                  </span>
                  <span style={{ color: "#22c55e", fontSize: "13px", fontWeight: "700" }}>
                    💰 R$ {c.total_gasto?.toLocaleString("pt-BR") || "0"}
                  </span>
                </div>

                <div>
                  {editandoId === c.id ? (
                    <input
                      style={{ ...styles.input, width: "100%", height: "36px", marginTop: "4px" }}
                      value={novoNomeCliente}
                      onChange={(e) => setNovoNomeCliente(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <h4 style={{ margin: "4px 0", fontSize: "18px", color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.nome}
                    </h4>
                  )}
                </div>

                <div style={{ fontSize: "11px", color: theme.subtext, background: theme.bg, border: `1px solid ${theme.border}`, padding: "8px 12px", borderRadius: "8px" }}>
                  <strong style={{ display: "block", marginBottom: "4px", color: theme.text }}>Última alteração:</strong>
                  {c.ultima_alteracao ? `${c.ultima_alteracao} — ${usuariosMapa[c.ultima_alteracao] || "Desconhecido"}` : "Nenhuma alteração"}
                </div>

                {historicoClienteId === c.id && (
                  <div style={{ padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", fontSize: "11px", color: theme.subtext, maxHeight: "150px", overflowY: "auto" }}>
                    <strong style={{ display: "block", marginBottom: "8px", color: theme.text, fontSize: "12px" }}>Últimos Serviços:</strong>
                    {historicoClienteDados.length === 0
                      ? "Buscando histórico..."
                      : historicoClienteDados.map((s) => (
                          <div 
                            key={s.id} 
                            style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}`, padding: "4px 6px", gap: "8px", cursor: "pointer", borderRadius: "4px", transition: "background 0.2s" }}
                            onClick={() => abrirServico(s)}
                            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {s.criado_em ? formatarDataHora(s.criado_em) : formatarData(s.data)} - {s.tipo?.toUpperCase()} ({s.funcionario_nome})
                            </span>
                            <span style={{ color: "#22c55e", fontWeight: "700", whiteSpace: "nowrap" }}>
                              R$ {(s.valor_total || 0).toLocaleString("pt-BR")}
                            </span>
                          </div>
                        ))}
                  </div>
                )}

                <div style={{ marginTop: "auto", paddingTop: "4px" }}>
                  {editandoId === c.id ? (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff", border: "none", padding: "8px", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer", flex: 1, transition: "all 0.2s" }}
                        onClick={() => atualizarNomeCliente(c.id)}
                        onMouseEnter={(e) => (e.target.style.filter = "brightness(1.1)")}
                        onMouseLeave={(e) => (e.target.style.filter = "brightness(1)")}
                      >
                        💾 Salvar
                      </button>
                      <button
                        style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "8px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                        onClick={() => setEditandoId(null)}
                        onMouseEnter={(e) => {
                          e.target.style.background = "rgba(255,255,255,0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = theme.card2;
                        }}
                      >
                        Sair
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", flex: 1, transition: "all 0.2s" }}
                        onClick={() => buscarServicosCliente(c.id)}
                        onMouseEnter={(e) => {
                          e.target.style.background = "rgba(255,255,255,0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = "transparent";
                        }}
                      >
                        📑 Histórico
                      </button>
                      <button
                        style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                        onClick={() => {
                          setEditandoId(c.id);
                          setNovoNomeCliente(c.nome);
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.borderColor = theme.subtext;
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.borderColor = theme.border;
                        }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        style={{ background: "transparent", border: `1px solid rgba(239, 68, 68, 0.3)`, color: "#ef4444", padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                        onClick={() => deletarCliente(c.id, c.nome)}
                        onMouseEnter={(e) => {
                          e.target.style.background = "rgba(239, 68, 68, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = "transparent";
                        }}
                        title="Apagar cliente"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {temMaisClientes && !buscaId && (
            <div style={{ textAlign: "center", marginTop: "24px" }}>
              <button
                onClick={() => buscarClientes(false)}
                style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.05)";
                  e.target.style.borderColor = theme.subtext;
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = theme.card2;
                  e.target.style.borderColor = theme.border;
                }}
              >
                Carregar mais clientes ⬇️
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Detalhes do Serviço */}
      {servicoSelecionado && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={fecharModal}>
          <div style={{ background: theme.card, borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "500px", border: `1px solid ${theme.border}`, display: "flex", flexDirection: "column", gap: "16px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.border}`, paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, color: theme.text, fontSize: "18px" }}>
                {isEditingServico ? "✏️ Editar Serviço" : "Detalhes do Serviço"}
              </h3>
              <button style={{ background: "transparent", border: "none", color: theme.subtext, fontSize: "20px", cursor: "pointer" }} onClick={fecharModal}>✕</button>
            </div>
            
            {isEditingServico ? (
              <div style={{ display: "grid", gap: "12px", fontSize: "14px", color: theme.text }}>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", color: theme.subtext, fontSize: "12px", fontWeight: "bold" }}>Tipo:</label>
                  <input
                    style={{ ...styles.input, width: "100%", height: "38px" }}
                    value={tipoEditado}
                    onChange={(e) => setTipoEditado(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", color: theme.subtext, fontSize: "12px", fontWeight: "bold" }}>Valor Total:</label>
                  <input
                    type="number"
                    style={{ ...styles.input, width: "100%", height: "38px" }}
                    value={valorEditado}
                    onChange={(e) => setValorEditado(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", color: theme.subtext, fontSize: "12px", fontWeight: "bold" }}>Informações Importantes:</label>
                  <textarea
                    style={{ ...styles.input, width: "100%", height: "80px", resize: "vertical", padding: "8px" }}
                    value={detalhesEditados}
                    onChange={(e) => setDetalhesEditados(e.target.value)}
                  />
                </div>
                
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button
                    style={{ ...styles.btnPrimary, flex: 1, margin: 0, height: "40px" }}
                    onClick={() => salvarEdicaoServico(servicoSelecionado)}
                  >
                    💾 Salvar
                  </button>
                  <button
                    style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", flex: 1 }}
                    onClick={() => setIsEditingServico(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: "12px", fontSize: "14px", color: theme.text }}>
                  <div><strong style={{ color: theme.subtext }}>Tipo:</strong> {servicoSelecionado.tipo?.toUpperCase()}</div>
                  <div><strong style={{ color: theme.subtext }}>Mecânico:</strong> {servicoSelecionado.funcionario_nome}</div>
                  <div><strong style={{ color: theme.subtext }}>Data/Hora:</strong> {servicoSelecionado.criado_em ? formatarDataHora(servicoSelecionado.criado_em) : formatarData(servicoSelecionado.data)}</div>
                  <div><strong style={{ color: theme.subtext }}>Valor Cobrado:</strong> <span style={{ color: "#22c55e", fontWeight: "bold" }}>R$ {(servicoSelecionado.valor_total || 0).toLocaleString("pt-BR")}</span></div>
                  {servicoSelecionado.detalhes && (
                    <div>
                      <strong style={{ color: theme.subtext, display: "block", marginBottom: "4px" }}>Informações Importantes:</strong>
                      <div style={{ background: theme.bg, padding: "8px 12px", borderRadius: "8px", border: `1px solid ${theme.border}` }}>
                        {servicoSelecionado.detalhes}
                      </div>
                    </div>
                  )}
                </div>

                {servicoSelecionado.link_imagem ? (
                  <div style={{ marginTop: "8px" }}>
                    <strong style={{ color: theme.subtext, display: "block", marginBottom: "8px" }}>Foto do Serviço:</strong>
                    <a href={servicoSelecionado.link_imagem} target="_blank" rel="noopener noreferrer">
                      <img src={servicoSelecionado.link_imagem} alt="Foto do Serviço" style={{ width: "100%", maxHeight: "250px", objectFit: "contain", borderRadius: "8px", border: `1px solid ${theme.border}` }} />
                    </a>
                  </div>
                ) : (
                  <div style={{ marginTop: "8px", padding: "16px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: "8px", color: theme.subtext, border: `1px dashed ${theme.border}` }}>
                    Nenhuma imagem registrada para este serviço.
                  </div>
                )}

                {userIsAdmin && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px", borderTop: `1px solid ${theme.border}`, paddingTop: "16px" }}>
                    <button
                      style={{
                        background: "rgba(59, 130, 246, 0.15)",
                        border: "1px solid rgba(59, 130, 246, 0.3)",
                        color: "#3b82f6",
                        padding: "10px 16px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "600",
                        flex: 1,
                        transition: "all 0.2s"
                      }}
                      onClick={() => iniciarEdicao(servicoSelecionado)}
                      onMouseEnter={(e) => e.target.style.background = "rgba(59, 130, 246, 0.25)"}
                      onMouseLeave={(e) => e.target.style.background = "rgba(59, 130, 246, 0.15)"}
                    >
                      ✏️ Editar Registro
                    </button>
                    <button
                      style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#ef4444",
                        padding: "10px 16px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "600",
                        flex: 1,
                        transition: "all 0.2s"
                      }}
                      onClick={() => deletarServico(servicoSelecionado)}
                      onMouseEnter={(e) => e.target.style.background = "rgba(239, 68, 68, 0.25)"}
                      onMouseLeave={(e) => e.target.style.background = "rgba(239, 68, 68, 0.15)"}
                    >
                      🗑️ Excluir Registro
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
