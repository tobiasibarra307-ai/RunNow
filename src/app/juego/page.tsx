"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 180;
const LEVEL_END = 4600;
const PLAYER_WIDTH = 11;
const PLAYER_HEIGHT = 16;
const GROUND_Y = 150;
const SKELETON_X = 4490;
const SKELETON_WIDTH = 16;

type Platform = { x: number; y: number; width: number };
type Wall = { x: number; y: number; width: number; height: number };
type Coin = { x: number; y: number };
type GameStatus = "ready" | "playing" | "won" | "lost";

type GameState = {
  x: number;
  y: number;
  velocityY: number;
  onGround: boolean;
  facing: -1 | 1;
  camera: number;
  jumpBuffer: number;
  animationTime: number;
  hasSword: boolean;
  attackTime: number;
  attackCooldown: number;
  skeletonHealth: number;
  skeletonFlash: number;
  collected: Set<number>;
  status: GameStatus;
};

const platforms: Platform[] = [
  { x: 0, y: 150, width: 520 },
  { x: 600, y: 150, width: 450 },
  { x: 1140, y: 150, width: 440 },
  { x: 1680, y: 150, width: 360 },
  { x: 2130, y: 150, width: 440 },
  { x: 2660, y: 150, width: 390 },
  { x: 3140, y: 150, width: 400 },
  { x: 3640, y: 150, width: 450 },
  { x: 4180, y: 150, width: 420 },
  { x: 455, y: 126, width: 72 },
  { x: 970, y: 120, width: 70 },
  { x: 1530, y: 125, width: 75 },
  { x: 2000, y: 118, width: 70 },
  { x: 2510, y: 123, width: 75 },
  { x: 2990, y: 115, width: 72 },
  { x: 3485, y: 122, width: 75 },
  { x: 3980, y: 116, width: 76 },
];

const walls: Wall[] = [{ x: 4260, y: 114, width: 14, height: GROUND_Y - 114 }];
const swordPosition = { x: 4372, y: 134 };

const coins: Coin[] = [
  { x: 195, y: 127 }, { x: 365, y: 127 }, { x: 485, y: 105 },
  { x: 740, y: 127 }, { x: 995, y: 99 }, { x: 1280, y: 127 },
  { x: 1555, y: 104 }, { x: 1805, y: 127 }, { x: 2020, y: 97 },
  { x: 2300, y: 127 }, { x: 2535, y: 102 }, { x: 2820, y: 127 },
  { x: 3015, y: 94 }, { x: 3310, y: 127 }, { x: 3510, y: 101 },
  { x: 3820, y: 127 }, { x: 4010, y: 95 }, { x: 4380, y: 127 },
];

const stars = Array.from({ length: 38 }, (_, index) => ({
  x: (index * 83 + 19) % 320,
  y: (index * 47 + 13) % 90,
  size: index % 5 === 0 ? 2 : 1,
}));

function createGame(status: GameStatus = "ready"): GameState {
  return {
    x: 34,
    y: 150 - PLAYER_HEIGHT,
    velocityY: 0,
    onGround: true,
    facing: 1,
    camera: 0,
    jumpBuffer: 0,
    animationTime: 0,
    hasSword: false,
    attackTime: 0,
    attackCooldown: 0,
    skeletonHealth: 3,
    skeletonFlash: 0,
    collected: new Set(),
    status,
  };
}

function drawSword(context: CanvasRenderingContext2D, x: number, y: number) {
  context.fillStyle = "#e7f3ec";
  context.fillRect(x + 4, y, 2, 12);
  context.fillStyle = "#a9c9bd";
  context.fillRect(x + 3, y + 2, 2, 6);
  context.fillStyle = "#f4d47b";
  context.fillRect(x + 2, y + 10, 6, 2);
  context.fillStyle = "#8b573c";
  context.fillRect(x + 4, y + 12, 2, 4);
  context.fillStyle = "#d4b889";
  context.fillRect(x + 3, y + 15, 4, 2);
}

function drawSkeleton(context: CanvasRenderingContext2D, game: GameState) {
  const x = Math.round(SKELETON_X - game.camera);
  const y = GROUND_Y - 24;
  const bone = game.skeletonFlash > 0 ? "#ffffff" : "#e2dfc6";
  const shadow = game.skeletonFlash > 0 ? "#d9d5c0" : "#777866";

  context.fillStyle = "#0a1712";
  context.fillRect(x + 2, GROUND_Y + 1, 14, 2);
  context.fillStyle = shadow;
  context.fillRect(x + 4, y + 1, 9, 9);
  context.fillStyle = bone;
  context.fillRect(x + 4, y, 9, 8);
  context.fillRect(x + 6, y + 8, 5, 10);
  context.fillRect(x + 2, y + 10, 12, 2);
  context.fillRect(x + 4, y + 12, 9, 2);
  context.fillRect(x + 1, y + 9, 3, 5);
  context.fillRect(x + 13, y + 9, 3, 5);
  context.fillRect(x + 6, y + 17, 2, 5);
  context.fillRect(x + 10, y + 17, 2, 5);
  context.fillRect(x + 4, y + 21, 4, 2);
  context.fillRect(x + 10, y + 21, 4, 2);
  context.fillStyle = "#34413a";
  context.fillRect(x + 6, y + 3, 2, 2);
  context.fillRect(x + 10, y + 3, 2, 2);
  context.fillRect(x + 8, y + 6, 2, 1);
  context.fillStyle = "#a75245";
  context.fillRect(x + 6, y + 3, 1, 1);
  context.fillRect(x + 10, y + 3, 1, 1);
}

function drawScene(context: CanvasRenderingContext2D, game: GameState, direction: number) {
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#13251f";
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.fillStyle = "#f0f3cb";
  context.fillRect(255, 24, 12, 12);
  context.fillStyle = "#13251f";
  context.fillRect(258, 21, 12, 12);

  for (const star of stars) {
    const x = (star.x - game.camera * 0.12 + VIEW_WIDTH * 2) % VIEW_WIDTH;
    context.fillStyle = star.size === 2 ? "#d8e8ba" : "#8ca692";
    context.fillRect(x, star.y, star.size, star.size);
  }

  for (let layer = 0; layer < 2; layer += 1) {
    const parallax = layer === 0 ? 0.18 : 0.34;
    const color = layer === 0 ? "#20372f" : "#1a3028";
    const shift = (game.camera * parallax) % 96;
    context.fillStyle = color;
    for (let x = -96 - shift; x < VIEW_WIDTH + 96; x += 96) {
      const peak = layer === 0 ? 105 : 124;
      context.fillRect(x + 22, peak, 52, VIEW_HEIGHT - peak);
      context.fillRect(x + 12, peak + 10, 72, VIEW_HEIGHT - peak - 10);
      context.fillRect(x + 2, peak + 20, 92, VIEW_HEIGHT - peak - 20);
    }
  }

  for (const platform of platforms) {
    const x = Math.round(platform.x - game.camera);
    if (x + platform.width < 0 || x > VIEW_WIDTH) continue;
    context.fillStyle = "#425b43";
    context.fillRect(x, platform.y, platform.width, VIEW_HEIGHT - platform.y);
    context.fillStyle = "#b6f36c";
    context.fillRect(x, platform.y, platform.width, 3);
    context.fillStyle = "#304735";
    for (let tile = x + 5; tile < x + platform.width; tile += 13) {
      context.fillRect(tile, platform.y + 8, 5, 3);
      context.fillRect(tile + 4, platform.y + 20, 4, 3);
    }
  }

  for (const wall of walls) {
    const x = Math.round(wall.x - game.camera);
    if (x + wall.width < 0 || x > VIEW_WIDTH) continue;
    context.fillStyle = "#795442";
    context.fillRect(x, wall.y, wall.width, wall.height);
    context.fillStyle = "#b77b54";
    context.fillRect(x, wall.y, wall.width, 3);
    context.fillStyle = "#483b34";
    context.fillRect(x + 3, wall.y + 8, 3, 5);
    context.fillRect(x + 8, wall.y + 20, 4, 5);
  }

  coins.forEach((coin, index) => {
    if (game.collected.has(index)) return;
    const x = Math.round(coin.x - game.camera);
    if (x < -6 || x > VIEW_WIDTH + 6) return;
    context.fillStyle = "#fff0a4";
    context.fillRect(x - 2, coin.y - 4, 5, 9);
    context.fillStyle = "#ffb957";
    context.fillRect(x - 4, coin.y - 2, 9, 5);
    context.fillStyle = "#fff8d4";
    context.fillRect(x - 1, coin.y - 2, 2, 4);
  });

  if (!game.hasSword) {
    drawSword(context, Math.round(swordPosition.x - game.camera), swordPosition.y - 14);
    context.fillStyle = "#fff0a4";
    context.fillRect(Math.round(swordPosition.x - game.camera) + 1, swordPosition.y + 4, 8, 1);
  }

  const goalX = Math.round(LEVEL_END - 46 - game.camera);
  context.fillStyle = "#d6e1cb";
  context.fillRect(goalX, 102, 2, 48);
  context.fillStyle = "#b6f36c";
  context.fillRect(goalX + 2, 102, 18, 12);
  context.fillStyle = "#39523d";
  context.fillRect(goalX + 2, 108, 8, 6);

  if (game.skeletonHealth > 0) drawSkeleton(context, game);

  const playerX = Math.round(game.x - game.camera);
  const playerY = Math.round(game.y);
  context.fillStyle = "#0a1712";
  context.fillRect(playerX + 1, playerY + PLAYER_HEIGHT, 10, 2);
  context.fillStyle = "#e6a575";
  context.fillRect(playerX + 3, playerY, 7, 6);
  context.fillStyle = "#754638";
  context.fillRect(playerX + 2, playerY - 1, 8, 3);
  context.fillStyle = "#e6a575";
  context.fillRect(playerX + (game.facing === 1 ? 8 : 2), playerY + 3, 3, 2);
  context.fillStyle = "#62c4a0";
  context.fillRect(playerX + 2, playerY + 6, 8, 6);
  context.fillStyle = "#f1d78c";
  context.fillRect(playerX + 4, playerY + 7, 4, 2);
  context.fillStyle = "#324b69";
  context.fillRect(playerX + 3, playerY + 12, 7, 3);
  context.fillStyle = "#27313a";
  const walking = direction !== 0 && game.onGround;
  const step = walking ? Math.floor(game.animationTime / 5) % 2 : 0;
  if (game.onGround && step === 1) {
    context.fillRect(playerX + 1, playerY + 14, 4, 2);
    context.fillRect(playerX + 8, playerY + 13, 3, 2);
  } else if (!game.onGround) {
    context.fillRect(playerX + 2, playerY + 14, 3, 2);
    context.fillRect(playerX + 8, playerY + 13, 3, 2);
  } else {
    context.fillRect(playerX + 2, playerY + 14, 4, 2);
    context.fillRect(playerX + 8, playerY + 14, 3, 2);
  }
  context.fillStyle = "#18241e";
  context.fillRect(playerX + (game.facing === 1 ? 8 : 4), playerY + 2, 1, 1);

  if (game.hasSword) {
    if (game.attackTime > 0) {
      context.fillStyle = "#fff4b8";
      context.fillRect(playerX + (game.facing === 1 ? 12 : -8), playerY + 5, 8, 2);
      context.fillStyle = "#d9f4e7";
      context.fillRect(playerX + (game.facing === 1 ? 15 : -9), playerY + 2, 2, 8);
    } else {
      drawSword(context, playerX + (game.facing === 1 ? 8 : -3), playerY + 5);
    }
  }
}

export default function PixelRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(createGame());
  const heldKeys = useRef(new Set<string>());
  const jumpRequested = useRef(false);
  const attackRequested = useRef(false);
  const statusRef = useRef<GameStatus>("ready");
  const [status, setStatus] = useState<GameStatus>("ready");
  const [hud, setHud] = useState({ progress: 0, coins: 0, hasSword: false, skeletonHealth: 3 });

  const requestAttack = useCallback(() => {
    if (statusRef.current === "playing") attackRequested.current = true;
  }, []);

  const startGame = useCallback(() => {
    if (statusRef.current === "won" || statusRef.current === "lost") {
      gameRef.current = createGame("playing");
      setHud({ progress: 0, coins: 0, hasSword: false, skeletonHealth: 3 });
    } else {
      gameRef.current.status = "playing";
    }
    statusRef.current = "playing";
    setStatus("playing");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let frame = 0;
    let lastTime = 0;
    let hudTime = 0;
    let movementDirection = 0;

    const update = (delta: number) => {
      const game = gameRef.current;
      if (game.status !== "playing") return;

      game.animationTime += delta;
      game.attackTime = Math.max(0, game.attackTime - delta);
      game.attackCooldown = Math.max(0, game.attackCooldown - delta);
      game.skeletonFlash = Math.max(0, game.skeletonFlash - delta);

      const moveLeft = heldKeys.current.has("ArrowLeft") || heldKeys.current.has("a");
      const moveRight = heldKeys.current.has("ArrowRight") || heldKeys.current.has("d");
      const direction = Number(moveRight) - Number(moveLeft);
      movementDirection = direction;
      if (direction !== 0) {
        game.facing = direction < 0 ? -1 : 1;
        const nextX = game.x + direction * 2.6 * delta;
        let blockedX = direction > 0 ? LEVEL_END - PLAYER_WIDTH : 0;

        for (const platform of platforms) {
          const overlapsY = game.y < VIEW_HEIGHT && game.y + PLAYER_HEIGHT > platform.y;
          const overlapsX = nextX < platform.x + platform.width && nextX + PLAYER_WIDTH > platform.x;
          if (!overlapsY || !overlapsX) continue;
          blockedX = direction > 0
            ? Math.min(blockedX, platform.x - PLAYER_WIDTH)
            : Math.max(blockedX, platform.x + platform.width);
        }

        for (const wall of walls) {
          const overlapsY = game.y < wall.y + wall.height && game.y + PLAYER_HEIGHT > wall.y;
          const overlapsX = nextX < wall.x + wall.width && nextX + PLAYER_WIDTH > wall.x;
          if (!overlapsY || !overlapsX) continue;
          blockedX = direction > 0
            ? Math.min(blockedX, wall.x - PLAYER_WIDTH)
            : Math.max(blockedX, wall.x + wall.width);
        }

        if (game.skeletonHealth > 0) {
          const overlapsY = game.y < GROUND_Y && game.y + PLAYER_HEIGHT > GROUND_Y - 24;
          const overlapsX = nextX < SKELETON_X + SKELETON_WIDTH && nextX + PLAYER_WIDTH > SKELETON_X;
          if (overlapsY && overlapsX) {
            blockedX = direction > 0
              ? Math.min(blockedX, SKELETON_X - PLAYER_WIDTH)
              : Math.max(blockedX, SKELETON_X + SKELETON_WIDTH);
          }
        }

        game.x = direction > 0
          ? Math.max(game.x, Math.min(nextX, blockedX))
          : Math.min(game.x, Math.max(nextX, blockedX));
      }

      if (attackRequested.current) {
        attackRequested.current = false;
        if (game.hasSword && game.attackCooldown <= 0) {
          game.attackTime = 10;
          game.attackCooldown = 17;
          const distance = SKELETON_X + SKELETON_WIDTH / 2 - (game.x + PLAYER_WIDTH / 2);
          const inReach = Math.abs(distance) <= 34 && Math.sign(distance) === game.facing;
          const sameHeight = Math.abs(game.y + PLAYER_HEIGHT / 2 - (GROUND_Y - 12)) <= 23;
          if (game.skeletonHealth > 0 && inReach && sameHeight) {
            game.skeletonHealth -= 1;
            game.skeletonFlash = 6;
          }
        }
      }

      if (jumpRequested.current) {
        game.jumpBuffer = 8;
        jumpRequested.current = false;
      }
      if (game.jumpBuffer > 0 && game.onGround) {
        game.velocityY = -6;
        game.onGround = false;
        game.jumpBuffer = 0;
      }
      game.jumpBuffer = Math.max(0, game.jumpBuffer - delta);

      const previousY = game.y;
      const previousBottom = previousY + PLAYER_HEIGHT;
      game.velocityY = Math.min(6, game.velocityY + 0.31 * delta);
      const nextY = game.y + game.velocityY * delta;
      game.onGround = false;

      for (const platform of platforms) {
        const overlapsX = game.x + PLAYER_WIDTH > platform.x && game.x < platform.x + platform.width;
        const crossedTop = previousBottom <= platform.y && nextY + PLAYER_HEIGHT >= platform.y;
        if (game.velocityY >= 0 && overlapsX && crossedTop) {
          game.y = platform.y - PLAYER_HEIGHT;
          game.velocityY = 0;
          game.onGround = true;
          break;
        }
      }
      if (!game.onGround) game.y = nextY;

      if (!game.hasSword && Math.abs(game.x + PLAYER_WIDTH / 2 - swordPosition.x) < 12) {
        game.hasSword = true;
      }

      for (const [index, coin] of coins.entries()) {
        if (game.collected.has(index)) continue;
        const closeX = Math.abs(game.x + PLAYER_WIDTH / 2 - coin.x) < 9;
        const closeY = Math.abs(game.y + PLAYER_HEIGHT / 2 - coin.y) < 13;
        if (closeX && closeY) game.collected.add(index);
      }

      game.camera = Math.max(0, Math.min(LEVEL_END - VIEW_WIDTH, game.x - 100));
      if (game.y > VIEW_HEIGHT + 22) {
        game.status = "lost";
        statusRef.current = "lost";
        setStatus("lost");
      } else if (game.skeletonHealth <= 0 && game.x + PLAYER_WIDTH >= LEVEL_END - 52) {
        game.status = "won";
        statusRef.current = "won";
        setStatus("won");
      }
    };

    const render = (time: number) => {
      const delta = lastTime === 0 ? 1 : Math.min((time - lastTime) / 16.67, 2.5);
      lastTime = time;
      update(delta);
      drawScene(context, gameRef.current, movementDirection);

      if (time - hudTime > 120) {
        const game = gameRef.current;
        setHud({
          progress: Math.min(100, Math.floor((game.x / LEVEL_END) * 100)),
          coins: game.collected.size,
          hasSword: game.hasSword,
          skeletonHealth: game.skeletonHealth,
        });
        hudTime = time;
      }

      frame = window.requestAnimationFrame(render);
    };

    const normalizeKey = (key: string) => key.length === 1 ? key.toLowerCase() : key;
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = normalizeKey(event.key);
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", " ", "a", "d"].includes(key)) return;
      event.preventDefault();
      if (event.repeat) return;
      heldKeys.current.add(key);
      if (key === " " || key === "ArrowUp") jumpRequested.current = true;
      if (statusRef.current !== "playing") {
        if (statusRef.current === "won" || statusRef.current === "lost") {
          gameRef.current = createGame("playing");
          setHud({ progress: 0, coins: 0, hasSword: false, skeletonHealth: 3 });
        } else {
          gameRef.current.status = "playing";
        }
        statusRef.current = "playing";
        setStatus("playing");
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      heldKeys.current.delete(normalizeKey(event.key));
    };
    const handleBlur = () => {
      heldKeys.current.clear();
      jumpRequested.current = false;
      attackRequested.current = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    canvas.addEventListener("pointerdown", requestAttack);
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      canvas.removeEventListener("pointerdown", requestAttack);
    };
  }, [requestAttack]);

  const overlay = status === "ready" || status === "won" || status === "lost";

  return (
    <main className="runner-shell">
      <header className="runner-header">
        <Link className="runner-brand" href="/instrumentos"><span>II</span> IBARRA INSTRUMENTS</Link>
        <Link className="runner-back" href="/instrumentos">← VOLVER AL INVENTARIO</Link>
      </header>

      <section className="runner-main" aria-labelledby="runner-title">
        <div className="runner-intro">
          <div>
            <p className="runner-kicker">ARCADE DE PIXELES · NIVEL 01</p>
            <h1 className="runner-title" id="runner-title">PIXEL <span>RUNNER</span></h1>
          </div>
          <p className="runner-description">Salta muros, recoge tu espada y vence al esqueleto para conquistar la bandera.</p>
        </div>

        <div className="runner-frame">
          <div className="runner-hud" aria-live="polite">
            <span>PROGRESO <strong>{hud.progress}%</strong></span>
            <div className="runner-progress" aria-label={`Progreso: ${hud.progress}%`}>
              <i style={{ width: `${hud.progress}%` }} />
            </div>
            <span>MONEDAS <strong>{hud.coins}/{coins.length}</strong></span>
            <span>ESPADA <strong>{hud.hasSword ? "LISTA" : "—"}</strong></span>
            <span>ESQUELETO <strong>{hud.skeletonHealth > 0 ? `${hud.skeletonHealth} PV` : "VENCIDO"}</strong></span>
          </div>
          <div className="runner-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="runner-canvas"
              width={VIEW_WIDTH}
              height={VIEW_HEIGHT}
              role="img"
              aria-label="Juego de plataformas Pixel Runner. Usa las flechas para moverte, la barra espaciadora para saltar y haz clic para atacar con la espada."
            />
            {overlay && (
              <div className="runner-overlay">
                <h2>{status === "won" ? "¡NIVEL COMPLETADO!" : status === "lost" ? "¡UPS, CAÍSTE!" : "¿LISTO PARA SALTAR?"}</h2>
                <p>
                  {status === "won"
                    ? `Venciste al esqueleto y llegaste a la bandera. Recogiste ${hud.coins} monedas.`
                    : status === "lost"
                      ? "Los huecos son traicioneros. Inténtalo de nuevo y calcula bien el salto."
                      : "Salta el muro, recoge la espada y derrota al esqueleto que protege la bandera."}
                </p>
                <button className="runner-start" type="button" onClick={startGame}>
                  {status === "ready" ? "EMPEZAR AVENTURA  ↗" : "JUGAR DE NUEVO  ↗"}
                </button>
              </div>
            )}
          </div>
          <div className="runner-instructions">
            <span>MOVER <kbd>←</kbd><kbd>→</kbd> <kbd>A</kbd><kbd>D</kbd></span>
            <span>SALTAR <kbd>ESPACIO</kbd> <kbd>↑</kbd></span>
            <span>ATACAR <button className="runner-attack" type="button" onClick={requestAttack}>CLIC</button> O HAZ CLIC EN EL JUEGO</span>
            <span>OBJETIVO <kbd>⚔</kbd> VENCE AL ESQUELETO</span>
          </div>
        </div>
        <p className="runner-tip">Pisa los bloques desde arriba: no puedes atravesar la tierra ni el muro. Acércate al esqueleto y haz clic tres veces para derrotarlo.</p>
      </section>
    </main>
  );
}
