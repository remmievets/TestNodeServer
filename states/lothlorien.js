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
        create_deck(featureDeck, data.LOTHLORIEN_DECK[0], data.LOTHLORIEN_DECK[1]);
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
        ctx.game.loc = 'lothlorien';

        ctx.advance_state('lothlorien_recovery');
    },
};

const lothlorien_recovery = {
    init(ctx, args) {
        ctx.log('=! Recovery');
        ctx.log('EACH PLAYER: May discard 2 shields to either draw 2 hobbit cards or heal');
        ctx.game.currentPlayer = ctx.game.ringBearer;
        ctx.game.action.playerList = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
    },
    prompt(ctx) {
        // Once all players have completed then exit
        if (ctx.game.action.playerList.length <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {
            pass: 'Next',
        };
        // First check if player has 2 shields
        if (ctx.game.players[ctx.game.action.playerList[0]].shield >= 2) {
            buttons['card'] = 'Discard shields to gain 2 cards';
            if (ctx.game.players[ctx.game.action.playerList[0]].corruption > 0) {
                buttons['heal'] = 'Discard shields to heal 1 space';
            }
        }
        // Determine if buttons should be given
        return {
            player: ctx.game.action.playerList[0], // peek
            message: 'Optionally, discard 2 shields to draw 2 hobbit cards or heal',
            buttons,
        };
    },
    pass(ctx) {
        ctx.game.currentPlayer = ctx.game.action.playerList.shift();
        // Players turn has completed - skipped option
        ctx.log(`${ctx.game.currentPlayer} passes`);
    },
    card(ctx) {
        ctx.game.currentPlayer = ctx.game.action.playerList.shift();
        ctx.log(`${ctx.game.currentPlayer} discards 2 shields to draw 2 cards`);
        ctx.game.players[ctx.game.currentPlayer].shield -= 2;
        // Deal 2 cards
        draw_cards(ctx.game, ctx.game.currentPlayer, 2);
    },
    heal(ctx) {
        ctx.game.currentPlayer = ctx.game.action.playerList.shift();
        ctx.log(`${ctx.game.currentPlayer} discards 2 shields to heal 1 space`);
        ctx.game.players[ctx.game.currentPlayer].shield -= 2;
        ctx.game.players[ctx.game.currentPlayer].corruption -= 1;
    },
    fini(ctx) {
        // Advance to next state
        ctx.advance_state('lothlorien_test_of_gladriel');
    },
};

const lothlorien_test_of_gladriel = {
    init(ctx, args) {
        ctx.log('=! Test of Galadriel');
        ctx.log('EACH PLAYER: Discard WILD otherwise roll die');
        ctx.game.currentPlayer = ctx.game.ringBearer;
        ctx.game.action.playerList = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
        ctx.game.action.roll = -1;
    },
    prompt(ctx) {
        // Once all players have completed then exit
        if (ctx.game.action.playerList.length <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {};
        const cardInfo = count_card_type_by_player(ctx.game, ctx.game.action.playerList[0], 'wild');
        if (cardInfo.value >= 1) {
            buttons['discard'] = 'Discard wild';
        }
        buttons['roll'] = 'Roll';
        return {
            player: ctx.game.action.playerList[0], // peek
            message: 'Discard wild or roll',
            buttons,
        };
    },
    discard(ctx) {
        // Save current player
        ctx.game.currentPlayer = ctx.game.action.playerList.shift();
        // Push action to discard card
        ctx.push_advance_state('action_discard', { player: ctx.game.currentPlayer, count: 1, type: 'wild' });
    },
    roll(ctx) {
        // Save current player
        ctx.game.currentPlayer = ctx.game.action.playerList.shift();
        // If card not played then perform die roll
        let saved_roll = ctx.game.action.roll;
        if (saved_roll < 0) {
            saved_roll = util.roll_d6();
        }
        ctx.game.action.roll = -1;
        // Push action to roll die with player prior to switching players
        ctx.push_advance_state('action_roll_die', { player: ctx.game.currentPlayer, roll: saved_roll });
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
