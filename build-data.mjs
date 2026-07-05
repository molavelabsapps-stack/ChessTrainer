import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("..");
const outputDir = path.resolve("data");
const includeExtensions = new Set([".pdf", ".epub", ".pgn", ".png", ".djvu"]);
const skipDirs = new Set([".git", ".agents", ".codex", "ChessLibraryTrainer"]);

const themeRules = [
  ["Tactics", /tactic|sacrifice|combination|woodpecker|tricky|genius|beat.your.dad|ct.?art|brilliant.moves|amazing.moves/i],
  ["Endgames", /endgame|rook.endgame|pawn.endgame|perlo|shereshevsky|technical.chess/i],
  ["Openings", /opening|repertoire|dutch|stonewall|sicilian|najdorf|ruy|benko|benoni|leningrad|defen[cs]e|1e4|black.explained|ponziani/i],
  ["Strategy", /strategy|positional|reassess|planning|my.system|point.count|attacking.plan|attack.and.defence|logical.thinking|imbalance|simple.attacking/i],
  ["Calculation", /calculation|think.like|candidate.master|chess.exam|training.guide|5k.and.10k|art.of.chess.training/i],
  ["Games", /tal|kasparov|botvinnik|lasker|capablanca|morphy|brillianc|amateur.game|move.by.move|nunn|chern|polgar|fischer|spassky|karpov/i],
  ["Beginner", /kids|learn.chess|fundamental|course|primer|manual.of.chess|play.chess|complete.chess.course/i],
  ["Analytics", /engine|analytics|digital.age|project.report|computer.graphics/i],
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      files.push(...(await walk(path.join(dir, entry.name))));
    } else {
      const extension = path.extname(entry.name).toLowerCase();
      if (includeExtensions.has(extension)) files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function themeFor(filePath) {
  const normalized = filePath.toLowerCase().replaceAll("\\", "/");
  for (const [theme, pattern] of themeRules) {
    if (pattern.test(normalized)) return theme;
  }
  return "Reference";
}

function cleanMoves(text) {
  return text
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

function parseTags(block) {
  const tags = {};
  for (const match of block.matchAll(/^\[([A-Za-z0-9_]+)\s+"([^"]*)"\]/gm)) {
    tags[match[1]] = match[2];
  }
  return tags;
}

function splitPgnGames(text) {
  return text
    .split(/\n(?=\[Event\s+")/g)
    .map((block) => block.trim())
    .filter(Boolean);
}

async function parseTactics(pgnPath) {
  const text = await readFile(pgnPath, "utf8");
  return [...text.matchAll(/^\[Event\s+"([^"]*)"\][\s\S]*?^\[FEN\s+"([^"]*)"\]/gm)].map((match, index) => {
    const fen = match[2];
    const side = fen.split(" ")[1] || "w";
    return {
      id: `wcs-${index + 1}`,
      event: match[1],
      fen,
      side,
      source: "1001 Winning Chess Sacrifices & Combinations",
      prompt: `${side === "b" ? "Black" : "White"} to move. Find the forcing idea before moving a piece.`,
    };
  });
}

async function parseGames(pgnPaths) {
  const games = [];
  for (const pgnPath of pgnPaths) {
    const text = await readFile(pgnPath, "utf8");
    const source = path.basename(pgnPath);
    for (const block of splitPgnGames(text)) {
      const tags = parseTags(block);
      if (tags.FEN && !/\d+\./.test(block)) continue;
      const moves = cleanMoves(block.replace(/^\[[^\n]+\]\s*/gm, ""));
      if (!moves || moves === "*") continue;
      games.push({
        source,
        event: tags.Event || "",
        site: tags.Site || "",
        date: tags.Date || "",
        white: tags.White || "",
        black: tags.Black || "",
        result: tags.Result || "",
        eco: tags.ECO || "",
        moves,
      });
    }
  }
  return games;
}

const files = await walk(root);
const books = [];
for (const file of files) {
  const info = await stat(file);
  books.push({
    name: path.basename(file),
    path: path.relative(root, file).replaceAll("\\", "/"),
    format: path.extname(file).slice(1).toUpperCase(),
    size: info.size,
    theme: themeFor(file),
  });
}

books.sort((a, b) => a.theme.localeCompare(b.theme) || a.name.localeCompare(b.name));

const allPgns = files.filter((file) => path.extname(file).toLowerCase() === ".pgn");
const tacticsPath = allPgns.find((file) => /1001 Winning Chess Sacrifices & Combinations\.pgn$/i.test(file));
const tactics = tacticsPath ? await parseTactics(tacticsPath) : [];
const games = await parseGames(allPgns.filter((file) => file !== tacticsPath));

await mkdir(outputDir, { recursive: true });
const payload = {
  generatedAt: new Date().toISOString(),
  root,
  books,
  tactics,
  games,
};

await writeFile(
  path.join(outputDir, "library-data.js"),
  `window.CHESS_LIBRARY_DATA = ${JSON.stringify(payload, null, 2)};\n`,
  "utf8",
);

console.log(`Indexed ${books.length} files, ${tactics.length} tactics, ${games.length} games.`);
