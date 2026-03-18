import {
  advanceGame,
  createGameState,
  queueDirection,
  restartGame,
  startGame,
  togglePause,
  WIN_SCORE
} from "./game.js";

const PRESETS = {
  easy: {
    speedMs: 170,
    enemyErrorEnabled: true,
    enemyErrorRate: 0.1,
    startingPlayerPoints: 0,
    startingEnemyPoints: 0,
    startingPlayerSize: 1,
    startingEnemySize: 1
  },
  medium: {
    speedMs: 150,
    enemyErrorEnabled: true,
    enemyErrorRate: 0.05,
    startingPlayerPoints: 0,
    startingEnemyPoints: 0,
    startingPlayerSize: 1,
    startingEnemySize: 1
  },
  hard: {
    speedMs: 140,
    enemyErrorEnabled: true,
    enemyErrorRate: 0,
    startingPlayerPoints: 0,
    startingEnemyPoints: 0,
    startingPlayerSize: 1,
    startingEnemySize: 1
  }
};

const boardElement = document.querySelector("#board");
const playerMiniSnakeElement = document.querySelector("#player-mini-snake");
const enemyMiniSnakeElement = document.querySelector("#enemy-mini-snake");
const playerMiniScoreElement = document.querySelector("#player-mini-score");
const enemyMiniScoreElement = document.querySelector("#enemy-mini-score");
const statusElement = document.querySelector("#status");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const onlineHostButton = document.querySelector("#online-host-button");
const onlineJoinButton = document.querySelector("#online-join-button");
const onlineLeaveButton = document.querySelector("#online-leave-button");
const joinRoomInput = document.querySelector("#join-room-input");
const onlineStatusElement = document.querySelector("#online-status");
const mobilePauseButton = document.querySelector("#mobile-pause-button");
const mobileResetButton = document.querySelector("#mobile-reset-button");
const settingsToggleButton = document.querySelector("#settings-toggle-button");
const rulesToggleButton = document.querySelector("#rules-toggle-button");
const settingsPanel = document.querySelector("#settings-panel");
const rulesPanel = document.querySelector("#rules-panel");
const difficultySetting = document.querySelector("#difficulty-setting");
const speedSetting = document.querySelector("#speed-setting");
const speedSettingValue = document.querySelector("#speed-setting-value");
const enemyErrorEnabledSetting = document.querySelector("#enemy-error-enabled");
const enemyErrorRateSetting = document.querySelector("#enemy-error-rate-setting");
const enemyErrorRateValue = document.querySelector("#enemy-error-rate-value");
const startPlayerPointsSetting = document.querySelector("#start-player-points-setting");
const startEnemyPointsSetting = document.querySelector("#start-enemy-points-setting");
const startPlayerSizeSetting = document.querySelector("#start-player-size-setting");
const startEnemySizeSetting = document.querySelector("#start-enemy-size-setting");
const controlButtons = document.querySelectorAll("[data-direction]");

let settings = { ...PRESETS.hard };
let selectedDifficulty = "hard";
let activeOverlay = null;
let suppressSettingEvents = false;
let state = createGameState(buildGameOptions());
let cells = [];
let baseCellClasses = [];
let tickHandle = null;
let onlineSession = null;
const MOBILE_SPEED_SCALE = 1.22;

function isOnlineActive() {
  return Boolean(onlineSession);
}

function buildGameOptions() {
  return {
    difficultyLabel: selectedDifficulty,
    enemyErrorEnabled: settings.enemyErrorEnabled,
    enemyErrorRate: settings.enemyErrorRate,
    startingPlayerPoints: settings.startingPlayerPoints,
    startingEnemyPoints: settings.startingEnemyPoints,
    startingPlayerSize: settings.startingPlayerSize,
    startingEnemySize: settings.startingEnemySize
  };
}

function clampInt(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return min;
  }

  return Math.min(max, Math.max(min, parsed));
}

function applyPreset(name) {
  const base = { ...PRESETS[name] };
  const scaledSpeed = isMobileLayout()
    ? Math.min(260, Math.round((base.speedMs * MOBILE_SPEED_SCALE) / 10) * 10)
    : base.speedMs;
  settings = {
    ...base,
    speedMs: scaledSpeed
  };
  selectedDifficulty = name;
  syncSettingsControls();
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 560px), (pointer: coarse)").matches;
}

function syncSettingsControls() {
  suppressSettingEvents = true;
  difficultySetting.value = selectedDifficulty;
  speedSetting.value = String(settings.speedMs);
  speedSettingValue.textContent = String(settings.speedMs);
  enemyErrorEnabledSetting.checked = settings.enemyErrorEnabled;
  enemyErrorRateSetting.value = String(Math.round(settings.enemyErrorRate * 100));
  enemyErrorRateValue.textContent = `${Math.round(settings.enemyErrorRate * 100)}%`;
  startPlayerPointsSetting.value = String(settings.startingPlayerPoints);
  startEnemyPointsSetting.value = String(settings.startingEnemyPoints);
  startPlayerSizeSetting.value = String(settings.startingPlayerSize);
  startEnemySizeSetting.value = String(settings.startingEnemySize);
  suppressSettingEvents = false;
}

function markCustomDifficulty() {
  if (selectedDifficulty !== "custom") {
    selectedDifficulty = "custom";
    syncSettingsControls();
  }
}

function readSettingsFromControls() {
  settings = {
    speedMs: clampInt(speedSetting.value, 80, 260),
    enemyErrorEnabled: enemyErrorEnabledSetting.checked,
    enemyErrorRate: clampInt(enemyErrorRateSetting.value, 0, 30) / 100,
    startingPlayerPoints: clampInt(startPlayerPointsSetting.value, 0, 30),
    startingEnemyPoints: clampInt(startEnemyPointsSetting.value, 0, 30),
    startingPlayerSize: clampInt(startPlayerSizeSetting.value, 1, 30),
    startingEnemySize: clampInt(startEnemySizeSetting.value, 1, 30)
  };
  syncSettingsControls();
}

function createBoard() {
  boardElement.innerHTML = "";
  cells = [];
  baseCellClasses = [];
  boardElement.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
  boardElement.style.gridTemplateRows = `repeat(${state.height}, 1fr)`;
  const centerRow = Math.floor((state.height - 1) / 2);
  const centerBandStart = centerRow - 1;
  const centerBandEnd = centerRow + 1;
  boardElement.style.setProperty("--center-band-start", `${(centerBandStart / state.height) * 100}%`);
  boardElement.style.setProperty("--center-band-end", `${((centerBandEnd + 1) / state.height) * 100}%`);
  const fragment = document.createDocumentFragment();
  const centerColumn = Math.floor((state.width - 1) / 2);

  for (let index = 0; index < state.width * state.height; index += 1) {
    const x = index % state.width;
    const cell = document.createElement("div");
    const classes = ["cell"];
    if (x < centerColumn - 1) {
      classes.push("cell--left-zone");
    } else if (x > centerColumn + 1) {
      classes.push("cell--right-zone");
    }

    const baseClass = classes.join(" ");
    cell.className = baseClass;
    fragment.appendChild(cell);
    cells.push(cell);
    baseCellClasses.push(baseClass);
  }

  boardElement.appendChild(fragment);
}

function toIndex(x, y) {
  return y * state.width + x;
}

function setActiveOverlay(nextOverlay) {
  activeOverlay = nextOverlay;
  const showingRules = activeOverlay === "rules";
  const showingSettings = activeOverlay === "settings";

  if (showingRules) {
    rulesPanel.removeAttribute("hidden");
  } else {
    rulesPanel.setAttribute("hidden", "");
  }

  if (showingSettings) {
    settingsPanel.removeAttribute("hidden");
  } else {
    settingsPanel.setAttribute("hidden", "");
  }

  rulesToggleButton.textContent = showingRules ? "Hide Rules" : "Show Rules";
  rulesToggleButton.setAttribute("aria-expanded", String(showingRules));
  settingsToggleButton.textContent = showingSettings ? "Hide Settings" : "Show Settings";
  settingsToggleButton.setAttribute("aria-expanded", String(showingSettings));

  const controlsDisabled = activeOverlay !== null;
  startButton.disabled = controlsDisabled;
  pauseButton.disabled = controlsDisabled;
  onlineHostButton.disabled = controlsDisabled;
  onlineJoinButton.disabled = controlsDisabled;
  onlineLeaveButton.disabled = controlsDisabled;
  joinRoomInput.disabled = controlsDisabled;
  mobilePauseButton.disabled = controlsDisabled;
  mobileResetButton.disabled = controlsDisabled;
  for (const button of controlButtons) {
    button.disabled = controlsDisabled;
  }
  updateOnlineControls();
}

function updateOnlineStatus(text) {
  onlineStatusElement.textContent = text;
}

function updateOnlineControls() {
  const connected = isOnlineActive();
  onlineHostButton.disabled = connected || activeOverlay !== null;
  onlineJoinButton.disabled = connected || activeOverlay !== null;
  joinRoomInput.disabled = connected || activeOverlay !== null;
  onlineLeaveButton.disabled = !connected || activeOverlay !== null;
  if (connected && onlineSession.role !== "player") {
    startButton.disabled = true;
    pauseButton.disabled = true;
    mobilePauseButton.disabled = true;
    mobileResetButton.disabled = true;
  } else {
    mobilePauseButton.disabled = activeOverlay !== null;
    mobileResetButton.disabled = activeOverlay !== null;
  }
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function connectRoomStream(roomId, token, role) {
  const source = new EventSource(`/api/rooms/${roomId}/stream?token=${encodeURIComponent(token)}`);
  source.addEventListener("snapshot", (event) => {
    const snapshot = JSON.parse(event.data);
    const previousWidth = state.width;
    const previousHeight = state.height;
    state = snapshot.state;
    if (state.width !== previousWidth || state.height !== previousHeight || cells.length === 0) {
      createBoard();
    }
    render();
    const youLabel = role === "player" ? "Host" : "Guest";
    updateOnlineStatus(
      `Online ${youLabel} in room ${roomId}. ${snapshot.playerConnected && snapshot.enemyConnected ? "Both players connected." : "Waiting for opponent..."}`
    );
    updateOnlineControls();
  });
  source.onerror = () => {
    if (!onlineSession || onlineSession.roomId !== roomId) {
      return;
    }
    void disconnectOnlineSession(`Disconnected from room ${roomId}.`);
  };
  return source;
}

function stopLocalTick() {
  if (tickHandle) {
    clearTimeout(tickHandle);
    tickHandle = null;
  }
}

async function disconnectOnlineSession(message = "Offline (Local AI match)") {
  if (onlineSession) {
    const leavingSession = onlineSession;
    onlineSession = null;
    if (leavingSession.stream) {
      leavingSession.stream.close();
    }
    try {
      await postJson(`/api/rooms/${leavingSession.roomId}/leave`, {
        token: leavingSession.token
      });
    } catch (_error) {
      // Best effort cleanup on leave.
    }
  }

  updateOnlineStatus(message);
  updateOnlineControls();
  resetGame();
  scheduleTick();
}

function statusMessage(currentState) {
  const difficultyLabel = currentState.difficulty.charAt(0).toUpperCase() + currentState.difficulty.slice(1);

  if (currentState.status === "ready") {
    return `${difficultyLabel} mode. Press Start or use an arrow key to begin.`;
  }

  if (currentState.status === "paused") {
    return "Paused.";
  }

  if (currentState.status === "player_won") {
    return `You won! Press Start / Restart or R to play again.`;
  }

  if (currentState.status === "enemy_won") {
    return "Enemy snake wins this round. Press Start / Restart or R to play again.";
  }

  if (currentState.status === "draw") {
    return "Draw round. Press Start / Restart or R to play again.";
  }

  return `${difficultyLabel} mode. Race to ${WIN_SCORE}. Damage removes 1 food; lose by 3-hit streak or body < 1.`;
}

function render() {
  for (let index = 0; index < cells.length; index += 1) {
    cells[index].className = baseCellClasses[index];
  }

  if (state.food.point) {
    cells[toIndex(state.food.point.x, state.food.point.y)].classList.add("cell--food");
  }

  if (state.food.player) {
    cells[toIndex(state.food.player.x, state.food.player.y)].classList.add("cell--player-food");
  }

  if (state.food.enemy) {
    cells[toIndex(state.food.enemy.x, state.food.enemy.y)].classList.add("cell--enemy-food");
  }

  state.player.snake.forEach((segment, index) => {
    const cell = cells[toIndex(segment.x, segment.y)];
    cell.classList.add("cell--snake");
    if (state.player.stunTicks > 0 && state.player.stunTicks % 2 === 0) {
      cell.classList.add("cell--player-flash");
    }

    if (index === 0) {
      cell.classList.add("cell--head");
    }
  });

  state.enemy.snake.forEach((segment, index) => {
    const cell = cells[toIndex(segment.x, segment.y)];
    cell.classList.add("cell--enemy");
    if (state.enemy.stunTicks > 0 && state.enemy.stunTicks % 2 === 0) {
      cell.classList.add("cell--enemy-flash");
    }

    if (index === 0) {
      cell.classList.add("cell--enemy-head");
    }
  });

  const playerLitCount = Math.min(state.player.score, Math.max(0, state.player.snake.length - 1));
  const enemyLitCount = Math.min(state.enemy.score, Math.max(0, state.enemy.snake.length - 1));
  playerMiniSnakeElement.innerHTML = state.player.snake
    .map((_, index) => {
      const classes = ["mini-segment", "mini-segment--player"];
      if (index === 0) {
        classes.push("mini-segment--head");
      }
      if (index > 0 && index <= playerLitCount) {
        classes.push("mini-segment--lit");
      }
      return `<span class="${classes.join(" ")}"></span>`;
    })
    .join("");
  enemyMiniSnakeElement.innerHTML = state.enemy.snake
    .map((_, index) => {
      const classes = ["mini-segment", "mini-segment--enemy"];
      if (index === 0) {
        classes.push("mini-segment--head");
      }
      if (index > 0 && index <= enemyLitCount) {
        classes.push("mini-segment--lit");
      }
      return `<span class="${classes.join(" ")}"></span>`;
    })
    .join("");

  playerMiniScoreElement.textContent = String(state.player.score);
  enemyMiniScoreElement.textContent = String(state.enemy.score);
  statusElement.textContent = statusMessage(state);
  const pauseText = state.status === "paused" ? "Resume" : "Pause";
  pauseButton.textContent = pauseText;
  mobilePauseButton.textContent = pauseText;
}

async function sendOnlineDirection(direction) {
  if (!onlineSession) {
    return;
  }

  try {
    await postJson(`/api/rooms/${onlineSession.roomId}/input`, {
      token: onlineSession.token,
      direction
    });
  } catch (error) {
    updateOnlineStatus(`Input failed: ${error.message}`);
  }
}

function handleDirection(direction) {
  if (activeOverlay !== null) {
    return;
  }

  if (isOnlineActive()) {
    void sendOnlineDirection(direction);
    return;
  }

  state = queueDirection(state, direction);
  render();
}

function resetGame() {
  state = restartGame(buildGameOptions());
  render();
}

function scheduleTick() {
  if (isOnlineActive()) {
    return;
  }

  if (tickHandle) {
    clearTimeout(tickHandle);
  }

  tickHandle = setTimeout(() => {
    state = advanceGame(state);
    render();
    scheduleTick();
  }, settings.speedMs);
}

function applySettingsAndReset() {
  if (isOnlineActive()) {
    readSettingsFromControls();
    return;
  }

  readSettingsFromControls();
  resetGame();
  scheduleTick();
}

function runStartOrRestart() {
  if (activeOverlay !== null) {
    return;
  }

  if (isOnlineActive()) {
    if (onlineSession.role !== "player") {
      return;
    }

    const action = state.status === "ready" || state.status === "paused" ? "start" : "restart";
    void postJson(`/api/rooms/${onlineSession.roomId}/action`, {
      token: onlineSession.token,
      action
    }).catch((error) => {
      updateOnlineStatus(`Action failed: ${error.message}`);
    });
    return;
  }

  resetGame();
  state = startGame(state);
  render();
}

function runResetOnly() {
  if (activeOverlay !== null) {
    return;
  }

  if (isOnlineActive()) {
    if (onlineSession.role !== "player") {
      return;
    }

    void postJson(`/api/rooms/${onlineSession.roomId}/action`, {
      token: onlineSession.token,
      action: "restart"
    }).catch((error) => {
      updateOnlineStatus(`Action failed: ${error.message}`);
    });
    return;
  }

  resetGame();
}

function runPauseToggle() {
  if (activeOverlay !== null) {
    return;
  }

  if (isOnlineActive()) {
    if (onlineSession.role !== "player") {
      return;
    }

    const action = state.status === "ready" ? "start" : "pause";
    void postJson(`/api/rooms/${onlineSession.roomId}/action`, {
      token: onlineSession.token,
      action
    }).catch((error) => {
      updateOnlineStatus(`Action failed: ${error.message}`);
    });
    return;
  }

  state = state.status === "ready" ? startGame(state) : togglePause(state);
  render();
}

document.addEventListener("keydown", (event) => {
  if (activeOverlay !== null) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "arrowup" || key === "w") {
    event.preventDefault();
    handleDirection("UP");
    return;
  }

  if (key === "arrowdown" || key === "s") {
    event.preventDefault();
    handleDirection("DOWN");
    return;
  }

  if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    handleDirection("LEFT");
    return;
  }

  if (key === "arrowright" || key === "d") {
    event.preventDefault();
    handleDirection("RIGHT");
    return;
  }

  if (key === " ") {
    event.preventDefault();
    state = state.status === "ready" ? startGame(state) : togglePause(state);
    render();
    return;
  }

  if (key === "r") {
    event.preventDefault();
    resetGame();
  }
});

startButton.addEventListener("click", () => {
  if (isMobileLayout()) {
    runResetOnly();
    return;
  }

  runStartOrRestart();
});

pauseButton.addEventListener("click", () => {
  runPauseToggle();
});

mobilePauseButton.addEventListener("click", () => {
  runPauseToggle();
});

mobileResetButton.addEventListener("click", () => {
  runResetOnly();
});

onlineHostButton.addEventListener("click", async () => {
  if (isOnlineActive() || activeOverlay !== null) {
    return;
  }

  try {
    stopLocalTick();
    const created = await postJson("/api/rooms", {
      settings: buildGameOptions()
    });
    const stream = connectRoomStream(created.roomId, created.token, created.role);
    onlineSession = {
      roomId: created.roomId,
      role: created.role,
      token: created.token,
      stream
    };
    updateOnlineStatus(`Hosting room ${created.roomId}. Share this code and press Pause to start when ready.`);
    updateOnlineControls();
  } catch (error) {
    scheduleTick();
    updateOnlineStatus(`Host failed: ${error.message}`);
  }
});

onlineJoinButton.addEventListener("click", async () => {
  if (isOnlineActive() || activeOverlay !== null) {
    return;
  }

  const roomId = joinRoomInput.value.trim().toUpperCase();
  if (!roomId) {
    updateOnlineStatus("Enter a room code to join.");
    return;
  }

  try {
    stopLocalTick();
    const joined = await postJson(`/api/rooms/${roomId}/join`, {});
    const stream = connectRoomStream(joined.roomId, joined.token, joined.role);
    onlineSession = {
      roomId: joined.roomId,
      role: joined.role,
      token: joined.token,
      stream
    };
    updateOnlineStatus(`Joined room ${joined.roomId} as guest.`);
    updateOnlineControls();
  } catch (error) {
    scheduleTick();
    updateOnlineStatus(`Join failed: ${error.message}`);
  }
});

onlineLeaveButton.addEventListener("click", () => {
  void disconnectOnlineSession();
});

settingsToggleButton.addEventListener("click", () => {
  setActiveOverlay(activeOverlay === "settings" ? null : "settings");
});

rulesToggleButton.addEventListener("click", () => {
  setActiveOverlay(activeOverlay === "rules" ? null : "rules");
});

difficultySetting.addEventListener("change", () => {
  if (suppressSettingEvents) {
    return;
  }

  const nextDifficulty = difficultySetting.value;
  if (nextDifficulty === "custom") {
    selectedDifficulty = "custom";
    syncSettingsControls();
    return;
  }

  applyPreset(nextDifficulty);
  applySettingsAndReset();
});

const customInputs = [
  speedSetting,
  enemyErrorEnabledSetting,
  enemyErrorRateSetting,
  startPlayerPointsSetting,
  startEnemyPointsSetting,
  startPlayerSizeSetting,
  startEnemySizeSetting
];

for (const input of customInputs) {
  input.addEventListener("input", () => {
    if (suppressSettingEvents) {
      return;
    }

    markCustomDifficulty();
    applySettingsAndReset();
  });
}

for (const button of controlButtons) {
  button.addEventListener("click", () => {
    handleDirection(button.dataset.direction);
  });
}

applyPreset("hard");
createBoard();
setActiveOverlay(null);
render();
scheduleTick();
updateOnlineStatus("Offline (Local AI match)");
updateOnlineControls();
