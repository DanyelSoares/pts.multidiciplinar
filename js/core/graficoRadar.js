function pontoEixo(indice, totalEixos, raio, centro) {
  const angulo = (Math.PI * 2 * indice) / totalEixos - Math.PI / 2;
  return {
    x: centro + raio * Math.cos(angulo),
    y: centro + raio * Math.sin(angulo),
    angulo,
  };
}

function anelGrade(totalEixos, raioMax, centro, fracao) {
  const pontos = [];
  for (let i = 0; i < totalEixos; i++) {
    const p = pontoEixo(i, totalEixos, raioMax * fracao, centro);
    pontos.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return `<polygon points="${pontos.join(' ')}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
}

function eixosLinha(totalEixos, raioMax, centro) {
  let svg = '';
  for (let i = 0; i < totalEixos; i++) {
    const p = pontoEixo(i, totalEixos, raioMax, centro);
    svg += `<line x1="${centro}" y1="${centro}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`;
  }
  return svg;
}

function quebrarEmLinhas(texto, maxChars) {
  const palavras = texto.split(' ');
  const linhas = [];
  palavras.forEach((palavra) => {
    const ultima = linhas[linhas.length - 1];
    if (ultima && (ultima + ' ' + palavra).length <= maxChars) {
      linhas[linhas.length - 1] = ultima + ' ' + palavra;
    } else {
      linhas.push(palavra);
    }
  });
  return linhas;
}

function rotulosEixo(rotulos, totalEixos, raioMax, centro) {
  let svg = '';
  const raioRotulo = raioMax + 30;
  rotulos.forEach((rotulo, i) => {
    const p = pontoEixo(i, totalEixos, raioRotulo, centro);
    const cosA = Math.cos((Math.PI * 2 * i) / totalEixos - Math.PI / 2);
    let anchor = 'middle';
    if (cosA > 0.3) anchor = 'start';
    else if (cosA < -0.3) anchor = 'end';
    const linhas = quebrarEmLinhas(rotulo, 18);
    const offsetInicial = -((linhas.length - 1) * 6);
    const tspans = linhas
      .map((linha, li) => `<tspan x="${p.x.toFixed(1)}" dy="${li === 0 ? offsetInicial : 13}">${linha}</tspan>`)
      .join('');
    svg += `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="${anchor}" font-size="10.5" font-weight="700" fill="var(--muted)" font-family="inherit">${tspans}</text>`;
  });
  return svg;
}

function poligonoCamada(valores, totalEixos, raioMax, centro, corVar, tracejado, preencher) {
  const pontos = valores.map((v, i) => {
    const raio = v === null ? 0 : (v / 100) * raioMax;
    return pontoEixo(i, totalEixos, raio, centro);
  });
  const pontosStr = pontos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const preenchimento = preencher ? `fill="${corVar}" fill-opacity="0.16"` : 'fill="none"';
  const tracoStyle = tracejado ? 'stroke-dasharray="5,4"' : '';

  let svg = `<polygon points="${pontosStr}" ${preenchimento} stroke="${corVar}" stroke-width="2.5" ${tracoStyle}/>`;

  pontos.forEach((p, i) => {
    if (valores[i] === null) return;
    svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${corVar}"><title>${valores[i].toFixed(0)}%</title></circle>`;
  });

  return svg;
}

export function renderizarRadarSVG(camadas, rotulosEixos, options = {}) {
  const tamanho = options.size || 420;
  const margem = 110;
  const viewBoxSize = tamanho + margem * 2;
  const centro = viewBoxSize / 2;
  const raioMax = tamanho / 2 - 20;
  const totalEixos = rotulosEixos.length;

  let svg = `<svg viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="100%" style="max-width:${viewBoxSize}px;display:block;margin:0 auto;">`;

  [0.25, 0.5, 0.75, 1].forEach((fracao) => {
    svg += anelGrade(totalEixos, raioMax, centro, fracao);
  });
  svg += eixosLinha(totalEixos, raioMax, centro);

  camadas.forEach((camada) => {
    svg += poligonoCamada(camada.valores, totalEixos, raioMax, centro, camada.corVar, camada.tracejado || false, camada.preencher !== false);
  });

  svg += rotulosEixo(rotulosEixos, totalEixos, raioMax, centro);
  svg += '</svg>';

  return svg;
}

export function renderizarLegenda(camadas) {
  return `<div class="radar-legend">${camadas
    .map(
      (c) => `<span class="radar-legend-item"><span class="radar-legend-dot" style="background:${c.corVar}"></span>${c.label}</span>`
    )
    .join('')}</div>`;
}
