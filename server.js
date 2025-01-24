"use strict"

const express = require("express");
const sqlite3 = require("better-sqlite3");
const cors = require("cors");
const path = require("path");
const url = require("url");

//This line did not work - not sure if it is needed for process.env
require("dotenv").config()

const HTTP_HOST = process.env.HTTP_HOST || "localhost"
const HTTP_PORT = process.env.HTTP_PORT || 8080
const SITE_NAME = process.env.SITE_NAME || "Localhost"
const SITE_URL = process.env.SITE_URL || "http://" + HTTP_HOST + ":" + HTTP_PORT

// Web server setup
const app = express();

app.locals.SITE_NAME = SITE_NAME
app.locals.SITE_NAME_P = SITE_NAME.endsWith("!") ? SITE_NAME : SITE_NAME + "."
app.locals.SITE_URL = SITE_URL

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3('games.db');
db.prepare(`
    CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board TEXT DEFAULT '---------',
        current_player TEXT DEFAULT 'X'
    )
`).run();

// Main page
//app.get('/', (req, res) => {
//    console.log(`slash ${req}`);
//    res.sendFile(path.join(__dirname, 'public', 'index.html'));
//});

// Endpoint to fetch all games for the homepage
app.get('/games', (req, res) => {
    console.log(`games ${req}`);
    const games = db.prepare(`SELECT id, board FROM games WHERE board LIKE '%-%'`).all();
    res.json(games);
});

// Endpoint to create a new game
app.post('/new-game', (req, res) => {
    console.log(`new game ${req}`);
    const result = db.prepare(`INSERT INTO games (board, current_player) VALUES ('---------', 'X')`).run();
    res.json({ gameId: result.lastInsertRowid, board: '---------', currentPlayer: 'X' });
});

// Get the state of a specific game
app.get('/game/:gameId', (req, res) => {
    console.log(`gameId ${req}`);
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.gameId);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
});

// Make a move
app.post('/move', (req, res) => {
    console.log(`move ${req}`);
    const { gameId, position } = req.body;

    console.log(`Move`);
    try {
        // Fetch the game from the database
        const game = db.prepare(`SELECT * FROM games WHERE id = ?`).get(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        let { board, current_player } = game;
        board = board.split(''); // Convert the board string into an array

        // Check if the move is valid
        if (board[position] !== '-') {
            return res.status(400).json({ error: 'Invalid move' });
        }

        // Update the board with the current player's move
        board[position] = current_player;
        const nextPlayer = current_player === 'X' ? 'O' : 'X';

        // Check if there is a winner
        const winner = checkWinner(board);
        if (winner) {
            // If there's a winner, delete the game and return the result
            db.prepare(`DELETE FROM games WHERE id = ?`).run(gameId);
            return res.json({ board: board.join(''), winner });
        }

        // Update the game in the database with the new state
        db.prepare(
            `UPDATE games SET board = ?, current_player = ? WHERE id = ?`
        ).run(board.join(''), nextPlayer, gameId);

        // Respond with the updated board and next player
        res.json({ board: board.join(''), currentPlayer: nextPlayer });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
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
app.listen(HTTP_PORT, HTTP_HOST, () => {
    console.log(`Server running on ${HTTP_HOST}:${HTTP_PORT}`);
});