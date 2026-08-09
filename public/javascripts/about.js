/* required on every vue .js file */
const tabMappings = { // html pages associated with each tab
    home: ['home', 'about'], // i.e. show home tab as active on these pages
    chat: ['chats', 'active_chat', 'chat_settings', 'new_match'],
    profile: ['profile', 'profile_settings']
};

const { createApp } = Vue;

createApp({
    data() {
        return {
            user_id: '',
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
                    this.redirect('/users/new_match'); // /match route will be called again on this page for user id
                }
            })
            .catch((err) => {
                console.error(err);
            });
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

                this.user_id = response.data.user_id;
                console.log("User ID: ", this.user_id);

                this.match(); // check for active matches, should appear on every page load
            })
            .catch((error) => {
                if (error.response && error.response.status === 401) {
                    // user not logged in
                    window.location.href = '/'; // redirect to login page
                }
                console.error('Error getting user ID:', error);
            });
        }
    }
}).mount('#page');
