/**
 * Project: BD Job Autofill
 * Module: Popup Controller
 * Purpose: Populates profile selector, wires autofill trigger, and routes
 *          navigation to profile/application management views.
 * Author: Lead Engineer
 * Version: 1.3.0
 * Dependencies: background.js (message API), content-script.js (AUTOFILL_PAGE)
 * Last Updated: 2026-07-06
 */

const profileSelect = document.getElementById('profile-select');
const profileEmptyHint = document.getElementById('profile-empty-hint');
const autofillBtn = document.getElementById('autofill-btn');
const autofillStatus = document.getElementById('autofill-status');
const manageProfilesBtn = document.getElementById('manage-profiles-btn');
const manageApplicationsBtn = document.getElementById('manage-applications-btn');

/**
 * Sends a message to the background service worker.
 * @param {string} type
 * @param {any} [payload]
 * @returns {Promise<any>}
 */
function sendMessage(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error((response && response.error) || 'Unknown error.'));
        return;
      }
      resolve(response.data);
    });
  });
}

/**
 * Sets the status line text and style.
 * @param {string} message
 * @param {'success'|'error'|''} tone
 */
function setStatus(message, tone) {
  autofillStatus.textContent = message;
  autofillStatus.className = 'popup__status';
  if (tone) {
    autofillStatus.classList.add(`popup__status--${tone}`);
  }
}

/**
 * Loads profiles into the select element and restores active selection.
 * @returns {Promise<void>}
 */
async function loadProfiles() {
  const [profiles, activeProfile] = await Promise.all([
    sendMessage('GET_PROFILES'),
    sendMessage('GET_ACTIVE_PROFILE')
  ]);

  profileSelect.innerHTML = '';

  if (profiles.length === 0) {
    profileEmptyHint.hidden = false;
    profileSelect.disabled = true;
    autofillBtn.disabled = true;
    return;
  }

  profileEmptyHint.hidden = true;
  profileSelect.disabled = false;
  autofillBtn.disabled = false;

  for (const profile of profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name || 'Unnamed profile';
    profileSelect.appendChild(option);
  }

  let selectedId = activeProfile ? activeProfile.id : null;
  if (!selectedId || !profiles.some(p => p.id === selectedId)) {
    selectedId = profiles[0].id;
    await sendMessage('SET_ACTIVE_PROFILE', selectedId);
  }
  profileSelect.value = selectedId;
}

/**
 * Gets the active tab in the current window.
 * @returns {Promise<chrome.tabs.Tab>}
 */
function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!tabs[0]) {
        reject(new Error('No active tab found.'));
        return;
      }
      resolve(tabs[0]);
    });
  });
}

/**
 * Waits for a tab to finish loading.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (tab.status === 'complete') {
        resolve();
      } else {
        const listener = (updatedTabId, changeInfo) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      }
    });
  });
}

/**
 * Ensures the content script is injected into the active tab.
 * Retries up to 3 times with a delay.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
async function ensureContentScript(tabId) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      // Try to ping the content script
      await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      return; // success
    } catch (e) {
      attempts++;
      if (attempts >= maxAttempts) {
        // Last attempt – inject the script
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['teletalk-mapping.js', 'content-script.js']
          });
          // Wait a moment for the script to initialize
          await new Promise(resolve => setTimeout(resolve, 300));
          // Verify injection by pinging again
          await chrome.tabs.sendMessage(tabId, { type: 'PING' });
          return;
        } catch (injectErr) {
          throw new Error('Failed to inject content script. Please refresh the page and try again.');
        }
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

/**
 * Handles profile selection change: persists as active profile.
 * @returns {Promise<void>}
 */
async function handleProfileChange() {
  const profileId = profileSelect.value;
  try {
    await sendMessage('SET_ACTIVE_PROFILE', profileId);
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

/**
 * Handles autofill button click: sends fill command to content script.
 * @returns {Promise<void>}
 */
async function handleAutofillClick() {
  autofillBtn.disabled = true;
  setStatus('Filling form…', '');

  try {
    const activeProfile = await sendMessage('GET_ACTIVE_PROFILE');
    if (!activeProfile) {
      setStatus('No active profile selected.', 'error');
      return;
    }

    const tab = await getActiveTab();

    // Wait for tab to be fully loaded
    await waitForTabLoad(tab.id);

    // Ensure content script is loaded
    await ensureContentScript(tab.id);

    // Send autofill command
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'AUTOFILL_PAGE',
      payload: activeProfile
    });

    if (!response || !response.ok) {
      setStatus((response && response.error) || 'Autofill failed.', 'error');
      return;
    }

    setStatus(`Filled ${response.data.filledCount} field(s).`, 'success');
  } catch (error) {
    setStatus(error.message || 'Could not connect to page. Please refresh the page and try again.', 'error');
  } finally {
    autofillBtn.disabled = false;
  }
}

/**
 * Opens the profile management page in a new tab.
 */
function handleManageProfilesClick() {
  chrome.tabs.create({ url: chrome.runtime.getURL('profiles.html') });
}

/**
 * Opens the application tracker page in a new tab.
 */
function handleManageApplicationsClick() {
  chrome.tabs.create({ url: chrome.runtime.getURL('applications.html') });
}

profileSelect.addEventListener('change', handleProfileChange);
autofillBtn.addEventListener('click', handleAutofillClick);
manageProfilesBtn.addEventListener('click', handleManageProfilesClick);
manageApplicationsBtn.addEventListener('click', handleManageApplicationsClick);

loadProfiles().catch((error) => setStatus(error.message, 'error'));
