let usersData = [];

const messageContainer = document.getElementById('message-container');
const errorContainer = document.getElementById('error-container');
const loadingIndicator = document.getElementById('loading-indicator');
const usersGrid = document.getElementById('users-grid');

function showMessage(msg, isError = false) {
    const container = isError ? errorContainer : messageContainer;
    const otherContainer = isError ? messageContainer : errorContainer;

    container.textContent = msg;
    container.classList.remove('hidden');
    container.classList.add('animate-bounce-in');

    otherContainer.classList.add('hidden');

    setTimeout(() => {
        container.classList.add('hidden');
        container.classList.remove('animate-bounce-in');
    }, 3000);
}

function renderUsers() {
    if (usersData.length === 0) {
        usersGrid.innerHTML = '<div class="col-span-full text-center text-xl text-gray-600">No users found in the database.</div>';
    } else {
        usersGrid.innerHTML = usersData.map((user) => `
            <div class="user-card ${user.is_blocked ? 'blocked-user' : ''}">
                <div class="user-card-content">
                    <img
                        src="${user.user_image}"
                        alt="${user.nickname}'s profile"
                        class="profile-picture"
                        onerror="this.onerror=null;this.src='https://placehold.co/150x150/cccccc/000000?text=Error';"
                    />
                    <h2 class="user-name">${user.nickname || 'N/A'}</h2>
                    <p class="user-id-text">User ID: ${user.user_id}</p>
                    <p class="user-spotify-info">
                        Top Artist: <span class="spotify-highlight">${user.top_artist || 'N/A'}</span>
                        <br />
                        Top Track: <span class="spotify-highlight">${user.top_track || 'N/A'}</span>
                    </p>

                    <div class="matches-section">
                        <h3 class="matches-title">Current Matches:</h3>
                        ${user.matches && user.matches.length > 0 ? `
                            <ul class="matches-list">
                                ${user.matches.map((match) => `
                                    <li>${match.nickname || 'Unknown'} (${match.user_id})</li>
                                `).join('')}
                            </ul>
                        ` : '<p class="no-matches-text">No current matches.</p>'}
                    </div>

                    ${user.has_vulgar_content ? `
                        <div class="vulgar-content-warning">
                            <p>⚠️ Potential Vulgar Content Detected!</p>
                        </div>
                    ` : ''}

                    <div class="admin-actions">
                        <button
                            onclick="handleBlockUser(${user.user_id}, ${user.is_blocked})"
                            class="action-button ${user.is_blocked ? 'unblock-button' : 'block-button'}"
                        >
                            ${user.is_blocked ? 'Unblock User' : 'Block User'}
                        </button>
                        <button
                            onclick="handleDeletePicture(${user.user_id})"
                            class="action-button delete-button"
                        >
                            Delete Picture
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    loadingIndicator.classList.add('hidden');
    usersGrid.classList.remove('hidden');
}

async function fetchUsers() {
    loadingIndicator.classList.remove('hidden');
    usersGrid.classList.add('hidden');
    try {
        const response = await fetch('/admin/users');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        usersData = data;
        // console.log("backend user data", usersData); // debug
        renderUsers();
    } catch (err) {
        console.error("Error fetching users:", err); // debug
        showMessage(`Failed to load users: ${err.message}`, true);
        loadingIndicator.classList.add('hidden');
        usersGrid.classList.remove('hidden');
    }
}

window.handleBlockUser = async (userId, currentBlockedStatus) => {
    try {
        const response = await fetch(`/admin/users/${userId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_blocked: !currentBlockedStatus }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();

        if (result.success) {
            showMessage(`User ${userId} has been ${!currentBlockedStatus ? 'blocked' : 'unblocked'}.`);
            usersData = usersData.map((user) =>
                (user.user_id === userId ? { ...user, is_blocked: !currentBlockedStatus } : user)
            );
            renderUsers();
        } else {
            showMessage(`Failed to update block status for user ${userId}: ${result.message}`, true);
        }
    } catch (err) {
        // console.error("Error blocking user:", err);
        showMessage(`Failed to communicate with server to block user: ${err.message}`, true);
    }
};

window.handleDeletePicture = async (userId) => {
    try {
        const response = await fetch(`/admin/users/${userId}/profile-picture`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();

        if (result.success) {
            showMessage(`Profile picture for user ${userId} has been deleted.`);
            usersData = usersData.map((user) =>
                (user.user_id === userId ? { ...user, profile_picture: null } : user)
            );
            renderUsers();
        } else {
            showMessage(`Failed to delete picture for user ${userId}: ${result.message}`, true);
        }
    } catch (err) {
        // console.error("Error deleting picture:", err);
        showMessage(`Failed to communicate with server to delete picture: ${err.message}`, true);
    }
};

document.addEventListener('DOMContentLoaded', fetchUsers);
