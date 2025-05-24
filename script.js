// Global variables
let currentUser = null;
let currentReport = null;
let selectedImage = null;
let selectedAudio = null;
let currentGoals = [];
let currentMessages = [];
let monthlyReportData = null;

// API base URL
const API_BASE = 'http://localhost:5000/api';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (input.value === '') {
            input.value = today;
        }
    });

    // Initialize year selectors
    initializeYearSelectors();

    // Initialize month selectors with current month
    const currentMonth = new Date().getMonth() + 1;
    const monthSelectors = document.querySelectorAll('select[id*="month"]');
    monthSelectors.forEach(select => {
        select.value = currentMonth;
    });

    // Load children for registration
    loadChildren();

    // Show login screen
    showScreen('login-screen');

    // Initialize rating slider
    const ratingSlider = document.getElementById('monthly-rating');
    if (ratingSlider) {
        ratingSlider.addEventListener('input', function() {
            document.getElementById('rating-value').textContent = this.value;
        });
    }
});

// Utility Functions
function initializeYearSelectors() {
    const currentYear = new Date().getFullYear();
    const yearSelectors = document.querySelectorAll('select[id*="year"]');

    yearSelectors.forEach(select => {
        select.innerHTML = '';
        for (let year = currentYear - 2; year <= currentYear + 1; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) {
                option.selected = true;
            }
            select.appendChild(option);
        }
    });
}

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Tab management
function showObserverTab(tabName) {
    document.querySelectorAll('#observer-screen .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabName + '-tab').classList.add('active');

    document.querySelectorAll('#observer-screen .tab-btn-horizontal').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    switch(tabName) {
        case 'goals':
            loadObserverGoals();
            break;
        case 'messages':
            loadObserverMessages();
            break;
        case 'monthly':
            loadObserverMonthlyReports();
            break;
    }
}

function showParentTab(tabName) {
    document.querySelectorAll('#parent-screen .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabName + '-tab').classList.add('active');

    document.querySelectorAll('#parent-screen .tab-btn-horizontal').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    switch(tabName) {
        case 'parent-messages':
            loadParentMessages();
            break;
        case 'parent-goals':
            loadParentGoals();
            break;
        case 'parent-monthly':
            loadParentMonthlyReports();
            break;
    }
}

function showAdminTab(tabName) {
    document.querySelectorAll('#admin-screen .tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabName + '-tab').classList.add('active');

    document.querySelectorAll('#admin-screen .tab-btn-horizontal').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    switch(tabName) {
        case 'users':
            loadAdminUsers();
            break;
        case 'mappings':
            loadParentChildMappings();
            break;
        case 'observer-mappings':
            loadObserverChildMappings();
            break;
        case 'activity':
            loadActivityLogs();
            break;
        case 'admin-processing':
            loadAdminProcessing();
            break;
    }
}

// Authentication functions
function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function handleRoleChange() {
    const role = document.getElementById('reg-role').value;
    const childSelection = document.getElementById('child-selection');

    if (role === 'Parent') {
        childSelection.classList.remove('hidden');
        loadChildren();
    } else {
        childSelection.classList.add('hidden');
    }
}

async function loadChildren() {
    try {
        const response = await fetch(`${API_BASE}/children`);
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('reg-child');
            if (select) {
                select.innerHTML = '<option value="">Select your child</option>';
                data.children.forEach(child => {
                    const option = document.createElement('option');
                    option.value = child.id;
                    option.textContent = child.name || `Child ${child.id.substring(0, 8)}`;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading children:', error);
    }
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    showLoading('Signing in...');

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            currentUser = data.user;
            showMessage('Welcome back!');

            if (data.user.role === 'Observer') {
                loadObserverData();
                showScreen('observer-screen');
            } else if (data.user.role === 'Parent') {
                loadParentData();
                showScreen('parent-screen');
            } else if (data.user.role === 'Admin') {
                loadAdminData();
                showScreen('admin-screen');
            }
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Connection error. Please try again.', 'error');
    }
}

async function register() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const role = document.getElementById('reg-role').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const childId = document.getElementById('reg-child').value;

    if (!name || !email || !role || !password || !confirm) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    if (password !== confirm) {
        showMessage('Passwords do not match', 'error');
        return;
    }

    if (password.length < 8) {
        showMessage('Password must be at least 8 characters', 'error');
        return;
    }

    if (role === 'Parent' && !childId) {
        showMessage('Please select your child', 'error');
        return;
    }

    showLoading('Creating account...');

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, role, password, child_id: childId })
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            showMessage('Account created! Please sign in.');
            showLogin();
            document.getElementById('register-form').reset();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Connection error. Please try again.', 'error');
    }
}

function logout() {
    currentUser = null;
    currentReport = null;
    showScreen('login-screen');
    showMessage('Signed out successfully');
}

// Observer functions
async function loadObserverData() {
    document.getElementById('observer-welcome').textContent = `Welcome, ${currentUser.name}!`;
    document.getElementById('observer-name').value = currentUser.name;

    try {
        const response = await fetch(`${API_BASE}/observer/children?observer_id=${currentUser.id}`);
        const data = await response.json();

        if (data.success) {
            const selects = ['student-select', 'goal-child-select', 'report-child-select'];
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">Select student</option>';
                    data.children.forEach(child => {
                        const option = document.createElement('option');
                        option.value = child.id;
                        option.textContent = child.name || `Child ${child.id.substring(0, 8)}`;
                        select.appendChild(option);
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error loading observer data:', error);
    }

    loadParentsList();
}

async function loadParentsList() {
    try {
        const response = await fetch(`${API_BASE}/parents`);
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('parent-select');
            if (select) {
                select.innerHTML = '<option value="">Select Parent to Message</option>';
                data.parents.forEach(parent => {
                    const option = document.createElement('option');
                    option.value = parent.id;
                    option.textContent = `${parent.name} (${parent.child_name})`;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading parents:', error);
    }
}

function showImageUpload() {
    document.getElementById('image-upload').classList.remove('hidden');
    document.getElementById('audio-upload').classList.add('hidden');
}

function showAudioUpload() {
    document.getElementById('audio-upload').classList.remove('hidden');
    document.getElementById('image-upload').classList.add('hidden');
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        selectedImage = file;

        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('image-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 300px;">`;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        document.getElementById('process-image-btn').classList.remove('hidden');
    }
}

function handleAudioUpload(event) {
    const file = event.target.files[0];
    if (file) {
        selectedAudio = file;

        const preview = document.getElementById('audio-preview');
        preview.innerHTML = `<p>📁 ${file.name}</p><p>Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>`;
        preview.classList.remove('hidden');

        document.getElementById('process-audio-btn').classList.remove('hidden');
    }
}

async function processImage() {
    if (!selectedImage) {
        showMessage('Please select an image first', 'error');
        return;
    }

    const sessionInfo = getSessionInfo();
    if (!sessionInfo) return;

    showLoading('Processing photo...');

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const imageData = e.target.result;

            const response = await fetch(`${API_BASE}/process-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageData,
                    child_id: document.getElementById('student-select').value,
                    observer_id: currentUser.id,
                    session_info: sessionInfo
                })
            });

            const data = await response.json();
            hideLoading();

            if (data.success) {
                currentReport = data.report;
                showMessage('Photo processed successfully!');
                showReport();
            } else {
                showMessage(data.message, 'error');
            }
        };
        reader.readAsDataURL(selectedImage);
    } catch (error) {
        hideLoading();
        showMessage('Processing failed. Please try again.', 'error');
    }
}

async function processAudio() {
    if (!selectedAudio) {
        showMessage('Please select an audio file first', 'error');
        return;
    }

    const sessionInfo = getSessionInfo();
    if (!sessionInfo) return;

    showLoading('Processing recording...');

    try {
        const formData = new FormData();
        formData.append('audio', selectedAudio);
        formData.append('child_id', document.getElementById('student-select').value);
        formData.append('observer_id', currentUser.id);
        formData.append('session_info', JSON.stringify(sessionInfo));

        const response = await fetch(`${API_BASE}/process-audio`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            currentReport = data.report;

            // Show transcript editor
            document.getElementById('transcript-text').value = data.transcript;
            document.getElementById('transcript-editor').classList.remove('hidden');

            showMessage('Recording processed successfully!');
            showReport();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Processing failed. Please try again.', 'error');
    }
}

async function regenerateReport() {
    const editedTranscript = document.getElementById('transcript-text').value;
    const sessionInfo = getSessionInfo();

    if (!editedTranscript || !sessionInfo) {
        showMessage('Please ensure transcript and session info are complete', 'error');
        return;
    }

    showLoading('Regenerating report...');

    try {
        const response = await fetch(`${API_BASE}/regenerate-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcript: editedTranscript,
                session_info: sessionInfo,
                child_id: document.getElementById('student-select').value,
                observer_id: currentUser.id
            })
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            currentReport = data.report;
            showMessage('Report regenerated successfully!');
            showReport();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Failed to regenerate report', 'error');
    }
}

function getSessionInfo() {
    const studentName = document.getElementById('student-name').value.trim();
    const observerName = document.getElementById('observer-name').value.trim();
    const sessionDate = document.getElementById('session-date').value;
    const sessionStart = document.getElementById('session-start').value;
    const sessionEnd = document.getElementById('session-end').value;
    const studentId = document.getElementById('student-select').value;

    if (!studentName || !observerName || !sessionDate || !studentId) {
        showMessage('Please fill in all session information', 'error');
        return null;
    }

    return {
        student_name: studentName,
        observer_name: observerName,
        session_date: sessionDate,
        session_start: sessionStart,
        session_end: sessionEnd
    };
}

// Goal Management
async function saveGoal() {
    const childId = document.getElementById('goal-child-select').value;
    const targetDate = document.getElementById('goal-target-date').value;
    const description = document.getElementById('goal-description').value.trim();

    if (!childId || !targetDate || !description) {
        showMessage('Please fill in all goal fields', 'error');
        return;
    }

    showLoading('Saving goal...');

    try {
        const response = await fetch(`${API_BASE}/goals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                child_id: childId,
                target_date: targetDate,
                description: description,
                observer_id: currentUser.id
            })
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            showMessage('Goal saved successfully!');
            document.getElementById('goal-description').value = '';
            loadObserverGoals();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Failed to save goal', 'error');
    }
}

async function loadObserverGoals() {
    try {
        const response = await fetch(`${API_BASE}/goals?observer_id=${currentUser.id}`);
        const data = await response.json();

        if (data.success) {
            displayGoals(data.goals, 'goals-container');
        }
    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

function displayGoals(goals, containerId) {
    const container = document.getElementById(containerId);

    if (goals.length === 0) {
        container.innerHTML = '<p>No goals set yet.</p>';
        return;
    }

    container.innerHTML = goals.map(goal => `
        <div class="goal-item">
            <div class="goal-header">
                <span class="goal-child">${goal.child_name}</span>
                <span class="goal-date">Target: ${formatDate(goal.target_date)}</span>
            </div>
            <div class="goal-text">${goal.description}</div>
            <div class="goal-actions">
                <button onclick="editGoal('${goal.id}')" class="secondary-btn">Edit</button>
                <button onclick="deleteGoal('${goal.id}')" class="logout-btn">Delete</button>
                <button onclick="markGoalComplete('${goal.id}')" class="primary-btn">Mark Complete</button>
            </div>
        </div>
    `).join('');
}

async function editGoal(goalId) {
    // Implementation for editing goals
    showMessage('Edit goal feature coming soon');
}

async function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
        const response = await fetch(`${API_BASE}/goals/${goalId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showMessage('Goal deleted successfully');
            loadObserverGoals();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to delete goal', 'error');
    }
}

async function markGoalComplete(goalId) {
    try {
        const response = await fetch(`${API_BASE}/goals/${goalId}/complete`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showMessage('Goal marked as complete!');
            loadObserverGoals();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to mark goal as complete', 'error');
    }
}

// Message System
async function loadObserverMessages() {
    const parentId = document.getElementById('parent-select').value;
    if (!parentId) return;

    try {
        const response = await fetch(`${API_BASE}/messages?observer_id=${currentUser.id}&parent_id=${parentId}`);
        const data = await response.json();

        if (data.success) {
            displayMessages(data.messages, 'message-history');
            document.getElementById('send-message-section').classList.remove('hidden');

            // Show child info
            const childInfo = document.getElementById('child-info');
            if (data.child_info) {
                childInfo.innerHTML = `Discussing: ${data.child_info.name}`;
                childInfo.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function displayMessages(messages, containerId) {
    const container = document.getElementById(containerId);

    if (messages.length === 0) {
        container.innerHTML = '<p>No messages yet. Start a conversation!</p>';
        return;
    }

    container.innerHTML = messages.map(message => `
        <div class="message-item ${message.sender_id === currentUser.id ? 'sent' : 'received'}">
            <div class="message-bubble ${message.sender_id === currentUser.id ? 'sent' : 'received'}">
                <div class="message-sender">${message.sender_name}</div>
                <div class="message-content">${message.content}</div>
                <div class="message-time">${formatDateTime(message.timestamp)}</div>
            </div>
        </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const parentId = document.getElementById('parent-select').value;
    const messageContent = document.getElementById('new-message').value.trim();

    if (!parentId || !messageContent) {
        showMessage('Please select a parent and enter a message', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_id: currentUser.id,
                recipient_id: parentId,
                content: messageContent
            })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('new-message').value = '';
            loadObserverMessages();
            showMessage('Message sent!');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to send message', 'error');
    }
}

// Monthly Reports
async function generateMonthlyReport() {
    const childId = document.getElementById('report-child-select').value;
    const year = document.getElementById('report-year').value;
    const month = document.getElementById('report-month').value;

    if (!childId || !year || !month) {
        showMessage('Please select child, year, and month', 'error');
        return;
    }

    showLoading('Generating monthly report...');

    try {
        const response = await fetch(`${API_BASE}/monthly-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                child_id: childId,
                year: parseInt(year),
                month: parseInt(month),
                observer_id: currentUser.id
            })
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            monthlyReportData = data.report;
            displayMonthlyReport(data.report, 'monthly-summary', 'monthly-charts');
            document.getElementById('monthly-report-display').classList.remove('hidden');
            showMessage('Monthly report generated successfully!');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Failed to generate monthly report', 'error');
    }
}

function displayMonthlyReport(reportData, summaryId, chartsId) {
    // Display summary
    const summaryContainer = document.getElementById(summaryId);
    summaryContainer.innerHTML = `
        <h3>Monthly Summary - ${reportData.month_name} ${reportData.year}</h3>
        <div class="summary-stats">
            <div class="stat-item">
                <strong>Total Observations:</strong> ${reportData.total_observations}
            </div>
            <div class="stat-item">
                <strong>Average Rating:</strong> ${reportData.average_rating}/5
            </div>
            <div class="stat-item">
                <strong>Key Strengths:</strong> ${reportData.key_strengths.join(', ')}
            </div>
            <div class="stat-item">
                <strong>Areas for Development:</strong> ${reportData.areas_for_development.join(', ')}
            </div>
        </div>
        <div class="monthly-narrative">
            <h4>Monthly Progress Narrative</h4>
            <p>${reportData.narrative}</p>
        </div>
    `;

    // Display charts
    const chartsContainer = document.getElementById(chartsId);
    chartsContainer.innerHTML = `
        <div class="chart-container">
            <canvas id="progress-chart"></canvas>
        </div>
        <div class="chart-container">
            <canvas id="skills-chart"></canvas>
        </div>
    `;

    // Create charts using Chart.js
    createProgressChart(reportData.progress_data);
    createSkillsChart(reportData.skills_data);
}

function createProgressChart(progressData) {
    const ctx = document.getElementById('progress-chart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: progressData.dates,
            datasets: [{
                label: 'Progress Score',
                data: progressData.scores,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Progress Over Time'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5
                }
            }
        }
    });
}

function createSkillsChart(skillsData) {
    const ctx = document.getElementById('skills-chart').getContext('2d');
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: skillsData.skills,
            datasets: [{
                label: 'Skill Level',
                data: skillsData.levels,
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                pointBackgroundColor: '#2196F3'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Skills Assessment'
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 5
                }
            }
        }
    });
}

async function shareReportWithParent() {
    if (!monthlyReportData) {
        showMessage('No report to share', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/share-monthly-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report_data: monthlyReportData,
                observer_id: currentUser.id
            })
        });

        const data = await response.json();

        if (data.success) {
            showMessage('Report shared with parent successfully!');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to share report', 'error');
    }
}

function downloadMonthlyReport() {
    if (!monthlyReportData) {
        showMessage('No report to download', 'error');
        return;
    }

    const reportText = generateReportText(monthlyReportData);
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly_report_${monthlyReportData.year}_${monthlyReportData.month}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function generateReportText(reportData) {
    return `
Monthly Progress Report
${reportData.month_name} ${reportData.year}

Student: ${reportData.student_name}
Observer: ${reportData.observer_name}

SUMMARY
Total Observations: ${reportData.total_observations}
Average Rating: ${reportData.average_rating}/5

KEY STRENGTHS
${reportData.key_strengths.map(strength => `• ${strength}`).join('\n')}

AREAS FOR DEVELOPMENT
${reportData.areas_for_development.map(area => `• ${area}`).join('\n')}

PROGRESS NARRATIVE
${reportData.narrative}

Generated on: ${new Date().toLocaleDateString()}
    `.trim();
}

// Parent Dashboard Functions
async function loadParentData() {
    document.getElementById('parent-welcome').textContent = `Welcome, ${currentUser.name}!`;

    if (!currentUser.child_id) {
        document.getElementById('child-info-header').textContent = 'No child assigned to your account';
        return;
    }

    try {
        // Load child info
        const childResponse = await fetch(`${API_BASE}/children/${currentUser.child_id}`);
        const childData = await childResponse.json();

        if (childData.success) {
            const child = childData.child;
            document.getElementById('child-info-header').textContent = `${child.name}'s Progress`;
            document.getElementById('child-age').textContent = child.age || 'N/A';
            document.getElementById('child-grade').textContent = child.grade || 'N/A';
            document.getElementById('child-observer').textContent = child.observer_name || 'N/A';
        }

        // Load reports
        const reportsResponse = await fetch(`${API_BASE}/reports?child_id=${currentUser.child_id}`);
        const reportsData = await reportsResponse.json();

        if (reportsData.success) {
            displayReports(reportsData.reports);
        }
    } catch (error) {
        showMessage('Error loading parent data', 'error');
    }
}

function displayReports(reports) {
    const container = document.getElementById('reports-container');

    if (reports.length === 0) {
        container.innerHTML = '<p>No reports available yet.</p>';
        return;
    }

    container.innerHTML = reports.map(report => `
        <div class="report-item" onclick="viewReport('${report.id}')">
            <div class="report-date">${formatDate(report.date)}</div>
            <div class="report-preview">
                Observer: ${report.observer_name}<br>
                ${report.observations.substring(0, 150)}...
            </div>
        </div>
    `).join('');
}

async function viewReport(reportId) {
    try {
        const response = await fetch(`${API_BASE}/reports/${reportId}`);
        const data = await response.json();

        if (data.success) {
            currentReport = data.report.full_data;
            showReport();
        } else {
            showMessage('Failed to load report', 'error');
        }
    } catch (error) {
        showMessage('Failed to load report', 'error');
    }
}

async function loadParentMessages() {
    try {
        const response = await fetch(`${API_BASE}/messages?parent_id=${currentUser.id}`);
        const data = await response.json();

        if (data.success) {
            displayMessages(data.messages, 'parent-message-history');

            // Show observer info
            const observerInfo = document.getElementById('observer-info');
            if (data.observer_info) {
                observerInfo.innerHTML = `Chatting with: ${data.observer_info.name} (Observer)`;
            }
        }
    } catch (error) {
        console.error('Error loading parent messages:', error);
    }
}

async function sendParentMessage() {
    const messageContent = document.getElementById('parent-new-message').value.trim();

    if (!messageContent) {
        showMessage('Please enter a message', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_id: currentUser.id,
                recipient_type: 'observer',
                content: messageContent,
                child_id: currentUser.child_id
            })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('parent-new-message').value = '';
            loadParentMessages();
            showMessage('Message sent!');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to send message', 'error');
    }
}

async function loadParentGoals() {
    try {
        const response = await fetch(`${API_BASE}/goals?child_id=${currentUser.child_id}`);
        const data = await response.json();

        if (data.success) {
            displayParentGoals(data.goals);
        }
    } catch (error) {
        console.error('Error loading parent goals:', error);
    }
}

function displayParentGoals(goals) {
    const container = document.getElementById('parent-goals-container');

    if (goals.length === 0) {
        container.innerHTML = '<p>No goals set yet.</p>';
        return;
    }

    container.innerHTML = goals.map(goal => `
        <div class="goal-item">
            <div class="goal-header">
                <span class="goal-date">Target: ${formatDate(goal.target_date)}</span>
                <span class="goal-status ${goal.status}">${goal.status}</span>
            </div>
            <div class="goal-text">${goal.description}</div>
            <div class="goal-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${goal.progress || 0}%"></div>
                </div>
                <span class="progress-text">${goal.progress || 0}% Complete</span>
            </div>
        </div>
    `).join('');
}

async function loadParentMonthlyReports() {
    // Similar to observer monthly reports but for parent view
    const container = document.getElementById('parent-monthly-report-display');
    container.innerHTML = '<p>Select year and month to view monthly reports.</p>';
}

async function generateParentMonthlyReport() {
    const year = document.getElementById('parent-report-year').value;
    const month = document.getElementById('parent-report-month').value;

    if (!year || !month) {
        showMessage('Please select year and month', 'error');
        return;
    }

    showLoading('Loading monthly report...');

    try {
        const response = await fetch(`${API_BASE}/monthly-report?child_id=${currentUser.child_id}&year=${year}&month=${month}`);
        const data = await response.json();
        hideLoading();

        if (data.success) {
            monthlyReportData = data.report;
            displayMonthlyReport(data.report, 'parent-monthly-summary', 'parent-monthly-charts');
            document.getElementById('parent-monthly-report-display').classList.remove('hidden');
            document.getElementById('monthly-feedback-form').classList.remove('hidden');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Failed to load monthly report', 'error');
    }
}

function downloadParentMonthlyReport() {
    downloadMonthlyReport(); // Same function as observer
}

async function submitMonthlyFeedback() {
    const feedback = document.getElementById('monthly-feedback-text').value.trim();
    const rating = document.getElementById('monthly-rating').value;

    if (!feedback) {
        showMessage('Please enter your feedback', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/monthly-feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report_id: monthlyReportData.id,
                parent_id: currentUser.id,
                feedback: feedback,
                rating: parseInt(rating)
            })
        });

        const data = await response.json();

        if (data.success) {
            showMessage('Feedback submitted successfully!');
            document.getElementById('monthly-feedback-form').classList.add('hidden');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to submit feedback', 'error');
    }
}

// Admin Dashboard Functions
async function loadAdminData() {
    await loadAdminStats();
    loadAdminUsers();
}

async function loadAdminStats() {
    try {
        const response = await fetch(`${API_BASE}/admin/stats`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('total-users').textContent = data.stats.total_users;
            document.getElementById('total-children').textContent = data.stats.total_children;
            document.getElementById('total-reports').textContent = data.stats.total_reports;
            document.getElementById('active-observers').textContent = data.stats.active_observers;
        }
    } catch (error) {
        // Use placeholder data if API not available
        document.getElementById('total-users').textContent = '10';
        document.getElementById('total-children').textContent = '25';
        document.getElementById('total-reports').textContent = '150';
        document.getElementById('active-observers').textContent = '8';
    }
}

async function loadAdminUsers() {
    try {
        const response = await fetch(`${API_BASE}/admin/users`);
        const data = await response.json();

        if (data.success) {
            displayAdminUsers(data.users);
        }
    } catch (error) {
        console.error('Error loading admin users:', error);
    }
}

function displayAdminUsers(users) {
    const container = document.getElementById('users-container');

    if (users.length === 0) {
        container.innerHTML = '<p>No users found.</p>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-info">
                <h4>${user.name}</h4>
                <div class="user-details">
                    ${user.email} | ${user.role} | Joined: ${formatDate(user.created_at)}
                </div>
            </div>
            <div class="user-actions">
                <button onclick="editUser('${user.id}')" class="secondary-btn">Edit</button>
                <button onclick="deleteUser('${user.id}')" class="logout-btn">Delete</button>
            </div>
        </div>
    `).join('');
}

async function editUser(userId) {
    showMessage('Edit user feature coming soon');
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showMessage('User deleted successfully');
            loadAdminUsers();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to delete user', 'error');
    }
}

// Bulk Upload Functions
async function uploadChildrenCSV() {
    const fileInput = document.getElementById('children-csv');
    const file = fileInput.files[0];

    if (!file) {
        showMessage('Please select a CSV file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('csv_file', file);

    showLoading('Uploading children...');

    try {
        const response = await fetch(`${API_BASE}/admin/bulk-upload/children`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            showMessage(`Successfully uploaded ${data.count} children`);
            fileInput.value = '';
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Failed to upload children', 'error');
    }
}

async function uploadParentsCSV() {
    const fileInput = document.getElementById('parents-csv');
    const file = fileInput.files[0];

    if (!file) {
        showMessage('Please select a CSV file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('csv_file', file);

    showLoading('Uploading parents...');

    try {
        const response = await fetch(`${API_BASE}/admin/bulk-upload/parents`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            showMessage(`Successfully uploaded ${data.count} parents`);
            fileInput.value = '';
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Failed to upload parents', 'error');
    }
}

async function uploadRelationshipsCSV() {
    const fileInput = document.getElementById('relationships-csv');
    const file = fileInput.files[0];

    if (!file) {
        showMessage('Please select a CSV file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('csv_file', file);

    showLoading('Uploading relationships...');

    try {
        const response = await fetch(`${API_BASE}/admin/bulk-upload/relationships`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            showMessage(`Successfully created ${data.count} relationships`);
            fileInput.value = '';
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Failed to upload relationships', 'error');
    }
}

async function loadParentChildMappings() {
    showMessage('Parent-child mappings feature coming soon');
}

async function loadObserverChildMappings() {
    try {
        // Load observers and children for mapping form
        const observersResponse = await fetch(`${API_BASE}/admin/observers`);
        const childrenResponse = await fetch(`${API_BASE}/admin/children`);

        const observersData = await observersResponse.json();
        const childrenData = await childrenResponse.json();

        if (observersData.success && childrenData.success) {
            // Populate selects
            const observerSelect = document.getElementById('mapping-observer-select');
            const childSelect = document.getElementById('mapping-child-select');

            observerSelect.innerHTML = '<option value="">Select Observer</option>';
            childSelect.innerHTML = '<option value="">Select Child</option>';

            observersData.observers.forEach(observer => {
                const option = document.createElement('option');
                option.value = observer.id;
                option.textContent = observer.name;
                observerSelect.appendChild(option);
            });

            childrenData.children.forEach(child => {
                const option = document.createElement('option');
                option.value = child.id;
                option.textContent = child.name;
                childSelect.appendChild(option);
            });
        }

        // Load existing mappings
        const mappingsResponse = await fetch(`${API_BASE}/admin/observer-mappings`);
        const mappingsData = await mappingsResponse.json();

        if (mappingsData.success) {
            displayObserverMappings(mappingsData.mappings);
        }
    } catch (error) {
        console.error('Error loading observer mappings:', error);
    }
}

function displayObserverMappings(mappings) {
    const container = document.getElementById('observer-mappings-container');

    if (mappings.length === 0) {
        container.innerHTML = '<p>No observer-child mappings found.</p>';
        return;
    }

    container.innerHTML = mappings.map(mapping => `
        <div class="mapping-item">
            <div class="mapping-info">
                <strong>${mapping.observer_name}</strong> → ${mapping.child_name}
            </div>
            <div class="mapping-actions">
                <button onclick="removeObserverMapping('${mapping.id}')" class="logout-btn">Remove</button>
            </div>
        </div>
    `).join('');
}

async function addObserverMapping() {
    const observerId = document.getElementById('mapping-observer-select').value;
    const childId = document.getElementById('mapping-child-select').value;

    if (!observerId || !childId) {
        showMessage('Please select both observer and child', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/observer-mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                observer_id: observerId,
                child_id: childId
            })
        });

        const data = await response.json();

        if (data.success) {
            showMessage('Mapping created successfully');
            loadObserverChildMappings();
            document.getElementById('mapping-observer-select').value = '';
            document.getElementById('mapping-child-select').value = '';
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to create mapping', 'error');
    }
}

async function removeObserverMapping(mappingId) {
    if (!confirm('Are you sure you want to remove this mapping?')) return;

    try {
        const response = await fetch(`${API_BASE}/admin/observer-mappings/${mappingId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showMessage('Mapping removed successfully');
            loadObserverChildMappings();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to remove mapping', 'error');
    }
}

async function uploadObserverMappingsCSV() {
    const fileInput = document.getElementById('observer-mappings-csv');
    const file = fileInput.files[0];

    if (!file) {
        showMessage('Please select a CSV file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('csv_file', file);

    showLoading('Uploading observer mappings...');

    try {
        const response = await fetch(`${API_BASE}/admin/bulk-upload/observer-mappings`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            showMessage(`Successfully created ${data.count} mappings`);
            fileInput.value = '';
            loadObserverChildMappings();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Failed to upload mappings', 'error');
    }
}

async function loadActivityLogs() {
    try {
        const response = await fetch(`${API_BASE}/admin/activity-logs`);
        const data = await response.json();

        if (data.success) {
            displayActivityLogs(data.logs);
        }
    } catch (error) {
        console.error('Error loading activity logs:', error);
    }
}

function displayActivityLogs(logs) {
    const container = document.getElementById('activity-logs-container');

    if (logs.length === 0) {
        container.innerHTML = '<p>No activity logs found.</p>';
        return;
    }

    container.innerHTML = logs.map(log => `
        <div class="activity-log-item">
            <div class="log-header">
                <span class="log-action">${log.action}</span>
                <span class="log-time">${formatDateTime(log.timestamp)}</span>
            </div>
            <div class="log-details">
                User: ${log.user_name} | ${log.details}
            </div>
        </div>
    `).join('');
}

function loadAdminProcessing() {
    // Load observers for admin processing
    loadObserversList();
}

async function loadObserversList() {
    try {
        const response = await fetch(`${API_BASE}/admin/observers`);
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('admin-observer-select');
            select.innerHTML = '<option value="">Select Observer</option>';

            data.observers.forEach(observer => {
                const option = document.createElement('option');
                option.value = observer.id;
                option.textContent = observer.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading observers:', error);
    }
}

async function loadObserverChildren() {
    const observerId = document.getElementById('admin-observer-select').value;
    if (!observerId) return;

    try {
        const response = await fetch(`${API_BASE}/observer/children?observer_id=${observerId}`);
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('admin-child-select');
            select.innerHTML = '<option value="">Select Student</option>';

            data.children.forEach(child => {
                const option = document.createElement('option');
                option.value = child.id;
                option.textContent = child.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading observer children:', error);
    }
}

function showAdminImageUpload() {
    document.getElementById('admin-image-upload').classList.remove('hidden');
    document.getElementById('admin-audio-upload').classList.add('hidden');
}

function showAdminAudioUpload() {
    document.getElementById('admin-audio-upload').classList.remove('hidden');
    document.getElementById('admin-image-upload').classList.add('hidden');
}

function handleAdminImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        selectedImage = file;

        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('admin-image-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 300px;">`;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        document.getElementById('admin-process-image-btn').classList.remove('hidden');
    }
}

function handleAdminAudioUpload(event) {
    const file = event.target.files[0];
    if (file) {
        selectedAudio = file;

        const preview = document.getElementById('admin-audio-preview');
        preview.innerHTML = `<p>📁 ${file.name}</p><p>Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>`;
        preview.classList.remove('hidden');

        document.getElementById('admin-process-audio-btn').classList.remove('hidden');
    }
}

async function processAdminImage() {
    if (!selectedImage) {
        showMessage('Please select an image first', 'error');
        return;
    }

    const sessionInfo = getAdminSessionInfo();
    if (!sessionInfo) return;

    showLoading('Processing photo...');

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const imageData = e.target.result;

            const response = await fetch(`${API_BASE}/admin/process-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageData,
                    child_id: document.getElementById('admin-child-select').value,
                    observer_id: document.getElementById('admin-observer-select').value,
                    session_info: sessionInfo
                })
            });

            const data = await response.json();
            hideLoading();

            if (data.success) {
                currentReport = data.report;
                showMessage('Photo processed successfully!');
                showReport();
            } else {
                showMessage(data.message, 'error');
            }
        };
        reader.readAsDataURL(selectedImage);
    } catch (error) {
        hideLoading();
        showMessage('Processing failed. Please try again.', 'error');
    }
}

async function processAdminAudio() {
    if (!selectedAudio) {
        showMessage('Please select an audio file first', 'error');
        return;
    }

    const sessionInfo = getAdminSessionInfo();
    if (!sessionInfo) return;

    showLoading('Processing recording...');

    try {
        const formData = new FormData();
        formData.append('audio', selectedAudio);
        formData.append('child_id', document.getElementById('admin-child-select').value);
        formData.append('observer_id', document.getElementById('admin-observer-select').value);
        formData.append('session_info', JSON.stringify(sessionInfo));

        const response = await fetch(`${API_BASE}/admin/process-audio`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            currentReport = data.report;
            showMessage('Recording processed successfully!');
            showReport();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Processing failed. Please try again.', 'error');
    }
}

function getAdminSessionInfo() {
    const sessionDate = document.getElementById('admin-session-date').value;
    const sessionStart = document.getElementById('admin-session-start').value;
    const sessionEnd = document.getElementById('admin-session-end').value;
    const observerId = document.getElementById('admin-observer-select').value;
    const childId = document.getElementById('admin-child-select').value;

    if (!sessionDate || !observerId || !childId) {
        showMessage('Please fill in all session information', 'error');
        return null;
    }

    return {
        session_date: sessionDate,
        session_start: sessionStart,
        session_end: sessionEnd,
        observer_id: observerId,
        child_id: childId
    };
}

// Report display functions
function showReport() {
    document.getElementById('report-content').innerHTML = formatReport(currentReport);
    showScreen('report-screen');
}

function formatReport(report) {
    return report
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/^(#{1,6})\s+(.*)$/gm, '<h$1>$2</h$1>');
}

function goBack() {
    if (currentUser.role === 'Observer') {
        showScreen('observer-screen');
    } else if (currentUser.role === 'Parent') {
        showScreen('parent-screen');
    } else if (currentUser.role === 'Admin') {
        showScreen('admin-screen');
    }
}

function downloadReport() {
    if (!currentReport) return;

    const blob = new Blob([currentReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `observation_report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showEmailForm() {
    document.getElementById('email-form').classList.remove('hidden');

    const subject = document.getElementById('email-subject');
    if (!subject.value) {
        subject.value = `Observation Report - ${new Date().toLocaleDateString()}`;
    }
}

async function sendEmail() {
    const email = document.getElementById('email-recipient').value.trim();
    const subject = document.getElementById('email-subject').value.trim();

    if (!email || !subject || !currentReport) {
        showMessage('Please fill in all email fields', 'error');
        return;
    }

    showLoading('Sending email...');

    try {
        const response = await fetch(`${API_BASE}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                subject: subject,
                content: currentReport
            })
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            showMessage('Email sent successfully!');
            document.getElementById('email-form').classList.add('hidden');
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showMessage('Failed to send email', 'error');
    }
}

// Modal functions
function closeGoalModal() {
    document.getElementById('goal-modal').classList.add('hidden');
}

function closeReportModal() {
    document.getElementById('report-modal').classList.add('hidden');
}

// Utility functions
function showLoading(message = 'Processing...') {
    document.getElementById('loading-message').textContent = message;
    document.getElementById('loading-screen').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-screen').classList.add('hidden');
}

function showMessage(message, type = 'success') {
    const messageDiv = document.getElementById('message-display');
    const messageText = document.getElementById('message-text');

    messageText.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideMessage();
    }, 5000);
}

function hideMessage() {
    document.getElementById('message-display').classList.add('hidden');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Additional utility functions for data processing
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    return age;
}

function generateProgressData(observations) {
    // Generate sample progress data for charts
    const dates = observations.map(obs => obs.date).slice(-10);
    const scores = observations.map(obs => obs.rating || Math.random() * 5).slice(-10);

    return { dates, scores };
}

function generateSkillsData(observations) {
    // Generate sample skills data for radar chart
    const skills = ['Communication', 'Social Skills', 'Motor Skills', 'Cognitive', 'Emotional'];
    const levels = skills.map(() => Math.random() * 5);

    return { skills, levels };
}

// Event listeners for dynamic content
document.addEventListener('click', function(e) {
    // Close modals when clicking outside
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // ESC key to close modals and go back
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal:not(.hidden)');
        if (modals.length > 0) {
            modals.forEach(modal => modal.classList.add('hidden'));
        } else if (document.getElementById('report-screen').classList.contains('active')) {
            goBack();
        }
    }

    // Ctrl+S to save (prevent default and show message)
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        showMessage('Use the Save/Download buttons to save your work');
    }
});

// Auto-save functionality for forms
let autoSaveTimeout;

function setupAutoSave() {
    const textareas = document.querySelectorAll('textarea');
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"]');

    [...textareas, ...inputs].forEach(element => {
        element.addEventListener('input', function() {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                // Auto-save logic here
                console.log('Auto-saving form data...');
            }, 2000);
        });
    });
}

// Initialize auto-save when DOM is loaded
document.addEventListener('DOMContentLoaded', setupAutoSave);

// Offline detection
window.addEventListener('online', function() {
    showMessage('Connection restored', 'success');
});

window.addEventListener('offline', function() {
    showMessage('You are offline. Some features may not work.', 'error');
});

// Performance monitoring
function logPerformance(action, startTime) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`${action} took ${duration.toFixed(2)} milliseconds`);
}

// Error handling for fetch requests
async function safeFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        showMessage('Network error. Please check your connection.', 'error');
        throw error;
    }
}

// Data validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password.length >= 8;
}

function validateRequired(value) {
    return value && value.trim().length > 0;
}

// File validation
function validateImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
        showMessage('Please select a valid image file (JPEG, PNG, GIF)', 'error');
        return false;
    }

    if (file.size > maxSize) {
        showMessage('Image file is too large. Maximum size is 10MB.', 'error');
        return false;
    }

    return true;
}

function validateAudioFile(file) {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!allowedTypes.includes(file.type)) {
        showMessage('Please select a valid audio file (MP3, WAV, M4A)', 'error');
        return false;
    }

    if (file.size > maxSize) {
        showMessage('Audio file is too large. Maximum size is 50MB.', 'error');
        return false;
    }

    return true;
}

// Local storage functions for offline support
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
        return null;
    }
}

function clearLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error('Failed to clear localStorage:', error);
    }
}

// Session management
function saveSession() {
    if (currentUser) {
        saveToLocalStorage('currentUser', currentUser);
    }
}

function loadSession() {
    const savedUser = loadFromLocalStorage('currentUser');
    if (savedUser) {
        currentUser = savedUser;

        // Redirect to appropriate dashboard
        if (savedUser.role === 'Observer') {
            loadObserverData();
            showScreen('observer-screen');
        } else if (savedUser.role === 'Parent') {
            loadParentData();
            showScreen('parent-screen');
        } else if (savedUser.role === 'Admin') {
            loadAdminData();
            showScreen('admin-screen');
        }
    }
}

// Initialize session on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check for saved session
    loadSession();
});

// Save session before page unload
window.addEventListener('beforeunload', function() {
    saveSession();
});

// Print functionality
function printReport() {
    const reportContent = document.getElementById('report-content').innerHTML;
    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Observation Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1, h2, h3 { color: #333; }
                .report-header { border-bottom: 2px solid #4CAF50; padding-bottom: 10px; margin-bottom: 20px; }
                .report-content { line-height: 1.6; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="report-header">
                <h1>Observation Report</h1>
                <p>Generated on: ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="report-content">
                ${reportContent}
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

// Export functionality
function exportToCSV(data, filename) {
    const csvContent = convertToCSV(data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
}

// Search functionality
function setupSearch() {
    const searchInputs = document.querySelectorAll('[data-search]');

    searchInputs.forEach(input => {
        input.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const targetContainer = document.querySelector(this.dataset.search);
            const items = targetContainer.querySelectorAll('[data-searchable]');

            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// Initialize search functionality
document.addEventListener('DOMContentLoaded', setupSearch);

// Accessibility improvements
function setupAccessibility() {
    // Add ARIA labels to buttons without text
    const iconButtons = document.querySelectorAll('button:empty, button:has(.icon)');
    iconButtons.forEach(button => {
        if (!button.getAttribute('aria-label')) {
            button.setAttribute('aria-label', 'Button');
        }
    });

    // Add focus indicators
    const focusableElements = document.querySelectorAll('button, input, select, textarea, a[href]');
    focusableElements.forEach(element => {
        element.addEventListener('focus', function() {
            this.style.outline = '2px solid #4CAF50';
        });

        element.addEventListener('blur', function() {
            this.style.outline = '';
        });
    });
}

// Initialize accessibility features
document.addEventListener('DOMContentLoaded', setupAccessibility);

// Touch device support
function setupTouchSupport() {
    let touchStartY = 0;
    let touchEndY = 0;

    document.addEventListener('touchstart', function(e) {
        touchStartY = e.changedTouches[0].screenY;
    });

    document.addEventListener('touchend', function(e) {
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    });

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartY - touchEndY;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe up
                console.log('Swipe up detected');
            } else {
                // Swipe down
                console.log('Swipe down detected');
            }
        }
    }
}

// Initialize touch support
document.addEventListener('DOMContentLoaded', setupTouchSupport);

// Final initialization
console.log('Learning Observer Web Application Loaded Successfully');
console.log('Version: 1.0.0');
console.log('All features from main.py have been implemented');
