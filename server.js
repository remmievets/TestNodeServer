'use strict';

const express = require('express');
const sqlite3 = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

//This line did not work - not sure if it is needed for process.env
require('dotenv').config();

const HTTP_HOST = process.env.HTTP_HOST || 'localhost';
const HTTP_PORT = process.env.HTTP_PORT || 8080;
const SITE_NAME = process.env.SITE_NAME || 'Localhost';
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
        board TEXT DEFAULT '---------',
        active BOOLEAN DEFAULT TRUE
    )
`,
).run();

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
        return { raw: result, board: gameState };
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
    corruption: 0,
};

const initialGame = {
    seed: 0,
    deck: [],
    gandalf: [],
    shields: [],
    story: [],
    players: {
        Frodo: structuredClone(initialPlayer),
        Sam: structuredClone(initialPlayer),
        Pipin: structuredClone(initialPlayer),
        Merry: structuredClone(initialPlayer),
        Fatty: structuredClone(initialPlayer),
    },
    loc: 'bagend',
    log: [],
    selectHand: [],
    state: '',
    nextState: '',
    sauron: 15,
    currentPlayer: 'Frodo',
    ringBearer: 'Frodo',
    conflict: {
        fight: 0,
        travel: 0,
        hide: 0,
        friendship: 0,
        eventValue: 0,
        ringUsed: false,
    },
    prompt: {},
};

/// @brief Information about the states of execution in the game
var states = {};

/// @brief All information about the current game
var game;

/// @brief Reduced information of game which is sent to client
var view;

//////////////////////
/* Game helpers */

function get_active_players_in_order() {
    const porder = ['Frodo', 'Sam', 'Pipin', 'Merry', 'Fatty'];
    const start = porder.indexOf(game.ringBearer);

    const orderedPlayers = [];

    // TBD - Check that players are still active
    for (let i = 0; i < porder.length; i++) {
        const idx = (start + i) % porder.length;
        orderedPlayers.push(porder[idx]);
    }

    return orderedPlayers;
}

function distribute_card_from_select(p, cardInt) {
    const index = game.selectHand.indexOf(cardInt);
    if (index === -1) {
        game.number = 0;
        console.error('Card not found in selectHand');
        return;
    }

    // Remove the card from selectHand
    const [removeCard] = game.selectHand.splice(index, 1);

    // Add the card to the target player's hand
    game.players[p].hand.push(removeCard);

    // Decrease the number of remaining actions and execute the state
    game.number = game.number - 1;
}

function discard_card_from_player(p, cardInt) {
    const index = game.players[p].hand.indexOf(cardInt);
    if (index === -1) {
        game.number = 0;
        console.error('Card not found in ${p}');
        return;
    }

    // Remove the card from hand
    const [removeCard] = game.players[p].hand.splice(index, 1);

    // Decrease the number of remaining actions and execute the State
    game.number = game.number - 1;
}

//////////////////////
/* Game State Utility Functions */
function goto_next_state() {
    // Go back to prior state
    game.state = game.nextState;

    // Execute the state
    execute_state(game.state);
}

function advance_state(newState, next = '') {
    // Set next state if provided
    game.nextState = next;

    // Update to new state
    game.state = newState;

    // Execute the new state
    execute_state(game.state);
}

function execute_state(myState) {
    // Lookup state information from array of states
    const state = states[myState];

    // Execute state
    if (state.prompt) {
        // Send updated game information to client
        game.prompt = state.prompt();
    } else {
        game.prompt = null;
    }

    if (!game.prompt && state.auto) {
        // Continue auto execution chain
        state.auto();
    }
}

function execute_button(g, buttonName, args) {
    const state = states[g.state];

    if (state && typeof state[buttonName] === 'function') {
        // Call the function with view and any other needed arguments
        return state[buttonName](args);
    } else {
        throw new Error(`State "${g.state}" does not support move "${buttonName}"`);
    }
}

//////////////////////
/* Game States */
/// States
/// function prompt - required
/// - Return to the user the following if user has an action to perform
///   - message - Message to display to user which describes the action
///   - player <optional> - An indication if this action is limited to one player or a group of players.  If not provided then any player can perform action
///   - buttons <optional> - A list of buttons and the function to call if the user selects the button
///   - action
///     - name - type of action that client needs to implement
///         - "distribute" - distribute <card id> <player name>
///         - "discard" - discard <card id>
///         - "pass" - pass <card id> <player name>
///         - "play" - play <card id> [track, track, track]
///     - cards - A list of cards which can be played / selected by the player(s) to support the action
///     - state.number - The number of remaining actions the player(s) needs to make
/// - Return null if no user action is needed
/// function <button callback>()
///   - Callback function from button press
///   - No parameters
/// function auto - required if prompt returns null
///   - function to call after auto to advance function to the next State

states.action_discard = {
    prompt() {
        // Exit path for this state
        if (game.number <= 0) {
            return null;
        } else {
            return {
                message: `Select ${game.number} cards to discard`,
                player: game.activePlayer,
                buttons: {
                    discard: 'Discard',
                },
                cards: game.players[game.activePlayer].hand.slice(),
            };
        }
    },
    discard(args) {
        // ARGS "cardNumber cardNumber cardNumber ..."
        for (let i = 0; i < args.length; i++) {
            const card = parseInt(args[i], 10); // Convert to int if needed
            discard_card_from_player(game.activePlayer, card);

            // Create log record of transaction
            log(`${game.activePlayer} discard C${card}`);
        }

        // Execute the next state
        execute_state(game.state);
    },
    auto() {
        goto_next_state();
    },
};

states.bagend_gandalf = {
    prompt() {
        // no prompt for client
        return null;
    },
    auto() {
        console.log('GANDOLF');
        // Do initial phase of the game
        log('=t Bag End');
        log('=! Gandalf');
        log('Deal 6 cards to every player');

        // Players in order
        const porder = get_active_players_in_order();

        // Deal cards round-robin until deck is empty
        for (let i = 0; i < 6 * porder.length; i++) {
            const player = porder[i % porder.length];
            set_add(game.players[player].hand, deal_card());
        }

        // Go to next state
        advance_state('bagend_preparations');
    },
};

states.bagend_preparations = {
    prompt() {
        game.number = 0;
        console.log('PREPARATIONS');
        log('=! Preparations');
        return {
            player: game.ringBearer,
            message: 'Roll dice to receive 4 cards or pass',
            buttons: {
                roll: 'Roll die',
                pass: 'Pass',
            },
        };
    },
    roll() {
        // Roll die and process result
        RollDieAndProcessResults(game.ringBearer, 'bagend_preparations_cards');
        // Goto state to deal 4 cards
        advance_state('bagend_preparations_cards');
    },
    pass() {
        log('Ring-bearer passes');
        advance_state('bagend_nazgul_appears');
    },
};

states.bagend_preparations_cards = {
    prompt() {
        // no prompt for client
        return null;
    },
    auto() {
        log('4 Cards available to distribute');
        for (let i = 0; i < 4; i++) {
            set_add(game.selectHand, deal_card());
        }
        game.number = 4;
        advance_state('bagend_preparations_distribute');
    },
};

states.bagend_preparations_distribute = {
    prompt() {
        // Exit path for this state
        if (game.number <= 0) {
            return null;
        } else {
            return {
                message: 'Select cards to distribute',
                buttons: {
                    'distribute Frodo': 'Frodo',
                    'distribute Sam': 'Sam',
                    'distribute Pipin': 'Pipin',
                    'distribute Merry': 'Merry',
                    'distribute Fatty': 'Fatty',
                },
                cards: game.selectHand.slice(),
            };
        }
    },
    distribute(args) {
        // ARGS
        //      player cardNumber cardNumber cardNumber ...
        // Distribute list of cards to player
        const player = args[0];

        for (let i = 1; i < args.length; i++) {
            const card = parseInt(args[i], 10); // Convert to int if needed
            distribute_card_from_select(player, card);

            // Create log record of transaction
            log(`C${card} given to ${player}`);
        }

        // Execute the next state
        execute_state(game.state);
    },
    auto() {
        advance_state('bagend_nazgul_appears');
    },
};

states.bagend_nazgul_appears = {
    // Have player select which player should discard cards
    // Actions are each player which can meet requirement and pass (which moves sauron 1 space)
    prompt() {
        console.log('NAZGUL');
        log('=! Nazgul Appears');
        return {
            message: 'One player discard 2 hiding, otherwise sauron moves 1 space',
            buttons: {
                discard: 'Discard',
                sauron: 'Move Sauron',
            },
        };
    },
    discard() {
        console.log('Discard');
    },
    sauron() {
        log('Sauron moves 1 space');
        game.sauron -= 1;
        advance_state('rivendell_elrond');
    },
};

states.bagend_nazgul_appears_discard = {
    // Player must select 2 hide cards to discard (or wild)
    // Actions are select 2 hide cards from hand, go back to select players
};

states.rivendell_elrond = {
    prompt() {
        // no prompt for client
        return null;
    },
    auto() {
        console.log('ELROND');
        // Do initial phase of the game
        log('=t Rivendell');
        log('=! Elrond');
        log('Deal feature cards');
        let featureDeck = [];
        create_deck(featureDeck, 102, 113);
        shuffle(featureDeck);

        // Players in order
        const porder = get_active_players_in_order();

        // Deal cards round-robin until deck is empty
        let i = 0;
        while (featureDeck.length > 0) {
            const player = porder[i % porder.length];
            let card = featureDeck.pop();
            log(`C${card} given to ${player}`);
            set_add(game.players[player].hand, card);
            i++;
        }

        // Update Location
        game.loc = 'rivendell';

        advance_state('rivendell_council');
    },
};

states.rivendell_council = {
    prompt() {
        log('=! Council');
        return {
            message: 'EACH PLAYER: Pass 1 card to the left',
            buttons: {
                discard: 'Discard',
                sauron: 'Move Sauron',
            },
        };
    },
    discard() {
        log('Discard');
        game.number = 5;
        advance_state('rivendell_fellowship');
    },
    sauron() {
        log('Sauron moves 1 space');
        game.number = 5;
        advance_state('rivendell_fellowship');
    },
};

states.rivendell_fellowship = {
    prompt() {
        log('=! Fellowship');
        return {
            message: 'EACH PLAYER: Discard friendship otherwise roll',
            buttons: {
                discard: 'Discard',
                roll: 'Roll die',
            },
        };
    },
    discard() {
        log('Discard');
        advance_state('moria');
    },
    roll() {
        log('roll die');
        advance_state('moria');
    },
};

states.moria = {};

states.lothlorien_gladriel = {};

states.lothlorien_recovery = {};

states.lothlorien_test_of_gladriel = {};

states.helms_deep = {};

states.shelobs_lair = {};

states.mordor = {};

function RollDieAndProcessResults(p, nextState) {
    let b_roll = roll_d6();
    console.log('Roll ' + p);
    console.log(b_roll);
    log(p + ' rolls a D' + b_roll);
    switch (b_roll) {
        case 1:
            game.players[p].corruption += 1;
            log(p + ' increases corruption by 1 to ' + game.players[p].corruption);
            break;
        case 2:
            if (p === 'Sam') {
                game.players[p].corruption += 1;
                log(p + ' increases corruption by 1 to ' + game.players[p].corruption);
            } else {
                game.players[p].corruption += 2;
                log(p + ' increases corruption by 2 to ' + game.players[p].corruption);
            }
            break;
        case 3:
            if (p === 'Sam') {
                game.players[p].corruption += 1;
                log(p + ' increases corruption by 1 to ' + game.players[p].corruption);
            } else {
                game.players[p].corruption += 3;
                log(p + ' increases corruption by 3 to ' + game.players[p].corruption);
            }
            break;
        case 4:
            // Setup to discard 2 cards
            if (p === 'Sam') {
                game.number = 1;
            } else {
                game.number = 2;
            }
            game.activePlayer = p;
            advance_state('action_discard', nextState);
            break;
        case 5:
            game.sauron -= 1;
            log('Sauron advances to space ' + game.sauron);
            break;
        default:
            break;
    }
    return b_roll;
}

function setup_game() {
    console.log('setup_game');

    // Wipe and reset game variable
    game = structuredClone(initialGame);

    // Create seed
    game.seed = crypto.randomInt(1, 2 ** 35 - 31);

    // Create deck of cards
    create_deck(game.deck, 0, 59);
    shuffle(game.deck);

    // Create deck of story tiles
    create_deck(game.story, 0, 22);
    shuffle(game.story);

    // Create deck of gandalf cards
    create_deck(game.gandalf, 0, 7);

    // Create a special shield list with 2 of each shield type for end of board bonus
    game.shields = [1, 1, 2, 2, 3, 3];
    shuffle(game.shields);

    // Advance to first state and start executing
    advance_state('bagend_gandalf');
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

    res.json({ id: req.params.gameId, board: game });
});

const moveHandlers = {
    BUTTON: (game, button, args) => execute_button(game, button, args),
};

// Make a move
app.post('/move', (req, res) => {
    try {
        const { gameId, move } = req.body;

        // Output infomation about move action
        console.log(`${move}`);

        // Split move into command and arguments
        // Splits by any whitespace
        const parts = move.trim().split(/\s+/);
        const command = parts[0];
        const func = parts[1];
        const args = parts.slice(2);

        // Dispatch to appropriate handler
        const handler = moveHandlers[command];
        if (!handler) throw new Error(`Unknown move command: ${move}`);
        handler(game, func, args);

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
    return (game.seed = (game.seed * 200105) % 34359738337) % range;
}

function random_bigint(range) {
    // Largest MLCG that will fit its state in a double.
    // Uses BigInt for arithmetic, so is an order of magnitude slower.
    // https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-00996-5/S0025-5718-99-00996-5.pdf
    // m = 2**53 - 111
    return (game.seed = Number((BigInt(game.seed) * 5667072534355537n) % 9007199254740881n)) % range;
}

function shuffle(list) {
    // Fisher-Yates shuffle
    for (let i = list.length - 1; i > 0; --i) {
        let j = random(i + 1);
        let tmp = list[j];
        list[j] = list[i];
        list[i] = tmp;
    }
}

function shuffle_bigint(list) {
    // Fisher-Yates shuffle
    for (let i = list.length - 1; i > 0; --i) {
        let j = random_bigint(i + 1);
        let tmp = list[j];
        list[j] = list[i];
        list[i] = tmp;
    }
}

function create_deck(list, startIndex, endIndex) {
    list.length = 0;
    for (let i = startIndex; i <= endIndex; i++) {
        list.push(i);
    }
}

function deal_card() {
    if (game.deck.length === 0) reshuffle_deck();
    return game.deck.pop();
}

function reshuffle_deck() {}

function roll_d6() {
    return random(6) + 1;
}

// Array remove and insert (faster than splice)

function array_remove(array, index) {
    let n = array.length;
    for (let i = index + 1; i < n; ++i) array[i - 1] = array[i];
    array.length = n - 1;
}

function array_insert(array, index, item) {
    for (let i = array.length; i > index; --i) array[i] = array[i - 1];
    array[index] = item;
}

function array_insert_pair(array, index, key, value) {
    for (let i = array.length; i > index; i -= 2) {
        array[i] = array[i - 2];
        array[i + 1] = array[i - 1];
    }
    array[index] = key;
    array[index + 1] = value;
}

// Set as plain sorted array

function set_clear(set) {
    set.length = 0;
}

function set_has(set, item) {
    let a = 0;
    let b = set.length - 1;
    while (a <= b) {
        let m = (a + b) >> 1;
        let x = set[m];
        if (item < x) b = m - 1;
        else if (item > x) a = m + 1;
        else return true;
    }
    return false;
}

function set_add(set, item) {
    let a = 0;
    let b = set.length - 1;
    while (a <= b) {
        let m = (a + b) >> 1;
        let x = set[m];
        if (item < x) b = m - 1;
        else if (item > x) a = m + 1;
        else return;
    }
    array_insert(set, a, item);
}

function set_delete(set, item) {
    let a = 0;
    let b = set.length - 1;
    while (a <= b) {
        let m = (a + b) >> 1;
        let x = set[m];
        if (item < x) b = m - 1;
        else if (item > x) a = m + 1;
        else {
            array_remove(set, m);
            return;
        }
    }
}
