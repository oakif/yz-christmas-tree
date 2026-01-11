// Settings and password modal logic

let settingsAutoCloseTimer = null;
let settingsCountdown = 10;

// These will be set via init
let availableImageSets = [];
let currentImageSet = null;
let CONFIG = null;
let switchImageSetFn = null;
let loadEncryptedImageSetFn = null;

export function initModals(config, imageSets, callbacks) {
    CONFIG = config;
    availableImageSets = imageSets;
    switchImageSetFn = callbacks.switchImageSet;
    loadEncryptedImageSetFn = callbacks.loadEncryptedImageSet;
    currentImageSet = callbacks.getCurrentImageSet?.() || null;

    setupPasswordModalListeners();
    setupSettingsModalListeners();
}

export function updateImageSets(imageSets, current) {
    availableImageSets = imageSets;
    currentImageSet = current;
}

export function setCurrentImageSet(set) {
    currentImageSet = set;
}

export function showSettingsModal(withCountdown = false) {
    const modal = document.getElementById('settings-modal');
    const select = document.getElementById('settings-image-set');

    // Populate dropdown from availableImageSets
    select.innerHTML = '';
    availableImageSets.forEach(set => {
        const option = document.createElement('option');
        option.value = set.id;
        option.textContent = set.name;
        if (currentImageSet && currentImageSet.id === set.id) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    // Sync reassemble checkbox with current config
    document.getElementById('settings-reassemble').checked = CONFIG.reassembleOnClick;

    // Hide password row when opening modal
    hideSettingsPasswordRow();

    const closeBtn = document.getElementById('settings-close');

    // Only start auto-close countdown on initial page load
    if (withCountdown) {
        settingsCountdown = CONFIG.settingsAutoCloseSeconds || 5;
        closeBtn.textContent = `Begin (${settingsCountdown}s)`;

        settingsAutoCloseTimer = setInterval(() => {
            settingsCountdown--;
            if (settingsCountdown <= 0) {
                hideSettingsModal();
            } else {
                closeBtn.textContent = `Begin (${settingsCountdown}s)`;
            }
        }, 1000);
    } else {
        closeBtn.textContent = 'Save';
    }

    // Set CSS variable for fade duration
    const fadeDuration = CONFIG.modalFadeDuration || 300;
    modal.style.setProperty('--modal-fade-duration', `${fadeDuration}ms`);

    // Show modal with fade-in
    modal.classList.add('fade-in');
    modal.classList.remove('hidden', 'fade-out');
    // Force reflow then remove fade-in to trigger transition
    modal.offsetHeight;
    modal.classList.remove('fade-in');
}

export function hideSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const fadeDuration = CONFIG.modalFadeDuration || 300;

    if (settingsAutoCloseTimer) {
        clearInterval(settingsAutoCloseTimer);
        settingsAutoCloseTimer = null;
    }

    // Fade out then hide
    modal.classList.add('fade-out');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('fade-out');
    }, fadeDuration);
}

export function cancelSettingsAutoClose() {
    if (settingsAutoCloseTimer) {
        clearInterval(settingsAutoCloseTimer);
        settingsAutoCloseTimer = null;
        // Update button text when countdown is cancelled
        document.getElementById('settings-close').textContent = 'Save';
    }
}

// Settings password row functions
export function showSettingsPasswordRow(set) {
    const row = document.getElementById('settings-password-row');
    const setName = document.getElementById('settings-password-set-name');
    const input = document.getElementById('settings-password');
    const error = document.getElementById('settings-password-error');
    const submitBtn = document.getElementById('settings-password-submit');

    setName.textContent = set.name;
    input.value = '';
    error.classList.add('hidden');
    submitBtn.textContent = 'Enter';
    row.classList.remove('hidden');
    input.focus();
}

export function hideSettingsPasswordRow() {
    const row = document.getElementById('settings-password-row');
    row.classList.add('hidden');
}

// Password modal functions
export function showPasswordPrompt(set) {
    const modal = document.getElementById('password-modal');
    const setNameEl = document.getElementById('password-set-name');
    const input = document.getElementById('password-input');
    const error = document.getElementById('password-error');

    setNameEl.textContent = `Enter password for "${set.name}"`;
    input.value = '';
    error.classList.add('hidden');
    modal.classList.remove('hidden');
    input.focus();
}

export function hidePasswordPrompt() {
    const modal = document.getElementById('password-modal');
    modal.classList.add('hidden');
}

function setupPasswordModalListeners() {
    document.getElementById('password-submit').addEventListener('click', async () => {
        const input = document.getElementById('password-input');
        const error = document.getElementById('password-error');
        const password = input.value;

        try {
            await loadEncryptedImageSetFn(currentImageSet, password);
            hidePasswordPrompt();
        } catch (e) {
            error.classList.remove('hidden');
            console.warn('Decryption failed:', e);
        }
    });

    document.getElementById('password-cancel').addEventListener('click', () => {
        hidePasswordPrompt();
    });

    document.getElementById('password-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('password-submit').click();
        }
    });
}

function setupSettingsModalListeners() {
    document.getElementById('settings-icon').addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });

    document.getElementById('settings-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        showSettingsModal();
    });

    document.getElementById('settings-close').addEventListener('click', () => {
        hideSettingsModal();
    });

    document.getElementById('settings-image-set').addEventListener('change', async (e) => {
        cancelSettingsAutoClose();
        const set = availableImageSets.find(s => s.id === e.target.value);
        if (!set) return;

        // Always call switchImageSet to clear previous state
        await switchImageSetFn(e.target.value);
        currentImageSet = set;

        if (set.encrypted) {
            // Show password input inline
            showSettingsPasswordRow(set);
        } else {
            hideSettingsPasswordRow();
        }
    });

    // Prevent clicks on settings modal from triggering tree explosion
    document.getElementById('settings-modal').addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });

    // Cancel auto-close on any interaction with settings modal content
    // Click on overlay (outside modal-content) dismisses the modal
    document.getElementById('settings-modal').addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') {
            // Clicked on overlay, dismiss modal
            hideSettingsModal();
        } else {
            // Clicked inside modal content, cancel auto-close
            cancelSettingsAutoClose();
        }
    });

    // Reassemble checkbox
    document.getElementById('settings-reassemble').addEventListener('change', (e) => {
        CONFIG.reassembleOnClick = e.target.checked;
    });

    // Settings password submit
    document.getElementById('settings-password-submit').addEventListener('click', async () => {
        const input = document.getElementById('settings-password');
        const error = document.getElementById('settings-password-error');
        const submitBtn = document.getElementById('settings-password-submit');
        const password = input.value;

        try {
            await loadEncryptedImageSetFn(currentImageSet, password);
            error.classList.add('hidden');
            submitBtn.textContent = '\u2713';
        } catch (e) {
            error.classList.remove('hidden');
        }
    });

    // Settings password enter key
    document.getElementById('settings-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('settings-password-submit').click();
        }
    });
}
