"use strict"

const express = require("express");
const sqlite3 = require("better-sqlite3");
const cors = require("cors");
const path = require("path");

const app = express();
const port = 3000;

const HTTP_HOST = process.env.HTTP_HOST || "localhost"
const HTTP_PORT = process.env.HTTP_PORT || 8080
const SITE_NAME = process.env.SITE_NAME || "Localhost"
const SITE_URL = process.env.SITE_URL || "http://" + HTTP_HOST + ":" + HTTP_PORT

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('games.db');
db.prepare(`
    CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board TEXT DEFAULT '---------',
        current_player TEXT DEFAULT 'X'
    )
`).run();

// Create a new game
app.post('/new-game', (req, res) => {
    const result = db.prepare(`INSERT INTO games (board, current_player) VALUES ('---------', 'X')`).run();
    res.json({ gameId: result.lastInsertRowid, board: '---------', currentPlayer: 'X' });
});

// Get the state of a specific game
app.get('/game/:gameId', (req, res) => {
    const { gameId } = req.params;
    const game = db.prepare(`SELECT * FROM games WHERE id = ?`).get(gameId);

    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ gameId: game.id, board: game.board, currentPlayer: game.current_player });
});

// List all ongoing games
app.get('/games', (req, res) => {
    const games = db.prepare(`SELECT id, board FROM games WHERE board LIKE '%-%'`).all();
    res.json(games);
});

// Make a move
app.post('/move', (req, res) => {
    const { gameId, position } = req.body;

    db.get(`SELECT * FROM games WHERE id = ?`, [gameId], (err, game) => {
        if (err || !game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        let { board, current_player } = game;
        board = board.split('');

        if (board[position] !== '-') {
            return res.status(400).json({ error: 'Invalid move' });
        }

        board[position] = current_player;
        const nextPlayer = current_player === 'X' ? 'O' : 'X';

        const winner = checkWinner(board);
        if (winner) {
            db.run(`DELETE FROM games WHERE id = ?`, [gameId]);
            return res.json({ board: board.join(''), winner });
        }

        db.run(
            `UPDATE games SET board = ?, current_player = ? WHERE id = ?`,
            [board.join(''), nextPlayer, gameId],
            () => {
                res.json({ board: board.join(''), currentPlayer: nextPlayer });
            }
        );
    });
});

// Utility to check for a winner
function checkWinner(board) {
    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (let combination of winningCombinations) {
        const [a, b, c] = combination;
        if (board[a] !== '-' && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    return board.includes('-') ? null : 'Draw';
}

// Start server
app.listen(HTTP_PORT, () => {
    console.log(`Tic-Tac-Toe server running on http://localhost:${HTTP_PORT}`);
});