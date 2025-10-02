// Global asset paths injected from the Jinja template
const ASSET_PATHS = window.ASSET_PATHS || {};

// DOM Elements
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("score");
const musicControl = document.getElementById("musicControl");

// Constants
const TILE_WIDTH = 64; 
const TILE_HEIGHT = 64;
const GRAVITY = 1;

// Game State
let gameState = {
    GROUND_Y: 0,
    coins: [],
    score: 0
};

// ===================================
// I. MUSIC
// ===================================

// Background music setup
let bgMusic = new Audio;
let musicEnabled = false;
let musicLoaded = false;

if (musicControl && ASSET_PATHS.music) {
    bgMusic.src = ASSET_PATHS.music;
    bgMusic.loop = true;
    bgMusic.volume = 0.3;

    bgMusic.addEventListener('canplaythrough', () => {
        musicLoaded = true;
        musicControl.textContent = "🔊 Music: OFF (Click to play)";
    });

    bgMusic.addEventListener('error', () => {
        musicControl.textContent = "🔇 No music file";
        musicControl.style.opacity = "0.5";
        musicControl.style.cursor = "default";
        console.log("Music file not found!");
    });

    musicControl.addEventListener("click", () => {
        if (!musicLoaded) return;
        
        musicEnabled = !musicEnabled;
        if (musicEnabled) {
            bgMusic.play().catch(e => console.error("Audio play failed:", e));
            musicControl.textContent = "🔊 Music: ON (Click to toggle)";
        } else {
            bgMusic.pause();
            musicControl.textContent = "🔇 Music: OFF (Click to play)";
        }
    });
}

let musicStarted = false;
function tryStartMusic() {
    if (!musicStarted && musicEnabled && musicLoaded && bgMusic) {
        bgMusic.play().catch(e => console.error("Audio play failed:", e));
        musicStarted = true;
    }
}
document.addEventListener("keydown", tryStartMusic, { once: true });
canvas.addEventListener("click", tryStartMusic, { once: true });

// ===================================
// II. CANVAS & IMAGE ASSET SETUP
// ===================================

// Make canvas responsive
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameState.GROUND_Y = canvas.height - TILE_HEIGHT; // ground level
}
window.addEventListener("resize", resizeCanvas);

// Load sprites using the paths provided by Jinja
const bgImg = new Image();
bgImg.src = ASSET_PATHS.bg;

const groundTile = new Image();
groundTile.src = ASSET_PATHS.ground;

const coinImg = new Image();
coinImg.src = ASSET_PATHS.coin;

const animations = {
    idle: { img: new Image(), frames: 4 },
    walk: { img: new Image(), frames: 8 },
    run:  { img: new Image(), frames: 7 },
    jump: { img: new Image(), frames: 6 }
};

animations.idle.img.src = ASSET_PATHS.idle;
animations.walk.img.src = ASSET_PATHS.walk;
animations.run.img.src = ASSET_PATHS.run;
animations.jump.img.src = ASSET_PATHS.jump;

// ===================================
// III. PLAYER & MOVEMENT SETUP
// ===================================

// Player Setup: Initial position will be set after resizeCanvas()
let player = { 
    x: 50, 
    y: gameState.GROUND_Y - 128, // start above ground, 
    w: 128, 
    h: 128,
    cw: 0, // collision width
    ch: 0, // collision height
    cxOff: 0, // x offset to center hitbox
    cyOff: 0, // y offset to raise hitbox
    dy: 0, 
    vx: 0, // horizontal velocity
    accel: 0, // how quickly to reach target speed (lower = smoother)
    maxSpeed: 0, // walking speed
    runMultiplier: 0, // running boost
    friction: 0, // slows player when no key is pressed
    isRunning: false, 
    jumping: false, 
    facing: 1,
    frame: 0,
    frameTimer: 0,
    frameInterval: 10,
    currentAnim: "idle",
    debugW: 0,
    debugH: 0,
    debugX: 0,
    debugY: 0
};

// Define relative size of hitbox (percent of sprite)
const hitboxWidthRatio = 0.3;  // 30% of sprite width
const hitboxHeightRatio = 0.5; // 50% of sprite height

// Set player variables: hitbox relative to sprite
player.cw = player.w * 0.3; // Setting collision width for player object
player.ch = player.h * 0.5; // Setting collision height for player object
player.cxOff = (player.w - player.cw) / 6;  // Center horizontally
player.cyOff = player.h - player.ch;  // Start hitbox at ground/feet level

// Set player variables: Add velocity and movement tuning to player
player.accel = 0.2;
player.maxSpeed = 4;   
player.runMultiplier = 1.8;
player.friction = 0.1;

// Debug box dimensions (optional, just mirrors actual box's dimensions)
player.debugW = player.cw;
player.debugH = player.ch;

// Key state tracker
let keys = {};

// Key listeners for movement
document.addEventListener("keydown", e => {
    keys[e.code] = true;
    if (e.code === "Space" && !player.jumping) {
        player.dy = -15; // Jump strength
        player.jumping = true;
    }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { 
        player.isRunning = true;
    }
});

document.addEventListener("keyup", e => {
    keys[e.code] = false;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        player.isRunning = false;
    }
});

// Player collision box fully defined
// Helper function to get the player's collision box coordinates (top-left corner)
// i.e: Returns px, py = top-left corner coordinates of the player's collision box
function getPlayerCollisionBox() {
    const px = player.facing === 1
        ? player.x + player.cxOff // Facing right
        : player.x + (player.w - player.cxOff - player.cw); // Adjust if facing left
    const py = player.y + player.cyOff;

    return { px: px, py: py };
}

// ===================================
// IV. GAME LOGIC / UPDATE
// ===================================

function updatePlayer() {

    // 1. Gravity and Vertical Movement
    // Gravity: Use the consistent GROUND_Y value for collision
    player.dy += GRAVITY;
    player.y += player.dy;
    // Check for ground collision using the player's full sprite height
    if (player.y >= gameState.GROUND_Y - player.h) {
        // Bind player position exactly to the ground
        player.y = gameState.GROUND_Y - player.h;
        player.dy = 0;
        player.jumping = false;
    }
    
    // 2. Horizontal Smooth Movement  
    let targetSpeed = 0;
    if (keys["ArrowLeft"]) targetSpeed = -player.maxSpeed;
    if (keys["ArrowRight"]) targetSpeed = player.maxSpeed;

    // Apply running multiplier
    if (player.isRunning) targetSpeed *= player.runMultiplier;

    // Accelerate towards target speed
    player.vx += (targetSpeed - player.vx) * player.accel;

    // Apply friction if no key pressed
    if (!keys["ArrowLeft"] && !keys["ArrowRight"]) {
        player.vx *= (1 - player.friction);
    }

    // Update player position
    player.x += player.vx;

    // Update facing depending on velocity
    if (player.vx > 0.1) player.facing = 1;
    if (player.vx < -0.1) player.facing = -1;

    // Boundary check using collision box
    const { px } = getPlayerCollisionBox();
    // Prevent going off screen
    if (px < 0) {
        player.x -= px; // Look right so box aligns with 0
        player.vx = 0;
    }
    if (px + player.cw > canvas.width) {
        player.x -= (px + player.cw - canvas.width); // Look left
        player.vx = 0;
    }

    // Update animation based on state
    if (player.jumping) {
        player.currentAnim = "jump";
    } else if (keys["ArrowLeft"] || keys["ArrowRight"]) {
        player.currentAnim = player.isRunning ? "run" : "walk";
    } else {
        player.currentAnim = "idle";
    }

    // Frame stepping
    let anim = animations[player.currentAnim];
    if (anim.img.complete) {
        player.frameTimer++;
        if (player.frameTimer > player.frameInterval) {
            player.frame = (player.frame + 1) % anim.frames; // Loop animation
            player.frameTimer = 0;
        }
    }
}

function checkCoinCollision() {
    const { px, py } = getPlayerCollisionBox();
    const pw = player.cw;
    const ph = player.ch;

    // Check for coin collection using player's collision box
    gameState.coins = gameState.coins.filter(c => {
        // Coin collision box
        const cx = c.x;
        const cy = c.y;
        const cw = c.w;
        const ch = c.h;

        // AABB: Axis-Aligned Bounding Box Collision Check (Overlap)
        let hit = 
            px < cx + cw &&
            px + pw > cx &&
            py < cy + ch &&
            py + ph > cy;

        if (hit) {
            gameState.score++;
            scoreDisplay.textContent = "Coins: " + gameState.score;
        }
        return !hit; // remove if collected
    });
}

// Coin rotation
let coinAngle = 0;
function updateCoinRotation() {
    coinAngle += 0.05; // rotation speed
}

// Game loop logic
function update() {

    // Update player
    updatePlayer();

    // Continued checking for coin collisions
    checkCoinCollision();

    // Update coin rotation
    updateCoinRotation();

}

// ===================================
// V. DRAWING
// ===================================

// Draw ground tiles
function drawGround() {
    for (let x = 0; x < canvas.width; x += TILE_WIDTH) {
        ctx.drawImage(groundTile, x, gameState.GROUND_Y, TILE_WIDTH, TILE_HEIGHT);
    }
}

// Draw player sprite
function drawPlayer() {
    let anim = animations[player.currentAnim];
    if (!anim.img.complete) return;

    // Auto-calculate frame dimensions
    let frameW = anim.img.width / anim.frames;
    let frameH = anim.img.height;

    // Pick slice based on current frame
    let sx = player.frame * frameW;

    // Use consistent drawing method that doesn't cause position shifts
    ctx.save();
    
    // When facing left, translate to the RIGHT edge of the sprite
    // then flip, so the sprite stays in the same world position
    if (player.facing === -1) {
        // Flip logic: Translate to the right edge of the sprite, then scale by -1
        ctx.translate(player.x + player.w, player.y);
        ctx.scale(-1, 1);
        ctx.drawImage(
            anim.img,
            sx, 0, frameW, frameH,
            0, 0,
            player.w, player.h
        );
    } else {
        // Normal draw for facing right
        ctx.translate(player.x, player.y);
        ctx.drawImage(
            anim.img,
            sx, 0, frameW, frameH,
            0, 0,
            player.w, player.h
        );
    }

    ctx.restore();

    const { px, py } = getPlayerCollisionBox();
    // Update debug box position to match player collision box
    player.debugX = px;
    player.debugY = py;

    // Debug hitbox - purely for visualization
    // ctx.strokeStyle = "red";
    // ctx.lineWidth = 1;
    // ctx.strokeRect(
    //     player.debugX,
    //     player.debugY,
    //     player.debugW,
    //     player.debugH
    // ); 
}

function drawCoin(c, angle) {
    ctx.save();
    ctx.translate(c.x + c.w/2, c.y + c.h/2);
    ctx.rotate(angle);
    ctx.drawImage(coinImg, -c.w/2, -c.h/2, c.w, c.h);
    ctx.restore();
}

function draw() {

    // Background
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    // Ground tiles
    drawGround();

    // Player
    drawPlayer();

    // Coins
    gameState.coins.forEach(c => drawCoin(c, coinAngle));

}

// ===================================
// VI. INITIALIZATION & LOOP
// ===================================

// Spawn coins at random positions
function spawnCoin() {
    let x = Math.random() * (canvas.width - 32);
    // Spawn coins between 50 pixels and 150 pixels above the ground line
    const MIN_Y_OFFSET = 150; 
    const MAX_Y_OFFSET = 50; 
    let randomOffset = Math.random() * (MIN_Y_OFFSET - MAX_Y_OFFSET) + MAX_Y_OFFSET;
    let y = gameState.GROUND_Y - randomOffset;
    gameState.coins.push({ x, y, w: 32, h: 32 });
}
setInterval(spawnCoin, 5000);

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Wait for ALL images to load before starting the loop
const allAssets = [
    bgImg, 
    groundTile, 
    coinImg,
    animations.idle.img,
    animations.walk.img,
    animations.run.img,
    animations.jump.img 
];
let assetsLoaded = 0;

allAssets.forEach(img => {
    img.onload = () => {
        assetsLoaded++;
        if (assetsLoaded === allAssets.length) {
            console.log("All assets loaded. Starting game loop.");
            resizeCanvas(); // Initial call to set size and GROUND_Y
            loop(); 
        }
    };
    img.onerror = (e) => {
        // Fallback for missing/misnamed assets (like your previous case-sensitivity issue)
        console.error(`Failed to load asset: ${img.src}. Check capitalization/path.`);
        // To prevent blocking the game, we can choose to proceed if it's not a critical asset.
        assetsLoaded++; 
        if (assetsLoaded === allAssets.length) {
            console.log("Starting game loop with missing asset(s).");
            resizeCanvas();
            loop(); 
        }
    };
});
