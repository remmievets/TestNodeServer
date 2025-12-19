import { create_deck, deal_card, draw_x_cards, set_of_player_cards, reshuffle_deck } from '../utils/cards.js';
import { get_board_active_quests, is_path_complete, resolve_reward } from '../utils/board.js';
import {
    count_card_type_by_player,
    distribute_card_from_select,
    discard_card_from_player,
    get_active_player_list,
    get_next_player,
    get_active_players_in_order,
    update_player_active,
} from '../utils/player.js';
import { save_undo, clear_undo, pop_undo } from '../utils/undo.js';
import data from '../utils/data.js';
import * as util from '../utils/util.js';

const action_discard = {
    init(ctx, args) {
        /// a.player - Identify the player who needs to discard (optional).  Current player is not used
        /// a.count - The number of items to Discard
        /// a.type - 'card', or specific card type to discard 'wild'/'hide',etc
        ctx.game.action.player = args.player ?? ctx.game.currentPlayer;
        ctx.game.action.count = args.count;
        ctx.game.action.type = args.type;
    },
    prompt(ctx) {
        // Find card list
        const cardInfo = count_card_type_by_player(ctx.game, ctx.game.action.player, ctx.game.action.type);

        // Check that count is not higher than hand size, otherwise adjust count.
        if (ctx.game.action.count > cardInfo.value) {
            ctx.game.action.count = cardInfo.value;
        }

        // Exit path for this state
        if (ctx.game.action.count <= 0) {
            return null;
        } else {
            return {
                message: `Select ${ctx.game.action.count} cards to discard`,
                player: ctx.game.action.player,
                cards: cardInfo.cardList.slice(),
            };
        }
    },
    card(ctx, cardArray) {
        for (let i = 0; i < cardArray.length; i++) {
            const cardInt = parseInt(cardArray[i], 10); // Convert to int if needed
            if (discard_card_from_player(ctx.game, ctx.game.action.player, cardInt) >= 0) {
                ctx.game.action.count = ctx.game.action.count - 1;
            }

            // Create log record of transaction
            ctx.log(`${ctx.game.action.player} discard C${cardInt}`);
        }
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const action_discard_group = {
    init(ctx, args) {
        /// a.count - The number of items to Discard
        /// a.type - 'card', or specific card type to discard 'wild'/'hide',etc
        /// a.cardArray - The available cards which can be discarded
        ctx.game.action.count = args.count;
        ctx.game.action.type = args.type;
    },
    prompt(ctx) {
        // Exit path for this state
        if (ctx.game.action.count <= 0) {
            return null;
        }

        // Get list of cards for the entire group of active players
        const players = get_active_player_list(ctx.game);
        let allCards = [];

        for (const p of players) {
            const cardInfo = count_card_type_by_player(ctx.game, p, game.action.type);
            allCards.push(...cardInfo.cardList);
        }

        return {
            message: `Select ${ctx.game.action.count} cards to discard`,
            cards: allCards.slice(),
        };
    },
    card(ctx, cardArray) {
        for (let i = 0; i < cardArray.length; i++) {
            const cardInt = parseInt(cardArray[i], 10); // Convert to int if needed

            let pArray = get_active_player_list(ctx.game);
            for (let p of pArray) {
                // Attempt to discard from player
                if (discard_card_from_player(ctx.game, p, cardInt) >= 0) {
                    // Decrease card count
                    ctx.game.action.count = ctx.game.action.count - 1;

                    // Create log record of transaction
                    ctx.log(`${p} discard C${cardInt}`);
                    break;
                }
            }
        }
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const action_roll_die = {
    init(ctx, args) {
        // Save parameters
        ctx.game.action.player = args.player ?? ctx.game.currentPlayer;
        ctx.game.action.ring = args.ring ?? false;
        ctx.game.action.roll_skip = args.roll_skip ?? false;
        // If ring then
        if (ctx.game.action.ring) {
            // Mark it used
            ctx.game.conflict.ringUsed = true;
        }
        if (ctx.game.action.roll_skip) {
            // Skip dialog to roll dice
            ctx.game.action.count = util.roll_d6();
            ctx.log(ctx.game.action.player + ' rolls a D' + ctx.game.action.count);
        } else {
            // Die has not been rolled yet
            ctx.game.action.count = -1;
        }
        // Resolution of die has not been completed
        ctx.game.action.resolved = false;
    },
    prompt(ctx) {
        const buttons = {};
        if (ctx.game.action.count === -1) {
            buttons['roll'] = 'Roll';
        } else if (ctx.game.action.resolved === false) {
            buttons['resolve'] = 'Resolve';
        } else if (ctx.game.action.ring === true) {
            buttons['ringit'] = 'RING ME';
        } else {
            return null;
        }
        // Return prompt information
        return {
            player: ctx.game.action.player,
            message: 'Select option',
            buttons,
        };
    },
    roll(ctx) {
        ctx.game.action.count = util.roll_d6();
        ctx.log(ctx.game.action.player + ' rolls a D' + ctx.game.action.count);
    },
    resolve(ctx) {
        ctx.game.action.resolved = true;
        const p = ctx.game.action.player;
        switch (ctx.game.action.count) {
            case 1:
                ctx.game.players[p].corruption += 1;
                ctx.log(p + ' increases corruption by 1 to ' + ctx.game.players[p].corruption);
                break;
            case 2:
                if (p === 'Sam') {
                    ctx.game.players[p].corruption += 1;
                    ctx.log(p + ' increases corruption by 1 to ' + ctx.game.players[p].corruption);
                } else {
                    ctx.game.players[p].corruption += 2;
                    ctx.log(p + ' increases corruption by 2 to ' + ctx.game.players[p].corruption);
                }
                break;
            case 3:
                if (p === 'Sam') {
                    ctx.game.players[p].corruption += 1;
                    ctx.log(p + ' increases corruption by 1 to ' + ctx.game.players[p].corruption);
                } else {
                    ctx.game.players[p].corruption += 3;
                    ctx.log(p + ' increases corruption by 3 to ' + ctx.game.players[p].corruption);
                }
                break;
            case 4:
                // Setup to discard 2 cards or 1 if same is rolling
                let discardCount = 2;
                if (p === 'Sam') {
                    discardCount = 1;
                }
                ctx.push_advance_state('action_discard', { count: discardCount, type: 'card' });
                break;
            case 5:
                ctx.game.sauron -= 1;
                ctx.log('Sauron advances to space ' + ctx.game.sauron);
                break;
            default:
                // No damage
                break;
        }
    },
    ringit(ctx) {
        // TBD - Figure out which track to advance on
        ctx.resume_previous_state();
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

export function action_states() {
    return {
        action_discard,
        action_discard_group,
        action_roll_die,
    };
}
