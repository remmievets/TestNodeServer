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

//////////////////////
/* Conflict Helper functions */

function is_path_complete(game, path) {
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

function get_board_active_quests(game) {
    const quests = data.tracks.filter((t) => !is_path_complete(game, t));
    return quests;
}

function resolve_reward(ctx, path) {
    const pathData = data[ctx.game.loc][path];
    const curIndex = ctx.game.conflict[path];

    switch (pathData[curIndex].action) {
        case 'shield':
        case 'ring':
        case 'sun':
        case 'heart':
            ctx.game.players[ctx.game.currentPlayer][pathData[curIndex].action] += 1;
            ctx.log(`${ctx.game.currentPlayer} receives a ${pathData[curIndex].action}`);
            break;
        case 'bigshield':
            const shieldValue = ctx.game.shield.pop();
            ctx.game.players[ctx.game.currentPlayer].shield += shieldValue;
            ctx.log(`${ctx.game.currentPlayer} receives ${shieldValue} shields`);
            break;
        case 'heal':
            if (ctx.game.players[ctx.game.currentPlayer].corruption > 0) {
                ctx.game.players[ctx.game.currentPlayer].corruption -= 1;
                ctx.log(`${ctx.game.currentPlayer} heals one corruption`);
            }
            break;
        case 'roll':
            ctx.log(`${ctx.game.currentPlayer} rolls a die??`);
            ctx.push_advance_state('action_roll_die');
            break;
        case 'card':
            ctx.log(`${ctx.game.currentPlayer} gets a card???`);
            break;
        default:
            break;
    }
}

function check_end_of_mainpath(ctx) {
    const path = data[ctx.game.loc].mainpath;
    if (is_path_complete(ctx.game, path)) {
        // Main path is complete, so transition to end of board
        ctx.advance_state('conflict_board_end');
        return true;
    }
    return false;
}

//////////////////////
/* Conflict States */

const new_player_turn = {
    init(ctx, args) {
        ctx.log(data.players[ctx.game.currentPlayer] + ' ' + ctx.game.currentPlayer);
    },
    fini(ctx) {
        // Advance to next state
        ctx.advance_state('turn_reveal_tiles');
    },
};

const turn_reveal_tiles = {
    init(ctx, args) {
        // No action needed currently
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {
            reveal_tile: 'Pull tile',
        };
        return {
            player: ctx.game.currentPlayer,
            message: 'Select option',
            buttons,
        };
    },
    reveal_tile(ctx) {
        // Pull a tile and advance to resolving the tile
        const t = ctx.game.story.pop();
        ctx.log(ctx.game.currentPlayer + ' draws a tile');
        ctx.log('T' + t);
        ctx.advance_state('turn_resolve_tile', { lasttile: t });
    },
};

const turn_resolve_tile = {
    init(ctx, args) {
        // Save the tile we are attempting to resolve
        ctx.game.action.lasttile = args.lasttile;
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        // Does the tile contain options?
        const t = data.tiles[ctx.game.action.lasttile].type;
        switch (t) {
            case 'ring':
                // Default action
                buttons['resolve_ring'] = 'Resolve Tile';
                break;
            case 'event':
                // Default action
                buttons['resolve_event'] = 'Resolve Tile';
                break;
            case 'event_cards':
                // Discard 3 cards as a group
                // Make sure the group has 3 cards to discard
                if (set_of_player_cards(ctx.game).size >= 3) {
                    buttons['avoid_event_cards'] = 'Discard Cards';
                }
                // Default action
                buttons['resolve_event'] = 'Resolve Tile';
                break;
            case 'event_life':
                // Discard 1 card, 1 life token, 1 shield as a group
                // Make sure the group has the required items to discard
                if (set_of_player_cards(ctx.game).size >= 1) {
                    // TBD - Make sure 1 life token and 1 shield
                    buttons['avoid_event_items'] = 'Discard Items';
                }
                // Default action
                buttons['resolve_event'] = 'Resolve Tile';
                break;
            case 'sauron':
                // Move sauron or one player takes 2 corruption
                // Determine which players are active and can take corruption
                const plist = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
                for (const p of plist) {
                    buttons[`resolve_corruption ${p}`] = p;
                }
                buttons['resolve_sauron'] = 'Move Sauron';
                break;
            default:
                // Good tile - determine if tile is on board
                // If game includes board element and it is not complete
                //      Allow only one option for advance on single path
                // else
                //      Allow advancement on any not completed path on the board
                if (is_path_complete(ctx.game, t) === false) {
                    buttons[`resolve_path ${t}`] = 'Resolve Tile';
                } else {
                    // Player can advance any track that is not complete
                    for (const path of data.tracks) {
                        // Is this path an option to be selected
                        if (is_path_complete(ctx.game, path) === false) {
                            buttons[`resolve_path ${path}`] = `Resolve as ${path}`;
                        }
                    }
                }
                break;
        }
        // Return prompt information
        return {
            player: ctx.game.currentPlayer,
            message: 'Select option',
            buttons,
        };
    },
    resolve_ring(ctx) {
        // Corrupt ring bearer
        ctx.log(ctx.game.ringBearer + ' increases corruption by 1');
        ctx.game.players[ctx.game.ringBearer].corruption += 1;
        // Draw another tile
        ctx.advance_state('turn_reveal_tiles');
    },
    avoid_event_cards(ctx) {
        // Draw another tile after interrupting the action
        ctx.advance_state('turn_reveal_tiles');

        // Interrupt action with discarding the 3 cards
        ctx.push_advance_state('action_discard_group', { count: 3, type: 'card' });
    },
    avoid_event_items(ctx) {
        // Draw another tile after interrupting the action
        ctx.advance_state('turn_reveal_tiles');

        // Interrupt action with discarding the 1 shield
        //push_advance_state('action_discard_item_group', { count: 1, type: 'shield' });    TBD - Discard shield

        // Interrupt action with discarding the 1 life token
        //push_advance_state('action_discard_item_group', { count: 1, type: 'life_token' });    TBD - Discard life token

        // Interrupt action with discarding the 1 card
        ctx.push_advance_state('action_discard_group', { count: 1, type: 'card' });
    },
    resolve_event(ctx) {
        ctx.log('resolve event ' + data.tiles[ctx.game.action.lasttile].type);
        ctx.game.conflict.eventValue += 1;
        // TBD - resolve event
        // Next state
        if (ctx.game.conflict.eventValue < 6) {
            // Draw another tile
            ctx.advance_state('turn_reveal_tiles');
        } else {
            // End of board
            ctx.advance_state('conflict_board_end');
        }
    },
    resolve_corruption(ctx, p) {
        ctx.log(p + ' increases corruption by 2');
        ctx.game.players[p].corruption += 2;
        // Draw another tile
        ctx.advance_state('turn_reveal_tiles');
    },
    resolve_sauron(ctx) {
        ctx.game.sauron -= 1;
        ctx.log('Sauron moves to ' + ctx.game.sauron);
        // Draw another tile
        ctx.advance_state('turn_reveal_tiles');
    },
    resolve_path(ctx, t) {
        const path = t[0];
        // Advance on desired track and claim rewards/items
        if (data[ctx.game.loc][path]) {
            // Advance path
            ctx.game.conflict[path] += 1;
            ctx.log(`${ctx.game.currentPlayer} advances on ${path}`);
            // Advance to next turn phase
            ctx.advance_state('turn_play_pick');
            // Get reward - which may contain a side action and push state
            resolve_reward(ctx, path);
        }
    },
};

const turn_play_pick = {
    init(ctx, args) {
        // Verify that main path is still valid
        check_end_of_mainpath(ctx);
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        buttons['play'] = 'Play cards';
        buttons['draw'] = 'Draw 2 cards';
        buttons['heal'] = 'Heal';
        // Have player select an option - play/draw/heal
        return {
            player: ctx.game.currentPlayer,
            message: 'Select option',
            buttons,
        };
    },
    play(ctx) {
        // Allow player to select 2 cards to play
        ctx.advance_state('turn_play_cards');
    },
    draw(ctx) {
        // Draw 2 cards
        draw_x_cards(ctx.game, ctx.game.currentPlayer, 2);
        // Action is complete, advance to next Player
        ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
        ctx.advance_state('new_player_turn');
    },
    heal(ctx) {
        if (ctx.game.players[ctx.game.currentPlayer].corruption > 0) {
            ctx.game.players[ctx.game.currentPlayer].corruption -= 1;
        }
        // Action is complete, advance to next Player
        ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
        ctx.advance_state('new_player_turn');
    },
};

const turn_play_cards = {
    init(ctx, args) {
        ctx.game.action.filter = ['white', 'grey'];
        ctx.game.action.count = 2;
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        if (ctx.game.action.count > 0) {
            buttons['pass'] = 'Pass';
            // Only allow player to play a valid card based on active quests/paths
            const cardInfo = count_card_type_by_player(
                ctx.game,
                ctx.game.currentPlayer,
                get_board_active_quests(ctx.game),
                ctx.game.action.filter,
            );
            return {
                player: ctx.game.currentPlayer,
                message: `Play ${ctx.game.action.count} cards`,
                buttons,
                cards: cardInfo.cardList.slice(),
            };
        } else {
            // Completed playing cards - return null to end phase
            return null;
        }
    },
    pass(ctx) {
        // Advance to next Player
        ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
        ctx.advance_state('new_player_turn');
    },
    card(ctx, cardArray) {
        const cardInt = parseInt(cardArray[0], 10); // Convert to int if needed
        const cardValue = discard_card_from_player(ctx.game, ctx.game.currentPlayer, cardInt);
        if (cardValue >= 0) {
            // Create log record of transaction
            ctx.log(`${ctx.game.currentPlayer} plays C${cardInt}`);
            // Keep track of which card was played unless pippin is the current player
            const cardData = data.cards[cardInt];
            // Pippin: can play any two cards
            if (ctx.game.currentPlayer !== 'Pippin') {
                ctx.game.action.filter = ctx.game.action.filter.filter((t) => t !== cardData.type);
            }
            // Decrease count and check if both cards were played
            ctx.game.action.count -= 1;
            // Create a variable for quest
            let questPath = cardData.quest;
            // Frodo: treat white as wild
            const isFrodoWild = ctx.game.currentPlayer === 'Frodo' && cardData.type === 'white';
            if (isFrodoWild) {
                // Have user pick track
                questPath = 'wild';
            }
            // Advance on path with information from card
            ctx.push_advance_state('turn_play_path', { path: questPath, value: cardValue });
        }
    },
    fini(ctx) {
        // Advance to next Player
        ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
        ctx.advance_state('new_player_turn');
    },
};

const turn_play_path = {
    init(ctx, args) {
        // If path is complete then change to wild
        if (is_path_complete(ctx.game, args.path) == true) {
            ctx.game.action.paths = get_board_active_quests(ctx.game);
        } else {
            ctx.game.action.paths = [args.path];
        }
        ctx.game.action.count = args.value;
        ctx.log(`${ctx.game.currentPlayer} can advance ${ctx.game.action.count} on ${ctx.game.action.paths}`);
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        if (ctx.game.action.count > 0) {
            // Create button for each path which is available
            for (const p of ctx.game.action.paths) {
                buttons[`resolve_path ${p}`] = `Advance as ${p}`;
            }
            return {
                player: ctx.game.currentPlayer,
                message: `Select path to advance by ${ctx.game.action.count} spaces`,
                buttons,
            };
        } else {
            // Completed playing cards - return null to end phase
            return null;
        }
    },
    resolve_path(ctx, t) {
        const path = t[0];
        // Advance on desired track and claim rewards/items
        if (data[ctx.game.loc][path]) {
            // Advance path
            ctx.game.conflict[path] += 1;
            ctx.log(`${ctx.game.currentPlayer} advances on ${path}`);
            // Allow advance multiple spaces if needed
            if (is_path_complete(ctx.game, path) === true) {
                // Path is complete allow state to end
                ctx.game.action.count = 0;
            } else {
                // Current path is not complete, so allow multiple actions on same path
                ctx.game.action.count -= 1;
                // Once path is selected then do not allow path to change
                ctx.game.action.paths = [path];
            }
            // Get reward
            resolve_reward(ctx, path);
        }
    },
    fini(ctx) {
        // Check for end of board
        if (check_end_of_mainpath(ctx) === false) {
            ctx.resume_previous_state();
        }
    },
};

const turn_play_ring = {
    init(ctx, args) {
        const symbolsSam = [0, 1, 1, 1, 1, 1, 0];
        const symbolsOth = [0, 1, 2, 3, 2, 1, 0];
        // Roll die for ring
        ctx.game.action.roll = util.roll_d6();
        // Movement from ring is 4 - die roll symbols
        if (ctx.game.ringBearer === 'Sam') {
            ctx.game.action.count = 4 - symbolsSam[ctx.game.action.roll];
        } else {
            ctx.game.action.count = 4 - symbolsOth[ctx.game.action.roll];
        }
        // Resolve die roll results
        ctx.push_advance_state('action_roll_die', { player: ctx.game.ringBearer, roll: ctx.game.action.roll });
        // Mark ring used
        ctx.game.conflict.ringUsed = true;
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        if (ctx.game.action.count > 0) {
            // Create button for each path which is available
            for (const p of get_board_active_quests(ctx.game)) {
                buttons[`resolve_path ${p}`] = `Advance as ${p}`;
            }
            return {
                player: ctx.game.ringBearer,
                message: `Select path to advance by ${ctx.game.action.count} spaces`,
                buttons,
            };
        } else {
            // Completed playing cards - return null to end phase
            return null;
        }
    },
    resolve_path(ctx, t) {
        const path = t[0];
        // Advance on desired track and ignore rewards
        if (data[ctx.game.loc][path]) {
            // Provide log
            ctx.log(`${ctx.game.currentPlayer} advances on ${path}`);
            // Advance path
            ctx.game.conflict[path] += ctx.game.action.count;
            // Check for path overflow
            if (ctx.game.conflict[path] > data[ctx.game.loc][path].length) {
                ctx.game.conflict[path] = data[ctx.game.loc][path].length - 1;
            }
            // Path is complete allow state to end
            ctx.game.action.count = 0;
            // Check for end of board
            check_end_of_mainpath(ctx);
        }
    },
    fini(ctx) {
        ctx.resume_previous_state();
    },
};

const conflict_board_start = {
    init(ctx, args) {
        ctx.log(`=t ${args.name}`);

        // Setup board
        ctx.game.loc = args.loc;

        // Create deck of story tiles
        create_deck(ctx.game.story, 0, 22);
        util.shuffle(ctx.game.story);

        // Update conflict board spaces
        ctx.game.conflict.active = true;
        ctx.game.conflict.eventValue = 0;
        ctx.game.conflict.fight = 0;
        ctx.game.conflict.friendship = 0;
        ctx.game.conflict.hide = 0;
        ctx.game.conflict.travel = 0;
        ctx.game.conflict.ringUsed = false;

        // Start player is ring bearer
        ctx.game.currentPlayer = ctx.game.ringBearer;
    },
    fini(ctx) {
        // Start player turns
        ctx.advance_state('new_player_turn');
    },
};

const conflict_decent_into_darkness = {
    init(ctx, args) {
        ctx.game.action.corruption = args.corruption;
        ctx.game.action.player = args.player;
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {
            next: 'Next',
        };
        return {
            player: ctx.game.action.player,
            message: `${ctx.game.action.player} increase corruption by ${ctx.game.action.corruption}`,
            buttons,
        };
    },
    next(ctx) {
        ctx.game.players[ctx.game.action.player].corruption += ctx.game.action.corruption;
        ctx.log(
            `${ctx.game.action.player} increases corruption by ${ctx.game.action.corruption} to ${ctx.game.players[ctx.game.action.player].corruption}`,
        );
        ctx.resume_previous_state();
    },
};

const conflict_board_end = {
    init(ctx, args) {
        ctx.log('=t Board ends');
        ctx.log('=! Descent into darkness');
        // Conflict board is no longer active
        ctx.game.conflict.active = false;
        // Clear state queue
        ctx.game.stateQueue = [];
        // Descent into darkness
        // Loop through each player and apply 1 corruption for each missing life token
        const plist = get_active_players_in_order(ctx.game, ctx.game.ringBearer);
        plist.reverse();
        for (const p of plist) {
            let lifeTokenCount = 0;
            if (ctx.game.players[p].ring > 0) {
                lifeTokenCount++;
            }
            if (ctx.game.players[p].heart > 0) {
                lifeTokenCount++;
            }
            if (ctx.game.players[p].sun > 0) {
                lifeTokenCount++;
            }
            let corruptionDamage = 3 - lifeTokenCount;
            if (p === 'Merry' && corruptionDamage > 0) {
                corruptionDamage = corruptionDamage - 1;
            }
            ctx.push_advance_state('conflict_decent_into_darkness', { corruption: corruptionDamage, player: p });
        }
    },
    fini(ctx) {
        ctx.log('=! Determine Ring-Bearer');
        // Determine the next ring-bearer (current ring-bearer always loses ties)
        let plist = get_active_players_in_order(ctx.game, ctx.game.ringBearer);
        let winner = plist[0]; // start with first
        let maxRings = ctx.game.players[winner].ring;

        for (let i = plist.length - 1; i > 0; i--) {
            const p = plist[i];
            if (ctx.game.players[p].ring >= maxRings) {
                winner = p;
                maxRings = ctx.game.players[p].ring;
            }
        }

        // Make current player the new ring-bearer
        ctx.log(`${winner} becomes the next ring-bearer`);
        ctx.game.ringBearer = winner;
        ctx.game.currentPlayer = ctx.game.ringBearer;

        // Ring-bearer gets 2 new cards
        draw_x_cards(ctx.game, ctx.game.ringBearer, 2);

        // Fatty if active gets 2 new cards
        if (ctx.game.players.Fatty.active) {
            draw_x_cards(ctx.game, 'Fatty', 2);
        }

        // Return all Heart, Sun, and Ring tokens to zero for each player
        plist = get_active_players_in_order(ctx.game, ctx.game.currentPlayer);
        for (const p of plist) {
            ctx.game.players[p].heart = 0;
            ctx.game.players[p].sun = 0;
            ctx.game.players[p].ring = 0;
        }

        // Determine next state, based on current location
        switch (ctx.game.loc) {
            case 'moria':
                ctx.advance_state('lothlorien_gladriel');
                break;
            case 'helmsdeep':
                ctx.advance_state('conflict_board_start', { name: 'Shelobs Lair', loc: 'shelobslair' });
                break;
            case 'shelobslair':
                ctx.advance_state('conflict_board_start', { name: 'Mordor', loc: 'mordor' });
                break;
            case 'mordor':
                ctx.advance_state('game_end_loss');
                break;
        }
    },
};

export function conflict_states() {
    return {
        new_player_turn,
        turn_reveal_tiles,
        turn_resolve_tile,
        turn_play_pick,
        turn_play_cards,
        turn_play_path,
        turn_play_ring,
        conflict_board_start,
        conflict_decent_into_darkness,
        conflict_board_end,
    };
}
