'use strict';

const express = require('express');
const sqlite3 = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const url = require('url');

// Game module
const tba = require('./game.js');

//This line did not work - not sure if it is needed for process.env
require('dotenv').config();

const HTTP_HOST = process.env.HTTP_HOST || '0.0.0.0';
const HTTP_PORT = process.env.HTTP_PORT || 8080;
const SITE_NAME = process.env.SITE_NAME || '0.0.0.0';
const SITE_URL = process.env.SITE_URL || 'http://' + HTTP_HOST + ':' + HTTP_PORT;

// Web server setup
const app = express();

app.locals.SITE_NAME = SITE_NAME;
app.locals.SITE_NAME_P = SITE_NAME.endsWith('!') ? SITE_NAME : SITE_NAME + '.';
app.locals.SITE_URL = SITE_URL;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3('games.db');
db.prepare(
    `
    CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game TEXT DEFAULT '---------',
        active BOOLEAN DEFAULT TRUE
    )
`,
).run();

//////////////////////
/* DATABASE FUNCTIONS */
function create_new_game(game) {
    const gameJson = JSON.stringify(game);
    const result = db.prepare(`INSERT INTO games (game) VALUES (?)`).run(gameJson);
    return result;
}

function load_game(gameId) {
    const result = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (result) {
        const gameParsed = JSON.parse(result.game);
        return gameParsed;
    }
    return null;
}

function save_game(gameId, game) {
    // Do not save inactive game
    if (is_game_active(gameId)) {
        const gameJson = JSON.stringify(game);
        const result = db.prepare(`UPDATE games SET game = ? WHERE id = ?`).run(gameJson, gameId);
    }
}

function is_game_active(gameId) {
    const existing = db.prepare(`SELECT active FROM games WHERE id = ?`).get(gameId);
    if (!existing) {
        console.error(`Game with id ${gameId} not found`);
        return false;
    }
    return existing.active;
}

function deactivate_game(gameId) {
    const result = db.prepare(`UPDATE games SET active = FALSE WHERE id = ?`).run(gameId);
    return result;
}

//////////////////////
/* Web Links */

// Main page
app.get('/', (req, res) => {
    try {
        console.log(`slash - main page`);
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to fetch all games for the homepage
app.get('/games', (req, res) => {
    try {
        console.log(`fetch list of games`);
        const games = db.prepare(`SELECT id, game FROM games WHERE active = TRUE`).all();
        res.json(games);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to create a new game
app.post('/new-game', (req, res) => {
    try {
        // Setup a new game
        const gameDummy = {};
        const result = create_new_game(gameDummy);

        // Now update with actual game information
        const gameData = tba.startGame(result.lastInsertRowid);
        console.log(result.lastInsertRowid);

        // Save in the database
        save_game(result.lastInsertRowid, gameData);

        // Send information to webpage
        const view = tba.getGameView(result.lastInsertRowid);
        res.json({ gameId: result.lastInsertRowid, game: view });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get the state of a specific game
app.get('/game/:gameId', (req, res) => {
    try {
        // Reload from database
        const game = load_game(req.params.gameId);

        // Update the game information back to database state
        tba.updateGame(req.params.gameId, game);

        // Respond with updated board
        const view = tba.getGameView(req.params.gameId);
        res.json({ id: req.params.gameId, game: view });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Make a move
app.post('/move', (req, res) => {
    try {
        const { gameId, move } = req.body;

        const activeGame = is_game_active(gameId);

        // Output infomation about move action
        const game = tba.parseAction(gameId, move);

        if (activeGame) {
            // Save in the database
            save_game(gameId, game);
            // Check if the game status has changed
            if (game.active === false) {
                // Change game to inactive
                deactivate_game(gameId);
            }
        } else {
            game.log.push('GAME OVER');
        }

        // Respond with the updated board
        const view = tba.getGameView(gameId);
        res.json({ id: gameId, game: view });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(HTTP_PORT, HTTP_HOST, () => {
    console.log(`Server running on ${HTTP_HOST}:${HTTP_PORT}`);
});
