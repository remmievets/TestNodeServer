import {
    create_deck,
    deal_card,
    give_cards,
    draw_cards,
    discard_cards,
    set_of_player_cards,
    reshuffle_deck,
} from '../utils/cards.js';
import {
    count_card_type_by_player,
    distribute_card_from_select,
    get_active_player_list,
    get_next_player,
    get_active_players_in_order,
    update_player_active,
    get_active_players_with_resource,
    count_total_life_token,
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
        if (discard_cards(ctx.game, ctx.game.action.player, cardArray) >= 0) {
            ctx.game.action.count = ctx.game.action.count - 1;
        }
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const action_discard_group = {
    init(ctx, args) {
        /// args.count - The number of items to Discard
        /// args.type - 'card', or specific card type to discard 'wild'/'hide',etc
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
            const cardInfo = count_card_type_by_player(ctx.game, p, ctx.game.action.type);
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
                if (discard_cards(ctx.game, p, cardInt) >= 0) {
                    // Decrease card count
                    ctx.game.action.count = ctx.game.action.count - 1;
                    break;
                }
            }
        }
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const action_discard_item_group = {
    init(ctx, args) {
        /// args.count - The number of items group must discard
        /// args.type - 'shield', 'life_token', or a specific life token type
        ctx.game.action.count = args.count;
        ctx.game.action.type = Array.isArray(args.type) ? args.type : [args.type];
        if (ctx.game.action.type[0] === 'life_token') {
            ctx.game.action.type = ['ring', 'heart', 'sun'];
        }
    },
    prompt(ctx) {
        // Exit path for this state
        if (ctx.game.action.count <= 0) {
            return null;
        }

        // Create a button for each item/player which can be discarded
        const buttons = {};

        // Get list of cards for the entire group of active players
        for (const item of ctx.game.action.type) {
            const players = get_active_players_with_resource(ctx.game, item);
            for (const p of players) {
                buttons[`discard ${p} ${item}`] = `${p} ${item}`;
            }
        }
        return {
            message: `Select to discard(${ctx.game.action.count})`,
            buttons,
        };
    },
    discard(ctx, args) {
        const p = args[0];
        const resource = args[1];
        ctx.log(`${p} discards ${resource}`);
        ctx.game.players[p][resource] -= 1;
        ctx.game.action.count -= 1;
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const action_roll_die = {
    init(ctx, args) {
        // Save parameters
        ctx.game.action.player = args.player ?? ctx.game.currentPlayer;
        ctx.game.action.count = args.roll ?? -1;
        if (ctx.game.action.count > 0) {
            // Skip dialog to roll dice
            ctx.log(ctx.game.action.player + ' rolls a D' + ctx.game.action.count);
        }
        // Resolution of die has not been completed
        ctx.game.action.resolved = false;
    },
    prompt(ctx) {
        const buttons = {};
        if (ctx.game.action.count < 0) {
            buttons['roll'] = 'Roll';
        } else if (ctx.game.action.resolved === false) {
            buttons['resolve'] = 'Resolve';
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
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

export function action_states() {
    return {
        action_discard,
        action_discard_group,
        action_discard_item_group,
        action_roll_die,
    };
}
