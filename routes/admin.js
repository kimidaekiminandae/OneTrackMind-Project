const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { deleteImage } = require('../middleware/uploads');
const path = require('path');

function requireAdmin(req, res, next) {
  // console.log('session:', req.session);
  if (!req.session.logged_in || !req.session.user_id) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  db.query('SELECT is_admin FROM User WHERE user_id = ?', [req.session.user_id])
    .then(([rows]) => {
      if (rows.length > 0 && rows[0].is_admin) {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden: not admin' });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    });
}

router.get('/', requireAdmin, (req, res) => {
  res.render('admin');
});


router.use(requireAdmin);

router.get('/users', async (req, res) => {
    try {
        const [usersRows] = await db.query(`
            SELECT
                user_id,
                nickname,
                is_blocked,
                has_vulgar_content
            FROM
                User;
        `);

        /*const [userImages] = await db.query(`
            SELECT
                user_id, image_path
                FROM User_Image;
        `)*/

        const [topArtistsRows] = await db.query(`
            SELECT
                user_id,
                name AS top_artist
            FROM
                top_artists_long_term
            WHERE
                \`rank\` = 1;
        `);

        const [topTracksRows] = await db.query(`
            SELECT
                user_id,
                name AS top_track
            FROM
                top_tracks_long_term
            WHERE
                \`rank\` = 1;
        `);

        const [matchesRows] = await db.query(`
            SELECT
                m.user_id_1,
                m.user_id_2,
                u1.nickname AS user_1_nickname,
                u2.nickname AS user_2_nickname
            FROM
                \`Match\` m
            JOIN
                User u1 ON m.user_id_1 = u1.user_id
            JOIN
                User u2 ON m.user_id_2 = u2.user_id
            WHERE
                m.match_status = 'Active';
        `);

        const usersWithCombinedData = await Promise.all(usersRows.map(async (user) => {
            const topArtist = topArtistsRows.find((artist) => artist.user_id === user.user_id)?.top_artist || null;
            const topTrack = topTracksRows.find((track) => track.user_id === user.user_id)?.top_track || null;

            const [userImageRows] = await db.query(
                'SELECT image_path FROM User_Image WHERE user_id = ? LIMIT 1;',
                [user.user_id]
            );

            const userImage = userImageRows.length > 0 ? userImageRows[0].image_path : null;

            const userMatches = matchesRows.filter(
                (match) => match.user_id_1 === user.user_id
                || match.user_id_2 === user.user_id,
            ).map((match) => {
                if (match.user_id_1 === user.user_id) {
                    return { user_id: match.user_id_2, nickname: match.user_2_nickname };
                }
                return { user_id: match.user_id_1, nickname: match.user_1_nickname };
            });

            return {
                ...user,
                user_image: userImage,
                top_artist: topArtist,
                top_track: topTrack,
                matches: userMatches
            };
        }));

        // console.log("/admin/user response: ", usersWithCombinedData);
        return res.json(usersWithCombinedData);

    } catch (err) {
        // console.error('Error fetching users for admin dashboard:', err); // Remove console statements for final code
        return res.status(500).json({ error: 'Failed to fetch users', message: err.message });
    }
});

router.put('/users/:userId/block', async (req, res) => {
    const { userId } = req.params;
    const { is_blocked } = req.body;

    try {
        const [result] = await db.query(
            'UPDATE User SET is_blocked = ? WHERE user_id = ?',
            [is_blocked, userId],
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        return res.json({ success: true, message: `User ${userId} block status updated.` });
    } catch (err) {
        // console.error('Error blocking user:', err); // Remove console statements for final code
        return res.status(500).json({ success: false, error: 'Failed to update user block status', message: err.message });
    }
});

router.delete('/users/:userId/profile-picture', async (req, res) => {
    const { userId } = req.params;

    try {
        const [userRows] = await db.query(
            'SELECT profile_picture FROM User WHERE user_id = ?',
            [userId],
        );

        if (userRows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const oldProfilePicture = userRows[0].profile_picture;

        const [updateResult] = await db.query(
            'UPDATE User SET profile_picture = NULL WHERE user_id = ?',
            [userId],
        );

        if (updateResult.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to update profile picture in DB.' });
        }

        if (oldProfilePicture) {
            const filenameOnly = path.basename(oldProfilePicture);
            await deleteImage(filenameOnly);
        }

        return res.json({ success: true, message: `Profile picture for user ${userId} deleted.` });
    } catch (err) {
        // console.error('Error deleting profile picture:', err); // Remove console statements for final code
        return res.status(500).json({ success: false, error: 'Failed to delete profile picture', message: err.message });
    }
});

module.exports = router;