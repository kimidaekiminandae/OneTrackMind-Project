const tabMappings = { // html pages associated with each tab
    home: ['home', 'about'], // i.e. show home tab as active on these pages
    chat: ['chats', 'active_chat', 'chat_settings', 'new_match'],
    profile: ['profile', 'profile_settings']
};

const socket = io(); // connects to socket.io server
const { createApp } = Vue;

createApp({
    data(){
        return {
            primary_user_id: '',
            active_match_id: '',
            active_match_user_id: '',
            profile_picture: '',
            nickname: '',
            chat_messages: [],
            message_text: '',
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

                // console.log(response.data); // debug

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
                    // console.log("Match's user ID: ", this.active_match_user_id, "Match ID: ", this.active_match_id); // debug
                }
            })
            .catch((err) => {
                if (err.response && err.response.status === 401) {
                    window.location.href = '/login';
                }
                console.error(err);
            });
        },
        send(){ // send chat message, attach timestamp and primary user ID
            // call on /sendchat route, {text: “...”, timestamp: “...”, sender: “...user ID…”}
            const msg = {
                text: this.message_text,
                timestamp: new Date().toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                    }),
                sender: this.primary_user_id,
                match_id: this.active_match_id
            };

            // send via Socket.IO
            socket.emit('chat message', msg);

            axios.post('/users/sendchat', msg)
                .then(() => {
                    axios.get('/users/activechat', {
                    params: {
                        match_id: this.active_match_id
                    }}
                    )
                    .then((response) => {
                        if (!response || !response.data) {
                        console.error('Unexpected response:', response);
                        return;
                        }
                        this.chat_messages = response.data.messages;
                        this.scrollToBottom();
                    });
                })
                .catch((err) => console.error('DB Save Failed', err));

            // this.chat_messages.push(msg);
            this.message_text = '';
        },
        scrollToBottom(){
            this.$nextTick(() => {
                const el = this.$refs.bottom;
                if (el && typeof el.scrollIntoView === 'function') {
                    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
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

            // console.log(response.data.messages);
            this.chat_messages = response.data.messages;

            this.scrollToBottom();

            // listen for incoming live messages
            socket.on('chat message', (msg) => {
                // only show if it's from this chat
                if (msg.match_id === this.active_match_id) {
                    this.chat_messages.push(msg);
                    this.scrollToBottom();
                }
            });
        })
        .catch((error) => {
            if (error.response && error.response.status === 401) {
                // user not logged in
                window.location.href = '/'; // redirect to login page
            }
            console.error('Error initialising chat details:', error);
        });

    }
}).mount('#page');

