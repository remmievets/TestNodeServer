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
/* Helms Deep Event States */

const helmsdeep_wormtongue = {
    init(ctx, args) {
        ctx.log('One player discard friendship and fight');
        ctx.log('Otherwise the remaining Helms Deep feature cards are discarded');
        ///TBD
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const helmsdeep_riders_of_rohan = {
    init(ctx, args) {
        ctx.log('If Friendship is complete then active player receives the Riders of Rohan card');
        ctx.log('Otherwise move Sauron and Ring-bearer rolls die');
        ///TBD
    },
    sauron(ctx) {
        ctx.game.sauron -= 1;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        ctx.resume_previous_state();
        ctx.push_advance_state('action_roll_die', { player: ctx.game.ringBearer });
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const helmsdeep_orcs_attack = {
    init(ctx, args) {
        ctx.log('If first part of Travelling complete then each player receives 1 Hobbit card');
        ctx.log('Otherwise move Sauron 2 spaces');
        ///TBD
        // Each player draws a hobbit card
        const players = get_active_player_list(ctx.game);
        for (const p of players) {
            draw_cards(ctx.game, p, 1);
        }
    },
    sauron(ctx) {
        ctx.game.sauron -= 2;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        ctx.resume_previous_state();
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const helmsdeep_orthanc = {
    init(ctx, args) {
        ctx.log('Reveal 1 Hobbit card from the deck and Active player discards 2 matching card symbols');
        ctx.log('Otherwise each player rolls a die');
        ///TBD
        // Each player must roll a die, go in reverse order so action starts with current player
        const plist = get_active_players_in_order(ctx.game, ctx.game.currentPlayer).reverse();
        for (const p of plist) {
            ctx.push_advance_state('action_roll_die', { player: p });
        }
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const helmsdeep_orcs_storm = {
    init(ctx, args) {
        ctx.log('Group discard heart, sun, and ring tokens');
        ctx.log('Otherwise move Sauron 2 spaces');
        ///TBD
    },
    sauron(ctx) {
        ctx.game.sauron -= 2;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        ctx.resume_previous_state();
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const helmsdeep_orcs_conquer = {
    init(ctx, args) {
        ctx.log('If second Travelling complete then move Sauron 2 spaces');
        ctx.log('Otherwise move Sauron 2 spaces and ring-bearer 2 dice');
        ///TBD
    },
    sauron(ctx) {
        ctx.game.sauron -= 2;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        ctx.resume_previous_state();
        ctx.push_advance_state('action_roll_die', { player: ctx.game.ringBearer });
        ctx.push_advance_state('action_roll_die', { player: ctx.game.ringBearer });
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

export function helmsdeep_states() {
    return {
        helmsdeep_wormtongue,
        helmsdeep_riders_of_rohan,
        helmsdeep_orcs_attack,
        helmsdeep_orthanc,
        helmsdeep_orcs_storm,
        helmsdeep_orcs_conquer,
    };
}
