import React, { useState, useEffect } from "react";

export default function RecrutamentoPage({
  styles,
  theme,
  usuarioLogado,
  isAdminOuDono,
  curriculos,
  buscarCurriculos,
  salvarCurriculo,
  deletarCurriculo,
  toggleContatadoCurriculo,
  curriculosCarregando,
  formatarDataHora,
  AppHeaderBar,
  AppModalNotificacao,
  atualizarCurriculo,
}) {
  const [textoColado, setTextoColado] = useState("");
  const [novoCurriculo, setNovoCurriculo] = useState({ nome: "", telefone: "", disponibilidade: "", data_envio: "", obs: "" });
  const [listaLote, setListaLote] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [dadosEdicao, setDadosEdicao] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [ocrLendo, setOcrLendo] = useState(false);
  const [imgDebug, setImgDebug] = useState(null);

  useEffect(() => {
    buscarCurriculos();
  }, []);
  const processarBloco = (texto) => {
    const t = texto.replace(/["]/g, "").replace(/\n/g, " ").replace(/\s+/g, " ");
    const stopPatterns = ["Tele[a-z]+", "Tete[a-z]+", "Dispon[a-z]+", "Lis[a-z]+", "Data", "CLata", "Cata", "Nome"].join("|");
    const buscarCampo = (labelRegex) => {
      const regex = new RegExp(`${labelRegex}\\s*[:=]?\\s*(.*?)(?=${stopPatterns}|$)`, "i");
      const match = t.match(regex);
      return (match && match[1]) ? match[1].trim().replace(/^[=\-\s:]+/, "").trim() : "";
    };

    let nome = buscarCampo("Nome");
    if (!nome) {
      const partes = t.split(new RegExp(stopPatterns, "i"));
      if (partes.length > 0) nome = partes[0].replace(/[.;:!,]+$/, "").trim();
    }
    if (nome) nome = nome.replace(/[.;:!,]+$/, "").trim();

    let telefone = buscarCampo("(?:Tele[a-z]+|Tete[a-z]+)");
    if (!telefone) {
      const telPadrao = t.match(/[T\dloI]{2,4}-?[T\dloI]{2,4}/i);
      if (telPadrao) telefone = telPadrao[0];
    }
    if (telefone) {
      telefone = telefone.replace(/[lI]/ig, "1").replace(/o/ig, "0").replace(/T/ig, "7");
      telefone = telefone.replace(/[^\d-]/g, "");
      if (telefone.length === 6 && !telefone.includes("-")) telefone = telefone.replace(/(\d{3})(\d{3})/, "$1-$2");
      else if (telefone.length === 7 && !telefone.includes("-")) telefone = telefone.replace(/(\d{3})(\d{4})/, "$1-$2");
    }

    const opcoesDisponibilidade = { "noite": "Noite", "manha": "Manhã", "manhã": "Manhã", "tarde": "Tarde", "total": "Total", "integral": "Total", "madrugada": "Madrugada" };
    let rawDisp = buscarCampo("(?:Dispon[a-z]+|Lis[a-z]+)");
    const textoParaDisp = rawDisp || t;
    const regexDisp = new RegExp(Object.keys(opcoesDisponibilidade).join("|"), "gi");
    const matchesDisp = textoParaDisp.match(regexDisp);
    let disponibilidade = "";
    if (matchesDisp) {
      const selecionadas = [...new Set(matchesDisp.map(m => opcoesDisponibilidade[m.toLowerCase()]))];
      disponibilidade = selecionadas.join(" e ");
    }

    let dataEnvio = buscarCampo("(?:Data|CLata|Cata)");
    if (!dataEnvio || !/\d/.test(dataEnvio)) {
      const matchData = t.match(/\d{1,2}[\/,]\d{1,2}[\/,]\d{2,4}\s+[T\dloI]{1,2}[\/:][T\dloI]{1,2}[\/:][T\dloI]{1,2}/i);
      if (matchData) dataEnvio = matchData[0];
    }
    if (dataEnvio) {
      dataEnvio = dataEnvio.trim().replace(/^[^\d]+/, "").trim();
      dataEnvio = dataEnvio.replace(/[lI]/g, "1").replace(/o/g, "0").replace(/T(?=\d)/g, "1").replace(/(\d{2}),(\d{2})/g, "$1/$2").replace(/(\d{2})\.(\d{2})/g, "$1/$2");
    }
    return { nome, telefone, disponibilidade, data_envio: dataEnvio, obs: "" };
  };

  const extrairDeTexto = (texto) => {
    const regexSeparador = /(?=Nome\s*[:=]?|Tele[a-z]+\s*[:=]?)/gi;
    const blocosRaw = texto.split(regexSeparador).filter(b => b.trim().length > 10);
    let resultados = [];
    let blocoAtual = "";
    blocosRaw.forEach(parte => {
      if (/^Nome/i.test(parte.trim()) || resultados.length === 0) {
        if (blocoAtual) resultados.push(processarBloco(blocoAtual));
        blocoAtual = parte;
      } else {
        blocoAtual += " " + parte;
      }
    });
    if (blocoAtual) resultados.push(processarBloco(blocoAtual));
    return resultados;
  };

  const handleExtrairEDados = (texto) => {
    setTextoColado(texto);
    const resultados = extrairDeTexto(texto);
    if (resultados.length > 1) {
      setListaLote(resultados);
      setNovoCurriculo({ nome: "", telefone: "", disponibilidade: "", data_envio: "", obs: "" });
    } else if (resultados.length === 1) {
      setNovoCurriculo(prev => ({ ...prev, ...resultados[0] }));
      setListaLote([]);
    }
  };

  const handlePasteImagem = async (e) => {
    const item = e.clipboardData.items[0];
    if (item?.type.includes("image")) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = async () => {
          const scale = 3;
          
          // Função interna para processar uma parte da imagem
          const processarParte = async (startX, width) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = width * scale;
            canvas.height = img.height * scale;
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, startX, 0, width, img.height, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const maxCanal = Math.max(data[i], data[i+1], data[i+2]);
              const val = maxCanal > 65 ? 0 : 255;
              data[i] = val; data[i+1] = val; data[i+2] = val;
            }
            ctx.putImageData(imageData, 0, 0);
            return canvas.toDataURL("image/png");
          };

          setOcrLendo(true);
          try {
            let textoFinal = "";
            let debugFinal = null;

            if (img.width > img.height * 1.5) {
              // Lado a lado: processa esquerda e depois direita
              const mid = img.width / 2;
              const b64Esq = await processarParte(0, mid);
              const b64Dir = await processarParte(mid, mid);
              
              const [resEsq, resDir] = await Promise.all([
                window.Tesseract.recognize(b64Esq, 'por'),
                window.Tesseract.recognize(b64Dir, 'por')
              ]);
              
              textoFinal = resEsq.data.text + "\n\n" + resDir.data.text;
              debugFinal = b64Esq; 
              
              // Processa cada metade separadamente e já joga no lote
              const dEsq = processarBloco(resEsq.data.text);
              const dDir = processarBloco(resDir.data.text);
              
              setListaLote([dEsq, dDir]);
              setTextoColado(textoFinal);
              setOcrLendo(false);
              setImgDebug(debugFinal);
              return; // Interrompe para não rodar o handleExtrairEDados padrão
            } else {
              // Único ou vertical
              const b64 = await processarParte(0, img.width);
              const res = await window.Tesseract.recognize(b64, 'por');
              textoFinal = res.data.text;
              debugFinal = b64;
            }

            setImgDebug(debugFinal);
            handleExtrairEDados(textoFinal);
          } catch (err) {
            console.error("Erro no OCR:", err);
            alert("❌ Erro ao ler imagem.");
          }
          setOcrLendo(false);
        };
      };
      reader.readAsDataURL(blob);
    }
  };

  const handleSalvar = async () => {
    if (!novoCurriculo.nome || !novoCurriculo.telefone) {
      return alert("⚠️ Por favor, preencha pelo menos Nome e Telefone.");
    }
    setSalvando(true);
    const sucesso = await salvarCurriculo(novoCurriculo);
    if (sucesso) {
      setNovoCurriculo({ nome: "", telefone: "", disponibilidade: "", data_envio: "", obs: "" });
      setTextoColado("");
    }
    setSalvando(false);
  };

  const handleSalvarItemLote = async (index) => {
    const item = listaLote[index];
    const sucesso = await salvarCurriculo(item);
    if (sucesso) {
      setListaLote(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSalvarTudoLote = async () => {
    const paraSalvar = listaLote.filter(item => {
      const telLimpo = item.telefone.replace(/[^\d]/g, "");
      const existe = curriculos.some(c => 
        c.nome.toLowerCase() === item.nome.toLowerCase() || 
        c.telefone.replace(/[^\d]/g, "") === telLimpo
      );
      return !existe;
    });

    if (paraSalvar.length === 0) {
      return alert("⚠️ Todos os currículos detectados já estão cadastrados!");
    }

    if (!window.confirm(`Deseja salvar os ${paraSalvar.length} novos currículos? (${listaLote.length - paraSalvar.length} duplicatas serão ignoradas)`)) return;
    
    setSalvando(true);
    for (const item of paraSalvar) {
      await salvarCurriculo(item);
    }
    setListaLote([]);
    setSalvando(false);
    alert(`✅ ${paraSalvar.length} currículos foram salvos!`);
  };

  const handleSalvarEdicao = async () => {
    setSalvando(true);
    const sucesso = await atualizarCurriculo(editandoId, dadosEdicao);
    if (sucesso) {
      setEditandoId(null);
      setDadosEdicao(null);
    }
    setSalvando(false);
  };

  const canManage = isAdminOuDono(usuarioLogado?.role) || usuarioLogado?.atribuicoes?.includes("gerente_rh") || usuarioLogado?.atribuicoes?.includes("resp_rh");

  return (
    <div style={styles.dashContainer}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .card-curr { background: ${theme.card2}; border: 1px solid ${theme.border}; padding: 20px; border-radius: 16px; transition: 0.3s; position: relative; overflow: hidden; }
        .card-curr:hover { border-color: #f97316; transform: translateY(-3px); box-shadow: 0 10px 20px -10px rgba(249, 115, 22, 0.2); }
        .btn-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; alignItems: center; justifyContent: center; cursor: pointer; border: none; transition: 0.2s; }
        .btn-icon:hover { transform: scale(1.1); }
      `}</style>
      <AppModalNotificacao />
      <AppHeaderBar />

      <div style={{ padding: "30px 40px", maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div>
            <h2 style={{ color: theme.text, margin: 0, fontWeight: "800", fontSize: "28px" }}>📝 Recrutamento</h2>
            <p style={{ color: theme.subtext, margin: "5px 0 0", fontSize: "14px" }}>Gerencie os currículos recebidos para a mecânica</p>
          </div>
          <button onClick={buscarCurriculos} style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "10px 20px" }}>
            🔄 Atualizar
          </button>
        </div>

        {canManage && (
          <div style={{ ...styles.whiteCard, marginBottom: "30px", borderLeft: "4px solid #f97316" }}>
            <div style={styles.cardHeader}><span style={{...styles.dot, background: "#f97316"}}></span> Novo Currículo</div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={styles.miniLabel}>COLE O TEXTO OU PRINT DO JOGO AQUI</label>
                <div style={{ position: "relative" }}>
                  <textarea 
                    style={{ ...styles.textarea, minHeight: "100px", fontSize: "12px", border: ocrLendo ? "2px solid #f97316" : styles.textarea.border }}
                    placeholder="Cole aqui o texto OU o PRINT do currículo para extração..."
                    value={textoColado}
                    onChange={(e) => handleExtrairEDados(e.target.value)}
                    onPaste={handlePasteImagem}
                  />
                  {ocrLendo && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "#f97316", fontWeight: "bold", fontSize: "14px", zIndex: 5 }}>
                      🔍 LENDO IMAGEM...
                    </div>
                  )}
                </div>
              </div>
              {listaLote.length > 0 ? (
                <div style={{ gridColumn: "span 2", animation: "fadeIn 0.3s ease-out" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", padding: "10px", background: "rgba(59, 130, 246, 0.1)", borderRadius: "8px", border: "1px solid #3b82f640" }}>
                    <span style={{ fontSize: "14px", color: "#3b82f6", fontWeight: "bold" }}>📦 {listaLote.length} currículos detectados no print!</span>
                    <button onClick={handleSalvarTudoLote} disabled={salvando} style={{ ...styles.btnPrimary, width: "auto", margin: 0, padding: "8px 15px", fontSize: "12px", background: "#3b82f6" }}>
                      📥 SALVAR TODOS
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {listaLote.map((item, idx) => {
                      const telLimpo = item.telefone.replace(/[^\d]/g, "");
                      const existe = curriculos.some(c => 
                        c.nome.toLowerCase() === item.nome.toLowerCase() || 
                        c.telefone.replace(/[^\d]/g, "") === telLimpo
                      );

                      return (
                        <div key={idx} style={{ 
                          display: "grid", 
                          gridTemplateColumns: "1.5fr 1fr 1fr 1.5fr 120px", 
                          gap: "10px", 
                          alignItems: "center", 
                          padding: "10px", 
                          background: existe ? "rgba(234, 179, 8, 0.05)" : "rgba(255,255,255,0.03)", 
                          borderRadius: "10px", 
                          border: existe ? "1px solid #eab30860" : `1px solid ${theme.border}`,
                          position: "relative"
                        }}>
                          {existe && (
                            <span style={{ position: "absolute", top: "-8px", right: "10px", background: "#eab308", color: "#000", fontSize: "9px", fontWeight: "900", padding: "2px 6px", borderRadius: "4px" }}>
                              ⚠️ JÁ CADASTRADO
                            </span>
                          )}
                          <input style={{ ...styles.input, fontSize: "12px", padding: "8px" }} value={item.nome} onChange={e => {
                            const nova = [...listaLote];
                            nova[idx].nome = e.target.value;
                            setListaLote(nova);
                          }} />
                          <input style={{ ...styles.input, fontSize: "12px", padding: "8px" }} value={item.telefone} onChange={e => {
                            const nova = [...listaLote];
                            nova[idx].telefone = e.target.value;
                            setListaLote(nova);
                          }} />
                          <input style={{ ...styles.input, fontSize: "12px", padding: "8px" }} value={item.disponibilidade} onChange={e => {
                            const nova = [...listaLote];
                            nova[idx].disponibilidade = e.target.value;
                            setListaLote(nova);
                          }} />
                          <input style={{ ...styles.input, fontSize: "12px", padding: "8px" }} value={item.data_envio} onChange={e => {
                            const nova = [...listaLote];
                            nova[idx].data_envio = e.target.value;
                            setListaLote(nova);
                          }} />
                          <div style={{ display: "flex", gap: "5px" }}>
                            <button onClick={() => handleSalvarItemLote(idx)} style={{ ...styles.btnPrimary, margin: 0, padding: "8px", background: "#22c55e", flex: 1 }}>✅</button>
                            <button onClick={() => setListaLote(prev => prev.filter((_, i) => i !== idx))} style={{ ...styles.btnPrimary, margin: 0, padding: "8px", background: "#444", flex: 1 }}>✖️</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button 
                    onClick={() => setListaLote([])} 
                    style={{ marginTop: "15px", background: "none", border: "none", color: theme.subtext, fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Cancelar modo lote e voltar ao manual
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={styles.miniLabel}>NOME</label>
                      <input 
                        style={styles.input} 
                        value={novoCurriculo.nome} 
                        onChange={e => setNovoCurriculo({...novoCurriculo, nome: e.target.value})}
                      />
                    </div>
                    <div>
                      <label style={styles.miniLabel}>TELEFONE</label>
                      <input 
                        style={styles.input} 
                        value={novoCurriculo.telefone} 
                        onChange={e => setNovoCurriculo({...novoCurriculo, telefone: e.target.value})}
                      />
                    </div>
                    <div>
                      <label style={styles.miniLabel}>DISPONIBILIDADE</label>
                      <input 
                        style={styles.input} 
                        value={novoCurriculo.disponibilidade} 
                        onChange={e => setNovoCurriculo({...novoCurriculo, disponibilidade: e.target.value})}
                      />
                    </div>
                    <div>
                      <label style={styles.miniLabel}>DATA/HORA ENVIO</label>
                      <input 
                        style={styles.input} 
                        placeholder="Ex: 14/05/2026 15:30"
                        value={novoCurriculo.data_envio} 
                        onChange={e => setNovoCurriculo({...novoCurriculo, data_envio: e.target.value})}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <button 
                        onClick={handleSalvar}
                        disabled={salvando}
                        style={{ ...styles.btnPrimary, marginTop: 0, background: "linear-gradient(135deg, #92400e, #f97316)" }}
                      >
                        {salvando ? "..." : "📥 SALVAR CURRÍCULO"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Visualização de Debug do OCR para o usuário entender o que o robô leu */}
            {imgDebug && (
              <div style={{ marginTop: "15px", padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
                <span style={{ fontSize: "10px", color: theme.subtext, display: "block", marginBottom: "5px" }}>COMO O ROBÔ LEU A IMAGEM (Apenas textos em preto são lidos):</span>
                <img src={imgDebug} alt="OCR Debug" style={{ maxWidth: "100%", maxHeight: "150px", border: `1px solid ${theme.border}`, objectFit: "contain", filter: "invert(1) grayscale(1) contrast(2)" }} />
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
          {curriculos.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px", color: theme.subtext }}>
              {curriculosCarregando ? "Carregando currículos..." : "Nenhum currículo cadastrado."}
            </div>
          ) : (
            curriculos.map(curr => (
              <div key={curr.id} className="card-curr">
                <div style={{ display: "flex", gap: "15px", alignItems: "flex-start" }}>
                  <div style={{ 
                    width: "60px", height: "60px", borderRadius: "14px", 
                    background: curr.contatado ? "#16a34a20" : "rgba(255,255,255,0.05)", 
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "24px", fontWeight: "800", color: curr.contatado ? "#22c55e" : theme.subtext,
                    border: `1px solid ${curr.contatado ? "#16a34a" : theme.border}`
                  }}>
                    {curr.nome.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    {editandoId === curr.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        <input style={{...styles.input, padding: "5px 10px", fontSize: "14px"}} value={dadosEdicao.nome} onChange={e => setDadosEdicao({...dadosEdicao, nome: e.target.value})} />
                        <input style={{...styles.input, padding: "5px 10px", fontSize: "12px", color: "#3b82f6"}} value={dadosEdicao.telefone} onChange={e => setDadosEdicao({...dadosEdicao, telefone: e.target.value})} />
                        <input style={{...styles.input, padding: "5px 10px", fontSize: "12px"}} value={dadosEdicao.disponibilidade} onChange={e => setDadosEdicao({...dadosEdicao, disponibilidade: e.target.value})} />
                        <input style={{...styles.input, padding: "5px 10px", fontSize: "12px"}} value={dadosEdicao.data_envio} onChange={e => setDadosEdicao({...dadosEdicao, data_envio: e.target.value})} />
                        <div style={{ display: "flex", gap: "5px", marginTop: "5px" }}>
                          <button onClick={handleSalvarEdicao} style={{ ...styles.btnPrimary, margin: 0, padding: "5px 10px", fontSize: "10px", width: "auto" }}>SALVAR</button>
                          <button onClick={() => setEditandoId(null)} style={{ ...styles.btnPrimary, margin: 0, padding: "5px 10px", fontSize: "10px", width: "auto", background: "#444" }}>CANCELAR</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 style={{ margin: 0, color: theme.text, fontSize: "18px" }}>{curr.nome}</h3>
                        <div style={{ fontSize: "13px", color: "#3b82f6", fontWeight: "700", marginTop: "4px" }}>📞 {curr.telefone}</div>
                        <div style={{ fontSize: "12px", color: theme.subtext, marginTop: "8px" }}>
                          <b>Disponibilidade:</b> {curr.disponibilidade || "Não informada"}
                        </div>
                        <div style={{ fontSize: "11px", color: theme.subtext, marginTop: "4px", opacity: 0.7 }}>
                          <b>Data do Envio (Jogo):</b> {curr.data_envio || "Não informada"}
                        </div>
                        <div style={{ fontSize: "10px", color: theme.subtext, marginTop: "2px", opacity: 0.5 }}>
                          <b>Registrado em:</b> {formatarDataHora(curr.criado_em)}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {canManage && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button 
                        className="btn-icon" 
                        title={curr.contatado ? "Marcar como não contatado" : "Marcar como contatado"}
                        onClick={() => toggleContatadoCurriculo(curr.id, curr.contatado)}
                        style={{ background: curr.contatado ? "#16a34a" : "#ca8a04", color: "#fff" }}
                      >
                        {curr.contatado ? "✅" : "📞"}
                      </button>
                      <button 
                        className="btn-icon" 
                        title="Editar currículo"
                        onClick={() => {
                          setEditandoId(curr.id);
                          setDadosEdicao({ ...curr });
                        }}
                        style={{ background: "#3b82f6", color: "#fff" }}
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn-icon" 
                        title="Excluir currículo"
                        onClick={() => deletarCurriculo(curr.id)}
                        style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef4444" }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
                
                {curr.contatado && (
                  <div style={{ 
                    position: "absolute", top: "10px", right: "-30px", 
                    background: "#16a34a", color: "#fff", fontSize: "10px", fontWeight: "900",
                    padding: "4px 30px", transform: "rotate(45deg)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                  }}>
                    CONTATADO
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
