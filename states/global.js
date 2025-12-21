import { create_deck, deal_card, draw_x_cards, set_of_player_cards, reshuffle_deck } from '../utils/cards.js';
import {
    count_card_type_by_player,
    distribute_card_from_select,
    discard_card_from_player,
    get_active_player_list,
    get_next_player,
    get_active_players_in_order,
    update_player_active,
} from '../utils/player.js';
import { save_undo, clear_undo, pop_undo } from '../utils/undo.js';
import data from '../utils/data.js';
import * as util from '../utils/util.js';

function calculate_score(ctx) {
    let score = 0;
    switch (ctx.game.loc)
    {
        case 'bagend':
            score = 0;
            break;
        case 'rivendell':
            score = 0;
            break;
        case 'lothlorien':
            score = 20;
            break;
        default:
            const mainpath = data[ctx.game.loc].mainpath;
            const pathspace = ctx.game.conflict[mainpath];
            score = data[ctx.game.loc][mainpath][pathspace];
            break;
    }
    return score;
}

const global_game_end = {
    init(ctx, args) {
        // Inform player of situation
        ctx.log('=t GAME OVER');
        ctx.log('=! ' + args.reason);
        if (args.victory) {
            ctx.log('The Free People have destroyed the RING!!');
            ctx.game.action.message = 'GAME OVER - WON';
        } else {
            ctx.log('SAURON HAS WON');
            ctx.game.action.message = 'GAME OVER - LOST';
        }
        // Prevent game changes
        clear_undo(ctx.game);
        ctx.game.stateQueue = [];
        // Make game inactive
        ctx.game.active = false;
        // Calculate final score
        if (args.victory) {
            ctx.game.score = 60;
            // Plus the number of shields held by the players
            // TBD
        } else {

            ctx.game.score = calculate_score(ctx);
        }
        ctx.log(`Final scoure is ${ctx.game.score}`);
    },
    prompt(ctx) {
        return {
            message: ctx.game.action.message,
        };
    },
};

const global_debug_menu = {
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        buttons['debug_return'] = 'exit menu';
        buttons['debug_shield'] = '/bADD SHIELD';
        buttons['debug_reshuffle'] = '/bRESHUFFLE';
        buttons['debug_undo_queue'] = '/bUNDO PRINT';
        buttons['debug_game_print'] = '/bDUMP GAME';
        if (ctx.game.conflict.active === true) {
            buttons['debug_restart'] = '/rGOTO MORIA';
            buttons['debug_end_board'] = '/rEND BOARD';
        }

        // Return prompt information
        return {
            player: ctx.game.currentPlayer,
            message: 'Select option',
            buttons,
        };
    },
    debug_return(ctx) {
        ctx.resume_previous_state();
    },
    debug_shield(ctx) {
        ctx.game.players[ctx.game.currentPlayer].shield += 1;
    },
    debug_reshuffle(ctx) {
        reshuffle_deck(ctx.game);
    },
    debug_undo_queue(ctx) {
        console.log('--------------------');
        console.log('--------------------');
        console.log('--------------------');
        console.log(ctx.game.undo);
        console.log('--------------------');
        console.log('--------------------');
        console.log('--------------------');
    },
    debug_game_print(ctx) {
        console.log('--------------------');
        console.log('--------------------');
        console.log('--------------------');
        console.log(ctx.game);
        console.log('--------------------');
        console.log('--------------------');
        console.log('--------------------');
    },
    debug_restart(ctx) {
        // Eliminate any state queue information
        ctx.game.stateQueue = [];
        ctx.advance_state('conflict_board_start', { name: 'Moria', loc: 'moria' });
    },
    debug_end_board(ctx) {
        // Eliminate any state queue information
        ctx.game.stateQueue = [];
        ctx.advance_state('conflict_board_end');
    },
};

export function global_states() {
    return {
        global_game_end,
        global_debug_menu,
    };
}
