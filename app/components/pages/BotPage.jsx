import React, { useState, useEffect } from "react";
import { supabase } from "../../utils/supabaseClient";

const DEFAULT_BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "https://rua2-pontos-bot.onrender.com";
const BOT_URL_STORAGE_KEY = "reds_bot_url";

export default function BotPage({ theme, styles }) {
  const [abaAtiva, setAbaAtiva] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [pingLoading, setPingLoading] = useState(false);
  const [botOnline, setBotOnline] = useState(false);
  const [botStats, setBotStats] = useState(null);
  const [latenciaMs, setLatenciaMs] = useState(null);
  const [ultimoPing, setUltimoPing] = useState(null);
  const [countdown, setCountdown] = useState(300); // 5 minutos = 300 segundos
  const [pingHistory, setPingHistory] = useState([]);
  
  const [botUrl, setBotUrl] = useState(DEFAULT_BOT_URL);
  const [tempBotUrl, setTempBotUrl] = useState(DEFAULT_BOT_URL);
  const [editandoUrl, setEditandoUrl] = useState(false);

  const [respostasAuto, setRespostasAuto] = useState({});
  const [novaResposta, setNovaResposta] = useState({ gatilho: "", resposta: "" });

  // 1. CARREGAR URL SALVA
  useEffect(() => {
    if (typeof window !== "undefined") {
      const salva = window.localStorage.getItem(BOT_URL_STORAGE_KEY);
      if (salva) {
        setBotUrl(salva);
        setTempBotUrl(salva);
      }
    }
  }, []);

  // 2. FUNÇÃO DE PING (MANTÉM O BOT ATIVO NO RENDER)
  const executarPing = async (urlCustom) => {
    const urlAlvo = urlCustom || botUrl;
    setPingLoading(true);

    try {
      const res = await fetch(`/api/bot/health?url=${encodeURIComponent(urlAlvo)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      const hora = new Date().toLocaleTimeString("pt-BR");
      setUltimoPing(hora);

      if (data.ok) {
        setBotOnline(true);
        setLatenciaMs(data.latencyMs);
        setBotStats(data.data || null);
        setPingHistory((prev) => [
          { hora, ok: true, latencia: data.latencyMs, msg: `Online - ${data.data?.uptimeFormatted || "Ativo"}` },
          ...prev.slice(0, 9),
        ]);
      } else {
        setBotOnline(false);
        setLatenciaMs(data.latencyMs || null);
        setBotStats(null);
        setPingHistory((prev) => [
          { hora, ok: false, latencia: data.latencyMs || 0, msg: data.error || "Inacessível / Dormindo" },
          ...prev.slice(0, 9),
        ]);
      }
    } catch (err) {
      const hora = new Date().toLocaleTimeString("pt-BR");
      setBotOnline(false);
      setUltimoPing(hora);
      setPingHistory((prev) => [
        { hora, ok: false, latencia: 0, msg: "Falha de conexão com a API de ping" },
        ...prev.slice(0, 9),
      ]);
    } finally {
      setPingLoading(false);
      setCountdown(300); // reinicia para 5 minutos
    }
  };

  // Dispara ping inicial e ciclo a cada 5 minutos
  useEffect(() => {
    void executarPing();
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void executarPing();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [botUrl]);

  const handleSalvarUrl = () => {
    const limpa = tempBotUrl.trim().replace(/\/+$/, "");
    setBotUrl(limpa);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BOT_URL_STORAGE_KEY, limpa);
    }
    setEditandoUrl(false);
    void executarPing(limpa);
  };

  // 3. CANAIS E FARDAS (SUPABASE)
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

  const carregarCanais = async () => {
    try {
      const { data, error } = await supabase.from("configuracoes").select("canais_bot, fardas").limit(1).maybeSingle();
      if (error) return;
      if (data) {
        if (data.canais_bot && Array.isArray(data.canais_bot) && data.canais_bot.length > 0) setCanais(data.canais_bot);
        if (data.fardas && Array.isArray(data.fardas) && data.fardas.length > 0) setFardas(data.fardas);
      }
    } catch (err) {
      console.error("Erro ao carregar canais/fardas:", err);
    }
  };

  useEffect(() => {
    carregarCanais();
  }, []);

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
      padding: "10px 18px",
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
      fontSize: "13px"
    }),
    statCard: {
      background: theme.card2,
      padding: "20px",
      borderRadius: "16px",
      border: `1px solid ${theme.border}`,
      textAlign: "center",
      flex: 1,
      minWidth: "180px"
    }
  };

  const formatMinutos = (segundos) => {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div style={{ padding: "30px 40px", animation: "fadeLogin 0.5s ease-out", minHeight: "100vh", paddingBottom: "100px" }}>
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* HEADER DA CENTRAL DO BOT */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "35px", flexWrap: "wrap", gap: "20px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: theme.text, display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "32px" }}>🤖</span> Central Red's Bot & Uptime
          </h2>
          <p style={{ color: theme.subtext, margin: "5px 0 0 0" }}>
            Monitor de vida 24/7 (ping a cada 5m), conformidade legal (Termos & Privacidade) e configurações.
          </p>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div style={{ display: "flex", gap: "6px", background: theme.card2, padding: "6px", borderRadius: "16px", border: `1px solid ${theme.border}`, flexWrap: "wrap" }}>
          <button onClick={() => setAbaAtiva("dashboard")} style={customStyles.abaBtn(abaAtiva === "dashboard")}>⚡ Uptime & Status</button>
          <button onClick={() => setAbaAtiva("termos")} style={customStyles.abaBtn(abaAtiva === "termos")}>📜 Termos de Serviço</button>
          <button onClick={() => setAbaAtiva("privacidade")} style={customStyles.abaBtn(abaAtiva === "privacidade")}>🔒 Privacidade</button>
          <button onClick={() => setAbaAtiva("fardas")} style={customStyles.abaBtn(abaAtiva === "fardas")}>🧥 Fardas</button>
          <button onClick={() => setAbaAtiva("config")} style={customStyles.abaBtn(abaAtiva === "config")}>⚙️ Canais</button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* ABA: STATUS & UPTIME (PING A CADA 5 MINUTOS) */}
      {/* ==================================================== */}
      {abaAtiva === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          
          {/* CARDS DE STATUS */}
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <div style={customStyles.statCard}>
              <p style={styles.miniLabel}>Status no Render</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginTop: "6px" }}>
                <span style={{ width: "14px", height: "14px", background: botOnline ? "#22c55e" : "#ef4444", borderRadius: "50%", boxShadow: botOnline ? "0 0 12px #22c55e" : "0 0 12px #ef4444" }}></span>
                <b style={{ fontSize: "24px", color: botOnline ? "#22c55e" : "#ef4444" }}>
                  {botOnline ? "ONLINE 24/7" : "OFFLINE / SLEEP"}
                </b>
              </div>
              <small style={{ color: theme.subtext, fontSize: "11px", display: "block", marginTop: "4px" }}>
                {ultimoPing ? `Última checagem: ${ultimoPing}` : "Aguardando..."}
              </small>
            </div>

            <div style={customStyles.statCard}>
              <p style={styles.miniLabel}>Latência do Ping</p>
              <b style={{ fontSize: "24px", color: latenciaMs ? (latenciaMs < 400 ? "#22c55e" : latenciaMs < 1200 ? "#eab308" : "#ef4444") : theme.subtext }}>
                {latenciaMs !== null ? `${latenciaMs} ms` : "—"}
              </b>
              <small style={{ color: theme.subtext, fontSize: "11px", display: "block", marginTop: "4px" }}>
                Via rota interna /api/bot/health
              </small>
            </div>

            <div style={customStyles.statCard}>
              <p style={styles.miniLabel}>Uptime do Bot</p>
              <b style={{ fontSize: "20px", color: theme.accent }}>
                {botStats?.uptimeFormatted || (botStats?.uptime ? `${Math.floor(botStats.uptime / 3600)}h` : "—")}
              </b>
              <small style={{ color: theme.subtext, fontSize: "11px", display: "block", marginTop: "4px" }}>
                Tempo ativo contínuo
              </small>
            </div>

            <div style={customStyles.statCard}>
              <p style={styles.miniLabel}>Memória RAM (Render)</p>
              <b style={{ fontSize: "20px", color: "#a855f7" }}>
                {botStats?.memoryHeapUsedMB ? `${botStats.memoryHeapUsedMB} MB` : "—"}
              </b>
              <small style={{ color: theme.subtext, fontSize: "11px", display: "block", marginTop: "4px" }}>
                Limite: 512 MB Free Tier
              </small>
            </div>
          </div>

          {/* CONTROLE DE URL DO BOT & TIMER REGRESSIVO */}
          <div style={{ ...customStyles.glassCard }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px", marginBottom: "15px" }}>
              <div>
                <h3 style={{ margin: 0, color: theme.text, fontSize: "18px" }}>📡 URL Hospedada no Render</h3>
                <p style={{ margin: "4px 0 0 0", color: theme.subtext, fontSize: "13px" }}>
                  O site envia um ping para este endereço a cada 5 minutos para impedir que o Render coloque o container em repouso.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "13px", color: theme.subtext }}>
                  Próximo ping em: <strong style={{ color: theme.accent, fontSize: "15px" }}>{formatMinutos(countdown)}</strong>
                </span>
                <button
                  onClick={() => executarPing()}
                  disabled={pingLoading}
                  style={{ ...styles.btnPrimary, width: "auto", padding: "8px 18px", fontSize: "13px" }}
                >
                  {pingLoading ? "⏳ Pingando..." : "🔄 Pingar Agora"}
                </button>
              </div>
            </div>

            {editandoUrl ? (
              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  value={tempBotUrl}
                  onChange={(e) => setTempBotUrl(e.target.value)}
                  placeholder="https://seu-bot.onrender.com"
                />
                <button onClick={handleSalvarUrl} style={{ ...styles.btnPrimary, width: "auto", padding: "8px 20px" }}>Salvar</button>
                <button onClick={() => { setTempBotUrl(botUrl); setEditandoUrl(false); }} style={{ background: "transparent", border: `1px solid ${theme.border}`, color: theme.text, padding: "8px 16px", borderRadius: "10px", cursor: "pointer" }}>Cancelar</button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.25)", padding: "12px 18px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                <code style={{ color: theme.accent, fontSize: "14px", wordBreak: "break-all" }}>{botUrl}</code>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setEditandoUrl(true)} style={{ background: "transparent", border: `1px solid ${theme.border}`, color: theme.text, padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}>
                    ✏️ Alterar URL
                  </button>
                  <a href={botUrl} target="_blank" rel="noreferrer" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${theme.border}`, color: theme.text, padding: "6px 14px", borderRadius: "8px", textDecoration: "none", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    🔗 Abrir no Render
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* HISTÓRICO RECENTE DE PINGS */}
          <div style={{ ...customStyles.glassCard }}>
            <h3 style={{ margin: "0 0 15px 0", color: theme.text, fontSize: "16px" }}>📋 Histórico de Pings Recentes</h3>
            {pingHistory.length === 0 ? (
              <p style={{ color: theme.subtext, margin: 0, fontSize: "13px" }}>Nenhum ping registrado nesta sessão.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pingHistory.map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: "10px", background: h.ok ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)", border: `1px solid ${h.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, fontSize: "13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: h.ok ? "#22c55e" : "#ef4444" }}></span>
                      <strong style={{ color: theme.text }}>{h.hora}</strong>
                      <span style={{ color: theme.subtext }}>{h.msg}</span>
                    </div>
                    <span style={{ fontWeight: "700", color: h.ok ? "#4ade80" : "#f87171" }}>
                      {h.latencia > 0 ? `${h.latencia}ms` : "Falhou"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA: TERMOS DE SERVIÇO (ATIVADOS PARA O DISCORD) */}
      {/* ==================================================== */}
      {abaAtiva === "termos" && (
        <div style={{ ...customStyles.glassCard, maxWidth: "850px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.border}`, paddingBottom: "16px", marginBottom: "20px" }}>
            <div>
              <h2 style={{ color: theme.text, margin: 0 }}>📜 Termos de Serviço — Red's Bot</h2>
              <p style={{ color: theme.subtext, margin: "4px 0 0 0", fontSize: "13px" }}>Em conformidade com as diretrizes do Discord Developer Portal</p>
            </div>
            <a href={`${botUrl}/terms`} target="_blank" rel="noreferrer" style={{ ...styles.btnPrimary, width: "auto", padding: "8px 18px", fontSize: "13px", textDecoration: "none" }}>
              🔗 Abrir Link Público
            </a>
          </div>

          <div style={{ color: theme.subtext, lineHeight: "1.7", fontSize: "14px" }}>
            <h3 style={{ color: theme.text, marginTop: "16px" }}>1. Aceitação dos Termos</h3>
            <p>Ao utilizar o bot <strong>Rua2 Pontos / Red's Bot</strong> ("Bot"), você concorda com estes Termos de Serviço. Se você não concorda, não utilize o Bot.</p>

            <h3 style={{ color: theme.text, marginTop: "16px" }}>2. Descrição do Serviço</h3>
            <p>O Bot monitora automaticamente mensagens em canais configurados do Discord que contenham logs de ponto de jogo (entrada/saída de serviço), baú, bancada e tunagens, processando os dados para conciliação contábil e auditoria no sistema web.</p>

            <h3 style={{ color: theme.text, marginTop: "16px" }}>3. Uso Permitido</h3>
            <p>O Bot deve ser utilizado exclusivamente para controle administrativo de oficinas mecânicas conveniadas. Qualquer tentativa de exploração de vulnerabilidades ou injeção de dados falsos resultará na revogação do acesso.</p>

            <h3 style={{ color: theme.text, marginTop: "16px" }}>4. Coleta de Dados</h3>
            <p>O Bot coleta e processa apenas os campos essenciais das mensagens enviadas nos canais oficiais: ID de jogo do funcionário, nome, evento (entrada/saída/serviço), data/hora, UUID único e ID do canal.</p>

            <h3 style={{ color: theme.text, marginTop: "16px" }}>5. Armazenamento e Segurança</h3>
            <p>Os registros são armazenados de forma criptografada na nuvem (Supabase). Nenhum dado pessoal sensível alheio à operação do servidor FiveM é solicitado ou retido.</p>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA: POLÍTICA DE PRIVACIDADE (ATIVADA PARA O DISCORD) */}
      {/* ==================================================== */}
      {abaAtiva === "privacidade" && (
        <div style={{ ...customStyles.glassCard, maxWidth: "850px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${theme.border}`, paddingBottom: "16px", marginBottom: "20px" }}>
            <div>
              <h2 style={{ color: theme.text, margin: 0 }}>🔒 Política de Privacidade — Red's Bot</h2>
              <p style={{ color: theme.subtext, margin: "4px 0 0 0", fontSize: "13px" }}>Transparência sobre coleta e tratamento de dados</p>
            </div>
            <a href={`${botUrl}/privacy`} target="_blank" rel="noreferrer" style={{ ...styles.btnPrimary, width: "auto", padding: "8px 18px", fontSize: "13px", textDecoration: "none" }}>
              🔗 Abrir Link Público
            </a>
          </div>

          <div style={{ color: theme.subtext, lineHeight: "1.7", fontSize: "14px" }}>
            <h3 style={{ color: theme.text, marginTop: "16px" }}>1. Informações Coletadas</h3>
            <p>O Bot coleta unicamente informações operacionais emitidas nos canais autorizados pelo Discord: identificadores de jogadores em jogo, horários de ponto e comprovantes de serviços mecânicos.</p>

            <h3 style={{ color: theme.text, marginTop: "16px" }}>2. Finalidade</h3>
            <p>Os dados são utilizados estritamente para o cálculo de horas trabalhadas, geração de folhas de pagamento e relatórios semanais de comissão.</p>

            <h3 style={{ color: theme.text, marginTop: "16px" }}>3. Compartilhamento</h3>
            <p>Os dados nunca são compartilhados ou vendidos a terceiros. O acesso é restrito aos gestores e administradores da oficina.</p>

            <h3 style={{ color: theme.text, marginTop: "16px" }}>4. Exclusão de Dados</h3>
            <p>Qualquer membro pode solicitar a exclusão ou retificação de registros contatando a administração da oficina pelo Discord.</p>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA: FARDAS */}
      {/* ==================================================== */}
      {abaAtiva === "fardas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
          {fardas.map((farda) => (
            <div key={farda.id} style={{ ...customStyles.glassCard, borderLeft: `6px solid ${farda.cor}` }}>
              <h3 style={{ color: theme.text, marginBottom: "20px" }}>{farda.cargo.toUpperCase()}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
                <div>
                  <h4 style={{ color: theme.accent, fontSize: "12px", margin: "0 0 10px 0" }}>♂️ MASCULINO</h4>
                  {farda.masculino?.imagem && <img src={farda.masculino.imagem} style={{ width: "100%", height: "220px", objectFit: "cover", borderRadius: "12px", marginBottom: "10px" }} alt="" />}
                  <textarea style={{ ...styles.textarea, height: "90px", fontSize: "12px" }} value={farda.masculino?.lista || ""} readOnly />
                </div>
                <div>
                  <h4 style={{ color: "#ec4899", fontSize: "12px", margin: "0 0 10px 0" }}>♀️ FEMININO</h4>
                  {farda.feminino?.imagem && <img src={farda.feminino.imagem} style={{ width: "100%", height: "220px", objectFit: "cover", borderRadius: "12px", marginBottom: "10px" }} alt="" />}
                  <textarea style={{ ...styles.textarea, height: "90px", fontSize: "12px" }} value={farda.feminino?.lista || ""} readOnly />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA: CANAIS */}
      {/* ==================================================== */}
      {abaAtiva === "config" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "30px", maxWidth: "800px", margin: "0 auto" }}>
          <div style={customStyles.glassCard}>
            <h3 style={{ color: theme.text }}>IDs dos Canais Configurados</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
              {canais.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "12px 16px", borderRadius: "10px", border: `1px solid ${theme.border}` }}>
                  <div>
                    <b style={{ color: theme.text, display: "block" }}>{c.nome}</b>
                    <span style={{ color: theme.subtext, fontSize: "12px" }}>ID: {c.valor}</span>
                  </div>
                  <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: "700" }}>✓ Monitorado</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
