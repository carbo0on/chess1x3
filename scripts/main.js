"use strict";
/**
 * main.js — نقطة دخول اللعبة
 */

document.addEventListener("DOMContentLoaded", () => {
  // رسم اللوحة الابتدائية
  UI.renderBoard();
  UI.updateUI();

  // زر لعبة جديدة
  document.getElementById("btn-new-game").addEventListener("click", () => {
    document.getElementById("gameover-modal").classList.add("hidden");
    Game.resetGame();
  });

  // زر "العب مجدداً" في نافذة نهاية اللعبة
  document.getElementById("btn-play-again").addEventListener("click", () => {
    document.getElementById("gameover-modal").classList.add("hidden");
    Game.resetGame();
  });

  // أزرار الترقية
  document.querySelectorAll(".promo-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pieceType = btn.getAttribute("data-piece");
      Game.promotePane(pieceType);
    });
  });
});
