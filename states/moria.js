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
/* Moria Event States */

const moria_speak_friend = {
    init(ctx, args) {
        ctx.log('Group discard friendship and wild');
        ctx.log('Otherwise, sauron moves 1 space');
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        // Determine if group has the cards
        const plist = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
        let countFriendship = 0;
        let countWild = 0;
        for (const p of plist) {
            const friendRt = count_card_type_by_player(ctx.game, p, 'friendship');
            countFriendship += friendRt.cardList.length;
            const wildRt = count_card_type_by_player(ctx.game, p, 'wild');
            countWild += wildRt.cardList.length;
        }
        if (countFriendship >= 1 && countWild >= 1) {
            buttons['discard'] = 'Discard';
        }
        buttons['sauron'] = 'Move Sauron';
        return {
            message: 'Select option',
            buttons,
        };
    },
    discard(ctx) {
        ctx.resume_previous_state();
        // Discard friendship / wild as group
        ctx.push_advance_state('action_discard_group', { count: 2, type: ['friendship', 'wild'] });
    },
    sauron(ctx) {
        ctx.game.sauron -= 1;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        ctx.resume_previous_state();
    },
};

const moria_watcher = {
    init(ctx, args) {
        ctx.log('EACH PLAYER: Discard hide');
        ctx.log('Otherwise, roll die');
        ctx.game.action.playerList = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
        ctx.game.action.roll = -1;
    },
    prompt(ctx) {
        // Once all players have completed then exit
        if (ctx.game.action.playerList.length <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {};
        const cardInfo = count_card_type_by_player(ctx.game, ctx.game.action.playerList[0], 'hide');
        if (cardInfo.value >= 1) {
            buttons['discard'] = 'Discard hide';
        }
        buttons['roll'] = 'Roll';
        return {
            player: ctx.game.action.playerList[0], // peek
            message: 'Discard hide or roll',
            buttons,
        };
    },
    discard(ctx) {
        const p = ctx.game.action.playerList.shift();
        // Push action to discard card
        ctx.push_advance_state('action_discard', { player: p, count: 1, type: 'hide' });
    },
    roll(ctx) {
        const p = ctx.game.action.playerList.shift();
        // If card not played then perform die roll
        let saved_roll = ctx.game.action.roll;
        if (saved_roll < 0) {
            saved_roll = util.roll_d6();
        }
        ctx.game.action.roll = -1;
        // Push action to roll die with player prior to switching players
        ctx.push_advance_state('action_roll_die', { player: ctx.game.currentPlayer, roll: saved_roll });
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const moria_stone = {
    init(ctx, args) {
        ctx.log('Reveal 1 hobbit card from the deck and active player discard 2 matching card symbols to receive Pipe card');
        ctx.log('Otherwise, Sauron and next event');
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
            sauron: 'Move Sauron',
        };
        const cardInfo = count_card_type_by_player(ctx.game, ctx.game.currentPlayer, ctx.game.action.type);
        return {
            player: ctx.game.currentPlayer,
            message: `Discard ${ctx.game.action.count} ${ctx.game.action.type} symbols or move Sauron`,
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
    sauron(ctx) {
        ctx.game.sauron -= 1;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        ctx.resume_previous_state();
        // Force next event to occur
        ctx.game.conflict.eventValue += 1;
        ctx.push_advance_state(data[ctx.game.loc].events[ctx.game.conflict.eventValue].state);
    },
    fini(ctx) {
        // Give active player the pipe card
        give_cards(ctx.game, ctx.game.currentPlayer, data.PIPE_CARD);
        // Return to prior state
        ctx.resume_previous_state();
    },
};

const moria_trapped = {
    init(ctx, args) {
        ctx.log('Travelling and Hiding must be complete');
        ctx.log('Otherwise, Sauron moves 2 and ring bearer rolls die');
    },
    fini(ctx) {
        ctx.resume_previous_state();
        // Check if negative event should occur
        if (ctx.game.conflict.travel < 7 || ctx.game.conflict.hide < 7) {
            ctx.game.sauron -= 2;
            ctx.log('Sauron advances to space ' + ctx.game.sauron);
            ctx.push_advance_state('action_roll_die', { player: ctx.game.ringBearer });
        }
    },
};

const moria_orcs_attack = {
    init(ctx, args) {
        ctx.log('Group discard 5 fight');
        ctx.log('Otherwise, Sauron moves 2');
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        // Determine if group has the cards
        const plist = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
        let fightValue = 0;
        for (const p of plist) {
            const rt = count_card_type_by_player(ctx.game, p, 'fight');
            fightValue += rt.value;
        }
        if (fightValue >= 5) {
            buttons['discard'] = 'Discard 5 Fight';
        }
        buttons['sauron'] = 'Move Sauron 2';
        return {
            message: 'Select option',
            buttons,
        };
    },
    discard(ctx) {
        ctx.resume_previous_state();
        // Discard 5 fight as group
        ctx.push_advance_state('action_discard_group', { count: 5, type: 'fight' });
    },
    sauron(ctx) {
        ctx.game.sauron -= 2;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        ctx.resume_previous_state();
    },
};

const moria_fly_you_fools = {
    init(ctx, args) {
        ctx.log('One player 3 corruption');
        ctx.log('Otherwise, each player rolls die');
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        // Get all active players
        const plist = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
        for (const p of plist) {
            buttons[`corrupt ${p}`] = p;
        }
        buttons['roll'] = 'Roll';
        return {
            message: 'One player receives 3 corruption or each player rolls die',
            buttons,
        };
    },
    corrupt(ctx, args) {
        const p = args[0];
        ctx.game.player[p].corruption += 3;
        ctx.resume_previous_state();
    },
    roll(ctx) {
        ctx.resume_previous_state();
        // Each player must roll a die, go in reverse order so action starts with current player
        const plist = get_active_players_in_order(ctx.game, ctx.game.currentPlayer).reverse();
        for (const p of plist) {
            ctx.push_advance_state('action_roll_die', { player: p });
        }
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
