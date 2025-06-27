// main.js
// Import Three.js and Firebase modules
import * as THREE from "https://cdn.skypack.dev/three@0.155.0";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

// Firebase app and analytics are already initialized in your HTML as per instructions

// DOM elements
const canvas = document.getElementById("gameCanvas");
const loginBox = document.getElementById("loginBox");
const usernameInput = document.getElementById("usernameInput");
const joinBtn = document.getElementById("joinBtn");

// Game/player state
let playerObj = null;
let players = new Map();
let lastSentPos = {x: 0, y: 0, z: 0};
let playerId = "";
let playerName = "";
let playerColor = null;
let authUser = null;

// Utility: random color for player
function randomColor() {
  const colors = [0x4FC3F7, 0xF44336, 0x8BC34A, 0xFFD600, 0xAB47BC, 0xFF9800];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Require authentication before game loads
const auth = getAuth();
onAuthStateChanged(auth, user => {
  if (!user) {
    // Not authenticated, redirect to auth page
    window.location.href = "auth.html";
  } else {
    // Authenticated, use their info
    authUser = user;
    playerId = user.uid;
    playerName = user.displayName || user.email || "Anonymous";
    playerColor = randomColor();

    // Hide username box (since we use their account info)
    if (loginBox) loginBox.style.display = "none";
    startGame();
  }
});

function startGame() {
  // Three.js scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x99ccff);

  // Camera
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // Simple block world: 10x1x10 grass
  const blocks = [];
  const blockGeo = new THREE.BoxGeometry(1,1,1);
  const blockMat = new THREE.MeshLambertMaterial({ color: 0x43a047 });
  for(let x=-5;x<5;x++) for(let z=-5;z<5;z++) {
    const block = new THREE.Mesh(blockGeo, blockMat);
    block.position.set(x,0,z);
    scene.add(block);
    blocks.push(block);
  }

  // Player model: simple colored cube
  function createPlayer(color) {
    const mat = new THREE.MeshLambertMaterial({ color });
    const geo = new THREE.BoxGeometry(0.7,1.6,0.7);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  // Main player
  playerObj = createPlayer(playerColor);
  playerObj.position.set(0, 1, 0);
  scene.add(playerObj);

  // Movement controls
  let move = {forward: false, backward: false, left: false, right: false, up: false, down: false};
  document.addEventListener('keydown', (e) => {
    if(e.code === 'KeyW') move.forward = true;
    if(e.code === 'KeyS') move.backward = true;
    if(e.code === 'KeyA') move.left = true;
    if(e.code === 'KeyD') move.right = true;
    if(e.code === 'Space') move.up = true;
    if(e.code === 'ShiftLeft') move.down = true;
  });
  document.addEventListener('keyup', (e) => {
    if(e.code === 'KeyW') move.forward = false;
    if(e.code === 'KeyS') move.backward = false;
    if(e.code === 'KeyA') move.left = false;
    if(e.code === 'KeyD') move.right = false;
    if(e.code === 'Space') move.up = false;
    if(e.code === 'ShiftLeft') move.down = false;
  });

  // Mouse to rotate camera
  let yaw = 0, pitch = 0, mouseDown = false;
  canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
  canvas.addEventListener('click', () => { canvas.requestPointerLock(); });
  document.addEventListener('pointerlockchange', () => {
    mouseDown = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if(mouseDown) {
      yaw -= e.movementX * 0.002;
      pitch -= e.movementY * 0.002;
      pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    }
  });

  // Firebase: show all players
  const db = getDatabase();
  const playersRef = ref(db, "mc3d/players");
  onValue(playersRef, (snap) => {
    const data = snap.val() || {};
    for (const id in data) {
      if (id === playerId) continue;
      if (!players.has(id)) {
        const p = createPlayer(data[id].color || 0x888888);
        scene.add(p);
        players.set(id, p);
      }
      const p = players.get(id);
      const pos = data[id].pos || {x:0,y:1,z:0};
      p.position.set(pos.x, pos.y, pos.z);
    }
    // Remove disconnected
    for (const id of players.keys()) {
      if (!data[id]) {
        scene.remove(players.get(id));
        players.delete(id);
      }
    }
  });

  // Save player to Firebase
  function updatePlayerPos() {
    set(ref(db, `mc3d/players/${playerId}`), {
      name: playerName,
      color: playerColor,
      pos: { x: playerObj.position.x, y: playerObj.position.y, z: playerObj.position.z }
    });
  }

  // Remove player on close
  window.addEventListener('beforeunload', () => {
    remove(ref(db, `mc3d/players/${playerId}`));
  });

  // Game loop
  function animate() {
    // Movement
    let speed = 0.06;
    let dx = 0, dz = 0;
    if(move.forward) dz -= speed;
    if(move.backward) dz += speed;
    if(move.left) dx -= speed;
    if(move.right) dx += speed;
    // Camera direction
    const sinYaw = Math.sin(yaw), cosYaw = Math.cos(yaw);
    playerObj.position.x += dx * cosYaw - dz * sinYaw;
    playerObj.position.z += dx * sinYaw + dz * cosYaw;
    if(move.up) playerObj.position.y += speed;
    if(move.down) playerObj.position.y -= speed;
    // Gravity
    if(playerObj.position.y > 1) playerObj.position.y -= 0.09;
    if(playerObj.position.y < 1) playerObj.position.y = 1;

    // Camera follows player
    camera.position.x = playerObj.position.x - 4 * Math.sin(yaw);
    camera.position.y = playerObj.position.y + 2 + 2 * Math.sin(pitch);
    camera.position.z = playerObj.position.z - 4 * Math.cos(yaw);
    camera.lookAt(playerObj.position.x, playerObj.position.y + 0.7, playerObj.position.z);

    // Send position to Firebase if moved
    const px = Math.round(playerObj.position.x*100)/100, py = Math.round(playerObj.position.y*100)/100, pz = Math.round(playerObj.position.z*100)/100;
    if (Math.abs(px-lastSentPos.x)>0.02 || Math.abs(py-lastSentPos.y)>0.02 || Math.abs(pz-lastSentPos.z)>0.02) {
      updatePlayerPos();
      lastSentPos = {x: px, y: py, z: pz};
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
  // Initial player upload
  updatePlayerPos();
  window.focus();
}

// Resize handler (optional, can be improved)
window.addEventListener('resize', () => {
  // You may want to update Three.js camera/renderer here
});
