/* call /swipe route using axios to fetch recommended user's data */
/* once mounted, call on /match route to check for active match and reroute if any exist */

/* required on every vue .js file */
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
            recommended_user_id: '',
            nickname: '',
            age: '',
            location: '',
            user_images: [],
            current_img_num: 1,
            total_img_num: 1,
            artist_1: [],
            artist_2: [],
            artist_3: [],
            track_1: [],
            track_2: [],
            track_3: [],
            isDarkMode: localStorage.getItem('darkMode') === 'true'
        };
    },
    methods: {
        redirect(page){
            window.location.href = `/${page}`;
        },
        isActive(tab){
            var currentPage = window.location.pathname;
            var keywords = tabMappings[tab];
            var isActive = keywords && keywords.some((keyword) => currentPage.includes(keyword));
            return isActive;
        },
        like(){
            axios.post('/users/like', {
                user_1_id: this.primary_user_id,
                user_2_id: this.recommended_user_id
            })
            .then((response) => {
                if (!response || !response.data) {
                    console.error('Unexpected response:', response);
                    return;
                }
                console.log(response.data);
                this.next(); // move to next recommended user after like
            })
            .catch((err) => {
                console.error(err);
            });
        },
        next(){
            axios.get('/users/swipe', {
                params: {
                    user_id: this.primary_user_id,
                    rejected_user_id: this.recommended_user_id || null
                }
            })
            .then((response) => {
                if (!response || !response.data) {
                    console.error('Unexpected response:', response);
                    return;
                }

                this.recommended_user_id = response.data.suggested_user_id;
                return axios.get('/users/user', { params: { user_id: this.recommended_user_id } });
                // fetch recommended user details
            })
            .then((response) => {
                if (!response || !response.data) {
                    console.error('Unexpected response:', response);
                    return;
                }

                this.nickname = response.data.nickname;
                this.age = response.data.age;
                this.location = response.data.location;
                this.user_images = response.data.profile_picture;
                this.total_img_num = this.user_images.length;
                this.current_img_num = 1;

                return axios.get('/users/spotify', { params: { user_id: this.recommended_user_id } });
                // fetch recommended user Spotify data
            })
            .then((response) => {
                if (!response || !response.data) {
                    console.error('Unexpected response:', response);
                    return;
                }

                this.artist_1 = response.data.artists.first;
                this.artist_2 = response.data.artists.second;
                this.artist_3 = response.data.artists.third;
                this.track_1 = response.data.tracks.first;
                this.track_2 = response.data.tracks.second;
                this.track_3 = response.data.tracks.third;

                // check for match after swipe
                this.match();
            })
            .catch((error) => {
                // no recommended users found in /swipe route
                this.recommended_user_id = false;
                console.error('Error fetching recommended user details:', error);
            });

        },
        next_img(){
            if (this.current_img_num < this.total_img_num){
                this.current_img_num++;
            } else {
                this.current_img_num = 1;
            }
        },
        match(){
            axios.get('/users/match', {
                params: {
                    user_id: this.primary_user_id
                }
            })
            .then((response) => {
                if (!response || !response.data) {
                    console.error('Unexpected response:', response);
                    return;
                }

                if (response.data.match){
                    this.redirect('new_match');
                }
            })
            .catch((error) => {
                console.error('Error checking for new match:', error);
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
        axios.get('/auth/getuserid')
        .then((response) => {
            if (!response || !response.data) {
                console.error('Unexpected response:', response);
                return;
            }

            this.primary_user_id = response.data.user_id;
            console.log("User ID:", this.primary_user_id);
            this.next(); // get recommended user only after user_id fetched
            this.match(); // check for matches
        })
        .catch((error) => {
                if (error.response && error.response.status === 401) {
                    // user not logged in
                    window.location.href = '/'; // redirect to login page
                }
                console.error('Error initialising page:', error);
            });
    }

}).mount('#page');

/* expected format of artists/tracks in response:
artists {
first: [name, image src],
second: [name, image src],
third: [name, image src]
}

tracks {
first: [track name, artist name, album cover image src],
second: [track name, artist name, album cover image src],
third: [track name, artist name, album cover image src]
} */
