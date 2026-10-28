/*
 * Sinestesia — motor de análise
 * Copyright (c) 2026 Brunno Barbour Basso. Todos os direitos reservados.
 */
(function (global) {
  "use strict";

  // ---------- Leitura de CSV ----------

  function detectarDelimitador(texto) {
    const primeira = texto.split(/\r?\n/).find((l) => l.trim() !== "") || "";
    const contagem = { ",": 0, ";": 0, "\t": 0 };
    let aspas = false;
    for (const c of primeira) {
      if (c === '"') aspas = !aspas;
      else if (!aspas && c in contagem) contagem[c]++;
    }
    return Object.keys(contagem).reduce((a, b) => (contagem[b] > contagem[a] ? b : a));
  }

  function lerCSV(texto) {
    texto = texto.replace(/^\uFEFF/, "");
    const delim = detectarDelimitador(texto);
    const linhas = [];
    let linha = [], campo = "", aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === delim) { linha.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); campo = "";
        if (linha.some((v) => v.trim() !== "")) linhas.push(linha);
        linha = [];
      } else campo += c;
    }
    linha.push(campo);
    if (linha.some((v) => v.trim() !== "")) linhas.push(linha);
    if (linhas.length < 2) throw new Error("O arquivo precisa de um cabeçalho e pelo menos uma linha de dados.");
    const cabecalho = linhas[0].map((h, i) => h.trim() || "coluna_" + (i + 1));
    const dados = linhas.slice(1).map((l) => cabecalho.map((_, i) => (l[i] ?? "").trim()));
    return { cabecalho, dados, delim };
  }

  // Aceita "1.234,56", "1234,56", "1,234.56", "12%", "R$ 10"
  function paraNumero(s) {
    if (s == null) return NaN;
    let t = String(s).trim().replace(/^R\$\s*/i, "").replace(/%$/, "").replace(/\s/g, "");
    if (t === "") return NaN;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d+,\d+$/.test(t)) t = t.replace(",", ".");
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
    if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return NaN;
    return Number(t);
  }

  function separarColunas({ cabecalho, dados }) {
    const numericas = [], rotulos = [];
    cabecalho.forEach((nome, j) => {
      const brutos = dados.map((l) => l[j]);
      const preenchidos = brutos.filter((v) => v !== "");
      const valores = brutos.map(paraNumero);
      const validos = valores.filter((v) => !Number.isNaN(v)).length;
      if (preenchidos.length > 0 && validos / preenchidos.length >= 0.8 && validos >= 2) {
        numericas.push({ nome, valores });
      } else {
        rotulos.push({ nome, valores: brutos });
      }
    });
    return { numericas, rotulos };
  }

  // ---------- Estatística ----------

  const limpos = (v) => v.filter((x) => !Number.isNaN(x));
  const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;

  function mediana(v) {
    const o = [...v].sort((a, b) => a - b), m = Math.floor(o.length / 2);
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  }

  function desvio(v) {
    if (v.length < 2) return 0;
    const m = media(v);
    return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1));
  }

  function tendencia(valores) {
    const pts = valores.map((y, x) => [x, y]).filter(([, y]) => !Number.isNaN(y));
    const n = pts.length;
    if (n < 3) return { inclinacao: 0, variacaoRelativa: 0 };
    const mx = media(pts.map((p) => p[0])), my = media(pts.map((p) => p[1]));
    let num = 0, den = 0;
    for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
    const inclinacao = den ? num / den : 0;
    const total = inclinacao * (pts[n - 1][0] - pts[0][0]);
    return { inclinacao, variacaoRelativa: my !== 0 ? total / Math.abs(my) : 0 };
  }

  function foraDaCurva(valores) {
    const v = limpos(valores);
    if (v.length < 4) return [];
    const m = media(v), d = desvio(v);
    if (d === 0) return [];
    const res = [];
    valores.forEach((x, i) => {
      if (Number.isNaN(x)) return;
      const z = (x - m) / d;
      if (Math.abs(z) >= 2.2) res.push({ indice: i, valor: x, z });
    });
    return res;
  }

  function correlacao(a, b) {
    const pares = a.map((x, i) => [x, b[i]]).filter(([x, y]) => !Number.isNaN(x) && !Number.isNaN(y));
    if (pares.length < 4) return NaN;
    const mx = media(pares.map((p) => p[0])), my = media(pares.map((p) => p[1]));
    let sxy = 0, sxx = 0, syy = 0;
    for (const [x, y] of pares) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
  }

  function analisar(tabela) {
    const { numericas, rotulos } = separarColunas(tabela);
    const colunas = numericas.map((c) => {
      const v = limpos(c.valores);
      return {
        nome: c.nome,
        valores: c.valores,
        n: v.length,
        faltando: c.valores.length - v.length,
        media: media(v),
        mediana: mediana(v),
        desvio: desvio(v),
        min: Math.min(...v),
        max: Math.max(...v),
        tendencia: tendencia(c.valores),
        foraDaCurva: foraDaCurva(c.valores),
      };
    });
    const correlacoes = [];
    for (let i = 0; i < colunas.length; i++)
      for (let j = i + 1; j < colunas.length; j++) {
        const r = correlacao(colunas[i].valores, colunas[j].valores);
        if (!Number.isNaN(r)) correlacoes.push({ a: colunas[i].nome, b: colunas[j].nome, r });
      }
    correlacoes.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
    const rotulo = rotulos[0] ? rotulos[0].valores : tabela.dados.map((_, i) => "linha " + (i + 1));
    return { linhas: tabela.dados.length, colunas, correlacoes, rotulo, nomeRotulo: rotulos[0]?.nome || null };
  }

  // ---------- Narrador ----------

  const fmt = (x) =>
    Number.isFinite(x)
      ? x.toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(x) >= 100 ? 0 : 2 })
      : "—";
  const pct = (x) => (x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "%";

  function narrar(a) {
    const frases = [];
    frases.push({
      tipo: "geral",
      texto: `Analisei ${a.linhas} linhas e ${a.colunas.length} coluna${a.colunas.length === 1 ? "" : "s"} numérica${a.colunas.length === 1 ? "" : "s"}${a.nomeRotulo ? `, usando "${a.nomeRotulo}" como linha do tempo` : ""}.`,
    });

    for (const c of a.colunas) {
      const vr = c.tendencia.variacaoRelativa;
      if (vr > 0.1) frases.push({ tipo: "sobe", texto: `"${c.nome}" tem tendência de alta: do começo ao fim, a reta de tendência sobe cerca de ${pct(vr)} da média.` });
      else if (vr < -0.1) frases.push({ tipo: "desce", texto: `"${c.nome}" tem tendência de queda: a reta de tendência cai cerca de ${pct(-vr)} da média ao longo dos dados.` });
      const cv = c.media !== 0 ? c.desvio / Math.abs(c.media) : 0;
      if (cv > 0.5) frases.push({ tipo: "volatil", texto: `"${c.nome}" é bem instável: o desvio-padrão é ${pct(cv)} da média. Vale olhar o que faz esses valores oscilarem tanto.` });
      if (c.foraDaCurva.length) {
        const pior = c.foraDaCurva.reduce((x, y) => (Math.abs(y.z) > Math.abs(x.z) ? y : x));
        frases.push({
          tipo: "surpresa",
          texto: `Em "${c.nome}", ${a.rotulo[pior.indice]} destoa do resto: ${fmt(pior.valor)}, ${fmt(Math.abs(pior.z))} desvios-padrão ${pior.z > 0 ? "acima" : "abaixo"} da média (${fmt(c.media)}).${c.foraDaCurva.length > 1 ? ` Há mais ${c.foraDaCurva.length - 1} ponto(s) fora da curva.` : ""}`,
        });
      }
      if (c.faltando) frases.push({ tipo: "aviso", texto: `"${c.nome}" tem ${c.faltando} valor(es) vazio(s) ou ilegível(is), que foram ignorados.` });
    }

    for (const k of a.correlacoes.filter((k) => Math.abs(k.r) >= 0.6).slice(0, 3)) {
      frases.push({
        tipo: "elo",
        texto: `"${k.a}" e "${k.b}" andam ${k.r > 0 ? "juntas" : "em direções opostas"} (correlação ${fmt(k.r)}): quando uma sobe, a outra tende a ${k.r > 0 ? "subir" : "cair"}. Correlação não prova causa, mas é uma boa pista.`,
      });
    }

    if (a.colunas.length > 1) {
      let melhor = -1, idx = -1;
      for (let i = 0; i < a.linhas; i++) {
        let s = 0, n = 0;
        for (const c of a.colunas) {
          const x = c.valores[i];
          if (!Number.isNaN(x) && c.desvio) { s += Math.abs((x - c.media) / c.desvio); n++; }
        }
        if (n && s / n > melhor) { melhor = s / n; idx = i; }
      }
      if (idx >= 0) frases.push({ tipo: "pico", texto: `O momento mais intenso dos dados é ${a.rotulo[idx]}, quando as colunas estão, em média, ${fmt(melhor)} desvios-padrão longe do normal.` });
    }

    if (frases.length === 1) frases.push({ tipo: "geral", texto: "Os dados parecem estáveis, sem tendências fortes ou surpresas. Às vezes, nenhuma novidade já é uma resposta." });
    return frases;
  }

  // ---------- Dados de exemplo (fictícios) ----------

  function exemploCafeteria() {
    const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const ruido = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x) - 0.5; };
    const linhas = ["mes;temperatura_media;chuva_mm;cafes_vendidos;sorvetes_vendidos"];
    for (let i = 0; i < 24; i++) {
      const m = i % 12, ano = 2024 + Math.floor(i / 12);
      const temp = 21 + 5 * Math.cos((2 * Math.PI * m) / 12) + ruido(i, 1) * 1.5;
      const chuva = Math.max(5, 130 + 110 * Math.cos((2 * Math.PI * m) / 12) + ruido(i, 2) * 160);
      const cafes = Math.round(900 - 28 * (temp - 21) + 9 * i + ruido(i, 3) * 60);
      let sorvetes = Math.round(220 + 45 * (temp - 21) + 4 * i + ruido(i, 4) * 30);
      if (i === 17) sorvetes += 900; // um festival no bairro
      const br = (x, d) => x.toFixed(d).replace(".", ",");
      linhas.push(`${meses[m]}/${ano};${br(temp, 1)};${br(chuva, 0)};${cafes};${sorvetes}`);
    }
    return linhas.join("\n");
  }

  global.Sinestesia = { lerCSV, paraNumero, analisar, narrar, exemploCafeteria, fmt };
})(typeof window !== "undefined" ? window : globalThis);
