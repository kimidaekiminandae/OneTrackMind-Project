# Group Repository for COMP SCI 2207/7207 Web & Database Computing Web Application Project (2023 Semester 1)

__Project description__
The purpose of One Track Mind is to unite adult music lovers and facilitate relationships based on true connection.

Users are shown people with a similar music taste, and can view their top 3 favourite songs and artists, along with their profile photo and distance on the home page. If two users like each other, they can match to chat and access further information about each other's music preferences and listening habits. In the chat, users can access a function to search for artists or songs to see how their statistics compare to their matches (e.g. top 5th vs 20th artist).

There's a catch: each user can only have one active chat at a time. While users are chatting, they can still swipe through other users, but they will not get notified of any new matches. These active chats will also accrue "streaks", showing how long the pair have been chatting! At any point while the chat is active, either person can choose to unmatch to end the chat. Rejected chats are archived and only the match's name, picture, and content and date of the last chat message is visible. Users cannot re-match with those who they've previously unmatched with.

In One Track Mind, users can access three main pages: one to swipe through other user's profiles (Home), one to access their active and archived chats (Chats), and one to view their own profile (Profile), including their settings. Users can change their nickname, profile pictures and location, along with their preferences for which users are shown to them (age range, sex, distance, and music tastes priority: would they rather be shown users with similar top artists, songs, or albums?).


__Instructions for running the app__
To run our web application, One Track Mind:
1. Set up the database
    - Open a terminal
    - ENTER: service mysql start
    - Run script: node db/setup.js

2. Start server
    - Run: PORT=3000 npm start

3. Open web application
    - Navigate to http://localhost:3000 or http://127.0.0.1:3000/ in your browser (or follow VSCode 'Open in Browser' prompting)

4. Log in with Spotify
    - Follow prompting to log in with your Spotify account and enjoy!


__Features and functionality__
1. Swipe on home page to see users' Spotify data, click on heart to like them or cross to skip them
2. Live chat with matched user using Socket.io API
    > Active chat (The one user is currently matched and chatting with, only one at the time)
    > Archived chats (Previous chat log)
3. Edit users'own profile
    > Nickname
    > Age
    > Sex
    > State & Suburb using Google Maps API
    > Photos upload (maximum 4)
4. Change preferences of matches
    > Match based on top songs/tracks
    > Match with Women/Men/Both
    > Travel distance (For 1-500 kilometres)
    > Age range (18-99)
5. In active chat
    > Users can search for songs/artists using Spotify API to see how they rank in comparision to their match


__Known bugs or limitations (if any)__
1. We can only test on one PC (No cloud database) at this stage.
2. User must have an existing Spotify account to log in.


