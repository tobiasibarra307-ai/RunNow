"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 180;
const LEVEL_END = 4600;
const PLAYER_WIDTH = 11;
const PLAYER_HEIGHT = 16;

type Platform = { x: number; y: number; width: number };
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
  { x: 4100, y: 130, width: 48 },
];

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
    collected: new Set(),
    status,
  };
}

function drawScene(context: CanvasRenderingContext2D, game: GameState) {
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

  const goalX = Math.round(LEVEL_END - 46 - game.camera);
  context.fillStyle = "#d6e1cb";
  context.fillRect(goalX, 102, 2, 48);
  context.fillStyle = "#b6f36c";
  context.fillRect(goalX + 2, 102, 18, 12);
  context.fillStyle = "#39523d";
  context.fillRect(goalX + 2, 108, 8, 6);

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
  context.fillRect(playerX + 2, playerY + 14, 4, 2);
  context.fillRect(playerX + 8, playerY + 14, 4, 2);
  context.fillStyle = "#18241e";
  context.fillRect(playerX + (game.facing === 1 ? 8 : 4), playerY + 2, 1, 1);
}

export default function PixelRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(createGame());
  const heldKeys = useRef(new Set<string>());
  const jumpRequested = useRef(false);
  const statusRef = useRef<GameStatus>("ready");
  const [status, setStatus] = useState<GameStatus>("ready");
  const [hud, setHud] = useState({ progress: 0, coins: 0 });

  const startGame = useCallback(() => {
    if (statusRef.current === "won" || statusRef.current === "lost") {
      gameRef.current = createGame("playing");
      setHud({ progress: 0, coins: 0 });
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

    const update = (delta: number) => {
      const game = gameRef.current;
      if (game.status !== "playing") return;

      const moveLeft = heldKeys.current.has("ArrowLeft") || heldKeys.current.has("a");
      const moveRight = heldKeys.current.has("ArrowRight") || heldKeys.current.has("d");
      const direction = Number(moveRight) - Number(moveLeft);
      if (direction !== 0) {
        game.x += direction * 2.6 * delta;
        game.facing = direction < 0 ? -1 : 1;
      }
      game.x = Math.max(0, Math.min(LEVEL_END - PLAYER_WIDTH, game.x));

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

      const previousBottom = game.y + PLAYER_HEIGHT;
      game.velocityY = Math.min(6, game.velocityY + 0.31 * delta);
      game.y += game.velocityY * delta;
      game.onGround = false;

      for (const platform of platforms) {
        const overlapsX = game.x + PLAYER_WIDTH > platform.x && game.x < platform.x + platform.width;
        const crossedTop = previousBottom <= platform.y && game.y + PLAYER_HEIGHT >= platform.y;
        if (game.velocityY >= 0 && overlapsX && crossedTop) {
          game.y = platform.y - PLAYER_HEIGHT;
          game.velocityY = 0;
          game.onGround = true;
          break;
        }
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
      } else if (game.x + PLAYER_WIDTH >= LEVEL_END - 52) {
        game.status = "won";
        statusRef.current = "won";
        setStatus("won");
      }
    };

    const render = (time: number) => {
      const delta = lastTime === 0 ? 1 : Math.min((time - lastTime) / 16.67, 2.5);
      lastTime = time;
      update(delta);
      drawScene(context, gameRef.current);

      if (time - hudTime > 120) {
        const game = gameRef.current;
        setHud({
          progress: Math.min(100, Math.floor((game.x / LEVEL_END) * 100)),
          coins: game.collected.size,
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
          setHud({ progress: 0, coins: 0 });
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
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

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
          <p className="runner-description">Pequeños pasos, grandes saltos. Cruza las grietas y llega a la bandera.</p>
        </div>

        <div className="runner-frame">
          <div className="runner-hud" aria-live="polite">
            <span>PROGRESO <strong>{hud.progress}%</strong></span>
            <div className="runner-progress" aria-label={`Progreso: ${hud.progress}%`}>
              <i style={{ width: `${hud.progress}%` }} />
            </div>
            <span>MONEDAS <strong>{hud.coins}/{coins.length}</strong></span>
          </div>
          <div className="runner-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="runner-canvas"
              width={VIEW_WIDTH}
              height={VIEW_HEIGHT}
              role="img"
              aria-label="Juego de plataformas Pixel Runner. Usa las flechas para moverte y la barra espaciadora para saltar."
            />
            {overlay && (
              <div className="runner-overlay">
                <h2>{status === "won" ? "¡NIVEL COMPLETADO!" : status === "lost" ? "¡UPS, CAÍSTE!" : "¿LISTO PARA SALTAR?"}</h2>
                <p>
                  {status === "won"
                    ? `Llegaste a la bandera y recogiste ${hud.coins} monedas.`
                    : status === "lost"
                      ? "Los huecos son traicioneros. Inténtalo de nuevo y calcula bien el salto."
                      : "Avanza por las plataformas, esquiva los huecos y recoge monedas en el camino."}
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
            <span>OBJETIVO <kbd>🏁</kbd> LLEGA A LA BANDERA</span>
          </div>
        </div>
        <p className="runner-tip">Consejo: mantén una dirección mientras saltas para cruzar los huecos largos.</p>
      </section>
    </main>
  );
}
