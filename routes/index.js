const express = require('express');
const router = express.Router();

/* GET home page */
router.get('/', function(req, res) {
  res.render('login');
});

/* add all other page serving routes */

/*
router.get('/', function(req, res) {
  res.render('page');
});
*/

router.get('/about', function(req, res){
  res.render('about');
});

router.get('/active_chat', function(req, res){
  res.render('active_chat');
});

router.get('/chat_settings', function(req, res){
  const token = req.session.access_token;
  res.render('chat_settings', { access_token: token });
});

router.get('/chats', function(req, res){
  res.render('chats');
});

router.get('/home', function(req, res){
  res.render('home');
});

router.get('/new_match', function(req, res){
  res.render('new_match');
});

router.get('/profile_settings', function(req, res){
  res.render('profile_settings');
});

router.get('/profile', function(req, res){
  res.render('profile');
});


/* Websockets setup! */

module.exports = router;
