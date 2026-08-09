require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const xss = require('xss-clean');

const session = require('express-session');

// import database pool from db.js
const db = require('./db/db');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');

const app = express();

// test connection to MySQL pool
db.getConnection()
  .then((connection) => {
    console.log('Connected to MySQL with thread ID:', connection.threadId);
    connection.release(); // always release back to the pool
  })
  .catch((err) => {
    console.error('Error getting MySQL connection from pool:', err.stack);
  });

// set up view engine for ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// global middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors()); // allows requests from any origin (for development only)
app.use(express.static(path.join(__dirname, 'public')));
app.use(xss()); // xss cleaning

// session middleware
app.use(session({
  secret: 'user_session',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// attach db to all requests
app.use((req, res, next) => {
  req.db = db;
  next();
});

// custom middleware
app.use('/users/*', function(req, res, next){
  // check for every /users route called that session exists and user is logged in
  // if yes proceed with next route, if no, direct to login page
  if (!req.session || !req.session.logged_in){
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
});

// routes
app.use('/admin', adminRouter);
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);

// handle auth errors on callback
app.get('/auth/callback', (req, res) => {
  if (req.query.error) {
    return res.send('Authorizaton failed: ' + req.query.error);
  }
  res.redirect('/');
});
//app.get('/admin', (req, res) => {
//  res.render('admin');
//});


module.exports = app;

