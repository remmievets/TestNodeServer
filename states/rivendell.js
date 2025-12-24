import {
    create_deck,
    deal_card,
    give_cards,
    draw_cards,
    discard_cards,
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
        create_deck(featureDeck, data.RIVENDELL_DECK[0], data.RIVENDELL_DECK[1]);
        util.shuffle(featureDeck);

        // Players in order
        ctx.game.currentPlayer = ctx.game.ringBearer;
        const porder = get_active_players_in_order(ctx.game, ctx.game.ringBearer);

        // Deal cards round-robin until deck is empty
        let i = 0;
        while (featureDeck.length > 0) {
            const player = porder[i % porder.length];
            let card = featureDeck.pop();
            give_cards(ctx.game, player, card);
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
        if (ctx.game.action.count <= 0) {
            return null;
        }
        const list = ctx.game.players[ctx.game.currentPlayer].hand.slice();
        return {
            player: ctx.game.currentPlayer,
            message: 'Pass 1 card to the left',
            cards: list.slice(),
        };
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
        for (const card of ctx.game.action.pass) {
            // Discard card from current player
            discard_cards(ctx.game, ctx.game.currentPlayer, card);
            // Advance to next player and give them the card
            ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
            give_cards(ctx.game, ctx.game.currentPlayer, card);
        }

        // Advance to next state
        ctx.advance_state('rivendell_fellowship');
    },
};

const rivendell_fellowship = {
    init(ctx, args) {
        ctx.log('=! Fellowship');
        ctx.log('EACH PLAYER: Discard 1 friendship or roll die');
        ctx.game.currentPlayer = ctx.game.ringBearer;
        ctx.game.action.count = get_active_player_list(ctx.game).length;
        ctx.game.action.player = ctx.game.currentPlayer;
    },
    prompt(ctx) {
        if (ctx.game.action.count <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {
            roll: 'Roll',
        };
        const cardInfo = count_card_type_by_player(ctx.game, ctx.game.action.player, 'friendship');
        return {
            player: ctx.game.action.player,
            message: 'Discard friendship or roll',
            buttons,
            cards: cardInfo.cardList.slice(),
        };
    },
    card(ctx, cardArray) {
        const rt = discard_cards(ctx.game, ctx.game.action.player, cardArray);
        if (rt.count > 0) {
            // Decrease count and advance to next player
            ctx.game.action.count -= rt.count;
            ctx.game.action.player = get_next_player(ctx.game, ctx.game.action.player);
        }
    },
    roll(ctx) {
        // Save current player
        const cp = ctx.game.action.player;
        // Decrease count amd advance to next player
        ctx.game.action.count = ctx.game.action.count - 1;
        ctx.game.action.player = get_next_player(ctx.game, ctx.game.action.player);
        // Push action to roll die with player prior to switching players
        ctx.push_advance_state('action_roll_die', { player: cp, roll: util.roll_d6() });
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
