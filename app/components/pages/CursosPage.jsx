/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from "react";
import { CURSOS_OBRIGATORIOS } from "../../utils/constants";

export default function CursosPage({
  supabase,
  styles,
  theme,
  usuarioLogado,
  listaFuncionarios,
  buscarListaFuncionarios,
  concluirCurso,
  alterarCursoFuncionario,
  podeGerenciarCursos,
  elegibilidadeTunagem,
  formatarHoras,
  getLabelCargo,
}) {
  const [cursos, setCursos] = useState(CURSOS_OBRIGATORIOS);
  const [cursosCarregando, setCursosCarregando] = useState(false);
  const [salvandoCursos, setSalvandoCursos] = useState(false);
  const [editorCursosAberto, setEditorCursosAberto] = useState(false);
  const [jsonCursos, setJsonCursos] = useState("");
  const [modoEdicaoCursos, setModoEdicaoCursos] = useState(false);
  const [snapshotCursos, setSnapshotCursos] = useState("");
  const [cursoAtivo, setCursoAtivo] = useState(CURSOS_OBRIGATORIOS[0]?.id || "estagiario");
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState("");
  const [buscaFuncionarioId, setBuscaFuncionarioId] = useState("");
  const [respostasSimulado, setRespostasSimulado] = useState({});
  const [resultadoSimulado, setResultadoSimulado] = useState(null);
  const [cenarioPraticaId, setCenarioPraticaId] = useState("");
  const [pecasPratica, setPecasPratica] = useState({});
  const [resultadoPratica, setResultadoPratica] = useState(null);
  const [cenarioEsteticaId, setCenarioEsteticaId] = useState("");
  const [registroEstetica, setRegistroEstetica] = useState({
    valorPainel: "",
    quantidadeExtras: 0,
    fumaca: false,
    camaleao1: false,
    camaleao2: false,
    camaleaoRodas: false,
  });
  const [resultadoEstetica, setResultadoEstetica] = useState(null);
  const cursoConcluido = (curso) => Boolean(usuarioLogado?.[curso.campo] || usuarioLogado?.cursos_concluidos?.[curso.id]);
  const cursoTunagem = cursos.find((curso) => curso.id === "tunagem");
  const tunagemVisivel = Boolean(
    elegibilidadeTunagem?.liberado ||
    (cursoTunagem && cursoConcluido(cursoTunagem)) ||
    podeGerenciarCursos
  );
  const cursosVisiveis = cursos.filter((curso) => curso.id !== "tunagem" || tunagemVisivel);
  const cursoSelecionado = cursosVisiveis.find((curso) => curso.id === cursoAtivo) || cursosVisiveis[0];
  const funcionario = listaFuncionarios.find((item) => String(item.id) === String(funcionarioSelecionado));
  const funcionariosFiltrados = buscaFuncionarioId.trim()
    ? listaFuncionarios.filter((item) => String(item.id).includes(buscaFuncionarioId.trim()))
    : listaFuncionarios;

  const statusCurso = cursoConcluido(cursoSelecionado);
  const exigeLiberacaoRh = cursoSelecionado.id === "tunagem";
  const praticaObrigatoriaPendente = (
    (Boolean(cursoSelecionado.praticaDashboard) && !resultadoPratica?.aprovado) ||
    (Boolean(cursoSelecionado.praticaEstetica) && !resultadoEstetica?.aprovado)
  );
  const aprovadoNoSimulado = statusCurso || Boolean(resultadoSimulado?.aprovado);
  const existemAlteracoesCursos = modoEdicaoCursos && snapshotCursos && JSON.stringify(cursos) !== snapshotCursos;

  const sincronizarJsonCursos = (lista) => {
    setJsonCursos(JSON.stringify(lista, null, 2));
  };

  const carregarCursos = async () => {
    if (!supabase) return;
    setCursosCarregando(true);
    const { data, error } = await supabase
      .from("curso_configuracoes")
      .select("conteudo")
      .eq("id", 1)
      .maybeSingle();
    if (!error && Array.isArray(data?.conteudo) && data.conteudo.length > 0) {
      setCursos(data.conteudo);
      sincronizarJsonCursos(data.conteudo);
      setSnapshotCursos(JSON.stringify(data.conteudo));
    } else {
      sincronizarJsonCursos(CURSOS_OBRIGATORIOS);
      setSnapshotCursos(JSON.stringify(CURSOS_OBRIGATORIOS));
    }
    setCursosCarregando(false);
  };

  const validarCursos = (lista) => {
    if (!Array.isArray(lista) || lista.length === 0) return "Cadastre pelo menos um curso.";
    const ids = new Set();
    for (const curso of lista) {
      if (!curso.id || !curso.titulo || !curso.campo) return "Todo curso precisa de id, titulo e campo.";
      if (ids.has(curso.id)) return `Curso duplicado: ${curso.id}`;
      ids.add(curso.id);
      if (!Array.isArray(curso.modulos)) return `O curso ${curso.titulo} precisa ter modulos em formato de lista.`;
      for (const modulo of curso.modulos) {
        if (!modulo.id || !modulo.titulo) return `Todo módulo do curso ${curso.titulo} precisa de id e titulo.`;
      }
      for (const pratica of [curso.praticaDashboard, curso.praticaEstetica].filter(Boolean)) {
        if (!pratica.titulo) return `Uma prática do curso ${curso.titulo} está sem título.`;
        if (!Array.isArray(pratica.cenarios)) return `Os cenários da prática ${pratica.titulo} precisam estar em formato de lista.`;
        for (const cenario of pratica.cenarios) {
          if (!cenario.id || !cenario.veiculo) return `Todo cenário da prática ${pratica.titulo} precisa de id e veículo/cenário.`;
        }
      }
      if (curso.simulado && !Array.isArray(curso.simulado)) return `O simulado de ${curso.titulo} precisa ser uma lista.`;
      for (const pergunta of curso.simulado || []) {
        if (!pergunta.id || !pergunta.pergunta || !Array.isArray(pergunta.opcoes) || pergunta.opcoes.length < 2) {
          return `Pergunta inválida no curso ${curso.titulo}.`;
        }
        if (pergunta.correta === undefined || pergunta.correta < 0 || pergunta.correta >= pergunta.opcoes.length) {
          return `Alternativa correta inválida em ${pergunta.pergunta}.`;
        }
      }
    }
    return null;
  };

  const salvarCursos = async (lista) => {
    const erroValidacao = validarCursos(lista);
    if (erroValidacao) {
      alert(`⚠️ ${erroValidacao}`);
      return false;
    }
    if (!supabase) {
      alert("⚠️ Banco de dados indisponível para salvar os cursos.");
      return false;
    }
    setSalvandoCursos(true);
    const { error } = await supabase.from("curso_configuracoes").upsert({
      id: 1,
      conteudo: lista,
      atualizado_em: new Date().toISOString(),
      atualizado_por: usuarioLogado?.id || null,
    });
    setSalvandoCursos(false);
    if (error) {
      alert("❌ Erro ao salvar cursos: " + error.message);
      return false;
    }
    setCursos(lista);
    sincronizarJsonCursos(lista);
    setSnapshotCursos(JSON.stringify(lista));
    alert("✅ Cursos atualizados com sucesso.");
    return true;
  };

  const salvarJsonCursos = async () => {
    try {
      const parsed = JSON.parse(jsonCursos);
      const salvou = await salvarCursos(parsed);
      if (salvou) {
        setModoEdicaoCursos(false);
        setEditorCursosAberto(false);
      }
    } catch {
      alert("⚠️ JSON inválido. Confira vírgulas, aspas e colchetes.");
    }
  };

  const entrarEdicaoCursos = () => {
    setSnapshotCursos(JSON.stringify(cursos));
    setModoEdicaoCursos(true);
  };

  const descartarEdicaoCursos = () => {
    if (existemAlteracoesCursos && !window.confirm("Descartar alterações não salvas?")) return false;
    if (snapshotCursos) {
      const cursosOriginais = JSON.parse(snapshotCursos);
      setCursos(cursosOriginais);
      sincronizarJsonCursos(cursosOriginais);
    }
    setModoEdicaoCursos(false);
    setEditorCursosAberto(false);
    return true;
  };

  const salvarEdicaoCursos = async () => {
    const salvou = await salvarCursos(cursos);
    if (salvou) {
      setModoEdicaoCursos(false);
      setEditorCursosAberto(false);
    }
  };

  const selecionarCurso = (cursoId) => {
    if (modoEdicaoCursos && cursoId !== cursoAtivo && !descartarEdicaoCursos()) return;
    setCursoAtivo(cursoId);
  };

  const atualizarCursosLocal = (updater) => {
    const novaLista = updater(cursos);
    setCursos(novaLista);
    sincronizarJsonCursos(novaLista);
    return novaLista;
  };

  const moverCurso = (id, direcao) => {
    atualizarCursosLocal((lista) => {
      const index = lista.findIndex((curso) => curso.id === id);
      const alvo = index + direcao;
      if (index < 0 || alvo < 0 || alvo >= lista.length) return lista;
      const copia = [...lista];
      [copia[index], copia[alvo]] = [copia[alvo], copia[index]];
      return copia;
    });
  };

  const adicionarCurso = () => {
    const id = `curso-${Date.now()}`;
    atualizarCursosLocal((lista) => [
      ...lista,
      {
        id,
        titulo: "Novo Curso",
        subtitulo: "Descreva a liberação deste curso.",
        campo: `${id.replace(/-/g, "_")}_concluido`,
        cor: "#b40d0d",
        simuladoMinimo: 70,
        modulos: [],
        simulado: [],
      },
    ]);
    setCursoAtivo(id);
  };

  const excluirCurso = (id) => {
    if (!window.confirm("Excluir este curso e todo o conteúdo vinculado?")) return;
    atualizarCursosLocal((lista) => lista.filter((curso) => curso.id !== id));
    if (cursoAtivo === id) setCursoAtivo("estagiario");
  };

  const duplicarCurso = (curso) => {
    const id = `${curso.id}-copia-${Date.now()}`;
    const clone = JSON.parse(JSON.stringify({ ...curso, id, titulo: `${curso.titulo} cópia` }));
    atualizarCursosLocal((lista) => [...lista, clone]);
    setCursoAtivo(id);
  };

  const extrairYoutubeId = (valor = "") => {
    const texto = String(valor).trim();
    if (!texto) return "";
    const match = texto.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return match?.[1] || texto;
  };

  const atualizarCursoSelecionado = (updater) => {
    if (!cursoSelecionado) return;
    atualizarCursosLocal((lista) => lista.map((curso) => (
      curso.id === cursoSelecionado.id ? updater({ ...curso }) : curso
    )));
  };

  const alterarCursoCampo = (campo, valor) => {
    atualizarCursoSelecionado((curso) => ({ ...curso, [campo]: valor }));
  };

  const adicionarModulo = () => {
    const id = `modulo-${Date.now()}`;
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      modulos: [
        ...(curso.modulos || []),
        { id, titulo: "Novo módulo", descricao: "", youtubeId: "", topicos: [] },
      ],
    }));
  };

  const atualizarModulo = (moduloId, campo, valor) => {
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      modulos: (curso.modulos || []).map((modulo) => (
        modulo.id === moduloId ? { ...modulo, [campo]: campo === "youtubeId" ? extrairYoutubeId(valor) : valor } : modulo
      )),
    }));
  };

  const atualizarTopicosModulo = (moduloId, valor) => {
    const topicos = valor.split("\n").map((item) => item.trim()).filter(Boolean);
    atualizarModulo(moduloId, "topicos", topicos);
  };

  const moverModulo = (moduloId, direcao) => {
    atualizarCursoSelecionado((curso) => {
      const modulos = [...(curso.modulos || [])];
      const index = modulos.findIndex((modulo) => modulo.id === moduloId);
      const alvo = index + direcao;
      if (index < 0 || alvo < 0 || alvo >= modulos.length) return curso;
      [modulos[index], modulos[alvo]] = [modulos[alvo], modulos[index]];
      return { ...curso, modulos };
    });
  };

  const excluirModulo = (moduloId) => {
    if (!window.confirm("Excluir este módulo?")) return;
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      modulos: (curso.modulos || []).filter((modulo) => modulo.id !== moduloId),
    }));
  };

  const adicionarPergunta = () => {
    const id = `pergunta-${Date.now()}`;
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      simulado: [
        ...(curso.simulado || []),
        { id, pergunta: "Nova pergunta", opcoes: ["Alternativa A", "Alternativa B"], correta: 0 },
      ],
    }));
  };

  const atualizarPergunta = (perguntaId, campo, valor) => {
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      simulado: (curso.simulado || []).map((pergunta) => (
        pergunta.id === perguntaId ? { ...pergunta, [campo]: valor } : pergunta
      )),
    }));
  };

  const atualizarOpcoesPergunta = (perguntaId, valor) => {
    const opcoes = valor.split("\n").map((item) => item.trim()).filter(Boolean);
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      simulado: (curso.simulado || []).map((pergunta) => {
        if (pergunta.id !== perguntaId) return pergunta;
        return {
          ...pergunta,
          opcoes,
          correta: Math.min(Number(pergunta.correta) || 0, Math.max(opcoes.length - 1, 0)),
        };
      }),
    }));
  };

  const moverPergunta = (perguntaId, direcao) => {
    atualizarCursoSelecionado((curso) => {
      const simulado = [...(curso.simulado || [])];
      const index = simulado.findIndex((pergunta) => pergunta.id === perguntaId);
      const alvo = index + direcao;
      if (index < 0 || alvo < 0 || alvo >= simulado.length) return curso;
      [simulado[index], simulado[alvo]] = [simulado[alvo], simulado[index]];
      return { ...curso, simulado };
    });
  };

  const excluirPergunta = (perguntaId) => {
    if (!window.confirm("Excluir esta pergunta?")) return;
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      simulado: (curso.simulado || []).filter((pergunta) => pergunta.id !== perguntaId),
    }));
  };

  const alterarPratica = (tipo, campo, valor) => {
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      [tipo]: {
        ...(curso[tipo] || { titulo: "", descricao: "", cenarios: [] }),
        [campo]: valor,
      },
    }));
  };

  const adicionarCenarioDashboard = () => {
    const id = `dashboard-${Date.now()}`;
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      praticaDashboard: {
        ...(curso.praticaDashboard || { titulo: "Prática de preenchimento da Dashboard", descricao: "", cenarios: [] }),
        cenarios: [
          ...(curso.praticaDashboard?.cenarios || []),
          { id, veiculo: "Novo veículo", contexto: "", disponiveis: [], corretas: [] },
        ],
      },
    }));
  };

  const atualizarCenarioDashboard = (cenarioId, campo, valor) => {
    const lista = campo === "disponiveis" || campo === "corretas"
      ? valor.split(",").map((item) => item.trim()).filter(Boolean)
      : valor;
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      praticaDashboard: {
        ...(curso.praticaDashboard || { titulo: "", descricao: "", cenarios: [] }),
        cenarios: (curso.praticaDashboard?.cenarios || []).map((cenario) => (
          cenario.id === cenarioId ? { ...cenario, [campo]: lista } : cenario
        )),
      },
    }));
  };

  const excluirCenarioDashboard = (cenarioId) => {
    if (!window.confirm("Excluir este cenário de tunagem?")) return;
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      praticaDashboard: {
        ...(curso.praticaDashboard || { titulo: "", descricao: "", cenarios: [] }),
        cenarios: (curso.praticaDashboard?.cenarios || []).filter((cenario) => cenario.id !== cenarioId),
      },
    }));
  };

  const adicionarCenarioEstetica = () => {
    const id = `estetica-${Date.now()}`;
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      praticaEstetica: {
        ...(curso.praticaEstetica || { titulo: "Prática de Registro de Estética", descricao: "", cenarios: [] }),
        cenarios: [
          ...(curso.praticaEstetica?.cenarios || []),
          {
            id,
            veiculo: "Novo cenário",
            contexto: "",
            dica: "",
            correto: { valorPainel: 0, quantidadeExtras: 0, fumaca: false, camaleao1: false, camaleao2: false, camaleaoRodas: false },
          },
        ],
      },
    }));
  };

  const atualizarCenarioEstetica = (cenarioId, campo, valor) => {
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      praticaEstetica: {
        ...(curso.praticaEstetica || { titulo: "", descricao: "", cenarios: [] }),
        cenarios: (curso.praticaEstetica?.cenarios || []).map((cenario) => {
          if (cenario.id !== cenarioId) return cenario;
          if (campo.startsWith("correto.")) {
            const chave = campo.replace("correto.", "");
            return { ...cenario, correto: { ...(cenario.correto || {}), [chave]: valor } };
          }
          return { ...cenario, [campo]: valor };
        }),
      },
    }));
  };

  const excluirCenarioEstetica = (cenarioId) => {
    if (!window.confirm("Excluir este cenário de estética?")) return;
    atualizarCursoSelecionado((curso) => ({
      ...curso,
      praticaEstetica: {
        ...(curso.praticaEstetica || { titulo: "", descricao: "", cenarios: [] }),
        cenarios: (curso.praticaEstetica?.cenarios || []).filter((cenario) => cenario.id !== cenarioId),
      },
    }));
  };

  useEffect(() => {
    carregarCursos();
  }, []);

  useEffect(() => {
    if (podeGerenciarCursos) {
      buscarListaFuncionarios?.();
    }
  }, [podeGerenciarCursos]);

  useEffect(() => {
    setRespostasSimulado({});
    setResultadoSimulado(null);
    setCenarioPraticaId("");
    setPecasPratica({});
    setResultadoPratica(null);
    setCenarioEsteticaId("");
    setRegistroEstetica({
      valorPainel: "",
      quantidadeExtras: 0,
      fumaca: false,
      camaleao1: false,
      camaleao2: false,
      camaleaoRodas: false,
    });
    setResultadoEstetica(null);
  }, [cursoAtivo]);

  useEffect(() => {
    const primeiroCenario = cursoSelecionado?.praticaDashboard?.cenarios?.[0]?.id || "";
    setCenarioPraticaId(primeiroCenario);
    setPecasPratica({});
    setResultadoPratica(null);
  }, [cursoSelecionado?.id]);

  useEffect(() => {
    const primeiroCenario = cursoSelecionado?.praticaEstetica?.cenarios?.[0]?.id || "";
    setCenarioEsteticaId(primeiroCenario);
    setRegistroEstetica({
      valorPainel: "",
      quantidadeExtras: 0,
      fumaca: false,
      camaleao1: false,
      camaleao2: false,
      camaleaoRodas: false,
    });
    setResultadoEstetica(null);
  }, [cursoSelecionado?.id]);

  useEffect(() => {
    if (!cursosVisiveis.some((curso) => curso.id === cursoAtivo)) {
      setCursoAtivo(cursosVisiveis[0]?.id || "estagiario");
    }
  }, [tunagemVisivel, cursoAtivo]);

  useEffect(() => {
    if (!existemAlteracoesCursos) return undefined;
    const avisarSaida = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", avisarSaida);
    return () => window.removeEventListener("beforeunload", avisarSaida);
  }, [existemAlteracoesCursos]);

  const responderQuestao = (questaoId, opcaoIndex) => {
    setRespostasSimulado((prev) => ({ ...prev, [questaoId]: opcaoIndex }));
    setResultadoSimulado(null);
  };

  const corrigirSimulado = () => {
    const questoes = cursoSelecionado.simulado || [];
    if (questoes.some((questao) => respostasSimulado[questao.id] === undefined)) {
      alert("⚠️ Responda todas as perguntas do simulado.");
      return;
    }

    const acertos = questoes.reduce((total, questao) => (
      total + (respostasSimulado[questao.id] === questao.correta ? 1 : 0)
    ), 0);
    const nota = Math.round((acertos / questoes.length) * 100);
    const aprovado = nota >= (cursoSelecionado.simuladoMinimo || 70);
    setResultadoSimulado({ acertos, total: questoes.length, nota, aprovado });
    return { acertos, total: questoes.length, nota, aprovado };
  };

  const terminarCurso = () => {
    if (statusCurso) return;
    if (praticaObrigatoriaPendente) {
      alert("⚠️ Conclua a prática obrigatória antes de terminar o curso.");
      return;
    }
    const resultado = corrigirSimulado();
    if (!resultado?.aprovado) {
      alert("⚠️ Revise os módulos e tente novamente. Nota mínima não atingida.");
      return;
    }
    if (exigeLiberacaoRh) {
      alert("✅ Curso estudado e simulado concluído. A liberação final da tunagem deve ser feita pelo RH.");
      return;
    }
    concluirCurso(cursoSelecionado.id);
  };

  const opcoesPraticaDashboard = [
    {
      categoria: "MOTOR",
      opcoes: [
        { id: "m0", label: "Motor Padrão", preco: 5000 },
        { id: "m1", label: "Motor Nível 1", preco: 15360 },
        { id: "m2", label: "Motor Nível 2", preco: 30720 },
        { id: "m3", label: "Motor Nível 3", preco: 46080 },
        { id: "m4", label: "Motor Nível 4", preco: 61440 },
        { id: "m5", label: "Motor Nível 5", preco: 76800 },
      ],
    },
    {
      categoria: "FREIOS",
      opcoes: [
        { id: "f0", label: "Freios Padrão", preco: 5000 },
        { id: "f1", label: "Freios Nível 1", preco: 10240 },
        { id: "f2", label: "Freios Nível 2", preco: 20480 },
        { id: "f3", label: "Freios Nível 3", preco: 30720 },
        { id: "f4", label: "Freios Nível 4", preco: 40960 },
        { id: "f5", label: "Freios Nível 5", preco: 51200 },
      ],
    },
    {
      categoria: "TRANSMISSÃO",
      opcoes: [
        { id: "t0", label: "Transmissão Padrão", preco: 5000 },
        { id: "t1", label: "Transmissão Nível 1", preco: 15360 },
        { id: "t2", label: "Transmissão Nível 2", preco: 30720 },
        { id: "t3", label: "Transmissão Nível 3", preco: 46080 },
        { id: "t4", label: "Transmissão Nível 4", preco: 61440 },
        { id: "t5", label: "Transmissão Nível 5", preco: 76800 },
      ],
    },
    {
      categoria: "SUSPENSÃO",
      opcoes: [
        { id: "s0", label: "Suspensão Padrão", preco: 5000 },
        { id: "s1", label: "Suspensão Nível 1", preco: 10240 },
        { id: "s2", label: "Suspensão Nível 2", preco: 20480 },
        { id: "s3", label: "Suspensão Nível 3", preco: 30720 },
        { id: "s4", label: "Suspensão Nível 4", preco: 40960 },
        { id: "s5", label: "Suspensão Nível 5", preco: 51200 },
      ],
    },
    {
      categoria: "BLINDAGEM",
      opcoes: [
        { id: "b0", label: "Blindagem Padrão", preco: 5000 },
        { id: "b1", label: "Blindagem Nível 1", preco: 19200 },
        { id: "b2", label: "Blindagem Nível 2", preco: 38400 },
        { id: "b3", label: "Blindagem Nível 3", preco: 57600 },
        { id: "b4", label: "Blindagem Nível 4", preco: 76800 },
        { id: "b5", label: "Blindagem Nível 5", preco: 96000 },
      ],
    },
    {
      categoria: "OUTROS",
      opcoes: [
        { id: "h1", label: "Hidráulico", preco: 8000 },
        { id: "turbo", label: "Turbo", preco: 33600 },
        { id: "n1", label: "Nitro", preco: 25000 },
        { id: "d1", label: "Kit Drift", preco: 25000 },
        { id: "rd1", label: "Removedor Kit Drift", preco: 25000 },
      ],
    },
  ];

  const mapaOpcoesDashboard = opcoesPraticaDashboard.reduce((mapa, grupo) => {
    grupo.opcoes.forEach((opcao) => {
      mapa[opcao.id] = opcao.label;
    });
    return mapa;
  }, {});
  const formatarPrecoDashboard = (valor) => `R$ ${Number(valor || 0).toLocaleString("pt-BR")}`;
  const formatarItensDashboard = (ids) => ids.map((id) => mapaOpcoesDashboard[id] || id).join(", ");

  const cenarioPratica = cursoSelecionado?.praticaDashboard?.cenarios?.find((cenario) => cenario.id === cenarioPraticaId);
  const cenarioEstetica = cursoSelecionado?.praticaEstetica?.cenarios?.find((cenario) => cenario.id === cenarioEsteticaId);

  const alternarPecaPratica = (pecaId) => {
    setPecasPratica((prev) => ({ ...prev, [pecaId]: !prev[pecaId] }));
    setResultadoPratica(null);
  };

  const corrigirPraticaDashboard = () => {
    if (!cenarioPratica) return;
    const selecionadas = Object.keys(pecasPratica).filter((id) => pecasPratica[id]);
    const corretas = cenarioPratica.corretas || [];
    const faltando = corretas.filter((id) => !selecionadas.includes(id));
    const indevidas = selecionadas.filter((id) => !corretas.includes(id));
    setResultadoPratica({
      aprovado: faltando.length === 0 && indevidas.length === 0,
      faltando,
      indevidas,
      selecionadas,
    });
  };

  const atualizarRegistroEstetica = (campo, valor) => {
    setRegistroEstetica((prev) => ({ ...prev, [campo]: valor }));
    setResultadoEstetica(null);
  };

  const corrigirPraticaEstetica = () => {
    if (!cenarioEstetica) return;
    const correto = cenarioEstetica.correto;
    const erros = [];
    const valorPainel = Number(registroEstetica.valorPainel) || 0;

    if (valorPainel !== correto.valorPainel) erros.push(`Valor do painel esperado: R$ ${correto.valorPainel.toLocaleString("pt-BR")}`);
    if (Number(registroEstetica.quantidadeExtras) !== correto.quantidadeExtras) erros.push(`Extras esperados: ${correto.quantidadeExtras}`);
    if (Boolean(registroEstetica.fumaca) !== correto.fumaca) erros.push(correto.fumaca ? "Fumaça deveria estar marcada" : "Fumaça não deveria estar marcada");
    if (Boolean(registroEstetica.camaleao1) !== correto.camaleao1) erros.push(correto.camaleao1 ? "Camaleão primária deveria estar marcado" : "Camaleão primária não deveria estar marcado");
    if (Boolean(registroEstetica.camaleao2) !== correto.camaleao2) erros.push(correto.camaleao2 ? "Camaleão secundária deveria estar marcado" : "Camaleão secundária não deveria estar marcado");
    if (Boolean(registroEstetica.camaleaoRodas) !== correto.camaleaoRodas) erros.push(correto.camaleaoRodas ? "Camaleão rodas deveria estar marcado" : "Camaleão rodas não deveria estar marcado");

    setResultadoEstetica({ aprovado: erros.length === 0, erros });
  };

  return (
    <div style={{ padding: "28px 34px 60px", maxWidth: "1680px", margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{ color: theme.subtext, fontSize: "11px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
            Treinamento Reds Tunershop
          </div>
          <h2 style={{ color: theme.text, margin: 0, fontSize: "28px", fontWeight: "900" }}>
            Cursos obrigatórios
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "22px" }}>
          {cursosVisiveis.map((curso) => {
            const ativo = curso.id === cursoAtivo;
            const concluido = cursoConcluido(curso);
            return (
              <button
                key={curso.id}
                type="button"
                onClick={() => selecionarCurso(curso.id)}
                style={{
                  ...styles.whiteCard,
                  padding: "18px",
                  textAlign: "left",
                  cursor: "pointer",
                  border: ativo ? `1px solid ${curso.cor}` : `1px solid ${theme.border}`,
                  background: ativo ? "rgba(180,13,13,0.1)" : "rgba(255,255,255,0.015)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ color: theme.text, fontSize: "16px", fontWeight: "900" }}>{curso.titulo}</div>
                  <span style={{
                    color: concluido ? "#22c55e" : "#facc15",
                    fontSize: "11px",
                    fontWeight: "900",
                    whiteSpace: "nowrap",
                  }}>
                    {concluido ? "LIBERADO" : "PENDENTE"}
                  </span>
                </div>
                <div style={{ color: theme.subtext, fontSize: "12px", marginTop: "8px", lineHeight: 1.5 }}>
                  {curso.subtitulo}
                </div>
              </button>
            );
          })}
        </div>

        {!tunagemVisivel && (
          <div style={{ ...styles.whiteCard, padding: "18px", marginBottom: "22px", border: "1px solid rgba(250,204,21,0.28)", background: "rgba(250,204,21,0.045)" }}>
            <div style={{ color: "#facc15", fontSize: "13px", fontWeight: "900", marginBottom: "8px" }}>
              Curso de Tunagem bloqueado
            </div>
            <div style={{ color: theme.subtext, fontSize: "12px", lineHeight: 1.55 }}>
              Para visualizar o Curso de Tunagem, o funcionário precisa acumular pelo menos 10 horas trabalhadas em 3 dias diferentes.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "14px" }}>
              <div style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "10px" }}>
                <div style={{ color: theme.subtext, fontSize: "10px", fontWeight: "900", textTransform: "uppercase" }}>Horas atuais</div>
                <div style={{ color: theme.text, fontSize: "18px", fontWeight: "900", marginTop: "3px" }}>
                  {formatarHoras ? formatarHoras(Math.round(elegibilidadeTunagem?.totalMinutos || 0)) : `${Math.floor((elegibilidadeTunagem?.totalMinutos || 0) / 60)}h`}
                </div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "10px" }}>
                <div style={{ color: theme.subtext, fontSize: "10px", fontWeight: "900", textTransform: "uppercase" }}>Dias diferentes</div>
                <div style={{ color: theme.text, fontSize: "18px", fontWeight: "900", marginTop: "3px" }}>
                  {elegibilidadeTunagem?.diasDistintos || 0}/3
                </div>
              </div>
            </div>
          </div>
        )}

        {podeGerenciarCursos && (
          <div style={{ ...styles.whiteCard, padding: "20px", marginBottom: "22px", border: `1px solid ${theme.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "14px" }}>
              <div>
                <div style={{ color: theme.text, fontSize: "16px", fontWeight: "900" }}>Administração dos cursos</div>
                <div style={{ color: theme.subtext, fontSize: "12px", marginTop: "4px" }}>
                  Crie, edite, ordene e exclua cursos, módulos, vídeos, práticas e simulados.
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {!modoEdicaoCursos ? (
                  <button type="button" onClick={entrarEdicaoCursos} style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "9px 13px", fontSize: "12px" }}>
                    Editar
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={adicionarCurso} style={{ ...styles.uploadBtnLabel, padding: "9px 13px", fontWeight: "900" }}>
                      Novo curso
                    </button>
                    <button type="button" onClick={() => setEditorCursosAberto((v) => !v)} style={{ ...styles.uploadBtnLabel, padding: "9px 13px", fontWeight: "900" }}>
                      {editorCursosAberto ? "Fechar JSON" : "Editar JSON"}
                    </button>
                    <button type="button" onClick={salvarEdicaoCursos} disabled={salvandoCursos} style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "9px 13px", fontSize: "12px", opacity: salvandoCursos ? 0.6 : 1 }}>
                      {salvandoCursos ? "Salvando..." : "Salvar alterações"}
                    </button>
                    <button type="button" onClick={descartarEdicaoCursos} disabled={salvandoCursos} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.border}`, color: theme.text, borderRadius: "8px", padding: "9px 13px", fontSize: "12px", fontWeight: "900", cursor: salvandoCursos ? "not-allowed" : "pointer", opacity: salvandoCursos ? 0.6 : 1 }}>
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>

            {cursosCarregando ? (
              <div style={{ color: theme.subtext, fontSize: "12px" }}>Carregando cursos...</div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {cursos.map((curso, index) => (
                  <div key={curso.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "center", border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "10px 12px", background: "rgba(0,0,0,0.12)" }}>
                    <div>
                      <div style={{ color: theme.text, fontSize: "13px", fontWeight: "900" }}>{index + 1}. {curso.titulo}</div>
                      <div style={{ color: theme.subtext, fontSize: "11px", marginTop: "2px" }}>
                        {curso.modulos?.length || 0} módulos · {curso.simulado?.length || 0} perguntas
                      </div>
                    </div>
                    {modoEdicaoCursos && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button type="button" onClick={() => moverCurso(curso.id, -1)} style={{ ...styles.uploadBtnLabel, padding: "6px 9px" }}>↑</button>
                        <button type="button" onClick={() => moverCurso(curso.id, 1)} style={{ ...styles.uploadBtnLabel, padding: "6px 9px" }}>↓</button>
                        <button type="button" onClick={() => duplicarCurso(curso)} style={{ ...styles.uploadBtnLabel, padding: "6px 9px" }}>Duplicar</button>
                        <button type="button" onClick={() => excluirCurso(curso.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", borderRadius: "8px", padding: "6px 9px", fontSize: "11px", fontWeight: "900", cursor: "pointer" }}>
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {cursoSelecionado && modoEdicaoCursos && (
              <div style={{ marginTop: "18px", border: `1px solid ${theme.border}`, borderRadius: "12px", overflow: "hidden", background: "rgba(0,0,0,0.12)" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ color: theme.text, fontSize: "14px", fontWeight: "900" }}>Editor visual</div>
                    <div style={{ color: theme.subtext, fontSize: "11px", marginTop: "3px" }}>
                      Editando: {cursoSelecionado.titulo}
                    </div>
                  </div>
                  <div style={{ color: "#facc15", fontSize: "11px", fontWeight: "850" }}>
                    Clique em Salvar alterações para gravar no banco.
                  </div>
                </div>

                <div style={{ padding: "16px", display: "grid", gap: "18px" }}>
                  <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" }}>
                    <div>
                      <label style={styles.miniLabel}>Título do curso</label>
                      <input style={styles.input} value={cursoSelecionado.titulo || ""} onChange={(e) => alterarCursoCampo("titulo", e.target.value)} />
                    </div>
                    <div>
                      <label style={styles.miniLabel}>Subtítulo</label>
                      <input style={styles.input} value={cursoSelecionado.subtitulo || ""} onChange={(e) => alterarCursoCampo("subtitulo", e.target.value)} />
                    </div>
                    <div>
                      <label style={styles.miniLabel}>Campo de conclusão</label>
                      <input style={styles.input} value={cursoSelecionado.campo || ""} onChange={(e) => alterarCursoCampo("campo", e.target.value)} />
                    </div>
                    <div>
                      <label style={styles.miniLabel}>Nota mínima (%)</label>
                      <input style={styles.input} inputMode="numeric" value={cursoSelecionado.simuladoMinimo || 70} onChange={(e) => alterarCursoCampo("simuladoMinimo", Number(e.target.value.replace(/\D/g, "")) || 0)} />
                    </div>
                    <div>
                      <label style={styles.miniLabel}>Cor</label>
                      <input style={{ ...styles.input, padding: "5px 8px", height: "38px" }} type="color" value={cursoSelecionado.cor || "#b40d0d"} onChange={(e) => alterarCursoCampo("cor", e.target.value)} />
                    </div>
                  </section>

                  <section style={{ borderTop: `1px solid ${theme.border}`, paddingTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
                      <div style={{ color: theme.text, fontSize: "14px", fontWeight: "900" }}>Módulos e vídeos</div>
                      <button type="button" onClick={adicionarModulo} style={{ ...styles.uploadBtnLabel, padding: "8px 11px", fontWeight: "900" }}>Adicionar módulo</button>
                    </div>
                    <div style={{ display: "grid", gap: "12px" }}>
                      {(cursoSelecionado.modulos || []).map((modulo, index) => (
                        <div key={modulo.id} style={{ border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px", display: "grid", gap: "10px", background: "rgba(255,255,255,0.015)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                            <b style={{ color: theme.text, fontSize: "13px" }}>Módulo {index + 1}</b>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              <button type="button" onClick={() => moverModulo(modulo.id, -1)} style={{ ...styles.uploadBtnLabel, padding: "5px 8px" }}>↑</button>
                              <button type="button" onClick={() => moverModulo(modulo.id, 1)} style={{ ...styles.uploadBtnLabel, padding: "5px 8px" }}>↓</button>
                              <button type="button" onClick={() => excluirModulo(modulo.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", borderRadius: "8px", padding: "5px 8px", fontSize: "11px", fontWeight: "900", cursor: "pointer" }}>Excluir</button>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px" }}>
                            <div>
                              <label style={styles.miniLabel}>Título</label>
                              <input style={styles.input} value={modulo.titulo || ""} onChange={(e) => atualizarModulo(modulo.id, "titulo", e.target.value)} />
                            </div>
                            <div>
                              <label style={styles.miniLabel}>YouTube ID ou link</label>
                              <input style={styles.input} value={modulo.youtubeId || ""} onChange={(e) => atualizarModulo(modulo.id, "youtubeId", e.target.value)} />
                            </div>
                          </div>
                          <div>
                            <label style={styles.miniLabel}>Descrição</label>
                            <textarea style={{ ...styles.textarea, minHeight: "72px" }} value={modulo.descricao || ""} onChange={(e) => atualizarModulo(modulo.id, "descricao", e.target.value)} />
                          </div>
                          <div>
                            <label style={styles.miniLabel}>Tópicos, um por linha</label>
                            <textarea style={{ ...styles.textarea, minHeight: "82px" }} value={(modulo.topicos || []).join("\n")} onChange={(e) => atualizarTopicosModulo(modulo.id, e.target.value)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section style={{ borderTop: `1px solid ${theme.border}`, paddingTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
                      <div style={{ color: theme.text, fontSize: "14px", fontWeight: "900" }}>Simulado</div>
                      <button type="button" onClick={adicionarPergunta} style={{ ...styles.uploadBtnLabel, padding: "8px 11px", fontWeight: "900" }}>Adicionar pergunta</button>
                    </div>
                    <div style={{ display: "grid", gap: "12px" }}>
                      {(cursoSelecionado.simulado || []).map((pergunta, index) => (
                        <div key={pergunta.id} style={{ border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px", display: "grid", gap: "10px", background: "rgba(255,255,255,0.015)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                            <b style={{ color: theme.text, fontSize: "13px" }}>Pergunta {index + 1}</b>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              <button type="button" onClick={() => moverPergunta(pergunta.id, -1)} style={{ ...styles.uploadBtnLabel, padding: "5px 8px" }}>↑</button>
                              <button type="button" onClick={() => moverPergunta(pergunta.id, 1)} style={{ ...styles.uploadBtnLabel, padding: "5px 8px" }}>↓</button>
                              <button type="button" onClick={() => excluirPergunta(pergunta.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", borderRadius: "8px", padding: "5px 8px", fontSize: "11px", fontWeight: "900", cursor: "pointer" }}>Excluir</button>
                            </div>
                          </div>
                          <div>
                            <label style={styles.miniLabel}>Pergunta</label>
                            <input style={styles.input} value={pergunta.pergunta || ""} onChange={(e) => atualizarPergunta(pergunta.id, "pergunta", e.target.value)} />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px" }}>
                            <div>
                              <label style={styles.miniLabel}>Alternativas, uma por linha</label>
                              <textarea style={{ ...styles.textarea, minHeight: "92px" }} value={(pergunta.opcoes || []).join("\n")} onChange={(e) => atualizarOpcoesPergunta(pergunta.id, e.target.value)} />
                            </div>
                            <div>
                              <label style={styles.miniLabel}>Resposta correta</label>
                              <select style={styles.select} value={pergunta.correta || 0} onChange={(e) => atualizarPergunta(pergunta.id, "correta", Number(e.target.value))}>
                                {(pergunta.opcoes || []).map((opcao, opcaoIndex) => (
                                  <option key={`${pergunta.id}-${opcaoIndex}`} value={opcaoIndex}>{opcaoIndex + 1}. {opcao || "Alternativa"}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section style={{ borderTop: `1px solid ${theme.border}`, paddingTop: "16px" }}>
                    <div style={{ color: theme.text, fontSize: "14px", fontWeight: "900", marginBottom: "12px" }}>Práticas obrigatórias</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                      <div style={{ border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px", background: "rgba(255,255,255,0.015)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
                          <b style={{ color: theme.text, fontSize: "13px" }}>Registro de estética</b>
                          <button type="button" onClick={adicionarCenarioEstetica} style={{ ...styles.uploadBtnLabel, padding: "6px 9px" }}>Cenário</button>
                        </div>
                        <input style={styles.input} placeholder="Título" value={cursoSelecionado.praticaEstetica?.titulo || ""} onChange={(e) => alterarPratica("praticaEstetica", "titulo", e.target.value)} />
                        <textarea style={{ ...styles.textarea, minHeight: "62px", marginTop: "8px" }} placeholder="Descrição" value={cursoSelecionado.praticaEstetica?.descricao || ""} onChange={(e) => alterarPratica("praticaEstetica", "descricao", e.target.value)} />
                        <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                          {(cursoSelecionado.praticaEstetica?.cenarios || []).map((cenario) => (
                            <div key={cenario.id} style={{ border: `1px solid ${theme.border}`, borderRadius: "9px", padding: "10px" }}>
                              <input style={styles.input} placeholder="Veículo/cenário" value={cenario.veiculo || ""} onChange={(e) => atualizarCenarioEstetica(cenario.id, "veiculo", e.target.value)} />
                              <textarea style={{ ...styles.textarea, minHeight: "58px" }} placeholder="Contexto" value={cenario.contexto || ""} onChange={(e) => atualizarCenarioEstetica(cenario.id, "contexto", e.target.value)} />
                              <input style={styles.input} placeholder="Dica" value={cenario.dica || ""} onChange={(e) => atualizarCenarioEstetica(cenario.id, "dica", e.target.value)} />
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
                                <input style={styles.input} inputMode="numeric" placeholder="Valor" value={cenario.correto?.valorPainel || 0} onChange={(e) => atualizarCenarioEstetica(cenario.id, "correto.valorPainel", Number(e.target.value.replace(/\D/g, "")) || 0)} />
                                <input style={styles.input} inputMode="numeric" placeholder="Extras" value={cenario.correto?.quantidadeExtras || 0} onChange={(e) => atualizarCenarioEstetica(cenario.id, "correto.quantidadeExtras", Number(e.target.value.replace(/\D/g, "")) || 0)} />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", marginTop: "8px" }}>
                                {[
                                  ["fumaca", "Fumaça"],
                                  ["camaleao1", "Camaleão 1"],
                                  ["camaleao2", "Camaleão 2"],
                                  ["camaleaoRodas", "Camaleão rodas"],
                                ].map(([campo, label]) => (
                                  <label key={campo} style={{ color: theme.text, fontSize: "11px", display: "flex", gap: "7px", alignItems: "center" }}>
                                    <input type="checkbox" checked={Boolean(cenario.correto?.[campo])} onChange={(e) => atualizarCenarioEstetica(cenario.id, `correto.${campo}`, e.target.checked)} />
                                    {label}
                                  </label>
                                ))}
                              </div>
                              <button type="button" onClick={() => excluirCenarioEstetica(cenario.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", borderRadius: "8px", padding: "6px 9px", fontSize: "11px", fontWeight: "900", cursor: "pointer", marginTop: "8px" }}>Excluir cenário</button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px", background: "rgba(255,255,255,0.015)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
                          <b style={{ color: theme.text, fontSize: "13px" }}>Dashboard de tunagem</b>
                          <button type="button" onClick={adicionarCenarioDashboard} style={{ ...styles.uploadBtnLabel, padding: "6px 9px" }}>Cenário</button>
                        </div>
                        <input style={styles.input} placeholder="Título" value={cursoSelecionado.praticaDashboard?.titulo || ""} onChange={(e) => alterarPratica("praticaDashboard", "titulo", e.target.value)} />
                        <textarea style={{ ...styles.textarea, minHeight: "62px", marginTop: "8px" }} placeholder="Descrição" value={cursoSelecionado.praticaDashboard?.descricao || ""} onChange={(e) => alterarPratica("praticaDashboard", "descricao", e.target.value)} />
                        <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                          {(cursoSelecionado.praticaDashboard?.cenarios || []).map((cenario) => (
                            <div key={cenario.id} style={{ border: `1px solid ${theme.border}`, borderRadius: "9px", padding: "10px" }}>
                              <input style={styles.input} placeholder="Veículo/cenário" value={cenario.veiculo || ""} onChange={(e) => atualizarCenarioDashboard(cenario.id, "veiculo", e.target.value)} />
                              <textarea style={{ ...styles.textarea, minHeight: "58px" }} placeholder="Contexto" value={cenario.contexto || ""} onChange={(e) => atualizarCenarioDashboard(cenario.id, "contexto", e.target.value)} />
                              <label style={styles.miniLabel}>Peças disponíveis, separadas por vírgula</label>
                              <input style={styles.input} value={(cenario.disponiveis || []).join(", ")} onChange={(e) => atualizarCenarioDashboard(cenario.id, "disponiveis", e.target.value)} />
                              <label style={styles.miniLabel}>Peças corretas, separadas por vírgula</label>
                              <input style={styles.input} value={(cenario.corretas || []).join(", ")} onChange={(e) => atualizarCenarioDashboard(cenario.id, "corretas", e.target.value)} />
                              <button type="button" onClick={() => excluirCenarioDashboard(cenario.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", borderRadius: "8px", padding: "6px 9px", fontSize: "11px", fontWeight: "900", cursor: "pointer", marginTop: "8px" }}>Excluir cenário</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {modoEdicaoCursos && editorCursosAberto && (
              <div style={{ marginTop: "14px" }}>
                <label style={styles.miniLabel}>Conteúdo completo dos cursos</label>
                <textarea
                  value={jsonCursos}
                  onChange={(e) => setJsonCursos(e.target.value)}
                  style={{ ...styles.textarea, minHeight: "360px", fontFamily: "Consolas, monospace", fontSize: "12px" }}
                />
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                  <button type="button" onClick={salvarJsonCursos} style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "9px 13px", fontSize: "12px" }}>
                    Validar e salvar JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm("Restaurar o conteúdo inicial dos cursos?")) return;
                      setCursos(CURSOS_OBRIGATORIOS);
                      sincronizarJsonCursos(CURSOS_OBRIGATORIOS);
                    }}
                    style={{ ...styles.uploadBtnLabel, padding: "9px 13px", fontWeight: "900" }}
                  >
                    Restaurar padrão local
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "22px", alignItems: "start" }}>
          <div style={{ ...styles.whiteCard, padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "18px" }}>
              <div>
                <div style={{ color: cursoSelecionado.cor, fontSize: "12px", fontWeight: "900", textTransform: "uppercase", marginBottom: "4px" }}>
                  {statusCurso ? "Curso concluído" : "Curso obrigatório"}
                </div>
                <h3 style={{ color: theme.text, margin: 0, fontSize: "22px", fontWeight: "900" }}>{cursoSelecionado.titulo}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (exigeLiberacaoRh) {
                    alert("⚠️ O Curso de Tunagem precisa ser liberado pelo responsável de RH.");
                    return;
                  }
                  if (praticaObrigatoriaPendente) {
                    alert("⚠️ Conclua a prática da dashboard antes de finalizar o curso.");
                    return;
                  }
                  if (!aprovadoNoSimulado) {
                    alert("⚠️ Faça o simulado e atinja a nota mínima para concluir o curso.");
                    return;
                  }
                  concluirCurso(cursoSelecionado.id);
                }}
                disabled={statusCurso || exigeLiberacaoRh || praticaObrigatoriaPendente || !aprovadoNoSimulado}
                style={{
                  ...styles.btnPrimary,
                  width: "auto",
                  marginTop: 0,
                  opacity: statusCurso || exigeLiberacaoRh || praticaObrigatoriaPendente || !aprovadoNoSimulado ? 0.55 : 1,
                  cursor: statusCurso || exigeLiberacaoRh || praticaObrigatoriaPendente || !aprovadoNoSimulado ? "not-allowed" : "pointer",
                  padding: "10px 18px",
                }}
              >
                {statusCurso ? "Curso já liberado" : exigeLiberacaoRh ? "Liberação pelo RH" : praticaObrigatoriaPendente ? "Prática obrigatória" : aprovadoNoSimulado ? "Concluir curso" : "Simulado obrigatório"}
              </button>
            </div>

            {exigeLiberacaoRh && !statusCurso && (
              <div style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.28)", color: "#facc15", borderRadius: "10px", padding: "12px 14px", fontSize: "12px", fontWeight: "800", lineHeight: 1.5, marginBottom: "18px" }}>
                Este curso pode ser estudado e simulado, mas a liberação para tunagem é feita somente pelo responsável de RH.
              </div>
            )}

            <div style={{ display: "grid", gap: "18px" }}>
              {cursoSelecionado.modulos.map((modulo, index) => (
                <section key={modulo.id} style={{ border: `1px solid ${theme.border}`, borderRadius: "12px", overflow: "hidden", background: "rgba(0,0,0,0.18)" }}>
                  <div style={{ aspectRatio: "16 / 9", background: "#050505" }}>
                    <iframe
                      title={modulo.titulo}
                      src={`https://www.youtube.com/embed/${modulo.youtubeId}`}
                      style={{ width: "100%", height: "100%", border: 0, display: "block" }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                  <div style={{ padding: "16px" }}>
                    <div style={{ color: theme.subtext, fontSize: "11px", fontWeight: "900", textTransform: "uppercase", marginBottom: "5px" }}>
                      Módulo {index + 1}
                    </div>
                    <div style={{ color: theme.text, fontSize: "16px", fontWeight: "900" }}>{modulo.titulo}</div>
                    <p style={{ color: theme.subtext, fontSize: "13px", lineHeight: 1.55, margin: "8px 0 0" }}>{modulo.descricao}</p>
                    {modulo.topicos?.length > 0 && (
                      <div style={{ display: "grid", gap: "7px", marginTop: "14px" }}>
                        {modulo.topicos.map((topico) => (
                          <div key={topico} style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: theme.text, fontSize: "12px", lineHeight: 1.45 }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#b40d0d", marginTop: "6px", flexShrink: 0 }}></span>
                            <span>{topico}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>

            {cursoSelecionado.praticaDashboard && (
              <section style={{ border: `1px solid ${theme.border}`, borderRadius: "12px", marginTop: "22px", overflow: "hidden", background: "rgba(0,0,0,0.18)" }}>
                <div style={{ padding: "18px", borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ color: cursoSelecionado.cor, fontSize: "11px", fontWeight: "900", textTransform: "uppercase", marginBottom: "5px" }}>
                    Prática obrigatória
                  </div>
                  <div style={{ color: theme.text, fontSize: "18px", fontWeight: "900" }}>{cursoSelecionado.praticaDashboard.titulo}</div>
                  <p style={{ color: theme.subtext, fontSize: "12px", lineHeight: 1.55, margin: "6px 0 0" }}>
                    {cursoSelecionado.praticaDashboard.descricao}
                  </p>
                </div>

                <div style={{ padding: "18px", display: "grid", gap: "16px" }}>
                  <div style={{ display: "grid", gap: "16px" }}>
                    <div style={{ border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "14px", background: "rgba(255,255,255,0.015)" }}>
                      <label style={{ ...styles.miniLabel, marginBottom: "8px" }}>Cenário do cliente</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px", alignItems: "start" }}>
                        <select
                          value={cenarioPraticaId}
                          onChange={(e) => {
                            setCenarioPraticaId(e.target.value);
                            setPecasPratica({});
                            setResultadoPratica(null);
                          }}
                          style={styles.select}
                        >
                          {cursoSelecionado.praticaDashboard.cenarios.map((cenario) => (
                            <option key={cenario.id} value={cenario.id}>{cenario.veiculo}</option>
                          ))}
                        </select>

                        {cenarioPratica && (
                          <div style={{ display: "grid", gap: "10px" }}>
                            <div>
                              <div style={{ color: theme.text, fontSize: "14px", fontWeight: "900" }}>{cenarioPratica.veiculo}</div>
                              <p style={{ color: theme.subtext, fontSize: "12px", lineHeight: 1.55, margin: "6px 0 0" }}>{cenarioPratica.contexto}</p>
                            </div>
                            <div style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.25)", color: "#facc15", borderRadius: "9px", padding: "10px", fontSize: "12px", fontWeight: "800", lineHeight: 1.45 }}>
                              {cenarioPratica.dica}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "14px", background: "rgba(255,255,255,0.015)" }}>
                      <div style={{ color: theme.text, fontSize: "14px", fontWeight: "900", marginBottom: "12px" }}>
                        Performance
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px" }}>
                        {opcoesPraticaDashboard.map((grupo) => (
                          <div key={grupo.categoria}>
                            <div style={{ ...styles.miniLabel, color: theme.accent, marginBottom: "9px" }}>{grupo.categoria}</div>
                            <div style={{ display: "grid" }}>
                              {grupo.opcoes.map((opcao) => (
                                <label
                                  key={opcao.id}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "18px minmax(0, 1fr) auto",
                                    alignItems: "center",
                                    gap: "8px",
                                    color: theme.text,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    minHeight: "34px",
                                    borderBottom: `1px solid ${theme.border}`,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(pecasPratica[opcao.id])}
                                    onChange={() => alternarPecaPratica(opcao.id)}
                                    style={{ width: "13px", height: "13px", margin: 0 }}
                                  />
                                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: "800" }}>{opcao.label}</span>
                                  <span style={{ color: "#00ff00", fontSize: "11px", fontWeight: "900", whiteSpace: "nowrap" }}>{formatarPrecoDashboard(opcao.preco)}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {resultadoPratica && (
                    <div style={{
                      border: `1px solid ${resultadoPratica.aprovado ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
                      background: resultadoPratica.aprovado ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                      color: resultadoPratica.aprovado ? "#22c55e" : "#ef4444",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      fontSize: "12px",
                      fontWeight: "850",
                      lineHeight: 1.5,
                    }}>
                      {resultadoPratica.aprovado ? (
                        "Preenchimento correto. O serviço está coerente com o veículo e com o pedido do cliente."
                      ) : (
                        <>
                          Preenchimento incorreto. Confira antes de registrar na dashboard.
                          {resultadoPratica.indevidas.length > 0 && <div>Opções indevidas selecionadas: {formatarItensDashboard(resultadoPratica.indevidas)}</div>}
                          {resultadoPratica.faltando.length > 0 && <div>Opções esperadas faltando: {formatarItensDashboard(resultadoPratica.faltando)}</div>}
                        </>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={corrigirPraticaDashboard}
                    style={{ ...styles.btnPrimary, width: "auto", justifySelf: "start", marginTop: 0, padding: "11px 18px" }}
                  >
                    Corrigir preenchimento
                  </button>
                </div>
              </section>
            )}

            {cursoSelecionado.praticaEstetica && (
              <section style={{ border: `1px solid ${theme.border}`, borderRadius: "12px", marginTop: "22px", overflow: "hidden", background: "rgba(0,0,0,0.18)" }}>
                <div style={{ padding: "18px", borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ color: cursoSelecionado.cor, fontSize: "11px", fontWeight: "900", textTransform: "uppercase", marginBottom: "5px" }}>
                    Prática obrigatória
                  </div>
                  <div style={{ color: theme.text, fontSize: "18px", fontWeight: "900" }}>{cursoSelecionado.praticaEstetica.titulo}</div>
                  <p style={{ color: theme.subtext, fontSize: "12px", lineHeight: 1.55, margin: "6px 0 0" }}>
                    {cursoSelecionado.praticaEstetica.descricao}
                  </p>
                </div>

                <div style={{ padding: "18px", display: "grid", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                    <div style={{ border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "14px", background: "rgba(255,255,255,0.015)" }}>
                      <label style={{ ...styles.miniLabel, marginBottom: "8px" }}>Cenário de estética</label>
                      <select
                        value={cenarioEsteticaId}
                        onChange={(e) => {
                          setCenarioEsteticaId(e.target.value);
                          setRegistroEstetica({
                            valorPainel: "",
                            quantidadeExtras: 0,
                            fumaca: false,
                            camaleao1: false,
                            camaleao2: false,
                            camaleaoRodas: false,
                          });
                          setResultadoEstetica(null);
                        }}
                        style={styles.select}
                      >
                        {cursoSelecionado.praticaEstetica.cenarios.map((cenario) => (
                          <option key={cenario.id} value={cenario.id}>{cenario.veiculo}</option>
                        ))}
                      </select>

                      {cenarioEstetica && (
                        <div style={{ marginTop: "14px", display: "grid", gap: "10px" }}>
                          <div>
                            <div style={{ color: theme.text, fontSize: "14px", fontWeight: "900" }}>{cenarioEstetica.veiculo}</div>
                            <p style={{ color: theme.subtext, fontSize: "12px", lineHeight: 1.55, margin: "6px 0 0" }}>{cenarioEstetica.contexto}</p>
                          </div>
                          <div style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.25)", color: "#facc15", borderRadius: "9px", padding: "10px", fontSize: "12px", fontWeight: "800", lineHeight: 1.45 }}>
                            {cenarioEstetica.dica}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "14px", background: "rgba(255,255,255,0.015)" }}>
                      <div style={{ color: theme.text, fontSize: "14px", fontWeight: "900", marginBottom: "12px" }}>
                        Mini registro de estética
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px" }}>
                        <div>
                          <label style={styles.miniLabel}>Valor do painel</label>
                          <input
                            style={styles.input}
                            inputMode="numeric"
                            placeholder="Ex: 17000"
                            value={registroEstetica.valorPainel}
                            onChange={(e) => atualizarRegistroEstetica("valorPainel", e.target.value.replace(/\D/g, ""))}
                          />
                        </div>
                        <div>
                          <label style={styles.miniLabel}>Extras</label>
                          <select
                            value={registroEstetica.quantidadeExtras}
                            onChange={(e) => atualizarRegistroEstetica("quantidadeExtras", Number(e.target.value))}
                            style={styles.select}
                          >
                            {Array.from({ length: 8 }, (_, i) => (
                              <option key={i} value={i}>{i}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", marginTop: "14px" }}>
                        {[
                          { campo: "fumaca", label: "Fumaça" },
                          { campo: "camaleao1", label: "Camaleão primária" },
                          { campo: "camaleao2", label: "Camaleão secundária" },
                          { campo: "camaleaoRodas", label: "Camaleão rodas" },
                        ].map((item) => (
                          <label key={item.campo} style={{ display: "flex", alignItems: "center", gap: "8px", color: theme.text, fontSize: "12px", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={Boolean(registroEstetica[item.campo])}
                              onChange={(e) => atualizarRegistroEstetica(item.campo, e.target.checked)}
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {resultadoEstetica && (
                    <div style={{
                      border: `1px solid ${resultadoEstetica.aprovado ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
                      background: resultadoEstetica.aprovado ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                      color: resultadoEstetica.aprovado ? "#22c55e" : "#ef4444",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      fontSize: "12px",
                      fontWeight: "850",
                      lineHeight: 1.5,
                    }}>
                      {resultadoEstetica.aprovado ? (
                        "Registro correto. O lançamento contempla valor, extras, fumaça e camaleão conforme o serviço."
                      ) : (
                        <>
                          Registro incorreto. Corrija antes de enviar um serviço real.
                          {resultadoEstetica.erros.map((erro) => <div key={erro}>{erro}</div>)}
                        </>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={corrigirPraticaEstetica}
                    style={{ ...styles.btnPrimary, width: "auto", justifySelf: "start", marginTop: 0, padding: "11px 18px" }}
                  >
                    Registrar Serviço
                  </button>
                </div>
              </section>
            )}

            <section style={{ border: `1px solid ${theme.border}`, borderRadius: "12px", marginTop: "22px", overflow: "hidden", background: "rgba(0,0,0,0.18)" }}>
              <div style={{ padding: "18px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: cursoSelecionado.cor, fontSize: "11px", fontWeight: "900", textTransform: "uppercase", marginBottom: "5px" }}>
                    Avaliação obrigatória
                  </div>
                  <div style={{ color: theme.text, fontSize: "18px", fontWeight: "900" }}>Simulado do curso</div>
                  <div style={{ color: theme.subtext, fontSize: "12px", marginTop: "5px" }}>
                    Nota mínima: {cursoSelecionado.simuladoMinimo || 70}%
                  </div>
                </div>
                {resultadoSimulado && (
                  <div style={{
                    color: resultadoSimulado.aprovado ? "#22c55e" : "#ef4444",
                    border: `1px solid ${resultadoSimulado.aprovado ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
                    background: resultadoSimulado.aprovado ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                    borderRadius: "10px",
                    padding: "9px 12px",
                    fontSize: "12px",
                    fontWeight: "900",
                  }}>
                    {resultadoSimulado.nota}% - {resultadoSimulado.acertos}/{resultadoSimulado.total} acertos
                  </div>
                )}
              </div>

              <div style={{ padding: "18px", display: "grid", gap: "16px" }}>
                {(cursoSelecionado.simulado || []).map((questao, index) => (
                  <div key={questao.id} style={{ border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "14px", background: "rgba(255,255,255,0.015)" }}>
                    <div style={{ color: theme.text, fontSize: "14px", fontWeight: "900", marginBottom: "12px" }}>
                      {index + 1}. {questao.pergunta}
                    </div>
                    <div style={{ display: "grid", gap: "8px" }}>
                      {questao.opcoes.map((opcao, opcaoIndex) => {
                        const marcada = respostasSimulado[questao.id] === opcaoIndex;
                        const corrigido = Boolean(resultadoSimulado);
                        const correta = questao.correta === opcaoIndex;
                        return (
                          <label
                            key={opcao}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "9px",
                              border: `1px solid ${corrigido && correta ? "rgba(34,197,94,0.5)" : marcada ? "rgba(180,13,13,0.55)" : theme.border}`,
                              background: corrigido && correta ? "rgba(34,197,94,0.08)" : marcada ? "rgba(180,13,13,0.09)" : "rgba(0,0,0,0.12)",
                              color: theme.text,
                              borderRadius: "9px",
                              padding: "10px 11px",
                              cursor: "pointer",
                              fontSize: "13px",
                            }}
                          >
                            <input
                              type="radio"
                              name={questao.id}
                              checked={marcada}
                              onChange={() => responderQuestao(questao.id, opcaoIndex)}
                            />
                            <span>{opcao}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {resultadoSimulado && !resultadoSimulado.aprovado && (
                  <div style={{ color: "#facc15", fontSize: "12px", fontWeight: "800", lineHeight: 1.5 }}>
                    Revise os módulos e tente novamente para liberar este curso.
                  </div>
                )}

                <button
                  type="button"
                  onClick={terminarCurso}
                  disabled={statusCurso}
                  style={{
                    ...styles.btnPrimary,
                    width: "auto",
                    justifySelf: "start",
                    marginTop: 0,
                    padding: "11px 18px",
                    opacity: statusCurso ? 0.55 : 1,
                    cursor: statusCurso ? "not-allowed" : "pointer",
                  }}
                >
                  {statusCurso ? "Curso já liberado" : "Terminar Curso"}
                </button>
              </div>
            </section>
          </div>

          <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ ...styles.whiteCard, padding: "20px" }}>
              <div style={{ color: theme.text, fontSize: "15px", fontWeight: "900", marginBottom: "12px" }}>Liberações</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {cursosVisiveis.map((curso) => (
                  <div key={curso.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "13px" }}>
                    <span style={{ color: theme.subtext }}>{curso.titulo}</span>
                    <b style={{ color: cursoConcluido(curso) ? "#22c55e" : "#facc15" }}>
                      {cursoConcluido(curso) ? "Liberado" : "Pendente"}
                    </b>
                  </div>
                ))}
              </div>
            </div>

            {podeGerenciarCursos && (
              <div style={{ ...styles.whiteCard, padding: "20px" }}>
                <div style={{ color: theme.text, fontSize: "15px", fontWeight: "900", marginBottom: "6px" }}>Gestão de curso</div>
                <p style={{ color: theme.subtext, fontSize: "12px", lineHeight: 1.5, margin: "0 0 14px" }}>
                  Use para liberar ou remover curso quando um funcionário precisar refazer.
                </p>
                <input
                  value={buscaFuncionarioId}
                  onChange={(e) => {
                    const valor = e.target.value.replace(/\D/g, "");
                    setBuscaFuncionarioId(valor);
                    const encontrado = listaFuncionarios.find((item) => String(item.id) === valor);
                    if (encontrado) setFuncionarioSelecionado(String(encontrado.id));
                  }}
                  onFocus={() => buscarListaFuncionarios?.()}
                  placeholder="Buscar por ID"
                  inputMode="numeric"
                  style={{ ...styles.input, marginBottom: "10px" }}
                />
                <select
                  value={funcionarioSelecionado}
                  onChange={(e) => setFuncionarioSelecionado(e.target.value)}
                  onFocus={() => buscarListaFuncionarios?.()}
                  style={{ ...styles.select, marginBottom: "12px" }}
                >
                  <option value="">Selecionar funcionário</option>
                  {funcionariosFiltrados.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome} - {item.id}
                    </option>
                  ))}
                </select>

                {funcionario && (
                  <div style={{ border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px", marginBottom: "12px" }}>
                    <div style={{ color: theme.text, fontWeight: "900", fontSize: "13px" }}>{funcionario.nome}</div>
                    <div style={{ color: theme.subtext, fontSize: "11px", marginTop: "3px" }}>{getLabelCargo(funcionario.role)}</div>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {cursos.map((curso) => {
                    const concluido = Boolean(funcionario?.[curso.campo] || funcionario?.cursos_concluidos?.[curso.id]);
                    return (
                      <div key={curso.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px", alignItems: "center" }}>
                        <span style={{ color: theme.text, fontSize: "12px", fontWeight: "800" }}>{curso.titulo}</span>
                        <button
                          type="button"
                          disabled={!funcionario}
                          onClick={() => alterarCursoFuncionario(funcionario.id, curso.id, true)}
                          style={{ ...styles.btnPrimary, width: "auto", marginTop: 0, padding: "7px 10px", fontSize: "11px", opacity: funcionario ? 1 : 0.5 }}
                        >
                          Liberar
                        </button>
                        <button
                          type="button"
                          disabled={!funcionario || !concluido}
                          onClick={() => alterarCursoFuncionario(funcionario.id, curso.id, false)}
                          style={{
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.35)",
                            color: "#ef4444",
                            borderRadius: "8px",
                            padding: "7px 10px",
                            fontSize: "11px",
                            fontWeight: "900",
                            cursor: funcionario && concluido ? "pointer" : "not-allowed",
                            opacity: funcionario && concluido ? 1 : 0.5,
                          }}
                        >
                          Remover
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>
    </div>
  );
}
