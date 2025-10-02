const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// プレイヤー設定
let player = {
    x: 1.5,
    y: 1.5,
    dir: 0,
    fov: Math.PI/3,
    hasKey: false,
    score: 0
};

// ゲーム設定
const MAP_SIZE = 15;
const CELL_SIZE = 8;
const CHEST_COUNT = 4;
let maze = [];
let exitPos = {x: 0, y: 0};
let chests = [];

// テクスチャ生成
const wallTexture = (() => {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 64;
    patternCanvas.height = 64;
    const pctx = patternCanvas.getContext('2d');
    
    // 背景を青空風に設定
    pctx.fillStyle = '#87CEEB'; // 空の色
    pctx.fillRect(0, 0, 64, 64);

    // 円光の描画
    pctx.fillStyle = 'rgba(255, 255, 0, 0.8)'; // 明るい黄色
    pctx.beginPath();
    pctx.arc(32, 32, 20, 0, Math.PI * 2); // 中央に円
    pctx.fill();
    pctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; // 円の外側の薄い光
    pctx.beginPath();
    pctx.arc(32, 32, 30, 0, Math.PI * 2);
    pctx.fill();
    
    return ctx.createPattern(patternCanvas, 'repeat');
})();

// 迷路生成
function generateMaze() {
    maze = Array(MAP_SIZE).fill().map(() => Array(MAP_SIZE).fill(1));
    chests = [];
    
    function dig(x, y) {
        maze[y][x] = 0;
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]].sort(() => Math.random() - 0.5);
        
        for (let [dx, dy] of dirs) {
            const nx = x + dx*2;
            const ny = y + dy*2;
            if (nx > 0 && nx < MAP_SIZE-1 && ny > 0 && ny < MAP_SIZE-1 && maze[ny][nx] === 1) {
                maze[y + dy][x + dx] = 0;
                dig(nx, ny);
            }
        }
    }
    
    dig(1, 1);
    exitPos = {x: MAP_SIZE-2, y: MAP_SIZE-2};
    maze[exitPos.y][exitPos.x] = 2;

    // 宝箱配置
    const candidates = [];
    for(let y=1; y<MAP_SIZE-1; y++){
        for(let x=1; x<MAP_SIZE-1; x++){
            if(maze[y][x] === 0 && !(x === 1 && y === 1)) {
                candidates.push({x, y});
            }
        }
    }
    
    const selected = [];
    while(selected.length < CHEST_COUNT && candidates.length > 0){
        const idx = Math.floor(Math.random() * candidates.length);
        selected.push(candidates.splice(idx, 1)[0]);
    }
    
    selected.forEach((pos, i) => {
        maze[pos.y][pos.x] = 3;
        chests.push({
            x: pos.x,
            y: pos.y,
            hasKey: i === 0,
            opened: false
        });
    });
}

// レイキャスティング
function castRay(angle) {
    const step = 0.01;
    let x = player.x;
    let y = player.y;
    let dirX = Math.cos(angle);
    let dirY = Math.sin(angle);
    
    let wall = 0;
    let distance = 0;
    while (!wall && distance < 20) {
        x += dirX * step;
        y += dirY * step;
        const mapX = Math.floor(x);
        const mapY = Math.floor(y);
        
        if (mapX < 0 || mapX >= MAP_SIZE || mapY < 0 || mapY >= MAP_SIZE) break;
        
        if (maze[mapY][mapX]) {
            wall = maze[mapY][mapX];
            distance = Math.sqrt((x-player.x)**2 + (y-player.y)**2);
            break;
        }
    }
    
    return {distance, wall};
}

// 3D描画
function draw3D() {
    const colWidth = 2;
    for (let col = 0; col < canvas.width; col += colWidth) {
        const angle = player.dir - player.fov/2 + (col/canvas.width) * player.fov;
        const ray = castRay(angle);
        
        const wallHeight = (canvas.height * 0.6) / (ray.distance + 0.1);
        const brightness = Math.min(1, 1 / (ray.distance * 0.5));

        if(ray.wall === 1){
            ctx.fillStyle = wallTexture;
            ctx.globalAlpha = brightness;
            ctx.fillRect(col, canvas.height/2 - wallHeight/2, colWidth, wallHeight);
        }
        else if(ray.wall === 2){
            ctx.fillStyle = player.hasKey ? '#00ff88' : '#008844';
            ctx.globalAlpha = brightness * 0.8;
            ctx.fillRect(col, canvas.height/2 - wallHeight/2, colWidth, wallHeight);
        }
        else if(ray.wall === 3){
            ctx.fillStyle = `hsl(45, 80%, ${50*brightness}%)`;
            ctx.fillRect(col, canvas.height/2 - wallHeight/2, colWidth, wallHeight);
        }

        // 床と天井
        ctx.fillStyle = `hsl(0, 0%, ${30*brightness}%)`;
        ctx.fillRect(col, canvas.height/2 + wallHeight/2, colWidth, canvas.height/2 - wallHeight/2);
    }
    ctx.globalAlpha = 1;
}

// ミニマップ描画
function drawMiniMap() {
    const mapWidth = MAP_SIZE * CELL_SIZE;
    const mapX = canvas.width - mapWidth - 20;
    const mapY = 20;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(mapX - 10, mapY - 10, mapWidth + 20, mapWidth + 20);
    
    for(let y=0; y<MAP_SIZE; y++){
        for(let x=0; x<MAP_SIZE; x++){
            if(maze[y][x] === 1){
                ctx.fillStyle = '#666';
                ctx.fillRect(mapX + x*CELL_SIZE, mapY + y*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
            }
            if(maze[y][x] === 2){
                ctx.fillStyle = player.hasKey ? '#00ff88' : '#008844';
                ctx.fillRect(mapX + x*CELL_SIZE, mapY + y*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
            }
            if(maze[y][x] === 3){
                chests.forEach(chest => {
                    if(chest.x === x && chest.y === y && !chest.opened){
                        ctx.fillStyle = chest.hasKey ? '#ffd700' : '#b8860b';
                        ctx.fillRect(mapX + x*CELL_SIZE, mapY + y*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
                    }
                });
            }
        }
    }
    
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mapX + player.x * CELL_SIZE, mapY + player.y * CELL_SIZE, CELL_SIZE/3, 0, Math.PI*2);
    ctx.fill();
    
    ctx.strokeStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(mapX + player.x * CELL_SIZE, mapY + player.y * CELL_SIZE);
    ctx.lineTo(
        mapX + (player.x + Math.cos(player.dir)) * CELL_SIZE,
        mapY + (player.y + Math.sin(player.dir)) * CELL_SIZE
    );
    ctx.stroke();
}

// 衝突判定
function checkChestCollision() {
    const playerX = Math.floor(player.x);
    const playerY = Math.floor(player.y);
    
    chests.forEach((chest, i) => {
        if(chest.x === playerX && chest.y === playerY && !chest.opened){
            if(chest.hasKey){
                player.hasKey = true;
                player.score += 100;
            }
            chest.opened = true;
            maze[chest.y][chest.x] = 0;
            player.score += 50;
        }
    });
}

function checkExit() {
    const mapX = Math.floor(player.x);
    const mapY = Math.floor(player.y);
    if (mapX === exitPos.x && mapY === exitPos.y) {
        if(player.hasKey){
            alert(`ゴール！スコア: ${player.score}`);
            generateMaze();
            player.x = 1.5;
            player.y = 1.5;
            player.hasKey = false;
            player.score = 0;
        }else{
            alert('鍵が必要です！');
        }
    }
}

// プレイヤー操作
function update() {
    const speed = 0.05;
    const rotSpeed = 0.03;
    
    if (keys.ArrowUp) {
        const nx = player.x + Math.cos(player.dir) * speed;
        const ny = player.y + Math.sin(player.dir) * speed;
        if (maze[Math.floor(ny)]?.[Math.floor(nx)] !== 1) {
            player.x = nx;
            player.y = ny;
        }
    }
    if (keys.ArrowDown) {
        const nx = player.x - Math.cos(player.dir) * speed;
        const ny = player.y - Math.sin(player.dir) * speed;
        if (maze[Math.floor(ny)]?.[Math.floor(nx)] !== 1) {
            player.x = nx;
            player.y = ny;
        }
    }
    if (keys.ArrowLeft) player.dir -= rotSpeed;
    if (keys.ArrowRight) player.dir += rotSpeed;
    
    checkChestCollision();
    checkExit();
}

// 入力処理
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// マウス操作
let mouseLock = false;
canvas.addEventListener('click', () => {
    canvas.requestPointerLock();
    mouseLock = true;
});

document.addEventListener('pointerlockchange', () => {
    mouseLock = document.pointerLockElement === canvas;
});

document.addEventListener('mousemove', (e) => {
    if (mouseLock) {
        player.dir += e.movementX * 0.002;
    }
});

// ゲームループ
function gameLoop() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    update();
    draw3D();
    drawMiniMap();
    requestAnimationFrame(gameLoop);
}

// 初期化
generateMaze();
gameLoop();