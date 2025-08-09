@echo off
cd C:\Appl\Code\LordOfRingsServer
wsl -e bash -i -c "npx prettier --write server.js && npx prettier --write '**/*.js'"
pause
