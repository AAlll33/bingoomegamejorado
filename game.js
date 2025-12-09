// CONFIGURACIÓN DEL JUEGO DINO
const canvas = document.getElementById('dinoCanvas');
const ctx = canvas.getContext('2d');
let gameAnimationFrame;
let gameScore = 0;
let gameSpeed = 5;
let isGaming = false;

// Ajustar canvas
canvas.width = 600;
canvas.height = 200;

// Entidades
let dino = { x: 50, y: 150, width: 30, height: 30, dy: 0, jumpPower: -13, gravity: 0.8, grounded: true };
let obstacles = [];
let frameCount = 0;

function drawPixelDino(x, y) {
    ctx.fillStyle = '#4c1d95'; // Morado Omega
    ctx.fillRect(x, y, 30, 30); // Cuerpo
    ctx.fillStyle = '#facc15'; // Ojo Amarillo
    ctx.fillRect(x + 20, y + 5, 5, 5);
}

function drawCactus(x, y, w, h) {
    ctx.fillStyle = '#059669'; // Verde
    ctx.fillRect(x, y, w, h);
}

function spawnObstacle() {
    let type = Math.random() > 0.5 ? 'cactus_big' : 'cactus_small';
    let h = type === 'cactus_big' ? 40 : 25;
    let w = 20;
    obstacles.push({ x: canvas.width, y: 180 - h, width: w, height: h, passed: false });
}

function updateGame() {
    if(!isGaming) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Suelo
    ctx.beginPath(); ctx.moveTo(0, 180); ctx.lineTo(canvas.width, 180);
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.stroke();

    // Física Dino
    dino.dy += dino.gravity;
    dino.y += dino.dy;
    if (dino.y > 150) { dino.y = 150; dino.dy = 0; dino.grounded = true; } else { dino.grounded = false; }

    drawPixelDino(dino.x, dino.y);

    // Obstáculos
    frameCount++;
    if (frameCount % (120 - Math.min(gameSpeed * 5, 60)) === 0) spawnObstacle();

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= gameSpeed;
        drawCactus(obs.x, obs.y, obs.width, obs.height);

        // Colisión
        if (dino.x < obs.x + obs.width && dino.x + dino.width > obs.x && dino.y < obs.y + obs.height && dino.y + dino.height > obs.y) {
            gameOver();
        }
        // Puntaje
        if (obs.x + obs.width < dino.x && !obs.passed) {
            gameScore += 10; obs.passed = true;
            document.getElementById('gameScore').innerText = gameScore;
            if(gameScore % 100 === 0) gameSpeed += 0.5;
        }
    }
    obstacles = obstacles.filter(obs => obs.x > -50);
    gameAnimationFrame = requestAnimationFrame(updateGame);
}

function jumpDino() {
    if (!isGaming) return;
    if (dino.grounded) { dino.dy = dino.jumpPower; dino.grounded = false; }
}

function startGame() {
    document.getElementById('gameMessage').classList.add('hidden');
    gameScore = 0; gameSpeed = 5; obstacles = []; dino.y = 150; dino.dy = 0;
    isGaming = true;
    document.getElementById('gameScore').innerText = "0";
    updateGame();
}

function gameOver() {
    isGaming = false;
    cancelAnimationFrame(gameAnimationFrame);
    document.getElementById('msgTitle').innerText = "GAME OVER";
    document.getElementById('msgTitle').classList.add('text-red-600');
    document.querySelector('#gameMessage button').innerText = "REINTENTAR ↺";
    document.getElementById('gameMessage').classList.remove('hidden');
}

function stopGameLogic() { isGaming = false; cancelAnimationFrame(gameAnimationFrame); }
