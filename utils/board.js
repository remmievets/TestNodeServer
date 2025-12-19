import data from './data.js';

//////////////////////
/* Board function */

export function get_board_active_quests(game) {
    const board = data[game.loc];
    const questTypes = ['fight', 'travel', 'hide', 'friendship'];
    const quests = [];

    for (const q of questTypes) {
        // Does the quest exist for this board?
        if (board[q]) {
            // If the quest path still active - or has it completed
            if (!is_path_complete(game, q)) {
                quests.push(q);
            }
        }
    }

    return quests;
}

export function is_path_complete(game, path) {
    const quest = data[game.loc][path]; // might be undefined
    const progress = game.conflict[path];
    let result;

    if (!quest) {
        // if path does not exist at all → consider it complete
        result = true;
    } else if (progress < quest.length - 1) {
        result = false;
    } else {
        result = true;
    }
    return result;
}

export function resolve_reward(game, path) {
    let result = true;
    const pathData = data[game.loc][path];
    const curIndex = game.conflict[path];

    switch (pathData[curIndex].action) {
        case 'shield':
        case 'ring':
        case 'sun':
        case 'heart':
            game.players[game.currentPlayer][pathData[curIndex].action] += 1;
            break;
        case 'bigshield':
            game.players[game.currentPlayer].shield += game.shield.pop();
            break;
        case 'heal':
            if (game.players[game.currentPlayer].corruption > 0) {
                game.players[game.currentPlayer].corruption -= 1;
            }
            break;
        case 'roll':
            // Handle roll separately
            result = false;
            break;
        default:
            break;
    }
    return result;
}
