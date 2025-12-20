//////////////////////
/* Undo functions */

/// @brief Save a snapshot of the current game state.
export function save_undo(game) {
    if (!game) {
        console.warn('save_undo called with undefined game');
        return;
    }
    if (!Array.isArray(game.undo)) {
        game.undo = [];
    }
    // Deep copy of game without the undo stack itself
    let snapshot = structuredClone({ ...game, undo: undefined });

    game.undo.push(snapshot);
}

/// @brief Clear all undo history.
export function clear_undo(game) {
    game.undo = [];
}

/// @brief Undo the last action (restore previous game state)
export function pop_undo(game) {
    if (!game.undo?.length) return;

    const prevTurn = game.undo.pop();
    const oldUndo = game.undo;

    // Replace all kets in game with snapshot
    for (let key of Object.keys(game)) {
        delete game[key];
    }
    Object.assign(game, prevTurn);

    // Restore undo (DO NOT use snapshot's undo)
    game.undo = oldUndo;
}
