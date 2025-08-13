'use strict';

// Modules
const crypto = require('crypto');

// Game module
const util = require('./public/common/util.js');

//////////////////////
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
        state[buttonName](args);
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
            util.set_add(game.players[player].hand, deal_card());
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
        const dr = RollDieAndProcessResults(game.ringBearer, 'bagend_preparations_cards');

        if (dr !== 4) {
            // Goto state to deal 4 cards
            advance_state('bagend_preparations_cards');
        }
    },
    pass() {
        log('Ring-bearer passes');
        advance_state('bagend_nazgul_appears');
    },
};

states.bagend_preparations_cards = {
    auto() {
        log('4 Cards available to distribute');
        for (let i = 0; i < 4; i++) {
            util.set_add(game.selectHand, deal_card());
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
    auto() {
        console.log('ELROND');
        // Do initial phase of the game
        log('=t Rivendell');
        log('=! Elrond');
        log('Deal feature cards');
        let featureDeck = [];
        create_deck(featureDeck, 102, 113);
        util.shuffle(featureDeck);

        // Players in order
        const porder = get_active_players_in_order();

        // Deal cards round-robin until deck is empty
        let i = 0;
        while (featureDeck.length > 0) {
            const player = porder[i % porder.length];
            let card = featureDeck.pop();
            log(`C${card} given to ${player}`);
            util.set_add(game.players[player].hand, card);
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

states.moria = {
    prompt() {
        log('=! Moria');

        // Update Location
        game.loc = 'moria';
        return {
            message: 'Advance to',
            buttons: {
                next: 'Next',
            },
        };
    },
    auto() {
        log('=! Moria');

        // Update Location
        game.loc = 'moria';
    },
    next() {
        advance_state('helms_deep');
    },
};

states.lothlorien_gladriel = {};

states.lothlorien_recovery = {};

states.lothlorien_test_of_gladriel = {};

states.helms_deep = {
    prompt() {
        log('=! Helms Deep');

        // Update Location
        game.loc = 'helmsdeep';
        return {
            message: 'Advance to',
            buttons: {
                next: 'Next',
            },
        };
    },
    auto() {
        log('=! Helms Deep');

        // Update Location
        game.loc = 'helmsdeep';
    },
    next() {
        advance_state('shelobs_lair');
    },
};

states.shelobs_lair = {
    prompt() {
        log('=! Shelobs Lair');

        // Update Location
        game.loc = 'shelobslair';
        return {
            message: 'Advance to',
            buttons: {
                next: 'Next',
            },
        };
    },
    auto() {
        log('=! Shelobs Lair');

        // Update Location
        game.loc = 'shelobslair';
    },
    next() {
        advance_state('mordor');
    },
};

states.mordor = {
    prompt() {
        log('=! Mordor');

        // Update Location
        game.loc = 'mordor';
        return {
            message: 'Advance to',
            buttons: {
                next: 'Next',
            },
        };
    },
    auto() {
        log('=! Mordor');

        // Update Location
        game.loc = 'mordor';
    },
    next() {
        log('No were to go');
    },
};

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
    util.set_seed(game.seed);

    // Create deck of cards
    create_deck(game.deck, 0, 59);
    util.shuffle(game.deck);

    // Create deck of story tiles
    create_deck(game.story, 0, 22);
    util.shuffle(game.story);

    // Create deck of gandalf cards
    create_deck(game.gandalf, 0, 7);

    // Create a special shield list with 2 of each shield type for end of board bonus
    game.shields = [1, 1, 2, 2, 3, 3];
    util.shuffle(game.shields);

    // Advance to first state and start executing
    advance_state('bagend_gandalf');
}

/* COMMON LIBRARY */
function log(s) {
    game.log.push(s);
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
    return util.random(6) + 1;
}

const moveHandlers = {
    RESET: (game, button, args) => setup_game(),
    BUTTON: (game, button, args) => execute_button(game, button, args),
};

/////////////////////////////////////////
// Functions exposed to server
function startGame(gameId) {
    console.log(`START GAME ${gameId}`);
    setup_game();
    return game;
}

function updateGame(gameId, gameData) {
    console.log(`UPDATE GAME ${gameId}`);
    game = gameData;
}

function getGameView(gameId) {
    console.log(`GAME VIEW ${gameId}`);
    return game;
}

function parseAction(gameId, move) {
    console.log(`PARSE ACTION ${gameId} ${move}`);

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

    return game;
}

/////////////////////////////////////////
// Export the functions
module.exports = {
    startGame,
    updateGame,
    getGameView,
    parseAction,
};
