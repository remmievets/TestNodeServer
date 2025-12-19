import { create_deck, deal_card, draw_x_cards, set_of_player_cards, reshuffle_deck } from '../utils/cards.js';
import { get_board_active_quests, is_path_complete, resolve_reward } from '../utils/board.js';
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

const game_end_loss = {
    init(ctx, args) {
        ctx.log('SAURON HAS WON');
    },
    prompt(ctx) {
        return {
            message: 'GAME OVER - LOST',
        };
    },
};

const game_end_win = {
    init(a) {
        ctx.log('The Free People have destroyed the RING');
    },
    prompt() {
        return {
            message: 'GAME OVER - WON',
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
        game_end_loss,
        game_end_win,
        global_debug_menu,
    };
}
