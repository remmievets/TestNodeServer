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
/* Moria Event States */

const moria_speak_friend = {
    init(ctx, args) {
        ctx.log('Group discard friendship and wild');
        ctx.log('Otherwise, sauron moves 1 space');
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        if (find_player_with_card(ctx.game, data.EOWYN_CARD)) {
            buttons['discard'] = 'Discard';
        }
        buttons['pass'] = 'Pass';
        return {
            message: 'Select option',
            buttons,
        };
    },
    discard(ctx) {
        ctx.resume_previous_state();
        // Discard friendship / wild as group
        ctx.push_advance_state('action_discard_group', { count: 1, type: 'friendship' });
        ctx.push_advance_state('action_discard_group', { count: 1, type: 'wild' });
    },
    pass(ctx) {
        ctx.game.sauron -= 1;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        ctx.resume_previous_state();
    },
};

const moria_watcher = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const moria_stone = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const moria_trapped = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const moria_orcs_attack = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const moria_fly_you_fools = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

export function moria_states() {
    return {
        moria_speak_friend,
        moria_watcher,
        moria_stone,
        moria_trapped,
        moria_orcs_attack,
        moria_fly_you_fools,
    };
}
