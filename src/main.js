import {
  advanceTutorialPrompt,
  advanceGame,
  createGameState,
  queueDirection,
  restartGame,
  startGame,
  togglePause,
  WIN_SCORE
} from "./game.js";

const PRESETS = {
  beginner: {
    speedMs: 190,
    enemyErrorEnabled: true,
    enemyErrorRate: 0.18,
    startingPlayerPoints: 0,
    startingEnemyPoints: 0,
    startingPlayerSize: 3,
    startingEnemySize: 3
  },
  easy: {
    speedMs: 170,
    enemyErrorEnabled: true,
    enemyErrorRate: 0.14,
    startingPlayerPoints: 0,
    startingEnemyPoints: 0,
    startingPlayerSize: 1,
    startingEnemySize: 1
  },
  medium: {
    speedMs: 150,
    enemyErrorEnabled: true,
    enemyErrorRate: 0.07,
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
const pointsBarElement = document.querySelector("#points-bar");
const beginnerDialogElement = document.querySelector("#beginner-dialog");
const beginnerDialogTitleElement = document.querySelector("#beginner-dialog-title");
const beginnerDialogTextElement = document.querySelector("#beginner-dialog-text");
const playerMiniSnakeElement = document.querySelector("#player-mini-snake");
const enemyMiniSnakeElement = document.querySelector("#enemy-mini-snake");
const playerMiniScoreElement = document.querySelector("#player-mini-score");
const enemyMiniScoreElement = document.querySelector("#enemy-mini-score");
const statusElement = document.querySelector("#status");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const menuToggleButton = document.querySelector("#menu-toggle-button");
const controlsToggleButton = document.querySelector("#controls-toggle-button");
const menuBackdrop = document.querySelector("#menu-backdrop");
const hamburgerMenu = document.querySelector("#hamburger-menu");
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
const controlsPanel = document.querySelector("#controls-panel");
const settingsCloseButton = document.querySelector("#settings-close-button");
const rulesCloseButton = document.querySelector("#rules-close-button");
const controlsCloseButton = document.querySelector("#controls-close-button");
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
const colorblindSetting = document.querySelector("#colorblind-setting");
const rulesColorblindToggle = document.querySelector("#rules-colorblind-toggle");
const controlButtons = document.querySelectorAll("[data-direction]");
const dpadControlsElement = document.querySelector("#dpad-controls");
const relativeControlsElement = document.querySelector("#relative-controls");
const controlSchemeDpadInput = document.querySelector("#control-scheme-dpad");
const controlSchemeRelativeInput = document.querySelector("#control-scheme-relative");
const turnLeftButton = document.querySelector("#turn-left-button");
const turnRightButton = document.querySelector("#turn-right-button");

let settings = { ...PRESETS.beginner };
let selectedDifficulty = "beginner";
let activeOverlay = null;
let suppressSettingEvents = false;
let state = createGameState(buildGameOptions());
let cells = [];
let baseCellClasses = [];
let tickHandle = null;
let onlineSession = null;
const MOBILE_SPEED_SCALE = 1.22;
let menuOpen = false;
let colorblindMode = false;
let controlScheme = "dpad";

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
  colorblindSetting.checked = colorblindMode;
  rulesColorblindToggle.checked = colorblindMode;
  suppressSettingEvents = false;
}

function applyColorblindMode(enabled) {
  colorblindMode = enabled;
  document.documentElement.classList.toggle("colorblind-mode", colorblindMode);
  colorblindSetting.checked = colorblindMode;
  rulesColorblindToggle.checked = colorblindMode;
}

function applyControlScheme(nextScheme) {
  controlScheme = nextScheme === "relative" ? "relative" : "dpad";
  controlSchemeDpadInput.checked = controlScheme === "dpad";
  controlSchemeRelativeInput.checked = controlScheme === "relative";

  if (controlScheme === "relative") {
    relativeControlsElement.removeAttribute("hidden");
    dpadControlsElement?.setAttribute("hidden", "");
    return;
  }

  relativeControlsElement.setAttribute("hidden", "");
  dpadControlsElement?.removeAttribute("hidden");
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
  const showingControls = activeOverlay === "controls";

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

  if (showingControls) {
    controlsPanel.removeAttribute("hidden");
  } else {
    controlsPanel.setAttribute("hidden", "");
  }

  rulesToggleButton.textContent = showingRules ? "Hide Rules" : "Show Rules";
  rulesToggleButton.setAttribute("aria-expanded", String(showingRules));
  settingsToggleButton.textContent = showingSettings ? "Hide Settings" : "Show Settings";
  settingsToggleButton.setAttribute("aria-expanded", String(showingSettings));
  controlsToggleButton.setAttribute("aria-expanded", String(showingControls));

  const controlsDisabled = activeOverlay !== null;
  startButton.disabled = controlsDisabled;
  pauseButton.disabled = controlsDisabled;
  controlsToggleButton.disabled = controlsDisabled;
  onlineHostButton.disabled = controlsDisabled;
  onlineJoinButton.disabled = controlsDisabled;
  onlineLeaveButton.disabled = controlsDisabled;
  joinRoomInput.disabled = controlsDisabled;
  mobilePauseButton.disabled = controlsDisabled;
  mobileResetButton.disabled = controlsDisabled;
  turnLeftButton.disabled = controlsDisabled;
  turnRightButton.disabled = controlsDisabled;
  for (const button of controlButtons) {
    button.disabled = controlsDisabled;
  }
  updateOnlineControls();
}

function setMenuOpen(nextOpen) {
  menuOpen = nextOpen;
  hamburgerMenu.classList.toggle("is-open", menuOpen);
  hamburgerMenu.setAttribute("aria-hidden", String(!menuOpen));
  menuBackdrop.setAttribute("hidden", "");
  menuToggleButton.setAttribute("aria-expanded", String(menuOpen));
}

function mirrorDirection(direction) {
  if (direction === "LEFT") {
    return "RIGHT";
  }
  if (direction === "RIGHT") {
    return "LEFT";
  }
  return direction;
}

function mirrorSide(side) {
  if (side === "left") {
    return "right";
  }
  if (side === "right") {
    return "left";
  }
  return side;
}

function mirrorCell(cell, width) {
  if (!cell) {
    return null;
  }
  return {
    x: width - 1 - cell.x,
    y: cell.y
  };
}

function localizeSnapshotState(serverState, role) {
  if (role !== "enemy") {
    return serverState;
  }

  const transformSnakeState = (snakeState) => ({
    ...snakeState,
    snake: snakeState.snake.map((segment) => mirrorCell(segment, serverState.width)),
    direction: mirrorDirection(snakeState.direction),
    nextDirection: mirrorDirection(snakeState.nextDirection)
  });

  const mirroredStatus = serverState.status === "player_won"
    ? "enemy_won"
    : serverState.status === "enemy_won"
      ? "player_won"
      : serverState.status;

  return {
    ...serverState,
    player: transformSnakeState(serverState.enemy),
    enemy: transformSnakeState(serverState.player),
    food: {
      point: mirrorCell(serverState.food.point, serverState.width),
      player: mirrorCell(serverState.food.enemy, serverState.width),
      enemy: mirrorCell(serverState.food.player, serverState.width)
    },
    status: mirroredStatus,
    foodRespawnSide: mirrorSide(serverState.foodRespawnSide),
    walls: (serverState.walls || []).map((wallCell) => mirrorCell(wallCell, serverState.width)),
    beginnerTutorial: serverState.beginnerTutorial
      ? {
        ...serverState.beginnerTutorial,
        enemyTarget: mirrorCell(serverState.beginnerTutorial.enemyTarget, serverState.width)
      }
      : null
  };
}

function updateOnlineStatus(text) {
  onlineStatusElement.textContent = text;
}

function updateOnlineControls() {
  const connected = isOnlineActive();
  const blocked = activeOverlay !== null;
  onlineHostButton.disabled = connected || blocked;
  onlineJoinButton.disabled = connected || blocked;
  joinRoomInput.disabled = connected || blocked;
  onlineLeaveButton.disabled = !connected || blocked;
  if (connected && onlineSession.role !== "player") {
    startButton.disabled = true;
    pauseButton.disabled = true;
    mobilePauseButton.disabled = true;
    mobileResetButton.disabled = true;
    turnLeftButton.disabled = true;
    turnRightButton.disabled = true;
  } else {
    mobilePauseButton.disabled = activeOverlay !== null;
    mobileResetButton.disabled = activeOverlay !== null;
    turnLeftButton.disabled = activeOverlay !== null;
    turnRightButton.disabled = activeOverlay !== null;
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

function connectRoomSocket(roomId, token, role) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(
    `${protocol}://${window.location.host}/api/rooms/${roomId}/ws?token=${encodeURIComponent(token)}`
  );

  socket.addEventListener("open", () => {
    const youLabel = role === "player" ? "Host" : "Guest";
    updateOnlineStatus(`Online ${youLabel} in room ${roomId}. Connecting...`);
  });

  socket.addEventListener("message", (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    if (payload.type === "snapshot") {
      const previousWidth = state.width;
      const previousHeight = state.height;
      state = localizeSnapshotState(payload.state, role);
      if (state.width !== previousWidth || state.height !== previousHeight || cells.length === 0) {
        createBoard();
      }
      render();
      const youLabel = role === "player" ? "Host" : "Guest";
      updateOnlineStatus(
        `Online ${youLabel} in room ${roomId}. ${payload.playerConnected && payload.enemyConnected ? "Both players connected." : "Waiting for opponent..."}`
      );
      updateOnlineControls();
      return;
    }

    if (payload.type === "error") {
      updateOnlineStatus(`Online issue: ${payload.error}`);
    }
  });

  socket.addEventListener("close", () => {
    if (!onlineSession || onlineSession.roomId !== roomId) {
      return;
    }
    if (onlineSession.closing) {
      return;
    }
    void disconnectOnlineSession(`Disconnected from room ${roomId}.`);
  });

  socket.addEventListener("error", () => {
    updateOnlineStatus(`Socket error in room ${roomId}.`);
  });

  return socket;
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
    leavingSession.closing = true;
    onlineSession = null;
    if (leavingSession.socket) {
      leavingSession.socket.close();
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
  const resultDetails = getResultDetails(currentState);

  if (currentState.status === "ready") {
    return `${difficultyLabel} mode. Press Start or use an arrow key to begin.`;
  }

  if (currentState.status === "paused") {
    return "Paused.";
  }

  if (currentState.status === "player_won") {
    if (currentState.difficulty === "beginner" && currentState.beginnerTutorial?.phase === "complete") {
      return "Well done! You won this beginner run. Try Easy mode to sharpen up, then challenge your friends in Online mode.";
    }
    return `You won by ${resultDetails.playerWonBy}. ${difficultyEncouragement(currentState)} Press Start / Restart or R to play again.`;
  }

  if (currentState.status === "enemy_won") {
    if (currentState.difficulty === "beginner" && currentState.beginnerTutorial?.phase === "complete") {
      return "Nice try. Keep training in Easy mode, then challenge your friends in Online mode when you are ready.";
    }
    return `You lost by ${resultDetails.enemyWonBy}. ${difficultyEncouragement(currentState)} Press Start / Restart or R to play again.`;
  }

  if (currentState.status === "draw") {
    return "Draw round. Press Start / Restart or R to play again.";
  }

  return `${difficultyLabel} mode. Race to ${WIN_SCORE}. Damage removes 1 food; lose by 3-hit streak or body < 1.`;
}

function isBeginnerDialogActive(currentState) {
  if (!currentState || !currentState.beginnerTutorial) {
    return false;
  }

  return currentState.beginnerTutorial.phase !== "complete";
}

function updateBeginnerDialog(currentState) {
  if (!beginnerDialogElement || !pointsBarElement) {
    return;
  }

  const continueHint = isMobileLayout()
    ? "(tap Pause/Resume to continue)"
    : "(press Space to continue)";
  const active = isBeginnerDialogActive(currentState);
  if (active) {
    const phase = currentState.beginnerTutorial?.phase;
    let runningText;
    if (phase === "await_start") {
      runningText = "Welcome to Battlesnakes! You control the snake on the left. Use the controls to navigate to the point block at the top of your zone (press any direction to start your snake upward)";
    } else if (phase === "to_first_food") {
      runningText = "Move upward and collect the point block at the top of your zone.";
    } else if (phase === "after_first_food") {
      runningText = `Great, you collected a point block which gives you +1 point and +1 body length. Whenever you collect a point block anywhere, the next point block will generate somewhere in your opponents zone. As there is a wall preventing us from getting there, we are strictly on defense for now. At the other end of your zone is an enemy color block. Navigate back down to get it. ${continueHint}`;
    } else if (phase === "to_enemy_food") {
      runningText = "Navigate back down to collect the enemy-color block in your zone.";
    } else if (phase === "after_enemy_food") {
      runningText = `Collecting enemy-colored blocks will decrease your enemy's points by one, denying them their next point, but not next body segment. Typically your color blocks will spawn too, and they work the same for your enemy. Collecting a point block will regenerate all other blocks, collecting snake blocks will not. This means you need to collect snake blocks before someone collects the point block. Wait until you enemy collects the point block then get ready to get back on offense. ${continueHint}`;
    } else if (phase === "wait_enemy_point") {
      runningText = "Watch the enemy collect their point block, then prepare to go back on offense.";
    } else if (phase === "after_enemy_point") {
      runningText = `Looks like you're getting the hang of it. If your enemy denied you this point, dont worry; if your points are ever less than your body length, collecting your own color snake blocks will gain you a point back, and keep the enemy from denying you of the current point. In general, it's a good idea to collect any block, but prioritize the point block if you can. Try to play a few more points ${continueHint}`;
    } else if (phase === "to_practice_points") {
      runningText = "You're on offense now. Try to play a few more points.";
    } else if (phase === "after_practice_points") {
      runningText = `Okay, let's get rid of this barrier and open the game up! Crash into the wall on the right to break it down. ${continueHint}`;
    } else if (phase === "break_barrier" || phase === "wall_break_stun") {
      runningText = "Crash into the right containment wall to break it down.";
    } else if (phase === "after_barrier_removed") {
      runningText = `When your snake hits a wall or the body of the other snake, it loses one point and loses one body segment. After that the snake is stunned for a short while. If snakes collide head on, both are damaged and moved one tile in a random direction. A snake taking damage three times in a row will instantly lose, and a snake will also lose if it falls to zero body length. ${continueHint}`;
    } else if (phase === "final_ready_prompt") {
      runningText = `It's up to you now! Play the rest of this game out and see how you do! ${continueHint}`;
    } else {
      runningText = "Tutorial sequence continuing. Follow the next prompt to proceed.";
    }
    if (currentState.beginnerTutorial?.playerResetNotice) {
      runningText = `${currentState.beginnerTutorial.playerResetNotice} ${runningText}`;
    }
    beginnerDialogTitleElement.textContent = "Beginner Mode Tutorial";
    beginnerDialogTextElement.textContent = runningText;
    beginnerDialogElement.removeAttribute("hidden");
    pointsBarElement.setAttribute("hidden", "");
    return;
  }

  beginnerDialogElement.setAttribute("hidden", "");
  pointsBarElement.removeAttribute("hidden");
}

function getResultDetails(currentState) {
  if (currentState.enemy.droppedBelowLength) {
    return {
      playerWonBy: "dropping the enemy below 1 body segment",
      enemyWonBy: "dropping below 1 body segment"
    };
  }

  if (currentState.player.droppedBelowLength) {
    return {
      playerWonBy: "dropping the enemy below 1 body segment",
      enemyWonBy: "dropping below 1 body segment"
    };
  }

  if (currentState.enemy.damageStreak >= 3) {
    return {
      playerWonBy: "forcing a 3-hit damage streak",
      enemyWonBy: "a 3-hit damage streak"
    };
  }

  if (currentState.player.damageStreak >= 3) {
    return {
      playerWonBy: "forcing a 3-hit damage streak",
      enemyWonBy: "a 3-hit damage streak"
    };
  }

  return {
    playerWonBy: `reaching ${WIN_SCORE} points first`,
    enemyWonBy: `the enemy reaching ${WIN_SCORE} points first`
  };
}

function difficultyEncouragement(currentState) {
  if (currentState.status === "player_won") {
    if (currentState.difficulty === "easy") {
      return "Nice work on Easy, try Medium next.";
    }

    if (currentState.difficulty === "medium") {
      return "Strong round on Medium, see how you do on Hard.";
    }

    return "";
  }

  if (currentState.status === "enemy_won") {
    if (currentState.difficulty === "hard") {
      return "Hard is brutal, try Medium to dial it in.";
    }

    if (currentState.difficulty === "medium") {
      return "Try Easy for a round, then climb back up.";
    }
  }

  return "";
}

function render() {
  for (let index = 0; index < cells.length; index += 1) {
    cells[index].className = baseCellClasses[index];
  }

  if (state.walls) {
    for (const wallCell of state.walls) {
      cells[toIndex(wallCell.x, wallCell.y)].classList.add("cell--wall");
    }
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
  updateBeginnerDialog(state);
  statusElement.textContent = statusMessage(state);
  const paused = state.status === "paused";
  pauseButton.textContent = paused ? "▶" : "⏸";
  pauseButton.setAttribute("aria-label", paused ? "Resume game" : "Pause game");
  pauseButton.setAttribute("title", paused ? "Resume" : "Pause");
  const pauseText = paused ? "Resume" : "Pause";
  mobilePauseButton.textContent = pauseText;
}

function sendOnlineMessage(payload) {
  if (!onlineSession) {
    return;
  }

  if (!onlineSession.socket || onlineSession.socket.readyState !== WebSocket.OPEN) {
    updateOnlineStatus("Online connection is not ready yet.");
    return;
  }

  const nextPayload = { ...payload };
  if (nextPayload.type === "input" && onlineSession.role === "enemy") {
    nextPayload.direction = mirrorDirection(nextPayload.direction);
  }

  onlineSession.socket.send(JSON.stringify(nextPayload));
}

function sendOnlineDirection(direction) {
  sendOnlineMessage({
    type: "input",
    direction
  });
}

function directionForRelativeTurn(currentDirection, turn) {
  if (turn === "left") {
    if (currentDirection === "UP") return "LEFT";
    if (currentDirection === "LEFT") return "DOWN";
    if (currentDirection === "DOWN") return "RIGHT";
    return "UP";
  }

  if (currentDirection === "UP") return "RIGHT";
  if (currentDirection === "RIGHT") return "DOWN";
  if (currentDirection === "DOWN") return "LEFT";
  return "UP";
}

function handleRelativeTurn(turn) {
  const basis = state.player.nextDirection || state.player.direction;
  const nextDirection = directionForRelativeTurn(basis, turn);
  handleDirection(nextDirection);
}

function handleDirection(direction) {
  if (activeOverlay !== null) {
    return;
  }

  if (isOnlineActive()) {
    sendOnlineDirection(direction);
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
    sendOnlineMessage({
      type: "action",
      action
    });
    return;
  }

  if (state.beginnerTutorial?.phase === "await_start") {
    resetGame();
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

    sendOnlineMessage({
      type: "action",
      action: "restart"
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
    sendOnlineMessage({
      type: "action",
      action
    });
    return;
  }

  if (state.beginnerTutorial?.phase === "await_start") {
    return;
  }

  const pauseAdvancePhases = new Set([
    "after_first_food",
    "after_enemy_food",
    "after_enemy_point",
    "after_practice_points",
    "after_barrier_removed",
    "final_ready_prompt"
  ]);
  if (state.status === "paused" && pauseAdvancePhases.has(state.beginnerTutorial?.phase)) {
    state = advanceTutorialPrompt(state);
    render();
    return;
  }

  state = state.status === "ready" ? startGame(state) : togglePause(state);
  render();
}

document.addEventListener("keydown", (event) => {
  if (menuOpen && event.key === "Escape") {
    setMenuOpen(false);
    return;
  }

  if (menuOpen) {
    return;
  }

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
    runPauseToggle();
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

menuToggleButton.addEventListener("click", () => {
  setMenuOpen(!menuOpen);
});

controlsToggleButton.addEventListener("click", () => {
  setMenuOpen(false);
  setActiveOverlay(activeOverlay === "controls" ? null : "controls");
});

menuBackdrop.addEventListener("click", () => {
  setMenuOpen(false);
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
    const socket = connectRoomSocket(created.roomId, created.token, created.role);
    onlineSession = {
      roomId: created.roomId,
      role: created.role,
      token: created.token,
      socket,
      closing: false
    };
    updateOnlineStatus(`Hosting room ${created.roomId}. Share this code and press Pause to start when ready.`);
    updateOnlineControls();
    setMenuOpen(false);
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
    const socket = connectRoomSocket(joined.roomId, joined.token, joined.role);
    onlineSession = {
      roomId: joined.roomId,
      role: joined.role,
      token: joined.token,
      socket,
      closing: false
    };
    updateOnlineStatus(`Joined room ${joined.roomId} as guest.`);
    updateOnlineControls();
    setMenuOpen(false);
  } catch (error) {
    scheduleTick();
    updateOnlineStatus(`Join failed: ${error.message}`);
  }
});

onlineLeaveButton.addEventListener("click", () => {
  void disconnectOnlineSession().then(() => {
    setMenuOpen(false);
  });
});

settingsToggleButton.addEventListener("click", () => {
  setMenuOpen(false);
  setActiveOverlay(activeOverlay === "settings" ? null : "settings");
});

rulesToggleButton.addEventListener("click", () => {
  setMenuOpen(false);
  setActiveOverlay(activeOverlay === "rules" ? null : "rules");
});

settingsCloseButton.addEventListener("click", () => {
  setActiveOverlay(null);
});

rulesCloseButton.addEventListener("click", () => {
  setActiveOverlay(null);
});

controlsCloseButton.addEventListener("click", () => {
  setActiveOverlay(null);
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

colorblindSetting.addEventListener("change", () => {
  applyColorblindMode(colorblindSetting.checked);
});

rulesColorblindToggle.addEventListener("change", () => {
  applyColorblindMode(rulesColorblindToggle.checked);
});

controlSchemeDpadInput.addEventListener("change", () => {
  if (controlSchemeDpadInput.checked) {
    applyControlScheme("dpad");
  }
});

controlSchemeRelativeInput.addEventListener("change", () => {
  if (controlSchemeRelativeInput.checked) {
    applyControlScheme("relative");
  }
});

for (const button of controlButtons) {
  button.addEventListener("click", () => {
    handleDirection(button.dataset.direction);
  });
}

turnLeftButton.addEventListener("click", () => {
  handleRelativeTurn("left");
});

turnRightButton.addEventListener("click", () => {
  handleRelativeTurn("right");
});

applyPreset("beginner");
applyColorblindMode(false);
applyControlScheme("dpad");
menuToggleButton.textContent = "\u2630";
startButton.textContent = "\u21BA";
createBoard();
setMenuOpen(false);
setActiveOverlay(null);
render();
scheduleTick();
updateOnlineStatus("Offline (Local AI match)");
updateOnlineControls();
