const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const levelName = document.getElementById("levelName");
const statusText = document.getElementById("statusText");
const coinsText = document.getElementById("coins");
const livesText = document.getElementById("lives");
const startPanel = document.getElementById("startPanel");
const startButton = document.getElementById("startButton");
const startPanelText = startPanel.querySelector("p");
const touchButtons = document.querySelectorAll(".touch-button[data-key]");

const WIDTH = 960;
const HEIGHT = 540;
const TILE = 32;
const GRAVITY = 0.78;
const MOVE_SPEED = 4.25;
const JUMP_FORCE = -15.4;

canvas.width = WIDTH;
canvas.height = HEIGHT;

const keys = new Set();
let cameraX = 0;
let levelIndex = 0;
let totalButtons = 0;
let running = false;
let messageTimer = 0;
let message = "Setas/WASD movem, espaco pula, R reinicia.";
let audioCtx = null;
let masterGain = null;
let musicTimer = null;
let musicStep = 0;

const levels = [
    {
        name: "Fase 1 - Colina dos Ventos",
        width: 2750,
        sky: ["#82d7f4", "#b8f3e4"],
        ground: "#6bbd45",
        dirt: "#9a6330",
        start: { x: 80, y: 380 },
        flag: { x: 2590, y: 332 },
        platforms: [
            [0, 492, 2750, 48], [190, 410, 150, 22], [430, 350, 140, 22],
            [660, 286, 150, 22], [960, 380, 190, 22], [1270, 326, 150, 22],
            [1530, 268, 170, 22], [1860, 374, 190, 22], [2190, 318, 170, 22],
            [2460, 392, 190, 22]
        ],
        buttons: [[250, 380], [492, 318], [735, 254], [1038, 348], [1338, 294], [1610, 236], [1955, 342], [2268, 286], [2548, 360]],
        enemies: [[585, 464, 90, "buttonbug"], [1760, 464, 130, "thimble"]],
        springs: [[1440, 454]]
    },
    {
        name: "Fase 2 - Turbinas nas Nuvens",
        width: 3180,
        sky: ["#77bfff", "#f7e486"],
        ground: "#55b66a",
        dirt: "#80552b",
        start: { x: 70, y: 360 },
        flag: { x: 3020, y: 268 },
        platforms: [
            [0, 492, 520, 48], [650, 452, 180, 22], [930, 390, 160, 22],
            [1190, 330, 150, 22], [1450, 270, 150, 22], [1740, 336, 180, 22],
            [2030, 410, 160, 22], [2310, 350, 170, 22], [2600, 292, 180, 22],
            [2900, 328, 280, 48]
        ],
        buttons: [[720, 420], [1005, 358], [1264, 298], [1525, 238], [1825, 304], [2110, 378], [2395, 318], [2692, 260], [3020, 296]],
        enemies: [[770, 424, 60, "buttonbug"], [1810, 308, 80, "thimble"], [2385, 322, 75, "buttonbug"]],
        springs: [[560, 454], [1660, 452]]
    },
    {
        name: "Fase 3 - Castelo dos Ventos",
        width: 3450,
        sky: ["#7e9ded", "#ffc7a8"],
        ground: "#4fa35e",
        dirt: "#6b4a37",
        start: { x: 80, y: 360 },
        flag: { x: 3290, y: 266 },
        platforms: [
            [0, 492, 520, 48], [610, 428, 150, 22], [870, 360, 140, 22],
            [1110, 292, 150, 22], [1390, 394, 180, 22], [1660, 320, 150, 22],
            [1930, 252, 170, 22], [2220, 360, 190, 22], [2510, 414, 150, 22],
            [2770, 342, 170, 22], [3070, 292, 380, 48]
        ],
        buttons: [[685, 396], [940, 328], [1185, 260], [1480, 362], [1735, 288], [2015, 220], [2315, 328], [2585, 382], [2855, 310], [3300, 260]],
        enemies: [[705, 400, 58, "buttonbug"], [1455, 366, 80, "thimble"], [2295, 332, 92, "buttonbug"], [3170, 264, 115, "thimble"]],
        springs: [[540, 454], [1320, 454], [2700, 454]]
    }
];

class Player {
    constructor() {
        this.width = 42;
        this.height = 54;
        this.lives = 3;
        this.reset();
    }

    reset() {
        const start = currentLevel().start;
        this.x = start.x;
        this.y = start.y;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.face = 1;
        this.invincible = 0;
    }

    update() {
        const movingLeft = keys.has("ArrowLeft") || keys.has("a");
        const movingRight = keys.has("ArrowRight") || keys.has("d");
        const jump = keys.has("ArrowUp") || keys.has("w") || keys.has(" ");

        if (movingLeft && !movingRight) {
            this.vx = -MOVE_SPEED;
            this.face = -1;
        } else if (movingRight && !movingLeft) {
            this.vx = MOVE_SPEED;
            this.face = 1;
        } else {
            this.vx *= 0.72;
            if (Math.abs(this.vx) < 0.08) this.vx = 0;
        }

        if (jump && this.grounded) {
            this.vy = JUMP_FORCE;
            this.grounded = false;
        }

        this.vy += GRAVITY;
        this.x += this.vx;
        collidePlatforms(this, "x");
        this.y += this.vy;
        this.grounded = false;
        collidePlatforms(this, "y");

        if (this.y > HEIGHT + 120) hurtPlayer(true);
        this.x = clamp(this.x, 0, currentLevel().width - this.width);
        if (this.invincible > 0) this.invincible -= 1;
    }

    draw() {
        if (this.invincible > 0 && Math.floor(this.invincible / 6) % 2 === 0) return;
        const bob = this.grounded ? Math.sin(performance.now() / 110) * Math.min(2, Math.abs(this.vx) / 2) : 0;

        ctx.save();
        ctx.translate(Math.round(this.x - cameraX + this.width / 2), Math.round(this.y + this.height / 2 + bob));
        ctx.scale(this.face, 1);

        ctx.fillStyle = "#c6792e";
        rounded(-18, -7, 36, 36, 11);
        ctx.fill();
        ctx.fillStyle = "#f0a34f";
        rounded(-12, -4, 24, 28, 9);
        ctx.fill();

        ctx.strokeStyle = "#2a1d18";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-18, 1);
        ctx.quadraticCurveTo(-36, -4, -34, -18);
        ctx.stroke();

        ctx.fillStyle = "#b6672b";
        rounded(-16, 20, 11, 16, 4);
        ctx.fill();
        rounded(5, 20, 11, 16, 4);
        ctx.fill();

        ctx.fillStyle = "#f2a95a";
        rounded(-15, -47, 33, 33, 10);
        ctx.fill();
        ctx.fillStyle = "#c97833";
        ear(-12, -45);
        ear(12, -45);
        ctx.fillStyle = "#fff1c8";
        rounded(-7, -29, 16, 11, 5);
        ctx.fill();

        ctx.fillStyle = "#241814";
        stripe(-10, -44, 8, 13);
        stripe(3, -45, 7, 14);
        stripe(13, -35, 5, 10);
        ctx.fillRect(-4, -28, 8, 4);
        ctx.beginPath();
        ctx.arc(-6, -34, 2.6, 0, Math.PI * 2);
        ctx.arc(7, -34, 2.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff9df";
        ctx.fillRect(-21, 0, 5, 7);
        ctx.fillRect(16, 1, 5, 7);
        ctx.restore();
    }
}

class WindTurbine {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.r = 18;
        this.taken = false;
    }

    draw() {
        if (this.taken) return;
        const pulse = Math.sin(performance.now() / 180 + this.x) * 1.5;
        const spin = performance.now() / 180 + this.x;
        ctx.save();
        ctx.translate(this.x - cameraX, this.y + pulse);
        ctx.strokeStyle = "#f7fbff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.lineTo(0, -2);
        ctx.stroke();

        ctx.rotate(spin);
        ctx.fillStyle = "#e9f7ff";
        ctx.strokeStyle = "#345a73";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i += 1) {
            ctx.rotate((Math.PI * 2) / 3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(7, -4);
            ctx.lineTo(22, 0);
            ctx.lineTo(7, 4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        ctx.rotate(-spin);
        ctx.fillStyle = "#ffdf58";
        ctx.strokeStyle = "#345a73";
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, range, type) {
        this.x = x;
        this.y = y;
        this.start = x;
        this.range = range;
        this.type = type;
        this.width = type === "thimble" ? 32 : 36;
        this.height = 28;
        this.vx = type === "thimble" ? 1.55 : 1.2;
        this.dead = false;
    }

    update() {
        if (this.dead) return;
        this.x += this.vx;
        if (this.x < this.start - this.range || this.x > this.start + this.range) this.vx *= -1;
    }

    draw() {
        if (this.dead) return;
        ctx.save();
        ctx.translate(this.x - cameraX, this.y);
        if (this.type === "thimble") {
            ctx.fillStyle = "#8f98a8";
            rounded(-16, -24, 32, 30, 8);
            ctx.fill();
            ctx.fillStyle = "#dce4ef";
            ctx.fillRect(-10, -18, 5, 5);
            ctx.fillRect(3, -18, 5, 5);
            ctx.fillStyle = "#26303a";
            ctx.fillRect(-7, -8, 14, 4);
        } else {
            ctx.fillStyle = "#8c5130";
            rounded(-18, -20, 36, 28, 8);
            ctx.fill();
            ctx.fillStyle = "#2b1b17";
            ctx.fillRect(-10, -14, 5, 5);
            ctx.fillRect(6, -14, 5, 5);
            ctx.fillStyle = "#f2d06b";
            ctx.fillRect(-13, 4, 7, 7);
            ctx.fillRect(6, 4, 7, 7);
        }
        ctx.restore();
    }
}

class Spring {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 38;
        this.height = 18;
        this.flash = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x - cameraX, this.y);
        ctx.fillStyle = this.flash > 0 ? "#fff4a5" : "#f36b5f";
        rounded(-this.width / 2, -this.height, this.width, this.height, 5);
        ctx.fill();
        ctx.fillStyle = "#702b31";
        ctx.fillRect(-13, -10, 26, 4);
        ctx.restore();
        if (this.flash > 0) this.flash -= 1;
    }
}

let player = new Player();
let buttons = [];
let enemies = [];
let springs = [];

function currentLevel() {
    return levels[levelIndex];
}

function loadLevel(index, keepLives = true) {
    levelIndex = index;
    const data = currentLevel();
    buttons = data.buttons.map(([x, y]) => new WindTurbine(x, y));
    enemies = data.enemies.map(([x, y, range, type]) => new Enemy(x, y, range, type));
    springs = data.springs.map(([x, y]) => new Spring(x, y));
    const lives = keepLives ? player.lives : 3;
    player = new Player();
    player.lives = lives;
    cameraX = 0;
    setMessage(`${data.name}. Pegue turbinas eolicas e alcance a bandeira!`, 180);
    updateHud();
}

function update() {
    if (!running) return;
    player.update();
    enemies.forEach((enemy) => enemy.update());
    collectButtons();
    checkSprings();
    checkEnemies();
    checkFlag();
    cameraX = clamp(player.x + player.width / 2 - WIDTH * 0.45, 0, currentLevel().width - WIDTH);
    if (messageTimer > 0) messageTimer -= 1;
}

function collidePlatforms(body, axis) {
    const box = rect(body.x, body.y, body.width, body.height);
    currentLevel().platforms.forEach(([x, y, width, height]) => {
        const platform = { x, y, width, height };
        if (!intersects(box, platform)) return;
        if (axis === "x") {
            if (body.vx > 0) body.x = platform.x - body.width;
            if (body.vx < 0) body.x = platform.x + platform.width;
            body.vx = 0;
            box.x = body.x;
            return;
        }
        if (body.vy > 0) {
            body.y = platform.y - body.height;
            body.grounded = true;
        } else if (body.vy < 0) {
            body.y = platform.y + platform.height;
        }
        body.vy = 0;
        box.y = body.y;
    });
}

function collectButtons() {
    buttons.forEach((button) => {
        if (button.taken) return;
        const dx = player.x + player.width / 2 - button.x;
        const dy = player.y + player.height / 2 - button.y;
        if (Math.hypot(dx, dy) < 31) {
            button.taken = true;
            totalButtons += 1;
            playCollectSound();
            setMessage("Turbina eolica capturada!", 70);
            updateHud();
        }
    });
}

function checkSprings() {
    springs.forEach((spring) => {
        const springBox = rect(spring.x - spring.width / 2, spring.y - spring.height, spring.width, spring.height);
        const playerBox = rect(player.x, player.y, player.width, player.height);
        if (intersects(playerBox, springBox) && player.vy >= 0 && player.y + player.height < spring.y + 12) {
            player.y = spring.y - spring.height - player.height;
            player.vy = JUMP_FORCE * 1.35;
            player.grounded = false;
            spring.flash = 15;
            setMessage("Pulo de mola!", 55);
        }
    });
}

function checkEnemies() {
    enemies.forEach((enemy) => {
        if (enemy.dead) return;
        const enemyBox = rect(enemy.x - enemy.width / 2, enemy.y - enemy.height, enemy.width, enemy.height);
        const playerBox = rect(player.x, player.y, player.width, player.height);
        if (!intersects(playerBox, enemyBox)) return;
        const stomped = player.vy > 0 && player.y + player.height - 8 < enemyBox.y + 13;
        if (stomped) {
            enemy.dead = true;
            player.vy = JUMP_FORCE * 0.58;
            setMessage("Inimigo amassado!", 70);
            return;
        }
        hurtPlayer(false);
    });
}

function hurtPlayer(fell) {
    if (!fell && player.invincible > 0) return;
    player.lives -= 1;
    updateHud();
    if (player.lives <= 0) {
        running = false;
        stopMusic();
        playSadTrombone();
        startPanel.classList.remove("hidden");
        startButton.textContent = "Tentar de novo";
        startPanelText.textContent = "Tico perdeu o enchimento. Vamos tentar outra vez?";
        levelIndex = 0;
        totalButtons = 0;
        player.lives = 3;
        loadLevel(0, false);
        return;
    }
    player.reset();
    player.invincible = 100;
    setMessage("Cuidado com os alfinetes do caminho!", 100);
}

function checkFlag() {
    const flag = currentLevel().flag;
    const flagBox = rect(flag.x - 16, flag.y - 116, 40, 120);
    if (!intersects(rect(player.x, player.y, player.width, player.height), flagBox)) return;

    if (levelIndex < levels.length - 1) {
        loadLevel(levelIndex + 1, true);
        return;
    }

    running = false;
    stopMusic();
    startPanel.classList.remove("hidden");
    startButton.textContent = "Jogar novamente";
    startPanelText.textContent = `Voce terminou todas as fases com ${totalButtons} turbinas!`;
}

function draw() {
    drawBackground();
    drawPlatforms();
    springs.forEach((spring) => spring.draw());
    buttons.forEach((button) => button.draw());
    enemies.forEach((enemy) => enemy.draw());
    drawFlag();
    player.draw();
    drawMessage();
}

function drawBackground() {
    const level = currentLevel();
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, level.sky[0]);
    sky.addColorStop(1, level.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.translate(-cameraX * 0.18, 0);
    for (let i = -1; i < 8; i += 1) {
        drawCloud(i * 270 + 70, 76 + (i % 2) * 32);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-cameraX * 0.38, 0);
    for (let i = -1; i < 9; i += 1) {
        ctx.fillStyle = i % 2 ? "#66b657" : "#74c965";
        ctx.beginPath();
        ctx.arc(i * 360 + 180, 500, 190, Math.PI, 0);
        ctx.fill();
    }
    ctx.restore();
}

function drawCloud(x, y) {
    ctx.fillStyle = "rgba(255, 255, 245, 0.86)";
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.arc(x + 24, y - 12, 30, 0, Math.PI * 2);
    ctx.arc(x + 56, y, 24, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlatforms() {
    const level = currentLevel();
    level.platforms.forEach(([x, y, width, height]) => {
        const screenX = Math.round(x - cameraX);
        if (screenX > WIDTH + 60 || screenX + width < -60) return;
        ctx.fillStyle = level.dirt;
        ctx.fillRect(screenX, y, width, height);
        ctx.fillStyle = level.ground;
        ctx.fillRect(screenX, y, width, Math.min(12, height));
        ctx.strokeStyle = "rgba(53, 42, 31, 0.28)";
        ctx.lineWidth = 2;
        for (let px = screenX + 10; px < screenX + width; px += TILE) {
            ctx.beginPath();
            ctx.moveTo(px, y + 14);
            ctx.lineTo(px - 14, y + height - 6);
            ctx.stroke();
        }
    });
}

function drawFlag() {
    const flag = currentLevel().flag;
    const x = flag.x - cameraX;
    ctx.fillStyle = "#4b3a2d";
    ctx.fillRect(x, flag.y - 112, 8, 116);
    ctx.fillStyle = "#ffdf58";
    ctx.beginPath();
    ctx.moveTo(x + 8, flag.y - 108);
    ctx.lineTo(x + 74, flag.y - 84);
    ctx.lineTo(x + 8, flag.y - 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e45d63";
    ctx.fillRect(x + 23, flag.y - 91, 16, 15);
}

function drawMessage() {
    if (messageTimer <= 0 && running) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "rgba(20, 32, 48, 0.72)";
    rounded(230, HEIGHT - 68, 500, 42, 6);
    ctx.fill();
    ctx.fillStyle = "#fff8d7";
    ctx.font = "700 17px Trebuchet MS, Arial";
    ctx.textAlign = "center";
    ctx.fillText(message, WIDTH / 2, HEIGHT - 41);
    ctx.restore();
}

function updateHud() {
    levelName.textContent = currentLevel().name;
    statusText.textContent = message;
    coinsText.textContent = `Turbinas: ${totalButtons}`;
    livesText.textContent = `Vidas: ${player.lives}`;
}

function setMessage(text, timer) {
    message = text;
    messageTimer = timer;
    updateHud();
}

function rect(x, y, width, height) {
    return { x, y, width, height };
}

function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function rounded(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
}

function ear(x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 10, y - 13);
    ctx.lineTo(x + 18, y + 4);
    ctx.closePath();
    ctx.fill();
}

function stripe(x, y, width, height) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y + 3);
    ctx.lineTo(x + width - 2, y + height);
    ctx.lineTo(x - 2, y + height - 2);
    ctx.closePath();
}

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.18;
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
}

function playTone(freq, duration, when = 0, type = "square", volume = 0.35, slideTo = null) {
    if (!audioCtx || !masterGain) return;
    const start = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(start);
    osc.stop(start + duration + 0.03);
}

function startMusic() {
    ensureAudio();
    stopMusic();
    musicStep = 0;
    scheduleMusicStep();
}

function stopMusic() {
    if (musicTimer) clearTimeout(musicTimer);
    musicTimer = null;
}

function scheduleMusicStep() {
    if (!running || !audioCtx) return;
    const melody = [523, 659, 784, 659, 698, 880, 784, 659, 587, 659, 698, 587, 523, 392, 440, 494];
    const bass = [196, 196, 262, 262, 220, 220, 294, 294];
    const note = melody[musicStep % melody.length];
    const low = bass[Math.floor(musicStep / 2) % bass.length];
    playTone(note, 0.12, 0, "square", 0.16);
    if (musicStep % 2 === 0) playTone(low, 0.16, 0, "triangle", 0.09);
    if (musicStep % 4 === 2) playTone(note * 1.5, 0.07, 0.04, "square", 0.07);
    musicStep += 1;
    musicTimer = setTimeout(scheduleMusicStep, 165);
}

function playCollectSound() {
    ensureAudio();
    playTone(740, 0.07, 0, "square", 0.13);
    playTone(988, 0.09, 0.06, "square", 0.12);
}

function playSadTrombone() {
    ensureAudio();
    const notes = [392, 370, 349, 311];
    notes.forEach((note, index) => {
        const delay = index * 0.38;
        playTone(note, 0.34, delay, "sawtooth", 0.24, note * 0.84);
        playTone(note * 0.5, 0.34, delay, "triangle", 0.12, note * 0.42);
    });
}

function pressGameKey(key) {
    if (running && !musicTimer) startMusic();
    keys.add(key);
}

function releaseGameKey(key) {
    keys.delete(key);
}

function bindTouchControls() {
    touchButtons.forEach((button) => {
        const key = button.dataset.key;
        const press = (event) => {
            event.preventDefault();
            button.setPointerCapture?.(event.pointerId);
            button.classList.add("pressed");
            pressGameKey(key);
        };
        const release = (event) => {
            event.preventDefault();
            button.classList.remove("pressed");
            releaseGameKey(key);
            if (button.hasPointerCapture?.(event.pointerId)) {
                button.releasePointerCapture(event.pointerId);
            }
        };

        button.addEventListener("pointerdown", press);
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("pointerleave", release);
        button.addEventListener("contextmenu", (event) => event.preventDefault());
    });
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", " ", "a", "d", "w"].includes(key)) {
        event.preventDefault();
        pressGameKey(key);
    }
    if (key === "r") {
        ensureAudio();
        totalButtons = 0;
        player.lives = 3;
        loadLevel(levelIndex, false);
        running = true;
        startMusic();
        startPanel.classList.add("hidden");
    }
});

window.addEventListener("keyup", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    releaseGameKey(key);
});

startButton.addEventListener("click", () => {
    ensureAudio();
    totalButtons = 0;
    startPanelText.textContent = "Um jogo de plataforma colorido, com fases curtas e um tigre de pelucia como heroi.";
    loadLevel(0, false);
    running = true;
    startMusic();
    startPanel.classList.add("hidden");
});

loadLevel(0, false);
bindTouchControls();
draw();
loop();
