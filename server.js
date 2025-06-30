"use strict"

const express = require("express");
const sqlite3 = require("better-sqlite3");
const cors = require("cors");
const path = require("path");
const url = require("url");
const crypto = require("crypto")

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
		active BOOLEAN DEFAULT TRUE
    )
`).run();

//////////////////////
/* DATABASE FUNCTIONS */
function create_new_game(gameState) {
	const boardJson = JSON.stringify(gameState);	
    const result = db.prepare(`INSERT INTO games (board) VALUES (?)`).run(boardJson);
	return result;
}

function load_game(gameId) {
    const result = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
	if (result) {
		const gameState = JSON.parse(result.board);
		return {raw: result, board: gameState };
	}
	return null;
}		

function save_game(gameId, gameState) {
	const boardJson = JSON.stringify(gameState);	
	const result = db.prepare(`UPDATE games SET board = ? WHERE id = ?`).run(boardJson, gameId);
	return result;
}

// Database const
const initialPlayer = {
	hand: [],
	rings: 0,
	hearts: 0,
	suns: 0,
	shields: 0,
	corruption: 0
};

const initialGame = {
	seed: 0,
	deck: [],
	gandalf: [],
	lgendary: [],
	shields: [],
	story: [],
	players: {
		"Frodo": structuredClone(initialPlayer), 
		"Sam": structuredClone(initialPlayer), 
		"Pipin": structuredClone(initialPlayer), 
		"Merry": structuredClone(initialPlayer), 
		"Fatty": structuredClone(initialPlayer)
	},
	loc: "bagend",
	log: [],
	state: "",
	sauron: 15,
	curFight : 0,
	curTravel : 0,
	curHide : 0,
	curFriend : 0,
	curEvent : 0,
	currentPlayer : "Frodo",
	ringBearer : "Frodo",
	ringUsed: false,
	prompt : {},
};

/// @brief Information about the states of execution in the game
var states = {};

/// @brief All information about the current game
var game;

/// @brief Reduced information of game which is sent to client
var view;

//////////////////////
/* Game State Stuff */

//////////////////////
/* Game States */
function advance_state(newState) {
	game.state = newState;
	const state = states[newState];
	//console.log(newState);
	
	if (state.prompt) {
		//console.log("prompt");
		game.prompt = state.prompt();
		// Send updated game information to client
	} 
	if (state.auto) {
		// Continue auto execution chain
		//console.log("auto");
		state.auto();
	}
}

function execute_move(view, move) {
	const state = states[view.state];
	
	if (state && typeof state[move] === "function") {
		// Call the function with view and any other needed arguments
		return state[move]();
	} else {
		throw new Error(`State "${view.state}" does not support move "${move}"`);
	}
}

states.bagend_gandalf = {
	prompt() {
		console.log("GANDOLF");
		// Do initial phase of the game
		log("=t Bag End");
		log("=! Gandalf Phase");
		log("Deal 6 cards to every player");
		for (let i = 0; i <6; i++) {
			set_add(game.players.Frodo.hand, deal_card());
			set_add(game.players.Sam.hand, deal_card());
			set_add(game.players.Pipin.hand, deal_card());
			set_add(game.players.Merry.hand, deal_card());
			set_add(game.players.Fatty.hand, deal_card());
		}
		// no prompt for client
		return null; 
	},
	auto() {
		advance_state("bagend_preparations");
	}
}

states.bagend_preparations = {
	prompt() {
		console.log("PREPARATIONS");
		log("=! Preparations");
		return {
			player: game.ringBearer,
			message: "Roll dice to receive 4 cards or pass",
			actions: {
				"roll" : "Roll die",
				"pass" : "Pass"
			}
		};
	},
	roll() {
		console.log("Roll");
	},
	pass() {
		console.log("Pass");
		advance_state("bagend_nazgul_appears");
	}
}

states.bagend_nazgul_appears = {
	// Have player select which player should discard cards
	// Actions are each player which can meet requirement and pass (which moves sauron 1 space)
	prompt() {
		console.log("NAZGUL");
		log("=! Nazgul Appears");
		return {
			message: "One player discard 2 hiding, otherwise sauron moves 1 space",
			actions: {
				"discard" : "Discard",
				"sauron" : "Move Sauron"
			}
		};
	},
	discard() {
		console.log("Discard");
	},
	sauron() {
		console.log("Move sauron 1 space");
		//advance_state("bagend_nazgul_appears");
	}
}

states.bagend_nazgul_appears_discard = {
	// Player must select 2 hide cards to discard (or wild)
	// Actions are select 2 hide cards from hand, go back to select players
}

states.rivendell_elrond = {
}

states.rivendell_council = {
}

states.rivendell_fellowship = {
}

states.moria = {
}

states.lothlorien_gladriel = {
}

states.lothlorien_recovery = {
}

states.lothlorien_test_of_gladriel = {
}

states.helms_deep = {
}

states.shelobs_lair = {
}

states.mordor = {
}

function deal_card() {
	//if (game.deck.length === 0)
	//	reshuffle_deck()
	return game.deck.pop()
}

function setup_game() {
	console.log("setup_game");

	// Wipe and reset game variable
	game = structuredClone(initialGame);
	
	// Create seed
	game.seed = crypto.randomInt(1, 2**35-31)
	
	// Create deck of cards
	create_deck(game.deck, 0, 60);
	shuffle(game.deck);
	
	// Create deck of story tiles
	create_deck(game.story, 0, 23);
	shuffle(game.story);
	
	// Create deck of gandalf cards
	create_deck(game.gandalf, 0, 7);
	
	// Create a special shield list with 2 of each shield type for end of board bonus
	game.shields = [1, 1, 2, 2, 3, 3];
	shuffle(game.shields);
	
	// Advance to first state and start executing
	advance_state("bagend_gandalf");
	//console.log(game);
}


//////////////////////
/* Web Links */

// Main page
app.get('/', (req, res) => {
    console.log(`slash - main page`);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to fetch all games for the homepage
app.get('/games', (req, res) => {
    console.log(`fetch list of games`);
    const games = db.prepare(`SELECT id, board FROM games WHERE active = TRUE`).all();
    res.json(games);
});

// Endpoint to create a new game
app.post('/new-game', (req, res) => {
    console.log(`create a new game`);
	
	// Setup a new game
	setup_game();

	// Save in the database
	const result = create_new_game(game);
	
	// Send information to webpage
    res.json({ gameId: result.lastInsertRowid, board: game });
});

// Get the state of a specific game
app.get('/game/:gameId', (req, res) => {
    console.log(`Get gameId ${req.params.gameId}`);
	const result = load_game(req.params.gameId);
    if (!result) {
        return res.status(404).json({ error: 'Game not found' });
    }
	// set game information to game
	let gameboard = result.board;
	
	// TEMP - Re-setup a new game
	setup_game();
	const save = save_game(req.params.gameId, game);
	// TEMP - end
	
    res.json({id: req.params.gameId, board: game});
});

// Make a move
app.post('/move', (req, res) => {
    try {
		const { gameId, move } = req.body;

		console.log(`Move`);
		console.log(move);
		
		// Based on the game state, execute the function passed
		execute_move(game, move);

        // Respond with the updated board and next player
        res.json({ id: gameId, board: game });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(HTTP_PORT, HTTP_HOST, () => {
    console.log(`Server running on ${HTTP_HOST}:${HTTP_PORT}`);
});

/* COMMON LIBRARY */
function log(s) {
	game.log.push(s);
}

function random(range) {
	// An MLCG using integer arithmetic with doubles.
	// https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-00996-5/S0025-5718-99-00996-5.pdf
	// m = 2**35 − 31
	return (game.seed = game.seed * 200105 % 34359738337) % range
}

function random_bigint(range) {
	// Largest MLCG that will fit its state in a double.
	// Uses BigInt for arithmetic, so is an order of magnitude slower.
	// https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-00996-5/S0025-5718-99-00996-5.pdf
	// m = 2**53 - 111
	return (game.seed = Number(BigInt(game.seed) * 5667072534355537n % 9007199254740881n)) % range
}

function shuffle(list) {
	// Fisher-Yates shuffle
	for (let i = list.length - 1; i > 0; --i) {
		let j = random(i + 1)
		let tmp = list[j]
		list[j] = list[i]
		list[i] = tmp
	}
}

function shuffle_bigint(list) {
	// Fisher-Yates shuffle
	for (let i = list.length - 1; i > 0; --i) {
		let j = random_bigint(i + 1)
		let tmp = list[j]
		list[j] = list[i]
		list[i] = tmp
	}
}

function create_deck(list, startIndex, endIndex) {
	list.length = 0
	for (let i=startIndex; i<endIndex; i++) {
		list.push(i);
	}
}

function roll_d6() {
	return random(6) + 1
}

// Array remove and insert (faster than splice)

function array_remove(array, index) {
	let n = array.length
	for (let i = index + 1; i < n; ++i)
		array[i - 1] = array[i]
	array.length = n - 1
}

function array_insert(array, index, item) {
	for (let i = array.length; i > index; --i)
		array[i] = array[i - 1]
	array[index] = item
}

function array_insert_pair(array, index, key, value) {
	for (let i = array.length; i > index; i -= 2) {
		array[i] = array[i-2]
		array[i+1] = array[i-1]
	}
	array[index] = key
	array[index+1] = value
}

// Set as plain sorted array

function set_clear(set) {
	set.length = 0
}

function set_has(set, item) {
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return true
	}
	return false
}

function set_add(set, item) {
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return
	}
	array_insert(set, a, item)
}

function set_delete(set, item) {
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else {
			array_remove(set, m)
			return
		}
	}
}

