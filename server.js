import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import {
  advanceGame,
  createGameState,
  queueDirection,
  queueEnemyDirection,
  restartGame,
  startGame,
  togglePause
} from "./src/game.js";

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();
const ROOM_TTL_MS = 1000 * 60 * 60;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const rooms = new Map();

function now() {
  return Date.now();
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function createRoomId() {
  return randomUUID().slice(0, 6).toUpperCase();
}

function makePlayer(role) {
  const shortId = randomUUID().slice(0, 8);
  return {
    role,
    token: randomUUID(),
    userId: `guest_${shortId}`,
    displayName: role === "player" ? "Player 1" : "Player 2"
  };
}

function sanitizeSettings(input = {}) {
  const clampInt = (value, min, max, fallback) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
  };
  const clampNumber = (value, min, max, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
  };

  return {
    difficultyLabel: typeof input.difficultyLabel === "string" ? input.difficultyLabel : "hard",
    enemyErrorEnabled: Boolean(input.enemyErrorEnabled),
    enemyErrorRate: clampNumber(input.enemyErrorRate, 0, 0.5, 0),
    enemyEarlyErrorBias: clampNumber(input.enemyEarlyErrorBias, 0, 1, 0.8),
    startingPlayerPoints: clampInt(input.startingPlayerPoints, 0, 30, 0),
    startingEnemyPoints: clampInt(input.startingEnemyPoints, 0, 30, 0),
    startingPlayerSize: clampInt(input.startingPlayerSize, 1, 30, 1),
    startingEnemySize: clampInt(input.startingEnemySize, 1, 30, 1),
    speedMs: clampInt(input.speedMs, 80, 260, 140),
    enemyControl: "human"
  };
}

function roomPublicState(room) {
  return {
    roomId: room.id,
    status: room.state.status,
    settings: room.settings,
    playerConnected: Boolean(room.players.player),
    enemyConnected: Boolean(room.players.enemy),
    state: room.state
  };
}

function sendSseEvent(response, eventName, data) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastSnapshot(room) {
  room.lastActivityAt = now();
  for (const client of room.clients) {
    sendSseEvent(client.response, "snapshot", {
      ...roomPublicState(room),
      you: client.role
    });
  }
}

function ensureRoomLoop(room) {
  if (room.tickHandle) {
    clearTimeout(room.tickHandle);
  }

  const tick = () => {
    if (!rooms.has(room.id)) {
      return;
    }

    room.state = advanceGame(room.state, Math.random);
    broadcastSnapshot(room);
    room.tickHandle = setTimeout(tick, room.settings.speedMs);
  };

  room.tickHandle = setTimeout(tick, room.settings.speedMs);
}

function stopRoomLoop(room) {
  if (room.tickHandle) {
    clearTimeout(room.tickHandle);
    room.tickHandle = null;
  }
}

function findRoomByPath(pathname) {
  const roomMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)(?:\/(join|input|action|stream|leave))?$/);
  if (!roomMatch) {
    return null;
  }

  return {
    roomId: roomMatch[1].toUpperCase(),
    action: roomMatch[2] || null
  };
}

function authenticate(room, token) {
  if (!token) {
    return null;
  }

  if (room.players.player?.token === token) {
    return room.players.player;
  }

  if (room.players.enemy?.token === token) {
    return room.players.enemy;
  }

  return null;
}

function createRoom(settingsPayload) {
  const id = createRoomId();
  const settings = sanitizeSettings(settingsPayload);
  const player = makePlayer("player");
  const state = createGameState(settings);

  const room = {
    id,
    settings,
    createdAt: now(),
    lastActivityAt: now(),
    state,
    players: {
      player,
      enemy: null
    },
    clients: new Set(),
    tickHandle: null
  };

  rooms.set(id, room);
  ensureRoomLoop(room);
  return room;
}

function maybeCleanupRooms() {
  const cutoff = now() - ROOM_TTL_MS;
  for (const room of rooms.values()) {
    if (room.lastActivityAt < cutoff) {
      stopRoomLoop(room);
      for (const client of room.clients) {
        client.response.end();
      }
      rooms.delete(room.id);
    }
  }
}

setInterval(maybeCleanupRooms, 60_000).unref();

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (request.method === "POST" && pathname === "/api/rooms") {
      const body = await parseJsonBody(request);
      const room = createRoom(body.settings);
      sendJson(response, 201, {
        roomId: room.id,
        role: "player",
        token: room.players.player.token,
        profile: {
          userId: room.players.player.userId,
          displayName: room.players.player.displayName
        },
        state: roomPublicState(room)
      });
      return;
    }

    const roomPath = findRoomByPath(pathname);
    if (roomPath) {
      const room = rooms.get(roomPath.roomId);
      if (!room) {
        sendJson(response, 404, { error: "Room not found" });
        return;
      }

      if (request.method === "POST" && roomPath.action === "join") {
        if (room.players.enemy) {
          sendJson(response, 409, { error: "Room is full" });
          return;
        }

        room.players.enemy = makePlayer("enemy");
        room.lastActivityAt = now();
        broadcastSnapshot(room);
        sendJson(response, 200, {
          roomId: room.id,
          role: "enemy",
          token: room.players.enemy.token,
          profile: {
            userId: room.players.enemy.userId,
            displayName: room.players.enemy.displayName
          },
          state: roomPublicState(room)
        });
        return;
      }

      if (request.method === "GET" && roomPath.action === "stream") {
        const token = requestUrl.searchParams.get("token");
        const player = authenticate(room, token);
        if (!player) {
          sendJson(response, 401, { error: "Unauthorized" });
          return;
        }

        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
          Connection: "keep-alive"
        });

        const client = {
          role: player.role,
          response
        };
        room.clients.add(client);
        room.lastActivityAt = now();
        sendSseEvent(response, "snapshot", {
          ...roomPublicState(room),
          you: player.role
        });

        request.on("close", () => {
          room.clients.delete(client);
        });
        return;
      }

      if (request.method === "POST" && roomPath.action === "input") {
        const body = await parseJsonBody(request);
        const player = authenticate(room, body.token);
        if (!player) {
          sendJson(response, 401, { error: "Unauthorized" });
          return;
        }

        const direction = body.direction;
        if (typeof direction !== "string") {
          sendJson(response, 400, { error: "Invalid direction" });
          return;
        }

        room.state = player.role === "player"
          ? queueDirection(room.state, direction)
          : queueEnemyDirection(room.state, direction);
        broadcastSnapshot(room);
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && roomPath.action === "action") {
        const body = await parseJsonBody(request);
        const player = authenticate(room, body.token);
        if (!player) {
          sendJson(response, 401, { error: "Unauthorized" });
          return;
        }

        if (player.role !== "player") {
          sendJson(response, 403, { error: "Only host can manage the match" });
          return;
        }

        const action = body.action;
        if (action === "start") {
          room.state = startGame(room.state);
        } else if (action === "pause") {
          room.state = togglePause(room.state);
        } else if (action === "restart") {
          room.state = restartGame(room.settings);
        } else {
          sendJson(response, 400, { error: "Invalid action" });
          return;
        }

        broadcastSnapshot(room);
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && roomPath.action === "leave") {
        const body = await parseJsonBody(request);
        const player = authenticate(room, body.token);
        if (!player) {
          sendJson(response, 401, { error: "Unauthorized" });
          return;
        }

        if (player.role === "player") {
          room.players.player = null;
        } else {
          room.players.enemy = null;
        }

        for (const client of room.clients) {
          if (client.role === player.role) {
            client.response.end();
            room.clients.delete(client);
          }
        }

        if (!room.players.player && !room.players.enemy) {
          stopRoomLoop(room);
          rooms.delete(room.id);
          sendJson(response, 200, { ok: true, removed: true });
          return;
        }

        room.state = {
          ...room.state,
          status: "ready"
        };
        broadcastSnapshot(room);
        sendJson(response, 200, { ok: true });
        return;
      }

      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const urlPath = pathname === "/" ? "/index.html" : pathname;
    const safePath = normalize(urlPath).replace(/^[/\\]+/, "").replace(/^(\.\.[/\\])+/, "");
    const filePath = join(ROOT, safePath);

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    sendJson(response, 500, { error: "Internal server error", detail: String(error.message || error) });
  }
}).listen(PORT, () => {
  console.log(`Battle Snake is running at http://localhost:${PORT}`);
});
