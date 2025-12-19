//////////////////////
/* Card functions */

export function create_deck(deck, startIndex, endIndex) {
    deck.length = 0;
    for (let i = startIndex; i <= endIndex; i++) {
        util.set_add(deck, i);
    }
}

export function deal_card(game) {
    if (game.deck.length === 0) {
        reshuffle_deck(game);
    }
    return game.deck.pop();
}

export function draw_x_cards(game, p, cnt) {
    for (let i = 0; i < cnt; i++) {
        let card = deal_card(game);
        log(game, `C${card} given to ${p}`);
        util.set_add(game.players[p].hand, card);
    }
}

// Gather a full 'set' of all player cards
export function set_of_player_cards(game) {
    let pArray = get_active_player_list(game);
    let cardsInHands = new Set();
    for (let p of pArray) {
        for (let card of game.players[p].hand) {
            cardsInHands.add(card);
        }
    }
    return cardsInHands;
}

// Reshuffle quest cards 0-59.  Make sure to remove cards that are already in players hands.
export function reshuffle_deck(game) {
    // Rebuild entire deck of initial quest cards
    create_deck(game.deck, 0, 59);
    // Collect all cards from all players’ hands
    let cardsInHands = set_of_player_cards(game);
    // Filter out any cards that are in players’ hands
    game.deck = game.deck.filter((card) => !cardsInHands.has(card));
    // Shuffle the deck
    util.shuffle(game.deck);
}
