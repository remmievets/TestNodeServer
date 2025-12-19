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

const rivendell_elrond = {
    fini(ctx) {
        // Do initial phase of the game
        ctx.log('=t Rivendell');
        ctx.log('=! Elrond');
        ctx.log('Deal feature cards');
        let featureDeck = [];
        create_deck(featureDeck, 102, 113);
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
        ctx.game.loc = 'rivendell';

        ctx.advance_state('rivendell_council');
    },
};

const rivendell_council = {
    init(ctx, args) {
        ctx.log('=! Council');
        ctx.log('EACH PLAYER: Pass 1 card face down to left');
        ctx.game.currentPlayer = ctx.game.ringBearer;
        ctx.game.action.count = get_active_player_list(ctx.game).length;
        ctx.game.action.pass = [];
    },
    prompt(ctx) {
        if (ctx.game.action.count > 0) {
            const list = ctx.game.players[ctx.game.currentPlayer].hand.slice();
            return {
                player: ctx.game.currentPlayer,
                message: 'Pass 1 card to the left',
                cards: list.slice(),
            };
        } else {
            return null;
        }
    },
    card(ctx, args) {
        // Verify the correct value was passed
        if (args.length === 1) {
            // Save a list of each card that was passed to complete this action with
            ctx.game.action.pass.push(args[0]);

            // Generate log
            ctx.log(`${ctx.game.currentPlayer} selects C${args[0]} to pass left`);

            // Decrease count and advance to next player
            ctx.game.action.count = ctx.game.action.count - 1;
            ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
        } else {
            console.log('Invalid selection');
        }
    },
    fini(ctx) {
        // Initiate all trades
        for (const c of ctx.game.action.pass) {
            // Convert to int
            const cardInt = parseInt(c, 10);
            // Discard card from current player
            discard_card_from_player(ctx.game, ctx.game.currentPlayer, cardInt);
            // Advance to next player and give them the card
            ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
            util.set_add(ctx.game.players[ctx.game.currentPlayer].hand, cardInt);
        }

        // Advance to next state
        ctx.advance_state('rivendell_fellowship', 'first');
    },
};

const rivendell_fellowship = {
    init(ctx, args) {
        if (args === 'first') {
            ctx.log('=! Fellowship');
            ctx.log('EACH PLAYER: Discard 1 friendship or roll die');
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

            const cardInfo = count_card_type_by_player(ctx.game, ctx.game.currentPlayer, 'friendship');
            return {
                player: ctx.game.currentPlayer,
                message: 'Discard friendship or roll',
                buttons,
                cards: cardInfo.cardList.slice(),
            };
        } else {
            return null;
        }
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
    roll(ctx) {
        // Setup to come back to this state
        game.action.count = ctx.game.action.count - 1;
        const np = get_next_player(ctx.game, ctx.game.currentPlayer);
        ctx.advance_state('rivendell_fellowship', { p: np, cnt: ctx.game.action.count });
        ctx.push_advance_state('action_roll_die', { roll_skip: true });
    },
    fini(ctx) {
        ctx.advance_state('conflict_board_start', { name: 'Moria', loc: 'moria' });
    },
};

export function rivendell_states() {
    return {
        rivendell_elrond,
        rivendell_council,
        rivendell_fellowship,
    };
}
