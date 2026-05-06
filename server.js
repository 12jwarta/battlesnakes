import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

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

const RATE_LIMITS = {
  createRoom: { limit: 5, windowMs: 60_000 },
  joinRoom: { limit: 30, windowMs: 60_000 },
  inputHttp: { limit: 10, windowMs: 1_000 },
  actionHttp: { limit: 5, windowMs: 1_000 },
  wsConnectIp: { limit: 30, windowMs: 60_000 },
  wsConnectRoom: { limit: 20, windowMs: 60_000 },
  wsInput: { limit: 25, windowMs: 1_000 },
  wsAction: { limit: 10, windowMs: 5_000 },
  wsPing: { limit: 5, windowMs: 1_000 }
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const rooms = new Map();
const rateBuckets = new Map();

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
}

function consumeRateLimit(subjectKey, limit, windowMs) {
  const currentTime = Date.now();
  const bucket = rateBuckets.get(subjectKey);

  if (!bucket || currentTime - bucket.windowStart >= windowMs) {
    rateBuckets.set(subjectKey, { windowStart: currentTime, count: 1, windowMs });
    return false;
  }

  bucket.count += 1;
  bucket.windowMs = windowMs;
  if (bucket.count > limit) {
    return true;
  }

  rateBuckets.set(subjectKey, bucket);
  return false;
}

function isRateLimited(request, actionKey, limit, windowMs) {
  const ip = getClientIp(request);
  return consumeRateLimit(`${actionKey}:${ip}`, limit, windowMs);
}

function maybeCleanupRateBuckets() {
  const currentTime = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    const windowMs = typeof bucket.windowMs === "number" ? bucket.windowMs : 60_000;
    if (currentTime - bucket.windowStart >= windowMs) {
      rateBuckets.delete(key);
    }
  }
}

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

  const requestedDifficulty = typeof input.difficultyLabel === "string" ? input.difficultyLabel : "hard";
  // Online matches should never enter tutorial mode.
  const normalizedDifficulty = requestedDifficulty === "beginner" ? "easy" : requestedDifficulty;

  return {
    difficultyLabel: normalizedDifficulty,
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

function sendClientSnapshot(room, client) {
  const payload = {
    type: "snapshot",
    ...roomPublicState(room),
    you: client.role
  };

  if (client.type === "sse") {
    sendSseEvent(client.response, "snapshot", payload);
    return;
  }

  if (client.type === "ws" && client.socket.readyState === client.socket.OPEN) {
    client.socket.send(JSON.stringify(payload));
  }
}

function sendWsError(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ type: "error", error: message }));
  }
}

function broadcastSnapshot(room) {
  room.lastActivityAt = now();
  for (const client of room.clients) {
    sendClientSnapshot(room, client);
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
  const roomMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)(?:\/(join|input|action|stream|leave|ws))?$/);
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
        try {
          if (client.type === "sse") {
            client.response.end();
          } else if (client.type === "ws") {
            client.socket.close(1000, "Room expired");
          }
        } catch {
          // Ignore close cleanup errors.
        }
      }
      rooms.delete(room.id);
    }
  }
}

function applyRoomInput(room, player, direction) {
  if (typeof direction !== "string") {
    return { ok: false, status: 400, error: "Invalid direction" };
  }

  room.state = player.role === "player"
    ? queueDirection(room.state, direction)
    : queueEnemyDirection(room.state, direction);
  broadcastSnapshot(room);
  return { ok: true };
}

function applyRoomAction(room, player, action) {
  if (player.role !== "player") {
    return { ok: false, status: 403, error: "Only host can manage the match" };
  }

  if (action === "start") {
    room.state = startGame(room.state);
  } else if (action === "pause") {
    room.state = togglePause(room.state);
  } else if (action === "restart") {
    room.state = restartGame(room.settings);
  } else {
    return { ok: false, status: 400, error: "Invalid action" };
  }

  broadcastSnapshot(room);
  return { ok: true };
}

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 2048
});

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (request.method === "POST" && pathname === "/api/rooms") {
      if (isRateLimited(request, "create_room", RATE_LIMITS.createRoom.limit, RATE_LIMITS.createRoom.windowMs)) {
        sendJson(response, 429, { error: "Too many room creation attempts. Please try again later." });
        return;
      }
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

        if (isRateLimited(request, `join_room_${room.id}`, RATE_LIMITS.joinRoom.limit, RATE_LIMITS.joinRoom.windowMs)) {
          sendJson(response, 429, { error: "Too many join attempts. Please try again later." });
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
          type: "sse",
          role: player.role,
          response
        };
        room.clients.add(client);
        room.lastActivityAt = now();
        sendClientSnapshot(room, client);

        request.on("close", () => {
          room.clients.delete(client);
        });
        return;
      }

      if (request.method === "POST" && roomPath.action === "input") {
        if (isRateLimited(request, `input_${room.id}`, RATE_LIMITS.inputHttp.limit, RATE_LIMITS.inputHttp.windowMs)) {
          sendJson(response, 429, { error: "Too many input attempts. Slow it down." });
          return;
        }
        const body = await parseJsonBody(request);
        const player = authenticate(room, body.token);
        if (!player) {
          sendJson(response, 401, { error: "Unauthorized" });
          return;
        }

        const inputResult = applyRoomInput(room, player, body.direction);
        if (!inputResult.ok) {
          sendJson(response, inputResult.status, { error: inputResult.error });
          return;
        }
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && roomPath.action === "action") {
        if (isRateLimited(request, `action_${room.id}`, RATE_LIMITS.actionHttp.limit, RATE_LIMITS.actionHttp.windowMs)) {
          sendJson(response, 429, { error: "Don't mash the buttons, man" });
          return;
        }
        const body = await parseJsonBody(request);
        const player = authenticate(room, body.token);
        if (!player) {
          sendJson(response, 401, { error: "Unauthorized" });
          return;
        }

        const actionResult = applyRoomAction(room, player, body.action);
        if (!actionResult.ok) {
          sendJson(response, actionResult.status, { error: actionResult.error });
          return;
        }
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

        for (const client of [...room.clients]) {
          if (client.role === player.role) {
            try {
              if (client.type === "sse") {
                client.response.end();
              } else if (client.type === "ws") {
                client.socket.close(1000, "Player left");
              }
            } catch {
              // Ignore close cleanup errors.
            } finally {
              room.clients.delete(client);
            }
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
});

server.on("upgrade", (request, socket, head) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const roomPath = findRoomByPath(requestUrl.pathname);
    if (!roomPath || roomPath.action !== "ws") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const room = rooms.get(roomPath.roomId);
    if (!room) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const token = requestUrl.searchParams.get("token");
    const player = authenticate(room, token);
    if (!player) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const ip = getClientIp(request);
    if (
      consumeRateLimit(`ws_connect_ip:${ip}`, RATE_LIMITS.wsConnectIp.limit, RATE_LIMITS.wsConnectIp.windowMs)
      || consumeRateLimit(`ws_connect_room:${room.id}:${ip}`, RATE_LIMITS.wsConnectRoom.limit, RATE_LIMITS.wsConnectRoom.windowMs)
    ) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const client = {
        type: "ws",
        role: player.role,
        socket: ws,
        roomId: room.id,
        ip
      };
      room.clients.add(client);
      room.lastActivityAt = now();
      sendClientSnapshot(room, client);

      ws.on("message", (raw) => {
        let payload;
        try {
          payload = JSON.parse(raw.toString());
        } catch {
          sendWsError(ws, "Invalid message payload");
          return;
        }

        if (!payload || typeof payload.type !== "string") {
          sendWsError(ws, "Invalid message format");
          return;
        }

        const activeRoom = rooms.get(client.roomId);
        if (!activeRoom) {
          sendWsError(ws, "Room is no longer available");
          return;
        }

        const activePlayer = activeRoom.players[player.role];
        if (!activePlayer || activePlayer.token !== player.token) {
          sendWsError(ws, "Unauthorized socket message");
          return;
        }

        if (payload.type === "input") {
          if (
            consumeRateLimit(
              `ws_input:${activeRoom.id}:${client.role}:${client.ip}`,
              RATE_LIMITS.wsInput.limit,
              RATE_LIMITS.wsInput.windowMs
            )
          ) {
            sendWsError(ws, "Too many input messages");
            return;
          }

          const inputResult = applyRoomInput(activeRoom, activePlayer, payload.direction);
          if (!inputResult.ok) {
            sendWsError(ws, inputResult.error);
          }
          return;
        }

        if (payload.type === "action") {
          if (
            consumeRateLimit(
              `ws_action:${activeRoom.id}:${client.role}:${client.ip}`,
              RATE_LIMITS.wsAction.limit,
              RATE_LIMITS.wsAction.windowMs
            )
          ) {
            sendWsError(ws, "Too many action messages");
            return;
          }

          const actionResult = applyRoomAction(activeRoom, activePlayer, payload.action);
          if (!actionResult.ok) {
            sendWsError(ws, actionResult.error);
          }
          return;
        }

        if (payload.type === "ping") {
          if (
            consumeRateLimit(
              `ws_ping:${activeRoom.id}:${client.role}:${client.ip}`,
              RATE_LIMITS.wsPing.limit,
              RATE_LIMITS.wsPing.windowMs
            )
          ) {
            return;
          }
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "pong", t: payload.t ?? null }));
          }
          return;
        }

        sendWsError(ws, "Unknown message type");
      });

      ws.on("close", () => {
        room.clients.delete(client);
      });
    });
  } catch {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
  }
});

setInterval(maybeCleanupRooms, 60_000).unref();
setInterval(maybeCleanupRateBuckets, 60_000).unref();

server.listen(PORT, () => {
  console.log(`Battle Snake is running at http://localhost:${PORT}`);
});
