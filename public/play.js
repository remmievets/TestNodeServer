"use strict"

/*
    global view, data, roles, send_action, action_button, confirm_action_button
*/

// TODO: show "reshuffle" flag next to card deck display

function toggle_counters() {
    // Cycle between showing everything, only markers, and nothing.
    console.log("toggle_counters");
    /*
    if (ui.map.classList.contains("hide_markers")) {
        ui.map.classList.remove("hide_markers")
        ui.map.classList.remove("hide_pieces")
    } else if (ui.map.classList.contains("hide_pieces")) {
        ui.map.classList.add("hide_markers")
    } else {
        ui.map.classList.add("hide_pieces")
    }
    */
}

/* COMMON */

function lerp(a, b, t) {
    return a + t * (b - a)
}

function set_has(set, item) {
    let a = 0
    let b = set.length - 1
    while (a <= b) {
        let m = (a + b) >> 1
        let x = set[m]
        if (item < x)
            b = m - 1
        else if (item > x)
            a = m + 1
        else
            return true
    }
    return false
}

/* DATA */

const CARDS = data.cards


/* ACCESSORS */


/* ANIMATION */

let activeSpace = null;
let offsetX = 0;
let offsetY = 0;
let wasDragged = false;
/*
const map = document.getElementById('board');
const container = document.getElementById('tokens');
*/

const map = document.getElementById('map');
const container = document.getElementById('spaces');


function on_space_click(e) {
    if (activeSpace) return;
    if (wasDragged) {
        console.log('ignored container click');
        wasDragged = false;
        return;
    }
    console.log('container click');
    const {x, y} = getRelativeClickPosition(e);
    const space = on_create_space(x, y);
    container.appendChild(space);
}

function getRelativeClickPosition(e) {
    const rect = container.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function on_create_space(x, y) {
    console.log('create space');
    const space = document.createElement('div');
    space.classList.add('space');
    space.style.left = `${x}px`;
    space.style.top = `${y}px`;
    space.style.width = '58px';
    space.style.height = '58px';

    space.addEventListener('mousedown', on_drag_start);
    return space;
}

function on_handle_move(e) {
    if (!activeSpace) return;
    console.log('handle move');
    wasDragged = true;
    const {x, y} = getRelativeClickPosition(e);
    activeSpace.style.left = `${x - offsetX}px`;
    activeSpace.style.top = `${y - offsetY}px`;
}

function on_drag_start(e) {
    console.log('drag start');
    activeSpace = e.target;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    activeSpace.style.cursor = 'grabbing';
}

function on_drag_ends(e) {
    console.log('drag end');
    if (activeSpace) {
        activeSpace.style.cursor = 'grab';
        activeSpace = null;
    }
}

map.addEventListener('click', on_space_click);
document.addEventListener('mousemove', on_handle_move);
document.addEventListener('mouseup', on_drag_ends);
console.log(map);


/* BUILD UI */

let ui = {
    favicon: document.getElementById("favicon"),
    header: document.querySelector("header"),
    status: document.getElementById("status"),
    tooltip: document.getElementById("tooltip"),
    actions: document.getElementById("actions"),
    prompt: document.getElementById("prompt"),

    hand: document.getElementById("hand"),
    mapw: document.getElementById("mapwrap"),
    map: document.getElementById("map"),

    last_played: document.getElementById("last_played"),
    tokens_element: document.getElementById("tokens"),
    spaces_element: document.getElementById("spaces"),
    markers_element: document.getElementById("markers"),
    pieces_element: document.getElementById("pieces"),
    
    location_marker : null,
    sauron_marker : null,

    players: {
        frodo : {
            hand: document.getElementById("cards_frodo"),
            ring: document.getElementById("ring_1_text"),
            heart: document.getElementById("heart_1_text"),
            sun: document.getElementById("sun_1_text"),
            shields: document.getElementById("shields_1_text"),
            marker : null,
        },
        sam : {
            hand: document.getElementById("cards_sam"),
            ring: document.getElementById("ring_2_text"),
            heart: document.getElementById("heart_2_text"),
            sun: document.getElementById("sun_2_text"),
            shields: document.getElementById("shields_2_text"),
            marker : null,
        },
        pipin : {
            hand: document.getElementById("cards_pipin"),
            ring: document.getElementById("ring_3_text"),
            heart: document.getElementById("heart_3_text"),
            sun: document.getElementById("sun_3_text"),
            shields: document.getElementById("shields_3_text"),
            marker : null,
        },
        merry : {
            hand: document.getElementById("cards_merry"),
            ring: document.getElementById("ring_4_text"),
            heart: document.getElementById("heart_4_text"),
            sun: document.getElementById("sun_4_text"),
            shields: document.getElementById("shields_4_text"),
            marker : null,
        },
        fatty : {
            hand: document.getElementById("cards_fatty"),
            ring: document.getElementById("ring_5_text"),
            heart: document.getElementById("heart_5_text"),
            sun: document.getElementById("sun_5_text"),
            shields: document.getElementById("shields_5_text"),
            marker : null,
        }
    }
}

let action_register = []

function register_action(target, action, id) {
    target.my_action = action
    target.my_id = id
    target.onmousedown = on_click_action
    action_register.push(target)
}

function is_action(action, arg) {
    if (arg === undefined)
        return !!(view.actions && view.actions[action] === 1)
    return !!(view.actions && view.actions[action] && set_has(view.actions[action], arg))
}

function on_click_action(evt) {
    if (evt.button === 0)
        send_action(evt.target.my_action, evt.target.my_id)
}

function build_piece(cn) {
    let e = document.createElement("div")
    e.className = cn
    return e
}

function show_piece(p, e) {
    p.appendChild(e)
}

function show_piece_at(p, e, x, y) {
    show_piece(p, e)
    e.style.left = x + "px"
    e.style.top = y + "px"
}


function on_init(view) {
    // LOG START
    // Initialize the log part of the display
    let container = document.getElementById("log");
    container.replaceChildren();
    
    // Loop through each log entry (text) and call on_log
    for (const entry of view.log) {
        let logElement = on_log(entry);
        container.appendChild(logElement);
    }
    
    scroll_log_to_end();
    // LOG END
    
    // Update last played card
    // TBD
    
    // Sauron location
    if (!ui.sauron_marker) {
        ui.sauron_marker = build_piece("marker sauron");
    }
    let space = "track_" + view.sauron;
    show_piece_at(ui.tokens_element, ui.sauron_marker, data.board[space][0] + 25, data.board[space][1] + 75);

    // Fellowship location
    if (!ui.location_marker) {
        ui.location_marker = build_piece("marker grey");
    }
    show_piece_at(ui.tokens_element, ui.location_marker, data.board[view.loc][0], data.board[view.loc][1]);

    // Loop players
    for (const player in view.players) {
        
        // Update player hand
        let p = player.toLowerCase();
        const cardContainer = ui.players[p].hand;
        cardContainer.replaceChildren();
        
        for (const card of view.players[player].hand) {
            const cardDiv = document.createElement("div");
            cardDiv.classList.add("card", `card_${card}`);
            cardContainer.appendChild(cardDiv);
        }
        
        // Update player stats
        ui.players[p].ring.textContent = view.players[player].rings;
        ui.players[p].heart.textContent = view.players[player].hearts;
        ui.players[p].sun.textContent = view.players[player].suns;
        ui.players[p].shields.textContent = view.players[player].shields;
        
        // Update player markers
        if (!ui.players[p].marker) {
            ui.players[p].marker = build_piece("marker " + p);
        }
        let pspace = "track_" + view.players[player].corruption;
        show_piece_at(ui.tokens_element, ui.players[p].marker, data.board[pspace][0] + data.board[p][0], data.board[pspace][1] + data.board[p][1]);
    }
    
    
    // Update tokens on map
    if (view.loc in data) {
        ui.map.className = view.loc;
    }
    else {
        ui.mapw.className = "hide_map";
    }
    // TBD
    
    // Update action buttons if available
    ui.actions.replaceChildren();
    if (view.prompt.actions) {
        const availableActions = view.prompt.actions;
        for (const [actionName, label] of Object.entries(availableActions)) {
            action_button(actionName, label);
        }
    }

    // Update prompt
    ui.prompt.textContent = view.prompt.message;
    
    // Assign header a color based on player
    if (view.prompt.player) {
        ui.header.className = view.prompt.player.toLowerCase();
    } else {
        ui.header.className = "";
    }
}

/* UPDATE UI */

function on_update(view) {
    on_init(view);
}

/* TOOLTIPS */


/* LOG */

function sub_space(_match, p1) {
    let x = p1 | 0
    let n = data.spaces[x].name
    if (n === "Wilmington DE")
        n = "Wilmington"
    n = n.replaceAll(" ", "\xa0")
    let co = data.spaces[x].colony
    if (co)
        n += "\xa0(" + data.colony_name[data.spaces[x].colony] + ")"
    return `<span class="tip" onclick="on_click_space_tip(${x})" onmouseenter="on_focus_space_tip(${x})" onmouseleave="on_blur_space_tip(${x})">${n}</span>`
}

function sub_general(_match, p1) {
    let x = p1 | 0
    let n = data.generals[x].name
    return `<span class="tip" onclick="on_click_general_tip(${x})" onmouseenter="on_focus_general_tip(${x})" onmouseleave="on_blur_general_tip(${x})">${n}</span>`
}

function sub_minus(_match, p1) {
    return "\u2212" + p1
}

function sub_card(_match, p1) {
    let x = p1 | 0
    let n = data.cards[x].title
    return `<i class="tip" onmouseenter="on_focus_card_tip(${x})" onmouseleave="on_blur_card_tip(${x})">${n}</i>`
}

const ICONS = {
    D1: '<span class="die white d1"></span>',
    D2: '<span class="die white d2"></span>',
    D3: '<span class="die white d3"></span>',
    D4: '<span class="die white d4"></span>',
    D5: '<span class="die white d5"></span>',
    D6: '<span class="die white d6"></span>',
    A1: '<span class="number ar n1">1</span>',
    A2: '<span class="number ar n2">2</span>',
    A3: '<span class="number ar n3">3</span>',
    A4: '<span class="number ar n4">4</span>',
    A5: '<span class="number ar n5">5</span>',
    A6: '<span class="number ar n6">6</span>',
    AB1: '<span class="number br_a n1">1</span>',
    AB2: '<span class="number br_a n2">2</span>',
    AB3: '<span class="number br_a n3">3</span>',
    AB4: '<span class="number br_a n4">4</span>',
    AB5: '<span class="number br_a n5">5</span>',
    AB6: '<span class="number br_a n6">6</span>',
    BB1: '<span class="number br_b n1">1</span>',
    BB2: '<span class="number br_b n2">2</span>',
    BB3: '<span class="number br_b n3">3</span>',
    BB4: '<span class="number br_b n4">4</span>',
    BB5: '<span class="number br_b n5">5</span>',
    BB6: '<span class="number br_b n6">6</span>',
    FB1: '<span class="number br_f n1">1</span>',
    FB2: '<span class="number br_f n2">2</span>',
    FB3: '<span class="number br_f n3">3</span>',
    FB4: '<span class="number br_f n4">4</span>',
    FB5: '<span class="number br_f n5">5</span>',
    FB6: '<span class="number br_f n6">6</span>',
}

function sub_icon(match) {
    return ICONS[match] || match
}

function on_log(text) {
    //console.log(text)
    let p = document.createElement("div")

    if (text.startsWith(">>")) {
        p.className = "ii"
        text = text.substring(2)
    } else if (text.startsWith(">")) {
        p.className = "i"
        text = text.substring(1)
    } else if (text.startsWith("=t")) {
        p.className = "h turn"
        text = text.substring(2)
    } else if (text.startsWith("=!")) {
        p.className = "h"
        text = text.substring(3)
    } else if (text.startsWith("=f")) {
        p.className = "h frodo"
        text = text.substring(3)
    } else if (text.startsWith("=s")) {
        p.className = "h sam"
        text = text.substring(3)
    } else if (text.startsWith("=p")) {
        p.className = "h sam"
        text = text.substring(3)
    } else if (text.startsWith("=m")) {
        p.className = "h sam"
        text = text.substring(3)
    } else if (text.startsWith("=y")) {
        p.className = "h sam"
        text = text.substring(3)
    }

    if (
        text.startsWith("Played ") ||
        text.startsWith("Discarded ") ||
        text.startsWith("Exchanged ") ||
        text.startsWith("Retreated ") ||
        text.startsWith("Surrendered ") ||
        text === "Removed card."
    )
        p.className = "n"

    if (text.startsWith("Moved G") || text.startsWith("Landing Party"))
        p.className = "m"

    text = text.replace(/&/g, "&amp;")
    text = text.replace(/</g, "&lt;")
    text = text.replace(/>/g, "&gt;")

    text = text.replace(/-(\d)/g, sub_minus)

    text = text.replace(/\b[D][1-6]\b/g, sub_icon)
    text = text.replace(/\b[A][1-6]\b/g, sub_icon)
    text = text.replace(/\bAB[1-6]\b/g, sub_icon)
    text = text.replace(/\bBB[1-6]\b/g, sub_icon)
    text = text.replace(/\bFB[1-6]\b/g, sub_icon)

    text = text.replace(/C(\d+)/g, sub_card)
    text = text.replace(/S(\d+)/g, sub_space)
    text = text.replace(/G(\d+)/g, sub_general)

    p.innerHTML = text
    return p
}
