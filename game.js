'use strict';

// Modules
const crypto = require('crypto');

// Game module
const util = require('./public/common/util.js');
const data = require('./public/data.js');

//////////////////////
// Database const
const initialPlayer = {
    active: true,
    hand: [],
    rings: 0,
    hearts: 0,
    suns: 0,
    shields: 0,
    corruption: 0,
};

const initialGame = {
    seed: 0,
    /// @brief Full deck of cards (hidden)
    deck: [],
    /// @brief All available gandalf cards
    gandalf: [],
    /// @brief End of conflict board shields (hidden)
    shields: [],
    /// @brief Story tiles for a conflict (hidden)
    story: [],
    /// @brief Player information
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
    state: null,
    nextState: { state: null, args: null },
    sauron: 15,
    currentPlayer: 'Frodo',
    ringBearer: 'Frodo',
    /// @brief Conflict board information
    conflict: {
        fight: 0,
        travel: 0,
        hide: 0,
        friendship: 0,
        eventValue: 0,
        ringUsed: false,
    },
    /// @brief Keep track of information for a state
    action: {
        count: 0,
    },
    /// @brief Prompt to display for the client
    prompt: null,
};

/// @brief Information about the states of execution in the game
var states = {};

/// @brief All information about the current game
var game;

//////////////////////
/* Game helpers */

function get_active_player_list() {
    const porder = ['Frodo', 'Sam', 'Pipin', 'Merry', 'Fatty'];
    return porder.filter((p) => game.players[p] && game.players[p].active);
}

function get_next_player(p) {
    const porder = get_active_player_list();
    const start = porder.indexOf(p);
    const idx = (start + 1) % porder.length;
    return porder[idx];
}

function get_active_players_in_order(p) {
    const porder = get_active_player_list();
    const start = porder.indexOf(p);

    const orderedPlayers = [];

    // Add players to ordered list if player is active
    for (let i = 0; i < porder.length; i++) {
        const idx = (start + i) % porder.length;
        orderedPlayers.push(porder[idx]);
    }

    return orderedPlayers;
}

function count_card_type_by_player(p, cardType) {
    let cardValue = 0;
    let cardArray = [];

    for (const c of game.players[p].hand) {
        if (cardType === 'card') {
            cardValue += 1;
            cardArray.push(c);
        } else if (data.cards[c].quest) {
            if (data.cards[c].quest == cardType) {
                cardValue += data.cards[c].count;
                cardArray.push(c);
            } else if (data.cards[c].quest === 'wild') {
                // Include all wild cards into the count
                cardValue += data.cards[c].count;
                cardArray.push(c);
            } else if (p === 'Frodo' && data.cards[c].type === 'white') {
                // Frodo special ability
                cardValue += data.cards[c].count;
                cardArray.push(c);
            }
        }
    }

    return { value: cardValue, cardList: cardArray };
}

function distribute_card_from_select(p, cardInt) {
    const index = game.selectHand.indexOf(cardInt);
    if (index === -1) {
        console.error('Card not found in selectHand');
        return false;
    }

    // Remove the card from selectHand
    const [removeCard] = game.selectHand.splice(index, 1);

    // Add the card to the target player's hand
    game.players[p].hand.push(removeCard);

    return true;
}

/// @brief Lookup card by int number and discard from player hand
/// @return the count value of the card, or -1 if card not found.
function discard_card_from_player(p, cardInt) {
    const index = game.players[p].hand.indexOf(cardInt);
    if (index === -1) {
        console.error('Card not found in ${p}');
        return -1;
    }

    // Remove the card from hand
    const [removeCard] = game.players[p].hand.splice(index, 1);

    let rc = 0;
    if (data.cards[cardInt].count) {
        rc = data.cards[cardInt].count;
    }

    return rc;
}

//////////////////////
/* Game State Utility Functions */
function goto_next_state() {
    // Go back to prior state
    game.state = game.nextState.state;

    // If possible execute the initialization function for the state
    const curstate = states[game.state];
    if (curstate.init) {
        if (game.nextState.args) {
            curstate.init(game.nextState.args);
        } else {
            curstate.init();
        }
    }

    game.nextState.state = null;
    game.nextState.args = null;
}

function set_next_state(state, args = null) {
    // When switching to an action you need to setup the state to enter after the action is complete
    game.nextState.state = state;
    game.nextState.args = args;
}

function advance_state(newState, args = null) {
    // Update to new state
    game.state = newState;

    // If possible execute the initialization function for the state
    const curstate = states[game.state];
    if (curstate.init) {
        if (args) {
            curstate.init(args);
        } else {
            curstate.init();
        }
    }
}

function execute_state() {
    let curstate;

    do {
        // Lookup state information from array of states
        curstate = states[game.state];

        // Execute state
        if (curstate.prompt) {
            game.prompt = curstate.prompt();
        } else {
            game.prompt = null;
        }

        // If prompt is null and fini exists, call it (advance to another state, etc.)
        if (!game.prompt && curstate.fini) {
            curstate.fini();
        }
    } while (!game.prompt);
    //} while (!game.prompt && states[game.state] !== curstate);
    // ^ repeat until we actually have a prompt
    //    (the !== check prevents infinite loops if fini doesn't change state)
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
    init(a) {
        /// a.value - The number of items to Discard
        /// a.type - 'card', or specific card type to discard 'wild'/'hide',etc
        console.log(a);
        game.action.count = a.value;
        game.action.type = a.type;
    },
    prompt() {
        // Find card list
        const cardInfo = count_card_type_by_player(game.currentPlayer, game.action.type);

        // Check that count is not higher than hand size, otherwise adjust count.
        if (game.action.count > cardInfo.value) {
            game.action.count = cardInfo.value;
        }

        // Exit path for this state
        if (game.action.count <= 0) {
            return null;
        } else {
            return {
                message: `Select ${game.action.count} cards to discard`,
                player: game.currentPlayer,
                cards: cardInfo.cardList.slice(),
            };
        }
    },
    card(args) {
        for (let i = 0; i < args.length; i++) {
            const card = parseInt(args[i], 10); // Convert to int if needed
            if (discard_card_from_player(game.currentPlayer, card) >= 0) {
                game.action.count = game.action.count - 1;
            }

            // Create log record of transaction
            log(`${game.currentPlayer} discard C${card}`);
        }
    },
    fini() {
        goto_next_state();
    },
};

states.action_roll_die = {
    init() {
        // Die has not been rolled yet
        game.action.count = -1;
    },
    prompt() {
        /// TBD eventually update the options if certain yellow or gandalf cards are available
        if (game.action.count === -1) {
            return {
                player: game.currentPlayer,
                message: 'Press button to roll die',
                buttons: {
                    roll: 'Roll',
                },
            };
        } else {
            return {
                player: game.currentPlayer,
                message: 'Press button to resolve effects',
                buttons: {
                    resolve: 'Resolve',
                },
            };
        }
    },
    roll() {
        game.action.count = roll_d6();
        console.log('Roll ' + game.action.count);
        log(game.currentPlayer + ' rolls a D' + game.action.count);
    },
    resolve() {
        const p = game.currentPlayer;
        switch (game.action.count) {
            case 1:
                game.players[p].corruption += 1;
                log(p + ' increases corruption by 1 to ' + game.players[p].corruption);
                goto_next_state();
                break;
            case 2:
                if (p === 'Sam') {
                    game.players[p].corruption += 1;
                    log(p + ' increases corruption by 1 to ' + game.players[p].corruption);
                } else {
                    game.players[p].corruption += 2;
                    log(p + ' increases corruption by 2 to ' + game.players[p].corruption);
                }
                goto_next_state();
                break;
            case 3:
                if (p === 'Sam') {
                    game.players[p].corruption += 1;
                    log(p + ' increases corruption by 1 to ' + game.players[p].corruption);
                } else {
                    game.players[p].corruption += 3;
                    log(p + ' increases corruption by 3 to ' + game.players[p].corruption);
                }
                goto_next_state();
                break;
            case 4:
                // Setup to discard 2 cards or 1 if same is rolling
                let discardCount = 2;
                if (p === 'Sam') {
                    discardCount = 1;
                }
                advance_state('action_discard', { value: discardCount, type: 'card' });
                break;
            case 5:
                game.sauron -= 1;
                log('Sauron advances to space ' + game.sauron);
                goto_next_state();
                break;
            default:
                // No damage
                goto_next_state();
                break;
        }
    },
};

states.bagend_gandalf = {
    fini() {
        console.log('GANDOLF');
        // Do initial phase of the game
        log('=t Bag End');
        log('=! Gandalf');
        log('Deal 6 cards to every player');

        // Players in order
        const porder = get_active_players_in_order(game.ringBearer);

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
    init() {
        console.log('PREPARATIONS');
        log('=! Preparations');
        log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    prompt() {
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
        set_next_state('bagend_preparations_cards');
        advance_state('action_roll_die');
    },
    pass() {
        log('Ring-bearer passes');
        advance_state('bagend_nazgul_appears');
    },
};

states.bagend_preparations_cards = {
    fini() {
        log('4 Cards available to distribute');
        for (let i = 0; i < 4; i++) {
            util.set_add(game.selectHand, deal_card());
        }
        advance_state('bagend_preparations_distribute', 4);
    },
};

states.bagend_preparations_distribute = {
    init(cardCount) {
        game.action.count = cardCount;
    },
    prompt() {
        // Exit path for this state
        if (game.action.count <= 0) {
            return null;
        } else {
            return {
                player: game.currentPlayer,
                message: 'Select cards to distribute',
                buttons: {
                    'pick Frodo': 'To Frodo',
                    'pick Sam': 'To Sam',
                    'pick Pipin': 'To Pipin',
                    'pick Merry': 'To Merry',
                    'pick Fatty': 'To Fatty',
                },
                cards: game.selectHand.slice(),
            };
        }
    },
    card(args) {
        const card = parseInt(args[0], 10); // Convert to int if needed
        if (distribute_card_from_select(game.currentPlayer, card)) {
            // Decrease action count if distribute was successful
            game.action.count = game.action.count - 1;
        }

        // Create log record of transaction
        log(`C${card} given to ${game.currentPlayer}`);
    },
    pick(args) {
        const player = args[0];
        game.currentPlayer = player;
    },
    fini() {
        advance_state('bagend_nazgul_appears');
    },
};

states.bagend_nazgul_appears = {
    init() {
        console.log('NAZGUL');
        log('=! Nazgul Appears');
        log('One player must discard 2 hiding or move sauron');
        game.currentPlayer = game.ringBearer;
    },
    prompt() {
        const plist = get_active_players_in_order(game.currentPlayer);

        // Build buttons dynamically
        const buttons = {
            sauron: 'Move Sauron',
        };
        for (const p of plist) {
            const val = count_card_type_by_player(p, 'hide');
            console.log(`${p}: ${val.value}`);

            if (val.value >= 2) {
                buttons[`discard ${p}`] = p;
            }
        }

        return {
            message: 'One player discard 2 hiding, otherwise sauron moves 1 space',
            buttons,
        };
    },
    discard(args) {
        const p = args[0];
        log(`${p} discards 2 hiding`);
        game.currentPlayer = p;
        set_next_state('rivendell_elrond');
        advance_state('action_discard', { value: 2, type: 'hide' });
    },
    sauron() {
        log('Sauron moves 1 space');
        game.sauron -= 1;
        advance_state('rivendell_elrond');
    },
};

states.rivendell_elrond = {
    fini() {
        console.log('ELROND');
        // Do initial phase of the game
        log('=t Rivendell');
        log('=! Elrond');
        log('Deal feature cards');
        let featureDeck = [];
        create_deck(featureDeck, 102, 113);
        util.shuffle(featureDeck);

        // Players in order
        game.currentPlayer = game.ringBearer;
        const porder = get_active_players_in_order(game.ringBearer);

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
    init() {
        log('=! Council');
        log('EACH PLAYER: Pass 1 card face down to left');
        game.currentPlayer = game.ringBearer;
        game.action.count = get_active_player_list().length;
        game.action.pass = [];
    },
    prompt() {
        if (game.action.count > 0) {
            const np = get_next_player(game.currentPlayer);
            const list = game.players[game.currentPlayer].hand.slice();
            return {
                player: game.currentPlayer,
                message: 'Pass 1 card to the left',
                cards: list.slice(),
            };
        } else {
            return null;
        }
    },
    card(args) {
        // Verify the correct value was passed
        if (args.length === 1) {
            // Save a list of each card that was passed to complete this action with
            game.action.pass.push(args[0]);

            // Generate log
            log(`${game.currentPlayer} selects C${args[0]} to pass left`);

            // Decrease count and advance to next player
            game.action.count = game.action.count - 1;
            game.currentPlayer = get_next_player(game.currentPlayer);
        } else {
            console.log('Invalid selection');
        }
    },
    fini() {
        // Initiate all trades
        for (const c of game.action.pass) {
            // Convert to int
            const card = parseInt(c, 10);
            // Discard card from current player
            discard_card_from_player(game.currentPlayer, card);
            // Advance to next player and give them the card
            game.currentPlayer = get_next_player(game.currentPlayer);
            game.players[game.currentPlayer].hand.push(card);
        }

        // Advance to next state
        game.action.pass = [];
        advance_state('rivendell_fellowship', 'first');
    },
};

states.rivendell_fellowship = {
    init(a) {
        console.log(a);
        if (a === 'first') {
            log('=! Fellowship');
            log('EACH PLAYER: Discard 1 friendship or roll die');
            game.currentPlayer = game.ringBearer;
            game.action.count = get_active_player_list().length;
        } else {
            game.action.count = a.cnt;
            game.currentPlayer = a.p;
        }
    },
    prompt() {
        if (game.action.count > 0) {
            // Build buttons dynamically
            const buttons = {
                roll: 'Roll die',
            };

            const cardInfo = count_card_type_by_player(game.currentPlayer, 'friendship');
            return {
                player: game.currentPlayer,
                message: 'Discard friendship or roll die',
                buttons,
                cards: cardInfo.cardList.slice(),
            };
        } else {
            return null;
        }
    },
    card(a) {
        const card = parseInt(a[0], 10); // Convert to int if needed
        if (discard_card_from_player(game.currentPlayer, card) >= 0) {
            game.action.count = game.action.count - 1;

            // Advance to next player
            const np = get_next_player(game.currentPlayer);
            game.currentPlayer = np;

            // Create log record of transaction
            log(`${game.currentPlayer} discard C${card}`);
        }
    },
    roll() {
        // Setup to come back to this state
        const np = get_next_player(game.currentPlayer);
        game.action.count = game.action.count - 1;
        set_next_state('rivendell_fellowship', { p: np, cnt: game.action.count });
        advance_state('action_roll_die');
    },
    fini() {
        advance_state('moria');
    },
};

states.moria = {
    init() {
        log('=t Moria');

        // Setup board
        game.loc = 'moria';

        // Create deck of story tiles
        create_deck(game.story, 0, 22);
        util.shuffle(game.story);

        // Update conflict board spaces
        game.eventValue = 0;
        game.fight = 0;
        game.friendship = 0;
        game.hide = 0;
        game.travel = 0;
        game.ringUsed = false;

        // Start player is ring bearer
        game.currentPlayer = game.ringBearer;
    },
    fini() {
        advance_state('turn_reveal_tiles', 'first');
    },
};

states.turn_reveal_tiles = {
    init(a) {
        if (a === 'first') {
            log(data.players[game.currentPlayer] + ' ' + game.currentPlayer);
        }
    },
    prompt() {
        // Build buttons dynamically
        const buttons = {
            reveal_tile: 'Pull tile',
        };
        // Do we have yellow card or gandalf card that are playable
        /// TBD
        // Can ring be used
        if (game.conflict.ringUsed === false) {
            buttons['use_ring'] = 'Use the one ring';
        }
        return {
            player: game.currentPlayer,
            message: 'Select option',
            buttons,
        };
    },
    reveal_tile() {
        // Pull a tile and advance to resolving the tile
        const t = game.story.pop();
        log('T' + t);
        advance_state('turn_resolve_tile', t);
    },
    use_ring() {
        log('Use ring');
    },
};

states.turn_resolve_tile = {
    init(a) {
        // Save the tile we are attempting to resolve
        game.action.lasttile = a;
    },
    prompt() {
        // Build buttons dynamically
        const buttons = {
            resolve_tile: 'Resolve',
        };
        // Do we have yellow card or gandalf card that are playable
        /// TBD
        // Can ring be used
        if (game.conflict.ringUsed === false) {
            buttons['use_ring'] = 'Use the one ring';
        }
        return {
            player: game.currentPlayer,
            message: 'Select option',
            buttons,
        };
    },
    resolve_tile() {
        console.log(game.action.lasttile);
        console.log(data.tiles[game.action.lasttile]);
        log('resolve tile ' + data.tiles[game.action.lasttile].type);
    },
    use_ring() {
        log('Use ring');
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
    fini() {
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
    fini() {
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
    fini() {
        log('=! Mordor');

        // Update Location
        game.loc = 'mordor';
    },
    next() {
        log('No were to go');
    },
};

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
    execute_state();
    return game;
}

function updateGame(gameId, gameData) {
    console.log(`UPDATE GAME ${gameId}`);
    game = gameData;
    util.set_seed(game.seed);
    execute_state();
}

function getGameView(gameId) {
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
    execute_state();

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
