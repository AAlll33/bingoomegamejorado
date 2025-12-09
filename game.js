// ==========================================================
// ============== JUEGO DINO (VERSIÓN TURBO) =================
// ==========================================================

const canvas = document.getElementById('dinoCanvas');
const ctx = canvas.getContext('2d');
let gameAnimationFrame;
let gameScore = 0;
let gameSpeed = 5; 
let isGaming = false;

// Configuración Canvas
canvas.width = 600;
canvas.height = 200;

// Entidades
let dino = { x: 50, y: 150, width: 30, height: 30, dy: 0, jumpPower: -15, gravity: 0.8, grounded: true };
let obstacles = [];
let frameCount = 0;

function drawPixelDino(x, y) {
    ctx.fillStyle = 'black';
    ctx.fillRect(x, y, 30, 30); // Cuerpo
    ctx.fillRect(x + 10, y - 10, 20, 20); // Cabeza
    ctx.fillStyle = 'white';
    ctx.fillRect(x + 20, y - 5, 5, 5); // Ojo
}

function drawCactus(x, y, w, h) {
    ctx.fillStyle = '#9333ea'; 
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#7e22ce';
    ctx.fillRect(x+5, y+5, w-10, h-10);
}

function drawBird(x, y) {
    ctx.fillStyle = '#4b5563'; 
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x+15, y+10);
    ctx.lineTo(x+30, y);
    ctx.lineTo(x+15, y-5);
    ctx.fill();
}

function spawnObstacle() {
    let type = Math.random() > 0.7 ? 'bird' : 'cactus';
    let obj = { x: canvas.width, type: type, passed: false };

    if(type === 'cactus') {
        obj.y = 150; 
        obj.width = 20 + Math.random() * 20;
        obj.height = 30 + Math.random() * 20; 
    } else {
        obj.y = 90 + Math.random() * 40; 
        obj.width = 30;
        obj.height = 20;
    }
    obstacles.push(obj);
}

function updateGame() {
    if(!isGaming) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Suelo
    ctx.beginPath(); ctx.moveTo(0, 180); ctx.lineTo(canvas.width, 180);
    ctx.strokeStyle = '#ddd'; ctx.stroke();

    // Física
    dino.dy += dino.gravity;
    dino.y += dino.dy;

    if (dino.y > 150) {
        dino.y = 150; dino.dy = 0; dino.grounded = true;
    } else {
        dino.grounded = false;
    }

    drawPixelDino(dino.x, dino.y);

    frameCount++;
    if (frameCount % (100 - Math.floor(gameSpeed * 2)) === 0) spawnObstacle();

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= gameSpeed;

        if (obs.type === 'cactus') drawCactus(obs.x, obs.y, obs.width, obs.height);
        else drawBird(obs.x, obs.y);

        // Colisión
        if (dino.x < obs.x + obs.width && dino.x + dino.width > obs.x &&
            dino.y < obs.y + obs.height && dino.y + dino.height > obs.y) {
            gameOver();
        }

        // Puntaje
        if (obs.x + obs.width < dino.x && !obs.passed) {
            gameScore += 10;
            obs.passed = true;
            document.getElementById('gameScore').innerText = gameScore;
            if(gameScore % 100 === 0) gameSpeed += 0.5; 
        }
    }
    
    obstacles = obstacles.filter(obs => obs.x > -50);
    gameAnimationFrame = requestAnimationFrame(updateGame);
}

function jumpDino() {
    if (!isGaming) return;
    if (dino.grounded) {
        dino.dy = dino.jumpPower;
        dino.grounded = false;
    }
}

document.addEventListener('keydown', function(event) {
    if (event.code === 'Space' && isGaming) jumpDino();
});

function startGame() {
    document.getElementById('gameMessage').classList.add('hidden');
    gameScore = 0; gameSpeed = 5; obstacles = [];
    dino.y = 150; dino.dy = 0; isGaming = true;
    document.getElementById('gameScore').innerText = "0";
    updateGame();
}

function gameOver() {
    isGaming = false;
    cancelAnimationFrame(gameAnimationFrame);
    document.getElementById('msgTitle').innerText = "GAME OVER";
    document.getElementById('msgTitle').classList.add('text-red-600');
    document.querySelector('#gameMessage button').innerText = "INTENTAR DE NUEVO ↺";
    document.getElementById('gameMessage').classList.remove('hidden');
}

function stopGameLogic() {
    isGaming = false;
    cancelAnimationFrame(gameAnimationFrame);
}
