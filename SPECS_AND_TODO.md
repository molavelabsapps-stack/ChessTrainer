# Chess Library Trainer - Detailed Specifications & TODO List

## Project Overview

A local web-based chess training application that organizes chess learning materials (books, tactics, games) into a structured practice environment. The app runs entirely in the browser with no backend, using localStorage for persistence.

---

## Current Architecture

### Files Structure
```
/workspace/
├── index.html          # Main HTML structure (COMPLETE)
├── styles.css          # All styling (COMPLETE)
├── app.js              # Application logic (NEEDS DATA FIX)
├── library-data.js     # Book metadata ONLY (INCOMPLETE - missing tactics/games)
├── build-data.mjs      # Node.js build script (for external use)
└── data/               # MISSING - should contain generated library-data.js
```

### Data Flow
1. `build-data.mjs` scans external chess book directories → generates `data/library-data.js`
2. `index.html` loads `data/library-data.js` → populates `window.CHESS_LIBRARY_DATA`
3. `app.js` reads from `window.CHESS_LIBRARY_DATA` → renders UI

---

## Current Issues Blocking Functionality

### CRITICAL - Missing Data File
- **Problem**: `index.html` line 168 references `<script src="./data/library-data.js"></script>`
- **Reality**: The `data/` directory doesn't exist
- **Impact**: App shows 0 books, 0 tactics, 0 games - completely non-functional

### INCOMPLETE - library-data.js Structure
The existing `library-data.js` only contains:
```javascript
{
  "generatedAt": "...",
  "root": "...",
  "books": [...]  // ~700+ book entries
  // MISSING: tactics: []
  // MISSING: games: []
}
```

Required structure per `app.js` and `build-data.mjs`:
```javascript
{
  generatedAt: "...",
  root: "...",
  books: [...],      // Book/file metadata
  tactics: [...],    // FEN positions with metadata
  games: [...]       // PGN game data
}
```

### Tactics Data Requirements
Each tactic object needs:
```javascript
{
  id: "wcs-1",                    // Unique identifier
  event: "White to move",         // Position description
  fen: "r1bqkb1r/... w KQkq -...", // FEN string
  side: "w",                      // 'w' or 'b'
  source: "1001 Winning Chess...", // Source book
  prompt: "White to move. Find..." // Training prompt
}
```

### Games Data Requirements
Each game object needs:
```javascript
{
  source: "filename.pgn",
  event: "Tournament Name",
  site: "Location",
  date: "2024.01.15",
  white: "Player Name",
  black: "Player Name",
  result: "1-0",
  eco: "B90",
  moves: "1. e4 c5 2. Nf3 ..."   // Cleaned move text
}
```

---

## TODO List

### PHASE 1: Create Sample Data (IMMEDIATE)
- [ ] Create `/workspace/data/` directory
- [ ] Generate sample `library-data.js` with:
  - [ ] Existing books array (copy from current `library-data.js`)
  - [ ] Sample tactics array (at least 10-20 FEN positions for testing)
  - [ ] Sample games array (at least 5-10 PGN games for testing)
- [ ] Update `index.html` script path OR move data file to correct location

### PHASE 2: Verify Core Features
- [ ] Test dashboard view renders stats correctly
- [ ] Test daily plan generation works
- [ ] Test chess board renders with FEN positions
- [ ] Test piece movement on board (click-to-move)
- [ ] Test board flip functionality
- [ ] Test puzzle navigation (prev/next/random)
- [ ] Test Found/Missed marking system
- [ ] Test thinking checklist toggle
- [ ] Test localStorage persistence for marks

### PHASE 3: Library View
- [ ] Test library search/filter functionality
- [ ] Test theme filter dropdown
- [ ] Test format filter dropdown
- [ ] Test theme summary pills display

### PHASE 4: Games View
- [ ] Test games list rendering
- [ ] Test game search functionality
- [ ] Test source filter dropdown
- [ ] Test move text display

### PHASE 5: Train View
- [ ] Test training blocks display
- [ ] Test puzzle range slider
- [ ] Test random puzzle button
- [ ] Test clear marks button

### PHASE 6: Progress View
- [ ] Test progress statistics calculation
- [ ] Test marked positions list
- [ ] Test accuracy percentage
- [ ] Test coverage stats

### PHASE 7: Polish & Edge Cases
- [ ] Handle empty data gracefully
- [ ] Add loading states if needed
- [ ] Test responsive layout on mobile
- [ ] Verify all tab navigation works
- [ ] Test keyboard accessibility
- [ ] Verify image placeholders handle missing files

### PHASE 8: Build Script (Optional Enhancement)
- [ ] Create local test data generator
- [ ] Document how to run `build-data.mjs` with real chess books
- [ ] Add sample PGN file for tactics testing

---

## Feature Specifications

### Dashboard View (`#dashboard`)
**Purpose**: Overview and starting point for training

**Components**:
1. **Stat Grid** (4 cards):
   - Books & files count
   - Tactics FENs count
   - PGN games count
   - Library size in MB

2. **Daily Plan Panel**:
   - 5 training blocks (Tactics, Calculation, Endgames, Openings, Strategy)
   - Each shows: duration, theme icon, source book
   - "Start" button → navigates to Train view

3. **Board Panel**:
   - Interactive chess board (8x8 grid)
   - Position metadata (side to move, puzzle index)
   - Training prompt
   - Action buttons: Found it / Missed / Reveal checklist
   - Navigation: prev/next puzzle, flip board

4. **Image Band**:
   - Reference images for thought process
   - Currently points to external images (may be broken)

### Library View (`#library`)
**Purpose**: Browse and search chess learning materials

**Features**:
- Search input (filters by name, path, theme)
- Theme filter dropdown
- Format filter dropdown (PDF, EPUB, PGN, etc.)
- Theme summary pills showing counts
- Paginated list (max 120 items displayed)

### Train View (`#train`)
**Purpose**: Focused tactics training session

**Features**:
- Training blocks list (same as daily plan)
- Puzzle range slider (1 to total tactics count)
- Random puzzle button
- Clear marks button

### Games View (`#games`)
**Purpose**: Study annotated games

**Features**:
- Search input (players, events, ECO codes)
- Source filter dropdown
- Game list with:
  - Player names
  - Result, ECO, date tags
  - Event name
  - Move text preview (scrollable)

### Progress View (`#progress`)
**Purpose**: Track training performance

**Features**:
- Stats grid:
  - Found count
  - Missed count
  - Accuracy percentage
  - Coverage (touched tactics / total)
- Marked positions list (last 30, sorted by date)

### Board Interaction
**Mechanics**:
- Click piece to select (highlights with gold border)
- Click destination square to move
- Only one piece selected at a time
- No move validation (sandbox mode)
- Board can be flipped vertically

### Persistence
**localStorage Keys**:
- `chessLibraryTrainer.marks`: Object mapping tactic IDs to {value, fen, at, index}
- `chessLibraryTrainer.planSeed`: Number for daily plan randomization

---

## Technical Requirements

### Browser Compatibility
- Modern browsers (ES6+ support required)
- localStorage API
- CSS Grid support
- No external dependencies

### Performance Targets
- Initial load < 2 seconds with sample data
- Smooth board rendering (no lag on piece clicks)
- Filter/search response < 100ms

### Data Limits
- Books: Display max 120 filtered results
- Games: Display max 80 filtered results
- Marks: Show last 30 in progress view

---

## Success Criteria

App is "fully functional" when:
1. ✅ Dashboard loads with accurate statistics
2. ✅ Chess board displays valid FEN positions
3. ✅ Pieces can be moved on the board
4. ✅ Puzzle navigation works (prev/next/random/jump)
5. ✅ Found/Missed buttons save marks to localStorage
6. ✅ Library search and filters work
7. ✅ Games view displays PGN data
8. ✅ Progress view shows accurate statistics
9. ✅ All 5 tabs navigate correctly
10. ✅ Daily plan generates varied training schedules
11. ✅ Responsive design works on mobile/tablet
12. ✅ Data persists across page refreshes

---

## Next Steps

1. **Immediate**: Create `/workspace/data/library-data.js` with sample tactics and games
2. **Test**: Open `index.html` in browser and verify all views
3. **Enhance**: Add more sample data or connect to real chess book collection

---

## Notes

- The app is designed to work with a personal chess book collection
- Build script (`build-data.mjs`) requires Node.js and access to book files
- Sample data should include diverse FEN positions for meaningful testing
- Images referenced in HTML (`../chessthoughtprocesschecklist.png`) may need to be added or handled gracefully
