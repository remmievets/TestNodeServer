```plantuml
@startuml
title Current State Machine
setup_game -> Game : advance_state()
hnote over Game : set state, nextState
Game -> Game : execute_state()
Game -> State : prompt()
State --> Game : prompt Response
Game -> State : auto(), if prompt is null
hnote over Game : Wait for command
Server -> Game : parseAction()
Game -> Game : execute_button()
Game -> State : _buttonfp_()
hnote over Game : no automatic state trigger
@enduml
```

```plantuml
@startuml
title Proposed Changes
setup_game -> Game : advance_state()
hnote over Game : set state, nextState
Game -> State : init()
setup_game -> Game : execute_state()
Game -> State : prompt()
State --> Game : prompt Response
Game -> State : final(), if prompt is null
hnote over Game : Wait for command
Server -> Game : parseAction()
Game -> Game : execute_button()
Game -> State : _buttonfp_()
Game -> Game : execute_state()
hnote over Game : If execute_state called final then call execute_state again
@enduml
```

```plantuml
@startuml
title Example Action
hnote over Game : Each player passes 1 card left
Server -> Game : parseAction()
Game -> State : _buttonfp_NEXT()
State -> Game : advance_state()
Game -> State : init()
State -> State : set initial data
Game -> Game : execute_state()
Game -> State : prompt()

hnote over Game : First player selects card to pass
Server -> Game : parseAction()
Game -> Game : execute_button()
Game -> State : _buttonfp_PASS()
State -> State : save passed card, update player
Game -> Game : execute_state()
Game -> State : prompt()

hnote over Game : Final player selects card to pass
Server -> Game : parseAction()
Game -> Game : execute_button()
Game -> State : _buttonfp_PASS()
State -> State : save passed card, update player
Game -> Game : execute_state()
Game -> State : prompt()
State --> Game : Repsonse is NULL
Game -> State : final()
note over Game : Update player hands and advance to new state
State -> Game : advance_state()
@enduml
```

```plantuml
@startuml
title Roll Dice State Activity

|Game|
start
:parseAction()
parse command string
call execute_button(buttonName, args);

:execute_button()
call state[buttonName](args);

|OriginalState|
:Next()
call advance_state();

|Game|
:advance_state(RollDieState, nextState)
update state and save next state
call state.init();

|RollDieState|
:init()
Setup for command;

|Game|
:Return to parseAction()
call execute_state();

:execute_state()
call state.prompt();

|RollDieState|
:prompt()
Add button option for Roll Die
Add button for card option if card in hand;

|Game|
:Return to parseAction();
stop

start
:Another command;
@enduml
```

Action List

- Create end of game check routine
- Create routine to check for death of characters (as sauron or corruption move)
- Conflict board start state can be made common
- Conflict board end board can be made common
- Create function for advancement on path (use for story tile / card play)
    - move marker
    - give rewards
- Create function to check for end of conflict board
    - Ends when main path is complete
    - Ends after event 6 is processed
- Story tile stuff remaining
    - advancement on path for good tiles
    - handling event resolution or move to event resolution state
    - Handling of remove 3 items event tiles
- Turn actions
    - Play 2 cards (one grey/one white)
    - Heal 1 space
    - Draw 2 cards
- Other items
    - Buy gandalf cards option
    - Display available Gandalf cards
    - Play other yellow cards