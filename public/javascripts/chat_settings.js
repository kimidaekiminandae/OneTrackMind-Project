const tabMappings = { // html pages associated with each tab
    home: ['home', 'about'], // i.e. show home tab as active on these pages
    chat: ['chats', 'active_chat', 'chat_settings', 'new_match'],
    profile: ['profile', 'profile_settings']
};

const { createApp } = Vue;

createApp({
    data(){
        return {
            active_match_id: '',
            primary_user_id: '',
            active_match_user_id: '',
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
            hit_archive: [],
            search_term: '',
            search_id: '',
            suggestions: [],
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
                if (response.data.match){
                    // active match found!
                    this.redirect('new_match'); // /match route will be called again on this page for user id
                }
                else if (response.data.match_user_id){
                    // if match=false but user_id=true, match already exists
                    // route would return match ID in this case
                    this.active_match_id = response.data.match_id;
                    this.active_match_user_id = response.data.match_user_id;
                }
            })
            .catch((err) => {
                console.error(err);
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
        unmatch(){ // unmatch two users
            // call on unmatch route, pass current match ID
            // active chat should become an archived chat
            axios.post('/users/unmatch', {
                match_id: this.active_match_id
            })
            .then((response) => {
                if (!response || !response.data) {
                    console.error('Unexpected response:', response);
                    return;
                }
                if (!response.data){
                    console.log('Unmatch unsuccessful.');
                }
            })
            .catch((error) => {
                console.error('Error unmatching users:', error);
            });
            // redirect user to chat page which shows no active chat, newly archived chat
            this.redirect('chats');
        },
        search(){
            // call on /search
            // console.log('search_id:', this.search_id);
            // console.log('user_id_1:', this.primary_user_id);
            // console.log('user_id_2:', this.active_match_user_id);
            // console.log('match_id:', this.active_match_id);
            axios.post('/users/search', {
                search_term: this.search_term,
                match_id: this.active_match_id,
                search_id: this.search_id,
                search_type: this.search_type,
                user_id_1: this.primary_user_id,
                user_id_2: this.active_match_user_id,
            }) // should automatically update the hit archive in database, which should update page
            .then((response) => {
                if (!response || !response.data) {
                    console.error('Unexpected response:', response);
                    return;
                }
                if (!(response.data)){ // if /search returned false
                    console.log('Search unsuccessful.');
                    return;
                }

                return axios.get('/users/hitarchive', {
                    params: {
                        match_id: this.active_match_id,
                        primary_user: this.primary_user_id,
                        other_user: this.active_match_user_id
                    }
                })
                .then((response) => {
                    if (!response || !response.data) {
                        console.error('Unexpected response:', response);
                        return;
                    }
                    // call on /hitarchive to populate page with previous searches
                    this.hit_archive = response.data;
                })
            })
            .catch((error) => {
                if (error.response && error.response.status === 404) {
                    console.error('No results found:', error.response.data.message);
                    // how to let user know that no results were found?
                    // "search term was not found in either users' top 100 tracks or artists. please try again."
                    alert("Search term was not found in either users' top 100 tracks or artists 💔 Please try again. ");
                } else {
                    console.error('Error completing search of Spotify data:', error);
                }
            });
        },
        async autocomplete(){
            if (this.search_term.length < 2) {
                this.suggestions = [];
                return;
            }

            try {
                const response = await axios.get('https://api.spotify.com/v1/search', {
                    headers: {
                        Authorization: `Bearer ${SPOTIFY_TOKEN}`,
                    },
                    params: {
                        q: this.search_term,
                        type: 'track,artist',
                        limit: 5,
                    },
                });

                const artists = response.data.artists?.items.map(item => ({
                    name: item.name,
                    id: item.id,
                    type: 'artist',
                })) || [];

                const tracks = response.data.tracks?.items.map(item => ({
                    name: item.name + ' – ' + item.artists.map(a => a.name).join(', '),
                    id: item.id,
                    type: 'track',
                })) || [];

                this.suggestions = [...artists, ...tracks];
            } catch (error) {
                console.error('Spotify search failed:', error);
                this.suggestions = [];
            }
        },
        selectSuggestion(suggestion) {
            this.search_term = suggestion.name;
            this.search_id = suggestion.id;
            this.search_type = suggestion.type; // 'artist' or 'track'
            this.suggestions = [];
            console.log('Selected:', suggestion);
        },
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

            return this.match(); // get match's user id
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
            this.age = response.data.age;
            this.location = response.data.location;
            this.user_images = response.data.profile_picture;
            this.total_img_num = this.user_images.length;

            return axios.get('/users/spotify' , {
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
            this.artist_1 = response.data.artists.first;
            this.artist_2 = response.data.artists.second;
            this.artist_3 = response.data.artists.third;
            this.track_1 = response.data.tracks.first;
            this.track_2 = response.data.tracks.second;
            this.track_3 = response.data.tracks.third;

            return axios.get('/users/hitarchive', {
                params: {
                    match_id: this.active_match_id,
                    primary_user: this.primary_user_id,
                    other_user: this.active_match_user_id
                }
            });
        })
        .then((response) => {
            if (!response || !response.data) {
                console.error('Unexpected response:', response);
                return;
            }
            // call on /hitarchive to populate page with previous searches
            console.log(response.data);
            this.hit_archive = response.data;
        })
        .catch((error) => {
            if (error.response && error.response.status === 401) {
                // user not logged in
                window.location.href = '/'; // redirect to login page
            }
            console.error('Error initialising user information:', error);
        });
    }

}).mount('#page');

