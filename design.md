Work list
- Buy/play gandalf cards
- Play yellow cards
- Specific Response Yellow cards
    - Gandalf Magic: After moving the event marker ignore the event
        - Conflict - turn_resolve_tile
    - Gandalf Guidance: Active player 2 wild
        - Any time conflict.active is true (may cause a state to end early if conflict mainpath ends as a result of action)
    - Gandalf Defiance: Sauron does not move
        - action_move_sauron
    - Gandalf Integrity: Intead of rolling the die, place it with the white side up
    - Belt: One player: Do not roll one die
        - action_roll_die is count <= 0,
        - other actions with 'Roll'
    - Phial: Active Player - do not reveal the next tile
        - Conflict - turn_reveal_tiles
    - Mithril: One player: Ignore effects after one die roll
        - Action - action_roll_die
    - Athelas: One player: Ignore any effects of missing Life tokens once only
        - Conflict - conflict_decent_into_darkness
    - Staff: Ignore one tile showing a sundial and three items
        - Conflict - turn_resolve_tile
    - [Bill the pony: One player: Use this card as 1 shield or life token (both anytime and specific)]
- Any time yellow cards
    - Gandalf Foresight: One player: Rearrange top 3 tiles
    - Gandalf Healing: One player: 2 healing
    - Gandalf Persistence: One player: Draw 4 Hobbit cards
    - [Gandalf Firestorm: Defeat any 2 foes]
    - Ent draught: One player: May pass shields to one other player
    - Pipe-weed: You may allocate 3 heals amoung the players
    - Elessar: One player: heals
    - Lembas: One player: Draw Hobbit cards to increase hand to 6 cards
    - Miruvor: One player: May pass 1 card to another player
    - [Gandalf's letter: Call one Gandalf card without discarding 5 shields]
    - [Fire brand: Defeat any 1 foe]
- Winning game                      ***
    - Destroy the ring state
- Discard feature cards need to prevent giving helms deep feature cards
- Gollum card with die roll when played ***
- If asked to discard and player does not have enough cards then player dies
Rules
Additionally, if at any time a player does not have enough cards
or runes to pay a cost, he must discard everything he has and is
immediately eliminated from the game.

- Client Side
- Show gandalf cards
- Popup text for cards with card text on yellow cards

Errors
