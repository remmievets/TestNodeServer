# Lord of the Rings Personal Server

# Setup Instructions

1. Install git - https://git-scm.com/downloads
2. Install js node - https://nodejs.org/en/download
3. Clone repository to your machine - ```git clone https://github.com/remmievets/TestNodeServer.git```
4. Install npm packages that are needed for the server - ```npm install```

## Using nvm

1. Install nvm

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

2. Reload shell configuration

```
source ~/.bashrc
```

3. Install Node.js

```
nvm install 18
nvm use 18
node -v
npm -v
```

nvm allows you to install and use multiple versions of Node.js.

# Running Server

Login to Linux from powershell
```
wsl.exe -d Ubuntu
```

from linux start server
```
node server.js
```

Formay a file or group of files
```
npx prettier --write server.js
npx prettier --write "**/*.js"
```

Access from Chrome on Windows using 
```
http://localhost:8080
```

# Using sqlite3
1. To start SQLite, type
```
splite3 database_name.db
```
- Replace ```database_name.db``` with your desired database name. If the file doesn't exist, it will be created.
2. Once inside the SQLite shell, you can execute SQL commands.
3. Install a GUI tool like *DB Browser for SQLite* on Windows.

# Using SQLite3 Library from Javascript Server
1. Open your terminal in the project directory.
2. Install the sqlite3 package using npm:
```
npm init -y
npm install express better-sqlite3 cors pug ws

```
3. Create or modify your server to include SQLite integration
4. Example code to use SQLite in an Express-based server:
``` Javascript
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// Connect to SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Example: Create a table (if it doesn't already exist)
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT
)`);

// Example: Insert data
app.get('/add-user', (req, res) => {
    const { name, email } = req.query;
    db.run(`INSERT INTO users (name, email) VALUES (?, ?)`, [name, email], function(err) {
        if (err) {
            res.status(500).send('Error adding user');
            return console.error(err.message);
        }
        res.send(`User added with ID: ${this.lastID}`);
    });
});

// Example: Retrieve data
app.get('/users', (req, res) => {
    db.all(`SELECT * FROM users`, [], (err, rows) => {
        if (err) {
            res.status(500).send('Error retrieving users');
            return console.error(err.message);
        }
        res.json(rows);
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

// Close the database connection on exit
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing the database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

```

