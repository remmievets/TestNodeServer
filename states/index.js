//////////////////////
/* Game States */
/// State interface conceptual
///
/// init?(ctx, args)
///     Called once when entering the state
///
/// prompt?(ctx) => Prompt | null
///     Calculate player prompt and options
///     Return null to auto-advance
///
/// fini?(ctx)
///     Called when prompt returns null - must adjust state
///
/// [buttonName: string]: (ctx, args) => void
///     Handles user clicks/button responses
///
/// function prompt - required
/// - Return to the user the following if user has an action to perform
///   - message - Message to display to user which describes the action
///   - player <optional> - An indication if this action is limited to one player or a group of players.  If not provided then any player can perform action
///   - buttons <optional> - A list of buttons and the function to call if the user selects the button
///   - action
///     - name - type of action that client needs to implement
///         - "distribute" - distribute <card id> <player name>
///         - "discard" - discard <card id>
///         - "pass" - pass <card id> <player name>
///         - "play" - play <card id> [track, track, track]
///     - cards - A list of cards which can be played / selected by the player(s) to support the action
///     - state.number - The number of remaining actions the player(s) needs to make
/// - Return null if no user action is needed

import { bagend_states } from './bagend.js';
import { rivendell_states } from './rivendell.js';
import { lothlorien_states } from './lothlorien.js';
import { action_states } from './action.js';
import { conflict_states } from './conflict.js';
import { global_states } from './global.js';

export function create_states() {
    return {
        ...bagend_states(),
        ...rivendell_states(),
        ...lothlorien_states(),
        ...action_states(),
        ...conflict_states(),
        ...global_states(),
    };
}
