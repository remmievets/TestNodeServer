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
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        // Determine which players are active and have cards to play this action
        const plist = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
        for (const p of plist) {
            const cardInfo = count_card_type_by_player(ctx.game, p, ['friendship', 'fight']);
            if (cardInfo.value >= 2) {
                buttons[`discard ${p}`] = p;
            }
        }
        buttons['bad'] = 'Discard Helms Deep feature cards';
        return {
            message: 'One player discard friendship and fight, otherwise discard remaining Helms Deep feature cards',
            buttons,
        };
    },
    discard(ctx, args) {
        ctx.resume_previous_state();
        const p = args[0];
        ctx.log(`${p} will discard 2 hiding`);
        ctx.push_advance_state('action_discard', { player: p, count: 2, type: ['friendship', 'fight'] });
    },
    bad(ctx) {
        ctx.resume_previous_state();
        ctx.log('Remaining Helms Deep feature cards are discarded');
        ctx.game.globals.discard_helms_deep_feature_cards = true;
    },
};

const helmsdeep_riders_of_rohan = {
    init(ctx, args) {
        ctx.log('If Friendship is complete then active player receives the Riders of Rohan card');
        ctx.log('Otherwise move Sauron and Ring-bearer rolls die');
    },
    fini(ctx) {
        ctx.resume_previous_state();
        if (ctx.game.conflict.friendship < 7) {
            ctx.log('First part of friendship is NOT complete');
            ctx.game.sauron -= 1;
            ctx.log('Sauron advances to space ' + ctx.game.sauron);
            ctx.push_advance_state('action_roll_die', { player: ctx.game.ringBearer });
        } else {
            ctx.log('First part of friendship is complete');
            // Give active player the card
            give_cards(ctx.game, ctx.game.currentPlayer, data.RIDERS_OF_ROHAN);
        }
    },
};

const helmsdeep_orcs_attack = {
    init(ctx, args) {
        ctx.log('If first part of Travelling complete then each player receives 1 Hobbit card');
        ctx.log('Otherwise move Sauron 2 spaces');
    },
    fini(ctx) {
        ctx.resume_previous_state();
        if (ctx.game.conflict.travel < 5) {
            ctx.log('First part of travelling is NOT complete');
            ctx.game.sauron -= 2;
            ctx.log('Sauron advances to space ' + ctx.game.sauron);
        } else {
            ctx.log('First part of travelling is complete');
            // Each player draws a hobbit card
            const players = get_active_player_list(ctx.game);
            for (const p of players) {
                draw_cards(ctx.game, p, 1);
            }
        }
    },
};

const helmsdeep_orthanc = {
    init(ctx, args) {
        ctx.log('Reveal 1 Hobbit card from the deck and Active player discards 2 matching card symbols');
        ctx.log('Otherwise each player rolls a die');
        ctx.game.action.card = deal_card(ctx.game);
        ctx.game.action.type = data.cards[ctx.game.action.card].quest;
        ctx.game.action.count = 2;
    },
    prompt(ctx) {
        if (ctx.game.action.count <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {
            roll: 'Each player rolls die',
        };
        const cardInfo = count_card_type_by_player(ctx.game, ctx.game.currentPlayer, ctx.game.action.type);
        return {
            player: ctx.game.currentPlayer,
            message: `Discard ${ctx.game.action.count} ${ctx.game.action.type} symbols or each player rolls die`,
            buttons,
            cards: cardInfo.cardList.slice(),
        };
    },
    card(ctx, cardArray) {
        const rt = discard_cards(ctx.game, ctx.game.currentPlayer, cardArray);
        if (rt.value > 0) {
            // Decrease amount needed
            ctx.game.action.count -= rt.value;
        }
    },
    roll(ctx) {
        // Return to prior state, but push actions for die rolls
        ctx.resume_previous_state();
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
    },
    prompt(ctx) {
        let ringCount = 0;
        let heartCount = 0;
        let sunCount = 0;
        const pArray = get_active_player_list(ctx.game);
        for (const p of pArray) {
            ringCount += ctx.game.players[p].ring;
            heartCount += ctx.game.players[p].heart;
            sunCount += ctx.game.players[p].sun;
        }
        // Build buttons dynamically
        const buttons = {};
        if (ringCount >= 1 && heartCount >= 1 && sunCount >= 1) {
            buttons['discard'] = 'Discard 3 life tokens';
        }
        buttons['sauron'] = 'Move Sauron 2';
        return {
            message: 'Discard 3 life tokens or move Sauron 2 spaces',
            buttons,
        };
    },
    discard(ctx) {
        ctx.resume_previous_state();
        ctx.push_advance_state('action_discard_item_group', { count: 3, type: 'life_token' });
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
    },
    fini(ctx) {
        ctx.resume_previous_state();
        ctx.game.sauron -= 2;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        if (ctx.game.conflict.travel < 10) {
            ctx.log('Travelling is NOT complete');
            ctx.push_advance_state('action_roll_die', { player: ctx.game.ringBearer });
            ctx.push_advance_state('action_roll_die', { player: ctx.game.ringBearer });
        } else {
            ctx.log('Travelling is complete');
        }
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
