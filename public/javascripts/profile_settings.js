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
            sex: '',
            cityName: '',
            cityLat: '',
            cityLng: '',
            user_images: [],
            match_pref: '',
            distance_pref: '',
            age_pref_min: '',
            age_pref_max: '',
            sex_pref: '',
            isDarkMode: localStorage.getItem('darkMode') === 'true'
        };
    },
    computed: {
        num_images() {
            return this.user_images.length;
        }
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
            axios.post('/users/match', {
                user_id: this.primary_user_id
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
            .catch((err) => {
                console.error(err);
            });
        },
        autocomplete_location(){
            const input = this.$refs.autocompleteInput;
            if (!input) return;
            const autocomplete = new google.maps.places.Autocomplete(input);

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();

                if (!place.address_components) return;
                const components = place.address_components;

                const getComponent = (type) => {
                    const match = components.find((c) => c.types.includes(type));
                    return match ? match.short_name : '';
                };

                const suburb = getComponent('locality') || getComponent('sublocality');
                const state = getComponent('administrative_area_level_1');

                this.cityName = `${suburb}, ${state}`;

                if (place.geometry.location){
                    this.cityLat = place.geometry.location.lat();
                    this.cityLng = place.geometry.location.lng();
                }

            });
        },
        addImage(){
            this.$refs.fileInput.click();
            // user clicks to add new image, triggers below method
        },
        fileSelect(event) {
            // opens user's documents, add new file
            const file = event.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('image', file);

            axios.post('/users/uploadimage', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })
            .then((response) => {
                if (response.data.success) {
                    const { imagePath } = response.data;
                    this.user_images.push(imagePath); // Store image src
                } else {
                    console.error('Upload failed:', response.data.message);
                }
            })
            .catch((error) => {
                console.error('Error uploading image:', error);
            });

            this.$refs.fileInput.value = ''; // Clear input
        },
        deleteImg(index){
            // delete that particular image src from user_images using index
            const imagePath = this.user_images[index];

            axios.post('/users/deleteimage', {
                imagePath: imagePath
            })
            .then((response) => {
                if (response.data.success) {
                    this.user_images.splice(index, 1); // Remove from local array
                } else {
                    console.error('Failed to delete image');
                }
            })
            .catch((error) => {
                console.error('Error deleting image:', error);
            });
        },
        save(){
            // should call /updatedetails and pass data
            if (this.nickname === null || this.nickname === '' || !/^[a-zA-Z ]{1,30}$/.test(this.nickname)) { // check for valid nickname
                alert("Nickname must be entered with only contain letters and spaces (max 30 characters)");
                return;
            }

            if (this.age === null || this.age === '' || !Number.isInteger(this.age) || this.age < 18 || this.age > 120) { // check for valid age
                alert("Age must be a whole number between 18 and 120.");
                return;
            }

            if (this.sex === null || this.sex === ''){
                alert("Please select your sex.");
                return;
            }

            if (this.location === null || this.location === '' || this.cityLat === null || this.cityLat === '' || this.cityLng === null || this.cityLng === ''){
                alert("Please select your location.");
                return;
            }

            if (this.num_images === 0){
                alert("Please add at least one profile picture.");
                return;
            }

            if (this.match_pref === null || this.match_pref === ''){
                alert("Please select your match preference.");
                return;
            }

            if (this.sex_pref === null || this.sex_pref === ''){
                alert("Please select your sex preference.");
                return;
            }

            if (this.distance_pref === null || this.distance_pref === '' || this.distance_pref < 1 || this.distance_pref > 500) {
                alert("Distance must be a whole number between 1 and 500.");
                return;
            }

            if (this.age_pref_min === null || this.age_pref_min === '' || !Number.isInteger(this.age_pref_min) || this.age_pref_min < 18 || this.age_pref_min > 99) {
                alert("Minimum age preference must be between 18 and 99.");
                return;
            }

            if (this.age_pref_max === null || this.age_pref_max === '' || !Number.isInteger(this.age_pref_max) || this.age_pref_max < 19 || this.age_pref_max > 120) {
                alert("Maximum age preference must be between 19 and 120.");
                return;
            }

            axios.post('/users/updatedetails', {
                user_id: this.user_id,
                nickname: this.nickname.trim(),
                age: this.age,
                sex: this.sex,
                location: this.cityName,
                cityLat: this.cityLat,
                cityLng: this.cityLng,
                profile_picture: this.user_images,
                match_pref: this.match_pref,
                distance_preference: this.distance_pref,
                age_pref_min: this.age_pref_min,
                age_pref_max: this.age_pref_max,
                sex_pref: this.sex_pref
            })
            .then((response) => {
                if (!response.data || !response.data.success){ // returned false
                    console.log('Error saving user info');
                }
                else {
                    this.redirect('profile');
                }
            })
            .catch((error) => {
                console.error('Error saving user info:', error);
            });
        },
        logOut(){
            // should call /logout route then redirect user to login page
            axios.post('/auth/logout', {
                user_id: this.user_id
            })
            .then((response) => {
                if (!response || !response.data) {
                    console.error('Unexpected response:', response);
                    return;
                }
                if (response.data){ // logout successful
                    this.redirect('');
                }
            })
            .catch((error) => {
                console.error('Error logging user out:', error);
            });
        },
        toggleDarkMode(){
            localStorage.setItem('darkMode', this.isDarkMode);
            // manually modify page!
            if (this.isDarkMode){
                // darkmode
                const page = document.getElementById('page');
                if (page) page.classList.add('darkmode');
            } else {
                const page = document.getElementById('page');
                if (page && page.classList.contains('darkmode')) page.classList.remove('darkmode');
            }

            console.log("Is dark mode: ", this.isDarkMode); // debug
        }
    },
    mounted(){
        if (this.isDarkMode) {
            // darkmode
            const page = document.getElementById('page');
            if (page) page.classList.add('darkmode');
        } else {
            const page = document.getElementById('page');
            if (page && page.classList.contains('darkmode')) page.classList.remove('darkmode');
        }
        console.log("Is dark mode: ", this.isDarkMode); // debug
        // get primary user id
        axios.get('/auth/getuserid')
        .then((response) => {
            if (!response || !response.data) {
                console.error('Unexpected response:', response);
                return;
            }

            this.user_id = response.data.user_id;

            this.match(); // check for active matches, should appear on every page mount

            // get user's info and preferences to display, call /users/user
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
            this.sex = response.data.sex;
            this.cityName = response.data.location;
            this.cityLat = response.data.city_lat;
            this.cityLng = response.data.city_lng;
            this.user_images = response.data.profile_picture;
            this.match_pref = response.data.match_pref;
            this.distance_pref = response.data.distance_preference;
            this.age_pref_min = response.data.age_pref_min;
            this.age_pref_max = response.data.age_pref_max;
            this.sex_pref = response.data.sex_pref;
        })
        .catch((error) => {
            if (error.response && error.response.status === 401) {
                // user not logged in
                window.location.href = '/'; // redirect to login page
            }
            console.error('Error initialising user details:', error);
        });

        const checkGoogleLoaded = setInterval(() => { // wait for google api to load before calling
            if (window.google && window.google.maps && window.google.maps.places) {
              clearInterval(checkGoogleLoaded);
              this.autocomplete_location();
            }
          }, 100);
    }
}).mount('#page');
