const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const clients = new Map();

wss.on('connection', (ws) => {
  const clientId = generateId();
  clients.set(clientId, { ws, roomId: null, playerId: null, name: null });
  
  console.log(`客户端 ${clientId} 连接成功`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(clientId, message);
    } catch (error) {
      console.error('消息解析错误:', error);
    }
  });

  ws.on('close', () => {
    handleDisconnect(clientId);
  });
});

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function handleMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'join':
      handleJoin(clientId, message);
      break;
    case 'create':
      handleCreate(clientId, message);
      break;
    case 'list':
      handleListRooms(clientId);
      break;
    case 'move':
    case 'shoot':
    case 'stop':
    case 'respawn':
      handleGameAction(clientId, message);
      break;
    case 'ready':
      handleReady(clientId, message);
      break;
    case 'start':
      handleStartGame(clientId);
      break;
    case 'leave':
      handleLeaveRoom(clientId);
      break;
    default:
      break;
  }
}

function handleJoin(clientId, message) {
  const { roomId, name } = message;
  const client = clients.get(clientId);
  const room = rooms.get(roomId);

  if (!room) {
    sendToClient(clientId, { type: 'error', message: '房间不存在' });
    return;
  }

  if (room.players.size >= 2) {
    sendToClient(clientId, { type: 'error', message: '房间已满' });
    return;
  }

  if (room.gameStarted) {
    sendToClient(clientId, { type: 'error', message: '游戏已开始' });
    return;
  }

  const playerId = generateId();
  const player = {
    id: playerId,
    clientId,
    name: name || '玩家' + (room.players.size + 1),
    ready: false,
    team: room.players.size === 0 ? 1 : 1,
    tank: null
  };

  room.players.set(playerId, player);
  client.roomId = roomId;
  client.playerId = playerId;
  client.name = player.name;

  sendToClient(clientId, {
    type: 'joined',
    roomId,
    playerId,
    team: player.team,
    name: player.name
  });

  broadcastRoomState(roomId);
}

function handleCreate(clientId, message) {
  const { name } = message;
  const roomId = generateId();
  
  const room = {
    id: roomId,
    name: name || '房间' + roomId.substring(0, 4),
    players: new Map(),
    gameStarted: false,
    gameState: null,
    hostId: clientId
  };

  rooms.set(roomId, room);

  const playerId = generateId();
  const player = {
    id: playerId,
    clientId,
    name: '玩家1',
    ready: false,
    team: 1,
    tank: null
  };

  room.players.set(playerId, player);
  const client = clients.get(clientId);
  client.roomId = roomId;
  client.playerId = playerId;
  client.name = player.name;

  sendToClient(clientId, {
    type: 'created',
    roomId,
    playerId,
    name: room.name
  });

  broadcastRoomList();
}

function handleListRooms(clientId) {
  const roomList = [];
  rooms.forEach((room, roomId) => {
    if (!room.gameStarted) {
      roomList.push({
        id: roomId,
        name: room.name,
        playerCount: room.players.size,
        maxPlayers: 2
      });
    }
  });
  sendToClient(clientId, { type: 'roomList', rooms: roomList });
}

function handleReady(clientId, message) {
  const { ready } = message;
  const client = clients.get(clientId);
  
  if (!client.roomId) return;
  
  const room = rooms.get(client.roomId);
  if (!room) return;
  
  const player = room.players.get(client.playerId);
  if (player) {
    player.ready = ready;
    broadcastRoomState(client.roomId);
  }
}

function handleStartGame(clientId) {
  const client = clients.get(clientId);
  
  if (!client.roomId) return;
  
  const room = rooms.get(client.roomId);
  if (!room) return;
  
  if (room.hostId !== clientId) {
    sendToClient(clientId, { type: 'error', message: '只有房主可以开始游戏' });
    return;
  }

  if (room.players.size < 1) {
    sendToClient(clientId, { type: 'error', message: '至少需要1名玩家' });
    return;
  }

  let allReady = true;
  room.players.forEach(player => {
    if (!player.ready) allReady = false;
  });

  if (!allReady && room.players.size > 1) {
    sendToClient(clientId, { type: 'error', message: '请所有玩家准备' });
    return;
  }

  room.gameStarted = true;
  
  const gameState = initGameState(room);
  room.gameState = gameState;

  broadcastToRoom(room.id, { type: 'gameStarted', gameState });
  
  startGameLoop(room);
}

function initGameState(room) {
  const map = generateMap();
  const players = [];
  
  let index = 0;
  room.players.forEach((player, playerId) => {
    const spawnPoints = [
      { x: 4, y: 25 },
      { x: 8, y: 25 }
    ];
    const spawn = spawnPoints[index];
    
    players.push({
      id: playerId,
      name: player.name,
      team: player.team,
      x: spawn.x * 16,
      y: spawn.y * 16,
      direction: 0,
      health: 1,
      score: 0,
      lives: 3,
      powerUps: {
        speed: false,
        shield: false,
        bomb: false,
        star: 0
      }
    });
    index++;
  });

  return {
    map,
    players,
    enemies: [],
    bullets: [],
    explosions: [],
    powerUps: [],
    base: { x: 6 * 16, y: 25 * 16, destroyed: false },
    enemySpawnPoints: [
      { x: 0, y: 0 },
      { x: 6 * 16, y: 0 },
      { x: 12 * 16, y: 0 }
    ],
    enemiesToSpawn: 20,
    enemiesSpawned: 0,
    gameOver: false,
    victory: false,
    tick: 0
  };
}

function generateMap() {
  const map = [];
  const TILE_SIZE = 16;
  const MAP_WIDTH = 13;
  const MAP_HEIGHT = 26;

  const brickPattern = [
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0]
  ];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      map[y][x] = brickPattern[y] ? (brickPattern[y][x] || 0) : 0;
    }
  }

  return map;
}

function handleGameAction(clientId, message) {
  const client = clients.get(clientId);
  
  if (!client.roomId) return;
  
  const room = rooms.get(client.roomId);
  if (!room || !room.gameStarted) return;
  
  const gameState = room.gameState;
  const player = gameState.players.find(p => p.id === client.playerId);
  
  if (!player) return;

  switch (message.type) {
    case 'move':
      player.direction = message.direction;
      player.moving = true;
      break;
    case 'stop':
      player.moving = false;
      break;
    case 'shoot':
      if (!player.lastShot || gameState.tick - player.lastShot > (player.powerUps.star >= 3 ? 5 : 10)) {
        const bullet = createBullet(player, gameState);
        gameState.bullets.push(bullet);
        player.lastShot = gameState.tick;
      }
      break;
    case 'respawn':
      if (player.lives > 0 && player.health <= 0) {
        respawnPlayer(player, gameState);
      }
      break;
    default:
      break;
  }
}

function createBullet(player, gameState) {
  const TILE_SIZE = 16;
  const TANK_SIZE = 16;
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
  ];

  const dir = directions[player.direction];
  const speed = player.powerUps.star >= 1 ? 6 : 4;

  return {
    id: generateId(),
    x: player.x + TANK_SIZE / 2 - 2,
    y: player.y + TANK_SIZE / 2 - 2,
    dx: dir.dx * speed,
    dy: dir.dy * speed,
    ownerId: player.id,
    isEnemy: false,
    power: player.powerUps.star >= 2 ? 2 : 1
  };
}

function respawnPlayer(player, gameState) {
  const spawnPoints = [
    { x: 4, y: 25 },
    { x: 8, y: 25 }
  ];
  const spawn = spawnPoints[gameState.players.indexOf(player) % 2];
  
  player.x = spawn.x * 16;
  player.y = spawn.y * 16;
  player.direction = 0;
  player.health = 1;
  player.powerUps.shield = false;
}

let gameLoopInterval = null;

function startGameLoop(room) {
  const FPS = 60;
  const FRAME_TIME = 1000 / FPS;

  gameLoopInterval = setInterval(() => {
    if (!room.gameStarted || room.gameState.gameOver) {
      clearInterval(gameLoopInterval);
      return;
    }

    updateGame(room);
    broadcastGameState(room);
  }, FRAME_TIME);
}

function updateGame(room) {
  const gameState = room.gameState;
  gameState.tick++;

  updatePlayers(gameState);
  updateEnemies(gameState);
  updateBullets(gameState);
  updateExplosions(gameState);
  spawnEnemies(gameState);
  checkGameOver(gameState);
}

function updatePlayers(gameState) {
  const TILE_SIZE = 16;
  const TANK_SIZE = 16;
  const MAP_WIDTH = 13 * TILE_SIZE;
  const MAP_HEIGHT = 26 * TILE_SIZE;
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
  ];

  gameState.players.forEach(player => {
    if (player.health <= 0) return;

    if (player.moving) {
      const speed = player.powerUps.speed ? 3 : 2;
      const dir = directions[player.direction];
      const newX = player.x + dir.dx * speed;
      const newY = player.y + dir.dy * speed;

      if (checkCollision(newX, newY, TANK_SIZE, TANK_SIZE, gameState.map, TILE_SIZE) === 0) {
        if (newX >= 0 && newX <= MAP_WIDTH - TANK_SIZE && 
            newY >= 0 && newY <= MAP_HEIGHT - TANK_SIZE) {
          player.x = newX;
          player.y = newY;
        }
      }
    }
  });
}

function updateEnemies(gameState) {
  const TILE_SIZE = 16;
  const TANK_SIZE = 16;
  const MAP_WIDTH = 13 * TILE_SIZE;
  const MAP_HEIGHT = 26 * TILE_SIZE;
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
  ];

  gameState.enemies.forEach(enemy => {
    if (enemy.health <= 0) return;

    if (!enemy.directionTimer || gameState.tick - enemy.directionTimer > 120) {
      enemy.direction = Math.floor(Math.random() * 4);
      enemy.directionTimer = gameState.tick;
    }

    const speed = enemy.type === 'fast' ? 2 : 1;
    const dir = directions[enemy.direction];
    const newX = enemy.x + dir.dx * speed;
    const newY = enemy.y + dir.dy * speed;

    const collision = checkCollision(newX, newY, TANK_SIZE, TANK_SIZE, gameState.map, TILE_SIZE);
    
    if (collision === 0 && 
        newX >= 0 && newX <= MAP_WIDTH - TANK_SIZE && 
        newY >= 0 && newY <= MAP_HEIGHT - TANK_SIZE) {
      enemy.x = newX;
      enemy.y = newY;
    } else {
      enemy.direction = Math.floor(Math.random() * 4);
      enemy.directionTimer = gameState.tick;
    }

    if (!enemy.lastShot || gameState.tick - enemy.lastShot > (enemy.type === 'fast' ? 40 : 60)) {
      if (Math.random() < 0.02) {
        const bullet = {
          id: generateId(),
          x: enemy.x + TANK_SIZE / 2 - 2,
          y: enemy.y + TANK_SIZE / 2 - 2,
          dx: dir.dx * 4,
          dy: dir.dy * 4,
          ownerId: enemy.id,
          isEnemy: true,
          power: 1
        };
        gameState.bullets.push(bullet);
        enemy.lastShot = gameState.tick;
      }
    }
  });
}

function updateBullets(gameState) {
  const TILE_SIZE = 16;
  const TANK_SIZE = 16;
  const MAP_WIDTH = 13 * TILE_SIZE;
  const MAP_HEIGHT = 26 * TILE_SIZE;

  const bulletsToRemove = [];

  gameState.bullets.forEach((bullet, index) => {
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;

    if (bullet.x < 0 || bullet.x > MAP_WIDTH || 
        bullet.y < 0 || bullet.y > MAP_HEIGHT) {
      bulletsToRemove.push(index);
      return;
    }

    const tileX = Math.floor(bullet.x / TILE_SIZE);
    const tileY = Math.floor(bullet.y / TILE_SIZE);

    if (tileX >= 0 && tileX < 13 && tileY >= 0 && tileY < 26) {
      const tileType = gameState.map[tileY][tileX];
      
      if (tileType === 1) {
        gameState.map[tileY][tileX] = 0;
        bulletsToRemove.push(index);
        addExplosion(bullet.x, bullet.y, gameState);
        return;
      } else if (tileType === 2) {
        if (bullet.power >= 2) {
          gameState.map[tileY][tileX] = 0;
          addExplosion(bullet.x, bullet.y, gameState);
        }
        bulletsToRemove.push(index);
        return;
      }
    }

    const baseX = 6 * TILE_SIZE;
    const baseY = 25 * TILE_SIZE;
    if (bullet.x >= baseX && bullet.x < baseX + 32 &&
        bullet.y >= baseY && bullet.y < baseY + 32) {
      gameState.base.destroyed = true;
      bulletsToRemove.push(index);
      addExplosion(baseX + 16, baseY + 16, gameState);
      return;
    }

    if (bullet.isEnemy) {
      gameState.players.forEach(player => {
        if (player.health > 0 && checkBoxCollision(
          bullet.x, bullet.y, 4, 4,
          player.x, player.y, TANK_SIZE, TANK_SIZE
        )) {
          if (!player.powerUps.shield) {
            player.health--;
            if (player.health <= 0) {
              player.lives--;
              addExplosion(player.x + 8, player.y + 8, gameState);
            }
          }
          bulletsToRemove.push(index);
        }
      });
    } else {
      gameState.enemies.forEach(enemy => {
        if (enemy.health > 0 && checkBoxCollision(
          bullet.x, bullet.y, 4, 4,
          enemy.x, enemy.y, TANK_SIZE, TANK_SIZE
        )) {
          enemy.health -= bullet.power;
          if (enemy.health <= 0) {
            addExplosion(enemy.x + 8, enemy.y + 8, gameState);
            const player = gameState.players.find(p => p.id === bullet.ownerId);
            if (player) {
              player.score += enemy.type === 'armor' ? 400 : (enemy.type === 'fast' ? 200 : 100);
            }
            if (Math.random() < 0.2) {
              spawnPowerUp(enemy.x, enemy.y, gameState);
            }
          }
          bulletsToRemove.push(index);
        }
      });
    }
  });

  bulletsToRemove.sort((a, b) => b - a).forEach(index => {
    gameState.bullets.splice(index, 1);
  });

  gameState.enemies = gameState.enemies.filter(e => e.health > 0);
}

function checkCollision(x, y, width, height, map, tileSize) {
  const left = Math.floor(x / tileSize);
  const right = Math.floor((x + width - 1) / tileSize);
  const top = Math.floor(y / tileSize);
  const bottom = Math.floor((y + height - 1) / tileSize);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (ty >= 0 && ty < 26 && tx >= 0 && tx < 13) {
        if (map[ty][tx] === 1 || map[ty][tx] === 2) {
          return map[ty][tx];
        }
      }
    }
  }
  return 0;
}

function checkBoxCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 &&
         x1 + w1 > x2 &&
         y1 < y2 + h2 &&
         y1 + h1 > y2;
}

function addExplosion(x, y, gameState) {
  gameState.explosions.push({
    x,
    y,
    timer: 0,
    maxTimer: 15
  });
}

function updateExplosions(gameState) {
  gameState.explosions = gameState.explosions.filter(exp => {
    exp.timer++;
    return exp.timer < exp.maxTimer;
  });
}

function spawnEnemies(gameState) {
  if (gameState.enemiesSpawned >= gameState.enemiesToSpawn) return;
  
  if (gameState.enemies.length >= 4) return;

  if (!gameState.lastSpawnTick || gameState.tick - gameState.lastSpawnTick > 300) {
    const spawnPoint = gameState.enemySpawnPoints[Math.floor(Math.random() * 3)];
    
    const types = ['normal', 'normal', 'normal', 'fast', 'armor'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const enemy = {
      id: generateId(),
      x: spawnPoint.x,
      y: spawnPoint.y,
      direction: 2,
      health: type === 'armor' ? 4 : 1,
      type,
      directionTimer: gameState.tick
    };

    gameState.enemies.push(enemy);
    gameState.enemiesSpawned++;
    gameState.lastSpawnTick = gameState.tick;
  }
}

function spawnPowerUp(x, y, gameState) {
  const types = ['speed', 'shield', 'bomb', 'star', 'life'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  gameState.powerUps.push({
    id: generateId(),
    x,
    y,
    type,
    timer: 0
  });
}

function checkGameOver(gameState) {
  if (gameState.base.destroyed) {
    gameState.gameOver = true;
    gameState.victory = false;
    return;
  }

  const allPlayersDead = gameState.players.every(p => p.lives <= 0 && p.health <= 0);
  if (allPlayersDead) {
    gameState.gameOver = true;
    gameState.victory = false;
    return;
  }

  if (gameState.enemiesSpawned >= gameState.enemiesToSpawn && gameState.enemies.length === 0) {
    gameState.gameOver = true;
    gameState.victory = true;
  }
}

function handleDisconnect(clientId) {
  const client = clients.get(clientId);
  
  if (client && client.roomId) {
    handleLeaveRoom(clientId);
  }
  
  clients.delete(clientId);
}

function handleLeaveRoom(clientId) {
  const client = clients.get(clientId);
  if (!client || !client.roomId) return;
  
  const room = rooms.get(client.roomId);
  if (!room) return;

  room.players.delete(client.playerId);
  
  if (room.players.size === 0) {
    rooms.delete(client.roomId);
    broadcastRoomList();
  } else {
    if (room.hostId === clientId) {
      const firstPlayer = room.players.values().next().value;
      room.hostId = firstPlayer.clientId;
    }
    broadcastRoomState(client.roomId);
  }

  client.roomId = null;
  client.playerId = null;
  client.name = null;
}

function sendToClient(clientId, message) {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

function broadcastToRoom(roomId, message) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.players.forEach(player => {
    sendToClient(player.clientId, message);
  });
}

function broadcastRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const playersList = [];
  room.players.forEach(player => {
    playersList.push({
      id: player.id,
      name: player.name,
      team: player.team,
      ready: player.ready
    });
  });

  broadcastToRoom(roomId, {
    type: 'roomState',
    room: {
      id: room.id,
      name: room.name,
      players: playersList,
      hostId: room.hostId
    }
  });
}

function broadcastGameState(room) {
  const state = {
    type: 'gameState',
    gameState: {
      map: room.gameState.map,
      players: room.gameState.players,
      enemies: room.gameState.enemies,
      bullets: room.gameState.bullets,
      explosions: room.gameState.explosions,
      base: room.gameState.base,
      enemiesToSpawn: room.gameState.enemiesToSpawn,
      enemiesSpawned: room.gameState.enemiesSpawned,
      gameOver: room.gameState.gameOver,
      victory: room.gameState.victory,
      tick: room.gameState.tick
    }
  };

  broadcastToRoom(room.id, state);
}

function broadcastRoomList() {
  clients.forEach((client, clientId) => {
    if (!client.roomId) {
      handleListRooms(clientId);
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`坦克大战服务器已启动，端口: ${PORT}`);
  console.log(`请访问 http://localhost:${PORT} 开始游戏`);
});
