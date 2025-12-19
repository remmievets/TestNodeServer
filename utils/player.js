//////////////////////
/* Player functions */

/// @brief Get a list of cards and count values based on card type
/// cardType can be
///     'card' - any card
///     'yellow'/'white'/'grey' - by type or color of card
///     'hide','friendship','travel','fight','wild' - by symbol
/// cardType can be a single string or an array of strings
export function count_card_type_by_player(game, p, cardType, allowedColors = ['white', 'grey', 'yellow']) {
    let cardValue = 0;
    let cardArray = [];

    // Normalize: always work with an array of card types (strings)
    const cardTypes = Array.isArray(cardType) ? cardType : [cardType];
    const questTypes = ['hide', 'travel', 'friendship', 'fight', 'wild'];

    for (const c of game.players[p].hand) {
        const cardData = data.cards[c];

        // If card then include regardless of quest type
        if (cardType.includes('card')) {
            // Filter by color
            if (allowedColors.includes(cardData.type)) {
                // Include all cards
                cardValue += 1;
                util.set_add(cardArray, c);
            }
        } else if (cardData.quest && questTypes.some((q) => cardTypes.includes(q))) {
            // Frodo: treat white as wild
            const isFrodoWild = p === 'Frodo' && cardData.type === 'white';

            // Determine if we are looking for a quest type
            // Include if card matches a quest we are looking for or the card is wild
            // Frodo special ability - treat white cards as wild
            if (cardType.includes(cardData.quest) || cardData.quest === 'wild' || isFrodoWild) {
                // Filter by color
                if (allowedColors.includes(cardData.type)) {
                    cardValue += cardData.count;
                    util.set_add(cardArray, c);
                }
            }
        }
    }

    return { value: cardValue, cardList: cardArray };
}

export function distribute_card_from_select(game, p, cardInt) {
    // Ensure the card actually exists in selectHand
    if (!util.set_has(game.selectHand, cardInt)) {
        console.error('Card not found in selectHand');
        return false;
    }

    // Remove the card from selectHand
    util.set_delete(game.selectHand, cardInt);

    // Add the card to the target player's hand
    util.set_add(game.players[p].hand, cardInt);

    return true;
}

/// @brief Lookup card by int number and discard from player hand
/// @return the count value of the card, or -1 if card not found.
export function discard_card_from_player(game, p, cardInt) {
    // Ensure the card actually exists in selectHand
    if (!util.set_has(game.players[p].hand, cardInt)) {
        return -1;
    }

    // Remove the card from hand
    util.set_delete(game.players[p].hand, cardInt);

    let rc = 0;
    if (data.cards[cardInt].count) {
        rc = data.cards[cardInt].count;
    }

    return rc;
}

export function get_active_player_list(game) {
    const porder = ['Frodo', 'Sam', 'Pippin', 'Merry', 'Fatty'];
    return porder.filter((p) => game.players[p] && game.players[p].active);
}

export function get_next_player(game, p) {
    const porder = get_active_player_list(game);
    const start = porder.indexOf(p);
    const idx = (start + 1) % porder.length;
    return porder[idx];
}

export function get_active_players_in_order(game, p) {
    const porder = get_active_player_list(game);
    const start = porder.indexOf(p);

    const orderedPlayers = [];

    // Add players to ordered list if player is active
    for (let i = 0; i < porder.length; i++) {
        const idx = (start + i) % porder.length;
        orderedPlayers.push(porder[idx]);
    }

    return orderedPlayers;
}

export function update_player_active(game) {
    let pArray = get_active_player_list(game);
    for (let p of pArray) {
        if (game.players[p].corruption < game.sauron) {
            game.players[p].active = true;
        } else {
            // Send a message to the player indicating the change in state
            log(game, `${p} has become corrupted by the ring`);
            // Make player inactive
            game.players[p].active = false;
            // Discard all cards
            util.set_clear(game.players[p].hand);
        }
    }
}
