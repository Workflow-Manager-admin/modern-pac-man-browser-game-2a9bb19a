import React, { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";

/*
COLOR SCHEME:
  primary:   #FCE205 (yellow)
  secondary: #22254A (deep blue/purple)
  accent:    #00AEEF (arcade cyan blue)
Modern retro arcade-inspired.
*/

// Sound data URIs for basic effects (waka, eat ghost, die, start)
const sounds = {
  waka:
    "data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YVBkAAQAAAAAAgAAAAAAAgAAAAMAAwADAAIBAAMAAAAAAAAA",
  eatghost:
    "data:audio/wav;base64,UklGRlAAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YVBUAAQAAAAAAAEAAQABAAEAAwADAAUABQAGAAcACAAJAAoACwAMAA==",
  die:
    "data:audio/wav;base64,UklGRhIAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YWUAAAAAAQDA+P7w/IP9AAAAAEAAAAgAAAwAAgAAAAA=",
  start:
    "data:audio/wav;base64,UklGRjgAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YWhsAAQAAAAEAAEAAAAAAAEAAQAAAwAAAgABAAMABQAGAAcACAAJAAoACwAMAA==",
};

// PUBLIC_INTERFACE
function playSound(key) {
  // Play a short base64 audio clip
  if (!sounds[key]) return;
  const audio = new window.Audio(sounds[key]);
  audio.volume = 0.5;
  audio.play();
}

// --- Board Definitions ---
// 0 = empty/walkable, 1 = wall, 2 = dot, 3 = energizer, 4 = ghost house entrance, 5 = empty no pellet.
// Basic Pac-Man board (simplified, 17x19 - near classic size, slightly shrunken for less code).
// Ghost house: lines 9, 10, 11.
const DEFAULT_BOARD = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,3,2,2,2,1,2,2,2,1,2,2,2,1,2,3,1],
  [1,2,1,1,2,1,2,1,2,1,2,1,1,1,2,2,1],
  [1,2,1,1,2,2,2,1,2,1,2,2,2,1,2,2,1],
  [1,2,2,2,2,1,2,2,2,1,2,1,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,2,1,2,1,1,2,1],
  [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
  [1,2,1,1,2,1,1,4,4,4,1,1,2,1,1,2,1],
  [1,2,2,2,2,1,2,4,5,4,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,2,4,4,4,2,1,2,1,1,1,1],
  [1,1,1,1,2,1,2,1,1,1,2,1,2,1,1,1,1],
  [1,2,2,2,2,1,2,2,2,2,2,1,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,1,1,1,1,2,1,1,2,1],
  [1,2,2,1,2,2,2,2,2,2,2,2,2,1,2,2,1],
  [1,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,1],
  [1,3,2,2,2,1,2,2,2,1,2,2,2,2,2,3,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // empty row (for margin top/bottom)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
// Board rows: 19 (last two for padding for phone controls etc.), cols: 17

const BOARD_HEIGHT = DEFAULT_BOARD.length;
const BOARD_WIDTH = DEFAULT_BOARD[0].length;

const TILE_SIZE_DESKTOP = 32; // px
const TILE_SIZE_MOBILE = 20; // px

const DIRS = {
  LEFT: { dx: -1, dy: 0 },
  UP: { dx: 0, dy: -1 },
  RIGHT: { dx: +1, dy: 0 },
  DOWN: { dx: 0, dy: +1 },
};
const DIR_KEYS = {
  ArrowLeft: "LEFT",
  KeyA: "LEFT",
  ArrowUp: "UP",
  KeyW: "UP",
  ArrowRight: "RIGHT",
  KeyD: "RIGHT",
  ArrowDown: "DOWN",
  KeyS: "DOWN",
};

function deepCopy2d(arr) {
  return arr.map(r => [...r]);
}
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- ENTITY LOGIC ---
const GHOST_COLORS = ["#00AEEF", "#FF4B6E", "#FE8C3D", "#50FA7B"]; // cyan, pink, orange, green(alt), Blinky is always red!
const GHOST_NAMES = ["Blinky", "Pinky", "Inky", "Clyde"];
const GHOST_INIT = [
  {row: 9, col: 7}, // spawn in/out ghost house
  {row: 9, col: 8},
  {row: 9, col: 9},
  {row: 9, col: 10},
];

// Helper to make directions array
const DIR_ORDER = ["LEFT","UP","RIGHT","DOWN"];

function posEquals(a,b) {
  return a.row === b.row && a.col === b.col;
}
// --- PAC-MAN GAME LOGIC ---

// Move inside board logic (wraparound, wall check)
function getNextPos(pos, dir, board) {
  let { row, col } = pos;
  let { dx, dy } = DIRS[dir];
  let nrow = (row + dy + BOARD_HEIGHT) % BOARD_HEIGHT;
  let ncol = (col + dx + BOARD_WIDTH) % BOARD_WIDTH;
  if (board[nrow] && board[nrow][ncol] !== 1) {
    return { row: nrow, col: ncol };
  }
  return pos; // can't move through walls
}

// --- REACT Pac-Man Game ---
function PacManGame({ theme, colorScheme }) {
  // Board and game state
  const [board, setBoard] = useState(() => deepCopy2d(DEFAULT_BOARD));
  const [pacman, setPacman] = useState({ row: 15, col: 8, dir: "LEFT", mouth: 0 });
  const [ghosts, setGhosts] = useState(() => [
    ...GHOST_INIT.map((pos, i) => ({
      ...pos,
      dir: "UP",
      color: i === 0 ? "#FF2B2B" : GHOST_COLORS[i % GHOST_COLORS.length],
      name: GHOST_NAMES[i],
      scatter: false,
      frightened: false,
      dead: false,
    }))
  ]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [dotsLeft, setDotsLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [frightenedTimer, setFrightenedTimer] = useState(0);
  const [message, setMessage] = useState("");

  const [tileSize, setTileSize] = useState(window.innerWidth < 600 ? TILE_SIZE_MOBILE : TILE_SIZE_DESKTOP);

  const moveInt = useRef();
  const boardRef = useRef(board);

  // For instructions/touch controls: allow move by button
  const handleButtonMove = dir => {
    setPacman(pm => {
      // only update direction if tile ahead is not wall
      let npos = getNextPos(pm, dir, boardRef.current);
      return {
        ...pm,
        dir: dir,
        row: npos.row,
        col: npos.col,
      };
    });
  };

  // --- GAME LOOP ---
  const nextFrame = useCallback(() => {
    setPacman(pm => {
      // Animate mouth
      let nextMouth = (pm.mouth + 0.2) % 2;
      // Determine next position
      let npos = getNextPos(pm, pm.dir, boardRef.current);
      // Try eat dot or energizer
      setBoard(oldBoard => {
        let newBoard = deepCopy2d(oldBoard);
        let currTile = newBoard[npos.row][npos.col];
        if (currTile === 2) {
          playSound("waka");
          newBoard[npos.row][npos.col] = 0;
          setScore(s => s + 10);
          setDotsLeft(d => d - 1);
        } else if (currTile === 3) {
          playSound("waka");
          newBoard[npos.row][npos.col] = 0;
          setScore(s => s + 50);
          setFrightenedTimer(50); // 50 frames ~ 5s
        }
        return newBoard;
      });
      return {
        ...pm,
        row: npos.row,
        col: npos.col,
        mouth: nextMouth,
      };
    });

    // GHOSTS MOVE
    setGhosts(gs => {
      return gs.map((ghost, idx) => {
        if (ghost.dead) {
          // Dead -> return to ghost house
          let orig = GHOST_INIT[idx];
          let dist = Math.abs(ghost.row - orig.row) + Math.abs(ghost.col - orig.col);
          if (dist === 0) {
            // revive inside house
            return { ...ghost, dead: false, frightened: false, scatter: false };
          }
          return moveGhostToward(ghost, orig, boardRef.current, true);
        }
        let frightened = frightenedTimer > 0 && idx !== 0; // Blinky never frightened
        return ghostLogic(ghost, idx, pacman, boardRef.current, frightened);
      });
    });

    // Dot count/win check
    if (!win && !gameOver) {
      let pelletCount = boardRef.current.flat().filter(x => x === 2 || x === 3).length;
      setDotsLeft(pelletCount);
      if (pelletCount === 0) {
        setWin(true);
        setPaused(true);
        setMessage("YOU WIN!");
      }
    }

  }, [frightenedTimer, pacman, win, gameOver]);

  // Track board updates for reference
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Ghost collision / eating / lose logic
  useEffect(() => {
    if (!started || gameOver) return;
    let pac = pacman;
    ghosts.forEach((g, idx) => {
      if (
        posEquals(g, pac) &&
        !g.dead &&
        !gameOver
      ) {
        if (frightenedTimer > 0 && idx !== 0) {
          // eat ghost
          playSound("eatghost");
          setScore(s => s + 200);
          setGhosts(gs =>
            gs.map((gg, i) =>
              i === idx ? { ...gg, dead: true, frightened: false } : gg
            ),
          );
        } else if (!g.frightened) {
          // Dead!
          playSound("die");
          setLives(lv => {
            if (lv > 1) {
              setPaused(true);
              setMessage("Ouch! Press Resume or [Space]");
              setTimeout(() => {
                resetLevel();
                setPaused(false);
                setMessage("");
              }, 1500);
            } else {
              setGameOver(true);
              setPaused(true);
              setMessage("Game Over");
            }
            return lv - 1;
          });
        }
      }
    });
    // eslint-disable-next-line
  }, [pacman, ghosts, frightenedTimer, gameOver, started]);

  // --- Frightened timer handling ---
  useEffect(() => {
    if (frightenedTimer > 0) {
      let timer = setTimeout(() => setFrightenedTimer(fr => fr - 1), 100);
      return () => clearTimeout(timer);
    }
  }, [frightenedTimer]);

  // KEYBOARD CONTROLS
  useEffect(() => {
    const keyHandler = e => {
      if (e.repeat) return;
      let key = e.code || e.key;
      if (DIR_KEYS[key]) {
        setPacman(pm => ({
          ...pm,
          dir: DIR_KEYS[key],
        }));
      }
      if (key === "Space") {
        setPaused(p => {
          if (gameOver || win) return p;
          if (!started) {
            startGame();
            return false;
          }
          return !p;
        });
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener("keydown", keyHandler);
    };
    // eslint-disable-next-line
  }, [started, gameOver, win]);

  // BOARD SIZE RESPONSIVENESS
  useEffect(() => {
    const handleResize = () => {
      setTileSize(window.innerWidth < 600 ? TILE_SIZE_MOBILE : TILE_SIZE_DESKTOP);
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // GAME LOOP TIMER
  useEffect(() => {
    if (!started || paused || gameOver || win) return;
    moveInt.current = setInterval(nextFrame, 120);
    return () => clearInterval(moveInt.current);
  }, [started, paused, nextFrame, gameOver, win]);

  // Count pellets to start
  useEffect(() => {
    let pelletCount = board.flat().filter(x => x === 2 || x === 3).length;
    setDotsLeft(pelletCount);
  }, [board]);

  // ---- GAME CONTROL ACTIONS ----
  function startGame() {
    setStarted(true);
    setPaused(false);
    setGameOver(false);
    setWin(false);
    setScore(0);
    setLives(3);
    setMessage("");
    setPacman({ row: 15, col: 8, dir: "LEFT", mouth: 0 });
    setGhosts(() =>
      GHOST_INIT.map((pos, i) => ({
        ...pos,
        dir: "UP",
        color: i === 0 ? "#FF2B2B" : GHOST_COLORS[i % GHOST_COLORS.length],
        name: GHOST_NAMES[i],
        scatter: false,
        frightened: false,
        dead: false,
      }))
    );
    setBoard(deepCopy2d(DEFAULT_BOARD));
    playSound("start");
  }
  function resetLevel() {
    setPacman({ row: 15, col: 8, dir: "LEFT", mouth: 0 });
    setGhosts(() =>
      GHOST_INIT.map((pos, i) => ({
        ...pos,
        dir: "UP",
        color: i === 0 ? "#FF2B2B" : GHOST_COLORS[i % GHOST_COLORS.length],
        name: GHOST_NAMES[i],
        scatter: false,
        frightened: false,
        dead: false,
      }))
    );
    setFrightenedTimer(0);
    setPaused(false);
  }

  // Render helpers
  function renderTile(cell, rowI, colI) {
    let size = tileSize;
    let style = {
      width: size,
      height: size,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    };
    // wall
    if (cell === 1) {
      return (
        <div
          className="pac-tile wall"
          style={{
            ...style,
            background: colorScheme.secondary,
            border: `2px solid ${colorScheme.accent}`,
            borderRadius: 6,
            boxShadow: `0 0 3px ${colorScheme.accent}`,
          }}
        />
      );
    }
    // dot
    if (cell === 2) {
      return (
        <div className="pac-tile dot" style={style}>
          <div
            style={{
              width: size * 0.18,
              height: size * 0.18,
              borderRadius: "50%",
              background: colorScheme.primary,
              boxShadow: `0 0 8px 1px ${colorScheme.primary}`,
            }}
          />
        </div>
      );
    }
    // energizer
    if (cell === 3) {
      return (
        <div className="pac-tile energizer" style={style}>
          <div
            style={{
              width: size * 0.32,
              height: size * 0.32,
              borderRadius: "50%",
              background: colorScheme.accent,
              border: `2px solid ${colorScheme.primary}`,
              boxShadow: `0 0 8px 4px ${colorScheme.accent}`,
            }}
          />
        </div>
      );
    }
    // ghost house
    if (cell === 4 || cell === 5) {
      return (
        <div
          className="pac-tile house"
          style={{
            ...style,
            background: "rgba(0,0,0,0.08)",
            border: `1px dashed ${colorScheme.accent}`,
            borderRadius: 4,
          }}
        ></div>
      );
    }
    // empty
    return <div className="pac-tile empty" style={style}></div>;
  }

  // Entities on top of tile
  function renderEntities(row, col) {
    let size = tileSize;
    // Pac-Man
    if (row === pacman.row && col === pacman.col) {
      const mouthAngle = Math.abs(Math.sin(pacman.mouth * Math.PI)) * 36 + 10;
      const rotate = {
        LEFT: 180,
        RIGHT: 0,
        UP: 270,
        DOWN: 90,
      };
      return (
        <svg
          width={size}
          height={size}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            zIndex: 2,
          }}
        >
          <g>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.48}
              fill={colorScheme.primary}
              stroke="#e7d300"
              strokeWidth="2"
            />
            <path
              d={describePacmanMouth(
                size / 2,
                size / 2,
                size * 0.48,
                pacman.dir,
                mouthAngle
              )}
              fill="white"
              />
          </g>
        </svg>
      );
    }
    // Ghosts
    return ghosts.map((g, idx) => {
      if (g.row === row && g.col === col && !g.dead) {
        let main = frightenedTimer > 0 && idx !== 0 ? "#fff" : g.color;
        let eye = frightenedTimer > 0 && idx !== 0 ? "#111" : "#fff";
        let ghostStyle = {
          position: "absolute",
          width: size * 0.94,
          height: size * 0.94,
          left: size * 0.03,
          top: size * 0.01,
          zIndex: 2,
          filter: frightenedTimer > 0 && idx !== 0 ? "drop-shadow(0 0 8px #00aeef)" : "",
        };
        return (
          <svg width={size} height={size} style={ghostStyle} key={idx}>
            {/* Body */}
            <ellipse
              cx={size * 0.5}
              cy={size * 0.52}
              rx={size * 0.40}
              ry={size * 0.40}
              fill={main}
              stroke="#222"
              strokeWidth="2"
              />
            <rect
              x={size * 0.1}
              y={size * 0.52}
              width={size * 0.8}
              height={size * 0.33}
              fill={main}
              />
            <circle cx={size * 0.34} cy={size * 0.54} r={size * 0.08} fill={eye} />
            <circle cx={size * 0.66} cy={size * 0.54} r={size * 0.08} fill={eye} />
            {/* Wavy base */}
            <path
              d={`
                M ${size * 0.1} ${size * 0.85}
                Q ${size * 0.19} ${size * 0.8}, ${size * 0.28} ${size * 0.86}
                Q ${size * 0.37} ${size * 0.8}, ${size * 0.45} ${size * 0.86}
                Q ${size * 0.53} ${size * 0.8}, ${size * 0.62} ${size * 0.86}
                Q ${size * 0.71} ${size * 0.8}, ${size * 0.8} ${size * 0.85}
                `}
              fill={main}
            />
          </svg>
        );
      }
      return null;
    });
  }

  // --- Main gameboard render
  return (
    <div className="game-root" style={{ padding: 0 }}>
      {/* Scoreboard */}
      <div className="scoreboard" style={{
        background: colorScheme.secondary,
        color: "#fff",
        margin: "0 auto",
        padding: "0.7rem 1.2rem",
        borderRadius: "1rem 1rem 0 0",
        width: tileSize * BOARD_WIDTH,
        maxWidth: "100vw",
        display: "flex",
        justifyContent: "space-between",
        fontFamily: "monospace",
        letterSpacing: 1,
        fontSize: tileSize < 25 ? 16 : 22,
        borderBottom: `2px solid ${colorScheme.accent}`,
        boxShadow: `0 2px 6px rgba(0,0,0,0.12)`
      }}>
        <span>Score: {score}</span>
        <span>Lives: {"💛".repeat(lives > 0 ? lives : 0)}</span>
        <span>{dotsLeft <= 0 ? "Victory!" : `Dots: ${dotsLeft}`}</span>
      </div>
      {/* Center game board */}
      <div
        className="game-board"
        style={{
          display: "inline-block",
          margin: "0 auto 12px auto",
          padding: tileSize * 0.16,
          background: colorScheme.secondary,
          boxShadow: `0 6px 24px -2px #1117, 0 0 0 4px ${colorScheme.accent}`,
          borderRadius: 20,
          userSelect: "none",
          position: "relative",
        }}
        tabIndex={0}
        aria-label="Pac-Man game board"
      >
        {/* Render game board */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, ${tileSize}px)`,
            gridTemplateRows: `repeat(${BOARD_HEIGHT}, ${tileSize}px)`,
            width: tileSize * BOARD_WIDTH,
            height: tileSize * BOARD_HEIGHT,
            touchAction: "none",
          }}
        >
          {board.map((row, rowI) =>
            row.map((cell, colI) => (
              <div key={rowI + "-" + colI} style={{ position: "relative" }}>
                {renderTile(cell, rowI, colI)}
                {renderEntities(rowI, colI)}
              </div>
            ))
          )}
        </div>
        {paused && (
          <div
            className="game-overlay"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: tileSize * BOARD_WIDTH,
              height: tileSize * BOARD_HEIGHT,
              background: `rgba(20,23,50,0.77)`,
              color: "#fff",
              fontSize: tileSize < 25 ? 20 : 32,
              fontWeight: 900,
              letterSpacing: "2px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              zIndex: 10,
              textShadow: "0 2px 12px #000d, 0 0 16px #00aeef88"
            }}
            aria-label="Game paused"
          >
            {win
              ? "🎉 YOU WIN! 🎉"
              : gameOver
                ? "Game Over"
                : "PAUSED"}<br/>
            <span style={{ fontSize: 18, fontWeight: 600, marginTop: 15 }}>
              {message}
            </span>
            {(paused && !gameOver && !win) && (
              <button
                className="control-btn"
                onClick={() => setPaused(false)}
                style={{
                  marginTop: 28,
                  background: colorScheme.accent,
                  color: "#fff",
                  border: "none",
                  padding: "0.6em 2.5em",
                  fontSize: 20,
                  borderRadius: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 21px #009fed77",
                }}
              >
                ▶ Resume
              </button>
            )}
            {(gameOver || win) && (
              <button
                className="control-btn"
                style={{
                  marginTop: 22,
                  background: colorScheme.primary,
                  color: colorScheme.secondary,
                  border: "none",
                  padding: "0.6em 2.5em",
                  fontSize: 20,
                  fontWeight: 700,
                  borderRadius: 16,
                  cursor: "pointer",
                  boxShadow: "0 1px 10px #fce20555",
                  textShadow: "none",
                }}
                onClick={startGame}
              >Play again</button>
            )}
          </div>
        )}
        {/* Mobile touch controls */}
        {tileSize === TILE_SIZE_MOBILE && (
          <div className="mobile-controls"
          style={{
            position:"absolute",
            left:0, right:0,
            bottom: -tileSize*2,
            display:"flex",
            flexDirection:"row",
            width: tileSize*BOARD_WIDTH,
            justifyContent:"space-around"
          }}>
            <button aria-label="Left" className="control-btn" onClick={()=>handleButtonMove("LEFT")}>⬅</button>
            <button aria-label="Up" className="control-btn" onClick={()=>handleButtonMove("UP")}>⬆</button>
            <button aria-label="Down" className="control-btn" onClick={()=>handleButtonMove("DOWN")}>⬇</button>
            <button aria-label="Right" className="control-btn" onClick={()=>handleButtonMove("RIGHT")}>➡</button>
            <button aria-label="Pause" className="control-btn" onClick={()=>setPaused(p=>!p)}>{paused ? "▶":"⏸"}</button>
          </div>
        )}
      </div>
      {/* Controls & Instructions */}
      <div className="instructions"
        style={{
          maxWidth: tileSize*BOARD_WIDTH,
          margin: "0 auto 1.7rem auto",
          background: "#f7fafc",
          borderRadius: 12,
          boxShadow: `0 2px 12px rgba(34,37,74,0.16)`,
          padding: "1.2em 1.6em",
          textAlign: "center",
          fontWeight: 500,
          fontSize: tileSize < 25 ? 13 : 17,
          color: colorScheme.secondary
        }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: colorScheme.accent, letterSpacing:2 }}>
          HOW TO PLAY:
        </span>
        <div style={{ margin: "0.9em auto 0.2em auto", color: colorScheme.secondary, fontWeight: 470 }}>
          Use <b>Arrow keys</b> [← ↑ → ↓] or WASD to move Pac-Man.<br/>
          <span style={{color:colorScheme.accent}}>Spacebar</span> (<kbd>⎵</kbd>) to Pause/Resume.
          <br/>
          <span style={{fontSize:15,display:"block",margin:'0.7em auto 0',color:colorScheme.primary}}>
            Eat all <b>dots</b> <span style={{color:colorScheme.primary}}>●</span> and <b>energizers</b> <span style={{color:colorScheme.accent}}>◉</span>.<br/>
            Don't get caught by the ghosts!
            <br/>Eat an energizer to turn ghosts edible.
          </span>
        </div>
        <div style={{marginTop:7, color:colorScheme.accent,fontSize:tileSize < 25 ? 12 : 15}}>
          {tileSize === TILE_SIZE_MOBILE && "On mobile, use the on-screen arrows."}
        </div>
      </div>
      <footer style={{
        color:'#bbb', fontWeight:500,
        fontSize:12,
        margin:"0 0 13px 0",
        letterSpacing:1,
        textAlign:"center"
      }}>
        © {new Date().getFullYear()} Pac-Man Modern · Made for your browser!
      </footer>
    </div>
  );
}

// SVG art for Pac-Man open mouth
function describePacmanMouth(cx, cy, r, dir, mouthAngle) {
  // Determine mouth direction (start/end angles for SVG arc)
  let base = ({LEFT:180,UP:270,RIGHT:0,DOWN:90})[dir] || 0;
  const ANGLE = mouthAngle || 40; // degrees
  let start = ((base + ANGLE/2) * Math.PI) / 180;
  let end = ((base - ANGLE/2 + 360) * Math.PI) / 180;
  // SVG arc sweep
  let x1 = cx + r * Math.cos(start);
  let y1 = cy + r * Math.sin(start);
  let x2 = cx + r * Math.cos(end);
  let y2 = cy + r * Math.sin(end);
  return `
    M ${cx} ${cy}
    L ${x1} ${y1}
    A ${r} ${r} 0 0 1 ${x2} ${y2}
    Z
  `;
}

// --- GHOST AI Logic ---
function ghostLogic(ghost, idx, pacman, board, frightened) {
  // Dead ghosts return home
  if (ghost.dead) return ghost;
  // Scatter periodically (not strictly classic, but adds randomness)
  const scatter = Math.random() < 0.03 && !frightened;
  // If frightened, move randomly
  if (frightened) {
    return randomMoveGhost(ghost, board);
  }
  // Target-chase:
  // Blinky: targets Pac-Man's current tile (classic)
  // Pinky: targets tile ahead of Pac-Man
  // Inky: targets mirrored tile relative to Pac-Man
  // Clyde: scatter mode to lower left
  let target;
  if (idx === 0) {
    // Blinky (red): directly chases Pac-Man
    target = { row: pacman.row, col: pacman.col };
  } else if (idx === 1) {
    // Pinky: 2 ahead in direction
    let next = pacman;
    for (let i = 0; i < 2; ++i) {
      next = getNextPos(next, pacman.dir, board);
    }
    target = { row: next.row, col: next.col };
  } else if (idx === 2) {
    // Inky: go to opposite tile
    target = {
      row: BOARD_HEIGHT - 1 - pacman.row,
      col: BOARD_WIDTH - 1 - pacman.col,
    };
  } else if (idx === 3) {
    // Clyde: scatter corner
    target = scatter
      ? { row: BOARD_HEIGHT - 2, col: 1 }
      : { row: pacman.row, col: pacman.col };
  }

  return moveGhostToward(ghost, target, board);
}

function moveGhostToward(ghost, target, board, ignoreWalls=false) {
  let candidates = DIR_ORDER.map(dir => {
    let np = getNextPos(ghost, dir, board);
    // Can't instantly reverse unless at junction (classic rule - omitted for brevity)
    // Prevent walk into wall unless ignoreWalls is true (when dead)
    if ((ignoreWalls || board[np.row][np.col] !== 1) && !posEquals(np, ghost)) {
      // Favor directions toward target
      let dist =
        Math.abs(target.row - np.row) + Math.abs(target.col - np.col);
      return { dir, np, dist };
    }
    return null;
  }).filter(Boolean);

  // Sort by distance
  candidates.sort((a, b) => a.dist - b.dist);
  let move = candidates[0] || {dir: ghost.dir, np: ghost};
  return { ...ghost, ...move.np, dir: move.dir };
}

function randomMoveGhost(ghost, board) {
  // pick random allowed dir
  let choices = [];
  for (let d of DIR_ORDER) {
    let np = getNextPos(ghost, d, board);
    if (board[np.row][np.col] !== 1 && !posEquals(np, ghost)) choices.push({ dir: d, np });
  }
  if (choices.length === 0) return ghost;
  let move = randomFrom(choices);
  return { ...ghost, ...move.np, dir: move.dir, frightened: true };
}

// --- Main App Wrapper ---
function App() {
  // Theme color scheme
  const colorScheme = {
    primary: "#FCE205",
    secondary: "#22254A",
    accent: "#00AEEF"
  };
  const [theme, setTheme] = useState("light");
  // Theme switch - use color variables for App.css compatibility
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === "light" ? "dark" : "light"));
  };

  // PUBLIC_INTERFACE
  return (
    <div className="App" style={{background: "#f8fafb", minHeight:"100vh"}}>
      <header className="App-header"
        style={{
          position:"relative",
          padding:"1.5rem 0 0.3rem 0",
          background: "linear-gradient(to top, #22254A 0%, #22254A 70%, #2e3365 100%)",
          boxShadow: "0 2px 22px #22254a44",
          marginBottom:"-2.5rem"
        }}>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          style={{
            zIndex:20,
            background: "#00AEEF",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            position: "absolute",
            top: 14,
            right: 16,
            boxShadow: "0 2px 4px rgba(0,0,0,0.11)",
          }}
        >
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
        <h1 style={{
          fontFamily:"'Press Start 2P', monospace, system-ui",
          color: colorScheme.primary,
          fontSize:"2.2rem",
          textShadow:"2px 4px 6px #222,0 0 24px #00aeef99",
          marginTop:"0.1em"
        }}>PAC-MAN.ARCADE</h1>
        <p style={{
          color: colorScheme.accent,
          fontWeight: 500,
          fontFamily: "monospace",
          fontSize: 17,
          marginTop: -12,
          marginBottom: 0,
          letterSpacing: 2,
          textShadow:"0 2px 10px #fff9"
        }}>
          A modern retro browser game
        </p>
      </header>
      <main>
        <PacManGame theme={theme} colorScheme={colorScheme}/>
      </main>
    </div>
  );
}

export default App;
