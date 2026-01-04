import {
    create_deck,
    deal_card,
    give_cards,
    draw_cards,
    discard_cards,
    play_cards,
    find_player_with_card,
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
        ///          Type can be an array if multiple card types must be discarded
        ctx.game.action.player = args.player ?? ctx.game.currentPlayer;
        ctx.game.action.count = args.count;
        ctx.game.action.type = Array.isArray(args.type) ? args.type : [args.type];
    },
    prompt(ctx) {
        if (ctx.game.action.count <= 0) {
            return null;
        }
        const buttons = {};
        // Find card list
        const cardInfo = count_card_type_by_player(ctx.game, ctx.game.action.player, ctx.game.action.type);
        // Check that count is not higher than hand size, otherwise adjust count.
        if (ctx.game.action.count > cardInfo.value) {
            buttons['die'] = 'Player Corrupted';
        }
        return {
            message: `Select ${ctx.game.action.count} cards to discard`,
            player: ctx.game.action.player,
            buttons,
            cards: cardInfo.cardList.slice(),
        };
    },
    card(ctx, cardArray) {
        // Decrease action count by number of cards discarded
        for (const card of cardArray) {
            const cardData = data.cards[card];
            const usedType = cardData.type;
            // Discard cards in array
            const rt = discard_cards(ctx.game, ctx.game.action.player, card);
            // Decrease action count by number of cards/value discarded
            if (ctx.game.action.type.includes('card')) {
                ctx.game.action.count -= rt.count;
            } else if (usedType === 'wild' || ctx.game.action.type.length === 1) {
                // If only one type or if this is a wild card then use value
                ctx.game.action.count -= rt.value;
            } else {
                ctx.game.action.count -= rt.count;
            }
            // Remove from array each card type matched
            if (usedType && ctx.game.action.type.includes(usedType)) {
                ctx.game.action.type = ctx.game.action.type.filter((t) => t !== usedType);
            }
        }
    },
    die(ctx) {
        console.log(`${ctx.game.action.player} has become corrupted`);
        ctx.log(`${ctx.game.action.player} has become corrupted`);
        ctx.game.players[ctx.game.action.player].corruption = ctx.game.sauron;
        ctx.resume_previous_state();
        console.log(`${ctx.game.state}`);
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
        ctx.game.action.type = Array.isArray(args.type) ? args.type : [args.type];
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
        for (const card of cardArray) {
            // Find who is holding card - this does not accept an array
            const p = find_player_with_card(ctx.game, card);
            if (p) {
                const cardData = data.cards[card];
                const usedType = cardData.type;
                // Discard cards in array
                const rt = discard_cards(ctx.game, p, card);
                // Decrease action count by number of cards/value discarded
                if (ctx.game.action.type.includes('card')) {
                    ctx.game.action.count -= rt.count;
                } else if (usedType === 'wild' || ctx.game.action.type.length === 1) {
                    // If only one type or if this is a wild card then use value
                    ctx.game.action.count -= rt.value;
                } else {
                    ctx.game.action.count -= rt.count;
                }
                // Remove from array each card type matched
                if (usedType && ctx.game.action.type.includes(usedType)) {
                    ctx.game.action.type = ctx.game.action.type.filter((t) => t !== usedType);
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
        ctx.game.action.roll = args.roll ?? -1;
        if (ctx.game.action.roll > 0) {
            // Skip dialog to roll dice
            ctx.log(ctx.game.action.player + ' rolls a D' + ctx.game.action.roll);
        }
        // Resolution of die has not been completed
        ctx.game.action.resolved = false;
    },
    prompt(ctx) {
        const buttons = {};
        if (ctx.game.action.roll < 0) {
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
        ctx.game.action.roll = util.roll_d6();
        ctx.log(ctx.game.action.player + ' rolls a D' + ctx.game.action.roll);
    },
    resolve(ctx) {
        ctx.game.action.resolved = true;
        const p = ctx.game.action.player;
        switch (ctx.game.action.roll) {
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
                ctx.push_advance_state('action_discard', { player: p, count: discardCount, type: 'card' });
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

const action_pick_player = {
    init(ctx, args) {
        ctx.game.action.message = args.message;
    },
    prompt(ctx) {
        const buttons = {};
        const plist = get_active_player_list(ctx.game);
        for (const p of plist) {
            buttons[`pick ${p}`] = p;
        }
        return {
            message: ctx.game.action.message,
            buttons,
        };
    },
    pick(ctx, args) {
        // Restore prior state
        ctx.resume_previous_state();
        // Update prior state action with selected player
        ctx.game.action.player = args;
    },
};

const action_heal_player = {
    init(ctx, args) {
        ctx.game.action.player = args.player ?? undefined;
        ctx.game.action.count = args.count ?? 1;
        // Need to select a player first
        if (!ctx.game.action.player) {
            ctx.push_advance_state('action_pick_player', { message: 'Select player to heal' });
        }
    },
    fini(ctx) {
        const action = ctx.game.action;
        if (action.player) {
            ctx.game.players[action.player].corruption -= action.count;
            if (ctx.game.players[action.player].corruption < 0) {
                ctx.game.players[action.player].corruption = 0;
            }
            ctx.log(`${action.player} heals ${action.count} spaces to ${ctx.game.players[action.player].corruption}`);
            ctx.resume_previous_state();
        }
    },
};

const action_draw_cards = {
    init(ctx, args) {
        ctx.game.action.player = args.player ?? undefined;
        ctx.game.action.count = args.count ?? 1;
        ctx.game.action.limit = args.limit ?? 99;
        // Need to select a player first
        if (!ctx.game.action.player) {
            ctx.push_advance_state('action_pick_player', { message: 'Select player to draw cards' });
        }
    },
    fini(ctx) {
        const action = ctx.game.action;
        const p = action.player;
        const player = ctx.game.players[p];
        const handSize = player.hand.length;
        const limit = action.limit;
        // Determine the number of cards to draw
        const spaceRemaining = Math.max(0, limit - handSize);
        const drawCount = Math.min(action.count, spaceRemaining);
        // Give player COUNT cards, but not to exceed LIMIT
        for (let i = 0; i < drawCount; i++) {
            give_cards(ctx.game, p, deal_card(ctx.game));
        }
        ctx.resume_previous_state();
    },
};

export function action_states() {
    return {
        action_discard,
        action_discard_group,
        action_discard_item_group,
        action_roll_die,
        action_pick_player,
        action_heal_player,
        action_draw_cards,
    };
}
