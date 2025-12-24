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
    count_total_life_token,
    count_total_shields,
} from '../utils/player.js';
import { save_undo, clear_undo, pop_undo } from '../utils/undo.js';
import data from '../utils/data.js';
import * as util from '../utils/util.js';

//////////////////////
/* Mordor Event States */

const mordor_sam_saves_frodo = {
    init(ctx, args) {
        ctx.log('EACH PLAYER: May discard 3 shields to either draw 2 Hobbit cards or heal');
        ctx.game.action.player = ctx.game.currentPlayer;
        ctx.game.action.count = get_active_player_list(ctx.game).length;
    },
    prompt(ctx) {
        // Once all players have completed then exit
        if (ctx.game.action.count <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {
            pass: 'Next',
        };
        // First check if player has 2 shields
        if (ctx.game.players[ctx.game.action.player].shield >= 3) {
            buttons['card'] = 'Discard shields to gain 2 cards';
            if (ctx.game.players[ctx.game.action.player].corruption > 0) {
                buttons['heal'] = 'Discard shields to heal 1 space';
            }
        }
        // Determine if buttons should be given
        return {
            player: ctx.game.action.player,
            message: 'Optionally, discard 3 shields to draw 2 hobbit cards or heal',
            buttons,
        };
    },
    pass(ctx) {
        // Players turn has completed - skipped option
        ctx.log(`${ctx.game.action.player} passes`);
        // Decrease count and advance to next player
        ctx.game.action.count -= 1;
        ctx.game.action.player = get_next_player(ctx.game, ctx.game.action.player);
    },
    card(ctx) {
        ctx.log(`${ctx.game.action.player} discards 3 shields to draw 2 cards`);
        ctx.game.players[ctx.game.action.player].shield -= 3;
        // Deal 2 cards
        draw_cards(ctx.game, ctx.game.action.player, 2);
        // Decrease count and advance to next player
        ctx.game.action.count -= 1;
        ctx.game.action.player = get_next_player(ctx.game, ctx.game.action.player);
    },
    heal(ctx) {
        ctx.log(`${ctx.game.action.player} discards 3 shields to heal 1 space`);
        ctx.game.players[ctx.game.action.player].shield -= 3;
        ctx.game.players[ctx.game.action.player].corruption -= 1;
        // Decrease count and advance to next player
        ctx.game.action.count -= 1;
        ctx.game.action.player = get_next_player(ctx.game, ctx.game.action.player);
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const mordor_nazgul_attacks = {
    init(ctx, args) {
        ctx.log('One player discard Eowyn card then each player draws 1 hobbit card');
        ctx.log('Otherwise, each player rolls die');
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        if (find_player_with_card(ctx.game, 99)) {
            buttons['discard'] = 'Discard Eowyn';
        }
        buttons['pass'] = 'Pass';
        return {
            message: 'Select option',
            buttons,
        };
    },
    discard(ctx) {
        const p = find_player_with_card(ctx.game, 99);
        if (p) {
            discard_cards(ctx.game, p, 99);
        }
        ctx.resume_previous_state();
    },
    pass(ctx) {
        // Return to prior state, so this state exits
        ctx.resume_previous_state();
        // Each player must roll a die, go in reverse order so action starts with current player
        const plist = get_active_players_in_order(ctx.game, ctx.game.currentPlayer).reverse();
        for (const p of plist) {
            ctx.push_advance_state('action_roll_die', { player: p });
        }
    },
};

const mordor_pelennor_fields = {
    init(ctx, args) {
        ctx.log('EACH PLAYER: Discard heart token');
        ctx.log('Otherwise, rolls die and discard 2 cards');
        ctx.game.action.player = ctx.game.currentPlayer;
        ctx.game.action.count = get_active_player_list(ctx.game).length;
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const mordor_mouth_of_sauron = {
    init(ctx, args) {
        ctx.log('EACH PLAYER: Discard sun token');
        ctx.log('Otherwise, rolls die and discard 2 cards');
        ctx.game.action.player = ctx.game.currentPlayer;
        ctx.game.action.count = get_active_player_list(ctx.game).length;
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const mordor_dark_forces = {
    init(ctx, args) {
        ctx.log('Group discards 7 cards');
        ctx.log('Otherwise, move sauron 3 spaces');
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        // Check that players as a group have at least 7 cards
        if (set_of_player_cards(ctx.game).length >= 7) {
            buttons['discard'] = 'Discard';
        }
        buttons['sauron'] = 'Move sauron 3 spaces';
        return {
            message: 'Discard 7 cards or move sauron 3 spaces',
            buttons,
        };
    },
    discard(ctx) {
        ctx.resume_previous_state();
        // Discard 7 cards as a group
        ctx.push_advance_state('action_discard_group', { count: 7, type: 'card' });
    },
    sauron(ctx) {
        ctx.resume_previous_state();
    },
};

const mordor_ring_is_mine = {
    fini(ctx) {
        ctx.advance_state('global_game_end', { victory: false, reason: 'Ring is mine event' });
    },
};

export function mordor_states() {
    return {
        mordor_sam_saves_frodo,
        mordor_nazgul_attacks,
        mordor_pelennor_fields,
        mordor_mouth_of_sauron,
        mordor_dark_forces,
        mordor_ring_is_mine,
    };
}
