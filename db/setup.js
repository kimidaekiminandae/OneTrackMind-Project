const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// connect without specifying a database to create the database if it doesn't exist
const connection = mysql.createConnection({
  host: '127.0.0.1',
  multipleStatements: true
});

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

connection.query(
  `CREATE DATABASE IF NOT EXISTS OneTrackMind; USE OneTrackMind; ${schema}`,
  (err, results) => {
    if (err) {
      console.error("Error setting up database:", err);
      process.exit(1);
    }
    console.log("Database 'OneTrackMind' and tables created or confirmed.");
    connection.end();
  }
);
