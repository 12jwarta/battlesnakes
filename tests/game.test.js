import assert from "node:assert/strict";

import {
  advanceTutorialPrompt,
  advanceGame,
  createGameState,
  DAMAGE_STUN_TICKS,
  DEFAULT_DIFFICULTY,
  DIFFICULTY_SETTINGS,
  placeFood,
  queueEnemyDirection,
  queueDirection,
  startGame,
  WIN_SCORE
} from "../src/game.js";

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("snake moves one cell in the current direction", () => {
  let state = createGameState({ difficulty: "hard", rng: () => 0 });
  state = startGame(state);
  state = advanceGame(state, () => 0);

  assert.deepEqual(state.player.snake[0], { x: 3, y: 8 });
  assert.equal(state.player.score, 0);
  assert.equal(state.player.snake.length, 1);
});

test("default difficulty is beginner with more forgiving enemy behavior than easy", () => {
  const state = createGameState({ rng: () => 0 });

  assert.equal(state.difficulty, DEFAULT_DIFFICULTY);
  assert.equal(DEFAULT_DIFFICULTY, "beginner");
  assert.equal(DIFFICULTY_SETTINGS.hard.errorRate, 0);
  assert.equal(DIFFICULTY_SETTINGS.medium.errorRate, 0.07);
  assert.equal(DIFFICULTY_SETTINGS.beginner.errorRate, 0.18);
  assert.equal(DIFFICULTY_SETTINGS.easy.errorRate, 0.14);
  assert.ok(DIFFICULTY_SETTINGS.beginner.errorRate > DIFFICULTY_SETTINGS.easy.errorRate);
  assert.equal(DIFFICULTY_SETTINGS.easy.earlyErrorBias, 0.8);
});

test("starting food is directly left or right of center", () => {
  const state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });
  const centerX = 8;
  const centerY = 8;

  assert.ok(state.food.point.x === centerX - 1 || state.food.point.x === centerX + 1);
  assert.equal(state.food.point.y, centerY);
  assert.equal(state.food.player, null);
  assert.equal(state.food.enemy, null);
});

test("beginner mode initializes with two vertical wall columns between zones", () => {
  const state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  const centerX = 8;

  assert.ok(Array.isArray(state.walls));
  assert.equal(state.walls.length, 34);
  assert.ok(state.walls.every((cell) => cell.x === centerX - 1 || cell.x === centerX + 1));
  assert.ok(state.food.point);
  assert.ok(!state.walls.some((wallCell) => wallCell.x === state.food.point.x && wallCell.y === state.food.point.y));
});

test("beginner mode starts paused with scripted coordinates and first point", () => {
  const state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });

  assert.equal(state.status, "paused");
  assert.equal(state.player.snake.length, 3);
  assert.equal(state.enemy.snake.length, 3);
  assert.deepEqual(state.player.snake[0], { x: 3, y: 13 });
  assert.deepEqual(state.enemy.snake[0], { x: 13, y: 13 });
  assert.deepEqual(state.food.point, { x: 3, y: 3 });
  assert.equal(state.beginnerTutorial.phase, "await_start");
  assert.ok(state.beginnerTutorial.enemyTarget);
  const enemyTargetXFromLeft = state.beginnerTutorial.enemyTarget.x + 1;
  const enemyTargetYFromBottom = state.height - state.beginnerTutorial.enemyTarget.y;
  assert.ok(enemyTargetXFromLeft > 10);
  assert.ok(enemyTargetYFromBottom > 10);
});

test("beginner first direction starts upward regardless of input", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = queueDirection(state, "LEFT");
  state = advanceGame(state, () => 0.5);

  assert.equal(state.status, "running");
  assert.equal(state.beginnerTutorial.phase, "to_first_food");
  assert.deepEqual(state.player.snake[0], { x: 3, y: 12 });
  assert.notDeepEqual(state.enemy.snake[0], { x: 13, y: 13 });
});

test("beginner enemy target respawns in far enemy zone when collected before player point", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: {
      phase: "to_first_food",
      enemyTarget: { x: 13, y: 12 }
    },
    player: {
      ...state.player,
      snake: [{ x: 3, y: 13 }, { x: 3, y: 13 }, { x: 3, y: 13 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 99
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 13 }, { x: 13, y: 13 }, { x: 13, y: 13 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 0
    },
    food: { point: { x: 3, y: 3 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0);

  assert.ok(state.beginnerTutorial.enemyTarget);
  assert.notDeepEqual(state.beginnerTutorial.enemyTarget, { x: 13, y: 12 });
  const enemyTargetXFromLeft = state.beginnerTutorial.enemyTarget.x + 1;
  const enemyTargetYFromBottom = state.height - state.beginnerTutorial.enemyTarget.y;
  assert.ok(enemyTargetXFromLeft > 10);
  assert.ok(enemyTargetYFromBottom > 10);
  assert.equal(state.player.score, 0);
  assert.equal(state.enemy.score, 0);
});

test("beginner player resets at current step after three consecutive damage ticks", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: { phase: "to_first_food" },
    player: {
      ...state.player,
      score: 2,
      snake: [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 0,
      damageStreak: 2
    },
    enemy: {
      ...state.enemy,
      score: 2,
      snake: [{ x: 13, y: 13 }, { x: 13, y: 13 }, { x: 13, y: 13 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0,
      damageStreak: 0
    },
    food: { point: { x: 3, y: 3 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.player.score, 2);
  assert.equal(state.player.snake.length, 3);
  assert.equal(state.player.damageStreak, 0);
  assert.equal(state.status, "paused");
  assert.equal(state.beginnerTutorial.phase, "to_first_food");
  assert.ok(state.beginnerTutorial.playerResetNotice);
});

test("beginner enemy can take damage down to one segment without losing tutorial", () => {
  let state = createGameState({
    difficulty: "beginner",
    width: 17,
    height: 17,
    enemyControl: "human",
    rng: () => 0
  });
  state = {
    ...state,
    status: "running",
    enemyControl: "human",
    beginnerTutorial: { phase: "to_practice_points" },
    player: {
      ...state.player,
      snake: [{ x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 99
    },
    enemy: {
      ...state.enemy,
      score: 3,
      snake: [{ x: 16, y: 8 }, { x: 15, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0,
      damageStreak: 0
    },
    food: { point: { x: 3, y: 3 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);
  assert.equal(state.enemy.snake.length, 1);
  assert.equal(state.status, "running");

  state = advanceGame(state, () => 0.5);
  assert.equal(state.enemy.snake.length, 1);
  assert.equal(state.status, "running");
});

test("beginner pauses and advances tutorial after first point is collected", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: { phase: "to_first_food" },
    player: {
      ...state.player,
      score: 0,
      snake: [{ x: 3, y: 4 }, { x: 3, y: 5 }, { x: 3, y: 6 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 0,
      damageStreak: 0
    },
    enemy: {
      ...state.enemy,
      score: 0,
      snake: [{ x: 13, y: 13 }, { x: 13, y: 13 }, { x: 13, y: 13 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0,
      damageStreak: 0
    },
    food: { point: { x: 3, y: 3 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.player.score, 1);
  assert.equal(state.beginnerTutorial.phase, "after_first_food");
  assert.equal(state.status, "paused");
  assert.deepEqual(state.food.point, { x: 13, y: 13 });
  assert.deepEqual(state.food.enemy, { x: 3, y: 13 });
  assert.equal(state.food.player, null);
  assert.ok(state.beginnerTutorial.enemyTarget);
  assert.notDeepEqual(state.beginnerTutorial.enemyTarget, { x: 13, y: 13 });
  const targetXFromLeft = state.beginnerTutorial.enemyTarget.x + 1;
  const targetYFromBottom = state.height - state.beginnerTutorial.enemyTarget.y;
  assert.ok(targetXFromLeft > 10);
  assert.ok(targetYFromBottom < 8);
});

test("beginner resumes from post-point pause on any direction input", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "paused",
    beginnerTutorial: {
      phase: "after_first_food",
      enemyTarget: { x: 15, y: 15 },
      avoidPointCell: { x: 13, y: 13 }
    },
    food: { point: { x: 13, y: 13 }, player: null, enemy: { x: 3, y: 13 } }
  };

  state = queueDirection(state, "LEFT");
  assert.equal(state.status, "paused");
  assert.equal(state.beginnerTutorial.phase, "after_first_food");

  state = advanceTutorialPrompt(state, () => 0);
  assert.equal(state.status, "running");
  assert.equal(state.beginnerTutorial.phase, "to_enemy_food");
  assert.ok(state.beginnerTutorial.enemyTarget);
});

test("beginner enemy prefers invisible target and avoids scripted true-point cell", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: {
      phase: "to_enemy_food",
      enemyTarget: { x: 12, y: 12 },
      avoidPointCell: { x: 13, y: 13 }
    },
    player: {
      ...state.player,
      snake: [{ x: 3, y: 13 }, { x: 3, y: 13 }, { x: 3, y: 13 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 99
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 12 }, { x: 14, y: 12 }, { x: 15, y: 12 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 0
    },
    food: { point: { x: 13, y: 13 }, player: null, enemy: { x: 3, y: 13 } }
  };

  state = advanceGame(state, () => 0.5);

  assert.notDeepEqual(state.enemy.snake[0], { x: 13, y: 13 });
});

test("beginner pauses again when player collects enemy-color block objective", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: {
      phase: "to_enemy_food",
      enemyTarget: { x: 12, y: 12 },
      avoidPointCell: { x: 13, y: 13 }
    },
    player: {
      ...state.player,
      score: 2,
      snake: [{ x: 2, y: 13 }, { x: 1, y: 13 }, { x: 0, y: 13 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      score: 2,
      snake: [{ x: 13, y: 12 }, { x: 14, y: 12 }, { x: 15, y: 12 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 0
    },
    food: { point: { x: 13, y: 13 }, player: null, enemy: { x: 3, y: 13 } }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.status, "paused");
  assert.equal(state.beginnerTutorial.phase, "after_enemy_food");
});

test("beginner resumes from enemy-food pause and clears invisible targets", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "paused",
    beginnerTutorial: {
      phase: "after_enemy_food",
      enemyTarget: { x: 12, y: 12 },
      avoidPointCell: { x: 13, y: 13 }
    },
    food: { point: { x: 13, y: 13 }, player: null, enemy: null }
  };

  state = advanceTutorialPrompt(state, () => 0);

  assert.equal(state.status, "running");
  assert.equal(state.beginnerTutorial.phase, "wait_enemy_point");
  assert.equal(state.beginnerTutorial.enemyTarget, null);
  assert.equal(state.beginnerTutorial.avoidPointCell, null);
});

test("beginner pauses when enemy collects scripted point block after wait phase", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: {
      phase: "wait_enemy_point",
      enemyTarget: null,
      avoidPointCell: null
    },
    player: {
      ...state.player,
      snake: [{ x: 3, y: 13 }, { x: 3, y: 13 }, { x: 3, y: 13 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 99
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 12 }, { x: 14, y: 12 }, { x: 15, y: 12 }],
      direction: "DOWN",
      nextDirection: "DOWN",
      stunTicks: 0,
      score: 0
    },
    food: { point: { x: 13, y: 13 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.status, "paused");
  assert.equal(state.beginnerTutorial.phase, "after_enemy_point");
  assert.equal(state.enemy.score, 0);
  assert.ok(state.food.point);
  assert.ok(state.food.player);
  assert.ok(state.food.enemy);
  const pointXFromLeft = state.food.point.x + 1;
  const pointYFromBottom = state.height - state.food.point.y;
  assert.ok(pointXFromLeft > 10);
  assert.ok(pointYFromBottom > 10);
  const playerFoodXFromLeft = state.food.player.x + 1;
  const enemyFoodXFromLeft = state.food.enemy.x + 1;
  assert.ok(playerFoodXFromLeft < 8);
  assert.ok(enemyFoodXFromLeft < 8);
  assert.equal(state.beginnerTutorial.enemyTarget, null);
});

test("beginner resumes from enemy-point pause on any direction and enters practice phase", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "paused",
    beginnerTutorial: {
      phase: "after_enemy_point",
      enemyTarget: { x: 12, y: 5 }
    },
    food: { point: { x: 4, y: 4 }, player: { x: 12, y: 4 }, enemy: null }
  };

  state = advanceTutorialPrompt(state, () => 0);

  assert.equal(state.status, "running");
  assert.equal(state.beginnerTutorial.phase, "to_practice_points");
  assert.equal(state.beginnerTutorial.practicePointCount, 0);
});

test("practice spawn on player side creates enemy invisible target on enemy side", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: {
      phase: "to_practice_points",
      practicePointCount: 1,
      enemyTarget: null
    },
    player: {
      ...state.player,
      snake: [{ x: 3, y: 13 }, { x: 2, y: 13 }, { x: 1, y: 13 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 99
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 13 }, { x: 14, y: 13 }, { x: 15, y: 13 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 99
    },
    food: { point: null, player: null, enemy: null },
    foodSpawnTimer: 0,
    foodRespawnSide: "left"
  };

  state = advanceGame(state, () => 0.5);

  assert.ok(state.food.point);
  const pointXFromLeft = state.food.point.x + 1;
  assert.ok(pointXFromLeft < 9);
  assert.equal(state.food.player, null);
  assert.equal(state.food.enemy, null);
  assert.ok(state.beginnerTutorial.enemyTarget);
  const targetXFromLeft = state.beginnerTutorial.enemyTarget.x + 1;
  assert.ok(targetXFromLeft > 10);
});

test("practice spawn on enemy side places both snake foods on player side", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: {
      phase: "to_practice_points",
      practicePointCount: 1,
      enemyTarget: { x: 12, y: 12 }
    },
    player: {
      ...state.player,
      snake: [{ x: 3, y: 13 }, { x: 2, y: 13 }, { x: 1, y: 13 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 99
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 13 }, { x: 14, y: 13 }, { x: 15, y: 13 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 99
    },
    food: { point: null, player: null, enemy: null },
    foodSpawnTimer: 0,
    foodRespawnSide: "right"
  };

  state = advanceGame(state, () => 0.5);

  assert.ok(state.food.point);
  assert.ok(state.food.player);
  assert.ok(state.food.enemy);
  const pointXFromLeft = state.food.point.x + 1;
  const playerFoodXFromLeft = state.food.player.x + 1;
  const enemyFoodXFromLeft = state.food.enemy.x + 1;
  assert.ok(pointXFromLeft > 9);
  assert.ok(playerFoodXFromLeft < 9);
  assert.ok(enemyFoodXFromLeft < 9);
  assert.equal(state.beginnerTutorial.enemyTarget, null);
});

test("beginner pauses after fourth practice point is collected", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: {
      phase: "to_practice_points",
      practicePointCount: 3,
      enemyTarget: { x: 12, y: 12 }
    },
    player: {
      ...state.player,
      score: 2,
      snake: [{ x: 3, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 4 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      score: 0,
      snake: [{ x: 13, y: 12 }, { x: 14, y: 12 }, { x: 15, y: 12 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0
    },
    food: { point: { x: 3, y: 3 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.status, "paused");
  assert.equal(state.beginnerTutorial.phase, "after_practice_points");
  assert.equal(state.beginnerTutorial.practicePointCount, 4);
});

test("beginner barrier step starts running on direction from post-practice pause", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "paused",
    beginnerTutorial: {
      phase: "after_practice_points",
      practicePointCount: 4
    }
  };

  state = advanceTutorialPrompt(state, () => 0);

  assert.equal(state.status, "running");
  assert.equal(state.beginnerTutorial.phase, "break_barrier");
});

test("beginner barrier crash triggers stun flow without losing score or body", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: {
      phase: "break_barrier",
      practicePointCount: 4
    },
    player: {
      ...state.player,
      score: 3,
      snake: [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 13 }, { x: 14, y: 13 }, { x: 15, y: 13 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 99
    },
    food: { point: { x: 3, y: 3 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.beginnerTutorial.phase, "wall_break_stun");
  assert.equal(state.player.score, 3);
  assert.equal(state.player.snake.length, 3);
  assert.equal(state.status, "running");
  assert.ok(state.player.stunTicks > 0);
  assert.equal(state.food.point, null);
  assert.equal(state.food.player, null);
  assert.equal(state.food.enemy, null);
});

test("beginner break-barrier phase keeps all food cleared until wall break occurs", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: {
      phase: "break_barrier",
      practicePointCount: 4
    },
    player: {
      ...state.player,
      score: 3,
      snake: [{ x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 13 }, { x: 14, y: 13 }, { x: 15, y: 13 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 99
    },
    food: { point: { x: 3, y: 3 }, player: { x: 4, y: 4 }, enemy: { x: 5, y: 5 } }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.beginnerTutorial.phase, "break_barrier");
  assert.equal(state.status, "running");
  assert.equal(state.food.point, null);
  assert.equal(state.food.player, null);
  assert.equal(state.food.enemy, null);
});

test("beginner removes barriers and pauses after wall-break stun resolves", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    beginnerTutorial: {
      phase: "wall_break_stun",
      practicePointCount: 4
    },
    player: {
      ...state.player,
      snake: [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 1
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 13 }, { x: 14, y: 13 }, { x: 15, y: 13 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 99
    },
    food: { point: { x: 3, y: 3 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.status, "paused");
  assert.equal(state.beginnerTutorial.phase, "after_barrier_removed");
  assert.deepEqual(state.walls, []);
});

test("beginner explanation pause seeds final handoff foods while staying paused", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "paused",
    walls: [],
    beginnerTutorial: {
      phase: "after_barrier_removed",
      practicePointCount: 4
    }
  };

  state = advanceTutorialPrompt(state, () => 0);

  assert.equal(state.status, "paused");
  assert.equal(state.beginnerTutorial.phase, "final_ready_prompt");
  assert.ok(state.food.point);
  const pointXFromLeft = state.food.point.x + 1;
  assert.ok(pointXFromLeft < 9);
  assert.ok(state.food.player);
  assert.ok(state.food.enemy);
});

test("beginner final prompt starts normal play and marks tutorial complete", () => {
  let state = createGameState({ difficulty: "beginner", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "paused",
    walls: [],
    beginnerTutorial: {
      phase: "final_ready_prompt",
      practicePointCount: 4
    },
    food: { point: { x: 3, y: 3 }, player: { x: 10, y: 10 }, enemy: { x: 11, y: 11 } }
  };

  state = advanceTutorialPrompt(state, () => 0);

  assert.equal(state.status, "running");
  assert.equal(state.beginnerTutorial.phase, "complete");
  assert.equal(state.difficulty, "beginner");
  assert.equal(state.enemyErrorRate, DIFFICULTY_SETTINGS.beginner.errorRate);
});

test("snakes start closer to board edges", () => {
  const state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });

  assert.equal(state.player.snake[0].x, 2);
  assert.equal(state.enemy.snake[0].x, 14);
  assert.equal(state.player.score, 0);
  assert.equal(state.enemy.score, 0);
  assert.equal(state.player.snake.length, 1);
  assert.equal(state.enemy.snake.length, 2);
});

test("custom starting points and sizes are applied", () => {
  const state = createGameState({
    difficulty: "hard",
    width: 17,
    height: 17,
    startingPlayerPoints: 4,
    startingEnemyPoints: 2,
    startingPlayerSize: 3,
    startingEnemySize: 5,
    rng: () => 0.99
  });

  assert.equal(state.player.score, 4);
  assert.equal(state.enemy.score, 2);
  assert.equal(state.player.snake.length, 4);
  assert.equal(state.enemy.snake.length, 5);
});

test("snake grows and player score increments after eating food", () => {
  let state = createGameState({ difficulty: "hard", rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      snake: [{ x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT"
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 8 }, { x: 14, y: 8 }, { x: 15, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT"
    },
    food: { point: { x: 5, y: 8 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0);

  assert.equal(state.player.snake.length, 4);
  assert.equal(state.player.score, 1);
  assert.deepEqual(state.player.snake[0], { x: 5, y: 8 });
});

test("reversing direction is ignored", () => {
  const base = createGameState({ difficulty: "hard", rng: () => 0 });
  const state = {
    ...base,
    player: {
      ...base.player,
      snake: [{ x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT"
    }
  };
  const nextState = queueDirection(state, "LEFT");

  assert.equal(nextState.player.nextDirection, "RIGHT");
});

test("enemy reversing direction is ignored in human-control mode", () => {
  const base = createGameState({ difficulty: "hard", enemyControl: "human", rng: () => 0 });
  const state = {
    ...base,
    enemy: {
      ...base.enemy,
      snake: [{ x: 12, y: 8 }, { x: 13, y: 8 }, { x: 14, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT"
    }
  };
  const nextState = queueEnemyDirection(state, "RIGHT");

  assert.equal(nextState.enemy.nextDirection, "LEFT");
});

test("enemy follows queued human direction when enemyControl is human", () => {
  let state = createGameState({ difficulty: "hard", width: 17, height: 17, enemyControl: "human", rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      snake: [{ x: 2, y: 2 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 99
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 12, y: 8 }],
      direction: "LEFT",
      nextDirection: "UP",
      stunTicks: 0
    },
    food: { point: { x: 0, y: 0 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);
  assert.deepEqual(state.enemy.snake[0], { x: 12, y: 7 });
});

test("hitting the other snake body causes damage and stun", () => {
  let state = createGameState({ difficulty: "hard", width: 12, height: 8, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 3,
      snake: [{ x: 4, y: 3 }, { x: 3, y: 3 }, { x: 2, y: 3 }],
      direction: "RIGHT",
      nextDirection: "RIGHT"
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 9, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 4 }],
      direction: "LEFT",
      nextDirection: "LEFT"
    },
    food: { point: { x: 11, y: 7 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0);

  assert.equal(state.status, "running");
  assert.equal(state.player.snake.length, 2);
  assert.equal(state.player.score, 2);
  assert.equal(state.player.stunTicks, DAMAGE_STUN_TICKS);
});

test("head-on-head collisions damage both snakes", () => {
  let state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 5,
      snake: [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      score: 5,
      snake: [{ x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0
    },
    food: { point: { x: 8, y: 8 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0);

  assert.equal(state.player.score, 4);
  assert.equal(state.enemy.score, 4);
  assert.equal(state.player.snake.length, 2);
  assert.equal(state.enemy.snake.length, 2);
  assert.equal(state.player.stunTicks, DAMAGE_STUN_TICKS);
  assert.equal(state.enemy.stunTicks, DAMAGE_STUN_TICKS);
});

test("snake collision knocks snakes one tile apart when possible", () => {
  let state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      snake: [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0
    },
    food: { point: { x: 0, y: 8 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);

  assert.notDeepEqual(state.player.snake[0], { x: 7, y: 8 });
  assert.notDeepEqual(state.enemy.snake[0], { x: 9, y: 8 });
  assert.notDeepEqual(state.player.snake[0], state.enemy.snake[0]);
});

test("first snake to 15 food wins", () => {
  let state = createGameState({ difficulty: "hard", rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: WIN_SCORE - 1,
      snake: [{ x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT"
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 8 }, { x: 14, y: 8 }, { x: 15, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT"
    },
    food: { point: { x: 5, y: 8 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0);

  assert.equal(state.player.score, WIN_SCORE);
  assert.equal(state.status, "player_won");
});

test("points cannot drop below zero and do not cause immediate loss", () => {
  let state = createGameState({ difficulty: "hard", width: 10, height: 8, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 0,
      snake: [{ x: 9, y: 3 }, { x: 8, y: 3 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      score: 4,
      snake: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0
    }
  };

  state = advanceGame(state, () => 0);

  assert.equal(state.player.score, 0);
  assert.equal(state.status, "running");
});

test("after player eats, new point food spawns after a brief delay on enemy side", () => {
  let state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      snake: [{ x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 8 }, { x: 14, y: 8 }, { x: 15, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0
    },
    food: { point: { x: 5, y: 8 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0);
  assert.equal(state.food.point, null);
  assert.equal(state.food.player, null);
  assert.equal(state.food.enemy, null);
  assert.equal(state.foodSpawnTimer, 1);

  state = advanceGame(state, () => 0);

  const centerColumns = [7, 8, 9];
  assert.ok(state.food.point.x > 8);
  assert.ok(!centerColumns.includes(state.food.point.x));
  assert.ok(state.food.player);
  assert.ok(state.food.enemy);
});

test("damaged snake pauses movement until stun expires", () => {
  let state = createGameState({ difficulty: "hard", width: 10, height: 8, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 2,
      snake: [{ x: 9, y: 3 }, { x: 8, y: 3 }, { x: 7, y: 3 }],
      direction: "RIGHT",
      nextDirection: "RIGHT"
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }],
      direction: "LEFT",
      nextDirection: "LEFT"
    }
  };

  state = advanceGame(state, () => 0);
  const headAfterDamage = state.player.snake[0];
  assert.equal(state.player.stunTicks, DAMAGE_STUN_TICKS);

  state = advanceGame(state, () => 0);
  assert.deepEqual(state.player.snake[0], headAfterDamage);
  assert.equal(state.player.stunTicks, DAMAGE_STUN_TICKS - 1);
});

test("food placement only uses open cells across both snakes", () => {
  const food = placeFood(
    2,
    2,
    [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ],
      [{ x: 0, y: 1 }]
    ],
    () => 0
  );

  assert.deepEqual(food, { x: 1, y: 1 });
});

test("easy mode can force a late turn error (one tile too late)", () => {
  const sequence = [0, 0.99];
  let index = 0;
  const rng = () => {
    const value = sequence[index] ?? 0.5;
    index += 1;
    return value;
  };

  let state = createGameState({ width: 17, height: 17, difficulty: "easy", rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 8, y: 8 }, { x: 9, y: 8 }, { x: 10, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0
    },
    food: { point: { x: 8, y: 6 }, player: null, enemy: null },
    tickCount: 0
  };

  state = advanceGame(state, rng);
  assert.deepEqual(state.enemy.snake[0], { x: 7, y: 8 });
});

test("enemy keeps safe current direction when point food is absent", () => {
  let state = createGameState({ width: 17, height: 17, difficulty: "hard", rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      snake: [{ x: 2, y: 2 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 99
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 8, y: 1 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    food: { point: null, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);
  assert.deepEqual(state.enemy.snake[0], { x: 9, y: 1 });
});

test("medium difficulty avoids immediate wall-suicide when a safe move exists", () => {
  let state = createGameState({ width: 17, height: 17, difficulty: "medium", rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      snake: [{ x: 2, y: 2 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 99
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 8, y: 0 }],
      direction: "UP",
      nextDirection: "UP",
      stunTicks: 0
    },
    food: { point: { x: 8, y: 5 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0);
  assert.equal(state.status, "running");
  assert.notDeepEqual(state.enemy.snake[0], { x: 8, y: -1 });
  assert.notEqual(state.enemy.snake.length, 0);
});

test("snake-specific food stolen by opponent removes owner point only", () => {
  let state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 5,
      snake: [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      score: 6,
      snake: [{ x: 13, y: 8 }, { x: 14, y: 8 }, { x: 15, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0
    },
    food: {
      point: { x: 2, y: 2 },
      player: null,
      enemy: { x: 6, y: 8 }
    }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.player.score, 5);
  assert.equal(state.enemy.score, 5);
  assert.equal(state.player.snake.length, 3);
  assert.equal(state.food.enemy, null);
  assert.deepEqual(state.food.point, { x: 2, y: 2 });
});

test("collecting own snake food awards one point when points are below body length", () => {
  let state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 1,
      snake: [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      score: 6,
      snake: [{ x: 13, y: 8 }, { x: 14, y: 8 }, { x: 15, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 99
    },
    food: {
      point: { x: 0, y: 0 },
      player: { x: 6, y: 8 },
      enemy: null
    }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.player.score, 2);
  assert.equal(state.enemy.score, 6);
  assert.equal(state.food.player, null);
});

test("collecting own snake food does not award when points equal body length", () => {
  let state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 2,
      snake: [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      score: 6,
      snake: [{ x: 13, y: 8 }, { x: 14, y: 8 }, { x: 15, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 99
    },
    food: {
      point: { x: 0, y: 0 },
      player: { x: 6, y: 8 },
      enemy: null
    }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.player.score, 2);
  assert.equal(state.food.player, null);
});

test("collecting own snake food does not award points when points meet body length", () => {
  let state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 5,
      snake: [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      score: 6,
      snake: [{ x: 13, y: 8 }, { x: 14, y: 8 }, { x: 15, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 99
    },
    food: {
      point: { x: 0, y: 0 },
      player: { x: 6, y: 8 },
      enemy: null
    }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.player.score, 5);
  assert.equal(state.enemy.score, 6);
  assert.equal(state.food.player, null);
});

test("enemy stealing player food only lowers player score", () => {
  let state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 6,
      snake: [{ x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 99
    },
    enemy: {
      ...state.enemy,
      score: 5,
      snake: [{ x: 11, y: 8 }, { x: 12, y: 8 }, { x: 13, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0
    },
    food: {
      point: { x: 0, y: 8 },
      player: { x: 10, y: 8 },
      enemy: null
    }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.player.score, 5);
  assert.equal(state.enemy.score, 5);
  assert.equal(state.enemy.snake.length, 3);
  assert.equal(state.food.player, null);
});

test("collecting point food respawns all three foods and clears old snake foods", () => {
  let state = createGameState({ difficulty: "hard", width: 17, height: 17, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      snake: [{ x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 13, y: 8 }, { x: 14, y: 8 }, { x: 15, y: 8 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 0
    },
    food: {
      point: { x: 5, y: 8 },
      player: { x: 7, y: 8 },
      enemy: { x: 9, y: 8 }
    }
  };

  state = advanceGame(state, () => 0);
  assert.equal(state.food.point, null);
  assert.deepEqual(state.food.player, { x: 7, y: 8 });
  assert.deepEqual(state.food.enemy, { x: 9, y: 8 });
  assert.equal(state.foodSpawnTimer, 1);

  state = advanceGame(state, () => 0);

  assert.ok(state.food.point);
  assert.ok(state.food.player);
  assert.ok(state.food.enemy);
  assert.notDeepEqual(state.food.player, { x: 7, y: 8 });
  assert.notDeepEqual(state.food.enemy, { x: 9, y: 8 });
});

test("three consecutive damage ticks cause an automatic loss", () => {
  let state = createGameState({ difficulty: "hard", width: 8, height: 8, rng: () => 0 });

  for (let tick = 0; tick < 3; tick += 1) {
    state = {
      ...state,
      status: "running",
      player: {
        ...state.player,
        score: 2,
        snake: [{ x: 7, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 3 }, { x: 4, y: 3 }],
        direction: "RIGHT",
        nextDirection: "RIGHT",
        stunTicks: 0,
        damageStreak: tick
      },
      enemy: {
        ...state.enemy,
        score: 2,
        snake: [{ x: 1, y: 3 }],
        direction: "LEFT",
        nextDirection: "LEFT",
        stunTicks: 99,
        damageStreak: 0
      },
      food: { point: { x: 0, y: 0 }, player: null, enemy: null }
    };

    state = advanceGame(state, () => 0);
  }

  assert.equal(state.player.damageStreak, 3);
  assert.equal(state.status, "enemy_won");
});

test("damage streak is preserved during stun ticks", () => {
  let state = createGameState({ difficulty: "hard", width: 8, height: 8, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 3,
      snake: [{ x: 7, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 3 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0,
      damageStreak: 1
    },
    enemy: {
      ...state.enemy,
      score: 3,
      snake: [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 99,
      damageStreak: 0
    },
    food: { point: { x: 0, y: 0 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0);
  assert.equal(state.player.damageStreak, 2);

  state = advanceGame(state, () => 0);
  assert.equal(state.player.damageStreak, 2);
});

test("snake loses immediately when damage would drop body below one segment", () => {
  let state = createGameState({ difficulty: "hard", width: 8, height: 8, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      snake: [{ x: 7, y: 2 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0,
      damageStreak: 0
    },
    enemy: {
      ...state.enemy,
      snake: [{ x: 1, y: 2 }],
      direction: "LEFT",
      nextDirection: "LEFT",
      stunTicks: 99,
      damageStreak: 0
    },
    food: { point: { x: 0, y: 0 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0);

  assert.equal(state.player.snake.length, 0);
  assert.equal(state.status, "enemy_won");
});

test("snake auto-turns to a safe direction after stun recovery when no new input is provided", () => {
  let state = createGameState({ difficulty: "hard", width: 12, height: 12, rng: () => 0 });
  state = {
    ...state,
    status: "running",
    player: {
      ...state.player,
      score: 2,
      snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 0,
      damageStreak: 1
    },
    enemy: {
      ...state.enemy,
      score: 2,
      snake: [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }],
      direction: "RIGHT",
      nextDirection: "RIGHT",
      stunTicks: 99,
      damageStreak: 0
    },
    food: { point: { x: 0, y: 0 }, player: null, enemy: null }
  };

  state = advanceGame(state, () => 0.5);

  assert.equal(state.player.stunTicks, 0);
  assert.notEqual(state.player.direction, "RIGHT");
  assert.equal(state.player.damageStreak, 0);
});

console.log(`\n${passed} tests passed.`);
