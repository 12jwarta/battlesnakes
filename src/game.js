export const BOARD_SIZE = 17;
export const WIN_SCORE = 15;
export const DAMAGE_STUN_TICKS = 6;
export const FOOD_SPAWN_DELAY_TICKS = 1;
export const DEFAULT_DIFFICULTY = "beginner";
export const DIFFICULTY_SETTINGS = {
  beginner: { errorRate: 0.18, earlyErrorBias: 0.8 },
  easy: { errorRate: 0.14, earlyErrorBias: 0.8 },
  medium: { errorRate: 0.07, earlyErrorBias: 0.8 },
  hard: { errorRate: 0, earlyErrorBias: 0.8 }
};

export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 }
};

function getCenterTriplet(size) {
  const center = Math.floor((size - 1) / 2);
  return [center - 1, center, center + 1].filter((value) => value >= 0 && value < size);
}

function isOnSide(x, width, side) {
  const center = Math.floor((width - 1) / 2);
  if (side === "left") {
    return x < center;
  }

  if (side === "right") {
    return x > center;
  }

  return true;
}

function normalizeDifficulty(value) {
  return DIFFICULTY_SETTINGS[value] ? value : DEFAULT_DIFFICULTY;
}

function cloneCell(cell) {
  return { x: cell.x, y: cell.y };
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function isInsideBoard(cell, width, height) {
  return cell.x >= 0 && cell.x < width && cell.y >= 0 && cell.y < height;
}

function isOppositeDirection(currentDirection, nextDirection) {
  const current = DIRECTIONS[currentDirection];
  const next = DIRECTIONS[nextDirection];

  return current.x + next.x === 0 && current.y + next.y === 0;
}

function nextHeadPosition(head, direction) {
  const delta = DIRECTIONS[direction];
  return { x: head.x + delta.x, y: head.y + delta.y };
}

function hasCell(list, cell) {
  return list.some((entry) => sameCell(entry, cell));
}

function hasWallCell(walls, cell) {
  if (!walls || walls.length === 0) {
    return false;
  }
  return walls.some((wallCell) => sameCell(wallCell, cell));
}

function createFoodState(point = null, player = null, enemy = null) {
  return { point, player, enemy };
}

function placeTutorialCell(
  width,
  height,
  snakes,
  walls,
  blockedCells = [],
  rng = Math.random,
  matcher = () => true
) {
  const occupied = snakes.flat();
  const candidates = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = { x, y };
      const xFromLeft = x + 1;
      const yFromBottom = height - y;
      if (!matcher({ x, y, xFromLeft, yFromBottom })) {
        continue;
      }
      if (hasCell(occupied, cell)) {
        continue;
      }
      if (hasWallCell(walls, cell)) {
        continue;
      }
      if (blockedCells.length > 0 && hasCell(blockedCells, cell)) {
        continue;
      }
      candidates.push(cell);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(rng() * candidates.length)];
}

function placeBeginnerEnemyTarget(
  width,
  height,
  snakes,
  walls,
  blockedCells = [],
  rng = Math.random,
  region = {}
) {
  const occupied = snakes.flat();
  const candidates = [];
  const minXExclusive = region.minXExclusive ?? 10;
  const minYExclusive = region.minYExclusive ?? 10;
  const maxYExclusive = region.maxYExclusive ?? null;
  const excludedCells = region.excludedCells ?? [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const xFromLeft = x + 1;
      const yFromBottom = height - y;
      const cell = { x, y };
      if (xFromLeft <= minXExclusive || yFromBottom <= minYExclusive) {
        continue;
      }
      if (maxYExclusive !== null && yFromBottom >= maxYExclusive) {
        continue;
      }
      if (hasCell(occupied, cell)) {
        continue;
      }
      if (hasWallCell(walls, cell)) {
        continue;
      }
      if (blockedCells.length > 0 && hasCell(blockedCells, cell)) {
        continue;
      }
      if (excludedCells.length > 0 && hasCell(excludedCells, cell)) {
        continue;
      }
      candidates.push(cell);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(rng() * candidates.length)];
}

function createStartingFood(width, height, snakes, rng = Math.random, options = {}) {
  const centerX = Math.floor((width - 1) / 2);
  const centerY = Math.floor((height - 1) / 2);
  const offset = options.offset ?? 1;
  const candidates = [
    { x: centerX - offset, y: centerY },
    { x: centerX + offset, y: centerY }
  ].filter((cell) => cell.x >= 0 && cell.x < width && cell.y >= 0 && cell.y < height);
  const occupied = snakes.flat();
  const available = candidates.filter((cell) => !hasCell(occupied, cell));

  if (available.length === 0) {
    return null;
  }

  return available[Math.floor(rng() * available.length)];
}

function buildInitialSnake(head, direction, size, width, height) {
  const snake = [];
  if (!isInsideBoard(head, width, height)) {
    return [{ x: 0, y: 0 }];
  }

  for (let index = 0; index < size; index += 1) {
    snake.push({ x: head.x, y: head.y });
  }

  return snake.length > 0 ? snake : [head];
}

function addStartingLength(snake, direction, width, height) {
  const tail = snake[snake.length - 1];
  if (isInsideBoard(tail, width, height)) {
    return [...snake, { x: tail.x, y: tail.y }];
  }

  return snake;
}

function createBeginnerWalls(width, height) {
  const centerX = Math.floor((width - 1) / 2);
  const leftWallX = centerX - 1;
  const rightWallX = centerX + 1;
  const walls = [];

  for (let y = 0; y < height; y += 1) {
    if (leftWallX >= 0 && leftWallX < width) {
      walls.push({ x: leftWallX, y });
    }
    if (rightWallX >= 0 && rightWallX < width) {
      walls.push({ x: rightWallX, y });
    }
  }

  return walls;
}

function beginnerToBoardCell(width, height, xFromLeft, yFromBottom) {
  const x = Math.min(width - 1, Math.max(0, xFromLeft - 1));
  const y = Math.min(height - 1, Math.max(0, height - yFromBottom));
  return { x, y };
}

export function placeFood(width, height, snakes, rng = Math.random, options = {}) {
  const constrainedOpenCells = [];
  const allOpenCells = [];
  const occupied = snakes.flat();
  const centerColumns = getCenterTriplet(width);
  const centerRows = getCenterTriplet(height);
  const centerX = Math.floor((width - 1) / 2);
  const centerY = Math.floor((height - 1) / 2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!occupied.some((segment) => segment.x === x && segment.y === y)) {
        const cell = { x, y };
        if (options.blockedCells && hasCell(options.blockedCells, cell)) {
          continue;
        }
        if (options.walls && hasWallCell(options.walls, cell)) {
          continue;
        }
        allOpenCells.push(cell);

        let matches = true;
        if (options.zone === "center") {
          matches = centerColumns.includes(x) && centerRows.includes(y);
        }

        if (matches && options.side) {
          matches = isOnSide(x, width, options.side);
        }

        if (matches && options.excludeCenterColumns) {
          matches = !centerColumns.includes(x);
        }

        if (matches && options.excludeMiddleColumn) {
          matches = x !== centerX;
        }

        if (matches && options.excludeExactCenter) {
          matches = !(x === centerX && y === centerY);
        }

        if (matches) {
          constrainedOpenCells.push(cell);
        }
      }
    }
  }

  const openCells = constrainedOpenCells.length > 0 ? constrainedOpenCells : allOpenCells;
  if (openCells.length === 0) {
    return null;
  }

  const index = Math.floor(rng() * openCells.length);
  return openCells[index];
}

export function createGameState(options = {}) {
  const width = options.width ?? BOARD_SIZE;
  const height = options.height ?? BOARD_SIZE;
  const difficultyLabel = options.difficultyLabel ?? options.difficulty ?? DEFAULT_DIFFICULTY;
  const presetDifficulty = normalizeDifficulty(options.difficulty ?? difficultyLabel);
  const preset = DIFFICULTY_SETTINGS[presetDifficulty];
  const enemyErrorEnabled = options.enemyErrorEnabled ?? true;
  const enemyErrorRate = options.enemyErrorRate ?? preset.errorRate;
  const enemyEarlyErrorBias = options.enemyEarlyErrorBias ?? preset.earlyErrorBias;
  const enemyControl = options.enemyControl === "human" ? "human" : "ai";
  const startingPlayerPoints = Math.max(0, Math.floor(options.startingPlayerPoints ?? 0));
  const startingEnemyPoints = Math.max(0, Math.floor(options.startingEnemyPoints ?? 0));
  const requestedPlayerSize = Math.max(1, Math.floor(options.startingPlayerSize ?? 1));
  const requestedEnemySize = Math.max(1, Math.floor(options.startingEnemySize ?? 1));
  const startingPlayerSize = presetDifficulty === "beginner" ? 3 : requestedPlayerSize;
  const startingEnemySize = presetDifficulty === "beginner" ? 3 : requestedEnemySize;
  const walls = presetDifficulty === "beginner" ? createBeginnerWalls(width, height) : [];
  const beginnerPlayerHead = beginnerToBoardCell(width, height, 4, 4);
  const beginnerEnemyHead = beginnerToBoardCell(width, height, 14, 4);
  const startX = Math.max(startingPlayerSize, Math.floor(width * 0.15));
  const enemyStartX = Math.min(width - startingEnemySize - 1, width - Math.floor(width * 0.15) - 1);
  const startY = Math.floor(height / 2);
  let playerSnake = buildInitialSnake(
    presetDifficulty === "beginner" ? beginnerPlayerHead : { x: startX, y: startY },
    "RIGHT",
    startingPlayerSize,
    width,
    height
  ).map(cloneCell);
  let enemySnake = buildInitialSnake(
    presetDifficulty === "beginner" ? beginnerEnemyHead : { x: enemyStartX, y: startY },
    "LEFT",
    startingEnemySize,
    width,
    height
  ).map(cloneCell);
  const beginnerStartingFood = beginnerToBoardCell(width, height, 4, 14);
  const startingFood = presetDifficulty === "beginner"
    ? beginnerStartingFood
    : createStartingFood(
      width,
      height,
      [playerSnake, enemySnake, walls],
      options.rng,
      { offset: 1 }
    );
  const beginnerEnemyTarget = presetDifficulty === "beginner"
    ? placeBeginnerEnemyTarget(
      width,
      height,
      [playerSnake, enemySnake],
      walls,
      [startingFood].filter(Boolean),
      options.rng
    )
    : null;
  const playerDistance = startingFood
    ? Math.abs(playerSnake[0].x - startingFood.x) + Math.abs(playerSnake[0].y - startingFood.y)
    : 0;
  const enemyDistance = startingFood
    ? Math.abs(enemySnake[0].x - startingFood.x) + Math.abs(enemySnake[0].y - startingFood.y)
    : 0;
  if (presetDifficulty !== "beginner") {
    if (playerDistance > enemyDistance) {
      playerSnake = addStartingLength(playerSnake, "RIGHT", width, height);
    } else if (enemyDistance > playerDistance) {
      enemySnake = addStartingLength(enemySnake, "LEFT", width, height);
    }
  }

  return {
    width,
    height,
    player: {
      snake: playerSnake,
      direction: "RIGHT",
      nextDirection: "RIGHT",
      score: startingPlayerPoints,
      stunTicks: 0,
      droppedBelowLength: false,
      damageStreak: 0
    },
    enemy: {
      snake: enemySnake,
      direction: "LEFT",
      nextDirection: "LEFT",
      score: startingEnemyPoints,
      stunTicks: 0,
      droppedBelowLength: false,
      damageStreak: 0
    },
    food: createFoodState(
      startingFood
    ),
    walls,
    status: presetDifficulty === "beginner" ? "paused" : "ready",
    difficulty: difficultyLabel,
    enemyControl,
    enemyErrorEnabled,
    enemyErrorRate,
    enemyEarlyErrorBias,
    tickCount: 0,
    foodSpawnTimer: 0,
    foodRespawnSide: null,
    beginnerTutorial: presetDifficulty === "beginner"
      ? { phase: "await_start", enemyTarget: beginnerEnemyTarget }
      : null
  };
}

export function startGame(state) {
  if (state.status === "ready" || state.status === "paused") {
    return { ...state, status: "running" };
  }

  return state;
}

export function togglePause(state) {
  if (state.status === "running") {
    return { ...state, status: "paused" };
  }

  if (state.status === "paused") {
    return { ...state, status: "running" };
  }

  return state;
}

export function queueDirection(state, direction) {
  if (!DIRECTIONS[direction]) {
    return state;
  }

  if (state.beginnerTutorial?.phase === "await_start") {
    return {
      ...state,
      status: "running",
      player: {
        ...state.player,
        direction: "UP",
        nextDirection: "UP"
      },
      beginnerTutorial: {
        ...state.beginnerTutorial,
        phase: "to_first_food"
      }
    };
  }

  if (isOppositeDirection(state.player.direction, direction) && state.player.snake.length > 1) {
    return state;
  }

  const status = state.status === "ready" ? "running" : state.status;
  return {
    ...state,
    player: {
      ...state.player,
      nextDirection: direction
    },
    status
  };
}

export function advanceTutorialPrompt(state, rng = Math.random) {
  const phase = state.beginnerTutorial?.phase;
  if (!phase) {
    return state;
  }

  if (phase === "after_first_food") {
    const refreshedEnemyTarget = placeBeginnerEnemyTarget(
      state.width,
      state.height,
      [state.player.snake, state.enemy.snake],
      state.walls,
      [state.food.point, state.food.player, state.food.enemy].filter(Boolean),
      rng,
      {
        minXExclusive: 10,
        minYExclusive: 0,
        maxYExclusive: 8,
        excludedCells: [state.beginnerTutorial.avoidPointCell].filter(Boolean)
      }
    );
    return {
      ...state,
      status: "running",
      beginnerTutorial: {
        ...state.beginnerTutorial,
        phase: "to_enemy_food",
        enemyTarget: refreshedEnemyTarget
      }
    };
  }

  if (phase === "after_enemy_food") {
    return {
      ...state,
      status: "running",
      beginnerTutorial: {
        ...state.beginnerTutorial,
        phase: "wait_enemy_point",
        enemyTarget: null,
        avoidPointCell: null
      }
    };
  }

  if (phase === "after_enemy_point") {
    return {
      ...state,
      status: "running",
      beginnerTutorial: {
        ...state.beginnerTutorial,
        phase: "to_practice_points",
        practicePointCount: 0,
        enemyTarget: null
      }
    };
  }

  if (phase === "after_practice_points") {
    return {
      ...state,
      status: "running",
      food: createFoodState(null, null, null),
      beginnerTutorial: {
        ...state.beginnerTutorial,
        phase: "break_barrier"
      }
    };
  }

  if (phase === "after_barrier_removed") {
    return {
      ...state,
      status: "paused",
      food: createTutorialFinalFoodSet(state, rng),
      beginnerTutorial: {
        ...state.beginnerTutorial,
        phase: "final_ready_prompt",
        enemyTarget: null
      }
    };
  }

  if (phase === "final_ready_prompt") {
    return {
      ...state,
      status: "running",
      difficulty: "easy",
      enemyErrorRate: DIFFICULTY_SETTINGS.easy.errorRate,
      enemyEarlyErrorBias: DIFFICULTY_SETTINGS.easy.earlyErrorBias,
      beginnerTutorial: {
        ...state.beginnerTutorial,
        phase: "complete",
        enemyTarget: null,
        avoidPointCell: null
      }
    };
  }

  return state;
}

export function queueEnemyDirection(state, direction) {
  if (!DIRECTIONS[direction]) {
    return state;
  }

  if (isOppositeDirection(state.enemy.direction, direction) && state.enemy.snake.length > 1) {
    return state;
  }

  return {
    ...state,
    enemy: {
      ...state.enemy,
      nextDirection: direction
    }
  };
}

export function restartGame(options = {}) {
  return createGameState(options);
}

function distanceToFood(cell, food) {
  if (!food) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(cell.x - food.x) + Math.abs(cell.y - food.y);
}

function computeCollisionBody(snake, willEat, isMoving = true) {
  if (!isMoving) {
    return snake;
  }

  return willEat ? snake : snake.slice(0, -1);
}

function shiftSnakeInDirection(snake, direction) {
  const delta = DIRECTIONS[direction];
  return snake.map((segment) => ({ x: segment.x + delta.x, y: segment.y + delta.y }));
}

function isSnakePlacementValid(snake, width, height, otherSnake) {
  const seen = new Set();
  for (const segment of snake) {
    if (!isInsideBoard(segment, width, height)) {
      return false;
    }

    const key = `${segment.x},${segment.y}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);

    if (otherSnake && hasCell(otherSnake, segment)) {
      return false;
    }
  }

  return true;
}

function isSnakePlacementValidWithWalls(snake, width, height, otherSnake, walls) {
  if (!isSnakePlacementValid(snake, width, height, otherSnake)) {
    return false;
  }
  return !snake.some((segment) => hasWallCell(walls, segment));
}

function shuffledDirections(rng = Math.random) {
  const directions = Object.keys(DIRECTIONS);
  for (let index = directions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const temp = directions[index];
    directions[index] = directions[swapIndex];
    directions[swapIndex] = temp;
  }
  return directions;
}

function randomShiftCandidates(snake, rng = Math.random) {
  return shuffledDirections(rng).map((direction) => shiftSnakeInDirection(snake, direction));
}

function getTutorialEnemyTarget(state) {
  if (!state.beginnerTutorial) {
    return null;
  }

  if (
    state.beginnerTutorial.phase === "to_first_food"
    || state.beginnerTutorial.phase === "to_enemy_food"
    || state.beginnerTutorial.phase === "to_practice_points"
  ) {
    return state.beginnerTutorial.enemyTarget ?? null;
  }

  return null;
}

function getEnemyDirectionChoices(state, enemySnake, head, currentDirection) {
  const pointFood = getTutorialEnemyTarget(state) ?? state.food.point;
  const avoidCells = [];
  if (state.beginnerTutorial?.phase === "to_enemy_food" && state.beginnerTutorial.avoidPointCell) {
    avoidCells.push(state.beginnerTutorial.avoidPointCell);
  }
  const choices = [];
  for (const direction of Object.keys(DIRECTIONS)) {
    if (enemySnake.length > 1 && isOppositeDirection(currentDirection, direction)) {
      continue;
    }

    const nextHead = nextHeadPosition(head, direction);
    if (!isInsideBoard(nextHead, state.width, state.height)) {
      continue;
    }
    if (hasWallCell(state.walls, nextHead)) {
      continue;
    }
    if (avoidCells.length > 0 && hasCell(avoidCells, nextHead)) {
      continue;
    }

    const enemyWillEat = Boolean(pointFood && sameCell(nextHead, pointFood));
    const enemyBodyForCollision = computeCollisionBody(enemySnake, enemyWillEat, true);
    const playerBodyForCollision = computeCollisionBody(state.player.snake, false, true);
    const hitsEnemyBody = enemyBodyForCollision.some((segment) => sameCell(segment, nextHead));
    const hitsPlayerBody = playerBodyForCollision.some((segment) => sameCell(segment, nextHead));

    if (hitsEnemyBody || hitsPlayerBody) {
      continue;
    }

    const wallBuffer = Math.min(
      nextHead.x,
      state.width - 1 - nextHead.x,
      nextHead.y,
      state.height - 1 - nextHead.y
    );
    const score = pointFood ? distanceToFood(nextHead, pointFood) : -wallBuffer;
    choices.push({ direction, score });
  }

  return choices;
}

function isDirectionSafeNow(state, direction, currentDirection) {
  const choices = getEnemyDirectionChoices(
    state,
    state.enemy.snake,
    state.enemy.snake[0],
    currentDirection
  );
  return choices.some((choice) => choice.direction === direction);
}

function resolveEarlyTurnError(state, idealDirection) {
  const currentDirection = state.enemy.direction;
  if (idealDirection !== currentDirection) {
    return null;
  }

  const currentHead = state.enemy.snake[0];
  const straightHead = nextHeadPosition(currentHead, currentDirection);
  if (!isInsideBoard(straightHead, state.width, state.height)) {
    return null;
  }

  const pointFood = state.food.point;
  const straightWillEat = Boolean(pointFood && sameCell(straightHead, pointFood));
  const simulatedSnake = straightWillEat
    ? [straightHead, ...state.enemy.snake]
    : [straightHead, ...state.enemy.snake.slice(0, -1)];
  const nextChoices = getEnemyDirectionChoices(state, simulatedSnake, straightHead, currentDirection);
  if (nextChoices.length === 0) {
    return null;
  }

  nextChoices.sort((a, b) => a.score - b.score);
  const bestNextDirection = nextChoices[0].direction;
  if (bestNextDirection === currentDirection) {
    return null;
  }

  return isDirectionSafeNow(state, bestNextDirection, currentDirection) ? bestNextDirection : null;
}

function resolveLateTurnError(state, idealDirection) {
  const currentDirection = state.enemy.direction;
  if (idealDirection === currentDirection) {
    return null;
  }

  return isDirectionSafeNow(state, currentDirection, currentDirection) ? currentDirection : null;
}

function chooseEnemyDirection(state, rng = Math.random) {
  if (state.enemy.stunTicks > 0) {
    return state.enemy.direction;
  }

  const currentDirection = state.enemy.direction;
  const head = state.enemy.snake[0];
  const choices = getEnemyDirectionChoices(state, state.enemy.snake, head, currentDirection);
  if (choices.length === 0) {
    return currentDirection;
  }

  const pointFood = getTutorialEnemyTarget(state) ?? state.food.point;
  if (!pointFood && isDirectionSafeNow(state, currentDirection, currentDirection)) {
    return currentDirection;
  }

  choices.sort((a, b) => a.score - b.score);
  const idealDirection = choices[0].direction;
  if (!state.enemyErrorEnabled || state.enemyErrorRate <= 0 || rng() >= state.enemyErrorRate) {
    return idealDirection;
  }

  const attemptEarly = rng() < state.enemyEarlyErrorBias;
  if (attemptEarly) {
    const earlyDirection = resolveEarlyTurnError(state, idealDirection);
    return earlyDirection ?? idealDirection;
  }

  const lateDirection = resolveLateTurnError(state, idealDirection);
  return lateDirection ?? idealDirection;
}

function resolveWinner(state) {
  if (state.player.droppedBelowLength && state.enemy.droppedBelowLength) {
    return "draw";
  }

  if (state.player.droppedBelowLength) {
    return "enemy_won";
  }

  if (state.enemy.droppedBelowLength) {
    return "player_won";
  }

  const disableDamageStreakLoss = state.beginnerTutorial && state.beginnerTutorial.phase !== "complete";
  if (!disableDamageStreakLoss) {
    if (state.player.damageStreak >= 3 && state.enemy.damageStreak >= 3) {
      return "draw";
    }

    if (state.player.damageStreak >= 3) {
      return "enemy_won";
    }

    if (state.enemy.damageStreak >= 3) {
      return "player_won";
    }
  }

  if (state.player.score >= WIN_SCORE && state.enemy.score >= WIN_SCORE) {
    return "draw";
  }

  if (state.player.score >= WIN_SCORE) {
    return "player_won";
  }

  if (state.enemy.score >= WIN_SCORE) {
    return "enemy_won";
  }

  return "running";
}

function spawnFoodSet(state, rng, preferredSide) {
  const snakes = [state.player.snake, state.enemy.snake];
  const point = placeFood(state.width, state.height, snakes, rng, {
    walls: state.walls,
    side: preferredSide,
    excludeCenterColumns: true
  });
  const player = placeFood(state.width, state.height, snakes, rng, {
    walls: state.walls,
    blockedCells: point ? [point] : []
  });
  const enemy = placeFood(state.width, state.height, snakes, rng, {
    walls: state.walls,
    blockedCells: [point, player].filter(Boolean)
  });

  return createFoodState(point, player, enemy);
}

function spawnBeginnerPracticeFoodSet(state, rng, pointSide) {
  const snakes = [state.player.snake, state.enemy.snake];
  const normalizedPointSide = pointSide === "left" ? "left" : "right";
  const point = placeFood(state.width, state.height, snakes, rng, {
    walls: state.walls,
    side: normalizedPointSide
  });

  if (normalizedPointSide === "right") {
    const playerFood = placeFood(state.width, state.height, snakes, rng, {
      walls: state.walls,
      side: "left",
      blockedCells: [point].filter(Boolean)
    });
    const enemyFood = placeFood(state.width, state.height, snakes, rng, {
      walls: state.walls,
      side: "left",
      blockedCells: [point, playerFood].filter(Boolean)
    });

    return {
      food: createFoodState(point, playerFood, enemyFood),
      enemyTarget: null
    };
  }

  const enemyTarget = placeBeginnerEnemyTarget(
    state.width,
    state.height,
    snakes,
    state.walls,
    [point].filter(Boolean),
    rng,
    { minXExclusive: 10, minYExclusive: 10 }
  );

  return {
    food: createFoodState(point, null, null),
    enemyTarget
  };
}

function createTutorialFinalFoodSet(state, rng) {
  const snakes = [state.player.snake, state.enemy.snake];
  const point = placeFood(state.width, state.height, snakes, rng, {
    walls: state.walls,
    side: "left"
  });
  const player = placeFood(state.width, state.height, snakes, rng, {
    walls: state.walls,
    blockedCells: [point].filter(Boolean)
  });
  const enemy = placeFood(state.width, state.height, snakes, rng, {
    walls: state.walls,
    blockedCells: [point, player].filter(Boolean)
  });

  return createFoodState(point, player, enemy);
}

export function advanceGame(state, rng = Math.random) {
  if (state.status !== "running") {
    return state;
  }

  const beginnerIntroActive = state.beginnerTutorial?.phase === "to_first_food";
  const beginnerEnemyFoodObjectiveActive = state.beginnerTutorial?.phase === "to_enemy_food";
  const tutorialSafetyActive = Boolean(state.beginnerTutorial && state.beginnerTutorial.phase !== "complete");
  const playerDirection = isOppositeDirection(state.player.direction, state.player.nextDirection)
    ? state.player.direction
    : state.player.nextDirection;
  const enemyHead = state.enemy.snake[0];
  const enemyPlannedDirection = state.enemyControl === "human"
    ? state.enemy.nextDirection
    : chooseEnemyDirection(state, rng);
  let enemyDirection = isOppositeDirection(state.enemy.direction, enemyPlannedDirection)
    ? state.enemy.direction
    : enemyPlannedDirection;
  if (state.enemyControl !== "human") {
    const safeEnemyChoices = getEnemyDirectionChoices(
      state,
      state.enemy.snake,
      enemyHead,
      state.enemy.direction
    );
    if (
      safeEnemyChoices.length > 0
      && !safeEnemyChoices.some((choice) => choice.direction === enemyDirection)
    ) {
      enemyDirection = safeEnemyChoices.sort((a, b) => a.score - b.score)[0].direction;
    }
  }

  const playerHead = state.player.snake[0];
  const pointFood = state.food.point;
  const playerFood = state.food.player;
  const enemyFood = state.food.enemy;
  const playerCanMove = state.player.stunTicks === 0;
  const enemyCanMove = state.enemy.stunTicks === 0;
  const nextPlayerHead = playerCanMove ? nextHeadPosition(playerHead, playerDirection) : playerHead;
  const nextEnemyHead = enemyCanMove ? nextHeadPosition(enemyHead, enemyDirection) : enemyHead;
  const playerWillEatPoint = Boolean(playerCanMove && pointFood && sameCell(nextPlayerHead, pointFood));
  const enemyWillEatPoint = Boolean(enemyCanMove && pointFood && sameCell(nextEnemyHead, pointFood));
  const playerWillEatPlayerFood = Boolean(
    playerCanMove && playerFood && sameCell(nextPlayerHead, playerFood)
  );
  const playerWillEatEnemyFood = Boolean(
    playerCanMove && enemyFood && sameCell(nextPlayerHead, enemyFood)
  );
  const enemyWillEatEnemyFood = Boolean(
    enemyCanMove && enemyFood && sameCell(nextEnemyHead, enemyFood)
  );
  const enemyWillEatPlayerFood = Boolean(
    enemyCanMove && playerFood && sameCell(nextEnemyHead, playerFood)
  );
  const enemyTargetFood = getTutorialEnemyTarget(state);
  const enemyWillEatBeginnerTarget = Boolean(
    (beginnerIntroActive || beginnerEnemyFoodObjectiveActive)
    && enemyCanMove
    && enemyTargetFood
    && sameCell(nextEnemyHead, enemyTargetFood)
  );

  const playerBodyForCollision = computeCollisionBody(
    state.player.snake,
    playerWillEatPoint,
    playerCanMove
  );
  const enemyBodyForCollision = computeCollisionBody(state.enemy.snake, enemyWillEatPoint, enemyCanMove);

  const playerHitBoundary = playerCanMove && !isInsideBoard(nextPlayerHead, state.width, state.height);
  const enemyHitBoundary = enemyCanMove && !isInsideBoard(nextEnemyHead, state.width, state.height);
  const playerHitWall = playerCanMove && hasWallCell(state.walls, nextPlayerHead);
  const enemyHitWall = enemyCanMove && hasWallCell(state.walls, nextEnemyHead);
  const playerSelfHit = playerCanMove
    && playerBodyForCollision.some((segment) => sameCell(segment, nextPlayerHead));
  const enemySelfHit = enemyCanMove
    && enemyBodyForCollision.some((segment) => sameCell(segment, nextEnemyHead));
  const playerHitEnemyBody = playerCanMove
    && enemyBodyForCollision.some((segment) => sameCell(segment, nextPlayerHead));
  const enemyHitPlayerBody = enemyCanMove
    && playerBodyForCollision.some((segment) => sameCell(segment, nextEnemyHead));
  const headOnHeadHit = playerCanMove && enemyCanMove && sameCell(nextPlayerHead, nextEnemyHead);

  const playerTookDamage = playerHitBoundary || playerHitWall || playerSelfHit || playerHitEnemyBody || headOnHeadHit;
  const enemyTookDamage = enemyHitBoundary || enemyHitWall || enemySelfHit || enemyHitPlayerBody || headOnHeadHit;

  const playerSnake = playerTookDamage
    ? (tutorialSafetyActive
      ? state.player.snake
      : (state.player.snake.length > 1 ? state.player.snake.slice(0, -1) : []))
    : playerCanMove
      ? [
          nextPlayerHead,
          ...(playerWillEatPoint ? state.player.snake : state.player.snake.slice(0, -1))
        ]
      : state.player.snake;
  const enemySnake = enemyTookDamage
    ? (tutorialSafetyActive
      ? state.enemy.snake
      : (state.enemy.snake.length > 1 ? state.enemy.snake.slice(0, -1) : []))
    : enemyCanMove
      ? [nextEnemyHead, ...(enemyWillEatPoint ? state.enemy.snake : state.enemy.snake.slice(0, -1))]
      : state.enemy.snake;

  const playerSnakeCollision = playerTookDamage && (playerHitEnemyBody || headOnHeadHit);
  const enemySnakeCollision = enemyTookDamage && (enemyHitPlayerBody || headOnHeadHit);
  let resolvedPlayerSnake = playerSnake;
  let resolvedEnemySnake = enemySnake;
  const playerCandidates = playerSnakeCollision
    ? [...randomShiftCandidates(playerSnake, rng), playerSnake]
    : [playerSnake];
  const enemyCandidates = enemySnakeCollision
    ? [...randomShiftCandidates(enemySnake, rng), enemySnake]
    : [enemySnake];
  let separated = false;

  for (const playerCandidate of playerCandidates) {
    for (const enemyCandidate of enemyCandidates) {
      const playerValid = isSnakePlacementValidWithWalls(
        playerCandidate,
        state.width,
        state.height,
        enemyCandidate,
        state.walls
      );
      const enemyValid = isSnakePlacementValidWithWalls(
        enemyCandidate,
        state.width,
        state.height,
        playerCandidate,
        state.walls
      );

      if (playerValid && enemyValid) {
        resolvedPlayerSnake = playerCandidate;
        resolvedEnemySnake = enemyCandidate;
        separated = true;
        break;
      }
    }

    if (separated) {
      break;
    }
  }

  let playerDelta = playerTookDamage && !beginnerIntroActive ? -1 : 0;
  let enemyDelta = enemyTookDamage && !beginnerIntroActive ? -1 : 0;
  if (tutorialSafetyActive) {
    playerDelta = 0;
    enemyDelta = 0;
  }

  if (!playerTookDamage && playerWillEatPoint) {
    playerDelta += 1;
  }
  if (!enemyTookDamage && enemyWillEatPoint) {
    enemyDelta += 1;
  }
  if (!playerTookDamage && playerWillEatPlayerFood && state.player.score < playerSnake.length) {
    playerDelta += 1;
  }
  if (!enemyTookDamage && enemyWillEatEnemyFood && state.enemy.score < enemySnake.length) {
    enemyDelta += 1;
  }
  const crossSteal = playerWillEatEnemyFood && enemyWillEatPlayerFood;
  if (!playerTookDamage && playerWillEatEnemyFood && !crossSteal) {
    enemyDelta -= 1;
  }
  if (!enemyTookDamage && enemyWillEatPlayerFood && !crossSteal) {
    playerDelta -= 1;
  }

  const playerScore = Math.max(0, state.player.score + playerDelta);
  const enemyScore = Math.max(0, state.enemy.score + enemyDelta);
  const playerStunTicks = playerTookDamage
    ? DAMAGE_STUN_TICKS
    : Math.max(0, state.player.stunTicks - 1);
  const enemyStunTicks = enemyTookDamage
    ? DAMAGE_STUN_TICKS
    : Math.max(0, state.enemy.stunTicks - 1);
  const playerDroppedBelowLength = !tutorialSafetyActive && playerTookDamage && state.player.snake.length <= 1;
  const enemyDroppedBelowLength = !tutorialSafetyActive && enemyTookDamage && state.enemy.snake.length <= 1;
  const playerDamageStreak = playerTookDamage
    ? (tutorialSafetyActive ? state.player.damageStreak : state.player.damageStreak + 1)
    : playerCanMove
      ? 0
      : state.player.damageStreak;
  const enemyDamageStreak = enemyTookDamage
    ? (tutorialSafetyActive ? state.enemy.damageStreak : state.enemy.damageStreak + 1)
    : enemyCanMove
      ? 0
      : state.enemy.damageStreak;

  const nextState = {
    ...state,
    walls: state.walls,
    beginnerTutorial: state.beginnerTutorial,
    tickCount: state.tickCount + 1,
    player: {
      snake: resolvedPlayerSnake,
      direction: playerDirection,
      nextDirection: playerDirection,
      score: playerScore,
      stunTicks: playerStunTicks,
      droppedBelowLength: playerDroppedBelowLength,
      damageStreak: playerDamageStreak
    },
    enemy: {
      snake: resolvedEnemySnake,
      direction: enemyDirection,
      nextDirection: enemyDirection,
      score: enemyScore,
      stunTicks: enemyStunTicks,
      droppedBelowLength: enemyDroppedBelowLength,
      damageStreak: enemyDamageStreak
    }
  };

  const status = resolveWinner(nextState);
  const pointCollected = (!playerTookDamage && playerWillEatPoint) || (!enemyTookDamage && enemyWillEatPoint);
  let preferredSide;
  if (playerWillEatPoint && !enemyWillEatPoint) {
    preferredSide = "right";
  } else if (enemyWillEatPoint && !playerWillEatPoint) {
    preferredSide = "left";
  }
  const nextPlayerFood = playerWillEatPlayerFood || enemyWillEatPlayerFood ? null : playerFood;
  const nextEnemyFood = enemyWillEatEnemyFood || playerWillEatEnemyFood ? null : enemyFood;
  const currentSpawnTimer = pointCollected
    ? FOOD_SPAWN_DELAY_TICKS
    : Math.max(0, state.foodSpawnTimer - 1);
  const currentRespawnSide = pointCollected ? preferredSide : state.foodRespawnSide;
  const shouldRespawnFoodSet = !pointCollected
    && !pointFood
    && currentSpawnTimer === 0
    && currentRespawnSide !== null;
  let nextFood = shouldRespawnFoodSet
    ? spawnFoodSet(nextState, rng, currentRespawnSide)
    : createFoodState(pointCollected ? null : pointFood, nextPlayerFood, nextEnemyFood);
  let practiceSpawnEnemyTarget = null;
  if (state.beginnerTutorial?.phase === "to_practice_points" && shouldRespawnFoodSet) {
    const practiceSpawn = spawnBeginnerPracticeFoodSet(nextState, rng, currentRespawnSide);
    nextFood = practiceSpawn.food;
    practiceSpawnEnemyTarget = practiceSpawn.enemyTarget;
  }
  const finalSpawnTimer = shouldRespawnFoodSet ? 0 : currentSpawnTimer;
  const finalRespawnSide = shouldRespawnFoodSet ? null : currentRespawnSide;
  const wallBreakActive = state.beginnerTutorial?.phase === "break_barrier"
    || state.beginnerTutorial?.phase === "wall_break_stun";
  const finalStatus = !wallBreakActive
    && !nextFood.point
    && finalSpawnTimer === 0
    && finalRespawnSide === null
    && status === "running"
    ? "draw"
    : status;
  const completedBeginnerIntro = state.beginnerTutorial?.phase === "to_first_food"
    && !playerTookDamage
    && playerWillEatPoint;
  const completedBeginnerEnemyFoodObjective = state.beginnerTutorial?.phase === "to_enemy_food"
    && !playerTookDamage
    && playerWillEatEnemyFood;
  const completedEnemyPointWatchObjective = state.beginnerTutorial?.phase === "wait_enemy_point"
    && !enemyTookDamage
    && enemyWillEatPoint;
  const completedSecondPointObjective = state.beginnerTutorial?.phase === "to_practice_points"
    && !playerTookDamage
    && playerWillEatPoint;
  const centerX = Math.floor((state.width - 1) / 2);
  const containmentWallX = centerX - 1;
  const triggeredBarrierCrash = state.beginnerTutorial?.phase === "break_barrier"
    && playerHitWall
    && nextPlayerHead.x === containmentWallX;
  const barrierStunResolved = state.beginnerTutorial?.phase === "wall_break_stun"
    && nextState.player.stunTicks === 0;
  let nextBeginnerTutorial = state.beginnerTutorial;
  let tutorialFoodOverride = null;
  let forcedEnemyScore = null;
  let pauseForPracticeCheckpoint = false;
  if (state.beginnerTutorial) {
    if (completedBeginnerIntro) {
      const fixedPointFood = beginnerToBoardCell(state.width, state.height, 14, 4);
      const fixedEnemyFood = beginnerToBoardCell(state.width, state.height, 4, 4);
      const nextEnemyTarget = placeBeginnerEnemyTarget(
        state.width,
        state.height,
        [resolvedPlayerSnake, resolvedEnemySnake],
        state.walls,
        [fixedPointFood, fixedEnemyFood].filter(Boolean),
        rng,
        {
          minXExclusive: 10,
          minYExclusive: 0,
          maxYExclusive: 8,
          excludedCells: [fixedPointFood]
        }
      );
      tutorialFoodOverride = createFoodState(fixedPointFood, null, fixedEnemyFood);
      nextBeginnerTutorial = {
        ...state.beginnerTutorial,
        phase: "after_first_food",
        enemyTarget: nextEnemyTarget,
        avoidPointCell: fixedPointFood
      };
    } else if (completedBeginnerEnemyFoodObjective) {
      nextBeginnerTutorial = {
        ...state.beginnerTutorial,
        phase: "after_enemy_food"
      };
    } else if (completedEnemyPointWatchObjective) {
      const offensivePoint = placeTutorialCell(
        state.width,
        state.height,
        [resolvedPlayerSnake, resolvedEnemySnake],
        state.walls,
        [],
        rng,
        ({ xFromLeft, yFromBottom }) => xFromLeft > 10 && yFromBottom > 10
      );
      const playerColorFood = placeTutorialCell(
        state.width,
        state.height,
        [resolvedPlayerSnake, resolvedEnemySnake],
        state.walls,
        [offensivePoint].filter(Boolean),
        rng,
        ({ xFromLeft }) => xFromLeft < 8
      );
      const enemyColorFood = placeTutorialCell(
        state.width,
        state.height,
        [resolvedPlayerSnake, resolvedEnemySnake],
        state.walls,
        [offensivePoint, playerColorFood].filter(Boolean),
        rng,
        ({ xFromLeft }) => xFromLeft < 8
      );
      tutorialFoodOverride = createFoodState(offensivePoint, playerColorFood, enemyColorFood);
      nextBeginnerTutorial = {
        ...state.beginnerTutorial,
        phase: "after_enemy_point",
        enemyTarget: null,
        practicePointCount: 0
      };
      forcedEnemyScore = 0;
    } else if (completedSecondPointObjective) {
      const nextPracticePointCount = (state.beginnerTutorial.practicePointCount ?? 0) + 1;
      if (nextPracticePointCount >= 4) {
        pauseForPracticeCheckpoint = true;
        nextBeginnerTutorial = {
          ...state.beginnerTutorial,
          phase: "after_practice_points",
          practicePointCount: nextPracticePointCount
        };
      } else {
        nextBeginnerTutorial = {
          ...state.beginnerTutorial,
          phase: "to_practice_points",
          practicePointCount: nextPracticePointCount
        };
      }
    } else if (triggeredBarrierCrash) {
      nextBeginnerTutorial = {
        ...state.beginnerTutorial,
        phase: "wall_break_stun"
      };
    } else if (barrierStunResolved) {
      nextBeginnerTutorial = {
        ...state.beginnerTutorial,
        phase: "after_barrier_removed",
        enemyTarget: null,
        avoidPointCell: null
      };
      nextState.walls = [];
    } else if (enemyWillEatBeginnerTarget) {
      nextBeginnerTutorial = {
        ...state.beginnerTutorial,
        enemyTarget: placeBeginnerEnemyTarget(
          state.width,
          state.height,
          [resolvedPlayerSnake, resolvedEnemySnake],
          state.walls,
          [nextFood.point, nextFood.player, nextFood.enemy].filter(Boolean),
          rng,
          state.beginnerTutorial.phase === "to_enemy_food"
            ? {
              minXExclusive: 10,
              minYExclusive: 0,
              maxYExclusive: 8,
              excludedCells: [state.beginnerTutorial.avoidPointCell].filter(Boolean)
            }
            : state.beginnerTutorial.phase === "to_practice_points"
              ? {
                minXExclusive: 10,
                minYExclusive: 10
              }
              : undefined
        )
      };
    } else if (state.beginnerTutorial.phase === "to_practice_points" && shouldRespawnFoodSet) {
      nextBeginnerTutorial = {
        ...state.beginnerTutorial,
        enemyTarget: practiceSpawnEnemyTarget
      };
    }
  }
  const tutorialStatus = (
    completedBeginnerIntro
    || completedBeginnerEnemyFoodObjective
    || completedEnemyPointWatchObjective
    || pauseForPracticeCheckpoint
    || barrierStunResolved
  ) && finalStatus === "running"
    ? "paused"
    : finalStatus;

  return {
    ...state,
    ...nextState,
    enemy: {
      ...nextState.enemy,
      score: forcedEnemyScore ?? nextState.enemy.score
    },
    food: wallBreakActive ? createFoodState(null, null, null) : (tutorialFoodOverride ?? nextFood),
    foodSpawnTimer: finalSpawnTimer,
    foodRespawnSide: finalRespawnSide,
    beginnerTutorial: nextBeginnerTutorial,
    status: tutorialStatus
  };
}
