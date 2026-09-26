/*
 * 页面操作：状态管理、画布绘制、撤销重做、库存登记与缺口提示。
 * 排版规则走 Layout，方案存档走 Archive。
 */
(() => {
  const colors = Layout.COLORS;
  const grid = document.querySelector("#grid");
  const palette = document.querySelector("#palette");
  const stats = document.querySelector("#stats");
  const preview = document.querySelector("#preview");
  const risk = document.querySelector("#risk");
  const stockMsg = document.querySelector("#stockMsg");

  const state = {
    cols: 18, rows: 14, active: 1, block: "dot",
    cells: [], stock: colors.map(() => 0),
    undo: [], redo: [], dragging: false
  };

  function init() {
    const saved = Archive.load();
    if (saved) {
      state.cols = saved.cols;
      state.rows = saved.rows;
      state.cells = saved.cells;
      state.stock = saved.stock;
    } else {
      state.cols = Number(document.querySelector("#cols").value);
      state.rows = Number(document.querySelector("#rows").value);
      state.cells = Array(state.cols * state.rows).fill(0);
    }
    document.querySelector("#cols").value = state.cols;
    document.querySelector("#rows").value = state.rows;
    render();
  }

  function snapshot() {
    state.undo.push([...state.cells]);
    state.redo = [];
    if (state.undo.length > 50) state.undo.shift();
  }

  function paint(i) {
    snapshot();
    Layout.blockTargets(state.block, i, state.cols, state.rows)
      .forEach(t => { if (t >= 0 && t < state.cells.length) state.cells[t] = state.active; });
    render();
  }

  function readStock() {
    return colors.map((_, i) => {
      const n = Math.floor(Number(palette.querySelector('[data-stock="' + i + '"]').value));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
  }

  function render() {
    renderPalette();
    grid.style.gridTemplateColumns = "repeat(" + state.cols + ", 1fr)";
    grid.innerHTML = state.cells.map((v, i) =>
      '<div class="cell" data-i="' + i + '" style="background:' + colors[v] + '"></div>').join("");
    grid.querySelectorAll(".cell").forEach(el => {
      el.onpointerdown = () => { state.dragging = true; paint(Number(el.dataset.i)); };
      el.onpointerenter = () => { if (state.dragging) paint(Number(el.dataset.i)); };
    });
    renderStats();
  }

  // 色板与库存输入框分开渲染：选色/输入库存不重建，避免打断输入与焦点
  function renderPalette() {
    if (!palette.childElementCount) {
      palette.innerHTML =
        '<div class="swatch-row">' + colors.map((c, i) =>
          '<button class="swatch ' + (i === state.active ? "active" : "") +
          '" data-color="' + i + '" style="background:' + c + '" title="色线' + i + '"></button>').join("") + '</div>' +
        '<div class="stock-grid">' + colors.map(i =>
          '<div class="stock-row" data-row="' + i + '">' +
          '<label class="stock-label" for="stock' + i + '">色线' + i + '</label>' +
          '<input id="stock' + i + '" data-stock="' + i + '" type="number" min="0" step="1" value="' + state.stock[i] + '"></div>'
        ).join("") + '</div>';
      palette.querySelectorAll("[data-color]").forEach(el => {
        el.onclick = () => { state.active = Number(el.dataset.color); renderPalette(); };
      });
      palette.querySelectorAll("[data-stock]").forEach(el => {
        el.oninput = renderStats; // 缺口随库存登记实时重算
      });
    }
    palette.querySelectorAll("[data-color]").forEach(el => {
      el.classList.toggle("active", Number(el.dataset.color) === state.active);
    });
  }

  function renderStats() {
    const summary = Layout.summarize(state.cells, state.cols, state.rows);
    const stock = readStock();
    const lack = Archive.deficits(summary, stock);
    const lackMap = new Map(lack.map(m => [m.index, m.gap]));

    stats.innerHTML = summary.map(m => {
      const gap = lackMap.get(m.index);
      return '<div class="stat' + (gap ? " short" : "") + '">' +
        '<span><span class="chip" style="background:' + m.color + '"></span> 色线' + m.index +
        '<small class="muted"> 用' + m.need + "格" + (m.risk ? "（含风险行" + m.risk + "）" : "") + '</small></span>' +
        '<b>' + (gap ? "差" + gap + "格" : "库存" + stock[m.index] + "格") + '</b></div>';
    }).join("");

    preview.innerHTML = Layout.repeatPreview(state.cells, state.cols)
      .map(c => '<div class="mini" style="background:' + c + '"></div>').join("");

    const risky = Layout.riskRows(state.cells, state.cols, state.rows).map(y => y + 1);
    risk.innerHTML = risky.length
      ? '<p class="warning">第' + risky.join("、") + '行换色过密，可能断线；这些行用到的色线多留一成备线。</p>'
      : '<p>暂无明显断线风险。</p>';

    if (lack.length) {
      stockMsg.className = "stockmsg warning";
      stockMsg.textContent = "库存不足：" + lack.map(m => "色线" + m.index + "差" + m.gap + "格").join("，") + "。保存不会执行，库存也不会扣减。";
    } else {
      stockMsg.className = "stockmsg ok";
      stockMsg.textContent = "各色库存均够当前用量，可以保存并扣减。";
    }
  }

  function bindControls() {
    document.querySelectorAll("[data-block]").forEach(btn => {
      btn.onclick = () => { state.block = btn.dataset.block; };
    });
    document.querySelector("#newBtn").onclick = () => {
      state.undo = [];
      state.redo = [];
      state.cols = Number(document.querySelector("#cols").value);
      state.rows = Number(document.querySelector("#rows").value);
      state.cells = Array(state.cols * state.rows).fill(0);
      render();
    };
    document.querySelector("#undoBtn").onclick = () => {
      if (!state.undo.length) return;
      state.redo.push([...state.cells]);
      state.cells = state.undo.pop();
      render(); // 缺口按回退后的纹样重算
    };
    document.querySelector("#redoBtn").onclick = () => {
      if (!state.redo.length) return;
      state.undo.push([...state.cells]);
      state.cells = state.redo.pop();
      render();
    };
    document.querySelector("#saveBtn").onclick = () => {
      const res = Archive.save(state.cols, state.rows, state.cells, readStock());
      if (!res.ok) {
        stockMsg.className = "stockmsg warning";
        stockMsg.textContent = "未保存：缺 " +
          res.lack.map(m => "色线" + m.index + "（差" + m.gap + "格）").join("、") + "。";
        return;
      }
      state.stock = res.stock;
      state.undo = [];
      state.redo = [];
      palette.querySelectorAll("[data-stock]").forEach(el => { el.value = state.stock[Number(el.dataset.stock)]; });
      renderStats();
      stockMsg.className = "stockmsg ok";
      stockMsg.textContent = "方案已保存，库存按核算用量扣减完毕。";
    };
    document.querySelector("#exportBtn").onclick = () => {
      Archive.exportJson(state.cols, state.rows, state.cells, readStock());
    };
    window.addEventListener("pointerup", () => { state.dragging = false; });
  }

  bindControls();
  init();
})();
