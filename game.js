'use strict';

// Debug constant - set to 0 to disable
const DEBUG = 1;

// Node core module
import crypto from 'crypto';

// Game modules
import { create_deck, deal_card, draw_x_cards, set_of_player_cards, reshuffle_deck } from './utils/cards.js';
import { get_board_active_quests, is_path_complete, resolve_reward } from './utils/board.js';
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
var states = {};

/// @brief All information about the current game
var game;

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
        /// a.player - Identify the player who needs to discard (optional).  Current player is not used
        /// a.count - The number of items to Discard
        /// a.type - 'card', or specific card type to discard 'wild'/'hide',etc
        game.action.player = a.player ?? game.currentPlayer;
        game.action.count = a.count;
        game.action.type = a.type;
    },
    prompt() {
        // Find card list
        const cardInfo = count_card_type_by_player(game, game.action.player, game.action.type);

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
                player: game.action.player,
                cards: cardInfo.cardList.slice(),
            };
        }
    },
    card(cardArray) {
        for (let i = 0; i < cardArray.length; i++) {
            const cardInt = parseInt(cardArray[i], 10); // Convert to int if needed
            if (discard_card_from_player(game, game.action.player, cardInt) >= 0) {
                game.action.count = game.action.count - 1;
            }

            // Create log record of transaction
            log(`${game.action.player} discard C${cardInt}`);
        }
    },
    fini() {
        resume_previous_state();
    },
};

states.action_discard_group = {
    init(a) {
        /// a.count - The number of items to Discard
        /// a.type - 'card', or specific card type to discard 'wild'/'hide',etc
        /// a.cardArray - The available cards which can be discarded
        game.action.count = a.count;
        game.action.type = a.type;
    },
    prompt() {
        // Exit path for this state
        if (game.action.count <= 0) {
            return null;
        }

        // Get list of cards for the entire group of active players
        const players = get_active_player_list(game);
        let allCards = [];

        for (const p of players) {
            const cardInfo = count_card_type_by_player(game, p, game.action.type);
            allCards.push(...cardInfo.cardList);
        }

        return {
            message: `Select ${game.action.count} cards to discard`,
            cards: allCards.slice(),
        };
    },
    card(cardArray) {
        for (let i = 0; i < cardArray.length; i++) {
            const cardInt = parseInt(cardArray[i], 10); // Convert to int if needed

            let pArray = get_active_player_list(game);
            for (let p of pArray) {
                // Attempt to discard from player
                if (discard_card_from_player(game, p, cardInt) >= 0) {
                    // Decrease card count
                    game.action.count = game.action.count - 1;

                    // Create log record of transaction
                    log(`${p} discard C${cardInt}`);
                    break;
                }
            }
        }
    },
    fini() {
        resume_previous_state();
    },
};

states.action_roll_die = {
    init(a) {
        // Save parameters
        game.action.player = a.player ?? game.currentPlayer;
        game.action.ring = a.ring ?? false;
        game.action.roll_skip = a.roll_skip ?? false;
        // If ring then
        if (game.action.ring) {
            // Mark it used
            game.conflict.ringUsed = true;
        }
        if (game.action.roll_skip) {
            // Skip dialog to roll dice
            game.action.count = util.roll_d6();
            log(game.action.player + ' rolls a D' + game.action.count);
        } else {
            // Die has not been rolled yet
            game.action.count = -1;
        }
        // Resolution of die has not been completed
        game.action.resolved = false;
    },
    prompt() {
        const buttons = {};
        if (game.action.count === -1) {
            buttons['roll'] = 'Roll';
        } else if (game.action.resolved === false) {
            buttons['resolve'] = 'Resolve';
        } else if (game.action.ring === true) {
            buttons['ringit'] = 'RING ME';
        } else {
            return null;
        }
        // Return prompt information
        return {
            player: game.action.player,
            message: 'Select option',
            buttons,
        };
    },
    roll() {
        game.action.count = util.roll_d6();
        console.log('Roll ' + game.action.count);
        log(game.action.player + ' rolls a D' + game.action.count);
    },
    resolve() {
        game.action.resolved = true;
        const p = game.action.player;
        switch (game.action.count) {
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
                // Setup to discard 2 cards or 1 if same is rolling
                let discardCount = 2;
                if (p === 'Sam') {
                    discardCount = 1;
                }
                push_advance_state('action_discard', { count: discardCount, type: 'card' });
                break;
            case 5:
                game.sauron -= 1;
                log('Sauron advances to space ' + game.sauron);
                break;
            default:
                // No damage
                break;
        }
    },
    ringit() {
        // TBD - Figure out which track to advance on
        resume_previous_state();
    },
    fini() {
        resume_previous_state();
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
        const porder = get_active_players_in_order(game, game.ringBearer);

        // Deal cards round-robin until deck is empty
        for (let i = 0; i < 6 * porder.length; i++) {
            const player = porder[i % porder.length];
            util.set_add(game.players[player].hand, deal_card(game));
        }

        // Go to next state
        advance_state('bagend_preparations');
    },
};

states.bagend_preparations = {
    init(a) {
        console.log('PREPARATIONS');
        log('=! Preparations');
        log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    prompt() {
        return {
            player: game.ringBearer,
            message: 'Roll dice to receive 4 cards or pass',
            buttons: {
                roll: 'Roll',
                pass: 'Pass',
            },
        };
    },
    roll() {
        // Once we roll we are done with this current state, so setup next state
        advance_state('bagend_preparations_cards');
        // Now push state to queue and interrupt with dice roll
        push_advance_state('action_roll_die', { roll_skip: true });
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
            util.set_add(game.selectHand, deal_card(game));
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
                    'pick Pippin': 'To Pippin',
                    'pick Merry': 'To Merry',
                    'pick Fatty': 'To Fatty',
                },
                cards: game.selectHand.slice(),
            };
        }
    },
    card(cardArray) {
        const cardInt = parseInt(cardArray[0], 10); // Convert to int if needed
        if (distribute_card_from_select(game, game.currentPlayer, cardInt)) {
            // Decrease action count if distribute was successful
            game.action.count = game.action.count - 1;
        }

        // Create log record of transaction
        log(`C${cardInt} given to ${game.currentPlayer}`);
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
    init(a) {
        console.log('NAZGUL');
        log('=! Nazgul Appears');
        log('One player must discard 2 hiding or move sauron');
        game.currentPlayer = game.ringBearer;
    },
    prompt() {
        // Build buttons dynamically
        const buttons = {
            sauron: 'Move Sauron',
        };

        // Determine which players are active and have cards to play this action
        const plist = get_active_players_in_order(game, game.currentPlayer);
        for (const p of plist) {
            const val = count_card_type_by_player(game, p, 'hide');
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
        advance_state('rivendell_elrond');
        push_advance_state('action_discard', { count: 2, type: 'hide' });
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
        const porder = get_active_players_in_order(game, game.ringBearer);

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
    init(a) {
        log('=! Council');
        log('EACH PLAYER: Pass 1 card face down to left');
        game.currentPlayer = game.ringBearer;
        game.action.count = get_active_player_list(game).length;
        game.action.pass = [];
    },
    prompt() {
        if (game.action.count > 0) {
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
            game.currentPlayer = get_next_player(game, game.currentPlayer);
        } else {
            console.log('Invalid selection');
        }
    },
    fini() {
        // Initiate all trades
        for (const c of game.action.pass) {
            // Convert to int
            const cardInt = parseInt(c, 10);
            // Discard card from current player
            discard_card_from_player(game, game.currentPlayer, cardInt);
            // Advance to next player and give them the card
            game.currentPlayer = get_next_player(game, game.currentPlayer);
            util.set_add(game.players[game.currentPlayer].hand, cardInt);
        }

        // Advance to next state
        game.action.pass = [];
        advance_state('rivendell_fellowship', 'first');
    },
};

states.rivendell_fellowship = {
    init(a) {
        if (a === 'first') {
            log('=! Fellowship');
            log('EACH PLAYER: Discard 1 friendship or roll die');
            game.currentPlayer = game.ringBearer;
            game.action.count = get_active_player_list(game).length;
        } else {
            // Come back into this state from roll action
            game.action.count = a.cnt;
            game.currentPlayer = a.p;
        }
    },
    prompt() {
        if (game.action.count > 0) {
            // Build buttons dynamically
            const buttons = {
                roll: 'Roll',
            };

            const cardInfo = count_card_type_by_player(game, game.currentPlayer, 'friendship');
            return {
                player: game.currentPlayer,
                message: 'Discard friendship or roll',
                buttons,
                cards: cardInfo.cardList.slice(),
            };
        } else {
            return null;
        }
    },
    card(cardArray) {
        const cardInt = parseInt(cardArray[0], 10); // Convert to int if needed
        if (discard_card_from_player(game, game.currentPlayer, cardInt) >= 0) {
            // Create log record of transaction
            log(`${game.currentPlayer} discards C${cardInt}`);
            // Decrease count and advance to next player
            game.action.count = game.action.count - 1;
            game.currentPlayer = get_next_player(game, game.currentPlayer);
        }
    },
    roll() {
        // Setup to come back to this state
        game.action.count = game.action.count - 1;
        const np = get_next_player(game, game.currentPlayer);
        advance_state('rivendell_fellowship', { p: np, cnt: game.action.count });
        push_advance_state('action_roll_die', { roll_skip: true });
    },
    fini() {
        advance_state('conflict_board_start', { name: 'Moria', loc: 'moria' });
    },
};

states.lothlorien_gladriel = {
    fini() {
        console.log('GLADRIEL');
        // Do initial phase of the game
        log('=t lothlorien');
        log('=! Gladriel');
        log('Deal feature cards');
        let featureDeck = [];
        create_deck(featureDeck, 85, 96);
        util.shuffle(featureDeck);

        // Players in order
        game.currentPlayer = game.ringBearer;
        const porder = get_active_players_in_order(game, game.ringBearer);

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
        game.loc = 'lothlorien';

        advance_state('lothlorien_recovery');
    },
};

states.lothlorien_recovery = {
    init(a) {
        log('=! Recovery');
        log('EACH PLAYER: May discard 2 shields to either draw 2 hobbit cards or heal');
        game.currentPlayer = game.ringBearer;
        game.action.count = get_active_player_list(game).length;
    },
    prompt() {
        if (game.action.count > 0) {
            // Build buttons dynamically
            const buttons = {
                pass: 'Next',
            };
            // First check if player has 2 shields
            if (game.players[game.currentPlayer].shield >= 2) {
                buttons['card'] = 'Discard shields to gain 2 cards';
                if (game.players[game.currentPlayer].corruption > 0) {
                    buttons['heal'] = 'Discard shields to heal 1 space';
                }
            }
            // Determine if buttons should be given
            return {
                player: game.currentPlayer,
                message: 'Optionally, discard 2 shields to draw 2 hobbit cards or heal',
                buttons,
            };
        } else {
            return null;
        }
    },
    pass() {
        // Players turn has completed - skipped option
        log(`${game.currentPlayer} passes`);
        // Decrease count and advance to next player
        game.action.count = game.action.count - 1;
        game.currentPlayer = get_next_player(game, game.currentPlayer);
    },
    card() {
        log(`${game.currentPlayer} discards 2 shields to draw 2 cards`);
        game.players[game.currentPlayer].shield = game.players[game.currentPlayer].shield - 2;
        // Deal 2 cards
        draw_x_cards(game, game.currentPlayer, 2);
        // Decrease count and advance to next player
        game.action.count = game.action.count - 1;
        game.currentPlayer = get_next_player(game, game.currentPlayer);
    },
    heal() {
        log(`${game.currentPlayer} discards 2 shields to heal 1 space`);
        game.players[game.currentPlayer].shield = game.players[game.currentPlayer].shield - 2;
        game.players[game.currentPlayer].corruption = game.players[game.currentPlayer].corruption - 1;
        // Decrease count and advance to next player
        game.action.count = game.action.count - 1;
        game.currentPlayer = get_next_player(game, game.currentPlayer);
    },
    fini() {
        // Advance to next state
        advance_state('lothlorien_test_of_gladriel', 'first');
    },
};

states.lothlorien_test_of_gladriel = {
    init(a) {
        if (a === 'first') {
            log('=! Test of Galadriel');
            log('EACH PLAYER: Discard WILD otherwise roll die');
            game.currentPlayer = game.ringBearer;
            game.action.count = get_active_player_list(game).length;
        } else {
            // Come back into this state from roll action
            game.action.count = a.cnt;
            game.currentPlayer = a.p;
        }
    },
    prompt() {
        if (game.action.count > 0) {
            // Build buttons dynamically
            const buttons = {
                roll: 'Roll',
            };
            const cardInfo = count_card_type_by_player(game, game.currentPlayer, 'wild');
            return {
                player: game.currentPlayer,
                message: 'Discard wild quest card or roll',
                buttons,
                cards: cardInfo.cardList.slice(),
            };
        } else {
            return null;
        }
    },
    roll() {
        // Setup to come back to this state
        game.action.count = game.action.count - 1;
        const np = get_next_player(game, game.currentPlayer);
        advance_state('lothlorien_test_of_gladriel', { p: np, cnt: game.action.count });
        push_advance_state('action_roll_die', { roll_skip: true });
    },
    card(cardArray) {
        const cardInt = parseInt(cardArray[0], 10); // Convert to int if needed
        if (discard_card_from_player(game, game.currentPlayer, cardInt) >= 0) {
            // Create log record of transaction
            log(`${game.currentPlayer} discards C${cardInt}`);
            // Decrease count and advance to next player
            game.action.count = game.action.count - 1;
            game.currentPlayer = get_next_player(game, game.currentPlayer);
        }
    },
    fini() {
        // Advance to next state
        advance_state('conflict_board_start', { name: 'Helms Deep', loc: 'helmsdeep' });
    },
};

states.new_player_turn = {
    init(a) {
        log(data.players[game.currentPlayer] + ' ' + game.currentPlayer);
    },
    fini() {
        // Advance to next state
        advance_state('turn_reveal_tiles');
    },
};

states.turn_reveal_tiles = {
    init(a) {
        // No action needed currently
    },
    prompt() {
        // Build buttons dynamically
        const buttons = {
            reveal_tile: 'Pull tile',
        };
        return {
            player: game.currentPlayer,
            message: 'Select option',
            buttons,
        };
    },
    reveal_tile() {
        // Pull a tile and advance to resolving the tile
        const t = game.story.pop();
        log(game.currentPlayer + ' draws a tile');
        log('T' + t);
        advance_state('turn_resolve_tile', { lasttile: t, number: 0 });
    },
};

states.turn_resolve_tile = {
    init(a) {
        // Save the tile we are attempting to resolve
        game.action.lasttile = a.lasttile;
        // Keep track of count for discard (so far no discards)
        game.action.number = a.number;
    },
    prompt() {
        // Build buttons dynamically
        const buttons = {};
        // Does the tile contain options?
        const t = data.tiles[game.action.lasttile].type;
        switch (t) {
            case 'ring':
                // Default action
                buttons['resolve_ring'] = 'Resolve Tile';
                break;
            case 'event':
                // Default action
                buttons['resolve_event'] = 'Resolve Tile';
                break;
            case 'event_cards':
                // Discard 3 cards as a group
                // Make sure the group has 3 cards to discard
                if (set_of_player_cards(game).size >= 3) {
                    buttons['avoid_event_cards'] = 'Discard Cards';
                }
                // Default action
                buttons['resolve_event'] = 'Resolve Tile';
                break;
            case 'event_life':
                // Discard 1 card, 1 life token, 1 shield as a group
                // Make sure the group has the required items to discard
                if (set_of_player_cards(game).size >= 1) {
                    // TBD - Make sure 1 life token and 1 shield
                    buttons['avoid_event_items'] = 'Discard Items';
                }
                // Default action
                buttons['resolve_event'] = 'Resolve Tile';
                break;
            case 'sauron':
                // Move sauron or one player takes 2 corruption
                // Determine which players are active and can take corruption
                const plist = get_active_players_in_order(game, game.currentPlayer);
                for (const p of plist) {
                    buttons[`resolve_corruption ${p}`] = p;
                }
                buttons['resolve_sauron'] = 'Move Sauron';
                break;
            default:
                // Good tile - determine if tile is on board
                // If game includes board element and it is not complete
                //      Allow only one option for advance on single path
                // else
                //      Allow advancement on any not completed path on the board
                if (is_path_complete(game, t) === false) {
                    buttons[`resolve_path ${t}`] = 'Resolve Tile';
                } else {
                    // Player can advance any track that is not complete
                    for (const path of data.tracks) {
                        // Is this path an option to be selected
                        if (is_path_complete(game, path) === false) {
                            buttons[`resolve_path ${path}`] = `Resolve as ${path}`;
                        }
                    }
                }
                break;
        }
        // Return prompt information
        return {
            player: game.currentPlayer,
            message: 'Select option',
            buttons,
        };
    },
    resolve_ring() {
        // Corrupt ring bearer
        log(game.ringBearer + ' increases corruption by 1');
        game.players[game.ringBearer].corruption += 1;
        // Draw another tile
        advance_state('turn_reveal_tiles');
    },
    avoid_event_cards() {
        // Draw another tile after interrupting the action
        advance_state('turn_reveal_tiles');

        // Interrupt action with discarding the 3 cards
        push_advance_state('action_discard_group', { count: 3, type: 'card' });
    },
    avoid_event_items() {
        // Draw another tile after interrupting the action
        advance_state('turn_reveal_tiles');

        // Interrupt action with discarding the 1 shield
        //push_advance_state('action_discard_item_group', { count: 1, type: 'shield' });    TBD - Discard shield

        // Interrupt action with discarding the 1 life token
        //push_advance_state('action_discard_item_group', { count: 1, type: 'life_token' });    TBD - Discard life token

        // Interrupt action with discarding the 1 card
        push_advance_state('action_discard_group', { count: 1, type: 'card' });
    },
    resolve_event() {
        log('resolve event ' + data.tiles[game.action.lasttile].type);
        game.conflict.eventValue += 1;
        // TBD - resolve event
        // Next state
        if (game.conflict.eventValue < 6) {
            // Draw another tile
            advance_state('turn_reveal_tiles');
        } else {
            // End of board
            advance_state('conflict_board_end');
        }
    },
    resolve_corruption(p) {
        log(p + ' increases corruption by 2');
        game.players[p].corruption += 2;
        // Draw another tile
        advance_state('turn_reveal_tiles');
    },
    resolve_sauron() {
        game.sauron -= 1;
        log('Sauron moves to ' + game.sauron);
        // Draw another tile
        advance_state('turn_reveal_tiles');
    },
    resolve_path(t) {
        const path = t[0];
        // Advance on desired track and claim rewards/items
        if (data[game.loc][path]) {
            // Advance path
            game.conflict[path] += 1;
            // Get reward
            if (resolve_reward(game, path) === false) {
                // Need to roll dice and advance to next turn phase
                //TBD - resolve roll dice
            } else {
                // Advance to next turn phase
                //TBD - tile
            }
            advance_state('turn_play', 'first');
        }
    },
};

states.turn_play = {
    init(a) {
        if (a === 'first') {
            game.action.phase = 'pick';
        }
    },
    prompt() {
        // Build buttons dynamically
        const buttons = {};
        if (game.action.phase === 'pick') {
            buttons['play'] = 'Play cards';
            buttons['draw'] = 'Draw 2 cards';
            buttons['heal'] = 'Heal';
            // Have player select an option - play/draw/heal
            return {
                player: game.currentPlayer,
                message: 'Select option',
                buttons,
            };
        } else if (game.action.phase === 'play') {
            buttons['pass'] = 'Pass';
            // Only allow player to play a valid card based on active quests/paths
            const cardInfo = count_card_type_by_player(game, game.currentPlayer, get_board_active_quests(game), game.action.filter);
            return {
                player: game.currentPlayer,
                message: `Play ${game.action.count} cards`,
                buttons,
                cards: cardInfo.cardList.slice(),
            };
        } else if (game.action.phase === 'path') {
            buttons['pass'] = 'Pass';
            return {
                player: game.currentPlayer,
                message: `Play ${game.action.count} cards`,
                buttons,
            };
        } else {
            // Completed playing cards - return null to end phase
            return null;
        }
    },
    pass() {
        // Action is complete
        game.action.phase = 'complete';
    },
    play() {
        // Select two cards
        game.action.phase = 'play';
        game.action.filter = ['white', 'grey'];
        game.action.count = 2;
    },
    card(cardArray) {
        const cardInt = parseInt(cardArray[0], 10); // Convert to int if needed
        const cardValue = discard_card_from_player(game, game.currentPlayer, cardInt);
        if (cardValue >= 0) {
            // Create log record of transaction
            log(`${game.currentPlayer} plays C${cardInt}`);
            // Keep track of which card was played unless pippin is the current player
            const cardData = data.cards[cardInt];
            if (game.currentPlayer !== 'Pippin') {
                game.action.filter = game.action.filter.filter((t) => t !== cardData.type);
            }

            // Frodo: treat white as wild
            const isFrodoWild = game.currentPlayer === 'Frodo' && cardData.type === 'white';
            if (cardData.quest === 'wild' || isFrodoWild) {
                // Have user pick track
                log('WILD');
            } else {
                // Auto advance track
                log('NO-WILD');
            }
            // Decrease count and check if both cards were played
            game.action.count = game.action.count - 1;
            if (game.action.count === 0) {
                // Action is complete
                game.action.phase = 'complete';
            }
        }
    },
    playcards(c) {
        const card = parseInt(c[0], 10); // Convert to int if needed
    },
    draw() {
        // Draw 2 cards
        draw_x_cards(game, game.currentPlayer, 2);
        // Action is complete
        game.action.phase = 'complete';
    },
    heal() {
        if (game.players[game.currentPlayer].corruption > 0) {
            game.players[game.currentPlayer].corruption -= 1;
        }
        // Action is complete
        game.action.phase = 'complete';
    },
    fini() {
        // Advance to next Player
        game.currentPlayer = get_next_player(game, game.currentPlayer);
        advance_state('new_player_turn');
    },
};

states.conflict_board_start = {
    init(a) {
        log(`=t ${a.name}`);

        // Setup board
        game.loc = a.loc;

        // Create deck of story tiles
        create_deck(game.story, 0, 22);
        util.shuffle(game.story);

        // Update conflict board spaces
        game.conflict.active = true;
        game.conflict.eventValue = 0;
        game.conflict.fight = 0;
        game.conflict.friendship = 0;
        game.conflict.hide = 0;
        game.conflict.travel = 0;
        game.conflict.ringUsed = false;

        // Start player is ring bearer
        game.currentPlayer = game.ringBearer;
    },
    fini() {
        // Start player turns
        advance_state('new_player_turn');
    },
};

states.conflict_decent_into_darkness = {
    init(a) {
        game.action.corruption = a.corruption;
        game.action.player = a.player;
    },
    prompt() {
        // Build buttons dynamically
        const buttons = {
            next: 'Next',
        };
        return {
            player: game.action.player,
            message: `${game.action.player} increase corruption by ${game.action.corruption}`,
            buttons,
        };
    },
    next() {
        game.players[game.action.player].corruption += game.action.corruption;
        log(
            `${game.action.player} increases corruption by ${game.action.corruption} to ${game.players[game.action.player].corruption}`,
        );
        resume_previous_state();
    },
};

states.conflict_board_end = {
    init(a) {
        // Conflict board is no longer active
        game.conflict.active = false;
        // Descent into darkness
        // Loop through each player and apply 1 corruption for each missing life token
        const plist = get_active_players_in_order(game, game.ringBearer);
        plist.reverse();
        for (const p of plist) {
            let lifeTokenCount = 0;
            if (game.players[p].ring > 0) {
                lifeTokenCount++;
            }
            if (game.players[p].heart > 0) {
                lifeTokenCount++;
            }
            if (game.players[p].sun > 0) {
                lifeTokenCount++;
            }
            let corruptionDamage = 3 - lifeTokenCount;
            if (p === 'Merry' && corruptionDamage > 0) {
                corruptionDamage = corruptionDamage - 1;
            }
            push_advance_state('conflict_decent_into_darkness', { corruption: corruptionDamage, player: p });
        }
    },
    fini() {
        // Determine the next ring-bearer (current ring-bearer always loses ties)
        let plist = get_active_players_in_order(game, game.ringBearer);
        let winner = plist[0]; // start with first
        let maxRings = game.players[winner].ring;

        for (let i = plist.length - 1; i > 0; i--) {
            const p = plist[i];
            if (game.players[p].ring >= maxRings) {
                winner = p;
                maxRings = game.players[p].ring;
            }
        }

        // Make current player the new ring-bearer
        log(`${winner} becomes the next ring-bearer`);
        game.ringBearer = winner;
        game.currentPlayer = game.ringBearer;

        // Ring-bearer gets 2 new cards
        draw_x_cards(game, game.ringBearer, 2);

        // Fatty if active gets 2 new cards
        if (game.players.Fatty.active) {
            draw_x_cards(game, 'Fatty', 2);
        }

        // Return all Heart, Sun, and Ring tokens to zero for each player
        plist = get_active_players_in_order(game, game.currentPlayer);
        for (const p of plist) {
            game.players[p].heart = 0;
            game.players[p].sun = 0;
            game.players[p].ring = 0;
        }

        // Determine next state, based on current location
        switch (game.loc) {
            case 'moria':
                advance_state('lothlorien_gladriel');
                break;
            case 'helmsdeep':
                advance_state('conflict_board_start', { name: 'Shelobs Lair', loc: 'shelobslair' });
                break;
            case 'shelobslair':
                advance_state('conflict_board_start', { name: 'Mordor', loc: 'mordor' });
                break;
            case 'mordor':
                advance_state('game_end_loss');
                break;
        }
    },
};

states.game_end_loss = {
    init(a) {
        log('SAURON HAS WON');
    },
    prompt() {
        return {
            message: 'GAME OVER - LOST',
        };
    },
};

states.game_end_win = {
    init(a) {
        log('The Free People have destroyed the RING');
    },
    prompt() {
        return {
            message: 'GAME OVER - WON',
        };
    },
};

states.global_debug_menu = {
    prompt() {
        // Build buttons dynamically
        const buttons = {};
        buttons['debug_return'] = 'exit menu';
        buttons['debug_shield'] = '/bADD SHIELD';
        buttons['debug_reshuffle'] = '/bRESHUFFLE';
        buttons['debug_undo_queue'] = '/bUNDO PRINT';
        buttons['debug_game_print'] = '/bDUMP GAME';
        if (game.conflict.active === true) {
            buttons['debug_restart'] = '/rGOTO MORIA';
            buttons['debug_end_board'] = '/rEND BOARD';
        }

        // Return prompt information
        return {
            player: game.currentPlayer,
            message: 'Select option',
            buttons,
        };
    },
    debug_return() {
        resume_previous_state();
    },
    debug_shield() {
        game.players[game.currentPlayer].shield += 1;
    },
    debug_reshuffle() {
        reshuffle_deck(game);
    },
    debug_undo_queue() {
        console.log('--------------------');
        console.log('--------------------');
        console.log('--------------------');
        console.log(game.undo);
        console.log('--------------------');
        console.log('--------------------');
        console.log('--------------------');
    },
    debug_game_print() {
        console.log('--------------------');
        console.log('--------------------');
        console.log('--------------------');
        console.log(game);
        console.log('--------------------');
        console.log('--------------------');
        console.log('--------------------');
    },
    debug_restart() {
        // Eliminate any state queue information
        game.stateQueue = [];
        advance_state('conflict_board_start', { name: 'Moria', loc: 'moria' });
    },
    debug_end_board() {
        // Eliminate any state queue information
        game.stateQueue = [];
        advance_state('conflict_board_end');
    },
};

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
        advance: (s, a = {}) => advance_state(s, a),
        push_advance: (s, a = {}) => push_advance_state(s, a),
        resume_previous: () => resume_previous_state(),
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
            add_global_buttons();
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
