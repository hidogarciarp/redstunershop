"use client";
import { useState, useEffect } from "react";
import { TABELA_PRECOS, REGRAS_PRECOS } from "../utils/constants";

const fmt = (v) => `$${Number(v).toLocaleString("pt-BR")}`;

const CATEGORIAS_VISIVEIS = ["Motor", "Transmissão", "Suspensão", "Blindagem", "Freios", "Outros"];

const CATEGORIAS_INFO = {
  Motor: {
    icon: "🔥",
    cor: "#ef4444",
    corGlow: "rgba(239,68,68,0.35)",
    desc: "Potência e torque elevados para máxima performance",
  },
  Transmissão: {
    icon: "⚙️",
    cor: "#f97316",
    corGlow: "rgba(249,115,22,0.35)",
    desc: "Câmbio otimizado para aceleração e controle superiores",
  },
  Suspensão: {
    icon: "🏎️",
    cor: "#eab308",
    corGlow: "rgba(234,179,8,0.35)",
    desc: "Manuseio preciso e estabilidade em alta velocidade",
  },
  Blindagem: {
    icon: "🛡️",
    cor: "#3b82f6",
    corGlow: "rgba(59,130,246,0.35)",
    desc: "Proteção reforçada para situações de extremo risco",
  },
  Freios: {
    icon: "🔴",
    cor: "#8b5cf6",
    corGlow: "rgba(139,92,246,0.35)",
    desc: "Frenagem de alto desempenho com máxima segurança",
  },
  Outros: {
    icon: "⚡",
    cor: "#06b6d4",
    corGlow: "rgba(6,182,212,0.35)",
    desc: "Upgrades especiais para um edge competitivo",
  },
  Tunagens: {
    icon: "🏆",
    cor: "#f59e0b",
    corGlow: "rgba(245,158,11,0.45)",
    desc: "Pacotes completos de tunagem para máxima performance",
  },
};

const NIVEIS_BADGE = ["Padrão", "Nível 1", "Nível 2", "Nível 3", "Nível 4", "Nível 5"];
const NIVEL_COR = ["#6b7280", "#22c55e", "#3b82f6", "#a855f7", "#f97316", "#ef4444"];

export default function TabelaPrecos() {
  const [catAtiva, setCatAtiva] = useState("Motor");
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mudarCategoria = (cat) => {
    if (cat === catAtiva) return;
    setAnimating(true);
    setTimeout(() => {
      setCatAtiva(cat);
      setAnimating(false);
    }, 180);
  };

  const itens = (TABELA_PRECOS[catAtiva] || []).filter(item => item.painel !== 0 || !item.hasOwnProperty('painel') || true).map(({ painel, ...rest }) => rest);
  const info = CATEGORIAS_INFO[catAtiva];
  const r = REGRAS_PRECOS;

  const getNivelIndex = (nome) => {
    if (nome.includes("Padrão")) return 0;
    const match = nome.match(/Nível (\d)/);
    return match ? parseInt(match[1]) : -1;
  };

  return (
    <div style={styles.root}>
      {/* BG animado */}
      <div style={styles.bgEffect} />
      <div style={styles.bgGrid} />

      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoWrap}>
            <span style={styles.logoIcon}>🔧</span>
            <div>
              <h1 className="ts-logo-title" style={styles.logoTitle}>Red&apos;s Tunershop</h1>
              <p style={styles.logoSub}>Tabela de Preços Oficial</p>
            </div>
          </div>
          <div className="ts-header-badge" style={styles.headerBadge}>
            <span style={styles.liveIcon} />
            Preços Atualizados
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="ts-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <span className="ts-hero-pill" style={styles.heroPill}>⚡ Performance & Qualidade</span>
          <h2 className="ts-hero-title" style={styles.heroTitle}>
            Conheça nossos<br />
            <span style={styles.heroGradient}>Serviços & Valores</span>
          </h2>
          <p className="ts-hero-desc" style={styles.heroDesc}>
            Aqui você encontra a tabela completa de preços para todos os serviços da nossa mecânica —
            desde upgrades de performance até pacotes completos de tunagem.
          </p>
        </div>
        {/* Floating cards de destaque */}
        <div style={styles.heroStats}>
          {[
            { label: "Categorias", val: Object.keys(TABELA_PRECOS).length, icon: "📦" },
            { label: "Serviços", val: Object.values(TABELA_PRECOS).flat().length, icon: "🛠️" },
            { label: "Níveis", val: "0 → 5", icon: "🏆" },
          ].map((s) => (
            <div key={s.label} className="ts-stat-card" style={styles.statCard}>
              <span style={styles.statIcon}>{s.icon}</span>
              <span className="ts-stat-val" style={styles.statVal}>{s.val}</span>
              <span className="ts-stat-label" style={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* AVISO DE PREÇOS */}
      <div className="ts-aviso" style={styles.avisoPrecos}>
        <span style={styles.avisoIcon}>⚠️</span>
        <span>Os valores exibidos podem sofrer alterações sem aviso prévio. Consulte nossa equipe para confirmar os preços antes de contratar o serviço.</span>
      </div>

      {/* NAV CATEGORIAS */}
      <nav className="ts-nav" style={styles.nav}>
        <div style={styles.navInner}>
          {CATEGORIAS_VISIVEIS.map((cat) => {
            const ci = CATEGORIAS_INFO[cat];
            const ativo = cat === catAtiva;
            return (
              <button
                key={cat}
                onClick={() => mudarCategoria(cat)}
                className="ts-nav-btn"
                style={{
                  ...styles.navBtn,
                  ...(ativo
                    ? {
                        background: `linear-gradient(135deg, ${ci.cor}22, ${ci.cor}44)`,
                        border: `1.5px solid ${ci.cor}88`,
                        color: ci.cor,
                        boxShadow: `0 0 18px ${ci.corGlow}`,
                      }
                    : {}),
                }}
              >
                <span style={{ fontSize: 20 }}>{ci.icon}</span>
                <span style={{ fontWeight: 600 }}>{cat}</span>
                {ativo && <span style={{ ...styles.navDot, background: ci.cor }} />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="ts-main" style={styles.main}>
        {/* Cabeçalho da categoria */}
        <div
          className="ts-cat-header"
          style={{
            ...styles.catHeader,
            borderColor: info.cor + "55",
            background: `linear-gradient(135deg, ${info.cor}10, ${info.cor}05)`,
            opacity: animating ? 0 : 1,
            transform: animating ? "translateY(12px)" : "translateY(0)",
            transition: "opacity 0.18s, transform 0.18s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="ts-cat-icon" style={{ ...styles.catIconWrap, background: info.cor + "22", boxShadow: `0 0 20px ${info.corGlow}` }}>
              <span style={{ fontSize: 32 }}>{info.icon}</span>
            </div>
            <div>
              <h2 className="ts-cat-title" style={{ ...styles.catTitle, color: info.cor }}>{catAtiva}</h2>
              <p className="ts-cat-desc" style={styles.catDesc}>{info.desc}</p>
            </div>
          </div>
          <div style={styles.catCount}>
            {itens.length} {itens.length === 1 ? "item" : "itens"}
          </div>
        </div>

        {/* CARDS */}
        <div
          className="ts-cards-grid"
          style={{
            ...styles.cardsGrid,
            opacity: animating ? 0 : 1,
            transform: animating ? "translateY(16px)" : "translateY(0)",
            transition: "opacity 0.2s, transform 0.2s",
          }}
        >
          {itens.map((item, idx) => {
            const nivelIdx = getNivelIndex(item.nome);
            const nivelCor = nivelIdx >= 0 ? NIVEL_COR[nivelIdx] : info.cor;
            const nivelLabel = nivelIdx >= 0 ? NIVEIS_BADGE[nivelIdx] : "";
            const isDestaque = nivelIdx === 5;

            return (
              <div
                key={item.id}
                className="ts-card"
                style={{
                  ...styles.card,
                  animationDelay: `${idx * 60}ms`,
                  border: isDestaque
                    ? `1.5px solid ${nivelCor}88`
                    : `1px solid rgba(255,255,255,0.07)`,
                  boxShadow: isDestaque
                    ? `0 0 28px ${nivelCor}33, 0 4px 24px rgba(0,0,0,0.4)`
                    : "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                {isDestaque && (
                  <div style={{ ...styles.destaqueRibbon, background: nivelCor }}>
                    ⭐ MAX
                  </div>
                )}

                {/* Topo do card */}
                <div style={styles.cardTop}>
                  {nivelLabel && (
                    <span
                      className="ts-nivel-badge"
                      style={{
                        ...styles.nivelBadge,
                        background: nivelCor + "22",
                        color: nivelCor,
                        border: `1px solid ${nivelCor}55`,
                      }}
                    >
                      {nivelLabel}
                    </span>
                  )}
                  <div
                    style={{
                      ...styles.cardDot,
                      background: nivelCor,
                      boxShadow: `0 0 10px ${nivelCor}99`,
                    }}
                  />
                </div>

                {/* Nome */}
                <h3 className="ts-card-nome" style={styles.cardNome}>{item.nome}</h3>

                {/* Preço principal */}
                <div style={styles.cardPrecoWrap}>
                  <span style={styles.cardPrecoLabel}>Preço do Serviço</span>
                  <span className="ts-card-preco" style={{ ...styles.cardPreco, color: nivelCor }}>
                    {fmt(item.preco)}
                  </span>
                </div>


              </div>
            );
          })}
        </div>

        {/* SEÇÃO GUINCHO */}
        <div className="ts-secao-extra" style={styles.secaoExtra}>
          <div style={styles.secaoExtraHeader}>
            <span style={{ fontSize: 28 }}>🚚</span>
            <div>
              <h2 className="ts-secao-titulo" style={styles.secaoExtraTitulo}>Guincho</h2>
              <p className="ts-secao-desc" style={styles.secaoExtraDesc}>Serviço de reboque e assistência veicular</p>
            </div>
          </div>
          <div className="ts-guincho-grid" style={styles.guinchoGrid}>
            {[
              { label: "Taxa Fixa de Acionamento", val: r.guincho.valor_fixo, icon: "📋" },
              { label: "Taxa por KM (a cada 2km)", val: r.guincho.valor_km, icon: "📍", obs: "Considera ida e volta da mecânica." },
              { label: "Reparo no Local", val: r.guincho.valor_reparo, icon: "🔧" },
              { label: "Troca de Pneu (por un.)", val: r.guincho.valor_pneu, icon: "🔵" },
            ].map((g) => (
              <div key={g.label} className="ts-guincho-card" style={styles.guinchoCard}>
                <span className="ts-guincho-icon" style={styles.guinchoIcon}>{g.icon}</span>
                <div>
                  <p className="ts-guincho-label" style={styles.guinchoLabel}>{g.label}</p>
                  <p className="ts-guincho-val" style={styles.guinchoVal}>{fmt(g.val)}</p>
                  {g.obs && <p className="ts-guincho-obs" style={styles.guinchoObs}>{g.obs}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SEÇÃO ESTÉTICA */}
        <div style={{ ...styles.secaoExtra, borderColor: "#ec4899" + "44" }}>
          <div style={styles.secaoExtraHeader}>
            <span style={{ fontSize: 28 }}>🎨</span>
            <div>
              <h2 style={{ ...styles.secaoExtraTitulo, color: "#ec4899" }}>Estética</h2>
              <p style={styles.secaoExtraDesc}>Personalização visual e acabamentos premium</p>
            </div>
          </div>
          <div style={styles.guinchoGrid}>
            {[
              { label: "Fumaça dos Pneus", val: r.estetica.valor_cliente_fumaca, icon: "💨" },
              { label: "Item Extra / Acessório", val: r.estetica.valor_cliente_extra, icon: "✨" },
              { label: "Pintura Camaleão (por peça)", val: r.estetica.valor_cliente_camaleao, icon: "🦎" },
            ].map((e) => (
              <div key={e.label} style={{ ...styles.guinchoCard, borderColor: "#ec489933" }}>
                <span style={styles.guinchoIcon}>{e.icon}</span>
                <div>
                  <p style={styles.guinchoLabel}>{e.label}</p>
                  <p style={{ ...styles.guinchoVal, color: "#ec4899" }}>{fmt(e.val)}</p>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* SEÇÃO LOJA / REGISTRADORA */}
        <div style={{ ...styles.secaoExtra, borderColor: "#10b98133" }}>
          <div style={styles.secaoExtraHeader}>
            <span style={{ fontSize: 28 }}>🛒</span>
            <div>
              <h2 style={{ ...styles.secaoExtraTitulo, color: "#10b981" }}>Loja — Itens à Venda</h2>
              <p style={styles.secaoExtraDesc}>Produtos disponíveis direto na registradora</p>
            </div>
          </div>
          <div style={styles.guinchoGrid}>
            {[
              { label: "Caixa de Ferramentas", val: 3000, icon: "🧰" },
              { label: "Caixa Avançada", val: 5000, icon: "🧰" },
              { label: "Pneu", val: 2700, icon: "⚫" },
              { label: "Chave Inglesa", val: 6000, icon: "🔩" },
            ].map((item) => (
              <div key={item.label} style={{ ...styles.guinchoCard, borderColor: "#10b98133" }}>
                <span style={styles.guinchoIcon}>{item.icon}</span>
                <div>
                  <p style={styles.guinchoLabel}>{item.label}</p>
                  <p style={{ ...styles.guinchoVal, color: "#10b981" }}>{fmt(item.val)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LEGENDA DE NÍVEIS */}
        <div className="ts-legenda-wrap" style={styles.legendaWrap}>
          <h3 style={styles.legendaTitulo}>📊 Guia de Níveis de Preparação</h3>
          <div className="ts-legenda-grid" style={styles.legendaGrid}>
            {NIVEIS_BADGE.map((n, i) => (
              <div key={n} style={styles.legendaItem}>
                <div
                  style={{
                    ...styles.legendaDot,
                    background: NIVEL_COR[i],
                    boxShadow: `0 0 12px ${NIVEL_COR[i]}88`,
                  }}
                />
                <div>
                  <p className="ts-legenda-name" style={{ ...styles.legendaName, color: NIVEL_COR[i] }}>{n}</p>
                  <p className="ts-legenda-subtext" style={styles.legendaSubtext}>
                    {i === 0 && "Componente de fábrica"}
                    {i === 1 && "Upgrade inicial"}
                    {i === 2 && "Intermediário"}
                    {i === 3 && "Avançado"}
                    {i === 4 && "High performance"}
                    {i === 5 && "Máxima performance"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NOTA DE RODAPÉ */}
        <div className="ts-footer" style={styles.footer}>
          <p className="ts-footer-text" style={styles.footerText}>
            🔧 <strong style={{ color: "#f59e0b" }}>Red&apos;s Tunershop</strong> — Os preços exibidos são cobrados do cliente pelo serviço de mão de obra e instalação.
            Valores sujeitos a alteração sem aviso prévio. Para orçamentos especiais, consulte nossa equipe.
          </p>
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #080b12; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes bgMove {
          0% { transform: translate(-50%,-50%) rotate(0deg); }
          100% { transform: translate(-50%,-50%) rotate(360deg); }
        }

        /* ===== MOBILE ===== */
        @media (max-width: 480px) {
          /* Header */
          .ts-logo-title { font-size: 17px !important; }
          .ts-header-badge { display: none !important; }

          /* Hero */
          .ts-hero { padding: 32px 16px 24px !important; gap: 24px !important; }
          .ts-hero-pill { font-size: 11px !important; }
          .ts-hero-title { font-size: 26px !important; letter-spacing: -0.5px !important; margin-bottom: 12px !important; }
          .ts-hero-desc { font-size: 14px !important; }
          .ts-stat-card { min-width: 90px !important; padding: 14px 16px !important; }
          .ts-stat-val { font-size: 22px !important; }
          .ts-stat-label { font-size: 10px !important; }

          /* Nav */
          .ts-nav { padding: 10px 12px !important; }
          .ts-nav-btn { padding: 8px 12px !important; font-size: 12px !important; gap: 5px !important; }
          .ts-nav-btn span:first-child { font-size: 16px !important; }

          /* Aviso */
          .ts-aviso { font-size: 11px !important; padding: 8px 12px !important; gap: 6px !important; }

          /* Main */
          .ts-main { padding: 16px 12px 40px !important; gap: 20px !important; }

          /* Cat header */
          .ts-cat-header { padding: 16px !important; }
          .ts-cat-icon { width: 48px !important; height: 48px !important; font-size: 24px !important; }
          .ts-cat-title { font-size: 18px !important; }
          .ts-cat-desc { font-size: 12px !important; }

          /* Cards grid */
          .ts-cards-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .ts-card { padding: 14px 12px !important; border-radius: 14px !important; }
          .ts-card-nome { font-size: 13px !important; margin-bottom: 10px !important; }
          .ts-card-preco { font-size: 20px !important; }
          .ts-nivel-badge { font-size: 10px !important; padding: 2px 7px !important; }

          /* Seções extras */
          .ts-secao-extra { padding: 18px 14px !important; border-radius: 16px !important; }
          .ts-secao-titulo { font-size: 17px !important; }
          .ts-secao-desc { font-size: 12px !important; }
          .ts-guincho-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .ts-guincho-card { padding: 12px 10px !important; gap: 8px !important; border-radius: 10px !important; }
          .ts-guincho-icon { font-size: 20px !important; }
          .ts-guincho-label { font-size: 11px !important; }
          .ts-guincho-val { font-size: 16px !important; }
          .ts-guincho-obs { font-size: 10px !important; }

          /* Legenda */
          .ts-legenda-wrap { padding: 18px 14px !important; border-radius: 16px !important; }
          .ts-legenda-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .ts-legenda-name { font-size: 12px !important; }
          .ts-legenda-subtext { font-size: 10px !important; }

          /* Footer */
          .ts-footer { padding: 16px !important; }
          .ts-footer-text { font-size: 12px !important; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#080b12",
    fontFamily: "'Inter', sans-serif",
    color: "#e2e8f0",
    position: "relative",
    overflowX: "hidden",
  },
  bgEffect: {
    position: "fixed",
    top: "30%",
    left: "50%",
    width: 900,
    height: 900,
    borderRadius: "50%",
    background: "radial-gradient(ellipse, rgba(220,38,38,0.07) 0%, transparent 70%)",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: 0,
    animation: "bgMove 30s linear infinite",
  },
  bgGrid: {
    position: "fixed",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
    `,
    backgroundSize: "50px 50px",
    pointerEvents: "none",
    zIndex: 0,
  },
  header: {
    position: "relative",
    zIndex: 10,
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(8,11,18,0.9)",
    backdropFilter: "blur(20px)",
    padding: "0 24px",
  },
  headerInner: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 0",
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  logoIcon: {
    fontSize: 32,
    filter: "drop-shadow(0 0 10px rgba(239,68,68,0.6))",
  },
  logoTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "-0.5px",
    background: "linear-gradient(90deg, #f59e0b, #ef4444)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  logoSub: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 500,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  headerBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#22c55e",
    padding: "6px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
  },
  liveIcon: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#22c55e",
    animation: "pulse 2s ease-in-out infinite",
  },
  hero: {
    position: "relative",
    zIndex: 5,
    maxWidth: 1200,
    margin: "0 auto",
    padding: "60px 24px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 40,
  },
  heroContent: { maxWidth: 680 },
  heroPill: {
    display: "inline-block",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.35)",
    color: "#f59e0b",
    padding: "6px 16px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 20,
    letterSpacing: "0.3px",
  },
  heroTitle: {
    fontSize: "clamp(32px, 5vw, 52px)",
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: "-1.5px",
    margin: "0 0 20px",
    color: "#f1f5f9",
  },
  heroGradient: {
    background: "linear-gradient(90deg, #f59e0b, #ef4444, #8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroDesc: {
    fontSize: 17,
    lineHeight: 1.7,
    color: "#94a3b8",
    margin: 0,
    fontWeight: 400,
  },
  heroStats: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  statCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "20px 28px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    backdropFilter: "blur(10px)",
    minWidth: 120,
  },
  statIcon: { fontSize: 24 },
  statVal: { fontSize: 28, fontWeight: 800, color: "#f1f5f9", lineHeight: 1 },
  statLabel: { fontSize: 12, color: "#64748b", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" },
  avisoPrecos: {
    position: "relative",
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    background: "rgba(245,158,11,0.08)",
    borderTop: "1px solid rgba(245,158,11,0.2)",
    borderBottom: "1px solid rgba(245,158,11,0.2)",
    padding: "10px 24px",
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 1.5,
  },
  avisoIcon: {
    fontSize: 16,
    flexShrink: 0,
  },
  nav: {
    position: "relative",
    zIndex: 5,
    borderTop: "1px solid rgba(255,255,255,0.05)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    background: "rgba(8,11,18,0.7)",
    backdropFilter: "blur(20px)",
    padding: "12px 24px",
    overflowX: "auto",
  },
  navInner: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  navBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    borderRadius: 12,
    border: "1.5px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.03)",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    transition: "all 0.2s ease",
    position: "relative",
    whiteSpace: "nowrap",
  },
  navDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    marginLeft: 2,
  },
  main: {
    position: "relative",
    zIndex: 5,
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 24px 60px",
    display: "flex",
    flexDirection: "column",
    gap: 32,
  },
  catHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "24px 28px",
    borderRadius: 20,
    border: "1px solid",
    backdropFilter: "blur(10px)",
    flexWrap: "wrap",
    gap: 12,
  },
  catIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  catTitle: {
    margin: "0 0 4px",
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: "-0.5px",
  },
  catDesc: {
    margin: 0,
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: 400,
  },
  catCount: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "6px 14px",
    borderRadius: 999,
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: 500,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 16,
  },
  card: {
    position: "relative",
    background: "rgba(15,20,35,0.8)",
    borderRadius: 18,
    padding: "22px 20px",
    backdropFilter: "blur(16px)",
    transition: "transform 0.2s, box-shadow 0.2s",
    animation: "fadeSlideUp 0.35s ease both",
    overflow: "hidden",
  },
  destaqueRibbon: {
    position: "absolute",
    top: 12,
    right: -20,
    transform: "rotate(35deg)",
    padding: "3px 28px",
    fontSize: 10,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  nivelBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    letterSpacing: "0.3px",
  },
  cardDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
  cardNome: {
    margin: "0 0 16px",
    fontSize: 16,
    fontWeight: 700,
    color: "#f1f5f9",
    letterSpacing: "-0.3px",
    lineHeight: 1.3,
  },
  cardPrecoWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 10,
  },
  cardPrecoLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  cardPreco: {
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: "-0.5px",
    lineHeight: 1,
  },
  cardPainelWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    padding: "8px 10px",
    marginTop: 6,
  },
  cardPainelLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 500,
  },
  cardPainelVal: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: 600,
  },
  secaoExtra: {
    background: "rgba(15,20,35,0.6)",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "28px",
    backdropFilter: "blur(16px)",
  },
  secaoExtraHeader: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  secaoExtraTitulo: {
    margin: "0 0 4px",
    fontSize: 22,
    fontWeight: 800,
    color: "#38bdf8",
    letterSpacing: "-0.5px",
  },
  secaoExtraDesc: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
  },
  guinchoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12,
  },
  guinchoCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "16px 18px",
  },
  guinchoIcon: {
    fontSize: 28,
    lineHeight: 1,
  },
  guinchoLabel: {
    margin: "0 0 4px",
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: 500,
  },
  guinchoObs: {
    margin: "4px 0 0",
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
    fontStyle: "italic",
  },
  guinchoVal: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: "#38bdf8",
    letterSpacing: "-0.3px",
  },
  esteticaNote: {
    marginTop: 20,
    padding: "12px 16px",
    background: "rgba(245,158,11,0.07)",
    border: "1px solid rgba(245,158,11,0.2)",
    borderRadius: 12,
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 1.6,
  },
  legendaWrap: {
    background: "rgba(15,20,35,0.6)",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "28px",
    backdropFilter: "blur(16px)",
  },
  legendaTitulo: {
    margin: "0 0 24px",
    fontSize: 18,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  legendaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 14,
  },
  legendaItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  legendaDot: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 3,
  },
  legendaName: {
    margin: "0 0 2px",
    fontWeight: 700,
    fontSize: 14,
  },
  legendaSubtext: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
  },
  footer: {
    textAlign: "center",
    padding: "24px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  footerText: {
    margin: 0,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.6,
  },
};
