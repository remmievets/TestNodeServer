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
    get_active_players_with_resource,
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
        give_cards(ctx.game, ctx.game.currentPlayer, data.GOLLUM_CARD);
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
        ctx.log('EACH PLAYER: Discard wild');
        ctx.log('Otherwise discard 3 shield');
        ctx.game.action.playerList = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
    },
    prompt(ctx) {
        // Once all players have completed then exit
        if (ctx.game.action.playerList.length <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {};
        const cardInfo = count_card_type_by_player(ctx.game, ctx.game.action.playerList[0], 'wild');
        if (cardInfo.value >= 1) {
            buttons['discard'] = 'Discard wild';
        }
        if (ctx.game.players[ctx.game.action.playerList[0]].shield >= 3) {
            buttons['shield'] = 'Discard 3 shields';
        }
        if (cardInfo.value === 0 && ctx.game.players[ctx.game.action.playerList[0]].shield < 3) {
            buttons['die'] = 'Player is corrupted';
        }
        return {
            player: ctx.game.action.playerList[0], // peek
            message: 'Discard wild or 3 shields',
            buttons,
        };
    },
    discard(ctx) {
        const p = ctx.game.action.playerList.shift();
        // Push action to discard card
        ctx.push_advance_state('action_discard', { player: p, count: 1, type: 'wild' });
    },
    shield(ctx) {
        const p = ctx.game.action.playerList.shift();
        // Log message
        ctx.log(`${p} discards 3 shields`);
        // Decrease 3 shields
        ctx.game.players[p].shield -= 3;
    },
    die(ctx) {
        const p = ctx.game.action.playerList.shift();
        // If player cannot pay they are corrupted
        ctx.game.players[p].corruption = ctx.game.sauron;
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
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        const players = get_active_players_with_resource(ctx.game, 'shield');
        for (const p of players) {
            buttons[`discard ${p}`] = `${p}`;
        }
        buttons['sauron'] = 'Move Sauron 2';
        return {
            message: 'One player discard 5 shields or move sauron 2 spaces',
            buttons,
        };
    },
    discard(ctx, args) {
        const p = args[0];
        ctx.log(`${p} discards 5 shields`);
        ctx.game.players[p].shield -= 5;
        // Each player draws a hobbit card
        const players = get_active_player_list(ctx.game);
        for (const p of players) {
            draw_cards(ctx.game, p, 1);
        }
        ctx.resume_previous_state();
    },
    sauron(ctx) {
        ctx.game.sauron -= 2;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        ctx.resume_previous_state();
    },
};

const shelobslair_nazgul = {
    init(ctx, args) {
        ctx.log('Reveal 1 card from the deck and Ring-bearer discard 3 matching card symbols to heal');
        ctx.log('Otherwise each player rolls the die');
        ctx.game.action.card = deal_card(ctx.game);
        ctx.game.action.type = data.cards[ctx.game.action.card].quest;
        ctx.game.action.count = 3;
    },
    prompt(ctx) {
        if (ctx.game.action.count <= 0) {
            return null;
        }
        // Build buttons dynamically
        const buttons = {
            roll: 'Each player rolls die',
        };
        const cardInfo = count_card_type_by_player(ctx.game, ctx.game.ringBearer, ctx.game.action.type);
        return {
            player: ctx.game.ringBearer,
            message: `Discard ${ctx.game.action.count} ${ctx.game.action.type} symbols or each player rolls die`,
            buttons,
            cards: cardInfo.cardList.slice(),
        };
    },
    card(ctx, cardArray) {
        const rt = discard_cards(ctx.game, ctx.game.ringBearer, cardArray);
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
        if (ctx.game.players[ctx.game.ringBearer].corruption > 0) {
            ctx.game.players[ctx.game.ringBearer].corruption -= 1;
        }
        ctx.resume_previous_state();
    },
};

const shelobslair_appears = {
    init(ctx, args) {
        ctx.log('Active player rolls the die twice');
        ctx.log('Otherwise move sauron 2 spaces');
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        buttons['roll'] = 'Active player roll 2 dice';
        buttons['sauron'] = 'Move Sauron 2';
        return {
            player: ctx.game.currentPlayer,
            message: 'Active player rolls 2 dice or move Sauron 2 spaces',
            buttons,
        };
    },
    roll(ctx) {
        ctx.resume_previous_state();
        ctx.push_advance_state('action_roll_die', { player: ctx.game.currentPlayer });
        ctx.push_advance_state('action_roll_die', { player: ctx.game.currentPlayer });
    },
    sauron(ctx) {
        ctx.game.sauron -= 2;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
        ctx.resume_previous_state();
    },
};

const shelobslair_attacks = {
    init(ctx, args) {
        ctx.log('Group discards 7 fight cards');
        ctx.log('Otherwise move sauron 3 spaces');
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
        if (fightValue >= 7) {
            buttons['discard'] = 'Discard 7 Fight';
        }
        buttons['sauron'] = 'Move Sauron 3';
        return {
            message: 'Select option',
            buttons,
        };
    },
    discard(ctx) {
        ctx.resume_previous_state();
        // Discard 7 fight as group
        ctx.push_advance_state('action_discard_group', { count: 7, type: 'fight' });
    },
    sauron(ctx) {
        ctx.game.sauron -= 3;
        ctx.log('Sauron advances to space ' + ctx.game.sauron);
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
