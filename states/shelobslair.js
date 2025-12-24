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
/* Shelobs Lair Event States */

const shelobslair_gollum = {
    init(ctx, args) {
        ctx.log('Group may discard 7 shields, then active player receives Gollum card and all other players draw 2 Hobbit cards');
        ctx.game.action.reward = false;
    },
    prompt(ctx) {
        // Exit path for this state
        if (ctx.game.action.reward) {
            return null;
        }

        // Build buttons dynamically
        const buttons = {};
        if (count_total_shields(ctx.game) >= 7) {
            buttons['discard'] = 'Discard 7 Shields';
        }
        buttons['pass'] = 'Pass';
        return {
            message: 'Discard 7 shields or pass',
            buttons,
        };
    },
    discard(ctx) {
        // Signal that option was selected and once complete reward should be given
        ctx.game.action.reward = true;
        // Goto discard item action
        ctx.push_advance_state('action_discard_item_group', { count: 7, type: 'shield' });
    },
    pass(ctx) {
        ctx.resume_previous_state();
    },
    fini(ctx) {
        // Give reward
        // Current player receives Gollum card
        give_cards(ctx.game, ctx.game.currentPlayer, 114);
        // All other players receive 2 cards
        const otherPlayers = get_active_player_list(ctx.game).filter((p) => p !== ctx.game.currentPlayer);
        for (const p of otherPlayers) {
            draw_cards(ctx.game, p, 2);
        }
        // Return to prior state
        ctx.resume_previous_state();
    },
};

const shelobslair_faces = {
    init(ctx, args) {
        ctx.log('EACH PLAYER: Discard wild otherwise discard 3 shield');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const shelobslair_pool = {
    init(ctx, args) {
        ctx.log('One player discard 5 shields then each player draws 1 Hobbit card');
        ctx.log('Otherwise move sauron 2 spaces');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const shelobslair_nazgul = {
    init(ctx, args) {
        ctx.log('Reveal 1 card from the deck and Ring-bearer discard 3 matching card symbols to heal');
        ctx.log('Otherwise each player rolls the die');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const shelobslair_appears = {
    init(ctx, args) {
        ctx.log('Active player rolls the die twice');
        ctx.log('Otherwise move sauron 2 spaces');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const shelobslair_attacks = {
    init(ctx, args) {
        ctx.log('Group discards 7 fight cards');
        ctx.log('Otherwise move sauron 3 spaces');
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

export function shelobslair_states() {
    return {
        shelobslair_gollum,
        shelobslair_faces,
        shelobslair_pool,
        shelobslair_nazgul,
        shelobslair_appears,
        shelobslair_attacks,
    };
}
