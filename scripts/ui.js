"use strict";
/**
 * ui.js — رسم اللوحة SVG والتفاعل مع المستخدم
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_SIZE = 640;

const PLAYER_COLOR_CSS = { white: "#f0f0f0", black: "#444", red: "#e94560" };
const PLAYER_TEXT_CSS  = { white: "#111",    black: "#eee", red: "#fff"    };

const SECTOR_COLORS = {
  W: { light: "#c8a96e", mid: "#9a7040", dark: "#5c3820" },
  B: { light: "#6ea8c8", mid: "#406a9a", dark: "#20405c" },
  R: { light: "#c86e6e", mid: "#9a4040", dark: "#5c2020" },
};

function colorIndexToFill(sector, idx) {
  const s = SECTOR_COLORS[sector];
  return [s.light, s.mid, s.dark][idx];
}

// ─── رسم اللوحة كاملة ───
function renderBoard() {
  const svg = document.getElementById("chess-board");
  svg.setAttribute("viewBox", `0 0 ${SVG_SIZE} ${SVG_SIZE}`);
  svg.setAttribute("width", SVG_SIZE);
  svg.setAttribute("height", SVG_SIZE);
  svg.innerHTML = "";

  const state = Game.state;
  const selected = state.selectedSquare;
  const legalSet = new Set(state.legalMoves);
  const checkKings = new Set();
  for (const p of state.players) {
    if (p.inCheck) {
      const kk = Rules.findKing(state.board, p.id);
      if (kk) checkKings.add(kk);
    }
  }

  for (const sector of Board.SECTORS) {
    for (let r = 1; r <= Board.ROWS; r++) {
      for (let c = 1; c <= Board.COLS; c++) {
        const key = Board.sq(sector, c, r);
        const isSelected = key === selected;
        const isLegal    = legalSet.has(key);
        const isCheck    = checkKings.has(key);

        drawCell(svg, sector, c, r, key, isSelected, isLegal, isCheck, state.board[key]);
      }
    }
  }

  // رسم المركز (دائرة مزيّنة)
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", Board.CX);
  circle.setAttribute("cy", Board.CY);
  circle.setAttribute("r", "14");
  circle.setAttribute("fill", "#2a1a0a");
  circle.setAttribute("stroke", "#f0c040");
  circle.setAttribute("stroke-width", "2");
  svg.appendChild(circle);
}

function drawCell(svg, sector, col, row, key, isSelected, isLegal, isCheck, piece) {
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "hex-cell" +
    (isSelected ? " cell-selected" : "") +
    (isLegal    ? " cell-legal"    : "") +
    (isCheck    ? " cell-check"    : ""));
  g.setAttribute("data-key", key);

  // --- خلفية الخانة ---
  const poly = document.createElementNS(SVG_NS, "polygon");
  const points = Board.cellRect(sector, col, row);
  poly.setAttribute("points", points);
  poly.setAttribute("class", "cell-bg");

  let fill = colorIndexToFill(sector, Board.cellColor(sector, col, row));
  if (isSelected) fill = "#f0c040";
  else if (isCheck) fill = "#e94560";
  else if (isLegal && !piece) fill = lighten(fill, 40);

  poly.setAttribute("fill", fill);
  poly.setAttribute("stroke", "#1a0a00");
  poly.setAttribute("stroke-width", "0.8");
  g.appendChild(poly);

  // --- نقطة الحركة القانونية ---
  if (isLegal && !piece) {
    const center = Board.cellCenter(sector, col, row);
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", center.x);
    dot.setAttribute("cy", center.y);
    dot.setAttribute("r", "5");
    dot.setAttribute("fill", "rgba(240,192,64,0.7)");
    g.appendChild(dot);
  }

  // --- القطعة ---
  if (piece) {
    const center = Board.cellCenter(sector, col, row);
    const sym = Pieces.PIECE_UNICODE[piece.owner]?.[piece.type] ?? "?";

    // دائرة خلفية للقطعة
    const bg = document.createElementNS(SVG_NS, "circle");
    bg.setAttribute("cx", center.x);
    bg.setAttribute("cy", center.y);
    bg.setAttribute("r", "12");
    bg.setAttribute("fill", PLAYER_COLOR_CSS[piece.owner]);
    bg.setAttribute("stroke", isLegal ? "#f0c040" : "#2a1a0a");
    bg.setAttribute("stroke-width", isLegal ? "2.5" : "1");
    g.appendChild(bg);

    const txt = document.createElementNS(SVG_NS, "text");
    txt.setAttribute("x", center.x);
    txt.setAttribute("y", center.y + 1);
    txt.setAttribute("class", "piece-text");
    txt.setAttribute("fill", PLAYER_TEXT_CSS[piece.owner]);
    txt.setAttribute("font-size", "14");
    txt.textContent = sym;
    g.appendChild(txt);
  }

  g.addEventListener("click", () => Game.handleSquareClick(key));
  svg.appendChild(g);
}

function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amount);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount);
  const b = Math.min(255, (n & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

// ─── تحديث بطاقات اللاعبين والسجل ───
function updateUI() {
  const state = Game.state;
  const cur = Game.currentPlayer();

  // بطاقات اللاعبين
  for (const p of state.players) {
    const card = document.getElementById(`card-${p.id}`);
    const statusEl = document.getElementById(`status-${p.id}`);
    const capturedEl = document.getElementById(`captured-${p.id}`);
    if (!card) continue;

    card.className = "player-card" +
      (p.id === cur?.id && state.status === "playing" ? " active-turn" : "") +
      (p.inCheck ? " in-check" : "") +
      (!p.active ? " eliminated" : "");

    statusEl.textContent = !p.active ? "خرج من اللعبة" :
                           p.inCheck  ? "⚠ كِش!" : "نشط";

    capturedEl.textContent = p.captured
      .map(t => Pieces.PIECE_UNICODE[p.id]?.[t] ?? t)
      .join(" ");
  }

  // مؤشر الدور
  const turnEl = document.getElementById("turn-indicator");
  if (state.status === "finished") {
    const winner = Game.getPlayerById(state.winner);
    turnEl.textContent = `🏆 فاز: ${winner?.name ?? "غير معروف"}`;
  } else if (cur) {
    turnEl.textContent = `دور: ${cur.name}`;
  }

  // سجل الحركات
  const logEl = document.getElementById("move-log");
  logEl.innerHTML = state.moveHistory.map((m, i) => {
    const p = Game.getPlayerById(m.player);
    const color = PLAYER_COLOR_CSS[m.player];
    return `<div class="move-entry">
      <span style="color:${color};font-weight:bold">${p?.name?.split("(")[0] ?? m.player}</span>
      ${m.label}
    </div>`;
  }).join("");
  logEl.scrollTop = logEl.scrollHeight;

  // رسالة نهاية اللعبة
  if (state.status === "finished") {
    showGameOver();
  }
}

function showPromotionModal() {
  document.getElementById("promotion-modal").classList.remove("hidden");
}
function hidePromotionModal() {
  document.getElementById("promotion-modal").classList.add("hidden");
}

function showGameOver() {
  const state = Game.state;
  const winner = Game.getPlayerById(state.winner);
  document.getElementById("gameover-title").textContent = "انتهت اللعبة!";
  document.getElementById("gameover-msg").textContent =
    winner ? `🏆 الفائز: ${winner.name}` : "تعادل!";
  document.getElementById("gameover-modal").classList.remove("hidden");
}

const UI = {
  renderBoard, updateUI,
  showPromotionModal, hidePromotionModal, showGameOver,
};
