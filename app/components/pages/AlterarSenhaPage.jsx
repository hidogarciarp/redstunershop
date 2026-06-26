import React from "react";

export default function AlterarSenhaPage({
  styles,
  novaSenhaInput,
  setNovaSenhaInput,
  atualizarSenhaNoBanco,
  usuarioLogado,
  setPaginaAtual,
}) {
  return (
    <>
      <style>{`@keyframes fadeLogin { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div style={styles.loginCentral}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)" }} />
        <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: "450px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: "350px", padding: "26px 35px 30px", borderRadius: "28px", background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", animation: "fadeLogin 0.4s ease" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}><span style={{ fontSize: "30px" }}>🔒</span></div>
            <h3 style={{ margin: "0 0 16px", color: "#fff", textAlign: "center", fontSize: "20px", fontWeight: "700" }}>Criar Nova Senha</h3>
            <p style={{ textAlign: "center", color: "#aaa", fontSize: "12px", margin: "0 0 16px" }}>Defina sua nova senha de acesso</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ ...styles.miniLabel, color: "#aaa" }}>NOVA SENHA (apenas números)</label>
                <input
                  style={{ ...styles.input, height: "44px", borderRadius: "10px", background: "#fff", color: "#222", fontWeight: "600", fontSize: "13px" }}
                  type="password"
                  placeholder="••••••••"
                  value={novaSenhaInput}
                  onChange={(e) => setNovaSenhaInput(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <button
                style={{ background: "#d32f2f", color: "#fff", border: "none", height: "48px", borderRadius: "12px", width: "100%", fontWeight: "700", cursor: "pointer", fontSize: "15px" }}
                onClick={async () => {
                  if (!/^\d+$/.test(novaSenhaInput)) { alert("⚠️ Apenas números!"); return; }
                  await atualizarSenhaNoBanco(usuarioLogado.id, novaSenhaInput);
                  alert("Senha alterada! Faça login novamente.");
                  setPaginaAtual("login");
                }}
              >
                SALVAR
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
