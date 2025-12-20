'use strict';

// Debug constant - set to 0 to disable
const DEBUG = 1;

// Node core module
import crypto from 'crypto';

// Game modules
import { create_deck, deal_card, draw_x_cards, set_of_player_cards, reshuffle_deck } from './utils/cards.js';
import {
    count_card_type_by_player,
    distribute_card_from_select,
    discard_card_from_player,
    get_active_player_list,
    get_next_player,
    get_active_players_in_order,
    update_player_active,
} from './utils/player.js';
import { save_undo, clear_undo, pop_undo } from './utils/undo.js';
import data from './utils/data.js';
import * as util from './utils/util.js';
import { create_states } from './states/index.js';

//////////////////////
// Database const
const initialPlayer = {
    active: true,
    hand: [],
    ring: 0,
    heart: 0,
    sun: 0,
    shield: 0,
    corruption: 0,
};

const initialGame = {
    seed: 0,
    /// @brief True until the game ends
    active: true,
    /// @brief Full deck of cards (hidden)
    deck: [],
    /// @brief All available gandalf cards
    gandalf: [],
    /// @brief End of conflict board shields (hidden)
    shield: [],
    /// @brief Story tiles for a conflict (hidden)
    story: [],
    /// @brief Player information
    players: {
        Frodo: structuredClone(initialPlayer),
        Sam: structuredClone(initialPlayer),
        Pippin: structuredClone(initialPlayer),
        Merry: structuredClone(initialPlayer),
        Fatty: structuredClone(initialPlayer),
    },
    loc: 'bagend',
    log: [],
    undo: [],
    selectHand: [],
    sauron: 15,
    currentPlayer: 'Frodo',
    ringBearer: 'Frodo',
    /// @brief Conflict board information
    conflict: {
        active: false,
        fight: 0,
        travel: 0,
        hide: 0,
        friendship: 0,
        eventValue: 0,
        ringUsed: false,
    },
    /// @brief Text name of current state
    state: null,
    /// @brief Information about current state
    action: {},
    /// @brief Saved state information if state is pushed to a queue
    stateQueue: [],
    /// @brief Prompt to display for the client
    prompt: null,
};

/// @brief Information about the states of execution in the game
const states = create_states();

/// @brief All information about the current game
var game;

//////////////////////
/* Game setup */

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
    game.shield = [1, 1, 2, 2, 3, 3];
    util.shuffle(game.shield);

    // Advance to first state and start executing
    advance_state('bagend_gandalf');
}

//////////////////////
/* Global game specific functions */

function use_ring_handler() {
    push_advance_state('action_roll_die', { player: game.ringBearer, ring: true });
}

function yellow_handler() {
    // Create global state for yellow cards
}

function undo_handler() {
    pop_undo(game);
}

function debug_handler() {
    push_advance_state('global_debug_menu');
}

const globalButtons = {
    use_ring: use_ring_handler,
    yellow: yellow_handler,
    undo: undo_handler,
    debug: debug_handler,
};

function add_global_buttons(prompt) {
    // If null -> nothing to do
    if (!prompt) return prompt;

    // Skip adding global buttons while inside a global action state
    if (game.state && game.state.startsWith('global_')) {
        return prompt;
    }

    // Ensure buttons object exists
    if (!prompt.buttons) prompt.buttons = {};

    // Add buttons which are global
    // Use Ring
    if (game.conflict.active === true && game.conflict.ringUsed === false) {
        prompt.buttons['use_ring'] = '/gUse Ring';
    }
    // Play Yellow
    prompt.buttons['yellow'] = '/yYellow Card';
    // Undo
    if (game.undo.length > 0) {
        prompt.buttons['undo'] = '/rUNDO';
    }
    // Debug
    if (DEBUG) {
        prompt.buttons['debug'] = '/bDEBUG';
    }

    return prompt;
}

function check_end_of_game() {
    // No active players left
    if (get_active_player_list(game).length == 0) {
        log('All players have become corrupted');
        advance_state('game_end_loss');
    }
    // No active players left
    if (game.players[game.ringBearer].active === false) {
        log('The ring-bearer has become corrupted');
        advance_state('game_end_loss');
    }
}

//////////////////////
/* Common Utility */
function log(message) {
    game.log.push(message);
}

//////////////////////
/* Game Engine Functions */
function make_ctx() {
    // Create wrapper for functions which are needed to inject into states
    return {
        game,
        log,
        advance_state: (s, a = {}) => advance_state(s, a),
        push_advance_state: (s, a = {}) => push_advance_state(s, a),
        resume_previous_state: () => resume_previous_state(),
    };
}

function advance_state(newState, args = null) {
    // Update to new state
    game.state = newState;

    // Clear action information from old State
    game.action = {};

    // If possible execute the initialization function for the state
    const curstate = states[game.state];
    if (curstate?.init) {
        const ctx = make_ctx();
        curstate.init(ctx, args);
    }
}

function push_advance_state(newState, args = null) {
    // Push current State
    game.stateQueue.push({ state: game.state, action: game.action });
    // Switch to new State
    advance_state(newState, args);
}

function resume_previous_state() {
    if (game.stateQueue.length === 0) {
        console.error('Nothing to resume!');
        return;
    }
    const prev = game.stateQueue.pop();
    game.state = prev.state;
    game.action = prev.action;
}

function execute_button(buttonName, args) {
    const ctx = make_ctx();
    const state = states[game.state];

    if (state && typeof state[buttonName] === 'function') {
        // Call the function with view and any other needed arguments
        state[buttonName](ctx, args);
    } else if (typeof globalButtons[buttonName] === 'function') {
        globalButtons[buttonName](args);
    } else {
        throw new Error(`State "${game.state}" does not support move "${buttonName}"`);
    }
}

function execute_state() {
    let curstate;
    const ctx = make_ctx();

    do {
        // Lookup state information from array of states
        curstate = states[game.state];
        if (!curstate) {
            throw new Error(`Unknown state : ${game.state}`);
        }

        // Calculate prompt
        game.prompt = curstate.prompt ? curstate.prompt(ctx) : null;

        // Determine if prompt exists
        if (game.prompt) {
            // Add global buttons
            add_global_buttons(game.prompt);
        } else if (curstate.fini) {
            // Prompt is null and fini exists - call it to switch states
            curstate.fini(ctx);
        }

        // Determine if a players state has changed to inactive
        update_player_active(game);

        // Determine if the game has ended
        if (check_end_of_game() == true) {
            // TBD - end of game
        }
    } while (!game.prompt);
}

/////////////////////////////////////////
// Functions exposed to server
const moveHandlers = {
    RESET: (button, args) => setup_game(),
    BUTTON: (button, args) => execute_button(button, args),
};

export function startGame(gameId) {
    console.log(`START GAME ${gameId}`);
    setup_game();
    execute_state();
    return game;
}

export function updateGame(gameId, gameData) {
    console.log(`UPDATE GAME ${gameId}`);
    game = gameData;
    util.set_seed(game.seed);
    execute_state();
}

export function getGameView(gameId) {
    // Copy fields which client needs only
    let view = structuredClone({
        ...game,
        undo: undefined,
        active: undefined,
        seed: undefined,
        deck: undefined,
        shield: undefined,
        story: undefined,
        state: undefined,
        action: undefined,
        stateQueue: undefined,
    });
    if (DEBUG) {
        view['debug'] = structuredClone({ ...game, undo: undefined });
    }
    return view;
}

export function parseAction(gameId, move) {
    console.log(`PARSE ACTION ${gameId} ${move}`);

    // Split move into command and arguments
    // Splits by any whitespace
    const parts = move.trim().split(/\s+/);
    const command = parts[0];
    const func = parts[1];
    const args = parts.slice(2);

    // Save current state prior to performing the latest action
    // Do not save when undo being performed
    if (func !== 'undo') {
        save_undo(game);
    }

    // Dispatch to appropriate handler
    const handler = moveHandlers[command];
    if (!handler) throw new Error(`Unknown move command: ${move}`);
    handler(func, args);
    execute_state();

    return game;
}
