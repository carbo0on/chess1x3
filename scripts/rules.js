"use strict";
/**
 * rules.js — قواعد اللعبة: الحركات القانونية، الكِش، التبييت، الترقية
 */

/**
 * نسخ اللوحة بعمق كافٍ للمحاكاة
 */
function cloneBoard(board) {
  const b = {};
  for (const [k, v] of Object.entries(board)) {
    b[k] = v ? { ...v } : null;
  }
  return b;
}

/**
 * تنفيذ حركة على لوحة مستنسخة وإعادتها (للمحاكاة)
 */
function applyMoveToBoard(board, from, to) {
  const b = cloneBoard(board);
  b[to] = b[from];
  if (b[to]) b[to].moved = true;
  b[from] = null;
  return b;
}

/**
 * العثور على مفتاح خانة الملك لمالك معيّن
 */
function findKing(board, owner) {
  for (const [key, piece] of Object.entries(board)) {
    if (piece && piece.type === "K" && piece.owner === owner) return key;
  }
  return null;
}

/**
 * هل الخانة `target` مهدَّدة من أي قطعة للاعب `attacker`؟
 */
function isSquareAttacked(board, target, attacker) {
  for (const [key, piece] of Object.entries(board)) {
    if (!piece || piece.owner !== attacker) continue;
    const raw = Pieces.getRawMoves(key, board, null);
    if (raw.includes(target)) return true;
  }
  return false;
}

/**
 * هل الملك `owner` في كِش؟
 */
function isInCheck(board, owner, players) {
  const kingKey = findKing(board, owner);
  if (!kingKey) return false;
  const opponents = players.filter(p => p.id !== owner && p.active);
  return opponents.some(p => isSquareAttacked(board, kingKey, p.id));
}

/**
 * الحركات القانونية (بعد استبعاد ما يُبقي الملك في كِش)
 */
function getLegalMoves(board, fromKey, players, enPassantTarget) {
  const piece = board[fromKey];
  if (!piece) return [];
  const raw = Pieces.getRawMoves(fromKey, board, enPassantTarget);
  const legal = [];
  for (const to of raw) {
    const simBoard = applyMoveToBoard(board, fromKey, to);
    if (!isInCheck(simBoard, piece.owner, players)) {
      legal.push(to);
    }
  }
  // إضافة التبييت
  const castles = getCastlingMoves(board, fromKey, players);
  legal.push(...castles);
  return legal;
}

/**
 * التبييت — يتحقق من شروطه الكلاسيكية على كل قطاع
 */
function getCastlingMoves(board, kingKey, players) {
  const piece = board[kingKey];
  if (!piece || piece.type !== "K" || piece.moved) return [];
  const { sector, col, row } = Board.parseSq(kingKey);
  if (col !== 5 || row !== 4) return []; // الملك في موضعه الأصلي

  const owner = piece.owner;
  const moves = [];

  // التبييت القصير (عمود 8)
  const rook8Key = Board.sq(sector, 8, 4);
  if (canCastle(board, owner, kingKey, rook8Key, [6,7], players)) {
    moves.push(Board.sq(sector, 7, 4));
  }
  // التبييت الطويل (عمود 1)
  const rook1Key = Board.sq(sector, 1, 4);
  if (canCastle(board, owner, kingKey, rook1Key, [2,3,4], players)) {
    moves.push(Board.sq(sector, 3, 4));
  }
  return moves;
}

function canCastle(board, owner, kingKey, rookKey, emptyColsOnRow4, players) {
  const rook = board[rookKey];
  if (!rook || rook.type !== "R" || rook.moved || rook.owner !== owner) return false;
  const { sector } = Board.parseSq(kingKey);
  // التحقق من فراغ الخانات البينية
  for (const c of emptyColsOnRow4) {
    if (board[Board.sq(sector, c, 4)]) return false;
  }
  // الملك لا يمر بكِش
  if (isInCheck(board, owner, players)) return false;
  const passCols = emptyColsOnRow4.slice(0, 2);
  for (const c of passCols) {
    const sim = applyMoveToBoard(board, kingKey, Board.sq(sector, c, 4));
    if (isInCheck(sim, owner, players)) return false;
  }
  return true;
}

/**
 * هل اللاعب في كِش مات (لا توجد حركة قانونية واحدة)؟
 */
function isCheckmate(board, owner, players, enPassantTarget) {
  if (!isInCheck(board, owner, players)) return false;
  for (const [key, piece] of Object.entries(board)) {
    if (!piece || piece.owner !== owner) continue;
    if (getLegalMoves(board, key, players, enPassantTarget).length > 0) return false;
  }
  return true;
}

/**
 * هل اللاعب في تعادل (stalemate)؟
 */
function isStalemate(board, owner, players, enPassantTarget) {
  if (isInCheck(board, owner, players)) return false;
  for (const [key, piece] of Object.entries(board)) {
    if (!piece || piece.owner !== owner) continue;
    if (getLegalMoves(board, key, players, enPassantTarget).length > 0) return false;
  }
  return true;
}

/**
 * تنفيذ حركة التبييت فعلياً (تحريك الرخ أيضاً)
 */
function executeCastling(board, kingFrom, kingTo) {
  const { sector, col: kCol } = Board.parseSq(kingFrom);
  const { col: toCol } = Board.parseSq(kingTo);

  let rookFrom, rookTo;
  if (toCol > kCol) {
    // تبييت قصير
    rookFrom = Board.sq(sector, 8, 4);
    rookTo   = Board.sq(sector, 6, 4);
  } else {
    // تبييت طويل
    rookFrom = Board.sq(sector, 1, 4);
    rookTo   = Board.sq(sector, 4, 4);
  }

  board[kingTo]   = board[kingFrom]; board[kingTo].moved   = true;
  board[kingFrom] = null;
  board[rookTo]   = board[rookFrom]; board[rookTo].moved   = true;
  board[rookFrom] = null;
}

const Rules = {
  cloneBoard, applyMoveToBoard, findKing,
  isSquareAttacked, isInCheck,
  getLegalMoves, getCastlingMoves, canCastle,
  isCheckmate, isStalemate, executeCastling,
};
