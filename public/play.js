'use strict';

/*
    global view, data, roles, send_action, action_button
*/

function toggle_counters() {
    // Cycle between showing the board and hiding the board
    if (ui.board.classList.contains('hidden')) {
        ui.board.classList.remove('hidden');
    } else {
        ui.board.classList.add('hidden');
    }
}

/* COMMON */

function lerp(a, b, t) {
    return a + t * (b - a);
}

function set_has(set, item) {
    let a = 0;
    let b = set.length - 1;
    while (a <= b) {
        let m = (a + b) >> 1;
        let x = set[m];
        if (item < x) b = m - 1;
        else if (item > x) a = m + 1;
        else return true;
    }
    return false;
}

/* DATA */

const CARDS = data.cards;

/* ACCESSORS */

/* ANIMATION */

/* BUILD UI */
let activePlayer = '';

let ui = {
    favicon: document.getElementById('favicon'),
    header: document.querySelector('header'),
    status: document.getElementById('status'),
    tooltip: document.getElementById('tooltip'),
    buttons: document.getElementById('actions'),
    prompt: document.getElementById('prompt'),

    select: document.getElementById('select'),
    hand: document.getElementById('hand'),
    mapw: document.getElementById('mapwrap'),
    map: document.getElementById('map'),
    board: document.getElementById('board'),

    last_played: document.getElementById('last_played'),
    tokens_element: document.getElementById('tokens'),
    spaces_element: document.getElementById('spaces'),
    markers_element: document.getElementById('markers'),
    pieces_element: document.getElementById('pieces'),

    location_marker: null,
    sauron_marker: null,
    event_marker: null,
    fight_marker: null,
    friendship_marker: null,
    hide_marker: null,
    travel_marker: null,

    hand_select: document.getElementById('hand_select'),

    sauron: document.getElementById('info_sauron'),

    players: {
        frodo: {
            hand: document.getElementById('cards_frodo'),
            ring: document.getElementById('ring_1_text'),
            heart: document.getElementById('heart_1_text'),
            sun: document.getElementById('sun_1_text'),
            shield: document.getElementById('shields_1_text'),
            corruption: document.getElementById('user_1'),
            info: document.getElementById('info_1'),
            marker: null,
        },
        sam: {
            hand: document.getElementById('cards_sam'),
            ring: document.getElementById('ring_2_text'),
            heart: document.getElementById('heart_2_text'),
            sun: document.getElementById('sun_2_text'),
            shield: document.getElementById('shields_2_text'),
            corruption: document.getElementById('user_2'),
            info: document.getElementById('info_2'),
            marker: null,
        },
        pippin: {
            hand: document.getElementById('cards_pippin'),
            ring: document.getElementById('ring_3_text'),
            heart: document.getElementById('heart_3_text'),
            sun: document.getElementById('sun_3_text'),
            shield: document.getElementById('shields_3_text'),
            corruption: document.getElementById('user_3'),
            info: document.getElementById('info_3'),
            marker: null,
        },
        merry: {
            hand: document.getElementById('cards_merry'),
            ring: document.getElementById('ring_4_text'),
            heart: document.getElementById('heart_4_text'),
            sun: document.getElementById('sun_4_text'),
            shield: document.getElementById('shields_4_text'),
            corruption: document.getElementById('user_4'),
            info: document.getElementById('info_4'),
            marker: null,
        },
        fatty: {
            hand: document.getElementById('cards_fatty'),
            ring: document.getElementById('ring_5_text'),
            heart: document.getElementById('heart_5_text'),
            sun: document.getElementById('sun_5_text'),
            shield: document.getElementById('shields_5_text'),
            corruption: document.getElementById('user_5'),
            info: document.getElementById('info_5'),
            marker: null,
        },
    },
    hand_home: {},
};

function cacheHandHomes() {
    Object.entries(ui.players).forEach(([playerId, player]) => {
        if (!player.hand) return;

        // cards_frodo -> hand_frodo
        const handWrapper = player.hand.closest('.player-hand');
        if (!handWrapper) return;

        ui.hand_home[playerId] = {
            wrapper: handWrapper,
            parent: handWrapper.parentElement,
            nextSibling: handWrapper.nextElementSibling,
        };
    });
}
cacheHandHomes();

function moveHandToSelect(playerId) {
    const home = ui.hand_home[playerId];
    if (!home) return;

    ui.select.appendChild(home.wrapper);
}

function returnHand(playerId) {
    const home = ui.hand_home[playerId];
    if (!home) return;

    if (home.nextSibling) {
        home.parent.insertBefore(home.wrapper, home.nextSibling);
    } else {
        home.parent.appendChild(home.wrapper);
    }
}

function reset_all_card_states() {
    const cards = document.querySelectorAll('.card.action, .card.selected');
    cards.forEach((card) => {
        card.classList.remove('action', 'selected');
        card.removeEventListener('click', on_click_action);
    });
}

function enable_card_selection(cards) {
    cards.forEach((cardId) => {
        const cardEl = hand.querySelector(`.card_${cardId}`);
        if (cardEl) {
            cardEl.classList.add('action');
            cardEl.addEventListener('click', on_click_action);
        } else {
            const cardE2 = select.querySelector(`.card_${cardId}`);
            if (cardE2) {
                cardE2.classList.add('action');
                cardE2.addEventListener('click', on_click_action);
            }
        }
    });
}

function on_click_action(evt) {
    const cardEl = event.currentTarget;
    if (cardEl.classList.contains('action')) {
        cardEl.classList.remove('action');
        cardEl.classList.add('selected');
        // Send action
        send_action('BUTTON', 'card');
    } else if (cardEl.classList.contains('selected')) {
        cardEl.classList.remove('selected');
        cardEl.classList.add('action');
    }
}

function build_piece(cn) {
    let e = document.createElement('div');
    e.className = cn;
    return e;
}

function show_piece(p, e) {
    p.appendChild(e);
}

function show_piece_at(p, e, x, y) {
    show_piece(p, e);
    e.style.left = x + 'px';
    e.style.top = y + 'px';
}

function on_init(view) {
    // LOG START
    // Initialize the log part of the display
    let container = document.getElementById('log');
    container.replaceChildren();

    // Loop through each log entry (text) and call on_log
    for (const entry of view.log) {
        let logElement = on_log(entry);
        container.appendChild(logElement);
    }

    scroll_log_to_end();
    // LOG END

    // Sauron location
    if (!ui.sauron_marker) {
        ui.sauron_marker = build_piece('marker sauron');
    }
    let space = 'track_' + view.sauron;
    show_piece_at(ui.tokens_element, ui.sauron_marker, data.board[space][0] + 25, data.board[space][1] + 75);

    ui.sauron.textContent = 'Sauron ' + view.sauron;

    // Fellowship location
    if (!ui.location_marker) {
        ui.location_marker = build_piece('marker grey');
    }
    show_piece_at(ui.tokens_element, ui.location_marker, data.board[view.loc][0], data.board[view.loc][1]);

    // Loop players
    for (const player in view.players) {
        // Update player hand
        let p = player.toLowerCase();
        const cardContainer = ui.players[p].hand;
        cardContainer.replaceChildren();

        for (const card of view.players[player].hand) {
            const cardDiv = document.createElement('div');
            cardDiv.classList.add('card', `card_${card}`);
            cardContainer.appendChild(cardDiv);
        }

        // Update player stats
        ui.players[p].ring.textContent = view.players[player].ring;
        ui.players[p].heart.textContent = view.players[player].heart;
        ui.players[p].sun.textContent = view.players[player].sun;
        ui.players[p].shield.textContent = view.players[player].shield;
        if (view.players[player].active) {
            ui.players[p].corruption.textContent = view.players[player].corruption;
        } else {
            ui.players[p].corruption.textContent = 'D';
        }
        if (view.ringBearer === player) {
            ui.players[p].info.textContent = 'Ring';
        } else {
            ui.players[p].info.textContent = '';
        }

        // Update player markers
        if (!ui.players[p].marker) {
            ui.players[p].marker = build_piece('marker ' + p);
        }
        let pspace = 'track_' + view.players[player].corruption;
        show_piece_at(
            ui.tokens_element,
            ui.players[p].marker,
            data.board[pspace][0] + data.board[p][0],
            data.board[pspace][1] + data.board[p][1],
        );
    }

    // Add cards to hand_select
    const selContainer = ui.hand_select;
    selContainer.replaceChildren();

    if (view.selectHand.length > 0) {
        ui.hand_select.className = 'cards player-hand';
        for (const card of view.selectHand) {
            const cardDiv = document.createElement('div');
            cardDiv.classList.add('card', `card_${card}`);
            selContainer.appendChild(cardDiv);
        }
    } else {
        ui.hand_select.className = 'hidden';
    }

    // Update tokens on map
    ui.markers_element.replaceChildren();
    if (view.conflict.active) {
        // Make sure location is viewable
        ui.map.className = view.loc;
        ui.mapw.className = '';

        // Put markers on board
        if (data[view.loc].events) {
            ui.event_marker = build_piece('marker grey');
            const f = view.conflict.eventValue;
            show_piece_at(ui.markers_element, ui.event_marker, data[view.loc].events[f].x, data[view.loc].events[f].y);
        }
        if (data[view.loc].friendship) {
            ui.friendship_marker = build_piece('marker grey');
            const f = view.conflict.friendship;
            show_piece_at(ui.markers_element, ui.friendship_marker, data[view.loc].friendship[f].x, data[view.loc].friendship[f].y);
        }
        if (data[view.loc].fight) {
            ui.fight_marker = build_piece('marker grey');
            const f = view.conflict.fight;
            show_piece_at(ui.markers_element, ui.fight_marker, data[view.loc].fight[f].x, data[view.loc].fight[f].y);
        }
        if (data[view.loc].hide) {
            ui.hide_marker = build_piece('marker grey');
            const f = view.conflict.hide;
            show_piece_at(ui.markers_element, ui.hide_marker, data[view.loc].hide[f].x, data[view.loc].hide[f].y);
        }
        if (data[view.loc].travel) {
            ui.travel_marker = build_piece('marker grey');
            const f = view.conflict.travel;
            show_piece_at(ui.markers_element, ui.travel_marker, data[view.loc].travel[f].x, data[view.loc].travel[f].y);
        }
    } else {
        ui.mapw.className = 'hide_map';
    }

    // Update prompt
    if (view.prompt) {
        ui.prompt.textContent = view.prompt.message;

        // Assign header a color based on player
        if (view.prompt.player) {
            ui.header.className = view.prompt.player.toLowerCase();
        } else {
            ui.header.className = '';
        }

        // Update action buttons if available
        ui.buttons.replaceChildren();
        if (view.prompt.buttons) {
            const availableActions = view.prompt.buttons;
            for (const [actionName, label] of Object.entries(availableActions)) {
                action_button(actionName, label);
            }
        }

        // Undo active player hand
        if (activePlayer !== '') {
            returnHand(activePlayer);
            activePlayer = '';
        }
        // Update if there are selectable cards or not
        if (view.prompt.cards) {
            enable_card_selection(view.prompt.cards);
            if (view.prompt.player) {
                activePlayer = view.prompt.player.toLowerCase();
                moveHandToSelect(activePlayer);
            }
            //send_action("DISTRIBUTE", `${view.prompt.action.cards[0]} Frodo`);
        } else {
            reset_all_card_states();
        }
    }
}

/* UPDATE UI */

function on_update(view) {
    on_init(view);
}

/* TOOLTIPS */

/* LOG */

function sub_minus(_match, p1) {
    return '\u2212' + p1;
}

function sub_card(_match, p1) {
    let x = p1 | 0;
    let n = data.cards[x].name;
    return `<i class="tip">${n}</i>`;
    //return `<i class="tip" onmouseenter="on_focus_card_tip(${x})" onmouseleave="on_blur_card_tip(${x})">${n}</i>`
}

const ICONS = {
    D1: '<span class="die white d1"></span>',
    D2: '<span class="die white d2"></span>',
    D3: '<span class="die white d3"></span>',
    D4: '<span class="die white d4"></span>',
    D5: '<span class="die white d5"></span>',
    D6: '<span class="die white d6"></span>',
};

function sub_icon(match) {
    return ICONS[match] || match;
}

const TILES = {
    T0: '<span class="tile t0"></span>',
    T1: '<span class="tile t1"></span>',
    T2: '<span class="tile t2"></span>',
    T3: '<span class="tile t3"></span>',
    T4: '<span class="tile t4"></span>',
    T5: '<span class="tile t5"></span>',
    T6: '<span class="tile t6"></span>',
    T7: '<span class="tile t7"></span>',
    T8: '<span class="tile t8"></span>',
    T9: '<span class="tile t9"></span>',
    T10: '<span class="tile t10"></span>',
    T11: '<span class="tile t11"></span>',
    T12: '<span class="tile t12"></span>',
    T13: '<span class="tile t13"></span>',
    T14: '<span class="tile t14"></span>',
    T15: '<span class="tile t15"></span>',
    T16: '<span class="tile t16"></span>',
    T17: '<span class="tile t17"></span>',
    T18: '<span class="tile t18"></span>',
    T19: '<span class="tile t19"></span>',
    T20: '<span class="tile t20"></span>',
    T21: '<span class="tile t21"></span>',
    T22: '<span class="tile t22"></span>',
};

function sub_tile(match) {
    return TILES[match] || match;
}

function on_log(text) {
    let p = document.createElement('div');

    if (text.startsWith('>>')) {
        p.className = 'ii';
        text = text.substring(2);
    } else if (text.startsWith('>')) {
        p.className = 'i';
        text = text.substring(1);
    } else if (text.startsWith('=t')) {
        p.className = 'h turn';
        text = text.substring(2);
    } else if (text.startsWith('=!')) {
        p.className = 'h';
        text = text.substring(3);
    } else if (text.startsWith('=f')) {
        p.className = 'h frodo';
        text = text.substring(3);
    } else if (text.startsWith('=s')) {
        p.className = 'h sam';
        text = text.substring(3);
    } else if (text.startsWith('=p')) {
        p.className = 'h pippin';
        text = text.substring(3);
    } else if (text.startsWith('=m')) {
        p.className = 'h merry';
        text = text.substring(3);
    } else if (text.startsWith('=y')) {
        p.className = 'h fatty';
        text = text.substring(3);
    }

    text = text.replace(/&/g, '&amp;');
    text = text.replace(/</g, '&lt;');
    text = text.replace(/>/g, '&gt;');

    text = text.replace(/-(\d)/g, sub_minus);

    text = text.replace(/\b[D][1-6]\b/g, sub_icon);

    text = text.replace(/T(\d+)/g, sub_tile);

    text = text.replace(/C(\d+)/g, sub_card);

    p.innerHTML = text;
    return p;
}
