CREATE TABLE IF NOT EXISTS Chat (
    chat_id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INTEGER NOT NULL,
    user_id_1 INT NOT NULL,
    user_id_2 INT NOT NULL,
    chat_status VARCHAR(20),
    number_of_streaks INTEGER DEFAULT 0,
    `message` TEXT,
    activeFrom DATETIME,
    activeTo DATETIME
);

CREATE TABLE IF NOT EXISTS `User` (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    spotify_username VARCHAR(50) UNIQUE NOT NULL,
    nickname VARCHAR(30),
    age INTEGER,
    location VARCHAR(100),
    profile_picture VARCHAR(255),
    active_chat_id INTEGER,
    FOREIGN KEY (active_chat_id) REFERENCES Chat(chat_id) ON DELETE SET NULL,
    city_lat DECIMAL(10, 7),
    city_lng DECIMAL(10, 7),
    sex VARCHAR(10),
    is_admin BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS User_Image (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  image_path VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES User(user_id)
);

CREATE TABLE IF NOT EXISTS `Spotify` (
    access_token VARCHAR(1000) NOT NULL,
    refresh_token VARCHAR(1000) NOT NULL,
    user_id INT PRIMARY KEY,
    last_update DATETIME,
    FOREIGN KEY (user_id) REFERENCES `User`(user_id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS `top_tracks_long_term` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT,
    `track_id` VARCHAR(50),
    `rank` INT,
    `name` VARCHAR(255),
    `artist` VARCHAR(255),
    `album` VARCHAR(255),
    `album_cover_image_src` VARCHAR(255),
    FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `top_artists_long_term` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT,
    `artist_id` VARCHAR(50),
    `rank` INT,
    `name` VARCHAR(255),
    `genres` TEXT,
    `image_src` VARCHAR(255),
    FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS `top_tracks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT,
    `track_id` VARCHAR(50),
    `name` VARCHAR(255),
    `artist` VARCHAR(255),
    `album` VARCHAR(255),
    `album_cover_image_src` VARCHAR(255),
    `rank` INT,
    FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `top_artists` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT,
    `artist_id` VARCHAR(50),
    `name` VARCHAR(255),
    `genres` TEXT,
    `image_src` VARCHAR(255),
    `rank` INT,
    FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS `Match` (
    match_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id_1 INT NOT NULL,
    user_id_2 INT NOT NULL,
    match_status VARCHAR(20),
    match_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    liked_by INT,
    FOREIGN KEY (user_id_1) REFERENCES `User`(user_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id_2) REFERENCES `User`(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Match_Preference (
    pref_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    match_pref VARCHAR(50),
    age_pref_max INT,
    age_pref_min INT,
    distance_preference DECIMAL(10, 5),
    sex_pref VARCHAR(10),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `Hit_Archive` (
    archive_id INT AUTO_INCREMENT PRIMARY KEY,
    search_id VARCHAR(255),
    match_id INT NOT NULL,
    user_id_1 INT NOT NULL,
    user_id_2 INT NOT NULL,
    image_src VARCHAR(255),
    search_term VARCHAR(255),
    user_1_rank INT,
    user_2_rank INT,
    FOREIGN KEY (match_id) REFERENCES `Match`(match_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id_1) REFERENCES `User`(user_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id_2) REFERENCES `User`(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `Messages` (
    message_id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY ,
    chat_id INT NOT NULL,
    user_id INT NOT NULL,
    `text` TEXT,
    message_timestamp VARCHAR(50),
    FOREIGN KEY (chat_id) REFERENCES `Chat`(chat_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES `User`(user_id) ON DELETE CASCADE
);

ALTER TABLE `Chat`
ADD FOREIGN KEY (match_id) REFERENCES `Match`(match_id) ON DELETE CASCADE,
ADD FOREIGN KEY (user_id_1) REFERENCES `User`(user_id) ON DELETE CASCADE,
ADD FOREIGN KEY (user_id_2) REFERENCES `User`(user_id) ON DELETE CASCADE;

ALTER TABLE `User` ADD COLUMN `is_blocked` BOOLEAN DEFAULT FALSE;
ALTER TABLE `User` ADD COLUMN `has_vulgar_content` BOOLEAN DEFAULT FALSE;
