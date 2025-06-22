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


/* BUILD UI */

let ui = {
	favicon: document.getElementById("favicon"),
	header: document.querySelector("header"),
	status: document.getElementById("status"),
	tooltip: document.getElementById("tooltip"),
	prompt: document.getElementById("prompt"),

	hand: document.getElementById("hand"),
	map: document.getElementById("map"),

	last_played: document.getElementById("last_played"),
	tokens_element: document.getElementById("tokens"),
	spaces_element: document.getElementById("spaces"),
	markers_element: document.getElementById("markers"),
	pieces_element: document.getElementById("pieces"),

	players: {
		frodo : {
			hand: document.getElementById("cards_frodo"),
			ring: document.getElementById("ring_1_text"),
			heart: document.getElementById("heart_1_text"),
			sun: document.getElementById("sun_1_text"),
			shields: document.getElementById("shields_1_text"),
		},
		sam : {
			hand: document.getElementById("cards_sam"),
			ring: document.getElementById("ring_2_text"),
			heart: document.getElementById("heart_2_text"),
			sun: document.getElementById("sun_2_text"),
			shields: document.getElementById("shields_2_text"),
		},
		pipin : {
			hand: document.getElementById("cards_pipin"),
			ring: document.getElementById("ring_3_text"),
			heart: document.getElementById("heart_3_text"),
			sun: document.getElementById("sun_3_text"),
			shields: document.getElementById("shields_3_text"),
		},
		merry : {
			hand: document.getElementById("cards_merry"),
			ring: document.getElementById("ring_4_text"),
			heart: document.getElementById("heart_4_text"),
			sun: document.getElementById("sun_4_text"),
			shields: document.getElementById("shields_4_text"),
		},
		fatty : {
			hand: document.getElementById("cards_fatty"),
			ring: document.getElementById("ring_5_text"),
			heart: document.getElementById("heart_5_text"),
			sun: document.getElementById("sun_5_text"),
			shields: document.getElementById("shields_5_text"),
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

function build_marker(cn, x, y, w, h) {
	let e = document.createElement("div")
	e.className = cn
	e.style.top = Math.round(y - h/2) + "px"
	e.style.left = Math.round(x - w/2) + "px"
	return e
}

function build_piece(cn, w, h) {
	let e = document.createElement("div")
	e.className = cn
	e.my_dx = w >> 1
	e.my_dy = h >> 1
	return e
}

function on_init(view) {
	console.log("on_init");
	//console.log(view);
	
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
	
	// CARDS START
	for (const player in view.players) {
		const cardContainer = ui.players[player.toLowerCase()]["hand"];
		cardContainer.replaceChildren();
		
		for (const card of view.players[player].hand) {
			const cardDiv = document.createElement("div");
			cardDiv.classList.add("card", `card_${card}`);
			cardContainer.appendChild(cardDiv);
		}
		
		// TBD - Example of how to update number of rings a player holds
		ui.players[player.toLowerCase()]["ring"].textContent = 5;
	}
	// CARDS END
	
	action_button("roll", "roll die and distribute 4 hobit cards");
	action_button("pass", "pass on preparations");

	ui.prompt.textContent = "Message";
	ui.prompt.className = "Frodo"
}

/* UPDATE UI */

function on_update(view) {
	console.log("on_update");
	//console.log(view);
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
	console.log(text)
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
