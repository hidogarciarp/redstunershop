import React from "react";

export default function LoginPage({
  idInputLogin,
  setIdInputLogin,
  senhaInputLogin,
  setSenhaInputLogin,
  realizarLogin,
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
      
      @keyframes fadeInLayout {
        0% { opacity: 0; filter: blur(5px); }
        100% { opacity: 1; filter: blur(0); }
      }
      @keyframes slideRight {
        0% { opacity: 0; transform: translateX(-30px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @keyframes slideLeft {
        0% { opacity: 0; transform: translateX(30px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      
      .premium-bg {
        min-height: 100vh;
        background-color: #0c0c0c;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        font-family: 'Inter', sans-serif;
        padding: 20px;
        overflow: hidden;
        animation: fadeInLayout 0.8s ease forwards;
      }
      /* Faint grid background */
      .premium-bg::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: 
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 40px 40px;
        pointer-events: none;
      }
      /* Subtle red glow left */
      .glow-left {
        position: absolute;
        left: -20vw;
        top: 10vh;
        width: 50vw;
        height: 80vh;
        background: radial-gradient(circle, rgba(180, 13, 13, 0.12) 0%, transparent 60%);
        filter: blur(80px);
        pointer-events: none;
      }
      
      .container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        max-width: 1100px;
        z-index: 10;
        gap: 60px;
      }
      
      @media (max-width: 900px) {
        .container {
          flex-direction: column;
          justify-content: center;
          text-align: center;
        }
        .left-col {
          align-items: center !important;
        }
        .hq-desc {
          text-align: center !important;
        }
        .badges-row {
          justify-content: center;
        }
      }
      
      /* Left Column */
      .left-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        animation: slideRight 1s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .subtitle {
        color: #f59e0b;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 5px;
        text-transform: uppercase;
        margin-bottom: 20px;
      }
      .hq-title {
        font-family: 'Orbitron', 'Inter', sans-serif;
        font-size: clamp(48px, 6vw, 72px);
        font-weight: 900;
        color: #fff;
        line-height: 1.05;
        margin: 0 0 24px 0;
        text-transform: uppercase;
        letter-spacing: -1px;
      }
      .hq-title span {
        display: block;
        color: #b40d0d;
      }
      .hq-desc {
        color: #9ca3af;
        font-size: 16px;
        line-height: 1.6;
        margin: 0 0 40px 0;
        max-width: 480px;
        text-align: left;
      }
      .badges-row {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
      .feat-badge {
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.25);
        background: rgba(245, 158, 11, 0.05);
        padding: 8px 20px;
        border-radius: 100px;
        font-size: 13px;
        font-weight: 600;
      }
      
      /* Right Column */
      .right-col {
        flex: 1;
        display: flex;
        justify-content: flex-end;
        animation: slideLeft 1.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .login-card {
        width: 100%;
        max-width: 420px;
        background: rgba(20, 20, 20, 0.7);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        padding: 40px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.8);
        position: relative;
        overflow: hidden;
      }
      .login-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        opacity: 0.5;
      }
      .card-inner {
        position: relative;
        z-index: 2;
      }
      .card-sub {
        color: #b40d0d;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 2px;
        display: block;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .card-title {
        color: #fff;
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 32px 0;
      }
      
      .input-group {
        margin-bottom: 24px;
      }
      .input-label {
        display: block;
        color: #9ca3af;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .sys-input {
        width: 100%;
        background: rgba(0,0,0,0.4) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-radius: 12px;
        padding: 16px 20px;
        color: #fff;
        font-size: 15px;
        outline: none;
        box-sizing: border-box;
        transition: all 0.3s ease;
      }
      .sys-input:focus {
        border-color: #b40d0d !important;
        background: rgba(0,0,0,0.6) !important;
        box-shadow: 0 0 0 4px rgba(180, 13, 13, 0.1);
      }
      .sys-input::placeholder {
        color: #4b5563;
      }
      
      .sys-button {
        width: 100%;
        background: linear-gradient(135deg, #b40d0d 0%, #b40d0d 100%);
        border: none;
        padding: 18px;
        border-radius: 12px;
        color: #fff;
        font-weight: 700;
        font-size: 15px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: 0 8px 30px rgba(180, 13, 13, 0.3);
      }
      .sys-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(180, 13, 13, 0.4);
        filter: brightness(1.1);
      }
      .sys-button:active {
        transform: translateY(0);
      }
      
      .card-foot {
        margin-top: 24px;
        text-align: center;
        color: #6b7280;
        font-size: 13px;
      }
      .card-foot strong {
        color: #9ca3af;
      }
      `
      }} />

      <div className="premium-bg">
        <div className="glow-left"></div>
        <div className="container">
          
          <div className="left-col">
            <div className="subtitle">PERFORMANCE GARAGE</div>
            <h1 className="hq-title">
              RED'S <span>TUNERSHOP</span>
            </h1>
            <p className="hq-desc">
              Controle de serviços com visual premium para oficina, estética automotiva e acompanhamento rápido de atendimentos.
            </p>

            <div className="badges-row">
              <div className="feat-badge">Turbo Design</div>
              <div className="feat-badge">Fluxo Rápido</div>
              <div className="feat-badge">Painel Inteligente</div>
            </div>
          </div>

          <div className="right-col">
            <div className="login-card">
              <div className="card-inner">
                <span className="card-sub">ACESSO RESTRITO</span>
                <h2 className="card-title">Sistema de Gestão Interno</h2>

                <div className="input-group">
                  <label className="input-label">PASSAPORTE (ID)</label>
                  <input
                    className="sys-input"
                    placeholder="1234"
                    value={idInputLogin}
                    onChange={(e) => setIdInputLogin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">SENHA</label>
                  <input
                    type="password"
                    className="sys-input"
                    placeholder="••••••••"
                    value={senhaInputLogin}
                    onChange={(e) => setSenhaInputLogin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (!idInputLogin || !senhaInputLogin) {
                          alert("Preencha todos os campos!");
                          return;
                        }
                        realizarLogin(idInputLogin, senhaInputLogin);
                      }
                    }}
                  />
                </div>

                <button
                  className="sys-button"
                  onClick={() => {
                    if (!idInputLogin || !senhaInputLogin) {
                      alert("Preencha todos os campos!");
                      return;
                    }
                    realizarLogin(idInputLogin, senhaInputLogin);
                  }}
                >
                  Acessar Sistema
                </button>

                <div className="card-foot">
                  Primeiro acesso? Use seu <strong>ID como senha</strong>.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
