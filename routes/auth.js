const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const db = require('../db/db');

const router = express.Router();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://127.0.0.1:3000/auth/callback';

const SCOPES = [
  'user-read-recently-played',
  'user-top-read',
  'user-read-email',
  'user-read-private'
].join(' ');

const generateRandomString = (length) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

router.get('/login', (req, res) => {
  const state = generateRandomString(16);
  res.cookie('spotify_auth_state', state);

  const query = querystring.stringify({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state: state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${query}`);
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies.spotify_auth_state : null;

  if (state === null || state !== storedState) {
    return res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }));
  }

  res.clearCookie('spotify_auth_state');

  if (!code) {
    return res.status(400).send('Authorization code not provided');
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    req.session.access_token = access_token;

    const userInfoRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const spotifyUserId = userInfoRes.data.id;
    const displayName = userInfoRes.data.display_name || spotifyUserId;

    const [userRows] = await db.query('SELECT * FROM `User` WHERE spotify_username = ?', [spotifyUserId]);
    let userId;
    if (userRows.length === 0) {
      const [newUser] = await db.query(
        'INSERT INTO `User` (spotify_username, nickname, age, location, profile_picture) VALUES (?, ?, ?, ?, ?)',
        [
          spotifyUserId,
          displayName,
          null,
          null,
          userInfoRes.data.images[0]?.url || null
        ]
      );
      userId = newUser.insertId;
    } else {
      userId = userRows[0].user_id;
    }

    const [spotifyRows] = await db.query('SELECT * FROM `Spotify` WHERE user_id = ?', [userId]);

    if (spotifyRows.length === 0) {
      await db.query(
        'INSERT INTO `Spotify` (user_id, access_token, refresh_token, last_update) VALUES (?, ?, ?, NOW())',
        [userId, access_token, refresh_token]
      );
    } else {
      await db.query(
        'UPDATE `Spotify` SET access_token = ?, refresh_token = ?, last_update = NOW() WHERE user_id = ?',
        [access_token, refresh_token, userId]
      );
    }

    const [topTracksRes, topArtistsRes] = await Promise.all([
      axios.get('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=short_term', {
        headers: { Authorization: `Bearer ${access_token}` }
      }),
      axios.get('https://api.spotify.com/v1/me/top/artists?limit=50&time_range=short_term', {
        headers: { Authorization: `Bearer ${access_token}` }
      })
    ]);

    const topTracks = topTracksRes.data.items;
    const topArtists = topArtistsRes.data.items;

    await db.query('DELETE FROM top_tracks WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM top_artists WHERE user_id = ?', [userId]);

    for (const track of topTracks) {
      await db.query(
        'INSERT INTO top_tracks (user_id, track_id, name, artist, album, album_cover_image_src) VALUES (?, ?, ?, ?, ?, ?)',
        [
          userId,
          track.id,
          track.name,
          track.artists.map(a => a.name).join(', '),
          track.album.name,
          track.album.images[0]?.url || null
        ]
      );
    }

    for (const artist of topArtists) {
      await db.query(
        'INSERT INTO top_artists (user_id, artist_id, name, genres, image_src) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), genres=VALUES(genres), image_src=VALUES(image_src)',
        [
          userId,
          artist.id,
          artist.name,
          artist.genres.join(', '),
          artist.images[0]?.url || null
        ]
      );
    }

    const fetchTopItems = async (accessToken, type) => {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [res1, res2] = await Promise.all([
        axios.get(`https://api.spotify.com/v1/me/top/${type}?limit=50&time_range=long_term`, { headers }),
        axios.get(`https://api.spotify.com/v1/me/top/${type}?limit=50&offset=50&time_range=long_term`, { headers }),
      ]);
      return [...res1.data.items, ...res2.data.items];
    };

    const updateLongTermData = async (currentUserId, accessToken) => {
      const topTracksLongTerm = await fetchTopItems(accessToken, 'tracks');
      const topArtistsLongTerm = await fetchTopItems(accessToken, 'artists');

      await db.query('DELETE FROM top_tracks_long_term WHERE user_id = ?', [currentUserId]);
      await db.query('DELETE FROM top_artists_long_term WHERE user_id = ?', [currentUserId]);

      for (let i = 0; i < topTracksLongTerm.length; i++) {
        const track = topTracksLongTerm[i];
        await db.query(
          `INSERT INTO top_tracks_long_term
            (user_id, track_id, name, artist, album, album_cover_image_src,\`rank\` )
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            currentUserId,
            track.id,
            track.name,
            track.artists.map(a => a.name).join(', '),
            track.album.name,
            track.album.images[0]?.url || null,
            i + 1,
          ]
        );
      }

      for (let i = 0; i < topArtistsLongTerm.length; i++) {
        const artist = topArtistsLongTerm[i];
        await db.query(
          `INSERT INTO top_artists_long_term
            (user_id, artist_id, name, genres, image_src, \`rank\`)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            currentUserId,
            artist.id,
            artist.name,
            artist.genres.join(', '),
            artist.images[0]?.url || null,
            i + 1,
          ]
        );
      }
    };

    await updateLongTermData(userId, access_token);

    req.session.logged_in = true;
    req.session.user_id = userId;

    res.redirect('/home');

  } catch (err) {
    console.log(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send(false);
    }
    res.clearCookie('connect.sid');
    res.sendStatus(200);
  });
});

router.get('/getuserid', (req, res) => {
  if (req.session.user_id) {
    const user = req.session.user_id;
    res.json({ success: true, user_id: user });
  } else {
    res.status(401).json({ success: false, error: 'User not logged in' });
  }
});

module.exports = router;