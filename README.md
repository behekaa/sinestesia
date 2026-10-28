# Sinestesia 🎧📊

**Um analisador de dados que você escuta.**

Carregue uma planilha CSV e o Sinestesia transforma os números em música e em texto:

- 🎵 **Sonificação** — cada coluna vira uma melodia (valor alto = nota aguda). Duas colunas tocam ao mesmo tempo, uma em cada lado do fone.
- 🥁 **Pontos fora da curva viram batidas** — você *ouve* a anomalia antes de enxergá-la.
- 📈 **Gráfico sincronizado** — um cursor percorre os dados enquanto a música toca.
- 🗣️ **Narrador automático** — descreve tendências, instabilidade, valores estranhos, colunas que andam juntas e o momento mais intenso dos dados, em português.
- 🔗 **Mapa de correlações** e **resumo estatístico** (média, mediana, desvio-padrão, mínimo e máximo).

Tudo roda no navegador: nenhum dado sai do seu computador.

## Como usar

Abra o `index.html` no navegador, arraste um arquivo `.csv` para a página (ou clique em **Usar exemplo**) e aperte **▶ Ouvir os dados**. Use fones para perceber as duas vozes separadas.

O leitor entende os formatos brasileiros: separador `;` ou `,`, decimais com vírgula (`1.234,56`), `R$` e `%`.

## Estrutura

| Arquivo | O que faz |
|---|---|
| `index.html` | Interface, gráfico em canvas e síntese de som com Web Audio API |
| `analise.js` | Leitura de CSV, estatística e o narrador |
| `exemplo-cafeteria.csv` | Dados **fictícios** de uma cafeteria (24 meses) |

## Tecnologias

HTML, CSS e JavaScript puro — sem bibliotecas, sem servidor.

---

© 2026 Brunno Barbour Basso. **Todos os direitos reservados.** Este repositório é público só para visualização; veja [LICENSE](LICENSE).
