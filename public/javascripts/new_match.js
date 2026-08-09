const tabMappings = {
    home: ['home', 'about'],
    chat: ['chats', 'active_chat', 'chat_settings', 'new_match'],
    profile: ['profile', 'profile_settings']
};

const { createApp } = Vue;

createApp({
    data(){
        return {
            primary_user_id: '',
            match_id: '',
            match_user_id: '',
            nickname: '',
            age: '',
            location: '',
            user_images: [],
            current_img_num: '1',
            total_img_num: '1',
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
            // check for active match, get match ID and user ID when found
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

                if (response.data.match){
                    // active match found!
                    this.match_id = response.data.match_id;
                    this.match_user_id = response.data.match_user_id;
                }
            })
            .catch((error) => {
                console.error('Error checking for new match:', error);
            });
        },
        next_img(){
            // when user clicks on recommended user's image, should increment current img number
            // or if current img number = total img number, should set current img number back to 1
            if (this.current_img_num < this.total_img_num){
                this.current_img_num++;
            } else {
                this.current_img_num = 1;
            }
        },
        chat(){
            // call on chats route to set this match's chat to active
            // redirect user to chats page
            // console.log("chat button clicked by user ", this.primary_user_id); // debug
            axios.post('/users/chat', {
                match_id: this.match_id
            })
            .then(() => {
                this.redirect('chats');
            })
            .catch((error) => {
                console.error('Error setting active chat:', error);
            });

        },
        unmatch(){
            // call on unmatch route and redirect user to home
            axios.post('/users/unmatch', {
                match_id: this.match_id
            })
            .catch((error) => {
                console.error('Error unmatching users:', error);
            });

            this.redirect('home');
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
            return this.match(); // get match id and match user id
        })
        .then(() => axios.get('/users/user', {
            params: { user_id: this.match_user_id }
            // call on /spotify and /user for match user info
        }))
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

            return axios.get('/users/spotify', {
                params: {
                    user_id: this.match_user_id
                }
            });
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
