// Expects firebase to be initialized and window.user to be set

const db = firebase.database();

// ==== GAME CONSTANTS ====
const TILE_SIZE = 32;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 15;

const COLORS = {
  grass: "#4CAF50",
  dirt: "#8D5524",
  player: "#2196F3",
  other: "#FF9800",
  block: "#D4AF37"
};

// ==== GAME STATE ====
let playerId = window.user.uid; // Use Firebase UID for player ID
let player = {
  id: playerId,
  x: Math.floor(GRID_WIDTH / 2),
  y: Math.floor(GRID_HEIGHT / 2),
  color: COLORS.player,
  displayName: window.user.isAnonymous ? "Guest" : (window.user.displayName || window.user.email || "User")
};

let players = {};
let blocks = {};

// ==== CANVAS ====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ==== INPUT ====
let currentMode = "place"; // or "remove"
document.getElementById("placeBlockBtn").onclick = () => currentMode = "place";
document.getElementById("removeBlockBtn").onclick = () => currentMode = "remove";

// ==== FIREBASE SYNC ====
// Player position
function updatePlayerInFirebase() {
  db.ref("players/" + playerId).set(player);
}
// Remove player on disconnect
db.ref("players/" + playerId).onDisconnect().remove();

// Listen for all players
db.ref("players").on("value", snap => {
  players = snap.val() || {};
});

// Listen for all blocks
db.ref("blocks").on("value", snap => {
  blocks = snap.val() || {};
});

// Place or remove block in Firebase
function setBlock(x, y, present) {
  const key = x + "_" + y;
  if (present) {
    db.ref("blocks/" + key).set({x, y, type: "block"});
  } else {
    db.ref("blocks/" + key).remove();
  }
}

// ==== GAME LOOP ====
// Draw world grid, blocks, players
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw tiles
  for(let y = 0; y < GRID_HEIGHT; y++) {
    for(let x = 0; x < GRID_WIDTH; x++) {
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#333";
      ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  // Draw blocks
  for (const key in blocks) {
    const b = blocks[key];
    ctx.fillStyle = COLORS.block;
    ctx.fillRect(b.x * TILE_SIZE, b.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = "#b8860b";
    ctx.strokeRect(b.x * TILE_SIZE, b.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  // Draw all players
  for (const id in players) {
    const p = players[id];
    ctx.fillStyle = (id === playerId) ? COLORS.player : COLORS.other;
    ctx.fillRect(p.x * TILE_SIZE + 4, p.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);

    // Draw player names
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    const name = p.displayName || (id === playerId ? "You" : "Player");
    ctx.fillText(name, p.x * TILE_SIZE + 2, p.y * TILE_SIZE + 12);
  }
}

function gameLoop() {
  draw();
  requestAnimationFrame(gameLoop);
}
gameLoop();

// ==== PLAYER MOVEMENT ====
window.addEventListener("keydown", function(e) {
  let moved = false;
  if (e.key === "ArrowUp" && player.y > 0) { player.y--; moved = true; }
  if (e.key === "ArrowDown" && player.y < GRID_HEIGHT - 1) { player.y++; moved = true; }
  if (e.key === "ArrowLeft" && player.x > 0) { player.x--; moved = true; }
  if (e.key === "ArrowRight" && player.x < GRID_WIDTH - 1) { player.x++; moved = true; }
  if (moved) {
    updatePlayerInFirebase();
  }
});

// ==== BLOCK PLACING/REMOVAL ====
canvas.addEventListener("click", function(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = Math.floor((e.clientX - rect.left) / TILE_SIZE);
  const my = Math.floor((e.clientY - rect.top) / TILE_SIZE);

  if (mx === player.x && my === player.y) return; // Don't place on self

  if (currentMode === "place") {
    setBlock(mx, my, true);
  } else if (currentMode === "remove") {
    setBlock(mx, my, false);
  }
});

// ==== INIT ====
updatePlayerInFirebase();
