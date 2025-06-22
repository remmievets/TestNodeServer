1. We should be ready for game setup in the server then pass the initial or current game state in the fetch(`/game/${gameId}`) in client.js
2. Need to test the type of data I get back in that fetch routine
3. Once fetch is working with valid data then it can be used to populate players and gameboard with the current state of the game
