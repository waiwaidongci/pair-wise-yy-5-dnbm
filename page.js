/**
 * 页面操作：画布渲染、色线库登记、交互事件与缺口提示。
 * 排版规则见 layout.js，存取与导出见 archive.js。
 */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const gridEl = $("#grid");
  const paletteEl = $("#palette");
  const statsEl = $("#stats");
  const previewEl = $("#preview");
  const riskEl = $("#risk");
  const stockEl = $("#stock");
  const saveMsgEl = $("#saveMsg");

  const colors = Layout.COLORS;
  let cols = 18;
  let rows = 14;
  let cells = [];
  let stock = Archive.emptyStock();
  let active = 1;
  let block = "dot";
  let dragging = false;
  let undoStack = [];
  let redoStack = [];

  function chip(i) {
    return '<span class="chip" style="background:' + colors[i] + '"></span>';
  }

  function boot() {
    const saved = Archive.load();
    if (saved) {
      cols = saved.cols;
      rows = saved.rows;
      cells = saved.cells;
      stock = saved.stock;
    } else {
      cols = Number($("#cols").value);
      rows = Number($("#rows").value);
      cells = Layout.createCells(cols, rows);
    }
    $("#cols").value = cols;
    $("#rows").value = rows;
    renderAll();
  }

  function newGrid() {
    cols = Number($("#cols").value) || cols;
    rows = Number($("#rows").value) || rows;
    cells = Layout.createCells(cols, rows);
    // 换网格只重排画布，色线库已登记的库存保留；缺口随当前纹样重算
    undoStack = [];
    redoStack = [];
    saveMsgEl.textContent = "";
    renderAll();
  }

  function snapshot() {
    undoStack.push([...cells]);
    redoStack = [];
    if (undoStack.length > 50) undoStack.shift();
  }

  function paint(i) {
    snapshot();
    Layout.targetsOf(cols, rows, i, block).forEach((t) => {
      cells[t] = active;
    });
    saveMsgEl.textContent = "";
    renderAll();
  }

  function renderAll() {
    renderPalette();
    renderBoard();
    renderStats();
    renderRisk();
    renderStock();
  }

  function renderPalette() {
    paletteEl.innerHTML = colors
      .map(
        (c, i) =>
          '<div class="color-card"><button type="button" class="swatch ' +
          (i === active ? "active" : "") +
          '" data-color="' +
          i +
          '" style="background:' +
          c +
          '" title="色线' +
          i +
          '"></button>' +
          '<input type="number" min="0" step="1" data-stock="' +
          i +
          '" value="' +
          stock[i] +
          '" aria-label="色线' +
          i +
          '现有格数"></div>'
      )
      .join("");
    paletteEl.querySelectorAll("[data-color]").forEach((el) => {
      el.onclick = () => {
        active = Number(el.dataset.color);
        renderPalette();
      };
    });
    paletteEl.querySelectorAll("[data-stock]").forEach((el) => {
      el.oninput = () => {
        const i = Number(el.dataset.stock);
        stock[i] = Math.max(0, Number(el.value) || 0);
        renderStock(); // 登记库存后立即按当前画布重算缺口
      };
    });
  }

  function renderBoard() {
    gridEl.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    gridEl.innerHTML = cells
      .map((v, i) => '<div class="cell" data-i="' + i + '" style="background:' + colors[v] + '"></div>')
      .join("");
    gridEl.querySelectorAll(".cell").forEach((el) => {
      el.onpointerdown = () => {
        dragging = true;
        paint(Number(el.dataset.i));
      };
      el.onpointerenter = () => {
        if (dragging) paint(Number(el.dataset.i));
      };
    });
  }

  function renderStats() {
    const usage = Layout.countUsage(cells);
    statsEl.innerHTML = usage
      .map(
        (n, i) =>
          '<div class="stat"><span>' +
          chip(i) +
          " 色线" +
          i +
          '</span><b>' +
          n +
          "</b></div>"
      )
      .join("");
    previewEl.innerHTML = Array.from(
      { length: 36 },
      (_, i) =>
        '<div class="mini" style="background:' +
        colors[cells[(i % 6) + Math.floor(i / 6) * cols] ?? 0] +
        '"></div>'
    ).join("");
  }

  function renderRisk() {
    const riskRowList = Layout.riskRows(cells, cols, rows).map((y) => y + 1);
    riskEl.innerHTML = riskRowList.length
      ? '<p class="warning">第' + riskRowList.join("、") + "行换色过密，可能断线；这些行用到的色线多留一成。</p>"
      : "<p>暂无明显断线风险。</p>";
  }

  function renderStock() {
    const required = Layout.requiredUsage(cells, cols, rows);
    const gaps = Layout.shortfall(required, stock);
    const lines = colors
      .map((c, i) => {
        if (required[i] === 0) return "";
        return (
          '<div class="stat' +
          (gaps[i] > 0 ? " short" : "") +
          '"><span>' +
          chip(i) +
          " 色线" +
          i +
          "　需 " +
          required[i] +
          " / 存 " +
          (stock[i] || 0) +
          '</span><b>' +
          (gaps[i] > 0 ? "缺 " + gaps[i] : "够") +
          "</b></div>"
        );
      })
      .join("");
    const totalGap = gaps.reduce((a, b) => a + b, 0);
    const note = totalGap > 0
      ? '<p class="warning">库存不足：' +
        gaps
          .map((n, i) => (n > 0 ? "色线" + i + " 差 " + n + " 格" : ""))
          .filter(Boolean)
          .join("，") +
        "。保存与扣减均未执行，请补齐后再保存。</p>"
      : '<p class="ok">库存充足，保存方案时将按上述需求扣减。</p>';
    stockEl.innerHTML = lines + note;
  }

  document.querySelectorAll("[data-block]").forEach((btn) => {
    btn.onclick = () => {
      block = btn.dataset.block;
    };
  });
  $("#newBtn").onclick = newGrid;
  $("#undoBtn").onclick = () => {
    if (!undoStack.length) return;
    redoStack.push([...cells]);
    cells = undoStack.pop();
    saveMsgEl.textContent = "";
    renderAll();
  };
  $("#redoBtn").onclick = () => {
    if (!redoStack.length) return;
    undoStack.push([...cells]);
    cells = redoStack.pop();
    saveMsgEl.textContent = "";
    renderAll();
  };
  $("#saveBtn").onclick = () => {
    const result = Archive.savePlan({ cols, rows, cells, stock });
    if (!result.ok) {
      saveMsgEl.className = "savemsg warning";
      saveMsgEl.textContent = result.error
        ? "保存失败：" + result.error
        : "库存不足，未保存、未扣减。";
      renderStock();
      return;
    }
    stock = result.stock;
    saveMsgEl.className = "savemsg ok";
    saveMsgEl.textContent = "方案已保存，库存已按需求扣减。";
    renderAll();
  };
  $("#exportBtn").onclick = () => Archive.exportJSON({ cols, rows, cells, stock });
  window.addEventListener("pointerup", () => {
    dragging = false;
  });

  boot();
})();
