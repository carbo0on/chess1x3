"use strict";
/**
 * game.js — إدارة حالة اللعبة، الأدوار، الفوز
 */

const TURN_ORDER = ["white", "black", "red"];

const PLAYER_SECTOR = { white: "W", black: "B", red: "R" };
// تصدير لاستخدامه في pieces.js
Board.PLAYER_SECTOR = PLAYER_SECTOR;

function createGameState() {
  const board = Board.createInitialBoard();
  Board.placeInitialPieces(board);
  return {
    board,
    players: [
      { id: "white", name: "اللاعب 1 (أبيض)", active: true, inCheck: false, captured: [] },
      { id: "black", name: "اللاعب 2 (أسود)", active: true, inCheck: false, captured: [] },
      { id: "red",   name: "اللاعب 3 (أحمر)", active: true, inCheck: false, captured: [] },
    ],
    currentTurnIndex: 0,
    selectedSquare: null,
    legalMoves: [],
    moveHistory: [],
    enPassantTarget: null, // مفتاح خانة الأخذ بالتجاوز
    status: "playing",     // playing | finished
    winner: null,
    pendingPromotion: null, // { from, to } انتظار اختيار الترقية
  };
}

let gameState = createGameState();

function currentPlayer() {
  return gameState.players[gameState.currentTurnIndex];
}

function getPlayerById(id) {
  return gameState.players.find(p => p.id === id);
}

function nextTurn() {
  let idx = gameState.currentTurnIndex;
  for (let i = 0; i < 3; i++) {
    idx = (idx + 1) % 3;
    if (gameState.players[idx].active) {
      gameState.currentTurnIndex = idx;
      break;
    }
  }
  updateCheckStatus();
  checkForGameEnd();
}

function updateCheckStatus() {
  const activePlayers = gameState.players.filter(p => p.active);
  for (const p of gameState.players) {
    p.inCheck = p.active && Rules.isInCheck(gameState.board, p.id, activePlayers);
  }
}

function checkForGameEnd() {
  const activePlayers = gameState.players.filter(p => p.active);
  const cur = currentPlayer();
  if (!cur) return;

  if (Rules.isCheckmate(gameState.board, cur.id, activePlayers, gameState.enPassantTarget)) {
    // خيار A: أول كِش مات → اللاعب السابق يفوز
    const prev = gameState.players.find(p => p.active && p.id !== cur.id) || null;
    // نجد من حقق الكِش مات (آخر من لعب)
    const lastMover = findLastMover();
    gameState.status = "finished";
    gameState.winner = lastMover;
    return;
  }

  if (Rules.isStalemate(gameState.board, cur.id, activePlayers, gameState.enPassantTarget)) {
    // تعادل: تخطّي الدور
    nextTurn();
  }
}

function findLastMover() {
  const hist = gameState.moveHistory;
  if (!hist.length) return null;
  return hist[hist.length - 1].player;
}

/**
 * اختيار خانة أو تنفيذ حركة
 */
function handleSquareClick(key) {
  if (gameState.status !== "playing") return;
  if (gameState.pendingPromotion) return;

  const cur = currentPlayer();
  const piece = gameState.board[key];

  if (gameState.selectedSquare) {
    // إذا النقر على خانة قانونية → تنفيذ
    if (gameState.legalMoves.includes(key)) {
      executeMove(gameState.selectedSquare, key);
      return;
    }
    // إذا النقر على قطعة أخرى لنفس اللاعب → تغيير التحديد
    if (piece && piece.owner === cur.id) {
      selectSquare(key);
      return;
    }
    // إلغاء التحديد
    deselectSquare();
    return;
  }

  // لا شيء محدد: تحديد قطعة
  if (piece && piece.owner === cur.id) {
    selectSquare(key);
  }
}

function selectSquare(key) {
  gameState.selectedSquare = key;
  const activePlayers = gameState.players.filter(p => p.active);
  gameState.legalMoves = Rules.getLegalMoves(
    gameState.board, key, activePlayers, gameState.enPassantTarget
  );
  UI.renderBoard();
}

function deselectSquare() {
  gameState.selectedSquare = null;
  gameState.legalMoves = [];
  UI.renderBoard();
}

function executeMove(from, to) {
  const board = gameState.board;
  const piece = board[from];
  const captured = board[to];

  // التحقق من التبييت
  const isCastling = piece.type === "K" && Math.abs(
    Board.parseSq(from).col - Board.parseSq(to).col
  ) === 2;

  // الأخذ بالتجاوز
  let enPassantCaptureKey = null;
  if (piece.type === "P" && to === gameState.enPassantTarget) {
    // القطعة المأسورة خلف المربع الهدف
    enPassantCaptureKey = findEnPassantPawn(to, piece.owner);
  }

  // تحديث en passant target للدور التالي
  gameState.enPassantTarget = null;
  if (piece.type === "P") {
    const { row: fromRow } = Board.parseSq(from);
    const { row: toRow } = Board.parseSq(to);
    if (Math.abs(fromRow - toRow) === 2) {
      // خانة التجاوز: الخانة البينية
      const midKey = Board.NEIGHBORS[from]?.["down"];
      gameState.enPassantTarget = midKey || null;
    }
  }

  if (isCastling) {
    Rules.executeCastling(board, from, to);
  } else {
    if (captured) {
      getPlayerById(piece.owner).captured.push(captured.type);
    }
    if (enPassantCaptureKey) {
      const epPiece = board[enPassantCaptureKey];
      if (epPiece) getPlayerById(piece.owner).captured.push(epPiece.type);
      board[enPassantCaptureKey] = null;
    }
    board[to] = piece;
    board[to].moved = true;
    board[from] = null;
  }

  // سجل الحركة
  const moveLabel = buildMoveLabel(piece, from, to, captured, isCastling);
  gameState.moveHistory.push({ player: piece.owner, from, to, label: moveLabel });

  gameState.selectedSquare = null;
  gameState.legalMoves = [];

  // ترقية البيدق؟
  if (piece.type === "P" && Pieces.isPawnPromotion(to, piece.owner)) {
    gameState.pendingPromotion = { from, to };
    UI.renderBoard();
    UI.showPromotionModal();
    return;
  }

  nextTurn();
  UI.renderBoard();
  UI.updateUI();
}

function findEnPassantPawn(target, owner) {
  // البيدق المأسور يقع في نفس العمود لكن الصف البينية
  const { sector, col } = Board.parseSq(target);
  // نبحث في الصف المجاور (up من الهدف = صف سابق للمتحرّك)
  const upKey = Board.NEIGHBORS[target]?.["up"];
  if (upKey && gameState.board[upKey]?.type === "P" && gameState.board[upKey]?.owner !== owner) {
    return upKey;
  }
  return null;
}

function promotePane(pieceType) {
  if (!gameState.pendingPromotion) return;
  const { to } = gameState.pendingPromotion;
  const piece = gameState.board[to];
  if (piece) piece.type = pieceType;
  gameState.pendingPromotion = null;
  UI.hidePromotionModal();
  nextTurn();
  UI.renderBoard();
  UI.updateUI();
}

function buildMoveLabel(piece, from, to, captured, isCastling) {
  if (isCastling) {
    const { col: toCol } = Board.parseSq(to);
    return toCol > 4 ? "O-O" : "O-O-O";
  }
  const sym = Pieces.PIECE_LABELS[piece.type];
  const cap = captured ? "×" : "-";
  return `${sym} ${from}${cap}${to}`;
}

function resetGame() {
  gameState = createGameState();
  UI.renderBoard();
  UI.updateUI();
}

const Game = {
  get state() { return gameState; },
  createGameState, currentPlayer, getPlayerById,
  handleSquareClick, executeMove, promotePane, resetGame,
};
