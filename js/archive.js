/*
 * 方案存档：本地方案的读取/保存、库存校验与扣减、JSON 导出。
 * 不涉及任何页面渲染。旧方案没有 stock 字段时，库存按 0 补齐，照常打开。
 */
const Archive = (() => {
  const KEY = "zfl31Pattern";

  function normalizeStock(stock) {
    return Layout.COLORS.map((_, i) => {
      const n = Math.floor(Number(stock && stock[i]));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved || !Array.isArray(saved.cells)) return null;
      return {
        cols: saved.cols,
        rows: saved.rows,
        cells: saved.cells,
        stock: normalizeStock(saved.stock) // 旧方案无库存信息时补 0
      };
    } catch (e) {
      return null;
    }
  }

  // 逐色比对需用量与现有库存，返回缺口清单
  function deficits(summary, stock) {
    return summary
      .map(m => ({ ...m, stock: stock[m.index], gap: m.need - stock[m.index] }))
      .filter(m => m.gap > 0);
  }

  // 保存方案：按当前画布核算用量，库存不足则指出缺色与差额，
  // 此时保存和扣减都不执行；库存足则保存并按需用量扣减库存。
  function save(cols, rows, cells, stock) {
    const summary = Layout.summarize(cells, cols, rows);
    const lack = deficits(summary, stock);
    if (lack.length) return { ok: false, summary, lack };

    const remaining = stock.map((n, i) => n - summary[i].need);
    localStorage.setItem(KEY, JSON.stringify({ cols, rows, cells, stock: remaining }));
    return { ok: true, summary, stock: remaining };
  }

  function exportJson(cols, rows, cells, stock) {
    const summary = Layout.summarize(cells, cols, rows);
    const data = {
      cols, rows, cells,
      stock: stock.slice(),
      riskRows: Layout.riskRows(cells, cols, rows).map(y => y + 1),
      usage: summary.map(m => ({
        color: m.color,
        count: m.count,
        riskCells: m.risk,
        reserve: m.reserve,
        need: m.need
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "brocade-pattern.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { KEY, load, save, deficits, normalizeStock, exportJson };
})();
