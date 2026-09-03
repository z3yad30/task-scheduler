/**
 * Nexus Pipeline Engine — Pipeline + Graph Toggle
 * Default: Pipeline view. Toggle to vis-network graph.
 * All graph functionalities preserved.
 */

const BASE_API_URL = "https://6a1d5421bcc4f20d5ca464eb.mockapi.io";
const SESSION_KEY = 'gts_session';
const SESSION_DURATION = 3 * 60 * 60 * 1000;
const THEME_KEY = 'gts_theme';

let currentUser = null;
let taskDetails = {};
let networkInstance = null;
let isLoginMode = true;
let currentDetailTask = null;
let currentView = 'pipeline'; // 'pipeline' | 'graph'

const STATUS_LABEL = {
    'Not Started': 'Not Started',
    'In Progress': 'In Progress',
    'End': 'Completed'
};

const STATUS_CLASS = {
    'Not Started': 'status-notstarted',
    'In Progress': 'status-inprogress',
    'End': 'status-completed'
};

const STATUS_PREFIX = {
    'Not Started': '[ ]',
    'In Progress': '[~]',
    'End': '[✓]'
};

// ================= THEME =================

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeIcon(next);
    if (currentView === 'graph') updateVisualization();
    else renderPipeline();
}

function updateThemeIcon(theme) {
    const icon = theme === 'dark' ? '☀️' : '🌙';
    const mainBtn = document.getElementById('theme-toggle-btn');
    const authBtn = document.getElementById('auth-theme-toggle');
    if (mainBtn) mainBtn.textContent = icon;
    if (authBtn) authBtn.textContent = icon;
}

// ================= SESSION =================

function saveSession(user) {
    const session = { user: user, timestamp: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw);
        const age = Date.now() - session.timestamp;
        if (age > SESSION_DURATION) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session.user;
    } catch (e) {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// ================= TOAST =================

function showToast(message, type = 'info') {
    const existing = document.getElementById('toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ================= PANEL SYSTEM =================

function openPanel(panelId) {
    document.querySelectorAll('.slide-panel.panel-open').forEach(p => {
        if (p.id !== panelId) _dismissPanel(p.id);
    });

    const panel = document.getElementById(panelId);
    const backdrop = document.getElementById('overlay-backdrop');

    if (panel) {
        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');
    }
    if (backdrop) backdrop.classList.remove('hidden');

    if (panelId === 'add-task-panel') populateDependencySelects();

    requestAnimationFrame(() => {
        requestAnimationFrame(() => { if (panel) panel.classList.add('panel-open'); });
    });
}

function closePanel(panelId) {
    _dismissPanel(panelId);
    const anyOpen = document.querySelector('.slide-panel.panel-open');
    if (!anyOpen) {
        const backdrop = document.getElementById('overlay-backdrop');
        if (backdrop) backdrop.classList.add('hidden');
    }
}

function _dismissPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.remove('panel-open');
    panel.setAttribute('aria-hidden', 'true');
    const onEnd = () => {
        panel.classList.add('hidden');
        panel.removeEventListener('transitionend', onEnd);
    };
    panel.addEventListener('transitionend', onEnd);
}

function closeAllPanels() {
    document.querySelectorAll('.slide-panel.panel-open').forEach(p => closePanel(p.id));
    const backdrop = document.getElementById('overlay-backdrop');
    if (backdrop) backdrop.classList.add('hidden');
}

// ================= VIEW TOGGLE =================

function toggleView() {
    const pipelineView = document.getElementById('pipeline-view');
    const graphView = document.getElementById('graph-view');
    const viewLabel = document.getElementById('view-label');
    const toggleBtn = document.getElementById('nav-toggle-view');

    if (currentView === 'pipeline') {
        currentView = 'graph';
        if (pipelineView) pipelineView.classList.add('hidden');
        if (graphView) graphView.classList.remove('hidden');
        if (viewLabel) viewLabel.textContent = 'Pipeline';
        if (toggleBtn) toggleBtn.querySelector('span[aria-hidden="true"]').textContent = '📋';
        updateVisualization();
    } else {
        currentView = 'pipeline';
        if (pipelineView) pipelineView.classList.remove('hidden');
        if (graphView) graphView.classList.add('hidden');
        if (viewLabel) viewLabel.textContent = 'Graph';
        if (toggleBtn) toggleBtn.querySelector('span[aria-hidden="true"]').textContent = '🕸️';
        if (networkInstance) { networkInstance.destroy(); networkInstance = null; }
        renderPipeline();
    }
}

// ================= AUTH =================

function initAuthListeners() {
    const authForm = document.getElementById('auth-form');
    const authThemeBtn = document.getElementById('auth-theme-toggle');

    if (authThemeBtn) authThemeBtn.addEventListener('click', toggleTheme);

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username').value.trim();
        const password = document.getElementById('auth-password').value.trim();
        const email = document.getElementById('auth-email').value.trim();

        if (!username || !password) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }

        if (!isLoginMode && !email) {
            showToast('Email is required for registration.', 'error');
            return;
        }

        const btn = document.getElementById('auth-submit-btn');
        btn.disabled = true;
        btn.textContent = 'Please wait…';

        if (isLoginMode) {
            await handleLogin(username, password);
        } else {
            await handleRegistration(username, password, email);
        }

        btn.disabled = false;
        btn.textContent = isLoginMode ? 'Sign In' : 'Register Account';
    });
}

function updateAuthModeUI() {
    document.getElementById('auth-subtitle').textContent = isLoginMode
        ? 'Sign in to manage your dependency pipelines'
        : 'Create an account to get started';
    document.getElementById('auth-submit-btn').textContent = isLoginMode ? 'Sign In' : 'Register Account';
    document.getElementById('auth-toggle-text').innerHTML = isLoginMode
        ? `Don't have an account? <a href="#" id="auth-toggle-link">Register here</a>`
        : `Already have an account? <a href="#" id="auth-toggle-link">Sign in</a>`;

    // Show/hide email field based on mode
    const emailField = document.getElementById('email-form-group');
    const emailInput = document.getElementById('auth-email');
    if (emailField) {
        emailField.style.display = isLoginMode ? 'none' : 'block';
    }
    if (emailInput) emailInput.required = !isLoginMode;

    document.getElementById('auth-toggle-link').addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        updateAuthModeUI();
    });
}

async function handleLogin(username, password) {
    try {
        const response = await fetch(`${BASE_API_URL}/users`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const users = await response.json();
        const matchedUser = users.find(u => u.username === username && u.password === password);

        if (matchedUser) {
            initializeDashboardSession(matchedUser);
        } else {
            showToast('Invalid username or password.', 'error');
        }
    } catch (err) {
        console.error('Login error:', err);
        showToast('Could not reach the server. Please try again.', 'error');
    }
}

async function handleRegistration(username, password, email) {
    try {
        const checkRes = await fetch(`${BASE_API_URL}/users`);
        if (!checkRes.ok) throw new Error(`HTTP ${checkRes.status}`);

        const existingUsers = await checkRes.json();
        if (existingUsers.some(u => u.username === username)) {
            showToast('That username is already taken.', 'error');
            return;
        }

        if (existingUsers.some(u => u.password === password)) {
            showToast('This password is too weak. Please choose a different password.', 'error');
            return;
        }

        const createRes = await fetch(`${BASE_API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email })
        });

        if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`);
        const newUser = await createRes.json();

        showToast('Account created successfully!', 'success');
        initializeDashboardSession(newUser);
    } catch (err) {
        console.error('Registration error:', err);
        showToast('Registration failed. Please try again.', 'error');
    }
}

function initializeDashboardSession(userObj) {
    currentUser = userObj;
    saveSession(userObj);

    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
    document.documentElement.classList.add('session-active');
    document.getElementById('welcome-user').textContent = `Welcome, ${currentUser.username}`;

    initDashboardListeners();
    loadDataFromCloud();
}

function initDashboardListeners() {
    document.getElementById('logout-btn').addEventListener('click', () => {
        currentUser = null;
        clearSession();
        closeAllPanels();
        if (networkInstance) { networkInstance.destroy(); networkInstance = null; }
        document.getElementById('dashboard-container').classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('auth-form').reset();
        document.documentElement.classList.remove('session-active');
    });

    document.getElementById('task-form').onsubmit = (e) => {
        e.preventDefault();
        addTaskHandler();
    };
    document.querySelectorAll('.add-link-btn').forEach(button => {
        button.addEventListener('click', () => addLinkInput(button.dataset.linksContainer));
    });
    document.querySelectorAll('.links-input-list').forEach(container => {
        if (!container.querySelector('.link-input-row')) addLinkInput(container.id);
        container.addEventListener('click', (e) => {
            const removeButton = e.target.closest('.remove-link-btn');
            if (!removeButton) return;
            const row = removeButton.closest('.link-input-row');
            if (row) row.remove();
            if (!container.querySelector('.link-input-row')) addLinkInput(container.id);
        });
    });
    document.getElementById('edit-form').onsubmit = (e) => {
        e.preventDefault();
        saveTaskEditHandler();
    };

    document.getElementById('nav-add-task').addEventListener('click', () => openPanel('add-task-panel'));
    document.getElementById('nav-task-list').addEventListener('click', () => {
        renderSavedTasksPanel();
        openPanel('saved-tasks-panel');
    });

    const toggleViewBtn = document.getElementById('nav-toggle-view');
    if (toggleViewBtn) toggleViewBtn.addEventListener('click', toggleView);

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    document.getElementById('detail-edit-btn').addEventListener('click', () => {
        if (currentDetailTask) {
            closePanel('task-detail-panel');
            openEditModal(currentDetailTask);
        }
    });
    document.getElementById('detail-delete-btn').addEventListener('click', () => {
        if (currentDetailTask) {
            closeAllPanels();
            deleteTask(currentDetailTask);
        }
    });

    const btnNotStarted = document.getElementById('status-notstarted');
    const btnInProgress = document.getElementById('status-inprogress');
    const btnEnd = document.getElementById('status-end');

    if (btnNotStarted) {
        btnNotStarted.addEventListener('click', () => updateTaskStatus(currentDetailTask, 'Not Started'));
    }
    if (btnInProgress) {
        btnInProgress.addEventListener('click', () => updateTaskStatus(currentDetailTask, 'In Progress'));
    }
    if (btnEnd) {
        btnEnd.addEventListener('click', () => updateTaskStatus(currentDetailTask, 'End'));
    }

    // Graph controls
    document.getElementById('graph-fit')?.addEventListener('click', fitGraph);
    document.getElementById('graph-zoom-in')?.addEventListener('click', () => networkInstance?.moveTo({ scale: networkInstance.getScale() + 0.2 }));
    document.getElementById('graph-zoom-out')?.addEventListener('click', () => networkInstance?.moveTo({ scale: networkInstance.getScale() - 0.2 }));

    // Responsive graph reflow
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (currentView === 'graph' && networkInstance) {
                networkInstance.redraw();
                fitGraph();
            }
        }, 250);
    });
}

// ================= STATUS UPDATE =================

async function updateTaskStatus(taskName, newStatus) {
    if (!taskName || !taskDetails[taskName]) {
        showToast('No task selected.', 'error');
        return;
    }

    const task = taskDetails[taskName];
    task.status = newStatus;
    renderTaskList();
    if (currentView === 'pipeline') renderPipeline();
    else updateVisualization();
    showTaskDetail(taskName);

    try {
        const response = await fetch(`${BASE_API_URL}/users/${currentUser.id}/tasks/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: taskName,
                dependencies: task.dependencies,
                priority: task.priority,
                deadline: task.deadline || '',
                description: task.description || '',
                status: newStatus,
                links: task.links || [],
                userId: currentUser.id,
                user_id: currentUser.id,
                tasktype: task.tasktype || 'regular'
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        showToast(`Status updated to ${STATUS_LABEL[newStatus] || newStatus}`, 'success');
        await loadDataFromCloud();
        if (currentDetailTask === taskName) showTaskDetail(taskName);

    } catch (err) {
        console.error('Status update error:', err);
        showToast('Failed to update status on server. Reverting...', 'error');
        await loadDataFromCloud();
        if (currentDetailTask === taskName) showTaskDetail(taskName);
    }
}

// ================= DEPENDENCY SELECTS =================

function populateDependencySelects(excludeTask = null) {
    const addSelect = document.getElementById('dependencies');
    const editSelect = document.getElementById('edit-dependencies');
    const tasks = Object.keys(taskDetails).sort();

    const populateSelect = (selectEl, currentExclude) => {
        if (!selectEl) return;
        const selectedValues = Array.from(selectEl.selectedOptions).map(opt => opt.value);
        selectEl.innerHTML = '';
        if (tasks.length === 0) {
            const option = document.createElement('option');
            option.disabled = true;
            option.textContent = 'No tasks available';
            selectEl.appendChild(option);
            return;
        }
        for (let task of tasks) {
            if (currentExclude && task === currentExclude) continue;
            const option = document.createElement('option');
            option.value = task;
            option.textContent = task;
            if (selectedValues.includes(task)) option.selected = true;
            selectEl.appendChild(option);
        }
    };

    populateSelect(addSelect, null);
    populateSelect(editSelect, excludeTask);
}

function addLinkInput(containerId, value = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'link-input-row';
    row.innerHTML = `
        <input type="url" class="link-input" data-link-input="${containerId}" value="${escapeHtml(value)}" placeholder="https://example.com" inputmode="url">
        <button type="button" class="btn btn-secondary btn-icon remove-link-btn" aria-label="Remove link">&times;</button>
    `;
    container.appendChild(row);
}

function getLinkInputValues(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .link-input`))
        .map(input => input.value.trim())
        .filter(Boolean);
}

async function copyLink(button) {
    const link = button.dataset.link;
    if (!link) return;

    try {
        await navigator.clipboard.writeText(link);
    } catch (error) {
        const helper = document.createElement('textarea');
        helper.value = link;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
    }
    showToast('Link copied to clipboard.', 'success');
}

// ================= CORE CRUD =================

async function loadDataFromCloud() {
    try {
        const response = await fetch(`${BASE_API_URL}/users/${currentUser.id}/tasks`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const cloudTasks = await response.json();

        taskDetails = {};
        cloudTasks.forEach(task => {
            const normalizedName = String(task.name || '').trim().toLowerCase();
            if ((task.tasktype || 'regular') !== 'regular' || normalizedName === ORA_RECORD_NAME || normalizedName === 'ora_daily_tasks') return;
            taskDetails[task.name] = {
                id: task.id,
                tasktype: task.tasktype || 'regular',
                dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
                priority: parseInt(task.priority) || 0,
                deadline: task.deadline || '',
                description: task.description || '',
                status: task.status || 'Not Started',
                links: Array.isArray(task.links) ? task.links : []
            };
        });

        if (currentView === 'pipeline') renderPipeline();
        else updateVisualization();
        renderTaskList();
        populateDependencySelects();
    } catch (err) {
        console.error('Load error:', err);
        showToast('Failed to load tasks from the server.', 'error');
    }
}

async function addTaskHandler() {
    const name = document.getElementById('taskName').value.trim();
    const priority = parseInt(document.getElementById('priority').value) || 0;
    const deadline = document.getElementById('deadline').value;
    const description = document.getElementById('description').value.trim();
    const selectEl = document.getElementById('dependencies');
    const dependencies = Array.from(selectEl.selectedOptions).map(opt => opt.value);

    const links = getLinkInputValues('links-input-list');

    if (!name) { showToast('Task name cannot be empty.', 'error'); return; }
    if (taskDetails[name]) { showToast(`A task named "${name}" already exists.`, 'error'); return; }

    for (let dep of dependencies) {
        if (!taskDetails[dep]) {
            showToast(`Dependency "${dep}" does not exist. Create it first.`, 'error');
            return;
        }
    }

    try {
        const response = await fetch(`${BASE_API_URL}/users/${currentUser.id}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name, dependencies, priority, deadline, description, links,
                userId: currentUser.id, user_id: currentUser.id, status: 'Not Started', tasktype: 'regular'
            })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        document.getElementById('task-form').reset();
        document.getElementById('links-input-list').innerHTML = '';
        addLinkInput('links-input-list');
        document.getElementById('priority').value = 0;
        const addSelect = document.getElementById('dependencies');
        if (addSelect) Array.from(addSelect.options).forEach(opt => opt.selected = false);
        closePanel('add-task-panel');
        showToast(`Task "${name}" added.`, 'success');
        await loadDataFromCloud();
    } catch (err) {
        console.error('Add task error:', err);
        showToast('Failed to save task. Please try again.', 'error');
    }
}

// ================= DELETE =================

async function deleteTask(taskName) {
    if (!taskDetails[taskName]) {
        showToast('Task not found.', 'error');
        return;
    }

    if (!confirm(`Delete "${taskName}"? Any tasks that depend on it will inherit its dependencies.`)) return;

    const targetId = String(taskDetails[taskName].id);
    const targetDeps = taskDetails[taskName].dependencies || [];

    if (!targetId || targetId === 'undefined') {
        showToast('Cannot delete: task ID is missing. Please refresh and try again.', 'error');
        return;
    }

    const successors = Object.entries(taskDetails).filter(([name, data]) =>
        name !== taskName && (data.dependencies || []).includes(taskName)
    );

    try {
        for (const [succName, succData] of successors) {
            const currentDeps = succData.dependencies || [];
            const newDeps = [
                ...currentDeps.filter(d => d !== taskName),
                ...targetDeps.filter(p => !currentDeps.includes(p))
            ];

            const res = await fetch(`${BASE_API_URL}/users/${currentUser.id}/tasks/${succData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: succName,
                    dependencies: newDeps,
                    priority: succData.priority ?? 0,
                    deadline: succData.deadline || '',
                    description: succData.description || '',
                    status: succData.status || 'Not Started',
                    links: succData.links || [],
                    userId: currentUser.id,
                    user_id: currentUser.id
                })
            });
            if (!res.ok) throw new Error(`Failed to update "${succName}": HTTP ${res.status}`);
        }

        const deleteRes = await fetch(`${BASE_API_URL}/users/${currentUser.id}/tasks/${targetId}`, {
            method: 'DELETE'
        });
        if (!deleteRes.ok) throw new Error(`DELETE failed: HTTP ${deleteRes.status}`);

        showToast(`"${taskName}" deleted successfully.`, 'success');
        await loadDataFromCloud();

    } catch (err) {
        console.error('Delete error:', err);
        showToast(`Delete failed: ${err.message}`, 'error');
        await loadDataFromCloud();
    }
}

// ================= EDIT =================

function openEditModal(taskName) {
    const task = taskDetails[taskName];
    document.getElementById('edit-old-name').value = taskName;
    document.getElementById('edit-name').value = taskName;
    document.getElementById('edit-priority').value = task.priority;
    document.getElementById('edit-deadline').value = task.deadline || '';
    document.getElementById('edit-description').value = task.description || '';

    const editLinksList = document.getElementById('edit-links-input-list');
    editLinksList.innerHTML = '';
    (Array.isArray(task.links) && task.links.length ? task.links : ['']).forEach(link => addLinkInput('edit-links-input-list', link));

    populateDependencySelects(taskName);
    const editSelect = document.getElementById('edit-dependencies');
    if (editSelect) {
        Array.from(editSelect.options).forEach(opt => {
            if (task.dependencies.includes(opt.value)) opt.selected = true;
        });
    }

    let statusSelect = document.getElementById('edit-status');
    if (!statusSelect) {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.innerHTML = `
            <label for="edit-status">Status</label>
            <select id="edit-status" style="width: 100%; padding: 12px; border-radius: 6px; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border); font-size: 1rem;">
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="End">Completed</option>
            </select>
        `;
        const descParent = document.getElementById('edit-description').parentNode;
        descParent.parentNode.insertBefore(group, descParent.nextSibling);
        statusSelect = document.getElementById('edit-status');
    }
    statusSelect.value = task.status || 'Not Started';

    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-name').focus();
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

async function saveTaskEditHandler() {
    const oldName = document.getElementById('edit-old-name').value;
    const newName = document.getElementById('edit-name').value.trim();
    const priority = parseInt(document.getElementById('edit-priority').value) || 0;
    const deadline = document.getElementById('edit-deadline').value;
    const description = document.getElementById('edit-description').value.trim();
    const status = document.getElementById('edit-status').value;
    const editSelect = document.getElementById('edit-dependencies');
    const newDeps = Array.from(editSelect.selectedOptions).map(opt => opt.value);

    const links = getLinkInputValues('edit-links-input-list');

    if (!newName) { showToast('Task name cannot be empty.', 'error'); return; }
    if (newName !== oldName && taskDetails[newName]) {
        showToast(`A task named "${newName}" already exists.`, 'error');
        return;
    }

    for (let d of newDeps) {
        if (!taskDetails[d] && d !== oldName) {
            showToast(`Dependency "${d}" does not exist.`, 'error');
            return;
        }
    }

    try {
        const targetId = taskDetails[oldName].id;
        const updateRes = await fetch(`${BASE_API_URL}/users/${currentUser.id}/tasks/${targetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newName, dependencies: newDeps, priority, deadline, description, status, links,
                userId: currentUser.id, user_id: currentUser.id,
                tasktype: taskDetails[oldName].tasktype || 'regular'
            })
        });
        if (!updateRes.ok) throw new Error(`HTTP ${updateRes.status}`);

        if (newName !== oldName) {
            for (let key in taskDetails) {
                if (key !== oldName && taskDetails[key].dependencies.includes(oldName)) {
                    const updatedDeps = taskDetails[key].dependencies.map(d => d === oldName ? newName : d);
                    await fetch(`${BASE_API_URL}/users/${currentUser.id}/tasks/${taskDetails[key].id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: key,
                            dependencies: updatedDeps,
                            priority: taskDetails[key].priority,
                            deadline: taskDetails[key].deadline,
                            description: taskDetails[key].description,
                            status: taskDetails[key].status,
                            links: taskDetails[key].links || [],
                            userId: currentUser.id,
                            user_id: currentUser.id,
                            tasktype: taskDetails[key].tasktype || 'regular'
                        })
                    });
                }
            }
        }

        closeModal();
        showToast('Task updated successfully.', 'success');
        await loadDataFromCloud();
    } catch (err) {
        console.error('Update error:', err);
        showToast('Failed to update task. Please try again.', 'error');
    }
}

// ================= RENDERERS =================

function renderSavedTasksPanel() {
    const list = document.getElementById('saved-task-list');
    list.innerHTML = '';
    const keys = Object.keys(taskDetails);

    if (keys.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon" aria-hidden="true">📋</div><p>No tasks yet</p></div>`;
        return;
    }

    keys.sort((a, b) => taskDetails[b].priority - taskDetails[a].priority);

    keys.forEach(name => {
        const item = taskDetails[name];
        const currentStatus = item.status || 'Not Started';
        const dotColor = getStatusColor(currentStatus);

        const row = document.createElement('div');
        row.className = 'task-item';
        row.setAttribute('role', 'listitem');
        row.setAttribute('tabindex', '0');
        row.setAttribute('aria-label', `${name}, ${STATUS_LABEL[currentStatus]}, Priority ${item.priority}`);
        row.innerHTML = `
            <div class="task-item-header">
                <span class="task-status-dot" style="background: ${dotColor};" aria-hidden="true"></span>
                <span class="task-item-title">${escapeHtml(name)}</span>
            </div>
            <div class="task-item-meta">
                <span>P${item.priority}</span>
                ${item.deadline ? `<span>· ${item.deadline}</span>` : ''}
                ${item.dependencies.length ? `<span>· ${item.dependencies.length} dep</span>` : ''}
                ${item.links && item.links.length ? `<span>· ${item.links.length} link</span>` : ''}
            </div>
        `;
        row.addEventListener('click', () => showTaskDetail(name));
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                showTaskDetail(name);
            }
        });
        list.appendChild(row);
    });
}

function showTaskDetail(taskName) {
    const task = taskDetails[taskName];
    if (!task) return;
    currentDetailTask = taskName;

    const currentStatus = task.status || 'Not Started';
    const dotColor = getStatusColor(currentStatus);
    const statusLabel = STATUS_LABEL[currentStatus] || currentStatus;

    const dot = document.getElementById('detail-status-dot');
    const text = document.getElementById('detail-status-text');

    if (dot) dot.style.background = dotColor;
    if (text) {
        text.textContent = statusLabel;
        text.style.color = dotColor;
    }

    const nameEl = document.getElementById('detail-name');
    const priorityEl = document.getElementById('detail-priority');
    const deadlineEl = document.getElementById('detail-deadline');
    const depsEl = document.getElementById('detail-dependencies');
    const descEl = document.getElementById('detail-description');
    const linksEl = document.getElementById('detail-links');

    if (nameEl) nameEl.textContent = taskName;
    if (priorityEl) priorityEl.textContent = `P${task.priority}`;
    if (deadlineEl) deadlineEl.textContent = task.deadline || 'No deadline set';
    if (depsEl) depsEl.textContent = task.dependencies.length ? task.dependencies.join(', ') : 'None';
    if (descEl) descEl.textContent = task.description || 'No description provided.';

    // Render links as clickable anchors
    if (linksEl) {
        if (task.links && task.links.length > 0) {
            linksEl.innerHTML = task.links.map(link => 
                `<div class="detail-link-row"><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="detail-link">${escapeHtml(link)}</a><button type="button" class="btn btn-secondary btn-icon copy-link-btn" data-link="${escapeHtml(link)}" aria-label="Copy link">⧉</button></div>`
            ).join('');
            linksEl.querySelectorAll('.copy-link-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    copyLink(button);
                });
            });
        } else {
            linksEl.textContent = 'No links provided.';
        }
    }

    openPanel('task-detail-panel');
}

function renderTaskList() {
    const container = document.getElementById('task-list-container');
    if (!container) return;
    container.innerHTML = '';
    const keys = Object.keys(taskDetails);

    if (keys.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" aria-hidden="true">📋</div>
                <p>No tasks yet</p>
                <span class="empty-hint">Click "New Task" to get started</span>
            </div>
        `;
        return;
    }

    keys.sort((a, b) => taskDetails[b].priority - taskDetails[a].priority);

    for (let name of keys) {
        const item = taskDetails[name];
        const currentStatus = item.status || 'Not Started';
        const dotColor = getStatusColor(currentStatus);

        const div = document.createElement('div');
        div.className = 'task-item';
        div.setAttribute('role', 'listitem');
        div.setAttribute('tabindex', '0');
        div.setAttribute('aria-label', `${name}, ${STATUS_LABEL[currentStatus]}, Priority ${item.priority}`);
        div.innerHTML = `
            <div class="task-item-header">
                <span class="task-status-dot" style="background: ${dotColor};" aria-hidden="true"></span>
                <span class="task-item-title">${escapeHtml(name)}</span>
            </div>
            <div class="task-item-meta">
                <span>P${item.priority}</span>
                ${item.deadline ? `<span>· ${item.deadline}</span>` : ''}
                ${item.dependencies.length ? `<span>· ${item.dependencies.length} dep</span>` : ''}
                ${item.links && item.links.length ? `<span>· ${item.links.length} link</span>` : ''}
            </div>
        `;

        div.addEventListener('click', () => showTaskDetail(name));
        div.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                showTaskDetail(name);
            }
        });
        container.appendChild(div);
    }

    const countEl = document.getElementById('task-count');
    if (countEl) {
        countEl.textContent = keys.length;
        countEl.setAttribute('aria-label', `${keys.length} tasks`);
    }
}

// ================= PIPELINE RENDERER =================

function renderPipeline() {
    const container = document.getElementById('pipeline-container');
    const emptyState = document.getElementById('pipeline-empty');
    const subtitle = document.getElementById('pipeline-subtitle');
    if (!container) return;

    container.querySelectorAll('.pipeline-card').forEach(el => el.remove());

    const keys = Object.keys(taskDetails);

    if (keys.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (subtitle) subtitle.textContent = 'Execution order';
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let orderedKeys = [];
    const hasCycle = detectCycleDFS();
    if (hasCycle) {
        orderedKeys = keys.sort((a, b) => taskDetails[b].priority - taskDetails[a].priority);
        if (subtitle) subtitle.textContent = 'Priority order (cycle detected)';
    } else {
        orderedKeys = getTopologicalOrder();
        if (subtitle) subtitle.textContent = 'Execution order (topological sort)';
    }

    orderedKeys.forEach((name, index) => {
        const task = taskDetails[name];
        const status = task.status || 'Not Started';
        const statusClass = STATUS_CLASS[status] || 'status-notstarted';
        const statusLabel = STATUS_LABEL[status] || status;

        const card = document.createElement('div');
        card.className = 'pipeline-card';
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Step ${index + 1}: ${name}, ${statusLabel}`);

        // Check if ALL dependencies are completed
        const allDepsCompleted = task.dependencies.length > 0 && task.dependencies.every(dep => {
            return taskDetails[dep] && taskDetails[dep].status === 'End';
        });

        // Check if ANY dependency is not completed (blocked)
        const hasBlockingDeps = task.dependencies.length > 0 && task.dependencies.some(dep => {
            return !taskDetails[dep] || taskDetails[dep].status !== 'End';
        });

        let depsHtml = '';
        let depsLabel = '';

        if (status === 'End') {
            depsLabel = 'Status';
            depsHtml = '<span class="dep-pill dep-pill-completed">✓ Done</span>';
        } else if (status === 'In Progress') {
            depsLabel = 'Status';
            depsHtml = '<span class="dep-pill dep-pill-inprogress">~ In Progress</span>';
        } else if (task.dependencies.length === 0) {
            depsLabel = 'Status';
            depsHtml = '<span class="dep-pill dep-pill-ready">✓ Ready to start</span>';
        } else if (allDepsCompleted) {
            depsLabel = 'Status';
            depsHtml = '<span class="dep-pill dep-pill-ready">✓ Ready to start</span>';
        } else {
            depsLabel = 'Blocked by';
            depsHtml = task.dependencies
                .filter(dep => !taskDetails[dep] || taskDetails[dep].status !== 'End')
                .map(dep => `<span class="dep-pill">${escapeHtml(dep)}</span>`)
                .join('');
        }

        const deadlineHtml = task.deadline
            ? `<span>📅 ${task.deadline}</span>`
            : '';

        // Build links HTML for pipeline card
        let linksHtml = '';
        if (task.links && task.links.length > 0) {
            linksHtml = `
                <div class="pipeline-links">
                    <span class="pipeline-links-label">🔗 Links</span>
                    <div class="pipeline-links-list">
                        ${task.links.map(link => `<div class="pipeline-link-row"><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="link-pill">${escapeHtml(truncateUrl(link, 40))}</a><button type="button" class="btn btn-secondary btn-icon copy-link-btn" data-link="${escapeHtml(link)}" aria-label="Copy link">⧉</button></div>`).join('')}
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="pipeline-card-header">
                <span class="pipeline-step" aria-label="Step ${index + 1}">${index + 1}</span>
                <span class="pipeline-name">${escapeHtml(name)}</span>
                <span class="pipeline-status ${statusClass}">${statusLabel}</span>
            </div>
            <div class="pipeline-meta">
                <span>⚡ P${task.priority}</span>
                ${deadlineHtml}
            </div>
            <div class="pipeline-deps">
                <span class="pipeline-deps-label">${depsLabel}</span>
                <div class="pipeline-deps-list">
                    ${depsHtml}
                </div>
            </div>
            ${linksHtml}
        `;

        card.addEventListener('click', () => showTaskDetail(name));
        card.querySelectorAll('.copy-link-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                copyLink(button);
            });
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                showTaskDetail(name);
            }
        });

        container.appendChild(card);
    });
}

function truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
}

function getTopologicalOrder() {
    const adj = buildAdjacencyList();
    const visited = new Set();
    const stack = [];

    function dfs(node) {
        visited.add(node);
        for (let n of (adj[node] || [])) {
            if (!visited.has(n)) dfs(n);
        }
        stack.push(node);
    }

    for (let node in taskDetails) {
        if (!visited.has(node)) dfs(node);
    }

    return stack.reverse();
}

// ================= VISUALIZATION (GRAPH) =================

function getGraphColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        nodeFont: isLight ? '#0f172a' : '#f1f5f9',
        edge: isLight ? '#94a3b8' : '#475569',
        edgeHighlight: isLight ? '#4f46e5' : '#818cf8',
        canvasBg: isLight ? '#eef2ff' : '#0b1221'
    };
}

function getResponsiveGraphSettings() {
    const isMobile = window.innerWidth < 768;
    return {
        fontSize: isMobile ? 16 : 14,
        nodeMargin: isMobile ? { top: 16, bottom: 16, left: 20, right: 20 } : { top: 14, bottom: 14, left: 18, right: 18 },
        levelSeparation: isMobile ? 150 : 120,
        nodeSpacing: isMobile ? 200 : 220,
        treeSpacing: isMobile ? 260 : 280,
        edgeWidth: isMobile ? 2.5 : 2
    };
}

function updateVisualization() {
    const container = document.getElementById('network-visualization');
    const emptyState = document.getElementById('graph-empty');
    if (!container) return;

    const keys = Object.keys(taskDetails);
    if (keys.length === 0) {
        container.style.display = 'none';
        if (emptyState) emptyState.classList.remove('hidden');
        if (networkInstance) { networkInstance.destroy(); networkInstance = null; }
        return;
    }

    container.style.display = 'block';
    if (emptyState) emptyState.classList.add('hidden');

    const colors = getGraphColors();
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const responsive = getResponsiveGraphSettings();

    const statusStyles = {
        'Not Started': {
            bg: isLight ? '#fef2f2' : '#450a0a',
            border: isLight ? '#f87171' : '#f87171',
            text: isLight ? '#7f1d1d' : '#fecaca'
        },
        'In Progress': {
            bg: isLight ? '#fffbeb' : '#451a03',
            border: isLight ? '#fbbf24' : '#fbbf24',
            text: isLight ? '#78350f' : '#fde68a'
        },
        'End': {
            bg: isLight ? '#f0fdf4' : '#052e16',
            border: isLight ? '#4ade80' : '#4ade80',
            text: isLight ? '#14532d' : '#bbf7d0'
        }
    };

    const nodesArray = [];
    const edgesArray = [];

    for (let task in taskDetails) {
        const status = taskDetails[task].status || 'Not Started';
        const cfg = statusStyles[status];
        const prefix = STATUS_PREFIX[status] || '[ ]';

        nodesArray.push({
            id: task,
            label: `${prefix} ${task}`,
            shape: 'box',
            margin: responsive.nodeMargin,
            font: {
                face: 'Sora, system-ui, sans-serif',
                size: responsive.fontSize,
                color: cfg.text,
                multi: false,
                bold: true
            },
            borderWidth: 2,
            borderWidthSelected: 3,
            color: {
                background: cfg.bg,
                border: cfg.border,
                highlight: { background: isLight ? '#ffffff' : '#1e293b', border: cfg.border }
            },
            shadow: {
                enabled: true,
                color: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.35)',
                size: 8,
                x: 0,
                y: 4
            },
            widthConstraint: { minimum: 120 },
            heightConstraint: { minimum: 40 }
        });

        taskDetails[task].dependencies.forEach(dep => {
            edgesArray.push({
                from: dep,
                to: task,
                arrows: { to: { enabled: true, scaleFactor: 0.7 } },
                color: { color: colors.edge, highlight: colors.edgeHighlight },
                width: responsive.edgeWidth,
                smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 }
            });
        });
    }

    container.style.background = colors.canvasBg;

    const data = { nodes: new vis.DataSet(nodesArray), edges: new vis.DataSet(edgesArray) };
    const options = {
        layout: {
            hierarchical: {
                direction: 'UD',
                sortMethod: 'directed',
                levelSeparation: responsive.levelSeparation,
                nodeSpacing: responsive.nodeSpacing,
                treeSpacing: responsive.treeSpacing,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true
            }
        },
        physics: { enabled: false },
        interaction: {
            hover: true,
            tooltipDelay: 200,
            navigationButtons: false,
            keyboard: false,
            zoomView: true,
            dragView: true,
            multiselect: false
        }
    };

    if (networkInstance) networkInstance.destroy();
    networkInstance = new vis.Network(container, data, options);

    networkInstance.on("selectNode", function (params) {
        if (params.nodes.length > 0) showTaskDetail(params.nodes[0]);
    });

    networkInstance.on("keydown", function (params) {
        if (params.key === 'Enter' && params.nodes.length > 0) {
            showTaskDetail(params.nodes[0]);
        }
    });

    setTimeout(() => fitGraph(), 400);
}

function fitGraph() {
    if (networkInstance) {
        networkInstance.fit({
            animation: { duration: 500, easingFunction: 'easeInOutQuad' }
        });
    }
}

// ================= HELPERS =================

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getStatusColor(status) {
    if (status === 'In Progress') return 'var(--warning)';
    if (status === 'End') return 'var(--success)';
    return 'var(--danger)';
}

function clearOutput() {
    const el = document.getElementById('output-box');
    if (el) {
        el.textContent = '';
        el.classList.add('hidden');
    }
}

// ================= GRAPH ALGORITHMS =================

function buildAdjacencyList() {
    const adj = {};
    for (let task in taskDetails) {
        if (!adj[task]) adj[task] = [];
        for (let dep of taskDetails[task].dependencies) {
            if (!adj[dep]) adj[dep] = [];
            adj[dep].push(task);
        }
    }
    return adj;
}

function detectCycleDFS() {
    const adj = buildAdjacencyList();
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = {};
    for (let n in adj) color[n] = WHITE;

    function dfs(node) {
        color[node] = GRAY;
        for (let neighbor of (adj[node] || [])) {
            if (color[neighbor] === GRAY) return true;
            if (color[neighbor] === WHITE && dfs(neighbor)) return true;
        }
        color[node] = BLACK;
        return false;
    }

    for (let node in adj) {
        if (color[node] === WHITE && dfs(node)) return true;
    }
    return false;
}

function runCycleDetection() {
    if (Object.keys(taskDetails).length === 0) { showOutput('No tasks to check.'); return; }
    const hasCycle = detectCycleDFS();
    showOutput(hasCycle
        ? 'Cycle detected! There is a circular dependency. Topological sort is blocked until resolved.'
        : 'No cycles found. The task graph is a valid DAG.');
}

function runTopologicalSort() {
    if (Object.keys(taskDetails).length === 0) { showOutput('No tasks to sort.'); return; }
    if (detectCycleDFS()) {
        showOutput('Cannot compute topological order — a cycle exists. Please resolve it first.');
        return;
    }

    const ordered = getTopologicalOrder();
    showOutput('Execution Order (left = run first):\n\n' + ordered.join(' → '));
}

function sortByPriority() {
    if (Object.keys(taskDetails).length === 0) { showOutput('No tasks to sort.'); return; }
    const sorted = Object.keys(taskDetails).sort((a, b) => taskDetails[b].priority - taskDetails[a].priority);
    showOutput('Tasks by Priority (highest first):\n\n' +
        sorted.map((t, i) => `${i + 1}. ${t}  [Priority: ${taskDetails[t].priority}]`).join('\n'));
}

function sortByDeadline() {
    if (Object.keys(taskDetails).length === 0) { showOutput('No tasks to sort.'); return; }
    const sorted = Object.keys(taskDetails).sort((a, b) => {
        if (!taskDetails[a].deadline) return 1;
        if (!taskDetails[b].deadline) return -1;
        return new Date(taskDetails[a].deadline) - new Date(taskDetails[b].deadline);
    });
    showOutput('Tasks by Deadline (soonest first):\n\n' +
        sorted.map((t, i) => `${i + 1}. ${t}  (${taskDetails[t].deadline || 'No deadline set'})`).join('\n'));
}

function showOutput(text) {
    const el = document.getElementById('output-box');
    if (el) {
        el.textContent = text;
        el.classList.remove('hidden');
        el.focus();
    }
}

// ================= BOOTSTRAP =================

// ================= ORA - DAILY TASK EXECUTOR =================

const ORA_KEY = 'ora_daily_tasks';
const ORA_RECORD_NAME = '__ora_daily_tasks__';
let oraDailyTasks = [];
let oraSchedulerInterval = null;
let oraLastNotifiedTime = {};
let oraCloudRecordId = null;

// EmailJS configuration. Create a free EmailJS service/template and add its
// public key here; Gmail SMTP credentials must never be placed in frontend code.
const ORA_EMAIL_CONFIG = {
    publicKey: '',
    serviceId: '',
    templateId: ''
};

function isOraEmailConfigured() {
    return Boolean(
        window.emailjs &&
        ORA_EMAIL_CONFIG.publicKey &&
        ORA_EMAIL_CONFIG.serviceId &&
        ORA_EMAIL_CONFIG.templateId
    );
}

async function sendOraEmail(subject, message) {
    const recipient = currentUser?.email;
    if (!recipient) throw new Error('The signed-in user has no email address.');
    if (!isOraEmailConfigured()) {
        throw new Error('EmailJS is not configured. Add its public key, service ID, and template ID in app.js.');
    }

    window.emailjs.init({ publicKey: ORA_EMAIL_CONFIG.publicKey });
    await window.emailjs.send(ORA_EMAIL_CONFIG.serviceId, ORA_EMAIL_CONFIG.templateId, {
        to_email: recipient,
        subject,
        message,
        task_name: subject
    });
}

/**
 * Load Ora daily tasks from localStorage
 */
function loadOraTasks() {
    try {
        const stored = localStorage.getItem(getOraStorageKey());
        oraDailyTasks = stored ? JSON.parse(stored) : [];
        // Clean up old tasks (older than 24 hours)
        oraDailyTasks = oraDailyTasks.filter(task => {
            const taskDate = new Date(task.dateAdded);
            const now = new Date();
            const hoursDiff = (now - taskDate) / (1000 * 60 * 60);
            return hoursDiff < 24;
        });
        localStorage.setItem(getOraStorageKey(), JSON.stringify(oraDailyTasks));
    } catch (e) {
        oraDailyTasks = [];
    }
}

function getOraStorageKey() {
    return `${ORA_KEY}_${currentUser?.id || 'guest'}`;
}

function getOraEndpoint(recordId = '') {
    return `${BASE_API_URL}/users/${currentUser.id}/tasks${recordId ? `/${recordId}` : ''}`;
}

function getOraRecordPayload() {
    return {
        name: ORA_RECORD_NAME,
        description: 'Ora daily task data',
        priority: 0,
        deadline: '',
        dependencies: [],
        links: [],
        status: 'Not Started',
        tasktype: 'ora',
        userId: currentUser.id,
        user_id: currentUser.id,
        dailytasks: oraDailyTasks.map(task => task.name),
        dailydates: oraDailyTasks.map(task => ({
            date: task.date,
            start: task.startTime,
            end: task.endTime,
            dateAdded: task.dateAdded
        })),
        dailydesc: oraDailyTasks.map(task => task.description || 'none')
    };
}

/**
 * Save Ora daily tasks to localStorage
 */
async function saveOraTasks() {
    try {
        localStorage.setItem(getOraStorageKey(), JSON.stringify(oraDailyTasks));

        if (!currentUser) return;

        const response = await fetch(getOraEndpoint(oraCloudRecordId), {
            method: oraCloudRecordId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getOraRecordPayload())
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const savedRecord = await response.json();
        oraCloudRecordId = savedRecord.id || oraCloudRecordId;
    } catch (e) {
        console.error('Ora database save error:', e);
        showToast('Daily task saved locally, but database sync failed.', 'error');
    }
}

async function loadOraTasksFromCloud() {
    if (!currentUser) return;

    try {
        const response = await fetch(getOraEndpoint());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const cloudTasks = await response.json();
        const oraRecord = cloudTasks.find(task => {
            const normalizedName = String(task.name || '').trim().toLowerCase();
            return task.tasktype === 'ora' || normalizedName === ORA_RECORD_NAME || normalizedName === 'ora_daily_tasks';
        });
        if (!oraRecord) return;

        oraCloudRecordId = oraRecord.id;
        const names = Array.isArray(oraRecord.dailytasks) ? oraRecord.dailytasks : [];
        const dates = Array.isArray(oraRecord.dailydates) ? oraRecord.dailydates : [];
        const descriptions = Array.isArray(oraRecord.dailydesc) ? oraRecord.dailydesc : [];

        oraDailyTasks = names.map((name, index) => ({
            id: `${oraRecord.id}-${index}`,
            name,
            description: descriptions[index] || 'none',
            date: dates[index]?.date || new Date().toISOString().slice(0, 10),
            startTime: dates[index]?.start || '',
            endTime: dates[index]?.end || '',
            dateAdded: dates[index]?.dateAdded || new Date().toISOString(),
            status: 'pending'
        })).filter(task => task.startTime && task.endTime);

        localStorage.setItem(getOraStorageKey(), JSON.stringify(oraDailyTasks));
        if (oraRecord.tasktype !== 'ora') await saveOraTasks();
        renderOraTasksList();
        updateOraStats();
    } catch (e) {
        console.error('Ora database load error:', e);
        showToast('Could not load daily tasks from the database.', 'error');
    }
}

/**
 * Add a new daily task
 */
async function addOraTask(taskName, taskDescription, startTime, endTime) {
    const newTask = {
        id: Date.now().toString(),
        name: taskName,
        description: taskDescription || 'none',
        date: new Date().toISOString().slice(0, 10),
        startTime: startTime,
        endTime: endTime,
        dateAdded: new Date().toISOString(),
        status: 'pending'
    };
    
    oraDailyTasks.push(newTask);
    oraDailyTasks.sort((a, b) => a.startTime.localeCompare(b.startTime));
    await saveOraTasks();
    renderOraTasksList();
    updateOraStats();
    showToast(`Task "${taskName}" added to Ora!`, 'success');
}

/**
 * Delete a daily task
 */
function deleteOraTask(taskId) {
    oraDailyTasks = oraDailyTasks.filter(task => task.id !== taskId);
    saveOraTasks();
    renderOraTasksList();
    updateOraStats();
    showToast('Task deleted', 'info');
}

/**
 * Render the list of daily tasks
 */
function renderOraTasksList() {
    const container = document.getElementById('ora-tasks-list');
    if (!container) return;

    if (oraDailyTasks.length === 0) {
        container.innerHTML = '<div class="ora-empty-state"><p>No tasks added yet. Add your first task above!</p></div>';
        return;
    }

    container.innerHTML = oraDailyTasks.map(task => {
        const statusBadgeClass = task.status === 'active' 
            ? 'ora-task-status-active' 
            : task.status === 'completed' 
            ? 'ora-task-status-completed' 
            : 'ora-task-status-pending';
        
        const statusLabel = task.status.charAt(0).toUpperCase() + task.status.slice(1);
        
        return `
            <div class="ora-task-item" data-task-id="${task.id}">
                <div class="ora-task-content">
                    <p class="ora-task-name">${escapeHtml(task.name)}</p>
                    <div class="ora-task-time">
                        <span aria-hidden="true">🕐</span>
                        <span>${task.startTime}</span>
                        <span>→</span>
                        <span>${task.endTime}</span>
                    </div>
                    ${task.description !== 'none' ? `<p class="ora-task-description">${escapeHtml(task.description)}</p>` : ''}
                </div>
                <div class="ora-task-actions">
                    <span class="ora-task-status-badge ${statusBadgeClass}">${statusLabel}</span>
                    <button class="btn btn-danger delete-task-btn" onclick="deleteOraTask('${task.id}')" aria-label="Delete task">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update Ora statistics (total tasks, work hours)
 */
function updateOraStats() {
    const totalTasksEl = document.getElementById('ora-total-tasks');
    const workHoursEl = document.getElementById('ora-work-hours');
    
    if (totalTasksEl) totalTasksEl.textContent = oraDailyTasks.length;
    
    if (workHoursEl) {
        let totalMinutes = 0;
        oraDailyTasks.forEach(task => {
            const [startH, startM] = task.startTime.split(':').map(Number);
            const [endH, endM] = task.endTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;
            const taskMinutes = endMinutes - startMinutes;
            totalMinutes += taskMinutes > 0 ? taskMinutes : 0;
        });
        
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        workHoursEl.textContent = `${hours}h ${minutes}m`;
    }
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Get current time in HH:MM format
 */
function getCurrentTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * Initialize Ora task scheduler
 */
function initOraScheduler() {
    if (oraSchedulerInterval) clearInterval(oraSchedulerInterval);
    
    oraSchedulerInterval = setInterval(() => {
        const currentTime = getCurrentTime();
        const currentMinutes = timeToMinutes(currentTime);
        
        oraDailyTasks.forEach(task => {
            const taskStartMinutes = timeToMinutes(task.startTime);
            const taskEndMinutes = timeToMinutes(task.endTime);
            
            // Check if task should be marked as active
            if (currentMinutes >= taskStartMinutes && currentMinutes < taskEndMinutes && task.status === 'pending') {
                task.status = 'active';
                const notificationKey = `${task.id}_start`;
                
                if (!oraLastNotifiedTime[notificationKey]) {
                    sendOraTaskNotification(task, 'start');
                    oraLastNotifiedTime[notificationKey] = true;
                }
                saveOraTasks();
            }
            
            // Check if task should be marked as completed
            if (currentMinutes >= taskEndMinutes && task.status !== 'completed') {
                task.status = 'completed';
                const notificationKey = `${task.id}_end`;
                
                if (!oraLastNotifiedTime[notificationKey]) {
                    const nextTask = findNextTask(task);
                    if (nextTask) {
                        sendOraTaskTransitionNotification(task, nextTask);
                    } else {
                        sendOraTaskCompletionNotification(task);
                    }
                    oraLastNotifiedTime[notificationKey] = true;
                }
                saveOraTasks();
            }
        });
        
        renderOraTasksList();
    }, 60000); // Check every minute
}

/**
 * Find the next task after the given task
 */
function findNextTask(currentTask) {
    const taskEnd = timeToMinutes(currentTask.endTime);
    const nextTasks = oraDailyTasks.filter(t => 
        timeToMinutes(t.startTime) >= taskEnd && t.id !== currentTask.id && t.status === 'pending'
    );
    return nextTasks.length > 0 ? nextTasks[0] : null;
}

/**
 * Send task start notification
 */
async function sendOraTaskNotification(task, type) {
    const userEmail = currentUser?.email;
    if (!userEmail) return;

    try {
        await sendOraEmail(
            `Task started: ${task.name}`,
            `Your task "${task.name}" started at ${task.startTime}.`
        );
        showToast(`Email sent for ${task.name}`, 'success');
    } catch (error) {
        console.error('Ora start email error:', error);
        showToast(error.message, 'warning');
    }
}

/**
 * Send task transition notification (task end + next task start)
 */
async function sendOraTaskTransitionNotification(completedTask, nextTask) {
    const userEmail = currentUser?.email;
    if (!userEmail) return;

    try {
        await sendOraEmail(
            `Task completed: ${completedTask.name}`,
            `"${completedTask.name}" ended. Your next task, "${nextTask.name}", starts at ${nextTask.startTime}.`
        );
        showToast(`Email sent for ${nextTask.name}`, 'success');
    } catch (error) {
        console.error('Ora transition email error:', error);
        showToast(error.message, 'warning');
    }
}

/**
 * Send task completion notification
 */
async function sendOraTaskCompletionNotification(task) {
    const userEmail = currentUser?.email;
    if (!userEmail) return;

    try {
        await sendOraEmail(
            `Task completed: ${task.name}`,
            `Your task "${task.name}" ended at ${task.endTime}.`
        );
        showToast(`Completion email sent for ${task.name}`, 'success');
    } catch (error) {
        console.error('Ora completion email error:', error);
        showToast(error.message, 'warning');
    }
}

/**
 * Send daily summary notification
 */
async function sendOraDailySummary() {
    const userEmail = currentUser?.email;
    if (!userEmail) {
        showToast('User email not found', 'warning');
        return;
    }
    
    if (oraDailyTasks.length === 0) {
        showToast('No tasks to summarize', 'warning');
        return;
    }
    
    const summary = oraDailyTasks
        .map(task => `${task.name}: ${task.startTime} - ${task.endTime}${task.description !== 'none' ? ` (${task.description})` : ''}`)
        .join('\n');

    try {
        await sendOraEmail(`Daily task summary - ${new Date().toLocaleDateString()}`, summary);
        showToast('Daily summary email sent.', 'success');
    } catch (error) {
        console.error('Ora summary email error:', error);
        showToast(error.message, 'warning');
    }
}

/**
 * Initialize Ora event listeners
 */
function initOraListeners() {
    const oraButton = document.getElementById('nav-ora');
    const oraForm = document.getElementById('ora-task-form');
    const oraSummaryBtn = document.getElementById('ora-send-summary-btn');
    
    if (oraButton) {
        oraButton.addEventListener('click', () => {
            openPanel('ora-panel');
            loadOraTasks();
            loadOraTasksFromCloud();
            renderOraTasksList();
            updateOraStats();
        });
    }
    
    if (oraForm) {
        oraForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskName = document.getElementById('ora-task-name').value.trim();
            const taskDescription = document.getElementById('ora-task-description').value.trim();
            const startTime = document.getElementById('ora-task-start').value;
            const endTime = document.getElementById('ora-task-end').value;
            
            if (!taskName || !startTime || !endTime) {
                showToast('Please fill in all required fields', 'warning');
                return;
            }
            
            if (startTime >= endTime) {
                showToast('End time must be after start time', 'warning');
                return;
            }
            
            await addOraTask(taskName, taskDescription, startTime, endTime);
            oraForm.reset();
        });
    }
    
    if (oraSummaryBtn) {
        oraSummaryBtn.addEventListener('click', sendOraDailySummary);
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    const sessionUser = loadSession();
    if (sessionUser) {
        initializeDashboardSession(sessionUser);
    } else {
        const authContainer = document.getElementById('auth-container');
        const dashContainer = document.getElementById('dashboard-container');
        if (authContainer) authContainer.classList.remove('hidden');
        if (dashContainer) dashContainer.classList.add('hidden');
        initAuthListeners();
        updateAuthModeUI();
    }

    window.closePanel = closePanel;
    window.closeAllPanels = closeAllPanels;
    window.closeModal = closeModal;
    window.openEditModal = openEditModal;
    window.deleteTask = deleteTask;
    window.showTaskDetail = showTaskDetail;
    window.runCycleDetection = runCycleDetection;
    window.runTopologicalSort = runTopologicalSort;
    window.sortByPriority = sortByPriority;
    window.sortByDeadline = sortByDeadline;
    window.clearOutput = clearOutput;
    window.deleteOraTask = deleteOraTask;
    window.sendOraDailySummary = sendOraDailySummary;
    
    // Initialize Ora
    loadOraTasks();
    if (currentUser) loadOraTasksFromCloud();
    initOraListeners();
    initOraScheduler();
});
