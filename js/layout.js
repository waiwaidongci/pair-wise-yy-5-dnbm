/*
 * 排版规则：色板、纹样块落格、断线风险行判定、用量核算、重复单元预览。
 * 全部为纯计算，不操作页面，也不读写存档。
 */
const Layout = (() => {
  const COLORS = ["#f7e7c4", "#a6322d", "#1f5f78", "#d6a437", "#355b38", "#713d7b", "#1e1b18", "#e98c52"];
  const RISK_SWITCH_RATIO = 0.62; // 一行内换色次数超过列数的 62%，视为断线风险行
  const RESERVE_RATE = 0.1;       // 断线风险行用到的色线，按风险行格数多留一成

  function indexOf(x, y, cols, rows) {
    return x < 0 || x >= cols || y < 0 || y >= rows ? null : y * cols + x;
  }

  // 纹样块以点击格为中心覆盖的格号；越界格剔除
  function blockTargets(block, center, cols, rows) {
    const x = center % cols, y = Math.floor(center / cols);
    if (block === "cross") {
      return [center, indexOf(x - 1, y, cols, rows), indexOf(x + 1, y, cols, rows),
        indexOf(x, y - 1, cols, rows), indexOf(x, y + 1, cols, rows)].filter(v => v !== null);
    }
    if (block === "diamond") {
      return [indexOf(x, y - 1, cols, rows), indexOf(x - 1, y, cols, rows), center,
        indexOf(x + 1, y, cols, rows), indexOf(x, y + 1, cols, rows)].filter(v => v !== null);
    }
    return [center];
  }

  // 断线风险行（纬向行号，从 0 起）
  function riskRows(cells, cols, rows) {
    const risky = [];
    for (let y = 0; y < rows; y++) {
      let switches = 0;
      for (let x = 1; x < cols; x++) {
        if (cells[y * cols + x] !== cells[y * cols + x - 1]) switches++;
      }
      if (switches > cols * RISK_SWITCH_RATIO) risky.push(y);
    }
    return risky;
  }

  // 按当前画布核算每色用量：
  // 需用量 = 总格数 + 风险行内该色格数 × 10%，小数整体向上进位
  function summarize(cells, cols, rows) {
    const count = COLORS.map(() => 0);
    const riskCount = COLORS.map(() => 0);
    const riskySet = new Set(riskRows(cells, cols, rows));
    cells.forEach((color, i) => {
      if (color < 0 || color >= COLORS.length) return;
      count[color]++;
      if (riskySet.has(Math.floor(i / cols))) riskCount[color]++;
    });
    return COLORS.map((color, i) => {
      const need = Math.ceil(count[i] + riskCount[i] * RESERVE_RATE);
      return {
        color, index: i,
        count: count[i],       // 画布上该色总格数
        risk: riskCount[i],    // 其中落在断线风险行的格数
        reserve: need - count[i], // 多留的备线（向上进位）
        need                   // 核算需用量（格）
      };
    });
  }

  // 重复单元预览：取左上角 6×6 的颜色
  function repeatPreview(cells, cols) {
    return Array.from({ length: 36 }, (_, i) => {
      const v = cells[(i % 6) + Math.floor(i / 6) * cols];
      return COLORS[v] || COLORS[0];
    });
  }

  return { COLORS, RISK_SWITCH_RATIO, RESERVE_RATE, blockTargets, riskRows, summarize, repeatPreview };
})();
