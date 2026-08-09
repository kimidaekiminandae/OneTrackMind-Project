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
            user_id: '',
            nickname: '',
            age: '',
            location: '',
            user_images: [],
            current_img_num: '1',
            total_img_num: '',
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
        next_img(){
            // when user clicks on recommended user's image, should increment current img number
            // or if current img number = total img number, should set current img number back to 1
            if (this.current_img_num < this.total_img_num){
                this.current_img_num++;
            } else {
                this.current_img_num = 1;
            }
        },
        match(){ // should be present on all pages to be called once mounted!
            // check for active match, redirect user to new_match page if there is one
            axios.get('/users/match', {
                params: {
                    user_id: this.user_id
                }
            })
            .then((response) => {
                if (!response || !response.data) {
                    console.error('Unexpected response:', response);
                    return;
                }

                if (response.data.match){
                    // active match found!
                    this.redirect('new_match'); // /match route will be called again on this page for user id
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
        console.log("local storage dark mode: ", localStorage.getItem('darkMode'), "vue is dark mode: ", this.isDarkMode); // debug
        // get primary user id
        axios.get('/auth/getuserid')
        .then((response) => {
            if (!response || !response.data) {
                console.error('Unexpected response:', response);
                return;
            }

            this.user_id = response.data.user_id;
            console.log("User ID: ", this.user_id);

            this.match(); // check for active matches, should appear on every page load

            // fetch user and spotify info
            return axios.get('/users/user', {
                params: {
                    user_id: this.user_id
                }
            });
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

            return axios.get('/users/spotify', {
                params: {
                    user_id: this.user_id
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
            console.error('Error initialising user info:', error);
        });
    }

}).mount('#page');
