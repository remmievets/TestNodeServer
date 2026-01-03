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
        ctx.game.action.playerList = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
    },
    prompt(ctx) {
        // Once all players have completed then exit
        if (ctx.game.action.playerList.length <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {};
        // First check if player has 2 shields
        if (ctx.game.players[ctx.game.action.playerList[0]].shield >= 3) {
            buttons['deal'] = 'Discard shields to gain 2 cards';
            if (ctx.game.players[ctx.game.action.playerList[0]].corruption > 0) {
                buttons['heal'] = 'Discard shields to heal 1 space';
            }
        }
        buttons['pass'] = 'Pass';
        return {
            player: ctx.game.action.playerList[0], // peek
            message: 'May discard 3 shields to draw 2 hobbit cards or heal',
            buttons,
        };
    },
    deal(ctx) {
        const p = ctx.game.action.playerList.shift();
        // Log message
        ctx.log(`${p} discards 3 shields to draw 2 cards`);
        // Decrease 3 shields
        ctx.game.players[p].shield -= 3;
        // Deal 2 cards
        draw_cards(ctx.game, p, 2);
    },
    heal(ctx) {
        const p = ctx.game.action.playerList.shift();
        // Log message
        ctx.log(`${p} discards 3 shields to heal 1 space`);
        // Decrease 3 shields
        ctx.game.players[p].shield -= 3;
        // Decrease corruption by 1
        ctx.game.players[p].corruption -= 1;
    },
    pass(ctx) {
        const p = ctx.game.action.playerList.shift();
        // Players turn has completed - skipped option
        ctx.log(`${p} passes`);
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
        if (find_player_with_card(ctx.game, data.EOWYN_CARD)) {
            buttons['discard'] = 'Discard Eowyn';
        }
        buttons['pass'] = 'Pass';
        return {
            message: 'Select option',
            buttons,
        };
    },
    discard(ctx) {
        const p = find_player_with_card(ctx.game, data.EOWYN_CARD);
        if (p) {
            discard_cards(ctx.game, p, data.EOWYN_CARD);
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
        ctx.game.action.playerList = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
    },
    prompt(ctx) {
        // Once all players have completed then exit
        if (ctx.game.action.playerList.length <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {};
        // First check if player has a heart
        if (ctx.game.players[ctx.game.action.playerList[0]].heart >= 1) {
            buttons['discard'] = 'Discard heart';
        }
        buttons['pass'] = 'Pass';
        return {
            player: ctx.game.action.playerList[0], // peek
            message: 'Discard heart or roll die and discard 2 cards',
            buttons,
        };
    },
    discard(ctx) {
        const p = ctx.game.action.playerList.shift();
        // Log message
        ctx.log(`${p} discards a heart token`);
        // Decrement heart
        ctx.game.players[p].heart -= 1;
    },
    pass(ctx) {
        const p = ctx.game.action.playerList.shift();
        // Log message
        ctx.log(`${p} will roll die and discard 2 cards`);
        // Push actions
        ctx.push_advance_state('action_discard', { player: p, count: 2, type: 'card' });
        ctx.push_advance_state('action_roll_die', { player: p });
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const mordor_mouth_of_sauron = {
    init(ctx, args) {
        ctx.log('EACH PLAYER: Discard sun token');
        ctx.log('Otherwise, rolls die and discard 2 cards');
        ctx.game.action.playerList = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
    },
    prompt(ctx) {
        // Once all players have completed then exit
        if (ctx.game.action.playerList.length <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {};
        // First check if player has a sun
        if (ctx.game.players[ctx.game.action.playerList[0]].sun >= 1) {
            buttons['discard'] = 'Discard sun';
        }
        buttons['pass'] = 'Pass';
        return {
            player: ctx.game.action.playerList[0],
            message: 'Discard sun or roll die and discard 2 cards',
            buttons,
        };
    },
    discard(ctx) {
        const p = ctx.game.action.playerList.shift();
        // Log message
        ctx.log(`${p} discards a sun token`);
        // Decrement sun
        ctx.game.players[p].sun -= 1;
    },
    pass(ctx) {
        const p = ctx.game.action.playerList.shift();
        // Log message
        ctx.log(`${p} will roll die and discard 2 cards`);
        // Push actions
        ctx.push_advance_state('action_discard', { player: p, count: 2, type: 'card' });
        ctx.push_advance_state('action_roll_die', { player: p });
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
        if (set_of_player_cards(ctx.game).size >= 7) {
            buttons['discard'] = 'Discard 7 cards';
        }
        buttons['sauron'] = 'Move sauron 3';
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
        ctx.game.sauron -= 3;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
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
