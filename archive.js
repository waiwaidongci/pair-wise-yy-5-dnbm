/**
 * 方案存档：本地读取/保存、库存校验与扣减、导出 JSON。
 * 保存前用排版规则（Layout）按当前画布核算需求；库存不足时只报告缺口，
 * 既不写存档也不扣减库存。
 */
const Archive = (() => {
  "use strict";

  const KEY = "zfl31Pattern";

  function emptyStock() {
    return Layout.COLORS.map(() => 0);
  }

  function toStock(raw) {
    if (!Array.isArray(raw)) return emptyStock();
    return Layout.COLORS.map((_, i) => Math.max(0, Number(raw[i]) || 0));
  }

  /** 旧方案没有库存信息时补 0，仍可正常打开 */
  function normalize(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.cells)) return null;
    const cols = Number(raw.cols) || 0;
    const rows = Number(raw.rows) || 0;
    if (cols < 1 || rows < 1 || raw.cells.length !== cols * rows) return null;
    const cells = raw.cells.map((v) => {
      v = Number(v) || 0;
      return v >= 0 && v < Layout.COLORS.length ? v : 0;
    });
    return { cols, rows, cells, stock: toStock(raw.stock) };
  }

  function load() {
    try {
      return normalize(JSON.parse(localStorage.getItem(KEY) || "null"));
    } catch (err) {
      return null;
    }
  }

  /**
   * 保存方案：先核算用量与缺口，缺料则整体不执行；
   * 库存够则按需求扣减库存，并把方案（含扣减后库存）写入存档。
   */
  function savePlan(state) {
    const { cols, rows, cells, stock } = state;
    const required = Layout.requiredUsage(cells, cols, rows);
    const gaps = Layout.shortfall(required, stock);
    if (gaps.some((n) => n > 0)) {
      return { ok: false, required, gaps };
    }
    const nextStock = stock.map((n, i) => (Number(n) || 0) - required[i]);
    try {
      localStorage.setItem(KEY, JSON.stringify({ cols, rows, cells, stock: nextStock }));
    } catch (err) {
      return { ok: false, required, gaps, error: String(err) };
    }
    return { ok: true, required, gaps, stock: nextStock };
  }

  function exportJSON(state) {
    const { cols, rows, cells, stock } = state;
    const required = Layout.requiredUsage(cells, cols, rows);
    const risky = Layout.riskColors(cells, cols, rows);
    const data = {
      cols,
      rows,
      cells,
      stock,
      threads: Layout.COLORS.map((color, i) => ({
        color,
        used: Layout.countUsage(cells)[i],
        required: required[i],
        stock: Number(stock[i]) || 0,
        gap: Layout.shortfall(required, stock)[i],
        riskRowColor: risky.has(i),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "brocade-pattern.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { emptyStock, normalize, load, savePlan, exportJSON };
})();
