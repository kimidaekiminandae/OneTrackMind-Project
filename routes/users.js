/* eslint-disable no-console */

const express = require('express');
const router = express.Router();
const db = require('../db/db');
const path = require('path');
const { upload, deleteImage } = require('../middleware/uploads');
const fs = require('fs');
const heicConvert = require('heic-convert');

const googleMapsClient = require('@google/maps').createClient({
  key: process.env.GOOGLE_KEY
});

// user
router.get('/user', async function(req, res, next) {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: "Missing user_id parameter" });
  }

  const userSql = `
    SELECT user_id, nickname, age, sex, location, city_lat, city_lng
    FROM User
    WHERE user_id = ?;
  `;

  const imagesSql = `
    SELECT image_path FROM User_Image WHERE user_id = ?;
  `;

  const matchPrefSql = `
    SELECT match_pref, distance_preference, age_pref_min, age_pref_max, sex_pref
    FROM Match_Preference
    WHERE user_id = ?;
  `;

  try {
    const [userRows] = await req.db.query(userSql, [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userRows[0];

    const [imageRows] = await req.db.query(imagesSql, [user_id]);
    const images = imageRows.map((row) => row.image_path);


    const [matchRows] = await db.query(matchPrefSql, [user_id]);
    const matchPrefs = matchRows[0] || {};


    const response = {
      nickname: user.nickname || null,
      age: user.age || null,
      sex: user.sex || null,
      location: user.location || null,
      city_lat: user.city_lat || null,
      city_lng: user.city_lng || null,
      profile_picture: images || null,
      match_pref: matchPrefs.match_pref || null,
      distance_preference: matchPrefs.distance_preference || null,
      age_pref_min: matchPrefs.age_pref_min || null,
      age_pref_max: matchPrefs.age_pref_max || null,
      sex_pref: matchPrefs.sex_pref || null
    };

    return res.json(response);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(err);
    }
    return res.status(500).json({ error: 'Database error' });
  }
});

// spotify
router.get('/spotify', async function(req, res, next){
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: "Missing user_id parameter" });
  }

  const tracksSql = `
    SELECT name AS track_name, artist AS artist_name, album_cover_image_src
    FROM top_tracks
    WHERE user_id = ?
    LIMIT 3;
  `;

  const artistsSql = `
    SELECT artist_id, name AS artist_name, image_src
    FROM top_artists
    WHERE user_id = ?
    LIMIT 3;
  `;

  try {
    const [trackRows] = await db.query(tracksSql, [user_id]);
    const [artistRows] = await db.query(artistsSql, [user_id]);

    const formatList = (rows) => ({
      first: rows[0] || {},
      second: rows[1] || {},
      third: rows[2] || {}
    });

    return res.json({
      tracks: formatList(trackRows),
      artists: formatList(artistRows)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// update details
router.post('/updatedetails', async function (req, res) {
  const {
    user_id, nickname, age, sex, location, cityLat, cityLng, profile_picture,
    match_pref, distance_preference, age_pref_min, age_pref_max, sex_pref
  } = req.body;

  /*
  console.log({
  nickname, age, sex, location, cityLat, cityLng, profile_picture,
  match_pref, distance_preference, age_pref_min, age_pref_max, sex_pref
  });
  */

  const safe = (v) => (v === undefined ? null : v);

  const updateUserSql = `
    UPDATE User
    SET nickname = ?, age = ?, sex = ?, location = ?, city_lat = ?, city_lng = ?
    WHERE user_id = ?;
  `;

  const updatePrefSql = `
    UPDATE Match_Preference
    SET match_pref = ?, distance_preference = ?, age_pref_min = ?, age_pref_max = ?, sex_pref = ?
    WHERE user_id = ?;
  `;

  const insertPrefSql = `
    INSERT INTO Match_Preference (user_id, match_pref, distance_preference, age_pref_min, age_pref_max, sex_pref)
    VALUES (?, ?, ?, ?, ?, ?);
  `;

  const deleteOldImagesSql = `DELETE FROM User_Image WHERE user_id = ?;`;
  const insertImageSql = `INSERT INTO User_Image (user_id, image_path) VALUES (?, ?);`;

  try {
    const [result1] = await db.execute(
      updateUserSql,
      [safe(nickname), safe(age), safe(sex), safe(location), safe(cityLat), safe(cityLng), safe(user_id)]
    );

    if (result1.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [result2] = await db.execute(
      updatePrefSql,
      [safe(match_pref), safe(distance_preference), safe(age_pref_min), safe(age_pref_max), safe(sex_pref), user_id]
    );

    if (result2.affectedRows === 0) {
      await db.execute(insertPrefSql, [
        user_id, safe(match_pref), safe(distance_preference), safe(age_pref_min), safe(age_pref_max), safe(sex_pref)
      ]);
    }

    await db.execute(deleteOldImagesSql, [user_id]);

    if (Array.isArray(profile_picture)) {
      const insertPromises = profile_picture.map((imgPath) => db.execute(
        insertImageSql,
        [user_id, safe(imgPath)]
      ));
      await Promise.all(insertPromises);
    }

    return res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(err);
    }
    return res.status(500).json({ error: 'Database error' });
  }
});

// match
router.get('/match', async function(req, res) {
  const { user_id } = req.query;

  // response should be:
  // {
  //   match: true/false (is there a NEW match?),
  //   match_id: '',
  //   match_user_id: ''
  // }

  try {

    // route should check if user has a current active chat, and return those details if so
    const existingChatSql = `
      SELECT match_id, user_id_1, user_id_2
      FROM Chat
      WHERE (user_id_1 = ? OR user_id_2 = ?) AND chat_status = 'true'
    `;

    const [activeChats] = await req.db.query(existingChatSql, [user_id, user_id]);

    if (activeChats.length > 0){ // active chat currently exists, not a new match
      // console.log("Active chat found -> no new match.");
      const currentMatch = activeChats[0];
      const { match_id } = currentMatch;
      let match_user_id;
      if (currentMatch.user_id_1 == user_id){
        match_user_id = currentMatch.user_id_2;
      }
      else {
        match_user_id = currentMatch.user_id_1;
      }
      return res.json({ match: false, match_id: match_id, match_user_id: match_user_id });
    }

    // route should also filter out potential matches
    // if they (other user) have a current active chat
    const matchSql = `
      SELECT match_id, user_id_1, user_id_2
      FROM \`Match\`
      WHERE (user_id_1 = ? OR user_id_2 = ?)
        AND match_status = 'true'
        AND NOT EXISTS (
          SELECT 1
          FROM Chat
          WHERE chat_status = 'true'
            AND (
              Chat.user_id_1 = Match.user_id_1 OR
              Chat.user_id_2 = Match.user_id_1 OR
              Chat.user_id_1 = Match.user_id_2 OR
              Chat.user_id_2 = Match.user_id_2
            )
        )
      ORDER BY match_id ASC
      LIMIT 1;
    `;

    const [matchRows] = await req.db.query(matchSql, [user_id, user_id]);

    if (matchRows.length === 0) {
      console.log("No new match found.");
      return res.json({ match: false, match_id: null, match_user_id: null });
    }

    const match = matchRows[0];
    const { match_id } = match;

    // console.log("user 1: ", match.user_id_1, " user 2: ", match.user_id_2); // debug

    let match_user_id;
    if (match.user_id_1 == user_id){
      match_user_id = match.user_id_2;
    }
    else {
      match_user_id = match.user_id_1;
    }

    const chatSql = `
      SELECT chat_id
      FROM Chat
      WHERE match_id = ?
      LIMIT 1;
    `;

    const [chatRows] = await req.db.query(chatSql, [match_id]);

    const isNewMatch = chatRows.length === 0;

    /* console.log({
      match: isNewMatch,
      match_id: match_id,
      match_user_id: match_user_id
    }); // debug
    */

    return res.json({
      match: isNewMatch,
      match_id: match_id,
      match_user_id: match_user_id
    });

  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(err);
    }
    return res.status(500).json({ error: 'Database error' });
  }
});

// chat
router.post('/chat', async function(req, res) {
  const { match_id } = req.body;

  console.log("chat route called for match id: ", match_id); // debug

  // get user IDs from Match
  const getUsersSql = `
    SELECT user_id_1, user_id_2
    FROM \`Match\`
    WHERE match_id = ?;
  `;

  // creates a new active chat for user
  const insertChatSql = `
    INSERT INTO Chat (match_id, user_id_1, user_id_2, chat_status, activeFrom, number_of_streaks)
    VALUES (?, ?, ?, ?, ?, ?);
  `;

  try {
    const [users] = await req.db.query(getUsersSql, [match_id]);
    if (users.affectedRows === 0){
      console.log("no users found for this match ID with query: ", getUsersSql, [match_id]);
      return res.status(404).json({ error: 'No users found for this match ID.' });
    }

    const user_1 = users[0].user_id_1;
    const user_2 = users[0].user_id_2;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const [result] = await req.db.query(insertChatSql, [match_id, user_1, user_2, 'true', now, 0]);

    if (result.affectedRows === 0) {
      console.log("error creating chat, query: ", insertChatSql, [match_id, user_1, user_2, 'true', now, 0]); // debug

      return res.status(404).json({ error: 'Error in creating chat.' });
    }

    return res.json({ success: true, message: 'Chat activated successfully' });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Database error:', err);
    }
    return res.status(500).json({ error: 'Database error' });
  }

});

// unmatch
router.post('/unmatch', async function(req, res){
  const { match_id } = req.body;

  const unmatchSql = `
    UPDATE \`Match\`
    SET match_status = false
    WHERE match_id = ?;
  `;

  const activeFromSql = `
    SELECT activeFrom
    FROM Chat
    WHERE match_id = ?;
  `;

  const inactiveChatSql = `
    UPDATE Chat
    SET chat_status = false, activeTo = ?, number_of_streaks = ?
    WHERE match_id = ?;
  `;

  try {
    const activeFromResult = await req.db.query(activeFromSql, [match_id]);
    if (activeFromResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const activeFrom = new Date(activeFromResult[0][0].activeFrom);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const streak = Math.floor((today - activeFrom) / (1000 * 60 * 60 * 24));
    // console.log(streak);

    const [matchResult] = await req.db.query(unmatchSql, [match_id]);

    if (matchResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    await req.db.query(inactiveChatSql, [today, streak, match_id]);

    return res.json({ success: true, message: 'Unmatched and chat deactivated successfully' });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error unmatching:', err);
    }
    return res.status(500).json({ error: 'Database error' });
  }
});

// like
router.post('/like', async function(req,res) {
  const { user_1_id, user_2_id } = req.body;

  const existingMatchSql = `
    SELECT * FROM \`Match\`
    WHERE (user_id_1 = ? AND user_id_2 = ?)
       OR (user_id_1 = ? AND user_id_2 = ?)
  `;

  const insertMatchSql = `
    INSERT INTO \`Match\` (user_id_1, user_id_2, match_status, liked_by)
    VALUES (?, ?, 'false', ?)
  `;

  const updateMatchSql = `
    UPDATE \`Match\`
    SET match_status = 'true', match_timestamp = CURRENT_TIMESTAMP
    WHERE match_id = ?
  `;

  try {
    const [rows] = await req.db.query(existingMatchSql, [
      user_1_id, user_2_id,
      user_2_id, user_1_id
    ]);

    if (rows.length === 0) {
      // first like: store who liked whom, user 1 is primary user and has liked user 2
      await req.db.query(insertMatchSql, [user_1_id, user_2_id, user_1_id]);
      console.log("user", user_1_id, "liked user", user_2_id); // debug
      return res.send(true);
    }

    const match = rows[0];

    if (match.match_status === 'true') { // users already have active match
      return res.send(true);
    }

    if (parseInt(match.liked_by, 10) === parseInt(user_1_id, 10)) {
      // duplicate like from the same user
      return res.send(true);
    }

    // it's a reciprocal like!
    await req.db.query(updateMatchSql, [match.match_id]);
    return res.send(true);

  } catch (error) {
    console.error('Error processing like:', error);
    return res.status(500).json({ error: 'Database error' });
  }

});

// helper function for /swipe to calculate distance using the google maps API
async function calculateDistance(lat1, lng1, lat2, lng2) {

  return new Promise((resolve, reject) => {

    googleMapsClient.distanceMatrix({

      origins: [{ lat: lat1, lng: lng1 }],
      destinations: [{ lat: lat2, lng: lng2 }],
      units: 'metric'

    }, (err, response) => {

      if (err) {

        console.log("Error in calculating distance: ", err);
        reject(err);

      } else {

        const distance = response.json.rows[0].elements[0].distance.value / 1000; // convert to km
        resolve(distance);

      }
    });
  });

}

// swipe
router.get('/swipe', async function(req, res){
  const { user_id, rejected_user_id } = req.query;

  if (!req.session.rejectedUsers) {
    req.session.rejectedUsers = [];
  }

  // if it exists, add rejected user ID to session so that
  // this user is not shown to primary user during this session ONLY
  if (rejected_user_id && !req.session.rejectedUsers.includes(parseInt(rejected_user_id, 10))) {
    req.session.rejectedUsers.push(parseInt(rejected_user_id, 10));
  }

  /*
   1. Fetch user's match preferences
   (match_pref, distance_preference, age_pref_min, age_pref_max, sex_pref)
   from Match_Preference table. Fetch city_lat and city_lng from User table.
   2. Filter other users by sex and age using those preferences.
   3. Use google api to calculate distance (km) between users using lat & lng. Filter accordingly.
   4. Rank remaining users by similarity in top artists or top tracks based on match_pref of user.
   5. return suggested_user_id of top suggested user
  */

  try {
    // 1. fetch user's match preferences and location
    const userPrefQuery = `
        SELECT match_pref, distance_preference, age_pref_min, age_pref_max, sex_pref
        FROM Match_Preference
        WHERE user_id = ?;`;

    const [userPrefs] = await db.execute(userPrefQuery, [user_id]);

    if (!userPrefs.length) {
      return res.status(404).json({ error: 'User preferences not found' });
    }

    const {
      match_pref, distance_preference, age_pref_min, age_pref_max, sex_pref
    } = userPrefs[0];

    const userLocationQuery = `
        SELECT city_lat, city_lng
        FROM User
        WHERE user_id = ?;`;

    const [userLocation] = await db.execute(userLocationQuery, [user_id]);

    if (!userLocation.length) {
      return res.status(404).json({ error: 'User location not found' });
    }

    const { city_lat, city_lng } = userLocation[0];

    // 2. fetch other users and apply filters for age, sex, and distance
    // ensuring that no users that the user has already liked are included
    // and active match is excluded!!
    let usersQuery = `
        SELECT user_id, city_lat, city_lng, age, sex
        FROM User
        WHERE user_id != ?
          AND age BETWEEN ? AND ?
          AND user_id NOT IN (
          SELECT user_id_2
          FROM \`Match\`
          WHERE user_id_1 = ? AND liked_by = ?
          )
          AND NOT EXISTS (
            SELECT 1
            FROM \`Match\`
            WHERE
                (
                  (user_id_1 = ? AND user_id_2 = User.user_id)
                  OR
                  (user_id_2 = ? AND user_id_1 = User.user_id)
                )
                AND match_status = 'true')
    `;

    const queryParams = [user_id, age_pref_min, age_pref_max, user_id, user_id, user_id, user_id];

    if (sex_pref !== "both") {
      usersQuery = usersQuery.replace("WHERE user_id != ?", "WHERE user_id != ? AND sex = ?");
      queryParams.splice(1, 0, sex_pref); // Insert sex_pref right after user_id
    }

    if (req.session.rejectedUsers.length > 0) {
      // check for this sessions rejected users and exclude
      const placeholders = req.session.rejectedUsers.map(() => '?').join(',');
      usersQuery += ` AND user_id NOT IN (${placeholders})`;
      queryParams.push(...req.session.rejectedUsers);
    }

    const [otherUsers] = await db.execute(usersQuery, queryParams);

    // console.log("Other users:", otherUsers); // debug

    // 3. filter users by distance using Google Maps API
    const filteredUsers = await Promise.all(otherUsers.map(async (user) => {
      if (user.user_id === user_id) return null; // skip  primary user
      const { city_lat: other_lat, city_lng: other_lng } = user;

      const distance = await calculateDistance(city_lat, city_lng, other_lat, other_lng);
      if (distance <= distance_preference) {
        // console.log(user); // debug
        return user;
      }
      return null;
    }));

    const validUsers = filteredUsers.filter((user) => user !== null);
    // console.log("Valid users:", validUsers); // debug

    // 4. rank users based on shared artists or tracks
    const rankingPromises = validUsers.map(async (user) => {
      let sharedCount = 0;

      if (match_pref === 'artists') {

        const [userArtists] = await db.execute('SELECT artist_id FROM top_artists WHERE user_id = ?', [user_id]);
        const [otherUserArtists] = await db.execute('SELECT artist_id FROM top_artists WHERE user_id = ?', [user.user_id]);

        // calculate number of shared artists
        sharedCount = userArtists.filter((artist) => otherUserArtists.some(
          (other) => other.artist_id === artist.artist_id
        )).length;

      } else if (match_pref === 'tracks') {

        const [userTracks] = await db.execute('SELECT track_id FROM top_tracks WHERE user_id = ?', [user_id]);
        const [otherUserTracks] = await db.execute('SELECT track_id FROM top_tracks WHERE user_id = ?', [user.user_id]);

        // calculate number of shared tracks
        sharedCount = userTracks.filter((track) => otherUserTracks.some(
          (other) => other.track_id === track.track_id
        )).length;

      }

      return { user_id: user.user_id, sharedCount };
    });

    const rankings = await Promise.all(rankingPromises);
    // console.log("rankings:", rankings); // debug

    // 5. sort by sharedCount and return the top user
    rankings.sort((a, b) => b.sharedCount - a.sharedCount);

    if (rankings.length > 0) {
      const topSuggestedUser = rankings[0];
      return res.json({ suggested_user_id: topSuggestedUser.user_id });
    }

    // otherwise
    return res.status(404).json({ error: 'No suitable matches found' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'An error occurred while processing the request' });
  }

});

// hitarchive
router.get('/hitarchive', async function(req, res) {
  const { match_id, primary_user, other_user } = req.query;

  if (!match_id || !primary_user || !other_user) {
    return res.status(400).json({ error: 'Missing match_id in query parameters.' });
  }

  const archiveSQL = `
    SELECT search_id, image_src, search_term, user_1_rank, user_2_rank, user_id_1, user_id_2
    FROM Hit_Archive
    WHERE match_id = ?;
  `;

  /*
    desired json response
    {
      [artist_img_src: ..., search_term: ..., user_1_rank: ..., user_2_rank: ..., search_id: ...],
      [artist_img_src: ..., search_term: ..., user_1_rank: ..., user_2_rank: ..., search_id: ...],
      [artist_img_src: ..., search_term: ..., user_1_rank: ..., user_2_rank: ..., search_id: ...],
      etc..
    }
  */

    try {
      const [rows] = await db.execute(archiveSQL, [match_id]);

      const formattedResults = rows.map((row) => {
        const user1IsPrimary = String(row.user_id_1) === String(primary_user);

        return {
          artist_img_src: row.image_src,
          search_term: row.search_term,
          user_1_rank: user1IsPrimary ? row.user_1_rank : row.user_2_rank,
          user_2_rank: user1IsPrimary ? row.user_2_rank : row.user_1_rank,
          search_id: row.search_id
        };
      });

      // console.log(formattedResults); // debug

      return res.json(formattedResults);
    } catch (error) {
      console.error('Error retrieving hit archive:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

});

// activechat
router.get('/activechat', async function(req, res){
  const { match_id } = req.query;

  if (!match_id) {
    return res.status(400).json({ error: 'Missing match_id in query parameters.' });
  }

  const activeFromSql = `
    SELECT activeFrom
    FROM Chat
    WHERE match_id = ?;
  `;

  const updateChatSql = `
    UPDATE Chat
    SET activeTo = ?, number_of_streaks = ?
    WHERE match_id = ?;
  `;

  // get chat_id from Chat using match_id
  const getChatSql = `
    SELECT chat_id
    FROM Chat
    WHERE match_id = ?;
  `;

  // get messages from Messages using chat_id
  const getMessagesSql = `
    SELECT text, user_id AS sender, message_timestamp
    FROM Messages
    WHERE chat_id = ?
    ORDER BY message_id ASC;
  `;

  try {
    const activeFromResult = await req.db.query(activeFromSql, [match_id]);
    if (activeFromResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // console.log("activeFromResult:", activeFromResult);
    // console.log("activeFromResult[0].activeFrom:", activeFromResult[0]?.activeFrom);

    const activeFrom = new Date(activeFromResult[0][0].activeFrom);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const streak = Math.floor((today - activeFrom) / (1000 * 60 * 60 * 24));
    // console.log("chat streak: ", streak);

    const [result] = await req.db.query(updateChatSql, [today, streak, match_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Updating streak unsuccessful' });
    }

    const [chatResult] = await req.db.query(getChatSql, [match_id]);
    if (chatResult.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const { chat_id } = chatResult[0];

    const [messages] = await req.db.query(getMessagesSql, [chat_id]);

    /*
    messages:
      {text: “...”, timestamp: “...”, sender: “...user ID…”},
      {text: “...”, timestamp: “...”, sender: “...user ID…”},
      etc.
    streak: ‘...’ (days)

    where request:
      this.recent_message = response.data.messages.pop().text;
      this.timestamp = response.data.messages.pop().timestamp;
      this.chat_streak = response.data.streak;
    */

    return res.json({
      messages,
      streak
    });

  } catch (error) {
    console.error('Error retrieving hit archive:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

});

// sendchat
router.post('/sendchat', async function(req, res){
  const {
    text, timestamp, sender, match_id
  } = req.body;

  if (!text || !timestamp || !sender || !match_id) {
    return res.status(400).json({ error: 'Missing one or more required fields.' });
  }

  // get chat_id from Chat using match_id
  const getChatSql = `
    SELECT chat_id
    FROM Chat
    WHERE match_id = ?;
  `;

  const sendSql = `
    INSERT INTO Messages (chat_id, user_id, text, message_timestamp)
    VALUES(?, ?, ?, ?);
  `;

  try {
    // retrieve chat_id
    const [chatResult] = await req.db.query(getChatSql, [match_id]);
    if (chatResult.length === 0) {
      return res.status(404).json({ error: 'Chat not found for given match_id.' });
    }

    const { chat_id } = chatResult[0];

    // insert new message
    const [insertResult] = await req.db.query(sendSql, [chat_id, sender, text, timestamp]);

    if (insertResult.affectedRows === 1) {
      return res.send(true);
    }

    return res.status(500).json({ error: 'Message insertion failed.' });

  } catch (error) {
    console.error('Error sending chat message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

});

// archivedchats
router.get('/archivedchats', async function(req, res){
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id parameter' });
  }

  // select all Chat with user_id with chat_status = false
  // get chat_id for each, get other user_id for each
  // get nickname and profile picture (just 1) for each user
  // get most recent message and timestamp for each chat using chat_id

  const chatSql = `
    SELECT chat_id, user_id_1, user_id_2
    FROM Chat
    WHERE chat_status = '0' AND (user_id_1 = ? OR user_id_2 = ?)
  `;

  const userSql = `
    SELECT nickname FROM User WHERE user_id = ?
  `;

  const imageSql = `
    SELECT image_path FROM User_Image WHERE user_id = ? LIMIT 1
  `;

  const messageSql = `
    SELECT \`text\`, \`message_timestamp\`
    FROM \`Messages\`
    WHERE chat_id = ?
    ORDER BY message_id DESC
    LIMIT 1
  `;

  db.query(chatSql, [user_id, user_id]);
  try {
    const [chats] = await req.db.query(chatSql, [user_id, user_id]);
    // console.log(chats);
    const results = [];

    for (const chat of chats) {

      let otherUserId;

      if (chat.user_id_1 == user_id){
        otherUserId = chat.user_id_2;
      }
      else {
        otherUserId = chat.user_id_1;
      }
      otherUserId = chat.user_id_1 === user_id ? chat.user_id_2 : chat.user_id_1;
      // console.log("other user id: ", otherUserId);

      const [userRows] = await req.db.query(userSql, [otherUserId]);
      const nickname = userRows.length > 0 ? userRows[0].nickname : 'Unknown';

      const [imageRows] = await req.db.query(imageSql, [otherUserId]);
      const profile_picture = imageRows.length > 0 ? imageRows[0].image_path : null;

      const [msgRows] = await req.db.query(messageSql, [chat.chat_id]);
      console.log(msgRows);
      const last_message = msgRows.length > 0 ? msgRows[0].text : null;
      const timestamp = msgRows.length > 0 ? msgRows[0].message_timestamp : null;

      results.push({
        chat_id: chat.chat_id,
        nickname: nickname,
        profile_image: profile_picture,
        last_message: last_message,
        timestamp: timestamp
      });
    }

    return res.json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }

});

// upload route
router.post('/uploadimage', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const originalPath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    try {
        if (ext === '.heic') { // if upload is heic file, iphone format
            // read and convert HEIC buffer
            const inputBuffer = fs.readFileSync(originalPath);

            const outputBuffer = await heicConvert({
                buffer: inputBuffer,
                format: 'JPEG',
                quality: 1
            });

            // generate new .jpg filename
            const newFilename = req.file.filename.replace(/\.heic$/i, '.jpg');
            const newPath = path.join(path.dirname(originalPath), newFilename);

            // save new file and remove the .heic
            fs.writeFileSync(newPath, outputBuffer);
            fs.unlinkSync(originalPath);

            return res.json({
                success: true,
                imagePath: `/images/${newFilename}`
            });
        }
          // for non-heic images, return path directly
          return res.json({
              success: true,
              imagePath: `/images/${req.file.filename}`
          });

    } catch (error) {
        console.error('Error handling image upload:', error);
        return res.status(500).json({ success: false, message: 'Error processing image' });
    }
});

// delete route
router.post('/deleteimage', async (req, res) => {
    const { imagePath } = req.body;
    if (!imagePath) {
        return res.status(400).json({ success: false, error: 'No image path provided' });
    }

    const filename = path.basename(imagePath); // get filename only

    try {
        await deleteImage(filename);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to delete image' });
    }
});

// search route
router.post('/search', async (req, res) => {
  console.log(req.body); // debug
  const { search_term, match_id, search_id, search_type, user_id_1, user_id_2 } = req.body;

  try {
    let tableName, idColumn, imageColumn;

    if (search_type === 'track') {
      tableName = 'top_tracks_long_term';
      idColumn = 'track_id';
      imageColumn = 'album_cover_image_src';
    } else if (search_type === 'artist') {
      tableName = 'top_artists_long_term';
      idColumn = 'artist_id';
      imageColumn = 'image_src';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid search_type' });
    }

    const [user1Rows] = await db.query(
      `SELECT \`rank\`, \`name\`, \`${imageColumn}\` AS image_src
       FROM \`${tableName}\`
       WHERE \`user_id\` = ? AND \`${idColumn}\` = ?`,
      [user_id_1, search_id]
    );
    /*console.log('The query for User 1:', {
      sql: `SELECT \`rank\`, \`name\`, \`${imageColumn}\` AS image_src
            FROM \`${tableName}\`
            WHERE \`user_id\` = ? AND \`${idColumn}\` = ?`,
      params: [user_id_1, search_id]
    }); */
    // console.log('user_id_1:', user_id_1, 'search_id:', search_id);
    console.log('User 1 Rows:', user1Rows);

    const [user2Rows] = await db.query(
      `SELECT \`rank\`, \`name\`, \`${imageColumn}\` AS image_src
       FROM \`${tableName}\`
       WHERE \`user_id\` = ? AND \`${idColumn}\` = ?`,
      [user_id_2, search_id]
    );
    console.log('User 1 Data:', user1Rows);
    console.log('User 2 Rows:', user2Rows);
    if (user1Rows.length === 0 && user2Rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No results found for the given search term.' });
      // need to push something to db here! i.e. an image and ranks of null for both
    }

    const user1Data = user1Rows[0] || null;
    const user2Data = user2Rows[0] || null;


    await db.query(
      `INSERT INTO Hit_Archive (
        match_id, user_id_1, user_id_2, image_src, search_term, user_1_rank, user_2_rank, search_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        match_id,
        user_id_1,
        user_id_2,
        user1Data?.image_src || user2Data?.image_src || null,
        search_term,
        user1Data?.rank || null,
        user2Data?.rank || null,
        search_id
      ]
    );

    res.json({
      success: true,
      match_id,
      user_1_rank: user1Data?.rank || null,
      user_2_rank: user2Data?.rank || null,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});





module.exports = router;
