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
/* Reaction Event States */

const reactions = [
    {
        // Gandalf: Foresight
        //  Any conflict state, or when conflict is active
        id: 60,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('One player: Rearrange top 3 tiles');
            // Push special action
        },
    },
    {
        // Gandalf: Gandalf: Magic
        //  turn_resolve_tile
        id: 61,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('After moving the event marker ignore the event');
            // TBD - immediate
        },
    },
    {
        // Gandalf: Gandalf: Healing
        id: 62,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('One player: Heal 2');
            // Push heal any player action
        },
    },
    {
        // Gandalf: Gandalf: Guidance
        //  conflict is active
        id: 63,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('Active player: Wild 2');
            //ctx.push_advance_state('turn_play_path', { path: questPath, value: rt.value });
        },
    },
    {
        // Gandalf: Gandalf: Persistence
        id: 64,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('One player: Draw 4 Hobbit cards');
            // TBD - immediate
        },
    },
    {
        // Gandalf: Gandalf: Defiance
        //  Multiple - on sauron move
        id: 65,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('Sauron does not move');
            // TBD - immediate
        },
    },
    {
        // Gandalf: Gandalf: Integrity
        //  Multiple - prior to a die roll
        id: 66,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('Instead of rolling the die, place it with the white side up');
            // TBD - immediate
        },
    },
    {
        // Ent Draught
        id: 81,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('One player: May pass shields to one other player');
            // Push special action
        },
    },
    {
        // Pipe-Weed
        id: 82,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('You may allocate 3 heals among the players');
            // Push heal any player action 3 times
        },
    },
    {
        // Elessar
        id: 85,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('One player: heal');
            // Push heal any player action
        },
    },
    {
        // Phial
        //  turn_reveal_tiles
        id: 86,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('Active player: Do not reveal the next tile');
            // TBD - immediate
        },
    },
    {
        // Lembas
        id: 93,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('One player: Draw Hobbit cards to increase hand to 6 cards');
            // TBD - immediate
        },
    },
    {
        // Belt
        //  Multiple - Prior to rolling a die
        id: 96,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('One player: Do not roll one die');
            // TBD - immediate
        },
    },
    {
        // Mithril
        //  action_roll_die
        id: 102,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('One player: Ignore effects after one die roll');
            // TBD - immediate
        },
    },
    {
        // Athelas
        //  conflict_decent_into_darkness
        id: 106,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('One player: Ignore any effects of missing life tokens once only');
            // TBD - immediate
        },
    },
    {
        // Staff
        //  turn_resolve_tile
        id: 108,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('Ignore one tile showing a sundial and three items');
            // TBD - immediate
        },
    },
    {
        // Miruvor
        id: 109,
        when: (ctx, state) => true,
        action: (ctx) => {
            ctx.log('One player: May pass 1 card to another player');
            // Push special action
        },
    },
];

export default reactions;
