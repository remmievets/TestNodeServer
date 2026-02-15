import {
    create_deck,
    deal_card,
    give_cards,
    draw_cards,
    discard_cards,
    play_cards,
    play_gandalf_cards,
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
    get_active_players_with_resource,
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
        when: (ctx, card) => ctx.game.conflict.active && (get_active_players_with_resource(ctx.game, 'shield', 5).length > 0),
        action: (ctx, card) => {
            ctx.log('One player: Rearrange top 3 tiles');
            play_gandalf_cards(ctx.game, card);
            // Push special action
            //      TBD
            // Push pick player to pay for gandalf card
            ctx.push_advance_state('action_play_gandalf', { card: card });
        },
    },
    {
        // Gandalf: Magic
        //  turn_resolve_tile
        id: 61,
        when: (ctx, card) => (ctx.game.state === 'turn_resolve_tile') && (get_active_players_with_resource(ctx.game, 'shield', 5).length > 0),
        action: (ctx, card) => {
            ctx.log('After moving the event marker ignore the event');
            play_gandalf_cards(ctx.game, card);
            // Push special action
            //      TBD
            // Push pick player to pay for gandalf card
            ctx.push_advance_state('action_play_gandalf', { card: card });
        },
    },
    {
        // Gandalf: Healing
        id: 62,
        when: (ctx, card) => get_active_players_with_resource(ctx.game, 'shield', 5).length > 0,
        action: (ctx, card) => {
            ctx.log('One player: Heal 2');
            play_gandalf_cards(ctx.game, card);
            // Push heal any player action
            ctx.push_advance_state('action_heal_player', { count: 2 });
            // Push pick player to pay for gandalf card
            ctx.push_advance_state('action_play_gandalf', { card: card });
        },
    },
    {
        // Gandalf: Guidance
        //  conflict is active
        id: 63,
        when: (ctx, card) => ctx.game.conflict.active && (get_active_players_with_resource(ctx.game, 'shield', 5).length > 0),
        action: (ctx, card) => {
            ctx.log('Active player: Wild 2');
            play_gandalf_cards(ctx.game, card);
            // Push action to play 2 wild card in value
            ctx.push_advance_state('turn_play_path', { path: 'wild', value: 2 });
            // Push pick player to pay for gandalf card
            ctx.push_advance_state('action_play_gandalf', { card: card });
        },
    },
    {
        // Gandalf: Persistence
        id: 64,
        when: (ctx, card) => get_active_players_with_resource(ctx.game, 'shield', 5).length > 0,
        action: (ctx, card) => {
            ctx.log('One player: Draw 4 Hobbit cards');
            play_gandalf_cards(ctx.game, card);
            // Push draw cards
            ctx.push_advance_state('action_draw_cards', { count: 4 });
            // Push pick player to pay for gandalf card
            ctx.push_advance_state('action_play_gandalf', { card: card });
        },
    },
    {
        // Gandalf: Defiance
        //  Multiple - on sauron move
        id: 65,
        when: (ctx, card) => (get_active_players_with_resource(ctx.game, 'shield', 5).length > 0), // TBD
        action: (ctx, card) => {
            ctx.log('Sauron does not move');
            play_gandalf_cards(ctx.game, card);
            // Push special action
            //      TBD
            // Push pick player to pay for gandalf card
            ctx.push_advance_state('action_play_gandalf', { card: card });
        },
    },
    {
        // Gandalf: Integrity
        //  Multiple - prior to a die roll
        id: 66,
        when: (ctx, card) => (get_active_players_with_resource(ctx.game, 'shield', 5).length > 0), // TBD
        action: (ctx, card) => {
            ctx.log('Instead of rolling the die, place it with the white side up');
            play_gandalf_cards(ctx.game, card);
            // Push resolve die roll
            //      TBD
            ctx.game.action.roll = 6;
            // Push pick player to pay for gandalf card
            ctx.push_advance_state('action_play_gandalf', { card: card });
        },
    },
    {
        // Ent Draught
        id: 81,
        when: (ctx, card) => find_player_with_card(ctx.game, card) != null,
        action: (ctx, card) => {
            ctx.log('One player: May pass shields to one other player');
            play_cards(ctx.game, find_player_with_card(ctx.game, card), card);
            ctx.push_advance_state('action_pass_shields');
        },
    },
    {
        // Pipe-Weed
        id: 82,
        when: (ctx, card) => find_player_with_card(ctx.game, card) != null,
        action: (ctx, card) => {
            ctx.log('You may allocate 3 heals among the players');
            play_cards(ctx.game, find_player_with_card(ctx.game, card), card);
            ctx.push_advance_state('action_heal_player');
            ctx.push_advance_state('action_heal_player');
            ctx.push_advance_state('action_heal_player');
        },
    },
    {
        // Elessar
        id: 85,
        when: (ctx, card) => find_player_with_card(ctx.game, card) != null,
        action: (ctx, card) => {
            ctx.log('One player: heal');
            play_cards(ctx.game, find_player_with_card(ctx.game, card), card);
            ctx.push_advance_state('action_heal_player');
        },
    },
    {
        // Phial
        //  turn_reveal_tiles
        id: 86,
        when: (ctx, card) => (ctx.game.state === 'turn_resolve_tile') && (find_player_with_card(ctx.game, card) != null),
        action: (ctx, card) => {
            ctx.log('Active player: Do not reveal the next tile');
            play_cards(ctx.game, find_player_with_card(ctx.game, card), card);
            // Advance to next turn phase
            ctx.advance_state('turn_play_pick');
        },
    },
    {
        // Lembas
        id: 93,
        when: (ctx, card) => find_player_with_card(ctx.game, card) != null,
        action: (ctx, card) => {
            ctx.log('One player: Draw Hobbit cards to increase hand to 6 cards');
            play_cards(ctx.game, find_player_with_card(ctx.game, card), card);
            ctx.push_advance_state('action_draw_cards', { count: 6, limit: 6 });
        },
    },
    {
        // Belt
        //  Multiple - Prior to rolling a die
        id: 96,
        when: (ctx, card) => (ctx.game.action.roll < 0) && (find_player_with_card(ctx.game, card) != null), // Still issues here - TBD
        action: (ctx, card) => {
            ctx.log('One player: Do not roll one die');
            play_cards(ctx.game, find_player_with_card(ctx.game, card), card);
            ctx.game.action.roll = 6;
        },
    },
    {
        // Mithril
        //  action_roll_die
        id: 102,
        when: (ctx, card) => (ctx.game.state === 'action_roll_die') && (find_player_with_card(ctx.game, card) != null),
        action: (ctx, card) => {
            ctx.log('One player: Ignore effects after one die roll');
            play_cards(ctx.game, find_player_with_card(ctx.game, card), card);
            // Exit out of state without applying results of die roll
            ctx.resume_previous_state();
        },
    },
    {
        // Athelas
        //  conflict_decent_into_darkness
        id: 106,
        when: (ctx, card) => (ctx.game.state === 'conflict_decent_into_darkness') && (find_player_with_card(ctx.game, card) != null),
        action: (ctx, card) => {
            ctx.log('One player: Ignore any effects of missing life tokens once only');
            play_cards(ctx.game, find_player_with_card(ctx.game, card), card);
            // Exit out of decent into darkness without applying corruption
            ctx.resume_previous_state();
        },
    },
    {
        // Staff
        //  turn_resolve_tile
        id: 108,
        when: (ctx, card) => (ctx.game.state === 'turn_resolve_tile') && (find_player_with_card(ctx.game, 108) != null),
        action: (ctx, card) => {
            ctx.log('Ignore one tile showing a sundial and three items');
            play_cards(ctx.game, find_player_with_card(ctx.game, card), card);
            // Draw another tile - no other action needed
            ctx.advance_state('turn_reveal_tiles');
        },
    },
    {
        // Miruvor
        id: 109,
        when: (ctx, card) => find_player_with_card(ctx.game, card) != null,
        action: (ctx, card) => {
            ctx.log('One player: May pass 1 card to another player');
            play_cards(ctx.game, find_player_with_card(ctx.game, card), card);
            ctx.push_advance_state('action_pass_cards');
        },
    },
];

export default reactions;
