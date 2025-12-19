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
        ctx.advance_state('turn_resolve_tile', { lasttile: t, number: 0 });
    },
};

const turn_resolve_tile = {
    init(ctx, args) {
        // Save the tile we are attempting to resolve
        ctx.game.action.lasttile = args.lasttile;
        // Keep track of count for discard (so far no discards)
        ctx.game.action.number = args.number;
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
            // Get reward
            if (resolve_reward(ctx.game, path) === false) {
                // Need to roll dice and advance to next turn phase
                //TBD - resolve roll dice
            } else {
                // Advance to next turn phase
                //TBD - tile
            }
            ctx.advance_state('turn_play', 'first');
        }
    },
};

const turn_play = {
    init(ctx, args) {
        if (a === 'first') {
            ctx.game.action.phase = 'pick';
        }
    },
    prompt(ctx) {
        // Build buttons dynamically
        const buttons = {};
        if (ctx.game.action.phase === 'pick') {
            buttons['play'] = 'Play cards';
            buttons['draw'] = 'Draw 2 cards';
            buttons['heal'] = 'Heal';
            // Have player select an option - play/draw/heal
            return {
                player: ctx.game.currentPlayer,
                message: 'Select option',
                buttons,
            };
        } else if (ctx.game.action.phase === 'play') {
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
        } else if (ctx.game.action.phase === 'path') {
            buttons['pass'] = 'Pass';
            return {
                player: ctx.game.currentPlayer,
                message: `Play ${ctx.game.action.count} cards`,
                buttons,
            };
        } else {
            // Completed playing cards - return null to end phase
            return null;
        }
    },
    pass(ctx) {
        // Action is complete
        ctx.game.action.phase = 'complete';
    },
    play(ctx) {
        // Select two cards
        ctx.game.action.phase = 'play';
        ctx.game.action.filter = ['white', 'grey'];
        ctx.game.action.count = 2;
    },
    card(ctx, cardArray) {
        const cardInt = parseInt(cardArray[0], 10); // Convert to int if needed
        const cardValue = discard_card_from_player(ctx.game, ctx.game.currentPlayer, cardInt);
        if (cardValue >= 0) {
            // Create log record of transaction
            ctx.log(`${ctx.game.currentPlayer} plays C${cardInt}`);
            // Keep track of which card was played unless pippin is the current player
            const cardData = data.cards[cardInt];
            if (ctx.game.currentPlayer !== 'Pippin') {
                ctx.game.action.filter = ctx.game.action.filter.filter((t) => t !== cardData.type);
            }

            // Frodo: treat white as wild
            const isFrodoWild = ctx.game.currentPlayer === 'Frodo' && cardData.type === 'white';
            if (cardData.quest === 'wild' || isFrodoWild) {
                // Have user pick track
                ctx.log('WILD');
            } else {
                // Auto advance track
                ctx.log('NO-WILD');
            }
            // Decrease count and check if both cards were played
            ctx.game.action.count = ctx.game.action.count - 1;
            if (ctx.game.action.count === 0) {
                // Action is complete
                ctx.game.action.phase = 'complete';
            }
        }
    },
    playcards(ctx, c) {
        const card = parseInt(c[0], 10); // Convert to int if needed
    },
    draw(ctx) {
        // Draw 2 cards
        draw_x_cards(ctx.game, ctx.game.currentPlayer, 2);
        // Action is complete
        ctx.game.action.phase = 'complete';
    },
    heal(ctx) {
        if (ctx.game.players[ctx.game.currentPlayer].corruption > 0) {
            ctx.game.players[ctx.game.currentPlayer].corruption -= 1;
        }
        // Action is complete
        ctx.game.action.phase = 'complete';
    },
    fini(ctx) {
        // Advance to next Player
        ctx.game.currentPlayer = get_next_player(ctx.game, ctx.game.currentPlayer);
        ctx.advance_state('new_player_turn');
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
        // Conflict board is no longer active
        ctx.game.conflict.active = false;
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
        ctx.game.currentPlayer = game.ringBearer;

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
        turn_play,
        conflict_board_start,
        conflict_decent_into_darkness,
        conflict_board_end,
    };
}
