/**
 * Project: BD Job Autofill
 * Module: Profiles Page Controller
 * Purpose: Loads, renders, creates, updates, and deletes profiles via the
 *          background message API, binding all profiles.html interactions.
 * Author: Lead Engineer
 * Version: 1.3.0
 * Dependencies: background.js (message API)
 * Last Updated: 2026-07-06
 */

const TEXT_FIELD_KEYS = [
  'name',
  'fullName',
  'nameBn',
  'fatherName',
  'fatherBn',
  'motherName',
  'motherBn',
  'dateOfBirth',
  'gender',
  'nationality',
  'religion',
  'maritalStatus',
  'spouseName',
  'bloodGroup',
  'nidType',
  'nidNo',
  'birthRegNo',
  'passportNo',
  'mobile',
  'mobileConfirm',
  'email',
  'quota',
  'quotaDetails',
  'depStatus',
  'presentCareOf',
  'presentAddress',
  'presentDistrict',
  'presentUpazila',
  'presentPost',
  'presentPostcode',
  'permanentCareOf',
  'permanentAddress',
  'permanentDistrict',
  'permanentUpazila',
  'permanentPost',
  'permanentPostcode',
  'fatherOccupation',
  'sscExam',
  'sscRoll',
  'sscGroup',
  'sscGroupOther',
  'sscBoard',
  'sscBoardOther',
  'sscResultType',
  'sscResult',
  'sscYear',
  'hscExam',
  'hscRoll',
  'hscGroup',
  'hscGroupOther',
  'hscBoard',
  'hscBoardOther',
  'hscResultType',
  'hscResult',
  'hscYear',
  'bachelor',
  'master',
  'experienceComputer',
  'experienceSatlipi'
];

const CHECKBOX_FIELD_KEYS = ['sameAsPresent'];

const profileListEl = document.getElementById('profile-list');
const profileListEmptyEl = document.getElementById('profile-list-empty');
const profileFormEl = document.getElementById('profile-form');
const formEmptyHintEl = document.getElementById('form-empty-hint');
const formStatusEl = document.getElementById('form-status');
const newProfileBtn = document.getElementById('new-profile-btn');
const deleteProfileBtn = document.getElementById('delete-profile-btn');
const profileIdInput = document.getElementById('profile-id');
const copyFromProfileSelect = document.getElementById('copy-from-profile-select');
const copyFromProfileBtn = document.getElementById('copy-from-profile-btn');
const importJsonInput = document.getElementById('import-json-input');
const importJsonBtn = document.getElementById('import-json-btn');
const importStatusEl = document.getElementById('import-status');
const exportJsonBtn = document.getElementById('export-json-btn');

const ALL_PROFILE_FIELD_KEYS = [...TEXT_FIELD_KEYS, ...CHECKBOX_FIELD_KEYS];

let profiles = [];
let selectedProfileId = null;
let pendingImportFile = null;

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
 * Generates a reasonably unique identifier for a new profile.
 * @returns {string}
 */
function generateProfileId() {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Sets the form status line text and style.
 * @param {string} message
 * @param {'success'|'error'|''} tone
 */
function setFormStatus(message, tone) {
  formStatusEl.textContent = message;
  formStatusEl.className = 'form-status';
  if (tone) {
    formStatusEl.classList.add(`form-status--${tone}`);
  }
}

/**
 * Sets the import panel status line text and style.
 * @param {string} message
 * @param {'success'|'error'|''} tone
 */
function setImportStatus(message, tone) {
  importStatusEl.textContent = message;
  importStatusEl.className = 'form-status';
  if (tone) {
    importStatusEl.classList.add(`form-status--${tone}`);
  }
}

/**
 * Renders the profile list sidebar based on current profiles array.
 */
function renderProfileList() {
  profileListEl.innerHTML = '';

  if (profiles.length === 0) {
    profileListEmptyEl.hidden = false;
  } else {
    profileListEmptyEl.hidden = true;

    for (const profile of profiles) {
      const li = document.createElement('li');
      li.className = 'profile-list__item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'profile-list__button';
      if (profile.id === selectedProfileId) {
        button.classList.add('profile-list__button--active');
      }
      button.textContent = profile.name || 'Unnamed profile';
      button.addEventListener('click', () => selectProfile(profile.id));

      li.appendChild(button);
      profileListEl.appendChild(li);
    }
  }

  renderCopyFromProfileOptions();
}

/**
 * Populates the "copy from a saved profile" dropdown from the current
 * profiles array, preserving the previously selected value if still valid.
 */
function renderCopyFromProfileOptions() {
  const previousValue = copyFromProfileSelect.value;
  copyFromProfileSelect.innerHTML = '<option value="">Select a profile…</option>';

  for (const profile of profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name || 'Unnamed profile';
    copyFromProfileSelect.appendChild(option);
  }

  if (profiles.some((p) => p.id === previousValue)) {
    copyFromProfileSelect.value = previousValue;
  }
  copyFromProfileBtn.disabled = profiles.length === 0;
}

/**
 * Populates the form fields with a given profile's data.
 * @param {object} profile
 */
function populateForm(profile) {
  profileIdInput.value = profile.id || '';

  for (const key of TEXT_FIELD_KEYS) {
    const input = document.getElementById(`field-${key}`);
    if (!input) {
      continue;
    }
    if (key === 'nationality' && !profile.id && profile[key] === undefined) {
      input.value = 'Bangladeshi';
      continue;
    }
    input.value = profile[key] || '';
  }

  for (const key of CHECKBOX_FIELD_KEYS) {
    const input = document.getElementById(`field-${key}`);
    if (input) {
      input.checked = Boolean(profile[key]);
    }
  }
}

/**
 * Reads current form field values into a profile object.
 * @returns {object}
 */
function readFormData() {
  const data = { id: profileIdInput.value || generateProfileId() };

  for (const key of TEXT_FIELD_KEYS) {
    const input = document.getElementById(`field-${key}`);
    if (input) {
      data[key] = input.value.trim();
    }
  }

  for (const key of CHECKBOX_FIELD_KEYS) {
    const input = document.getElementById(`field-${key}`);
    if (input) {
      data[key] = input.checked;
    }
  }

  return data;
}

/**
 * Selects a profile by id, populating the form for editing.
 * @param {string} profileId
 */
function selectProfile(profileId) {
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) {
    return;
  }

  selectedProfileId = profileId;
  formEmptyHintEl.hidden = true;
  profileFormEl.hidden = false;
  deleteProfileBtn.hidden = false;
  setFormStatus('', '');
  populateForm(profile);
  renderProfileList();
}

/**
 * Prepares the form for creating a new profile.
 */
function startNewProfile() {
  selectedProfileId = null;
  formEmptyHintEl.hidden = true;
  profileFormEl.hidden = false;
  deleteProfileBtn.hidden = true;
  setFormStatus('', '');
  populateForm({ id: '' });
  renderProfileList();
  document.getElementById('field-name').focus();
}

/**
 * Handles profile form submission: validates and saves via message API.
 * @param {SubmitEvent} event
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('field-name').value.trim();
  if (!name) {
    setFormStatus('Profile label is required.', 'error');
    return;
  }

  const data = readFormData();

  try {
    profiles = await sendMessage('SAVE_PROFILE', data);
    selectedProfileId = data.id;
    setFormStatus('Profile saved.', 'success');
    renderProfileList();
    deleteProfileBtn.hidden = false;
  } catch (error) {
    setFormStatus(error.message, 'error');
  }
}

/**
 * Handles delete button click: confirms and removes the selected profile.
 */
async function handleDeleteClick() {
  if (!selectedProfileId) {
    return;
  }

  const confirmed = window.confirm('Delete this profile? This cannot be undone.');
  if (!confirmed) {
    return;
  }

  try {
    profiles = await sendMessage('DELETE_PROFILE', selectedProfileId);
    selectedProfileId = null;
    profileFormEl.hidden = true;
    formEmptyHintEl.hidden = false;
    renderProfileList();
  } catch (error) {
    setFormStatus(error.message, 'error');
  }
}

/**
 * Handles the "same as present address" checkbox: copies present address
 * fields into permanent address fields and disables permanent inputs.
 */
function handleSameAsPresentChange() {
  const checkbox = document.getElementById('field-sameAsPresent');
  const mapping = {
    presentCareOf: 'permanentCareOf',
    presentAddress: 'permanentAddress',
    presentDistrict: 'permanentDistrict',
    presentUpazila: 'permanentUpazila',
    presentPost: 'permanentPost',
    presentPostcode: 'permanentPostcode'
  };

  for (const [sourceKey, targetKey] of Object.entries(mapping)) {
    const sourceInput = document.getElementById(`field-${sourceKey}`);
    const targetInput = document.getElementById(`field-${targetKey}`);
    if (!sourceInput || !targetInput) {
      continue;
    }
    if (checkbox.checked) {
      targetInput.value = sourceInput.value;
      targetInput.disabled = true;
    } else {
      targetInput.disabled = false;
    }
  }
}

/**
 * Returns a sample profile object based on the data from the provided
 * "Save Document - Study Online Bd.html" file, now with values that match
 * the BSDB Teletalk form options exactly.
 * @returns {object}
 */
function getSampleProfileData() {
  return {
    id: '',
    name: 'Habib',
    fullName: 'MD. HABIBUR RAHMAN',
    nameBn: 'মোঃ হাবিবুর রহমান',
    fatherName: 'MD. ABDUS SOBAHAN',
    fatherBn: 'মোঃ আব্দুস সোবহান',
    motherName: 'MST. HAMIDA BEGUM',
    motherBn: 'মোছাঃ হামিদা বেগম',
    dateOfBirth: '1994-12-20',
    gender: 'Male',
    nationality: 'Bangladeshi',
    religion: 'Islam',
    maritalStatus: 'Married',
    spouseName: 'MST. SADIYA AKHTER',
    bloodGroup: '',
    nidType: 'NID',
    nidNo: '3254367778',
    birthRegNo: '',
    passportNo: '',
    mobile: '01771522503',
    mobileConfirm: '01771522503',
    email: 'habiblinkage@gmail.com',
    quota: 'Not Applicable',
    quotaDetails: '',
    depStatus: 'Not Applicable',
    presentCareOf: 'MD. ABDUS SOBAHAN',
    presentAddress: 'SHOHORDIGHI UTTAR PARA',
    presentDistrict: '10',      // Bogura
    presentUpazila: '43',       // Bogra Sadar
    presentPost: 'FAPORE',
    presentPostcode: '5800',
    permanentCareOf: 'MD. ABDUS SOBAHAN',
    permanentAddress: 'SHOHORDIGHI UTTAR PARA',
    permanentDistrict: '10',
    permanentUpazila: '43',
    permanentPost: 'FAPORE',
    permanentPostcode: '5800',
    sameAsPresent: true,
    fatherOccupation: '',
    sscExam: 'S.S.C',
    sscRoll: '124300',
    sscGroup: 'Science',
    sscGroupOther: '',
    sscBoard: 'Rajshahi',
    sscBoardOther: '',
    sscResultType: 'GPA(out of 5)',
    sscResult: '4.38',
    sscYear: '2010',
    hscExam: 'H.S.C',
    hscRoll: '130381',
    hscGroup: 'Science',
    hscGroupOther: '',
    hscBoard: 'Rajshahi',
    hscBoardOther: '',
    hscResultType: 'GPA(out of 5)',
    hscResult: '4.50',
    hscYear: '2012',
    bachelor: 'B.Sc (Honors) in Zoology, National University, 2016, CGPA 3.43',
    master: 'M.Sc in Zoology, National University, 2017, CGPA 3.61',
    experienceComputer: 'Yes',
    experienceSatlipi: 'Yes'
  };
}

/**
 * Loads all profiles from storage on page initialization.
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    profiles = await sendMessage('GET_PROFILES');
    renderProfileList();
  } catch (error) {
    setFormStatus(error.message, 'error');
  }
}

// --- Event Listeners ---

newProfileBtn.addEventListener('click', startNewProfile);
profileFormEl.addEventListener('submit', handleFormSubmit);
deleteProfileBtn.addEventListener('click', handleDeleteClick);
document.getElementById('field-sameAsPresent').addEventListener('change', handleSameAsPresentChange);

// --- Sample Profile event listeners ---

const loadSampleBtn = document.getElementById('load-sample-btn');
const showSampleJsonBtn = document.getElementById('show-sample-json-btn');
const sampleJsonDisplay = document.getElementById('sample-json-display');

if (loadSampleBtn) {
  loadSampleBtn.addEventListener('click', () => {
    const sample = getSampleProfileData();
    selectedProfileId = null;
    formEmptyHintEl.hidden = true;
    profileFormEl.hidden = false;
    deleteProfileBtn.hidden = true;
    setFormStatus('Sample profile loaded. You can edit and save.', 'success');
    populateForm(sample);
    renderProfileList();
    const sameCheckbox = document.getElementById('field-sameAsPresent');
    if (sameCheckbox) {
      sameCheckbox.checked = true;
      sameCheckbox.dispatchEvent(new Event('change'));
    }
  });
}

if (showSampleJsonBtn) {
  showSampleJsonBtn.addEventListener('click', () => {
    if (sampleJsonDisplay.style.display === 'none') {
      const sample = getSampleProfileData();
      sampleJsonDisplay.textContent = JSON.stringify(sample, null, 2);
      sampleJsonDisplay.style.display = 'block';
      showSampleJsonBtn.textContent = 'Hide Sample JSON';
    } else {
      sampleJsonDisplay.style.display = 'none';
      showSampleJsonBtn.textContent = 'Show Sample JSON';
    }
  });
}

initialize();      if (chrome.runtime.lastError) {
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
 * Generates a reasonably unique identifier for a new profile.
 * @returns {string}
 */
function generateProfileId() {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Sets the form status line text and style.
 * @param {string} message
 * @param {'success'|'error'|''} tone
 */
function setFormStatus(message, tone) {
  formStatusEl.textContent = message;
  formStatusEl.className = 'form-status';
  if (tone) {
    formStatusEl.classList.add(`form-status--${tone}`);
  }
}

/**
 * Sets the import panel status line text and style.
 * @param {string} message
 * @param {'success'|'error'|''} tone
 */
function setImportStatus(message, tone) {
  importStatusEl.textContent = message;
  importStatusEl.className = 'form-status';
  if (tone) {
    importStatusEl.classList.add(`form-status--${tone}`);
  }
}

/**
 * Renders the profile list sidebar based on current profiles array.
 */
function renderProfileList() {
  profileListEl.innerHTML = '';

  if (profiles.length === 0) {
    profileListEmptyEl.hidden = false;
  } else {
    profileListEmptyEl.hidden = true;

    for (const profile of profiles) {
      const li = document.createElement('li');
      li.className = 'profile-list__item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'profile-list__button';
      if (profile.id === selectedProfileId) {
        button.classList.add('profile-list__button--active');
      }
      button.textContent = profile.name || 'Unnamed profile';
      button.addEventListener('click', () => selectProfile(profile.id));

      li.appendChild(button);
      profileListEl.appendChild(li);
    }
  }

  renderCopyFromProfileOptions();
}

/**
 * Populates the "copy from a saved profile" dropdown from the current
 * profiles array, preserving the previously selected value if still valid.
 */
function renderCopyFromProfileOptions() {
  const previousValue = copyFromProfileSelect.value;
  copyFromProfileSelect.innerHTML = '<option value="">Select a profile…</option>';

  for (const profile of profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name || 'Unnamed profile';
    copyFromProfileSelect.appendChild(option);
  }

  if (profiles.some((p) => p.id === previousValue)) {
    copyFromProfileSelect.value = previousValue;
  }
  copyFromProfileBtn.disabled = profiles.length === 0;
}

/**
 * Populates the form fields with a given profile's data.
 * @param {object} profile
 */
function populateForm(profile) {
  profileIdInput.value = profile.id || '';

  for (const key of TEXT_FIELD_KEYS) {
    const input = document.getElementById(`field-${key}`);
    if (!input) {
      continue;
    }
    if (key === 'nationality' && !profile.id && profile[key] === undefined) {
      input.value = 'Bangladeshi';
      continue;
    }
    input.value = profile[key] || '';
  }

  for (const key of CHECKBOX_FIELD_KEYS) {
    const input = document.getElementById(`field-${key}`);
    if (input) {
      input.checked = Boolean(profile[key]);
    }
  }
}

/**
 * Reads current form field values into a profile object.
 * @returns {object}
 */
function readFormData() {
  const data = { id: profileIdInput.value || generateProfileId() };

  for (const key of TEXT_FIELD_KEYS) {
    const input = document.getElementById(`field-${key}`);
    if (input) {
      data[key] = input.value.trim();
    }
  }

  for (const key of CHECKBOX_FIELD_KEYS) {
    const input = document.getElementById(`field-${key}`);
    if (input) {
      data[key] = input.checked;
    }
  }

  return data;
}

/**
 * Selects a profile by id, populating the form for editing.
 * @param {string} profileId
 */
function selectProfile(profileId) {
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) {
    return;
  }

  selectedProfileId = profileId;
  formEmptyHintEl.hidden = true;
  profileFormEl.hidden = false;
  deleteProfileBtn.hidden = false;
  setFormStatus('', '');
  populateForm(profile);
  renderProfileList();
}

/**
 * Prepares the form for creating a new profile.
 */
function startNewProfile() {
  selectedProfileId = null;
  formEmptyHintEl.hidden = true;
  profileFormEl.hidden = false;
  deleteProfileBtn.hidden = true;
  setFormStatus('', '');
  populateForm({ id: '' });
  renderProfileList();
  document.getElementById('field-name').focus();
}

/**
 * Handles profile form submission: validates and saves via message API.
 * @param {SubmitEvent} event
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('field-name').value.trim();
  if (!name) {
    setFormStatus('Profile label is required.', 'error');
    return;
  }

  const data = readFormData();

  try {
    profiles = await sendMessage('SAVE_PROFILE', data);
    selectedProfileId = data.id;
    setFormStatus('Profile saved.', 'success');
    renderProfileList();
    deleteProfileBtn.hidden = false;
  } catch (error) {
    setFormStatus(error.message, 'error');
  }
}

/**
 * Handles delete button click: confirms and removes the selected profile.
 */
async function handleDeleteClick() {
  if (!selectedProfileId) {
    return;
  }

  const confirmed = window.confirm('Delete this profile? This cannot be undone.');
  if (!confirmed) {
    return;
  }

  try {
    profiles = await sendMessage('DELETE_PROFILE', selectedProfileId);
    selectedProfileId = null;
    profileFormEl.hidden = true;
    formEmptyHintEl.hidden = false;
    renderProfileList();
  } catch (error) {
    setFormStatus(error.message, 'error');
  }
}

/**
 * Handles the "same as present address" checkbox: copies present address
 * fields into permanent address fields and disables permanent inputs.
 */
function handleSameAsPresentChange() {
  const checkbox = document.getElementById('field-sameAsPresent');
  const mapping = {
    presentCareOf: 'permanentCareOf',
    presentAddress: 'permanentAddress',
    presentDistrict: 'permanentDistrict',
    presentUpazila: 'permanentUpazila',
    presentPost: 'permanentPost',
    presentPostcode: 'permanentPostcode'
  };

  for (const [sourceKey, targetKey] of Object.entries(mapping)) {
    const sourceInput = document.getElementById(`field-${sourceKey}`);
    const targetInput = document.getElementById(`field-${targetKey}`);
    if (!sourceInput || !targetInput) {
      continue;
    }
    if (checkbox.checked) {
      targetInput.value = sourceInput.value;
      targetInput.disabled = true;
    } else {
      targetInput.disabled = false;
    }
  }
}

/**
 * Returns a sample profile object based on the data from the provided
 * "Save Document - Study Online Bd.html" file, now with values that match
 * the BSDB Teletalk form options.
 * @returns {object}
 */
function getSampleProfileData() {
  return {
    id: '',
    name: 'Habib',
    fullName: 'MD. HABIBUR RAHMAN',
    nameBn: 'মোঃ হাবিবুর রহমান',
    fatherName: 'MD. ABDUS SOBAHAN',
    fatherBn: 'মোঃ আব্দুস সোবহান',
    motherName: 'MST. HAMIDA BEGUM',
    motherBn: 'মোছাঃ হামিদা বেগম',
    dateOfBirth: '1994-12-20',
    gender: 'Male',
    nationality: 'Bangladeshi',
    religion: 'Islam',
    maritalStatus: 'Married',
    spouseName: 'MST. SADIYA AKHTER',
    bloodGroup: '',
    nidType: 'NID',
    nidNo: '3254367778',
    birthRegNo: '',
    passportNo: '',
    mobile: '01771522503',
    mobileConfirm: '01771522503',
    email: 'habiblinkage@gmail.com',
    // Changed to match BSDB options
    quota: 'Not Applicable',
    quotaDetails: '',
    depStatus: 'Not Applicable',
    presentCareOf: 'MD. ABDUS SOBAHAN',
    presentAddress: 'SHOHORDIGHI UTTAR PARA',
    presentDistrict: '10',
    presentUpazila: '43',
    presentPost: 'FAPORE',
    presentPostcode: '5800',
    permanentCareOf: 'MD. ABDUS SOBAHAN',
    permanentAddress: 'SHOHORDIGHI UTTAR PARA',
    permanentDistrict: '10',
    permanentUpazila: '43',
    permanentPost: 'FAPORE',
    permanentPostcode: '5800',
    sameAsPresent: true,
    fatherOccupation: '',
    sscExam: 'SSC',
    sscRoll: '124300',
    sscGroup: 'Science',
    sscGroupOther: '',
    sscBoard: 'Rajshahi',
    sscBoardOther: '',
    sscResultType: 'GPA',
    sscResult: '4.38',
    sscYear: '2010',
    hscExam: 'HSC',
    hscRoll: '130381',
    hscGroup: 'Science',
    hscGroupOther: '',
    hscBoard: 'Rajshahi',
    hscBoardOther: '',
    hscResultType: 'GPA',
    hscResult: '4.50',
    hscYear: '2012',
    bachelor: 'B.Sc (Honors) in Zoology, National University, 2016, CGPA 3.43',
    master: 'M.Sc in Zoology, National University, 2017, CGPA 3.61',
    experienceComputer: 'Yes',
    experienceSatlipi: 'Yes'
  };
}

/**
 * Loads all profiles from storage on page initialization.
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    profiles = await sendMessage('GET_PROFILES');
    renderProfileList();
  } catch (error) {
    setFormStatus(error.message, 'error');
  }
}

// --- Event Listeners ---

newProfileBtn.addEventListener('click', startNewProfile);
profileFormEl.addEventListener('submit', handleFormSubmit);
deleteProfileBtn.addEventListener('click', handleDeleteClick);
document.getElementById('field-sameAsPresent').addEventListener('change', handleSameAsPresentChange);

// --- Sample Profile event listeners ---

const loadSampleBtn = document.getElementById('load-sample-btn');
const showSampleJsonBtn = document.getElementById('show-sample-json-btn');
const sampleJsonDisplay = document.getElementById('sample-json-display');

if (loadSampleBtn) {
  loadSampleBtn.addEventListener('click', () => {
    const sample = getSampleProfileData();
    selectedProfileId = null;
    formEmptyHintEl.hidden = true;
    profileFormEl.hidden = false;
    deleteProfileBtn.hidden = true;
    setFormStatus('Sample profile loaded. You can edit and save.', 'success');
    populateForm(sample);
    renderProfileList();
    const sameCheckbox = document.getElementById('field-sameAsPresent');
    if (sameCheckbox) {
      sameCheckbox.checked = true;
      sameCheckbox.dispatchEvent(new Event('change'));
    }
  });
}

if (showSampleJsonBtn) {
  showSampleJsonBtn.addEventListener('click', () => {
    if (sampleJsonDisplay.style.display === 'none') {
      const sample = getSampleProfileData();
      sampleJsonDisplay.textContent = JSON.stringify(sample, null, 2);
      sampleJsonDisplay.style.display = 'block';
      showSampleJsonBtn.textContent = 'Hide Sample JSON';
    } else {
      sampleJsonDisplay.style.display = 'none';
      showSampleJsonBtn.textContent = 'Show Sample JSON';
    }
  });
}

initialize();
