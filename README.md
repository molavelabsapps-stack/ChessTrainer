# Chess Library Trainer

A local web app built from this chess-book collection.

Open `index.html` in a browser to use the trainer. The app includes:

- a collection dashboard grouped by training theme
- 1001 real FEN tactics from `1001 Winning Chess Sacrifices & Combinations`
- PGN game browsing from the PGN files in the collection
- a board workspace for visualizing candidate moves
- local progress marks saved in the browser

To rebuild the collection snapshot after adding books, run this from the `ChessLibraryTrainer` folder:

```powershell
node .\scripts\build-data.mjs
```
