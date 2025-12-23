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
} from '../utils/player.js';
import { save_undo, clear_undo, pop_undo } from '../utils/undo.js';
import data from '../utils/data.js';
import * as util from '../utils/util.js';

const bagend_gandalf = {
    fini(ctx) {
        // Do initial phase of the game
        ctx.log('=t Bag End');
        ctx.log('=! Gandalf');
        ctx.log('Deal 6 cards to every player');

        // Players in order
        const porder = get_active_players_in_order(ctx.game, ctx.game.ringBearer);

        // Deal cards round-robin until deck is empty
        for (let i = 0; i < 6 * porder.length; i++) {
            const player = porder[i % porder.length];
            give_cards(ctx.game, player, deal_card(ctx.game));
        }

        // Go to next state
        ctx.advance_state('bagend_preparations');
    },
};

const bagend_preparations = {
    init(ctx, args) {
        ctx.log('=! Preparations');
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    prompt(ctx) {
        return {
            player: ctx.game.ringBearer,
            message: 'Roll dice to receive 4 cards or pass',
            buttons: {
                roll: 'Roll',
                pass: 'Pass',
            },
        };
    },
    roll(ctx, args) {
        // Once we roll we are done with this current state, so setup next state
        ctx.advance_state('bagend_preparations_cards');
        // Now push state to queue and interrupt with dice roll
        ctx.push_advance_state('action_roll_die', { roll: util.roll_d6() });
    },
    pass(ctx, args) {
        ctx.log('Ring-bearer passes');
        ctx.advance_state('bagend_nazgul_appears');
    },
};

const bagend_preparations_cards = {
    fini(ctx) {
        ctx.log('4 Cards available to distribute');
        for (let i = 0; i < 4; i++) {
            util.set_add(ctx.game.selectHand, deal_card(ctx.game));
        }
        ctx.advance_state('bagend_preparations_distribute', 4);
    },
};

const bagend_preparations_distribute = {
    init(ctx, cardCount) {
        ctx.game.action.count = cardCount;
    },
    prompt(ctx) {
        // Exit path for this state
        if (ctx.game.action.count <= 0) {
            return null;
        } else {
            return {
                player: ctx.game.currentPlayer,
                message: 'Select cards to distribute',
                buttons: {
                    'pick Frodo': 'To Frodo',
                    'pick Sam': 'To Sam',
                    'pick Pippin': 'To Pippin',
                    'pick Merry': 'To Merry',
                    'pick Fatty': 'To Fatty',
                },
                cards: ctx.game.selectHand.slice(),
            };
        }
    },
    card(ctx, cardArray) {
        const cardInt = parseInt(cardArray[0], 10); // Convert to int if needed
        if (distribute_card_from_select(ctx.game, ctx.game.currentPlayer, cardInt)) {
            // Decrease action count if distribute was successful
            ctx.game.action.count = ctx.game.action.count - 1;
        }

        // Create log record of transaction
        ctx.log(`C${cardInt} given to ${ctx.game.currentPlayer}`);
    },
    pick(ctx, args) {
        const player = args[0];
        ctx.game.currentPlayer = player;
    },
    fini(ctx) {
        ctx.advance_state('bagend_nazgul_appears');
    },
};

const bagend_nazgul_appears = {
    init(ctx, args) {
        ctx.log('=! Nazgul Appears');
        ctx.log('One player must discard 2 hiding or move sauron');
        ctx.game.currentPlayer = ctx.game.ringBearer;
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {
            sauron: 'Move Sauron',
        };

        // Determine which players are active and have cards to play this action
        const plist = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
        for (const p of plist) {
            const val = count_card_type_by_player(ctx.game, p, 'hide');
            if (val.value >= 2) {
                buttons[`discard ${p}`] = p;
            }
        }

        return {
            message: 'One player discard 2 hiding, otherwise sauron moves 1 space',
            buttons,
        };
    },
    discard(ctx, args) {
        const p = args[0];
        ctx.log(`${p} discards 2 hiding`);
        ctx.game.currentPlayer = p;
        ctx.advance_state('rivendell_elrond');
        ctx.push_advance_state('action_discard', { count: 2, type: 'hide' });
    },
    sauron(ctx) {
        ctx.log('Sauron moves 1 space');
        ctx.game.sauron -= 1;
        ctx.advance_state('rivendell_elrond');
    },
};

export function bagend_states() {
    return {
        bagend_gandalf,
        bagend_preparations,
        bagend_preparations_cards,
        bagend_preparations_distribute,
        bagend_nazgul_appears,
    };
}
