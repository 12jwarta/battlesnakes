import assert from "node:assert/strict";

import {
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
  let state = createGameState({ rng: () => 0 });
  state = startGame(state);
  state = advanceGame(state, () => 0);

  assert.deepEqual(state.player.snake[0], { x: 3, y: 8 });
  assert.equal(state.player.score, 0);
  assert.equal(state.player.snake.length, 1);
});

test("default difficulty is hard with current behavior", () => {
  const state = createGameState({ rng: () => 0 });

  assert.equal(state.difficulty, DEFAULT_DIFFICULTY);
  assert.equal(DIFFICULTY_SETTINGS.hard.errorRate, 0);
  assert.equal(DIFFICULTY_SETTINGS.medium.errorRate, 0.05);
  assert.equal(DIFFICULTY_SETTINGS.easy.errorRate, 0.1);
  assert.equal(DIFFICULTY_SETTINGS.easy.earlyErrorBias, 0.8);
});

test("starting food is directly left or right of center", () => {
  const state = createGameState({ width: 17, height: 17, rng: () => 0 });
  const centerX = 8;
  const centerY = 8;

  assert.ok(state.food.point.x === centerX - 1 || state.food.point.x === centerX + 1);
  assert.equal(state.food.point.y, centerY);
  assert.equal(state.food.player, null);
  assert.equal(state.food.enemy, null);
});

test("snakes start closer to board edges", () => {
  const state = createGameState({ width: 17, height: 17, rng: () => 0 });

  assert.equal(state.player.snake[0].x, 2);
  assert.equal(state.enemy.snake[0].x, 14);
  assert.equal(state.player.score, 0);
  assert.equal(state.enemy.score, 0);
  assert.equal(state.player.snake.length, 1);
  assert.equal(state.enemy.snake.length, 2);
});

test("custom starting points and sizes are applied", () => {
  const state = createGameState({
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
  let state = createGameState({ rng: () => 0 });
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
  const base = createGameState({ rng: () => 0 });
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
  const base = createGameState({ enemyControl: "human", rng: () => 0 });
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
  let state = createGameState({ width: 17, height: 17, enemyControl: "human", rng: () => 0 });
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
  let state = createGameState({ width: 12, height: 8, rng: () => 0 });
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
  let state = createGameState({ width: 17, height: 17, rng: () => 0 });
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
  let state = createGameState({ width: 17, height: 17, rng: () => 0 });
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
  let state = createGameState({ rng: () => 0 });
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
  let state = createGameState({ width: 10, height: 8, rng: () => 0 });
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
  let state = createGameState({ width: 17, height: 17, rng: () => 0 });
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
  let state = createGameState({ width: 10, height: 8, rng: () => 0 });
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
  let state = createGameState({ width: 17, height: 17, rng: () => 0 });
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
  let state = createGameState({ width: 17, height: 17, rng: () => 0 });
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

test("collecting own snake food does not award points when points meet body length", () => {
  let state = createGameState({ width: 17, height: 17, rng: () => 0 });
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
  let state = createGameState({ width: 17, height: 17, rng: () => 0 });
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
  let state = createGameState({ width: 17, height: 17, rng: () => 0 });
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
  let state = createGameState({ width: 8, height: 8, rng: () => 0 });

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
  let state = createGameState({ width: 8, height: 8, rng: () => 0 });
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
  let state = createGameState({ width: 8, height: 8, rng: () => 0 });
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

console.log(`\n${passed} tests passed.`);
