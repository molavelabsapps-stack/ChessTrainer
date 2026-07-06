const data = window.CHESS_LIBRARY_DATA || { books: [], tactics: [], games: [], generatedAt: "" };

// Initialize chess.js instance
const chess = typeof Chess !== 'undefined' ? new Chess() : null;

// PDF.js state
let pdfDoc = null;
let currentPageNum = 1;
let currentBookPath = null;

// EPUB.js state
let epubBook = null;
let epubRendition = null;
let currentEpubLocation = null;

const state = {
  activeTab: "dashboard",
  puzzleIndex: 0,
  flipped: false,
  selectedSquare: null,
  boardPosition: null,
  marks: JSON.parse(localStorage.getItem("chessLibraryTrainer.marks") || "{}"),
  planSeed: Number(localStorage.getItem("chessLibraryTrainer.planSeed") || "0"),
  currentGame: null,
  currentMoveIndex: -1,
  gameHistory: [],
  libraryBoardChess: typeof Chess !== 'undefined' ? new Chess() : null,
  // Stockfish engine state
  stockfish: null,
  engineAnalysis: null,
  isAnalyzing: false,
  evaluationScore: 0,
  bestMove: null,
  principalVariation: [],
  // Guess the Move mode state
  guessTheMoveMode: false,
  userGuesses: [],
  currentGamePGN: '',
};

// High-quality SVG chess piece images from Wikimedia Commons (public domain)
const pieceImages = {
  K: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
  Q: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
  R: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
  B: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
  N: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
  P: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg",
  k: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
  q: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
  r: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
  b: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
  n: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
  p: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg",
};

const pieces = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

const themeCopy = {
  Tactics: ["TX", "Pattern recognition, sacrifices, forcing moves"],
  Endgames: ["EG", "Conversion, defense, technical positions"],
  Openings: ["OP", "Repertoires, structures, move orders"],
  Strategy: ["ST", "Plans, imbalances, positional decisions"],
  Calculation: ["CA", "Candidate moves, visualization, discipline"],
  Games: ["GM", "Annotated games and model play"],
  Beginner: ["BG", "Rules, fundamentals, early study"],
  Analytics: ["AN", "Engines, data, digital chess"],
  Reference: ["RF", "General reference and mixed material"],
};

function saveMarks() {
  localStorage.setItem("chessLibraryTrainer.marks", JSON.stringify(state.marks));
}

function byId(id) {
  return document.getElementById(id);
}

function titleCaseName(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/^vdoc\.pub_|^pdfcoffee\.com_|^_/, "")
    .replace(/\+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\bpdf free\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "Other";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function seededIndex(length, offset = 0) {
  if (!length) return 0;
  const today = new Date();
  const daySeed = Math.floor(today.getTime() / 86400000) + state.planSeed + offset * 37;
  return Math.abs(daySeed * 9301 + 49297) % length;
}

function setTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab-button").forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("is-active", view.id === tab));
}

function renderStats() {
  const themeCounts = countBy(data.books, "theme");
  const formats = countBy(data.books, "format");
  const totalMb = data.books.reduce((sum, book) => sum + (book.size || 0), 0) / 1024 / 1024;
  const cards = [
    ["Books & files", data.books.length, "PDFs, EPUBs, PGNs, images"],
    ["Tactics FENs", data.tactics.length, "From 1001 combinations"],
    ["PGN games", data.games.length, "Model games and studies"],
    ["Library size", `${Math.round(totalMb)} MB`, `${Object.keys(themeCounts).length} study themes`],
  ];
  byId("statGrid").innerHTML = cards
    .map(([label, value, note]) => `<article class="stat-card"><strong>${value}</strong><span>${label}</span><p class="muted">${note}</p></article>`)
    .join("");

  const formatLabel = Object.entries(formats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([format, count]) => `${count} ${format}`)
    .join(", ");
  byId("collectionTitle").textContent = `${data.books.length} files indexed: ${formatLabel}`;
}

function renderDailyPlan() {
  const themes = ["Tactics", "Calculation", "Endgames", "Openings", "Strategy"];
  const blocks = themes.map((theme, index) => {
    const pool = data.books.filter((book) => book.theme === theme);
    const fallback = data.books.filter((book) => book.theme !== "Reference");
    const source = pool[seededIndex(pool.length, index)] || fallback[seededIndex(fallback.length, index)] || data.books[0];
    const [icon, note] = themeCopy[theme] || themeCopy.Reference;
    return {
      theme,
      icon,
      note,
      source,
      duration: [10, 15, 12, 18, 20][index],
    };
  });

  const blockHtml = blocks
    .map(
      (block) => `
        <article class="plan-item">
          <div class="plan-icon">${block.icon}</div>
          <div>
            <strong>${block.duration} min ${block.theme}</strong>
            <span>${block.note}</span>
            <p class="muted">${block.source ? titleCaseName(block.source.name) : "Collection review"}</p>
          </div>
        </article>
      `,
    )
    .join("");

  byId("dailyPlan").innerHTML = blockHtml;
  byId("trainingBlocks").innerHTML = blockHtml;
  byId("dailyMixMini").innerHTML = blocks
    .slice(0, 4)
    .map((block) => `<article class="mini-item"><strong>${block.theme}</strong><span>${block.duration} minutes</span></article>`)
    .join("");
}

function parseFen(fen) {
  const [placement] = fen.split(" ");
  return placement.split("/").map((rank) => {
    const row = [];
    for (const char of rank) {
      if (/\d/.test(char)) {
        for (let i = 0; i < Number(char); i += 1) row.push("");
      } else {
        row.push(char);
      }
    }
    return row;
  });
}

// Get legal moves for a position using chess.js
function getLegalMoves(fen) {
  if (!chess) return [];
  try {
    chess.load(fen);
    const moves = chess.moves({ square: state.selectedSquare ? squareName(state.selectedSquare.row, state.selectedSquare.col) : undefined, verbose: true });
    return moves.map(move => ({
      from: move.from,
      to: move.to,
      flags: move.flags,
      piece: move.piece,
      color: move.color
    }));
  } catch (e) {
    return [];
  }
}

// Convert algebraic notation (e.g., "e4") to row/col
function algebraicToRowCol(algebraic) {
  const file = algebraic.charCodeAt(0) - "a".charCodeAt(0);
  const rank = 8 - parseInt(algebraic[1], 10);
  return { row: rank, col: file };
}

// Convert row/col to algebraic notation
function rowColToAlgebraic(row, col) {
  const file = String.fromCharCode("a".charCodeAt(0) + col);
  const rank = 8 - row;
  return `${file}${rank}`;
}

// Load a PGN game into the board
function loadGame(gameData) {
  if (!chess) return;
  state.currentGame = gameData;
  state.gameHistory = [];
  state.userGuesses = [];
  guessTheMoveMode = false;
  
  try {
    chess.load_pgn(gameData.moves);
    const history = chess.history({ verbose: true });
    state.gameHistory = history;
    state.currentGamePGN = gameData.moves;
    chess.reset();
    
    // Load moves one by one to build position history
    const tempChess = new Chess();
    const positions = [tempChess.fen()];
    
    for (const move of history) {
      tempChess.move(move);
      positions.push(tempChess.fen());
    }
    
    state.currentMoveIndex = 0;
    loadPositionFromFen(positions[0]);
    renderGameViewer();
    
    // Reset engine analysis state
    stopAnalysis();
    state.engineAnalysis = null;
    renderEngineAnalysis();
  } catch (e) {
    console.error("Error loading PGN:", e);
  }
}

// Load a specific FEN position on the board
function loadPositionFromFen(fen) {
  state.boardPosition = parseFen(fen);
  state.selectedSquare = null;
  renderBoard();
}

// Navigate through game moves
function goToMove(index) {
  if (!state.currentGame || !chess) return;
  
  const tempChess = new Chess();
  const maxIndex = state.gameHistory.length;
  
  state.currentMoveIndex = Math.max(0, Math.min(index, maxIndex));
  
  // Replay moves up to current index
  for (let i = 0; i < state.currentMoveIndex; i++) {
    tempChess.move(state.gameHistory[i]);
  }
  
  loadPositionFromFen(tempChess.fen());
  renderGameViewer();
  
  // Stop any ongoing analysis when moving to a new position
  stopAnalysis();
  state.engineAnalysis = null;
  renderEngineAnalysis();
}

// Toggle Guess the Move mode
function toggleGuessTheMove() {
  guessTheMoveMode = !guessTheMoveMode;
  state.userGuesses = [];
  
  const btn = byId('guessTheMoveButton');
  if (btn) {
    btn.classList.toggle('active', guessTheMoveMode);
    btn.textContent = guessTheMoveMode ? 'Exit Guess Mode' : 'Guess the Move';
  }
  
  // Reset to start of game when entering guess mode
  if (guessTheMoveMode) {
    goToMove(0);
    alert('Guess the Move mode activated! Try to guess each move in the game. Click on the board to make your guess, then use "Next" to see the actual move.');
  }
}

// Check user's guessed move against actual game move
function checkUserGuess(from, to, promotion = 'q') {
  if (!guessTheMoveMode || state.currentMoveIndex >= state.gameHistory.length) {
    return { correct: false, message: '' };
  }
  
  const actualMove = state.gameHistory[state.currentMoveIndex];
  const guessedMoveSan = `${from}${to}`;
  
  if (from === actualMove.from && to === actualMove.to) {
    state.userGuesses.push({ 
      moveNum: Math.floor(state.currentMoveIndex / 2) + 1,
      guessed: guessedMoveSan,
      actual: actualMove.san,
      correct: true 
    });
    return { correct: true, message: `Correct! The move was ${actualMove.san}` };
  } else {
    state.userGuesses.push({ 
      moveNum: Math.floor(state.currentMoveIndex / 2) + 1,
      guessed: guessedMoveSan,
      actual: actualMove.san,
      correct: false 
    });
    return { correct: false, message: `Incorrect. You guessed ${guessedMoveSan}, but the actual move was ${actualMove.san}` };
  }
}

function currentPuzzle() {
  return data.tactics[state.puzzleIndex] || data.tactics[0];
}

function resetBoardPosition() {
  const puzzle = currentPuzzle();
  state.boardPosition = parseFen(puzzle.fen);
  state.selectedSquare = null;
}

function squareName(row, col) {
  const file = String.fromCharCode("a".charCodeAt(0) + col);
  return `${file}${8 - row}`;
}

function renderBoard() {
  const puzzle = currentPuzzle();
  if (!state.boardPosition) resetBoardPosition();
  const rows = state.flipped ? [...state.boardPosition].reverse() : state.boardPosition;
  
  // Get legal moves if chess.js is available and we're in game mode
  let legalMoves = [];
  let lastMoveSquares = [];
  
  if (chess && state.currentGame) {
    try {
      const tempChess = new Chess(state.boardPositionToCurrentFen());
      legalMoves = tempChess.moves({ verbose: true });
      
      // Get last move for highlighting
      if (state.currentMoveIndex > 0 && state.gameHistory.length > 0) {
        const lastMove = state.gameHistory[state.currentMoveIndex - 1];
        lastMoveSquares = [lastMove.from, lastMove.to];
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  byId("chessBoard").innerHTML = rows
    .map((row, displayRow) => {
      const actualRow = state.flipped ? 7 - displayRow : displayRow;
      const cols = state.flipped ? [...row].reverse() : row;
      return cols
        .map((piece, displayCol) => {
          const actualCol = state.flipped ? 7 - displayCol : displayCol;
          const light = (actualRow + actualCol) % 2 === 0;
          const selected = state.selectedSquare && state.selectedSquare.row === actualRow && state.selectedSquare.col === actualCol;
          const coord = displayRow === 7 || displayCol === 0 ? `<span class="coord">${squareName(actualRow, actualCol)}</span>` : "";
          const pieceImg = piece && pieceImages[piece] ? `<img src="${pieceImages[piece]}" alt="${piece}" class="piece-img">` : "";
          
          // Check if this square is a legal move target
          const squareNameStr = squareName(actualRow, actualCol);
          const isLegalMove = legalMoves.some(move => move.to === squareNameStr);
          const isLastMove = lastMoveSquares.includes(squareNameStr);
          
          return `<button class="square ${light ? "light" : "dark"} ${selected ? "is-selected" : ""} ${isLegalMove ? "possible-move" : ""} ${isLastMove ? "last-move" : ""}" data-row="${actualRow}" data-col="${actualCol}" aria-label="${squareName(actualRow, actualCol)}">${pieceImg}${coord}</button>`;
        })
        .join("");
    })
    .join("");

  byId("boardSource").textContent = puzzle.source || "Tactics";
  byId("boardTitle").textContent = puzzle.event || "White to move";
  byId("sideToMove").textContent = puzzle.side === "b" ? "Black to move" : "White to move";
  byId("puzzleIndex").textContent = `${state.puzzleIndex + 1} / ${data.tactics.length}`;
  byId("positionPrompt").textContent = puzzle.prompt || "Find the strongest forcing move, then write down the continuation before checking yourself.";
  byId("puzzleJump").max = String(data.tactics.length || 1);
  byId("puzzleJump").value = String(state.puzzleIndex + 1);
  byId("puzzleJumpValue").textContent = String(state.puzzleIndex + 1);
}

// Helper to get FEN from current board position
function stateBoardPositionToCurrentFen() {
  if (!state.boardPosition) return chess?.fen() || '';
  
  let fen = '';
  for (let row = 0; row < 8; row++) {
    let empty = 0;
    for (let col = 0; col < 8; col++) {
      const piece = state.boardPosition[row][col];
      if (piece === '') {
        empty++;
      } else {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        fen += piece;
      }
    }
    if (empty > 0) fen += empty;
    if (row < 7) fen += '/';
  }
  
  // Add side to move and other FEN components (simplified)
  const puzzle = currentPuzzle();
  const side = puzzle?.side || 'w';
  return `${fen} ${side} - - 0 1`;
}

function handleSquareClick(event) {
  const button = event.target.closest(".square");
  if (!button) return;
  const row = Number(button.dataset.row);
  const col = Number(button.dataset.col);
  const current = state.boardPosition[row][col];
  
  // If we're in game mode with chess.js, validate moves
  if (chess && state.currentGame) {
    try {
      const tempChess = new Chess(stateBoardPositionToCurrentFen());
      
      if (!state.selectedSquare && current) {
        // Select a piece - only allow selecting pieces of the side to move
        const sideToMove = tempChess.turn();
        const pieceColor = current === current.toUpperCase() ? 'w' : 'b';
        if (pieceColor === sideToMove) {
          state.selectedSquare = { row, col };
        }
      } else if (state.selectedSquare) {
        // Try to make a move
        const from = rowColToAlgebraic(state.selectedSquare.row, state.selectedSquare.col);
        const to = rowColToAlgebraic(row, col);
        
        // If in Guess the Move mode, check the guess first
        if (guessTheMoveMode && state.currentMoveIndex < state.gameHistory.length) {
          const result = checkUserGuess(from, to);
          if (!result.correct) {
            // Show feedback but don't prevent the move
            console.log(result.message);
          }
        }
        
        try {
          const move = tempChess.move({ from, to, promotion: 'q' });
          if (move) {
            // Valid move - update board
            state.boardPosition = parseFen(tempChess.fen());
            state.currentMoveIndex++;
            state.gameHistory.push(move);
            state.selectedSquare = null;
            renderGameViewer();
          } else {
            // Invalid move - just change selection if clicking on another piece
            if (current) {
              const sideToMove = tempChess.turn();
              const pieceColor = current === current.toUpperCase() ? 'w' : 'b';
              if (pieceColor === sideToMove) {
                state.selectedSquare = { row, col };
              } else {
                state.selectedSquare = null;
              }
            } else {
              state.selectedSquare = null;
            }
          }
        } catch (e) {
          // Invalid move - deselect or change selection
          if (current) {
            const sideToMove = tempChess.turn();
            const pieceColor = current === current.toUpperCase() ? 'w' : 'b';
            if (pieceColor === sideToMove) {
              state.selectedSquare = { row, col };
            } else {
              state.selectedSquare = null;
            }
          } else {
            state.selectedSquare = null;
          }
        }
      }
    } catch (e) {
      // Fallback to basic movement if chess.js fails
      if (!state.selectedSquare && current) {
        state.selectedSquare = { row, col };
      } else if (state.selectedSquare) {
        const from = state.selectedSquare;
        state.boardPosition[row][col] = state.boardPosition[from.row][from.col];
        state.boardPosition[from.row][from.col] = "";
        state.selectedSquare = null;
      }
    }
  } else {
    // Basic sandbox mode without chess.js validation
    if (!state.selectedSquare && current) {
      state.selectedSquare = { row, col };
    } else if (state.selectedSquare) {
      const from = state.selectedSquare;
      state.boardPosition[row][col] = state.boardPosition[from.row][from.col];
      state.boardPosition[from.row][from.col] = "";
      state.selectedSquare = null;
    }
  }
  
  renderBoard();
}

function setPuzzle(index) {
  const max = data.tactics.length - 1;
  state.puzzleIndex = Math.max(0, Math.min(max, index));
  resetBoardPosition();
  byId("thinkingChecklist").classList.add("is-hidden");
  renderBoard();
}

function markPuzzle(value) {
  const puzzle = currentPuzzle();
  state.marks[puzzle.id] = { value, fen: puzzle.fen, at: new Date().toISOString(), index: state.puzzleIndex };
  saveMarks();
  renderProgress();
}

function renderChecklist() {
  const items = [
    "List forcing moves first: checks, captures, threats.",
    "Ask what the opponent wants after your candidate move.",
    "Look for overloaded defenders and loose back-rank pieces.",
    "Calculate one move past the first quiet-looking reply.",
    "Name the final position before moving the pieces.",
  ];
  byId("thinkingChecklist").innerHTML = items.map((item) => `<label><input type="checkbox" /> <span>${item}</span></label>`).join("");
}

function renderLibraryControls() {
  const themes = ["All themes", ...Object.keys(countBy(data.books, "theme")).sort()];
  byId("themeFilter").innerHTML = themes.map((theme) => `<option value="${theme}">${theme}</option>`).join("");
  const formats = ["All formats", ...Object.keys(countBy(data.books, "format")).sort()];
  byId("formatFilter").innerHTML = formats.map((format) => `<option value="${format}">${format}</option>`).join("");

  const themeCounts = countBy(data.books, "theme");
  byId("themeSummary").innerHTML = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([theme, count]) => `<span class="theme-pill">${theme}: ${count}</span>`)
    .join("");
}

function renderLibrary() {
  const search = byId("librarySearch").value.toLowerCase();
  const theme = byId("themeFilter").value;
  const format = byId("formatFilter").value;
  const filtered = data.books
    .filter((book) => theme === "All themes" || book.theme === theme)
    .filter((book) => format === "All formats" || book.format === format)
    .filter((book) => `${book.name} ${book.path} ${book.theme}`.toLowerCase().includes(search))
    .slice(0, 120);

  byId("libraryList").innerHTML = filtered
    .map(
      (book) => `
        <article class="book-item">
          <strong>${titleCaseName(book.name)}</strong>
          <div class="book-meta">
            <span class="tag">${book.theme}</span>
            <span class="tag">${book.format}</span>
            <span class="tag">${Math.max(1, Math.round((book.size || 0) / 1024 / 1024))} MB</span>
          </div>
          <span>${book.path}</span>
          ${book.format === 'PDF' || book.format === 'EPUB' ? `<button class="primary-button open-book" data-book-path="${book.path}">Open Book</button>` : ''}
        </article>
      `,
    )
    .join("");
    
  // Add click handlers for open book buttons
  document.querySelectorAll('.open-book').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bookPath = btn.dataset.bookPath;
      const book = data.books.find(b => b.path === bookPath);
      if (book && (book.format === 'PDF' || book.format === 'EPUB')) {
        openBookReader(bookPath);
      } else {
        alert('Book viewer only supports PDF and EPUB formats.');
      }
    });
  });
}

function renderGameControls() {
  const sources = ["All sources", ...new Set(data.games.map((game) => game.source))];
  byId("gameSourceFilter").innerHTML = sources.map((source) => `<option value="${source}">${source}</option>`).join("");
}

function renderGames() {
  const search = byId("gameSearch").value.toLowerCase();
  const source = byId("gameSourceFilter").value;
  const filtered = data.games
    .filter((game) => source === "All sources" || game.source === source)
    .filter((game) => `${game.white} ${game.black} ${game.event} ${game.eco} ${game.date}`.toLowerCase().includes(search))
    .slice(0, 80);

  byId("gameList").innerHTML = filtered
    .map(
      (game) => `
        <article class="game-item" data-game-index="${data.games.indexOf(game)}">
          <strong>${game.white || "White"} vs ${game.black || "Black"}</strong>
          <div class="game-meta">
            <span class="tag">${game.result || "*"}</span>
            <span class="tag">${game.eco || "ECO ?"}</span>
            <span class="tag">${game.date || "Date ?"}</span>
            <span class="tag">${game.source}</span>
          </div>
          <span>${game.event || "Game study"}</span>
        </article>
      `,
    )
    .join("");
  
  // Add click handlers to game items
  document.querySelectorAll('.game-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.gameIndex, 10);
      if (!isNaN(index) && data.games[index]) {
        loadGame(data.games[index]);
        byId("gameViewerSubtitle").textContent = `${data.games[index].white} vs ${data.games[index].black}`;
      }
    });
  });
}

// Render the game move list with current move highlighted
function renderGameViewer() {
  if (!state.currentGame || !state.gameHistory) {
    byId("gameMoveList").innerHTML = '<p class="muted">Select a game from the list to view</p>';
    return;
  }
  
  byId("gameWhite").textContent = state.currentGame.white || "White";
  byId("gameBlack").textContent = state.currentGame.black || "Black";
  byId("gameResult").textContent = state.currentGame.result || "*";
  
  // Build move list with clickable moves
  let moveHtml = '';
  for (let i = 0; i < state.gameHistory.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const whiteMove = state.gameHistory[i];
    const blackMove = state.gameHistory[i + 1];
    
    const whiteClass = i === state.currentMoveIndex - 1 ? 'current-move' : '';
    const blackClass = i + 1 === state.currentMoveIndex - 1 ? 'current-move' : '';
    
    moveHtml += `<div class="move-row">
      <span class="move-number">${moveNum}.</span>
      <span class="move ${whiteClass}" data-move-index="${i}">${whiteMove.san}</span>
      ${blackMove ? `<span class="move ${blackClass}" data-move-index="${i + 1}">${blackMove.san}</span>` : ''}
    </div>`;
  }
  
  byId("gameMoveList").innerHTML = moveHtml;
  
  // Add click handlers to moves
  document.querySelectorAll('.move').forEach(moveEl => {
    moveEl.addEventListener('click', () => {
      const moveIndex = parseInt(moveEl.dataset.moveIndex, 10);
      goToMove(moveIndex + 1);
    });
  });
  
  // Scroll to show current move
  const currentMoveEl = document.querySelector('.current-move');
  if (currentMoveEl) {
    currentMoveEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function renderProgress() {
  const marks = Object.values(state.marks);
  const found = marks.filter((mark) => mark.value === "found").length;
  const missed = marks.filter((mark) => mark.value === "missed").length;
  const accuracy = found + missed ? Math.round((found / (found + missed)) * 100) : 0;
  byId("progressGrid").innerHTML = [
    ["Found", found, "Positions marked solved"],
    ["Missed", missed, "Positions to revisit"],
    ["Accuracy", `${accuracy}%`, "Based on marked attempts"],
    ["Coverage", `${marks.length}/${data.tactics.length}`, "Tactics bank touched"],
  ]
    .map(([label, value, note]) => `<article class="stat-card"><strong>${value}</strong><span>${label}</span><p class="muted">${note}</p></article>`)
    .join("");

  byId("markedPositions").innerHTML =
    marks
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 30)
      .map(
        (mark) => `
          <article class="book-item">
            <strong>${mark.value === "found" ? "Found" : "Missed"} position ${mark.index + 1}</strong>
            <span>${mark.fen}</span>
          </article>
        `,
      )
      .join("") || `<article class="book-item"><strong>No marked positions yet</strong><span>Use Found it or Missed while training.</span></article>`;
}

function wireEvents() {
  document.querySelectorAll(".tab-button").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
  document.querySelectorAll("[data-goto]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.goto)));
  byId("chessBoard").addEventListener("click", handleSquareClick);
  byId("prevPuzzleButton").addEventListener("click", () => setPuzzle(state.puzzleIndex - 1));
  byId("nextPuzzleButton").addEventListener("click", () => setPuzzle(state.puzzleIndex + 1));
  
  // Flip board buttons (there are now two - one in dashboard, one in games)
  document.querySelectorAll("#flipBoardButton").forEach((button) => {
    button.addEventListener("click", () => {
      state.flipped = !state.flipped;
      renderBoard();
    });
  });
  
  byId("resetBoardButton").addEventListener("click", () => {
    resetBoardPosition();
    renderBoard();
  });
  byId("foundButton").addEventListener("click", () => markPuzzle("found"));
  byId("missedButton").addEventListener("click", () => markPuzzle("missed"));
  byId("revealButton").addEventListener("click", () => byId("thinkingChecklist").classList.toggle("is-hidden"));
  byId("refreshPlanButton").addEventListener("click", () => {
    state.planSeed += 1;
    localStorage.setItem("chessLibraryTrainer.planSeed", String(state.planSeed));
    renderDailyPlan();
  });
  byId("randomPuzzleButton").addEventListener("click", () => setPuzzle(Math.floor(Math.random() * data.tactics.length)));
  byId("clearMarksButton").addEventListener("click", () => {
    state.marks = {};
    saveMarks();
    renderProgress();
  });
  byId("puzzleJump").addEventListener("input", (event) => setPuzzle(Number(event.target.value) - 1));
  ["librarySearch", "themeFilter", "formatFilter"].forEach((id) => byId(id).addEventListener("input", renderLibrary));
  ["gameSearch", "gameSourceFilter"].forEach((id) => byId(id).addEventListener("input", renderGames));
  
  // Game viewer navigation buttons
  if (byId("firstMoveButton")) {
    byId("firstMoveButton").addEventListener("click", () => goToMove(0));
  }
  if (byId("prevMoveButton")) {
    byId("prevMoveButton").addEventListener("click", () => goToMove(state.currentMoveIndex - 1));
  }
  if (byId("nextMoveButton")) {
    byId("nextMoveButton").addEventListener("click", () => goToMove(state.currentMoveIndex + 1));
  }
  if (byId("lastMoveButton")) {
    byId("lastMoveButton").addEventListener("click", () => goToMove(state.gameHistory.length));
  }
  if (byId("resetGameButton")) {
    byId("resetGameButton").addEventListener("click", () => {
      if (state.currentGame) {
        loadGame(state.currentGame);
      }
    });
  }
  
  // Engine analysis buttons
  if (byId("startAnalysisButton")) {
    byId("startAnalysisButton").addEventListener("click", () => {
      const fen = getCurrentFenForAnalysis();
      if (fen) {
        startAnalysis(fen, 18);
      }
    });
  }
  if (byId("stopAnalysisButton")) {
    byId("stopAnalysisButton").addEventListener("click", stopAnalysis);
  }
  if (byId("guessTheMoveButton")) {
    byId("guessTheMoveButton").addEventListener("click", toggleGuessTheMove);
  }
  
  // Book reader modal events
  if (byId("closeBookReader")) {
    byId("closeBookReader").addEventListener("click", closeBookReader);
  }
  if (byId("prevPageBtn")) {
    byId("prevPageBtn").addEventListener("click", () => gotoPage(currentPageNum - 1));
  }
  if (byId("nextPageBtn")) {
    byId("nextPageBtn").addEventListener("click", () => gotoPage(currentPageNum + 1));
  }
  if (byId("pageInput")) {
    byId("pageInput").addEventListener("change", (e) => {
      const page = parseInt(e.target.value, 10);
      if (!isNaN(page) && page >= 1 && pdfDoc && page <= pdfDoc.numPages) {
        gotoPage(page);
      }
    });
  }
  
  // EPUB navigation buttons
  if (byId("epubPrevBtn")) {
    byId("epubPrevBtn").addEventListener("click", epubPrevPage);
  }
  if (byId("epubNextBtn")) {
    byId("epubNextBtn").addEventListener("click", epubNextPage);
  }
  
  if (byId("loadFenButton")) {
    byId("loadFenButton").addEventListener("click", loadFenToLibraryBoard);
  }
  if (byId("clearLibraryBoard")) {
    byId("clearLibraryBoard").addEventListener("click", clearLibraryBoard);
  }
  if (byId("chessBoardLibrary")) {
    byId("chessBoardLibrary").addEventListener("click", handleLibraryBoardClick);
  }
  
  // PGN Upload
  if (byId("uploadPgnButton")) {
    byId("uploadPgnButton").addEventListener("click", () => {
      byId("pgnFileInput").click();
    });
  }
  if (byId("pgnFileInput")) {
    byId("pgnFileInput").addEventListener("change", handlePgnUpload);
  }
  
  // Book Reader Tools
  if (byId("searchInBookButton")) {
    byId("searchInBookButton").addEventListener("click", () => {
      const query = prompt('Search in book:');
      if (query) searchInBook(query);
    });
  }
  if (byId("bookmarkButton")) {
    byId("bookmarkButton").addEventListener("click", addBookmark);
  }
  if (byId("highlightButton")) {
    byId("highlightButton").addEventListener("click", toggleHighlightMode);
  }
  if (byId("annotationsButton")) {
    byId("annotationsButton").addEventListener("click", renderAnnotations);
  }
  if (byId("saveAnnotationButton")) {
    byId("saveAnnotationButton").addEventListener("click", savePositionAnnotation);
  }
}

// Book Reader Functions
async function openBookReader(bookPath) {
  const book = data.books.find(b => b.path === bookPath);
  
  if (!book) {
    console.error('Book not found:', bookPath);
    return;
  }
  
  byId('bookReaderTitle').textContent = `Reading: ${titleCaseName(bookPath)}`;
  byId('bookReaderModal').classList.remove('is-hidden');
  
  // Hide both containers first
  byId('pdfContainer').classList.add('is-hidden');
  byId('epubContainer').classList.add('is-hidden');
  
  try {
    if (book.format === 'PDF' || book.format === 'pdf') {
      await openPdfBook(bookPath);
    } else if (book.format === 'EPUB' || book.format === 'epub') {
      await openEpubBook(bookPath);
    } else {
      alert('Unsupported book format: ' + book.format);
    }
    
    renderLibraryBoard();
  } catch (error) {
    console.error('Error loading book:', error);
    alert('Could not load book. This feature requires the book files to be served from a web server.');
  }
}

async function openPdfBook(bookPath) {
  if (!pdfjsLib) {
    throw new Error('PDF.js not loaded');
  }
  
  byId('pdfContainer').classList.remove('is-hidden');
  
  // For demo purposes, use a sample PDF URL
  const samplePdfUrl = 'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-plastic-0.pdf';
  
  const loadingTask = pdfjsLib.getDocument(samplePdfUrl);
  pdfDoc = await loadingTask.promise;
  
  currentPageNum = 1;
  currentBookPath = bookPath;
  
  byId('pageNumDisplay').textContent = `Page 1 of ${pdfDoc.numPages}`;
  byId('pageInput').max = String(pdfDoc.numPages);
  byId('pageInput').value = '1';
  
  renderPdfPage(currentPageNum);
}

async function openEpubBook(bookPath) {
  if (typeof ePub === 'undefined') {
    throw new Error('EPUB.js not loaded');
  }
  
  byId('epubContainer').classList.remove('is-hidden');
  
  // For demo purposes, use a sample EPUB URL
  // In production, this would load from the actual book path
  const sampleEpubUrl = 'https://s3.amazonaws.com/moby-dick/OPS/package.opf';
  
  try {
    epubBook = ePub(sampleEpubUrl);
    
    // Create rendition with fixed layout
    epubRendition = epubBook.renderTo('epubViewer', {
      width: '100%',
      height: '600px'
    });
    
    // Display the book
    await epubRendition.display();
    
    // Update location display when navigation occurs
    epubRendition.on('relocated', (location) => {
      currentEpubLocation = location;
      updateEpubLocationDisplay();
    });
    
    currentBookPath = bookPath;
    updateEpubLocationDisplay();
  } catch (error) {
    console.error('Error loading EPUB:', error);
    throw error;
  }
}

function updateEpubLocationDisplay() {
  if (epubRendition && currentEpubLocation) {
    const location = currentEpubLocation.start.displayed.page || currentEpubLocation.start.displayed.cfi;
    byId('epubLocationDisplay').textContent = `Location ${location}`;
  }
}

async function renderPdfPage(pageNum) {
  if (!pdfDoc) return;
  
  try {
    const page = await pdfDoc.getPage(pageNum);
    const canvas = byId('pdfCanvas');
    const ctx = canvas.getContext('2d');
    
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    byId('pageNumDisplay').textContent = `Page ${pageNum} of ${pdfDoc.numPages}`;
    byId('pageInput').value = String(pageNum);
  } catch (error) {
    console.error('Error rendering page:', error);
  }
}

function gotoPage(pageNum) {
  if (!pdfDoc || pageNum < 1 || pageNum > pdfDoc.numPages) return;
  currentPageNum = pageNum;
  renderPdfPage(pageNum);
}

function closeBookReader() {
  byId('bookReaderModal').classList.add('is-hidden');
  
  // Close PDF
  if (pdfDoc) {
    pdfDoc = null;
    currentPageNum = 1;
  }
  
  // Close EPUB
  if (epubRendition) {
    epubRendition.destroy();
    epubRendition = null;
  }
  if (epubBook) {
    epubBook.destroy();
    epubBook = null;
  }
  currentEpubLocation = null;
  currentBookPath = null;
}

// EPUB Navigation Functions
function epubNextPage() {
  if (epubRendition) {
    epubRendition.next();
  }
}

function epubPrevPage() {
  if (epubRendition) {
    epubRendition.prev();
  }
}

// Library Board Functions
function renderLibraryBoard() {
  const board = byId('chessBoardLibrary');
  if (!board) return;
  
  // Start with initial position
  const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  state.libraryBoardPosition = parseFen(initialFen);
  state.librarySelectedSquare = null;
  
  if (state.libraryBoardChess) {
    state.libraryBoardChess.reset();
  }
  
  drawLibraryBoard();
}

function drawLibraryBoard() {
  const board = byId('chessBoardLibrary');
  if (!board || !state.libraryBoardPosition) return;
  
  const rows = state.flipped ? [...state.libraryBoardPosition].reverse() : state.libraryBoardPosition;
  
  let legalMoves = [];
  if (state.libraryBoardChess && state.librarySelectedSquare) {
    try {
      const squareName = rowColToAlgebraic(state.librarySelectedSquare.row, state.librarySelectedSquare.col);
      legalMoves = state.libraryBoardChess.moves({ square: squareName, verbose: true });
    } catch (e) {
      // Ignore
    }
  }
  
  board.innerHTML = rows
    .map((row, displayRow) => {
      const actualRow = state.flipped ? 7 - displayRow : displayRow;
      const cols = state.flipped ? [...row].reverse() : row;
      return cols
        .map((piece, displayCol) => {
          const actualCol = state.flipped ? 7 - displayCol : displayCol;
          const light = (actualRow + actualCol) % 2 === 0;
          const selected = state.librarySelectedSquare && state.librarySelectedSquare.row === actualRow && state.librarySelectedSquare.col === actualCol;
          const coord = displayRow === 7 || displayCol === 0 ? `<span class="coord">${squareName(actualRow, actualCol)}</span>` : '';
          const pieceImg = piece && pieceImages[piece] ? `<img src="${pieceImages[piece]}" alt="${piece}" class="piece-img">` : '';
          
          const squareNameStr = squareName(actualRow, actualCol);
          const isLegalMove = legalMoves.some(move => move.to === squareNameStr);
          
          return `<button class="square ${light ? 'light' : 'dark'} ${selected ? 'is-selected' : ''} ${isLegalMove ? 'possible-move' : ''}" data-row="${actualRow}" data-col="${actualCol}" aria-label="${squareName(actualRow, actualCol)}">${pieceImg}${coord}</button>`;
        })
        .join('');
    })
    .join('');
}

function handleLibraryBoardClick(event) {
  const button = event.target.closest('.square');
  if (!button) return;
  const row = Number(button.dataset.row);
  const col = Number(button.dataset.col);
  const current = state.libraryBoardPosition[row][col];
  
  if (state.libraryBoardChess) {
    try {
      if (!state.librarySelectedSquare && current) {
        const sideToMove = state.libraryBoardChess.turn();
        const pieceColor = current === current.toUpperCase() ? 'w' : 'b';
        if (pieceColor === sideToMove) {
          state.librarySelectedSquare = { row, col };
        }
      } else if (state.librarySelectedSquare) {
        const from = rowColToAlgebraic(state.librarySelectedSquare.row, state.librarySelectedSquare.col);
        const to = rowColToAlgebraic(row, col);
        
        try {
          const move = state.libraryBoardChess.move({ from, to, promotion: 'q' });
          if (move) {
            state.libraryBoardPosition = parseFen(state.libraryBoardChess.fen());
            state.librarySelectedSquare = null;
          } else {
            if (current) {
              const sideToMove = state.libraryBoardChess.turn();
              const pieceColor = current === current.toUpperCase() ? 'w' : 'b';
              if (pieceColor === sideToMove) {
                state.librarySelectedSquare = { row, col };
              } else {
                state.librarySelectedSquare = null;
              }
            } else {
              state.librarySelectedSquare = null;
            }
          }
        } catch (e) {
          if (current) {
            const sideToMove = state.libraryBoardChess.turn();
            const pieceColor = current === current.toUpperCase() ? 'w' : 'b';
            if (pieceColor === sideToMove) {
              state.librarySelectedSquare = { row, col };
            } else {
              state.librarySelectedSquare = null;
            }
          } else {
            state.librarySelectedSquare = null;
          }
        }
      }
    } catch (e) {
      // Fallback
      if (!state.librarySelectedSquare && current) {
        state.librarySelectedSquare = { row, col };
      } else if (state.librarySelectedSquare) {
        const from = state.librarySelectedSquare;
        state.libraryBoardPosition[row][col] = state.libraryBoardPosition[from.row][from.col];
        state.libraryBoardPosition[from.row][from.col] = '';
        state.librarySelectedSquare = null;
      }
    }
  } else {
    if (!state.librarySelectedSquare && current) {
      state.librarySelectedSquare = { row, col };
    } else if (state.librarySelectedSquare) {
      const from = state.librarySelectedSquare;
      state.libraryBoardPosition[row][col] = state.libraryBoardPosition[from.row][from.col];
      state.libraryBoardPosition[from.row][from.col] = '';
      state.librarySelectedSquare = null;
    }
  }
  
  drawLibraryBoard();
}

function loadFenToLibraryBoard() {
  const fenInput = byId('fenInput');
  const fen = fenInput.value.trim();
  
  if (!fen) {
    alert('Please enter a FEN string');
    return;
  }
  
  try {
    if (state.libraryBoardChess) {
      state.libraryBoardChess.load(fen);
      state.libraryBoardPosition = parseFen(fen);
      state.librarySelectedSquare = null;
      drawLibraryBoard();
      byId('libraryPositionPrompt').textContent = 'Position loaded from FEN';
    }
  } catch (error) {
    alert('Invalid FEN string. Please check the format.');
  }
}

function clearLibraryBoard() {
  const emptyFen = '8/8/8/8/8/8/8/8 w - - 0 1';
  if (state.libraryBoardChess) {
    state.libraryBoardChess.load(emptyFen);
    state.libraryBoardPosition = parseFen(emptyFen);
    state.librarySelectedSquare = null;
    drawLibraryBoard();
    byId('fenInput').value = '';
    byId('libraryPositionPrompt').textContent = 'Board cleared';
  }
}

function init() {
  renderStats();
  renderDailyPlan();
  renderChecklist();
  resetBoardPosition();
  renderBoard();
  renderLibraryControls();
  renderLibrary();
  renderGameControls();
  renderGames();
  renderProgress();
  wireEvents();
  
  // Initialize game viewer board if it exists
  if (byId("chessBoardGames")) {
    byId("gameMoveList").innerHTML = '<p class="muted">Select a game from the list to view</p>';
  }
  
  // Initialize library board
  if (byId("chessBoardLibrary")) {
    renderLibraryBoard();
  }
  
  // Initialize Stockfish engine
  initStockfish();
}

// Stockfish Engine Functions
function initStockfish() {
  if (typeof Stockfish !== 'undefined') {
    state.stockfish = new Stockfish();
    
    state.stockfish.onmessage = function(event) {
      const line = event.data || event;
      
      // Parse evaluation score
      if (line.startsWith('info depth') && line.includes('score')) {
        parseEngineEvaluation(line);
      }
      
      // Parse best move
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        state.bestMove = parts[1];
        state.principalVariation = parts.slice(2).filter(m => m !== 'pv');
        renderEngineAnalysis();
      }
      
      // Search complete
      if (line.startsWith('bestmove') && state.isAnalyzing) {
        state.isAnalyzing = false;
        renderEngineAnalysis();
      }
    };
    
    // Initialize UCI protocol
    state.stockfish.postMessage('uci');
    state.stockfish.postMessage('isready');
  }
}

function parseEngineEvaluation(line) {
  // Extract score (cp for centipawns, mate for mate in X)
  const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
  if (scoreMatch) {
    const type = scoreMatch[1];
    const value = parseInt(scoreMatch[2], 10);
    
    if (type === 'cp') {
      state.evaluationScore = value;
    } else if (type === 'mate') {
      state.evaluationScore = value > 0 ? 10000 - value : -10000 - value;
    }
  }
  
  // Extract principal variation
  const pvMatch = line.match(/pv (.+?)(?: depth |$)/);
  if (pvMatch) {
    state.principalVariation = pvMatch[1].split(' ').slice(0, 6);
  }
}

function startAnalysis(fen, depth = 15) {
  if (!state.stockfish || !fen) return;
  
  stopAnalysis();
  state.isAnalyzing = true;
  state.engineAnalysis = { fen, depth };
  
  state.stockfish.postMessage('position fen ' + fen);
  state.stockfish.postMessage('go depth ' + depth);
  
  renderEngineAnalysis();
}

function stopAnalysis() {
  if (state.stockfish && state.isAnalyzing) {
    state.stockfish.postMessage('stop');
    state.isAnalyzing = false;
  }
}

function formatEvaluation(score) {
  if (Math.abs(score) >= 10000) {
    const movesToMate = Math.abs(10000 - Math.abs(score));
    return score > 0 ? `M+${movesToMate}` : `M-${movesToMate}`;
  }
  
  const normalized = score / 100;
  const sign = normalized > 0 ? '+' : '';
  return `${sign}${normalized.toFixed(2)}`;
}

function renderEngineAnalysis() {
  const evalDisplay = byId('engineEvaluation');
  const bestMoveDisplay = byId('engineBestMove');
  const pvDisplay = byId('enginePV');
  const analysisStatus = byId('analysisStatus');
  
  if (!evalDisplay) return;
  
  if (state.isAnalyzing) {
    analysisStatus.textContent = 'Analyzing...';
    evalDisplay.textContent = '...';
    bestMoveDisplay.textContent = '...';
    pvDisplay.textContent = 'Calculating...';
  } else if (state.engineAnalysis) {
    analysisStatus.textContent = 'Analysis complete';
    evalDisplay.textContent = formatEvaluation(state.evaluationScore);
    bestMoveDisplay.textContent = state.bestMove || '-';
    pvDisplay.textContent = state.principalVariation.join(' ') || '-';
    
    // Color-code evaluation
    const evalValue = state.evaluationScore;
    if (evalValue > 50) {
      evalDisplay.style.color = '#22c55e'; // White advantage (green)
    } else if (evalValue < -50) {
      evalDisplay.style.color = '#ef4444'; // Black advantage (red)
    } else {
      evalDisplay.style.color = '#fbbf24'; // Equal (amber)
    }
  } else {
    analysisStatus.textContent = 'Ready';
    evalDisplay.textContent = '-';
    bestMoveDisplay.textContent = '-';
    pvDisplay.textContent = '-';
  }
}

function getCurrentFenForAnalysis() {
  if (state.currentGame && state.gameHistory.length > 0) {
    const tempChess = new Chess();
    for (let i = 0; i < state.currentMoveIndex; i++) {
      tempChess.move(state.gameHistory[i]);
    }
    return tempChess.fen();
  } else if (state.boardPosition) {
    return stateBoardPositionToCurrentFen();
  }
  return null;
}

// ============================================
// PGN Upload & Parsing Functions
// ============================================

function handlePgnUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const pgnText = e.target.result;
    parseAndAddPgnGames(pgnText, file.name);
  };
  reader.readAsText(file);
  
  // Reset input
  event.target.value = '';
}

function parseAndAddPgnGames(pgnText, sourceName) {
  const chess = new Chess();
  const games = [];
  let currentGame = {};
  let currentMoves = [];
  let headers = {};
  
  // Split by empty lines to separate games
  const lines = pgnText.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('[') && line.endsWith(']')) {
      // Parse header
      const match = line.match(/\[(\w+)\s+"([^"]*)"\]/);
      if (match) {
        headers[match[1]] = match[2];
      }
    } else if (line === '') {
      // Empty line might indicate end of headers
      if (Object.keys(headers).length > 0 && currentMoves.length === 0) {
        // Continue to moves
      }
    } else if (line.match(/^\d+\./)) {
      // Move text line
      const moves = parseMoveText(line);
      currentMoves.push(...moves);
    } else if (line.includes('.') || line.match(/[a-h][1-8]/)) {
      // More move text
      const moves = parseMoveText(line);
      currentMoves.push(...moves);
    }
    
    // Check if game is complete (next game starts or end of file)
    if ((lines[i+1] && lines[i+1].startsWith('[')) || i === lines.length - 1) {
      if (Object.keys(headers).length > 0 || currentMoves.length > 0) {
        games.push({
          white: headers.White || 'Unknown',
          black: headers.Black || 'Unknown',
          result: headers.Result || '*',
          event: headers.Event || sourceName,
          site: headers.Site || '',
          date: headers.Date || '',
          eco: headers.ECO || '',
          pgn: pgnText.substring(pgnText.indexOf('[', i - 10), i),
          moves: currentMoves,
          headers: {...headers}
        });
        
        // Reset for next game
        headers = {};
        currentMoves = [];
        currentGame = {};
      }
    }
  }
  
  // Add games to library data
  if (games.length > 0) {
    window.libraryData.pgnGames.push(...games);
    alert(`Successfully imported ${games.length} games from ${sourceName}`);
    renderGameList();
    populateGameSourceFilter();
  }
}

function parseMoveText(moveText) {
  const moves = [];
  // Remove move numbers and comments
  const cleaned = moveText.replace(/\d+\./g, '').replace(/\{[^}]*\}/g, '').replace(/\([^)]*\)/g, '');
  const tokens = cleaned.split(/\s+/);
  
  for (const token of tokens) {
    if (token && !token.startsWith('{') && token !== '*') {
      moves.push(token);
    }
  }
  
  return moves;
}

// ============================================
// Book Search, Bookmarks & Annotations
// ============================================

function searchInBook(query) {
  if (!state.currentBook) return;
  
  const results = [];
  
  if (state.currentBook.type === 'pdf') {
    // PDF search - would require text layer extraction
    // For now, we'll simulate search functionality
    showSearchResults(results, 'PDF search requires text-enabled PDFs');
  } else if (state.currentBook.type === 'epub') {
    // EPUB search
    searchEpub(state.currentBook.book, query).then(results => {
      showSearchResults(results, 'EPUB');
    });
  }
}

async function searchEpub(epubBook, query) {
  const results = [];
  const spine = epubBook.spine;
  
  // Get all sections
  const sections = spine ? spine.each : [];
  
  for (let i = 0; i < Math.min(sections.length, 50); i++) {
    try {
      const section = sections[i];
      const text = await section.load(epubBook.load.bind(epubBook));
      
      if (text && text.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          section: i,
          excerpt: text.substring(text.toLowerCase().indexOf(query.toLowerCase()) - 50, 
                                  text.toLowerCase().indexOf(query.toLowerCase()) + 100),
          query: query
        });
      }
    } catch (e) {
      // Skip sections that can't be loaded
    }
  }
  
  return results;
}

function showSearchResults(results, type) {
  const resultsPanel = byId('searchResultsPanel');
  const resultsList = byId('searchResultsList');
  
  if (!resultsPanel || !resultsList) return;
  
  resultsList.innerHTML = '';
  
  if (results.length === 0) {
    resultsList.innerHTML = '<p>No results found</p>';
  } else {
    results.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <p><strong>Match ${index + 1}</strong></p>
        <small>${type} - Section/Page ${result.section || result.page}</small>
        <p style="margin-top:4px;font-size:0.8rem;color:var(--muted);">${result.excerpt || 'Found'}</p>
      `;
      item.addEventListener('click', () => {
        goToSearchResult(result);
      });
      resultsList.appendChild(item);
    });
  }
  
  resultsPanel.classList.remove('is-hidden');
}

function goToSearchResult(result) {
  if (state.currentBook && state.currentBook.type === 'epub') {
    if (state.rendition) {
      state.rendition.display(result.section);
    }
  } else if (state.currentBook && state.currentBook.type === 'pdf') {
    // Navigate to PDF page
    if (result.page) {
      currentPage = result.page;
      renderPage(currentPage);
    }
  }
  
  // Hide search panel
  const resultsPanel = byId('searchResultsPanel');
  if (resultsPanel) {
    resultsPanel.classList.add('is-hidden');
  }
}

function addBookmark() {
  if (!state.currentBook) return;
  
  const bookmark = {
    bookId: state.currentBook.id,
    bookTitle: state.currentBook.title,
    page: currentPage,
    location: state.currentLocation,
    timestamp: Date.now(),
    fen: state.libraryBoardPosition ? stateBoardPositionToCurrentFen() : null
  };
  
  // Save to localStorage
  const bookmarks = JSON.parse(localStorage.getItem('chessTrainerBookmarks') || '[]');
  bookmarks.push(bookmark);
  localStorage.setItem('chessTrainerBookmarks', JSON.stringify(bookmarks));
  
  showNotification('Bookmark added!');
  renderBookmarks();
}

function renderBookmarks() {
  const bookmarksPanel = byId('bookmarksPanel');
  const bookmarksList = byId('bookmarksList');
  
  if (!bookmarksPanel || !bookmarksList) return;
  
  const bookmarks = JSON.parse(localStorage.getItem('chessTrainerBookmarks') || '[]');
  
  bookmarksList.innerHTML = '';
  
  if (bookmarks.length === 0) {
    bookmarksList.innerHTML = '<p>No bookmarks yet</p>';
  } else {
    bookmarks.slice().reverse().forEach((bookmark, index) => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <p><strong>${bookmark.bookTitle}</strong></p>
        <small>Page ${bookmark.page || '-'} | ${new Date(bookmark.timestamp).toLocaleDateString()}</small>
        ${bookmark.fen ? '<p style="margin-top:4px;font-size:0.75rem;color:var(--accent);">Has position</p>' : ''}
      `;
      item.addEventListener('click', () => {
        loadBookmark(bookmark);
      });
      bookmarksList.appendChild(item);
    });
  }
  
  bookmarksPanel.classList.remove('is-hidden');
}

function loadBookmark(bookmark) {
  // Find and open the book
  const book = window.libraryData.books.find(b => b.id === bookmark.bookId);
  if (book) {
    openBookReader(book);
    
    // Navigate to bookmarked position
    setTimeout(() => {
      if (book.format === 'pdf' && bookmark.page) {
        currentPage = bookmark.page;
        renderPage(currentPage);
      }
      
      // Load position if available
      if (bookmark.fen) {
        loadFenFromInput(bookmark.fen);
      }
    }, 500);
  }
  
  // Hide bookmarks panel
  const bookmarksPanel = byId('bookmarksPanel');
  if (bookmarksPanel) {
    bookmarksPanel.classList.add('is-hidden');
  }
}

function savePositionAnnotation() {
  const annotationInput = byId('positionAnnotation');
  if (!annotationInput || !state.libraryBoardPosition) return;
  
  const annotation = {
    fen: stateBoardPositionToCurrentFen(),
    text: annotationInput.value.trim(),
    bookId: state.currentBook ? state.currentBook.id : null,
    bookTitle: state.currentBook ? state.currentBook.title : null,
    page: currentPage,
    timestamp: Date.now()
  };
  
  if (!annotation.text) {
    showNotification('Please enter annotation text');
    return;
  }
  
  // Save to localStorage
  const annotations = JSON.parse(localStorage.getItem('chessTrainerAnnotations') || '[]');
  annotations.push(annotation);
  localStorage.setItem('chessTrainerAnnotations', JSON.stringify(annotations));
  
  showNotification('Annotation saved!');
  annotationInput.value = '';
  renderAnnotations();
}

function renderAnnotations() {
  const annotationsPanel = byId('annotationsPanel');
  const annotationsList = byId('annotationsList');
  
  if (!annotationsPanel || !annotationsList) return;
  
  const annotations = JSON.parse(localStorage.getItem('chessTrainerAnnotations') || '[]');
  
  annotationsList.innerHTML = '';
  
  if (annotations.length === 0) {
    annotationsList.innerHTML = '<p>No annotations yet</p>';
  } else {
    annotations.slice().reverse().forEach((annotation, index) => {
      const item = document.createElement('div');
      item.className = 'annotation-item';
      item.innerHTML = `
        <p><strong>${annotation.bookTitle || 'General'}</strong></p>
        <small>Page ${annotation.page || '-'} | ${new Date(annotation.timestamp).toLocaleDateString()}</small>
        <p style="margin-top:4px;font-size:0.85rem;">${annotation.text}</p>
      `;
      item.addEventListener('click', () => {
        loadAnnotation(annotation);
      });
      annotationsList.appendChild(item);
    });
  }
  
  annotationsPanel.classList.remove('is-hidden');
}

function loadAnnotation(annotation) {
  // Find and open the book if it exists
  if (annotation.bookId) {
    const book = window.libraryData.books.find(b => b.id === annotation.bookId);
    if (book) {
      openBookReader(book);
      
      setTimeout(() => {
        if (book.format === 'pdf' && annotation.page) {
          currentPage = annotation.page;
          renderPage(currentPage);
        }
      }, 500);
    }
  }
  
  // Load position if available
  if (annotation.fen) {
    loadFenFromInput(annotation.fen);
  }
  
  // Show annotation text
  const annotationInput = byId('positionAnnotation');
  if (annotationInput) {
    annotationInput.value = annotation.text;
  }
  
  // Hide annotations panel
  const annotationsPanel = byId('annotationsPanel');
  if (annotationsPanel) {
    annotationsPanel.classList.add('is-hidden');
  }
}

function toggleHighlightMode() {
  const pdfContainer = byId('pdfContainer');
  if (!pdfContainer) return;
  
  state.highlightMode = !state.highlightMode;
  
  if (state.highlightMode) {
    pdfContainer.classList.add('highlight-mode-active');
    showNotification('Highlight mode ON - Click and drag to highlight text');
  } else {
    pdfContainer.classList.remove('highlight-mode-active');
    showNotification('Highlight mode OFF');
  }
}

function showNotification(message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--accent);
    color: white;
    padding: 12px 24px;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

init();
