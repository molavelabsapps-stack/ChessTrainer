const data = window.CHESS_LIBRARY_DATA || { books: [], tactics: [], games: [], generatedAt: "" };

const state = {
  activeTab: "dashboard",
  puzzleIndex: 0,
  flipped: false,
  selectedSquare: null,
  boardPosition: null,
  marks: JSON.parse(localStorage.getItem("chessLibraryTrainer.marks") || "{}"),
  planSeed: Number(localStorage.getItem("chessLibraryTrainer.planSeed") || "0"),
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
          return `<button class="square ${light ? "light" : "dark"} ${selected ? "is-selected" : ""}" data-row="${actualRow}" data-col="${actualCol}" aria-label="${squareName(actualRow, actualCol)}">${pieces[piece] || ""}${coord}</button>`;
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

function handleSquareClick(event) {
  const button = event.target.closest(".square");
  if (!button) return;
  const row = Number(button.dataset.row);
  const col = Number(button.dataset.col);
  const current = state.boardPosition[row][col];
  if (!state.selectedSquare && current) {
    state.selectedSquare = { row, col };
  } else if (state.selectedSquare) {
    const from = state.selectedSquare;
    state.boardPosition[row][col] = state.boardPosition[from.row][from.col];
    state.boardPosition[from.row][from.col] = "";
    state.selectedSquare = null;
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
        </article>
      `,
    )
    .join("");
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
        <article class="game-item">
          <strong>${game.white || "White"} vs ${game.black || "Black"}</strong>
          <div class="game-meta">
            <span class="tag">${game.result || "*"}</span>
            <span class="tag">${game.eco || "ECO ?"}</span>
            <span class="tag">${game.date || "Date ?"}</span>
            <span class="tag">${game.source}</span>
          </div>
          <span>${game.event || "Game study"}</span>
          <div class="game-moves">${game.moves || "No move text captured."}</div>
        </article>
      `,
    )
    .join("");
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
  byId("flipBoardButton").addEventListener("click", () => {
    state.flipped = !state.flipped;
    renderBoard();
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
}

init();
