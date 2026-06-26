import React from "react";
import { REGRAS_PRECOS, TABELA_PRECOS } from "../../utils/constants";

export default function DashboardPage({
  styles,
  theme,
  passaporte,
  setPassaporte,
  cliente,
  setCliente,
  nomeMecanico,
  autorizadoPor,
  setAutorizadoPor,
  camaleao1,
  setCamaleao1,
  camaleao2,
  setCamaleao2,
  camaleaoRodas,
  setCamaleaoRodas,
  quantidadeExtras,
  setQuantidadeExtras,
  fumaca,
  setFumaca,
  valorDigitadoEstetica,
  setValorDigitadoEstetica,
  formatarNumero,
  limparNumero,
  imagemPreview,
  handleFileChange,
  handlePasteEstetica,
  imagemPreview2,
  handleFileChange2,
  handlePasteEstetica2,
  kmGuincho,
  setKmGuincho,
  qtdReparos,
  setQtdReparos,
  qtdPneus,
  setQtdPneus,
  reportBugs,
  setReportBugs,
  nomeVeiculoBugs,
  setNomeVeiculoBugs,
  descricaoBug,
  setDescricaoBug,
  previewBugs,
  handleFileBugs,
  handlePasteBugs,
  tabelas,
  servicosSelecionados,
  setServicosSelecionados,
  userPodeFinancas,
  adicionarNovoQuadro,
  listaAvisos,
  avisoSendoEditado,
  setAvisoSendoEditado,
  confirmarEdicaoQuadro,
  apagarQuadro,
  formatarTextoAvisos,
  calcularTotal,
  enviarParaDiscord,
  historicoNitroRecente = [],
  formatarHorario,
  formatarDataHora,
  isDarkMode,
  blacklist = [],
}) {
  const banInfo = blacklist.find(b => String(b.passaporte) === String(passaporte));
  const isBanido = !!banInfo;
  return (
    <>
      <div style={styles.grid}>
        <section style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
          {/* INFORMAÇÕES DO CLIENTE */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Informações do Cliente
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "14px" }}>
              <div>
                <label style={styles.miniLabel}>Passaporte (ID)</label>
                {isBanido && (
                  <div style={{ 
                    background: "rgba(180,13,13,0.1)", 
                    border: "1px solid #b40d0d", 
                    borderRadius: "8px", 
                    padding: "8px", 
                    marginBottom: "8px",
                    fontSize: "11px"
                  }}>
                    <strong style={{ color: "#b40d0d", display: "block", marginBottom: "2px" }}>🚫 CLIENTE BANIDO</strong>
                    <span style={{ color: theme.text }}>{banInfo.motivo}</span>
                  </div>
                )}

                {historicoNitroRecente.length > 0 && (
                  <div style={{ 
                    position: "fixed",
                    top: "100px",
                    right: "30px",
                    zIndex: 9999,
                    width: "300px",
                    background: isDarkMode ? "rgba(10,10,10,0.98)" : "rgba(255,255,255,0.98)", 
                    border: `2px solid ${isDarkMode ? "#facc15" : "#b40d0d"}`, 
                    borderRadius: "16px", 
                    padding: "20px", 
                    boxShadow: isDarkMode ? "0 20px 40px rgba(0,0,0,0.8)" : "0 20px 40px rgba(0,0,0,0.15)",
                    backdropFilter: "blur(12px)",
                    fontSize: "13px",
                    color: theme.text,
                    animation: "fadeInRight 0.4s ease-out"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "15px" }}>
                      <span style={{ fontSize: "28px" }}>⚡</span>
                      <div>
                        <strong style={{ color: "#facc15", display: "block", fontSize: "15px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Nitro Recente</strong>
                        <span style={{ fontSize: "11px", color: theme.subtext }}>Últimas 12 horas de histórico</span>
                      </div>
                    </div>
                    
                    <div style={{ background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", borderRadius: "12px", padding: "14px", border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}` }}>
                      <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        {historicoNitroRecente.map((h, i) => (
                          <li key={i} style={{ fontWeight: "700", color: isDarkMode ? "#fff" : "#000", fontSize: "13px" }}>
                            {formatarDataHora(h)}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ marginTop: "18px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", background: "rgba(250,204,21,0.1)", borderRadius: "8px" }}>
                      <span style={{ fontSize: "14px" }}>⚠️</span>
                      <span style={{ fontSize: "10px", color: "#facc15", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Atenção às regras de venda!
                      </span>
                    </div>

                    <style>{`
                      @keyframes fadeInRight {
                        from { opacity: 0; transform: translateX(50px); }
                        to { opacity: 1; transform: translateX(0); }
                      }
                    `}</style>
                  </div>
                )}
                <input
                  style={{ ...styles.input, border: isBanido ? `2px solid #b40d0d` : styles.input.border }}
                  placeholder="1234"
                  type="text"
                  inputMode="numeric"
                  value={passaporte}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setPassaporte(v);
                  }}
                />
              </div>
              <div>
                <label style={styles.miniLabel}>Nome do Cliente</label>
                <input
                  style={styles.input}
                  placeholder="Nome"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value.replace(/[0-9]/g, ""))}
                />
              </div>
              <div>
                <label style={styles.miniLabel}>Mecânico</label>
                <input style={{ ...styles.input, opacity: 0.7 }} value={nomeMecanico} readOnly />
              </div>
              <div>
                <label style={styles.miniLabel}>Autorizado Por</label>
                <input
                  style={styles.input}
                  placeholder="(Opcional)"
                  value={autorizadoPor}
                  onChange={(e) => setAutorizadoPor(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* VALOR DO PAINEL IN-GAME */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Valor do Painel In-Game
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "15px" }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: theme.text }}>
                  <input type="checkbox" checked={camaleao1} onChange={(e) => setCamaleao1(e.target.checked)} />
                  🦎 Camaleão Primária
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: theme.text }}>
                  <input type="checkbox" checked={camaleao2} onChange={(e) => setCamaleao2(e.target.checked)} />
                  🦎 Camaleão Secundária
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: theme.text }}>
                  <input type="checkbox" checked={camaleaoRodas} onChange={(e) => setCamaleaoRodas(e.target.checked)} />
                  🦎 Camaleão Rodas
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: theme.text, fontWeight: "600" }}>
                  <span>Extras</span>
                  <select
                    value={quantidadeExtras}
                    onChange={(e) => setQuantidadeExtras(Number(e.target.value))}
                    style={{ background: theme.card2, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: "5px", padding: "2px 6px", outline: "none", cursor: "pointer" }}
                  >
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: theme.text }}>
                  <input type="checkbox" checked={fumaca} onChange={(e) => setFumaca(e.target.checked)} />
                  Fumaça
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: theme.green, fontWeight: "700" }}>R$</span>
                <input
                  style={styles.inputPrice}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatarNumero(valorDigitadoEstetica)}
                  onChange={(e) => setValorDigitadoEstetica(limparNumero(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* ESTÉTICA */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Extrato do Serviço
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>

              <div style={{ marginTop: "10px", padding: "12px", borderRadius: "10px", background: theme.card2, border: `1px solid ${theme.border}`, fontSize: "13px" }}>
              {(() => {
                  const rules = REGRAS_PRECOS.estetica;
                  const valorPainel = Number(valorDigitadoEstetica) || 0;
                  const somaExtrasPainel = quantidadeExtras * rules.painel_extra;
                  const valorExtrasFinal = quantidadeExtras * rules.valor_cliente_extra;
                  const valorFumacaPainel = fumaca ? rules.painel_fumaca : 0;
                  const valorFumacaFinal = fumaca ? rules.valor_cliente_fumaca : 0;
                  const qtdCamaleao = [camaleao1, camaleao2, camaleaoRodas].filter(Boolean).length;
                  const descontoCamaleao = qtdCamaleao * rules.painel_camaleao;

                  const todasPecas = Object.values(TABELA_PRECOS).flat();
                  const somaPainelPerformance = Object.keys(servicosSelecionados).reduce((acc, id) => {
                    if (!servicosSelecionados[id]) return acc;
                    const p = todasPecas.find((x) => x.id === id);
                    return acc + (p?.painel || 0);
                  }, 0);

                  // Itens de performance selecionados com seus preços ao cliente
                  const itensPerformance = Object.keys(servicosSelecionados)
                    .filter((id) => servicosSelecionados[id])
                    .map((id) => todasPecas.find((x) => x.id === id))
                    .filter(Boolean)
                    .filter((p) => p.preco > 0);

                  const valorBasePainel = Math.max(0, valorPainel - somaExtrasPainel - valorFumacaPainel - descontoCamaleao - somaPainelPerformance);
                  const valorEsteticaFinal = (valorBasePainel / rules.painel_referencia) * rules.valor_cliente_referencia;
                  const valorCamaleoes = qtdCamaleao * rules.valor_cliente_camaleao;
                  const totalEstetica = valorEsteticaFinal + valorCamaleoes + valorExtrasFinal + valorFumacaFinal;
                  const totalPerformance = itensPerformance.reduce((acc, p) => acc + p.preco, 0);

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>

                      {/* Performance */}
                      {itensPerformance.length > 0 && (
                        <>
                          <div style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
                            ⚙️ Performance
                          </div>
                          {itensPerformance.map((p) => (
                            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                              <span style={{ color: theme.text }}>
                                {p.nome}
                                {p.painel > 0 && (
                                  <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px" }}>
                                    (-R$ {p.painel.toLocaleString("pt-BR")})
                                  </span>
                                )}
                              </span>
                              <b style={{ color: theme.green }}>R$ {p.preco.toLocaleString("pt-BR")}</b>
                            </div>
                          ))}
                          <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: "2px", paddingTop: "4px", display: "flex", justifyContent: "space-between", fontWeight: "700", color: theme.subtext, fontSize: "12px" }}>
                            <span>
                              Subtotal Performance
                              {somaPainelPerformance > 0 && (
                                <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                                  (-R$ {somaPainelPerformance.toLocaleString("pt-BR")})
                                </span>
                              )}
                            </span>
                            <span>R$ {totalPerformance.toLocaleString("pt-BR")}</span>
                          </div>
                          <div style={{ height: "6px" }} />
                        </>
                      )}

                      {/* Estética */}
                      <div style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
                        🎨 Estética
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                        <span>
                          Estética base
                          {valorBasePainel > 0 && (
                            <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                              (-R$ {valorBasePainel.toLocaleString("pt-BR")})
                            </span>
                          )}
                        </span>
                        <b>R$ {valorEsteticaFinal.toLocaleString("pt-BR")}</b>
                      </div>
                      {valorCamaleoes > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                          <span>
                            🦎 Camaleão ({[camaleao1 && "Primária", camaleao2 && "Secundária", camaleaoRodas && "Rodas"].filter(Boolean).join(", ")})
                            <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                              (-R$ {descontoCamaleao.toLocaleString("pt-BR")})
                            </span>
                          </span>
                          <b>R$ {valorCamaleoes.toLocaleString("pt-BR")}</b>
                        </div>
                      )}
                      {valorExtrasFinal > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                          <span>
                            ✨ Extras ({quantidadeExtras}x)
                            <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                              (-R$ {somaExtrasPainel.toLocaleString("pt-BR")})
                            </span>
                          </span>
                          <b>R$ {valorExtrasFinal.toLocaleString("pt-BR")}</b>
                        </div>
                      )}
                      {valorFumacaFinal > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                          <span>
                            💨 Fumaça
                            <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                              (-R$ {valorFumacaPainel.toLocaleString("pt-BR")})
                            </span>
                          </span>
                          <b>R$ {valorFumacaFinal.toLocaleString("pt-BR")}</b>
                        </div>
                      )}

                      {/* Guincho / Atendimento */}
                      {(() => {
                        const km = Number(kmGuincho) || 0;
                        const custoGuincho = km > 0 ? REGRAS_PRECOS.guincho.valor_fixo + Math.ceil(km) * REGRAS_PRECOS.guincho.valor_km : 0;
                        const custoReparos = Number(qtdReparos) * REGRAS_PRECOS.guincho.valor_reparo;
                        const custoPneus = Number(qtdPneus) * REGRAS_PRECOS.guincho.valor_pneu;
                        const totalAtendimento = custoGuincho + custoReparos + custoPneus;
                        if (totalAtendimento === 0) return null;
                        return (
                          <>
                            <div style={{ height: "4px" }} />
                            <div style={{ fontSize: "11px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
                              🚐 Atendimento
                            </div>
                            {custoGuincho > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                                <span>Guincho ({km} km)</span>
                                <b>R$ {custoGuincho.toLocaleString("pt-BR")}</b>
                              </div>
                            )}
                            {custoReparos > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                                <span>Kit Reparo ({qtdReparos}x)</span>
                                <b>R$ {custoReparos.toLocaleString("pt-BR")}</b>
                              </div>
                            )}
                            {custoPneus > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px" }}>
                                <span>Pneus ({qtdPneus}x)</span>
                                <b>R$ {custoPneus.toLocaleString("pt-BR")}</b>
                              </div>
                            )}
                            <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: "2px", paddingTop: "4px", display: "flex", justifyContent: "space-between", fontWeight: "700", color: theme.subtext, fontSize: "12px" }}>
                              <span>Subtotal Atendimento</span>
                              <span>R$ {totalAtendimento.toLocaleString("pt-BR")}</span>
                            </div>
                          </>
                        );
                      })()}

                      {/* Subtotal Estética */}
                      <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: "4px", paddingTop: "6px", display: "flex", justifyContent: "space-between", fontWeight: "700", color: theme.subtext, fontSize: "12px" }}>
                        <span>
                          Subtotal Estética
                          {valorPainel > 0 && Math.max(0, valorPainel - somaPainelPerformance) > 0 && (
                            <span style={{ color: theme.subtext, fontSize: "11px", marginLeft: "5px", fontWeight: "normal" }}>
                              (-R$ {Math.max(0, valorPainel - somaPainelPerformance).toLocaleString("pt-BR")})
                            </span>
                          )}
                        </span>
                        <span>R$ {totalEstetica.toLocaleString("pt-BR")}</span>
                      </div>

                      {/* Total Geral */}
                      <div style={{ borderTop: `2px solid ${theme.accent}`, marginTop: "4px", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontWeight: "800", fontSize: "15px", color: theme.accent }}>
                        <span>Total Geral</span>
                        <span>R$ {calcularTotal().toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={{ ...styles.uploadArea, outline: "none" }} tabIndex={0} onPaste={handlePasteEstetica}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px", display: "block" }}>📸 Foto do VTuning / Referência</span>
                  {imagemPreview && (
                    <>
                      <img src={imagemPreview} alt="preview" style={{ borderRadius: "12px", maxHeight: "230px", maxWidth: "100%" }} />
                      <p style={{ color: theme.green, fontWeight: "700", margin: 0, fontSize: "13px" }}>✅ Imagem pronta!</p>
                    </>
                  )}
                  <label style={styles.uploadBtnLabel}>
                    {imagemPreview ? "🔄 Trocar imagem" : "📂 Clique ou COLE (Ctrl+V) o print"}
                    <input type="file" accept="image/*" hidden onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              <div style={{ ...styles.uploadArea, outline: "none", borderColor: imagemPreview2 ? theme.green : theme.border }} tabIndex={0} onPaste={handlePasteEstetica2}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: theme.subtext, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px", display: "block" }}>🚗 Foto do Resultado / Carro do Cliente <span style={{ color: theme.subtext, fontWeight: "400", textTransform: "none", fontSize: "10px" }}>(opcional)</span></span>
                  {imagemPreview2 && (
                    <>
                      <img src={imagemPreview2} alt="preview resultado" style={{ borderRadius: "12px", maxHeight: "230px", maxWidth: "100%" }} />
                      <p style={{ color: theme.green, fontWeight: "700", margin: 0, fontSize: "13px" }}>✅ Foto do resultado pronta!</p>
                    </>
                  )}
                  <label style={{ ...styles.uploadBtnLabel, background: imagemPreview2 ? "rgba(43,255,0,0.08)" : undefined, borderColor: imagemPreview2 ? theme.green : undefined }}>
                    {imagemPreview2 ? "🔄 Trocar foto do resultado" : "📂 Clique ou COLE (Ctrl+V) o resultado"}
                    <input type="file" accept="image/*" hidden onChange={handleFileChange2} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* GUINCHO */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Guincho / Atendimento
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
              <div>
                <label style={styles.miniLabel}>Distância (KM)</label>
                <input
                  style={styles.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 5"
                  value={formatarNumero(kmGuincho)}
                  onChange={(e) => setKmGuincho(limparNumero(e.target.value))}
                />
              </div>
              <div>
                <label style={styles.miniLabel}>Kit Reparo</label>
                <input
                  style={styles.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatarNumero(qtdReparos)}
                  onChange={(e) => setQtdReparos(limparNumero(e.target.value))}
                />
              </div>
              <div>
                <label style={styles.miniLabel}>Pneus</label>
                <input
                  style={styles.input}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatarNumero(qtdPneus)}
                  onChange={(e) => setQtdPneus(limparNumero(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* REPORTAR BUG */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Reportar Bug
            </div>
            <label style={{ cursor: "pointer", color: theme.text, display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
              <input type="checkbox" checked={reportBugs} onChange={(e) => setReportBugs(e.target.checked)} />
              Fazer um Report de Bug
            </label>
            {reportBugs && (
              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={styles.miniLabel}>Nome do Veículo</label>
                  <input
                    style={styles.input}
                    placeholder="Ex: Sultan RS"
                    value={nomeVeiculoBugs}
                    onChange={(e) => setNomeVeiculoBugs(e.target.value)}
                  />
                </div>
                <div>
                  <label style={styles.miniLabel}>Descrição do Bug</label>
                  <textarea
                    style={styles.textarea}
                    placeholder="Descreva o problema com detalhes..."
                    value={descricaoBug}
                    onChange={(e) => setDescricaoBug(e.target.value)}
                  />
                </div>
                <div style={{ ...styles.uploadArea, outline: "none" }} tabIndex={0} onPaste={handlePasteBugs}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    {previewBugs && (
                      <>
                        <img src={previewBugs} alt="bug" style={{ borderRadius: "8px", maxHeight: "120px" }} />
                        <p style={{ color: theme.green, fontWeight: "700", margin: 0, fontSize: "12px" }}>✅ Pronta!</p>
                      </>
                    )}
                    <label style={styles.uploadBtnLabel}>
                      {previewBugs ? "🔄 Trocar ou COLE (Ctrl+V)" : "📂 Enviar print ou COLE (Ctrl+V)"}
                      <input type="file" accept="image/*" hidden onChange={handleFileBugs} />
                    </label>
                  </div>
                </div>
                <small style={{ color: theme.subtext }}>⚠️ Solicite o nome na garagem</small>
              </div>
            )}
          </div>



          {/* PERFORMANCE */}
          <div style={styles.whiteCard}>
            <div style={styles.cardHeader}>
              <span style={styles.dot}></span> Performance
            </div>
            <div style={styles.performanceGrid}>
              {["Motor", "Freios", "Transmissão", "Suspensão", "Blindagem", "Outros"].map((cat) => (
                <div key={cat}>
                  <p style={{ ...styles.miniLabel, color: theme.accent }}>{cat.toUpperCase()}</p>
                  {tabelas[cat].map((item) => (
                    <div key={item.id} style={styles.itemRow}>
                      <label style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer", fontSize: "13px" }}>
                        <input
                          type="checkbox"
                          checked={!!servicosSelecionados[item.id]}
                          onChange={() => {
                            setServicosSelecionados((p) => {
                              const next = { ...p };
                              if (cat === "Outros") {
                                if (next[item.id]) delete next[item.id];
                                else next[item.id] = true;
                              } else {
                                if (next[item.id]) {
                                  delete next[item.id];
                                } else {
                                  tabelas[cat].forEach((i) => delete next[i.id]);
                                  next[item.id] = true;
                                }
                              }
                              return next;
                            });
                          }}
                        />
                        {item.nome}
                      </label>
                      <span style={{ fontSize: "11px", color: theme.green, fontWeight: "700" }}>R$ {item.preco.toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ASIDE */}
        <aside style={{ width: "250px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          {userPodeFinancas() && (
            <button
              onClick={adicionarNovoQuadro}
              style={{
                background: theme.card2,
                border: `1px dashed ${theme.border}`,
                color: theme.text,
                padding: "10px",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "bold",
                width: "100%",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={(e) => (e.target.style.background = theme.card2)}
            >
              ➕ Adicionar Novo Quadro
            </button>
          )}

          {listaAvisos.map((aviso) => {
            const isEditando = avisoSendoEditado?.id === aviso.id;
            return (
              <div key={aviso.id} style={{ ...styles.whiteCard, padding: "14px", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  {isEditando ? (
                    <input
                      value={avisoSendoEditado.titulo}
                      onChange={(e) => setAvisoSendoEditado({ ...avisoSendoEditado, titulo: e.target.value })}
                      style={{ ...styles.input, width: "100%", padding: "4px 8px", fontSize: "13px", color: "#facc15", fontWeight: "bold", marginBottom: "6px" }}
                      placeholder="Título"
                    />
                  ) : (
                    <div style={{ ...styles.cardHeader, color: "#facc15", fontSize: "14px", marginBottom: "0", lineHeight: "1.2", flex: 1, wordWrap: "break-word" }}>
                      {aviso.titulo}
                    </div>
                  )}

                  {userPodeFinancas() && !isEditando && (
                    <button
                      style={{ background: "transparent", border: "none", color: theme.subtext, cursor: "pointer", fontSize: "12px", padding: "2px", marginLeft: "8px" }}
                      onClick={() => setAvisoSendoEditado({ ...aviso })}
                      title="Editar Quadro"
                    >
                      ✏️
                    </button>
                  )}
                </div>

                {isEditando ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <textarea
                      value={avisoSendoEditado.texto}
                      onChange={(e) => setAvisoSendoEditado({ ...avisoSendoEditado, texto: e.target.value })}
                      style={{ width: "100%", height: "200px", padding: "8px", borderRadius: "8px", background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, fontSize: "12px", resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        style={{ flex: 1, background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#fff", border: "none", padding: "6px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "11px" }}
                        onClick={confirmarEdicaoQuadro}
                      >
                        💾 Salvar
                      </button>
                      <button
                        style={{ flex: 1, background: "transparent", border: `1px solid ${theme.border}`, color: theme.text, padding: "6px", borderRadius: "6px", cursor: "pointer", fontSize: "11px" }}
                        onClick={() => setAvisoSendoEditado(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                    <button
                      style={{ background: "#7f1d1d", color: "#fff", border: "none", padding: "4px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "10px", marginTop: "4px" }}
                      onClick={() => apagarQuadro(aviso.id)}
                    >
                      🗑️ Deletar Quadro
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: "12px", color: theme.subtext, margin: "0", lineHeight: "1.5" }}>{formatarTextoAvisos(aviso.texto)}</p>
                )}
              </div>
            );
          })}
        </aside>
      </div>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <div>
          <small style={{ color: theme.subtext, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>💰 Valor Total do Serviço</small>
          <br />
          <b style={{ color: theme.accent, fontSize: "24px", fontWeight: "800" }}>R$ {calcularTotal().toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b>
        </div>
        <button onClick={enviarParaDiscord} style={styles.btnRegister}>
          Registrar Serviço →
        </button>
      </footer>
    </>
  );
}
