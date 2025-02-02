// Global session data.
let sessionData = { loggedIn: false, campus: null };

// Update the UI based on user session data.
function updateUI(data) {
    sessionData = data;

    const campusIndicator = document.getElementById('campusIndicator');
    const navForm = document.getElementById('navForm');
    const navResults = document.getElementById('navResults');
    const startEvaluationBtn = document.getElementById('startEvaluationBtn');

    // Update campus indicator.
    if (campusIndicator) {
        if (data.loggedIn === true) {
            campusIndicator.textContent = '- ' + data.campus;
        } else {
            campusIndicator.textContent = '';
        }
    }

    // Update nav links status (enable or disable).
    if (navForm && navResults) {
        if (data.loggedIn === true) {
            navForm.classList.remove('disabled');
            navResults.classList.remove('disabled');
        } else {
            navForm.classList.add('disabled');
            navResults.classList.add('disabled');
        }
    }

    // Update start evaluation button text and action.
    if (startEvaluationBtn) {
        if (data.loggedIn === true) {
            startEvaluationBtn.textContent = 'Start evaluation';
            startEvaluationBtn.onclick = () => {
                window.location.href = './form.html';
            };
        } else {
            startEvaluationBtn.textContent = 'Login to evaluate'
            startEvaluationBtn.onclick = () => {
                window.location.href = './dashboard.html';
            };
        }
    }
}

// Check session on page load.
document.addEventListener('DOMContentLoaded', async () => {
    try {
        updateUI(sessionData);
    } catch (error) {
        console.log('Error checking session status:', error);
        updateUI({ loggedIn: false, campus: null });
    }
})

// Make the function globally available.
window.updateUI = updateUI;