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
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const helmsdeep_riders_of_rohan = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const helmsdeep_orcs_attack = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const helmsdeep_orthanc = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const helmsdeep_orcs_storm = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const helmsdeep_orcs_conquer = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
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
