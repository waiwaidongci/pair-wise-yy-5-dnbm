/**
 * 排版规则：网格、纹样块、用量核算、断线风险与库存缺口。
 * 纯逻辑文件，不碰页面，供 page.js（页面操作）与 archive.js（方案存档）调用。
 */
const Layout = (() => {
  "use strict";

  const COLORS = ["#f7e7c4", "#a6322d", "#1f5f78", "#d6a437", "#355b38", "#713d7b", "#1e1b18", "#e98c52"];
  const RISK_SWITCH_RATIO = 0.62; // 一行内换色次数超过列数的 62% 视为断线风险行
  const RISK_RESERVE_RATIO = 0.1; // 断线风险行用到的颜色多留一成

  function createCells(cols, rows) {
    return Array(cols * rows).fill(0);
  }

  /** 应用纹样块时，以 i 为中心会落到哪些格 */
  function targetsOf(cols, rows, i, block) {
    const x = i % cols;
    const y = Math.floor(i / cols);
    const idx = (xx, yy) => (xx < 0 || xx >= cols || yy < 0 || yy >= rows ? null : yy * cols + xx);
    let list;
    if (block === "cross") {
      list = [i, idx(x - 1, y), idx(x + 1, y), idx(x, y - 1), idx(x, y + 1)];
    } else if (block === "diamond") {
      list = [idx(x, y - 1), idx(x - 1, y), i, idx(x + 1, y), idx(x, y + 1)];
    } else {
      list = [i];
    }
    return list.filter((v) => v !== null);
  }

  /** 各色线在当前画布上的格数 */
  function countUsage(cells) {
    return COLORS.map((_, i) => cells.reduce((n, v) => n + (v === i ? 1 : 0), 0));
  }

  /** 断线风险行（返回 0 基行号） */
  function riskRows(cells, cols, rows) {
    const found = [];
    for (let y = 0; y < rows; y++) {
      let switches = 0;
      for (let x = 1; x < cols; x++) {
        if (cells[y * cols + x] !== cells[y * cols + x - 1]) switches++;
      }
      if (switches > cols * RISK_SWITCH_RATIO) found.push(y);
    }
    return found;
  }

  /** 断线风险行里用到的颜色 */
  function riskColors(cells, cols, rows) {
    const set = new Set();
    riskRows(cells, cols, rows).forEach((y) => {
      for (let x = 0; x < cols; x++) set.add(cells[y * cols + x]);
    });
    return set;
  }

  /**
   * 按当前画布核算各色需求格数。
   * 断线风险行用到的颜色多留一成，小数向上进位：
   *   需求 = 用量 + ceil(用量 / 10)（整数运算，避免 20*1.1 的浮点误差）。
   */
  function requiredUsage(cells, cols, rows) {
    const usage = countUsage(cells);
    const risky = riskColors(cells, cols, rows);
    return COLORS.map((_, i) => {
      const used = usage[i];
      if (used > 0 && risky.has(i)) return used + Math.ceil(used * RISK_RESERVE_RATIO);
      return used;
    });
  }

  /** 各色缺口（差多少格），库存按 0 计空值 */
  function shortfall(required, stock) {
    return required.map((need, i) => Math.max(0, need - (Number(stock[i]) || 0)));
  }

  return {
    COLORS,
    RISK_SWITCH_RATIO,
    RISK_RESERVE_RATIO,
    createCells,
    targetsOf,
    countUsage,
    riskRows,
    riskColors,
    requiredUsage,
    shortfall,
  };
})();
