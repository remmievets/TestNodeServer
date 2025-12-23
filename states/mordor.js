import { create_deck, deal_card, draw_x_cards, give_cards, set_of_player_cards, reshuffle_deck } from '../utils/cards.js';
import {
    count_card_type_by_player,
    distribute_card_from_select,
    discard_card_from_player,
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
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const mordor_nazgul_attacks = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const mordor_pelennor_fields = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const mordor_mouth_of_sauron = {
    init(ctx, args) {
        ctx.log('EACH PLAYER: Group discards 7 cards');
        ctx.log('Otherwise move sauron 3 spaces');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const mordor_dark_forces = {
    init(ctx, args) {
        ctx.log('Group discards 7 cards');
        ctx.log('Otherwise move sauron 3 spaces');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const mordor_ring_is_mine = {
    init(ctx, args) {
        ctx.log('Ring-bearer may roll and reveal 4 hobbit cards face up to distribute');
    },
    fini(ctx) {
        ctx.resume_previous_state();
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
