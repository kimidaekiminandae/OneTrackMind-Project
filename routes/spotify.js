const axios = require('axios');
const db = require('../db');

// get top 50 tracks
const getTopTracks = async (access_token) => {
  try {
    const res = await axios.get('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=short_term', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    return res.data.items;
  } catch (err) {
    console.error('Error getting top tracks:', err);
    throw new Error('Failed to get top tracks');
  }
};

// get top 50 artists
const getTopArtists = async (access_token) => {
  try {
    const res = await axios.get('https://api.spotify.com/v1/me/top/artists?limit=50&time_range=short_term', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    return res.data.items;
  } catch (err) {
    console.error('Error getting top artists:', err);
    throw new Error('Failed to get top artists');
  }
};

// saving tracks in DB
const saveTopTracks = async (user_id, tracks) => {
  try {
    await db.query('DELETE FROM top_tracks WHERE user_id = ?', [user_id]);

    const values = tracks.map(track => [
      user_id,
      track.id,
      track.name,
      track.artists.map(a => a.name).join(', '),
      track.album.name,
      track.album.images[0]?.url || null
    ]);

    if (values.length > 0) {
      await db.query(`
        INSERT INTO top_tracks (user_id, track_id, name, artist, album, album_cover_image_src)
        VALUES ?
      `, [values]);
    }
  } catch (err) {
    console.error('Error saving top tracks:', err);
    throw new Error('Failed to save top tracks');
  }
};

// saving artists in DB
const saveTopArtists = async (user_id, artists) => {
  try {
    await db.query('DELETE FROM top_artists WHERE user_id = ?', [user_id]);

    const values = artists.map(artist => [
      user_id,
      artist.id,
      artist.name,
      JSON.stringify(artist.genres),
      artist.images[0]?.url || null
    ]);

    if (values.length > 0) {
      await db.query(`
        INSERT INTO top_artists (user_id, artist_id, name, genres, image_src)
        VALUES ?
      `, [values]);
    }
  } catch (err) {
    console.error('Error saving top artists:', err);
    throw new Error('Failed to save top artists');
  }
};

module.exports = {
  getTopTracks,
  getTopArtists,
  saveTopTracks,
  saveTopArtists
};
