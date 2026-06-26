import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";

export default function BotPage({ theme, styles }) {
  const [abaAtiva, setAbaAtiva] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [botOnline, setBotOnline] = useState(false);
  const [respostasAuto, setRespostasAuto] = useState({});
  const [novaResposta, setNovaResposta] = useState({ gatilho: "", resposta: "" });
  const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'https://bot-discord-bvnb.onrender.com';
  
  // 1. DEFINIÇÃO DAS FUNÇÕES (MOVIBAS PARA CIMA)
  const carregarRespostas = async () => {
    try {
      const res = await fetch(`${botUrl}/get-responses`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          setRespostasAuto(data);
        } else {
          console.warn("Respostas return was not an object:", data);
        }
      }
    } catch (e) {
      console.error("Erro ao carregar respostas:", e);
    }
  };

  const handleDeletarResposta = async (gatilho) => {
    if (!confirm(`Deseja excluir o comando !${gatilho}?`)) return;
    try {
      const res = await fetch(`${botUrl}/delete-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: gatilho })
      });
      if (res.ok) {
        alert("✅ Comando removido!");
        carregarRespostas();
      }
    } catch (e) { alert("Erro ao deletar."); }
  };

  const buscarLogs = async () => {
    try {
      const res = await fetch(`${botUrl}/get-logs`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogs(data);
          setBotOnline(true);
        } else {
          console.warn("Logs return was not an array:", data);
        }
      } else {
        setBotOnline(false);
      }
    } catch (e) {
      setBotOnline(false);
    }
  };

  const carregarCanais = async () => {
    setLoading(true);
    try {
      // Usamos maybeSingle() para não dar erro se a tabela estiver vazia
      const { data, error } = await supabase.from("configuracoes").select("canais_bot, fardas").limit(1).maybeSingle();
      
      if (error) {
        console.error("Erro Supabase:", error.message || error);
        return;
      }

      if (data) {
        // Só substitui os padrões se houver dados salvos (lista não vazia)
        if (data.canais_bot && Array.isArray(data.canais_bot) && data.canais_bot.length > 0) {
          setCanais(data.canais_bot);
        }
        if (data.fardas && Array.isArray(data.fardas) && data.fardas.length > 0) {
          setFardas(data.fardas);
        }
      }
    } catch (err) {
      console.error("Erro inesperado ao carregar canais/fardas:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. LOOP DE SINCRONIZAÇÃO
  useEffect(() => {
    carregarCanais();
    carregarRespostas();
    const interval = setInterval(() => {
      buscarLogs();
      carregarRespostas();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 3. ESTADOS E DADOS (FARDAS, CANAIS)
  const [fardas, setFardas] = useState([
    { 
      id: 'foto1', cargo: 'Estagiário', cor: '#ffffff',
      masculino: { lista: "COLETE 72-1\nJAQUETA 371-8\nMAOS 31-0\nCALÇAS 98-23\nSAPATOS 114-0 (livre)", imagem: "https://media.r2rp.com/v1/files/1775646973254-5pmelgko.png" },
      feminino: { lista: "COLETE 70-1\nJAQUETA 390-8\nMAOS 3-0\nCALÇAS 237-6\nSAPATOS 298-3 (livre)", imagem: "https://media.r2rp.com/v1/files/1775643251443-06pjzton.png" }
    },
    { 
      id: 'foto2', cargo: 'Mecânico', cor: '#00e1ff',
      masculino: { lista: "COLETE 72-1\nJAQUETA 371-4\nMAOS 31-0\nCALÇAS 98-23\nSAPATOS 114-0 (livre)", imagem: "https://media.r2rp.com/v1/files/1775646968590-lsth8ona.png" },
      feminino: { lista: "COLETE 70-1\nJAQUETA 390-4\nMAOS 3-0\nCALÇAS 237-6\nSAPATOS 298-3 (livre)", imagem: "https://media.r2rp.com/v1/files/1775643252943-n90vblpl.png" }
    },
    { 
      id: 'foto3', cargo: 'Mecânico Senior', cor: '#0011ff',
      masculino: { lista: "COLETE 72-1\nJAQUETA 371-5\nMAOS 31-0\nCALÇAS 98-23\nSAPATOS 114-0 (livre)", imagem: "https://media.r2rp.com/v1/files/1775646969457-fhenn25v.png" },
      feminino: { lista: "COLETE 70-1\nJAQUETA 390-5\nMAOS 3-0\nCALÇAS 237-6\nSAPATOS 298-3 (livre)", imagem: "https://media.r2rp.com/v1/files/1775643250658-qpzqc2gj.png" }
    },
    { 
      id: 'foto4', cargo: 'Supervisor & GG', cor: '#ff0000',
      masculino: { lista: "COLETE 72-1\nJAQUETA 371-0\nMAOS 31-0\nCALÇAS 98-23\nSAPATOS 114-0 (livre)", imagem: "https://media.r2rp.com/v1/files/1775646971732-3bqopsgg.png" },
      feminino: { lista: "COLETE 70-1\nJAQUETA 390-0\nMAOS 3-0\nCALÇAS 237-6\nSAPATOS 298-3 (livre)", imagem: "https://media.r2rp.com/v1/files/1775643248585-8zza2334.png" }
    },
    { 
      id: 'foto5', cargo: 'Chief', cor: '#ff008c',
      masculino: { lista: "COLETE 72-1\nJAQUETA 371-6\nMAOS 31-0\nCALÇAS 98-23\nSAPATOS 114-0 (livre)", imagem: "https://media.r2rp.com/v1/files/1775646970974-34e7o1y1.png" },
      feminino: { lista: "COLETE 70-1\nJAQUETA 390-6\nMAOS 3-0\nCALÇAS 237-6\nSAPATOS 298-3 (livre)", imagem: "https://media.r2rp.com/v1/files/1775643249907-bd979tww.png" }
    }
  ]);

  const [canais, setCanais] = useState([
    { id: 'hierarquia', nome: '🏛️ Canal de Hierarquia', valor: '1486119707684765831' },
    { id: 'logs', nome: '📜 Canal de Logs', valor: '1494752861421175024' },
    { id: 'registros', nome: '📑 Canal de Registros', valor: '1495986018820821153' },
    { id: 'promocoes', nome: '⭐ Canal de Promoções', valor: '1486119707416334589' }
  ]);

  const [novoCanal, setNovoCanal] = useState({ id: '', nome: '', valor: '' });

  const [novoAviso, setNovoAviso] = useState({ titulo: "", mensagem: "", canal: "1486119707416334589", agendamento: "" });

  const customStyles = {
    glassCard: {
      background: theme.card,
      backdropFilter: "blur(10px)",
      border: `1px solid ${theme.border}`,
      borderRadius: "20px",
      padding: "24px",
      transition: "all 0.3s ease",
    },
    abaBtn: (ativa) => ({
      padding: "10px 20px",
      borderRadius: "12px",
      border: "none",
      background: ativa ? theme.accent : "transparent",
      color: ativa ? "#fff" : theme.subtext,
      fontWeight: "700",
      cursor: "pointer",
      transition: "all 0.2s",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px"
    }),
    statCard: {
      background: theme.card2,
      padding: "20px",
      borderRadius: "16px",
      border: `1px solid ${theme.border}`,
      textAlign: "center",
      flex: 1
    }
  };

  const handleSalvarCanais = async () => {
    setLoading(true);
    try {
      await fetch(`${botUrl}/save-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canais })
      });
      await supabase.from("configuracoes").update({ canais_bot: canais }).eq("id", 1); 
      alert("✅ Canais salvos com sucesso!");
    } catch (err) {
      alert("❌ Erro ao salvar canais.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFarda = (id, genero, campo, valor) => {
    setFardas(prev => prev.map(f => {
      if (f.id === id) {
        return {
          ...f,
          [genero]: {
            ...f[genero],
            [campo]: valor
          }
        };
      }
      return f;
    }));
  };

  const handleSalvarFardas = async () => {
    setLoading(true);
    try {
      await supabase.from("configuracoes").update({ fardas: fardas }).eq("id", 1);
      alert("✅ Fardas salvas com sucesso!");
    } catch (err) {
      alert("❌ Erro ao salvar fardas.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdicionarCanal = () => {
    if (!novoCanal.id || !novoCanal.nome || !novoCanal.valor) return alert("Preencha todos os campos do novo canal!");
    setCanais([...canais, novoCanal]);
    setNovoCanal({ id: "", nome: "", valor: "" });
  };

  const handleRemoverCanal = (id) => {
    setCanais(canais.filter(c => c.id !== id));
  };

  const handleSalvarResposta = async () => {
    if (!novaResposta.gatilho || !novaResposta.resposta) return alert("Preencha ambos!");
    setLoading(true);
    try {
       const res = await fetch(`${botUrl}/add-response`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ trigger: novaResposta.gatilho, response: novaResposta.resposta })
       });
       if (res.ok) {
         alert("✅ Resposta automática adicionada!");
         setNovaResposta({ gatilho: "", resposta: "" });
         carregarRespostas();
       }
    } catch (e) { alert("Erro ao salvar resposta."); }
    finally { setLoading(false); }
  };

  const handleEnviarAviso = async () => {
    if (!novoAviso.titulo || !novoAviso.mensagem) return alert("Preencha todos os campos!");
    setLoading(true);
    try {
      const response = await fetch(`${botUrl}/send-announcement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: novoAviso.canal,
          title: novoAviso.titulo,
          message: novoAviso.mensagem
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(`🚀 Aviso "${novoAviso.titulo}" enviado!`);
        setNovoAviso({ ...novoAviso, titulo: "", mensagem: "" });
      } else {
        alert(`❌ Erro: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Bot offline: ${botUrl}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "30px 40px", animation: "fadeLogin 0.5s ease-out", minHeight: "100vh", paddingBottom: "100px" }}>
      <style>{`
        .img-hover:hover { transform: scale(1.03); }
        .log-line { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); font-family: monospace; font-size: 13px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: theme.text, display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "32px" }}>🤖</span> Central Red's Bot
          </h2>
          <p style={{ color: theme.subtext, margin: "5px 0 0 0" }}>Gerenciamento total de fardas, canais e logs.</p>
        </div>

        <div style={{ display: "flex", gap: "8px", background: theme.card2, padding: "6px", borderRadius: "16px", border: `1px solid ${theme.border}`, flexWrap: "wrap" }}>
          <button onClick={() => setAbaAtiva("dashboard")} style={customStyles.abaBtn(abaAtiva === "dashboard")}>📊 Status</button>
          <button onClick={() => setAbaAtiva("logs")} style={customStyles.abaBtn(abaAtiva === "logs")}>📜 Logs</button>
          <button onClick={() => setAbaAtiva("fardas")} style={customStyles.abaBtn(abaAtiva === "fardas")}>🧥 Fardas</button>
          <button onClick={() => setAbaAtiva("config")} style={customStyles.abaBtn(abaAtiva === "config")}>⚙️ Canais</button>
          <button onClick={() => setAbaAtiva("auto-respostas")} style={customStyles.abaBtn(abaAtiva === "auto-respostas")}>💬 Respostas</button>
          <button onClick={() => setAbaAtiva("anuncios")} style={customStyles.abaBtn(abaAtiva === "anuncios")}>📢 Avisos</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "100px", color: theme.text, display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
           <div style={{ width: "40px", height: "40px", border: `4px solid ${theme.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
           <span>Carregando dados...</span>
        </div>
      ) : (
        <>
          {/* ABA: STATUS */}
          {abaAtiva === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                <div style={customStyles.statCard}>
                   <p style={styles.miniLabel}>Porta de Comunicação</p>
                   <b style={{ fontSize: "14px", color: theme.accent, wordBreak: 'break-all' }}>{botUrl}</b>
                </div>
                <div style={customStyles.statCard}>
                   <p style={styles.miniLabel}>Status do Bot</p>
                   <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                      <span style={{ width: "12px", height: "12px", background: botOnline ? "#22c55e" : "#ef4444", borderRadius: "50%", boxShadow: botOnline ? "0 0 10px #22c55e" : "0 0 10px #ef4444" }}></span>
                      <b style={{ fontSize: "24px", color: theme.text }}>{botOnline ? "ONLINE" : "OFFLINE"}</b>
                   </div>
                </div>
                <div style={customStyles.statCard}>
                   <p style={styles.miniLabel}>Canais Mapeados</p>
                   <b style={{ fontSize: "24px", color: theme.text }}>{canais.length}</b>
                </div>
              </div>
            </div>
          )}

          {/* ABA: LOGS */}
          {abaAtiva === "logs" && (
            <div style={{ ...customStyles.glassCard, background: "#0c0c0c", border: "1px solid #333", maxHeight: "600px", overflowY: "auto" }}>
               <h3 style={{ color: "#fff", marginBottom: "20px" }}>Console do Bot</h3>
               {Array.isArray(logs) && logs.map((log, index) => (
                 <div key={log.id ? `log-${log.id}-${index}` : `log-idx-${index}`} className="log-line">
                    <span style={{ color: "#666", marginRight: "10px" }}>[{log.time}]</span>
                    <span style={{ color: log.type === 'success' ? '#22c55e' : log.type === 'error' ? '#ef4444' : log.type === 'primary' ? theme.accent : '#ccc' }}>{log.msg}</span>
                 </div>
               ))}
            </div>
          )}

          {/* ABA: AUTO-RESPOSTAS */}
          {abaAtiva === "auto-respostas" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "30px" }}>
               <div style={{ ...customStyles.glassCard, flex: 1, minWidth: "350px" }}>
                  <h3 style={{ color: theme.text }}>Nova Resposta</h3>
                  <div style={{ marginTop: "20px" }}>
                    <label style={styles.miniLabel}>Comando (ex: regras)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                       <b style={{ color: theme.accent, fontSize: "20px" }}>!</b>
                       <input style={styles.input} value={novaResposta.gatilho} onChange={e => setNovaResposta({...novaResposta, gatilho: e.target.value})} placeholder="comando" />
                    </div>
                    <label style={styles.miniLabel}>Resposta</label>
                    <textarea style={{ ...styles.textarea, height: "120px" }} value={novaResposta.resposta} onChange={e => setNovaResposta({...novaResposta, resposta: e.target.value})} placeholder="Mensagem..." />
                    <button onClick={handleSalvarResposta} style={{ ...styles.btnPrimary, marginTop: "20px" }}>💾 Salvar</button>
                  </div>
               </div>

               <div style={{ ...customStyles.glassCard, flex: 1, minWidth: "350px" }}>
                  <h3 style={{ color: theme.text, marginBottom: "20px" }}>Comandos Ativos</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto" }}>
                     {respostasAuto && Object.entries(respostasAuto).length === 0 ? (
                       <p style={{ color: theme.subtext }}>Nenhum comando criado.</p>
                     ) : (
                       respostasAuto && Object.entries(respostasAuto).map(([gatilho, resposta], index) => (
                         <div key={`resp-${gatilho}-${index}`} style={{ background: "rgba(255,255,255,0.03)", padding: "15px", borderRadius: "12px", border: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between" }}>
                            <div>
                               <b style={{ color: theme.accent, display: "block" }}>!{gatilho}</b>
                               <p style={{ color: theme.subtext, fontSize: "12px", margin: 0 }}>{String(resposta || "").substring(0, 50)}...</p>
                            </div>
                            <button onClick={() => handleDeletarResposta(gatilho)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>🗑️</button>
                         </div>
                       ))
                     )}
                  </div>
               </div>
            </div>
          )}

          {/* FARDAS */}
          {abaAtiva === "fardas" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={handleSalvarFardas} style={{ ...styles.btnPrimary, width: "auto", padding: "10px 30px" }}>💾 Salvar Todas as Fardas</button>
              </div>
              {fardas.map(farda => (
                <div key={farda.id} style={{ ...customStyles.glassCard, borderLeft: `6px solid ${farda.cor}` }}>
                  <h3 style={{ color: theme.text, marginBottom: "20px" }}>{farda.cargo.toUpperCase()}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
                    {/* MASCULINO */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <h4 style={{ color: theme.accent, fontSize: "12px", margin: 0 }}>♂️ MASCULINO</h4>
                      <img src={farda.masculino.imagem} style={{ width: "100%", height: "250px", objectFit: "cover", borderRadius: "12px" }} />
                      <label style={styles.miniLabel}>Link da Foto</label>
                      <input 
                        style={styles.input} 
                        value={farda.masculino.imagem} 
                        onChange={e => handleUpdateFarda(farda.id, 'masculino', 'imagem', e.target.value)}
                        placeholder="https://..."
                      />
                      <label style={styles.miniLabel}>Peças do Uniforme</label>
                      <textarea 
                        style={{ ...styles.textarea, height: "100px", fontSize: "12px" }} 
                        value={farda.masculino.lista} 
                        onChange={e => handleUpdateFarda(farda.id, 'masculino', 'lista', e.target.value)}
                      />
                    </div>

                    {/* FEMININO */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <h4 style={{ color: "#ec4899", fontSize: "12px", margin: 0 }}>♀️ FEMININO</h4>
                      <img src={farda.feminino.imagem} style={{ width: "100%", height: "250px", objectFit: "cover", borderRadius: "12px" }} />
                      <label style={styles.miniLabel}>Link da Foto</label>
                      <input 
                        style={styles.input} 
                        value={farda.feminino.imagem} 
                        onChange={e => handleUpdateFarda(farda.id, 'feminino', 'imagem', e.target.value)}
                        placeholder="https://..."
                      />
                      <label style={styles.miniLabel}>Peças do Uniforme</label>
                      <textarea 
                        style={{ ...styles.textarea, height: "100px", fontSize: "12px" }} 
                        value={farda.feminino.lista} 
                        onChange={e => handleUpdateFarda(farda.id, 'feminino', 'lista', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {abaAtiva === "config" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "30px", maxWidth: "800px", margin: "0 auto" }}>
              <div style={customStyles.glassCard}>
                <h3>IDs dos Canais</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" }}>
                  {canais && canais.map((canal, index) => (
                    <div key={canal.id ? `canal-${canal.id}-${index}` : `canal-idx-${index}`} style={{ display: "flex", gap: "15px", alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.miniLabel}>{canal.nome}</label>
                        <input style={styles.input} value={canal.valor} onChange={e => {
                          const newC = [...(canais || [])]; 
                          const target = newC.find(x => x.id === canal.id);
                          if (target) {
                            target.valor = e.target.value; 
                            setCanais(newC);
                          }
                        }} />
                      </div>
                      <button onClick={() => handleRemoverCanal(canal.id)} style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#ef4444", padding: "10px", borderRadius: "8px", cursor: "pointer" }}>🗑️</button>
                    </div>
                  ))}
                  <button onClick={handleSalvarCanais} style={styles.btnPrimary}>💾 Salvar Configurações</button>
                </div>
              </div>

              <div style={customStyles.glassCard}>
                <h3>➕ Adicionar Novo Canal</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginTop: "20px" }}>
                  <div>
                    <label style={styles.miniLabel}>ID (ex: logs_vendas)</label>
                    <input style={styles.input} value={novoCanal.id} onChange={e => setNovoCanal({...novoCanal, id: e.target.value})} placeholder="id_unico" />
                  </div>
                  <div>
                    <label style={styles.miniLabel}>Nome Exibição</label>
                    <input style={styles.input} value={novoCanal.nome} onChange={e => setNovoCanal({...novoCanal, nome: e.target.value})} placeholder="Nome do Canal" />
                  </div>
                  <div>
                    <label style={styles.miniLabel}>ID do Discord</label>
                    <input style={styles.input} value={novoCanal.valor} onChange={e => setNovoCanal({...novoCanal, valor: e.target.value})} placeholder="123456789..." />
                  </div>
                </div>
                <button onClick={handleAdicionarCanal} style={{ ...styles.btnPrimary, marginTop: "20px", background: theme.accent }}>➕ Adicionar Canal à Lista</button>
              </div>
            </div>
          )}

          {abaAtiva === "anuncios" && (
            <div style={{ ...customStyles.glassCard, maxWidth: "700px", margin: "0 auto" }}>
              <h3>📢 Enviar ou Agendar Aviso</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "25px" }}>
                <input style={styles.input} value={novoAviso.titulo} onChange={e => setNovoAviso({...novoAviso, titulo: e.target.value})} placeholder="Título do Anúncio" />
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div>
                    <label style={styles.miniLabel}>Canal de Destino</label>
                    <select style={styles.select} value={novoAviso.canal} onChange={e => setNovoAviso({...novoAviso, canal: e.target.value})}>
                      {canais.map(c => <option key={c.id} value={c.valor}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={styles.miniLabel}>Agendar para (Opcional)</label>
                    <input 
                      type="datetime-local" 
                      style={styles.input} 
                      value={novoAviso.agendamento} 
                      onChange={e => setNovoAviso({...novoAviso, agendamento: e.target.value})} 
                    />
                  </div>
                </div>

                <textarea style={{ ...styles.textarea, height: "150px" }} value={novoAviso.mensagem} onChange={e => setNovoAviso({...novoAviso, mensagem: e.target.value})} placeholder="Escreva sua mensagem aqui..." />
                
                <button onClick={handleEnviarAviso} style={styles.btnPrimary}>
                  {novoAviso.agendamento ? "⏰ AGENDAR AVISO" : "🚀 ENVIAR AGORA"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
