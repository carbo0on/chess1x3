"use strict";
/**
 * pieces.js — حركة كل نوع قطعة على اللوحة السداسية
 * يستخدم NEIGHBORS من board.js للتنقل بين الخانات
 */

// رموز Unicode للقطع
const PIECE_UNICODE = {
  white: { K:"♔", Q:"♕", R:"♖", B:"♗", N:"♘", P:"♙" },
  black: { K:"♚", Q:"♛", R:"♜", B:"♝", N:"♞", P:"♟" },
  red:   { K:"♚", Q:"♛", R:"♜", B:"♝", N:"♞", P:"♟" },
};

const PIECE_LABELS = { K:"ملك", Q:"وزير", R:"رخ", B:"فيل", N:"حصان", P:"بيدق" };

/**
 * تتبّع اتجاه خطّي من خانة ما وجمع الخانات حتى نهاية اللوحة أو قطعة حاجبة.
 * @param {string} startKey
 * @param {string[]} dirNames - أسماء الاتجاهات المتتابعة عبر NEIGHBORS
 * @param {Object} board
 * @param {string} owner - صاحب القطعة المتحركة
 * @returns {string[]} خانات وصول ممكنة
 */
function slideInDirs(startKey, dirNames, board, owner) {
  const result = [];
  for (const dir of dirNames) {
    let cur = startKey;
    while (true) {
      const nxt = Board.NEIGHBORS[cur]?.[dir];
      if (!nxt) break;
      const occupant = board[nxt];
      if (occupant) {
        if (occupant.owner !== owner) result.push(nxt); // أخذ قطعة خصم
        break;
      }
      result.push(nxt);
      cur = nxt;
    }
  }
  return result;
}

/**
 * خانة واحدة في اتجاهات متعددة
 */
function stepInDirs(startKey, dirNames, board, owner) {
  const result = [];
  for (const dir of dirNames) {
    const nxt = Board.NEIGHBORS[startKey]?.[dir];
    if (!nxt) continue;
    const occupant = board[nxt];
    if (!occupant || occupant.owner !== owner) result.push(nxt);
  }
  return result;
}

// ─── الرخّ ───
function rookMoves(key, board, owner) {
  return slideInDirs(key, ["up","down","left","right"], board, owner);
}

// ─── الفيل ───
function bishopMoves(key, board, owner) {
  return slideInDirs(key, ["ul","ur","dl","dr"], board, owner);
}

// ─── الوزير ───
function queenMoves(key, board, owner) {
  return slideInDirs(key, ["up","down","left","right","ul","ur","dl","dr"], board, owner);
}

// ─── الملك ───
function kingMoves(key, board, owner) {
  return stepInDirs(key, ["up","down","left","right","ul","ur","dl","dr"], board, owner);
}

// ─── الحصان (L-shape في شبكة مستطيلة) ───
// الحصان يتحرك بنمط L: خطوتان في اتجاه ثم خطوة عمودية
function knightMoves(key, board, owner) {
  const N = Board.NEIGHBORS;
  const result = [];
  // جميع تركيبات L الممكنة عبر الشبكة
  const KNIGHT_PATHS = [
    ["up","up","left"],["up","up","right"],
    ["down","down","left"],["down","down","right"],
    ["left","left","up"],["left","left","down"],
    ["right","right","up"],["right","right","down"],
  ];
  for (const path of KNIGHT_PATHS) {
    let cur = key;
    let valid = true;
    for (const dir of path) {
      const nxt = N[cur]?.[dir];
      if (!nxt) { valid = false; break; }
      cur = nxt;
    }
    if (!valid) continue;
    const occupant = board[cur];
    if (!occupant || occupant.owner !== owner) result.push(cur);
  }
  return result;
}

// ─── البيدق ───
// البيدق يتقدّم نحو "المركز" (down) للاعب صاحبه.
// لكن بعد عبور المركز يكمل تقدّمه في القطاع المقابل.
// الأكل: قطري أمامي فقط (dl, dr).
// الخطوة الأولى: خطوتان إذا لم يتحرّك بعد.
function pawnMoves(key, board, owner, enPassantTarget) {
  const N = Board.NEIGHBORS;
  const result = [];
  const piece = board[key];

  // اتجاه التقدّم = نحو المركز (down)
  const fwd = "down";

  // خطوة واحدة للأمام
  const one = N[key]?.[fwd];
  if (one && !board[one]) {
    result.push(one);
    // خطوة ثانية إذا لم يتحرك
    if (!piece.moved) {
      const two = N[one]?.[fwd];
      if (two && !board[two]) result.push(two);
    }
  }

  // الأكل القطري
  for (const dir of ["dl","dr"]) {
    const diag = N[key]?.[dir];
    if (!diag) continue;
    const occ = board[diag];
    if (occ && occ.owner !== owner) result.push(diag);
    if (diag === enPassantTarget) result.push(diag);
  }

  return result;
}

// ─── واجهة عامة ───
function getRawMoves(key, board, enPassantTarget) {
  const piece = board[key];
  if (!piece) return [];
  const { type, owner } = piece;
  switch (type) {
    case "R": return rookMoves(key, board, owner);
    case "B": return bishopMoves(key, board, owner);
    case "Q": return queenMoves(key, board, owner);
    case "K": return kingMoves(key, board, owner);
    case "N": return knightMoves(key, board, owner);
    case "P": return pawnMoves(key, board, owner, enPassantTarget);
    default:  return [];
  }
}

// هل الخانة تقع في صف الترقية لصاحب البيدق؟
function isPawnPromotion(key, owner) {
  const { sector, row } = Board.parseSq(key);
  // البيدق يصل للترقية عند row=1 في القطاع المقابل (بعد عبور المركز)
  // أو عند row=4 في أي قطاع آخر غير قطاعه الأصلي
  const homeSector = Board.PLAYER_SECTOR?.[owner] ?? Board.SECTORS[0];
  // البيدق بعيد عن وطنه ويصل للحافة البعيدة
  if (sector !== homeSector && row === 4) return true;
  return false;
}

const Pieces = {
  PIECE_UNICODE, PIECE_LABELS,
  getRawMoves, isPawnPromotion,
  rookMoves, bishopMoves, queenMoves, kingMoves, knightMoves, pawnMoves,
};
