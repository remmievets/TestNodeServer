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

- Update roll dice action
