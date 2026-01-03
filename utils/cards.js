import { get_active_player_list } from './player.js';
import data from './data.js';
import * as util from './util.js';

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

export function give_cards(game, p, cards) {
    const cardList = Array.isArray(cards) ? cards : [cards];
    for (const card of cardList) {
        const cardInt = parseInt(card, 10);
        game.log.push(`C${cardInt} given to ${p}`);
        util.set_add(game.players[p].hand, cardInt);
    }
}

export function draw_cards(game, p, cnt) {
    let cards = [];
    for (let i = 0; i < cnt; i++) {
        cards.push(deal_card(game));
    }
    give_cards(game, p, cards);
}

/// @brief Lookup card by int number and discard from player hand
/// @return the count value of the card, or 0 if card not found.
export function discard_cards(game, p, cards) {
    let discardValue = 0;
    let discardCount = 0;
    const cardList = Array.isArray(cards) ? cards : [cards];
    for (const card of cardList) {
        // Convert card to int to make sure all cards are integer values
        const cardInt = parseInt(card, 10);
        // Ensure the card actually exists in hand
        if (util.set_has(game.players[p].hand, cardInt)) {
            // Create log record of transaction
            game.log.push(`${p} discards C${cardInt}`);
            // Remove the card from hand
            util.set_delete(game.players[p].hand, cardInt);
            discardCount++;
            // Get the value of the card
            if (data.cards[cardInt].count) {
                discardValue += data.cards[cardInt].count;
            }
        }
    }
    return {
        count: discardCount,
        value: discardValue,
    };
}

export function play_cards(game, p, cards) {
    let discardValue = 0;
    let discardCount = 0;
    const cardList = Array.isArray(cards) ? cards : [cards];
    for (const card of cardList) {
        // Convert card to int to make sure all cards are integer values
        const cardInt = parseInt(card, 10);
        // Ensure the card actually exists in hand
        if (util.set_has(game.players[p].hand, cardInt)) {
            // Create log record of transaction
            game.log.push(`${p} plays C${cardInt}`);
            // Remove the card from hand
            util.set_delete(game.players[p].hand, cardInt);
            discardCount++;
            // Get the value of the card
            if (data.cards[cardInt].count) {
                discardValue += data.cards[cardInt].count;
            }
        }
    }
    return {
        count: discardCount,
        value: discardValue,
    };
}

// Find out who is holding a card or null if no one has the card
export function find_player_with_card(game, card) {
    // Convert card to int to make sure all cards are integer values
    const cardInt = parseInt(card, 10);
    for (const p of get_active_player_list(game)) {
        if (util.set_has(game.players[p].hand, cardInt)) {
            return p;
        }
    }
    return null;
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
    create_deck(game.deck, data.QUEST_DECK[0], data.QUEST_DECK[1]);
    // Collect all cards from all players’ hands
    let cardsInHands = set_of_player_cards(game);
    // Filter out any cards that are in players’ hands
    game.deck = game.deck.filter((card) => !cardsInHands.has(card));
    // Shuffle the deck
    util.shuffle(game.deck);
}
