const tabMappings = { // html pages associated with each tab
    home: ['home', 'about'], // i.e. show home tab as active on these pages
    chat: ['chats', 'active_chat', 'chat_settings', 'new_match'],
    profile: ['profile', 'profile_settings']
};

const { createApp } = Vue;

createApp({
    data(){
        return {
            primary_user_id: '',
            active_match_id: '',
            active_match_user_id: '',
            profile_picture: '',
            nickname: '',
            top_artist: '',
            top_track: '',
            top_track_artist: '',
            recent_message: '',
            timestamp: '',
            archived_chats: [],
            chat_streak: 0,
            isDarkMode: localStorage.getItem('darkMode') === 'true'
        };
    },
    methods: {
        redirect(page){ /* method required in ALL page's js Vue files */
            window.location.href = `/${page}`;
        },
        isActive(tab){ /* method required in ALL page's js Vue files */
            var currentPage = window.location.pathname; // get current page
            var keywords = tabMappings[tab]; // get associated pages
            // check if tab is active based on current page
            var isActive = keywords && keywords.some((keyword) => currentPage.includes(keyword));
            return isActive;
        },
        match(){ // should be present on all pages to be called once mounted!
            // check for active match, redirect user to new_match page if there is one
            return axios.get('/users/match', {
                params: {
                    user_id: this.primary_user_id
                }
            })
            .then((response) => {
                if (!response || !response.data) {
                    console.error('Unexpected response:', response);
                    return;
                }

                console.log(response.data); // debug

                if (response.data.match){
                    // active match found!
                    this.redirect('new_match'); // /match route will be called again on this page for user id
                    return;
                }

                if (response.data.match_user_id){
                    // if match=false but user_id=true, match already exists
                    // route would return match ID in this case
                    this.active_match_id = response.data.match_id;
                    this.active_match_user_id = response.data.match_user_id;
                    console.log("Match's user ID: ", this.active_match_user_id, "Match ID: ", this.active_match_id); // debug
                }
            })
            .catch((err) => {
                if (err.response && err.response.status === 401) {
                    window.location.href = '/login';
                }
                console.error(err);
            });
        }
    },
    mounted() {
        if (this.isDarkMode) {
            // darkmode
            const page = document.getElementById('page');
            if (page) page.classList.add('darkmode');
        } else {
            const page = document.getElementById('page');
            if (page && page.classList.contains('darkmode')) page.classList.remove('darkmode');
        }
        // get primary user id
        axios.get('/auth/getuserid')
        .then((response) => {
            if (!response || !response.data) {
                console.error('Unexpected response:', response);
                return;
            }

            this.primary_user_id = response.data.user_id;
            // console.log("Primary user ID: ", this.primary_user_id);

            return axios.get('/users/archivedchats', {
                params: {
                    user_id: this.primary_user_id
                }
            });

        })
        .then((response) => {
            if (!response || !response.data) {
                console.error('Unexpected response:', response);
                return;
            }

            console.log(response.data);
            this.archived_chats = response.data;

            return this.match(); // get match's user id and match ID
        })
        .then(() => axios.get('/users/user', {
                params: { user_id: this.active_match_user_id }
            }))
        .then((response) => {
            if (!response || !response.data) {
                console.error('Unexpected response:', response);
                return;
            }

            this.nickname = response.data.nickname;
            [this.profile_picture] = response.data.profile_picture;

            return axios.get('/users/spotify', {
                params: {
                    user_id: this.active_match_user_id
                }
            });
        })
        .then((response) => {
            if (!response || !response.data) {
                console.error('Unexpected response:', response);
                return;
            }

            this.top_artist = response.data.artists.first.artist_name;
            this.top_track = response.data.tracks.first.track_name;
            this.top_track_artist = response.data.tracks.first.artist_name;

            return axios.get('/users/activechat', {
                params: {
                    match_id: this.active_match_id
                }
            });
        })
        .then((response) => {
            if (!response || !response.data) {
                console.error('Unexpected response:', response);
                return;
            }

            const latestMessage = response.data.messages.pop();
            if (latestMessage){
                this.recent_message = latestMessage.text;
                this.timestamp = latestMessage.message_timestamp;
            }
            else {
                this.recent_message = "";
                this.timestamp = "";
            }

            this.chat_streak = response.data.streak;

            return axios.get('/users/archivedchats', {
                params: {
                    user_id: this.primary_user_id
                }
            });
        })
        .then((response) => {
            if (!response || !response.data) {
                console.error('Unexpected response:', response);
                return;
            }

            console.log(response.data);
            this.archived_chats = response.data;
        })
        .catch((error) => {
            if (error.response && error.response.status === 401) {
                // user not logged in
                window.location.href = '/'; // redirect to login page
            }
            console.error('Error initialising user data:', error);
        });

    }
}).mount('#page');
