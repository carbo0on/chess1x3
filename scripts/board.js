/**
 * board.js — تعريف اللوحة السداسية لثلاثة لاعبين
 *
 * نظام الإحداثيات:
 * اللوحة تتكوّن من ثلاثة قطاعات (sectors) بشكل مثلثي حول المركز:
 *   - قطاع W (white)  : الأبيض  — أعلى اللوحة
 *   - قطاع B (black)  : الأسود  — أسفل يمين
 *   - قطاع R (red)    : الأحمر  — أسفل يسار
 *
 * كل قطاع يحتوي 8 أعمدة × 4 صفوف = 32 خانة، المجموع 96 خانة.
 * مفتاح كل خانة: "<sector><col><row>" مثل "W14", "B38", "R61"
 *   - sector: W | B | R
 *   - col: 1-8
 *   - row: 1-4  (1 = الأقرب لمركز اللوحة، 4 = الأقرب للحافة)
 *
 * الخانات المحورية (center bridge squares):
 * عند الانتقال من قطاع لقطاع تمر الحركة عبر خانات الصف 1.
 * خريطة الجيران تعالج العبور عبر المركز صراحةً.
 *
 * اتجاهات الحركة (6 اتجاهات لكل خانة داخل القطاع):
 *   UP    = row+1 (نحو الحافة)
 *   DOWN  = row-1 (نحو المركز)
 *   LEFT  = col-1
 *   RIGHT = col+1
 *   + قطريان لكل خانة
 *
 * عند عبور المركز (row=1 → row=1 في القطاع التالي):
 * الأعمدة تنعكس وفق جدول التحويل أدناه.
 */

"use strict";

const SECTORS = ["W", "B", "R"];
const COLS = 8;
const ROWS = 4;

// الترتيب الدوري للقطاعات
const NEXT_SECTOR = { W: "B", B: "R", R: "W" };
const PREV_SECTOR = { W: "R", R: "B", B: "W" };

// ─── دالة مساعدة لبناء مفتاح الخانة ───
function sq(sector, col, row) {
  return `${sector}${col}${row}`;
}

function parseSq(key) {
  return { sector: key[0], col: parseInt(key[1]), row: parseInt(key[2]) };
}

/**
 * عند عبور حدود القطاع (row 1 → row 1 في القطاع التالي باتجاه المركز):
 * عمود col في قطاع حالي يقابل عمود (9 - col) في القطاع التالي
 * (العكس لأن الاتجاه ينقلب بعد المركز)
 */
function crossCenter(sector, col, goingLeft) {
  const targetSector = goingLeft ? PREV_SECTOR[sector] : NEXT_SECTOR[sector];
  const targetCol = 9 - col;
  return { sector: targetSector, col: targetCol, row: 1 };
}

// ─── بناء خريطة الجيران ───
// لكل خانة: { up, down, left, right, upLeft, upRight, downLeft, downRight }
// القيمة: مفتاح الخانة الجارة أو null

const NEIGHBORS = {}; // key → { up, down, left, right, ul, ur, dl, dr }

function buildNeighbors() {
  for (const s of SECTORS) {
    for (let c = 1; c <= COLS; c++) {
      for (let r = 1; r <= ROWS; r++) {
        const key = sq(s, c, r);
        const n = {};

        // UP (بعيداً عن المركز)
        n.up = r < ROWS ? sq(s, c, r + 1) : null;

        // DOWN (نحو المركز)
        if (r > 1) {
          n.down = sq(s, c, r - 1);
        } else {
          // r=1 → عبور المركز إلى القطاع التالي
          // الخانة المقابلة في القطاع التالي عمودها معكوس
          const ns = NEXT_SECTOR[s];
          const nc = 9 - c;
          n.down = sq(ns, nc, 1);
        }

        // LEFT
        if (c > 1) {
          n.left = sq(s, c - 1, r);
        } else {
          // c=1: الحافة اليسرى — لا جار (أو يمكن عبور قطاع)
          // في هذه الشطرنج لا يوجد التفاف أفقي على الحواف
          n.left = null;
        }

        // RIGHT
        if (c < COLS) {
          n.right = sq(s, c + 1, r);
        } else {
          n.right = null;
        }

        // DIAGONAL: upLeft, upRight, downLeft, downRight
        n.ul = (r < ROWS && c > 1) ? sq(s, c - 1, r + 1) : null;
        n.ur = (r < ROWS && c < COLS) ? sq(s, c + 1, r + 1) : null;

        if (r > 1) {
          n.dl = c > 1 ? sq(s, c - 1, r - 1) : null;
          n.dr = c < COLS ? sq(s, c + 1, r - 1) : null;
        } else {
          // r=1: قطري عبر المركز
          const ns = NEXT_SECTOR[s];
          // عمود معكوس ± 1
          const nc = 9 - c;
          n.dl = nc < COLS ? sq(ns, nc + 1, 1) : null; // انعكاس الاتجاه
          n.dr = nc > 1   ? sq(ns, nc - 1, 1) : null;
        }

        NEIGHBORS[key] = n;
      }
    }
  }
}

buildNeighbors();

// ─── حساب لون الخانة (3 ألوان) ───
function cellColor(sector, col, row) {
  const sectorOffset = SECTORS.indexOf(sector) * 3;
  return (col + row + sectorOffset) % 3;
  // 0 = فاتح، 1 = متوسط، 2 = غامق
}

const COLOR_FILL = ["#d4a96a", "#a0784a", "#704030"];
const COLOR_STROKE = "#2a1a0a";

// ─── الإحداثيات الهندسية لرسم اللوحة (SVG) ───
// اللوحة ترسم في دائرة نصف قطرها R_BOARD حول المركز
// كل قطاع يمتد بزاوية 120°

const CX = 320, CY = 320; // مركز SVG
const CELL_W = 36;         // عرض الخانة (بكسل)
const CELL_H = 32;         // ارتفاع الخانة

/**
 * إحداثيات مركز الخانة (sector, col, row) في فضاء SVG.
 * القطاع W مواجه للأعلى (زاوية 270°)
 * القطاع B مواجه للأسفل اليمين (زاوية 30°)
 * القطاع R مواجه للأسفل اليسار (زاوية 150°)
 */
const SECTOR_ANGLE = { W: -90, B: 30, R: 150 }; // درجات

function cellCenter(sector, col, row) {
  const baseAngle = (SECTOR_ANGLE[sector] * Math.PI) / 180;
  // محور طولي: row (1=قريب من مركز، 4=بعيد)
  // محور عرضي: col (1..8 يتمحور حول 4.5)
  const perpOffset = (col - 4.5) * CELL_W;
  const radialDist = (row - 0.5) * CELL_H + 16; // +16 فجوة صغيرة من المركز

  // اتجاه محوري (من المركز نحو الحافة)
  const ax = Math.cos(baseAngle);
  const ay = Math.sin(baseAngle);
  // اتجاه عمودي (يسار/يمين في إطار القطاع)
  const px = Math.cos(baseAngle + Math.PI / 2);
  const py = Math.sin(baseAngle + Math.PI / 2);

  const x = CX + ax * radialDist + px * perpOffset;
  const y = CY + ay * radialDist + py * perpOffset;
  return { x, y };
}

function cellRect(sector, col, row) {
  const { x, y } = cellCenter(sector, col, row);
  const baseAngle = (SECTOR_ANGLE[sector] * Math.PI) / 180;
  const perpAngle = baseAngle + Math.PI / 2;

  // نصف أبعاد الخانة
  const hw = CELL_W / 2 - 1;
  const hh = CELL_H / 2 - 1;

  // الزوايا الأربع مع الدوران
  const ax = Math.cos(baseAngle), ay = Math.sin(baseAngle);
  const px = Math.cos(perpAngle), py = Math.sin(perpAngle);

  const corners = [
    [x + px * hw + ax * hh, y + py * hw + ay * hh],
    [x - px * hw + ax * hh, y - py * hw + ay * hh],
    [x - px * hw - ax * hh, y - py * hw - ay * hh],
    [x + px * hw - ax * hh, y + py * hw - ay * hh],
  ];
  return corners.map(([cx, cy]) => `${cx.toFixed(1)},${cy.toFixed(1)}`).join(" ");
}

// ─── الحالة الابتدائية للوحة ───
function createInitialBoard() {
  const board = {};
  for (const s of SECTORS) {
    for (let c = 1; c <= COLS; c++) {
      for (let r = 1; r <= ROWS; r++) {
        board[sq(s, c, r)] = null;
      }
    }
  }
  return board;
}

// ─── مواقع القطع الابتدائية لكل لاعب ───
// الصف 4 (الحافة) = ملك/وزير/رخ/فيل/حصان
// الصف 3 = بيادق
// الترتيب الكلاسيكي من عمود 1 إلى 8:
// R, N, B, Q, K, B, N, R
const BACK_ROW  = ["R","N","B","Q","K","B","N","R"];
const PAWN_ROW  = ["P","P","P","P","P","P","P","P"];

const PLAYER_SECTOR = { white: "W", black: "B", red: "R" };

function placeInitialPieces(board) {
  for (const [player, sector] of Object.entries(PLAYER_SECTOR)) {
    // الصف الخلفي (row=4)
    for (let c = 1; c <= COLS; c++) {
      board[sq(sector, c, 4)] = { type: BACK_ROW[c - 1], owner: player, moved: false };
    }
    // البيادق (row=3)
    for (let c = 1; c <= COLS; c++) {
      board[sq(sector, c, 3)] = { type: "P", owner: player, moved: false };
    }
  }
  return board;
}

// ─── صادرات ───
const Board = {
  SECTORS, COLS, ROWS,
  NEXT_SECTOR, PREV_SECTOR,
  NEIGHBORS,
  sq, parseSq,
  cellColor, COLOR_FILL, COLOR_STROKE,
  cellCenter, cellRect,
  createInitialBoard, placeInitialPieces,
  CX, CY, CELL_W, CELL_H,
  PLAYER_SECTOR,
};
