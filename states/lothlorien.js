import { create_deck, deal_card, draw_x_cards, set_of_player_cards, reshuffle_deck } from '../utils/cards.js';
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

const lothlorien_gladriel = {
    fini(ctx) {
        // Do initial phase of the game
        ctx.log('=t lothlorien');
        ctx.log('=! Gladriel');
        ctx.log('Deal feature cards');
        let featureDeck = [];
        create_deck(featureDeck, 85, 96);
        util.shuffle(featureDeck);

        // Players in order
        ctx.game.currentPlayer = ctx.game.ringBearer;
        const porder = get_active_players_in_order(ctx.game, ctx.game.ringBearer);

        // Deal cards round-robin until deck is empty
        let i = 0;
        while (featureDeck.length > 0) {
            const player = porder[i % porder.length];
            let card = featureDeck.pop();
            ctx.log(`C${card} given to ${player}`);
            util.set_add(ctx.game.players[player].hand, card);
            i++;
        }

        // Update Location
        ctx.game.loc = 'lothlorien';

        ctx.advance_state('lothlorien_recovery');
    },
};

const lothlorien_recovery = {
    init(ctx, args) {
        log('=! Recovery');
        log('EACH PLAYER: May discard 2 shields to either draw 2 hobbit cards or heal');
        ctx.game.currentPlayer = ctx.game.ringBearer;
        ctx.game.action.count = get_active_player_list(ctx.game).length;
    },
    prompt(ctx) {
        if (ctx.game.action.count > 0) {
            // Build buttons dynamically
            const buttons = {
                pass: 'Next',
            };
            // First check if player has 2 shields
            if (ctx.game.players[ctx.game.currentPlayer].shield >= 2) {
                buttons['card'] = 'Discard shields to gain 2 cards';
                if (ctx.game.players[ctx.game.currentPlayer].corruption > 0) {
                    buttons['heal'] = 'Discard shields to heal 1 space';
                }
            }
            // Determine if buttons should be given
            return {
                player: ctx.game.currentPlayer,
                message: 'Optionally, discard 2 shields to draw 2 hobbit cards or heal',
                buttons,
            };
        } else {
            return null;
        }
    },
    pass(ctx) {
        // Players turn has completed - skipped option
        ctx.log(`${ctx.game.currentPlayer} passes`);
        // Decrease count and advance to next player
        ctx.game.action.count = ctx.game.action.count - 1;
        ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
    },
    card(ctx) {
        ctx.log(`${ctx.game.currentPlayer} discards 2 shields to draw 2 cards`);
        ctx.game.players[ctx.game.currentPlayer].shield = ctx.game.players[ctx.game.currentPlayer].shield - 2;
        // Deal 2 cards
        draw_x_cards(ctx.game, ctx.game.currentPlayer, 2);
        // Decrease count and advance to next player
        ctx.game.action.count = ctx.game.action.count - 1;
        ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
    },
    heal(ctx) {
        ctx.log(`${ctx.game.currentPlayer} discards 2 shields to heal 1 space`);
        ctx.game.players[ctx.game.currentPlayer].shield = ctx.game.players[ctx.game.currentPlayer].shield - 2;
        ctx.game.players[ctx.game.currentPlayer].corruption = ctx.game.players[ctx.game.currentPlayer].corruption - 1;
        // Decrease count and advance to next player
        ctx.game.action.count = ctx.game.action.count - 1;
        ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
    },
    fini(ctx) {
        // Advance to next state
        ctx.advance_state('lothlorien_test_of_gladriel', 'first');
    },
};

const lothlorien_test_of_gladriel = {
    init(ctx, args) {
        if (args === 'first') {
            ctx.log('=! Test of Galadriel');
            ctx.log('EACH PLAYER: Discard WILD otherwise roll die');
            ctx.game.currentPlayer = ctx.game.ringBearer;
            ctx.game.action.count = get_active_player_list(ctx.game).length;
        } else {
            // Come back into this state from roll action
            ctx.game.action.count = args.cnt;
            ctx.game.currentPlayer = args.p;
        }
    },
    prompt(ctx) {
        if (ctx.game.action.count > 0) {
            // Build buttons dynamically
            const buttons = {
                roll: 'Roll',
            };
            const cardInfo = count_card_type_by_player(ctx.game, ctx.game.currentPlayer, 'wild');
            return {
                player: ctx.game.currentPlayer,
                message: 'Discard wild quest card or roll',
                buttons,
                cards: cardInfo.cardList.slice(),
            };
        } else {
            return null;
        }
    },
    roll(ctx) {
        // Setup to come back to this state
        ctx.game.action.count = ctx.game.action.count - 1;
        const np = get_next_player(ctx.game, ctx.game.currentPlayer);
        ctx.advance_state('lothlorien_test_of_gladriel', { p: np, cnt: ctx.game.action.count });
        ctx.push_advance_state('action_roll_die', { roll: util.roll_d6() });
    },
    card(ctx, cardArray) {
        const cardInt = parseInt(cardArray[0], 10); // Convert to int if needed
        if (discard_card_from_player(ctx.game, ctx.game.currentPlayer, cardInt) >= 0) {
            // Create log record of transaction
            ctx.log(`${ctx.game.currentPlayer} discards C${cardInt}`);
            // Decrease count and advance to next player
            ctx.game.action.count = ctx.game.action.count - 1;
            ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
        }
    },
    fini(ctx) {
        // Advance to next state
        ctx.advance_state('conflict_board_start', { name: 'Helms Deep', loc: 'helmsdeep' });
    },
};

export function lothlorien_states() {
    return {
        lothlorien_gladriel,
        lothlorien_recovery,
        lothlorien_test_of_gladriel,
    };
}
