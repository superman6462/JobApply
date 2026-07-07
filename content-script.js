/**
 * Project: BD Job Autofill
 * Module: Content Script
 * Purpose: Detects form fields on the active page and fills them using the
 *          supplied profile data when triggered by the popup. Consults
 *          teletalk-mapping.js for exact name/id matches on Teletalk-style
 *          hostnames before falling back to generic label-text matching.
 * Author: Lead Engineer
 * Version: 1.7.0
 * Dependencies: teletalk-mapping.js
 * Last Updated: 2026-07-07
 */

/**
 * Maps profile field keys to arrays of matching patterns tested against
 * input name, id, placeholder, and associated label text (all lowercased).
 */
const FIELD_PATTERNS = {
  fullName: ['full name', 'fullname', 'name', 'applicant name', 'candidate name'],
  nameBn: ['name_bn', 'বাংলায়', 'bangla'],
  fatherName: ["father's name", 'father name', 'fathername'],
  fatherBn: ['father_bn', 'পিতার নাম'],
  motherName: ["mother's name", 'mother name', 'mothername'],
  motherBn: ['mother_bn', 'মাতার নাম'],
  dateOfBirth: ['date of birth', 'dob', 'birth date', 'birthdate'],
  gender: ['gender', 'sex'],
  nid: ['nid', 'national id', 'national identity'],
  mobile: ['mobile', 'phone', 'contact number', 'cell'],
  email: ['email', 'e-mail'],
  presentAddress: ['present address', 'current address', 'mailing address'],
  permanentAddress: ['permanent address'],
  district: ['district', 'zilla'],
  postOffice: ['post office', 'post-office'],
  postCode: ['post code', 'postcode', 'zip'],
  fatherOccupation: ["father's occupation", 'father occupation'],
  religion: ['religion'],
  nationality: ['nationality'],
  maritalStatus: ['marital status'],
  bloodGroup: ['blood group'],
  quota: ['quota'],
  depStatus: ['departmental', 'candidate status', 'dep status', 'ds'],
  ssc: ['ssc', 'secondary school certificate'],
  hsc: ['hsc', 'higher secondary certificate'],
  bachelor: ['bachelor', 'graduation', 'honours'],
  master: ['master', 'masters', 'post-graduation'],
  postCodeArea: ['thana', 'upazila'],
  experienceComputer: ['word processing', 'email', 'fax machine', 'computer efficiency', 'experience in computer'],
  experienceSatlipi: ['satlipi', 'typing speed', 'words per minute', 'wpm']
};

/**
 * Normalizes a string for pattern matching: lowercase, trimmed, collapsed spaces,
 * and removes punctuation like dots, dashes, etc. for fuzzy matching.
 * @param {string} value
 * @returns {string}
 */
function normalize(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[\s\.\-_,()']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds a searchable text blob describing a form element (name, id,
 * placeholder, aria-label, and any associated <label> text).
 * @param {HTMLElement} element
 * @returns {string}
 */
function describeElement(element) {
  const parts = [
    element.getAttribute('name'),
    element.getAttribute('id'),
    element.getAttribute('placeholder'),
    element.getAttribute('aria-label')
  ];

  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label) {
      parts.push(label.textContent);
    }
  }

  const parentLabel = element.closest('label');
  if (parentLabel) {
    parts.push(parentLabel.textContent);
  }

  return normalize(parts.filter(Boolean).join(' '));
}

/**
 * Finds the profile field key that best matches a form element's description.
 * @param {string} description
 * @returns {string|null}
 */
function matchFieldKey(description) {
  for (const [fieldKey, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      if (description.includes(pattern)) {
        return fieldKey;
      }
    }
  }
  return null;
}

/**
 * Sets a value on a text-like input/textarea and dispatches events so
 * frameworks (React/Vue/vanilla listeners) observe the change.
 * @param {HTMLInputElement|HTMLTextAreaElement} element
 * @param {string} value
 */
function setTextValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Selects a matching <option> in a <select> element by visible text or value.
 * Uses fuzzy matching to handle variations like "S.S.C" vs "SSC".
 * @param {HTMLSelectElement} element
 * @param {string} value
 * @returns {boolean} whether a match was applied
 */
function setSelectValue(element, value) {
  const target = normalize(value);
  for (const option of element.options) {
    if (target === normalize(option.textContent) || target === normalize(option.value)) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  for (const option of element.options) {
    const optText = normalize(option.textContent);
    if (optText.includes(target) && target.length > 0) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

/**
 * Checks a radio button whose value or label matches the given value.
 * @param {string} name
 * @param {string} value
 * @returns {boolean} whether a match was applied
 */
function setRadioValue(name, value) {
  const target = normalize(value);
  const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
  for (const radio of radios) {
    const description = describeElement(radio);
    if (description.includes(target) || normalize(radio.value) === target) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

/**
 * Resolves a profile field key for a form element: tries the Teletalk exact
 * name/id map first (when the active hostname qualifies), then falls back
 * to generic label-text matching so unmapped/new fields are still attempted.
 * @param {HTMLElement} element
 * @returns {string|null}
 */
function resolveFieldKey(element) {
  if (typeof isTeletalkHostname === 'function' && isTeletalkHostname(window.location.hostname)) {
    const exactKey = resolveTeletalkFieldKey(element.getAttribute('name'), element.getAttribute('id'));
    if (exactKey) {
      return exactKey;
    }
  }
  return matchFieldKey(describeElement(element));
}

/**
 * Special handling for specific form fields that need extra logic.
 * @param {HTMLElement} element
 * @param {object} profileData
 * @returns {boolean} whether the field was handled and filled
 */
function handleSpecialFields(element, profileData) {
  const name = element.getAttribute('name');
  const id = element.getAttribute('id');

  if (name === 'nid' || id === 'nid') {
    const hasNid = profileData.nidNo && profileData.nidNo.trim() !== '';
    const valueToSet = hasNid ? '1' : '0';
    const option = Array.from(element.options).find(opt => opt.value === valueToSet);
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  if (name === 'breg' || id === 'breg') {
    const hasBreg = profileData.birthRegNo && profileData.birthRegNo.trim() !== '';
    const valueToSet = hasBreg ? '1' : '0';
    const option = Array.from(element.options).find(opt => opt.value === valueToSet);
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  if (name === 'passport' || id === 'passport') {
    const hasPassport = profileData.passportNo && profileData.passportNo.trim() !== '';
    const valueToSet = hasPassport ? '1' : '0';
    const option = Array.from(element.options).find(opt => opt.value === valueToSet);
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  if (name === 'same_as_present' || id === 'same_as_present') {
    if (profileData.sameAsPresent) {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  if (name === 'if_applicable_gra' || id === 'if_applicable_gra') {
    if (profileData.bachelor && profileData.bachelor.trim() !== '') {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  if (name === 'if_applicable_mas' || id === 'if_applicable_mas') {
    if (profileData.master && profileData.master.trim() !== '') {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  if (name === 'agree' || id === 'agree') {
    element.checked = true;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
}

/**
 * Fills all matchable form fields on the page using the given profile.
 * @param {Record<string, string>} profileData
 * @returns {number} count of fields successfully filled
 */
function fillForm(profileData) {
  let filledCount = 0;
  const seenRadioNames = new Set();

  const formElements = document.querySelectorAll('input, select, textarea');

  for (const element of formElements) {
    const type = (element.getAttribute('type') || '').toLowerCase();

    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'file' || element.disabled) {
      continue;
    }

    if (handleSpecialFields(element, profileData)) {
      filledCount++;
      continue;
    }

    if (type === 'radio') {
      const name = element.getAttribute('name');
      if (!name || seenRadioNames.has(name)) {
        continue;
      }
      const fieldKey = resolveFieldKey(element) || matchFieldKey(name.toLowerCase());
      const profileValue = fieldKey ? profileData[fieldKey] : undefined;
      if (profileValue && setRadioValue(name, profileValue)) {
        filledCount += 1;
        seenRadioNames.add(name);
      }
      continue;
    }

    if (type === 'checkbox') {
      continue;
    }

    const fieldKey = resolveFieldKey(element);
    if (!fieldKey) {
      continue;
    }

    const profileValue = profileData[fieldKey];
    if (profileValue === undefined || profileValue === null || profileValue === '') {
      continue;
    }

    if (element.tagName === 'SELECT') {
      if (setSelectValue(element, profileValue)) {
        filledCount += 1;
      }
      continue;
    }

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      setTextValue(element, profileValue);
      filledCount += 1;
    }
  }

  return filledCount;
}

// Handle PING (readiness check) and AUTOFILL_PAGE messages from the popup.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'PING') {
    sendResponse({ ok: true });
    return true;
  }

  if (!message || message.type !== 'AUTOFILL_PAGE') {
    return false;
  }

  try {
    const filledCount = fillForm(message.payload || {});
    sendResponse({ ok: true, data: { filledCount } });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }

  return false;
});
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Selects a matching <option> in a <select> element by visible text or value.
 * Uses fuzzy matching to handle variations like "S.S.C" vs "SSC".
 */
function setSelectValue(element, value) {
  const target = normalize(value);
  for (const option of element.options) {
    if (target === normalize(option.textContent) || target === normalize(option.value)) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  // Fallback: contains match
  for (const option of element.options) {
    const optText = normalize(option.textContent);
    if (optText.includes(target) && target.length > 0) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

/**
 * Checks a radio button whose value or label matches the given value.
 */
function setRadioValue(name, value) {
  const target = normalize(value);
  const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
  for (const radio of radios) {
    const description = describeElement(radio);
    if (description.includes(target) || normalize(radio.value) === target) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

/**
 * Resolves a profile field key for a form element: tries the Teletalk exact
 * name/id map first (when the active hostname qualifies), then falls back
 * to generic label-text matching.
 */
function resolveFieldKey(element) {
  if (typeof isTeletalkHostname === 'function' && isTeletalkHostname(window.location.hostname)) {
    const exactKey = resolveTeletalkFieldKey(element.getAttribute('name'), element.getAttribute('id'));
    if (exactKey) {
      return exactKey;
    }
  }
  return matchFieldKey(describeElement(element));
}

/**
 * Special handling for specific form fields that need extra logic.
 */
function handleSpecialFields(element, profileData) {
  const name = element.getAttribute('name');
  const id = element.getAttribute('id');

  // NID select: set to "Yes" if nidNo exists, else "No"
  if (name === 'nid' || id === 'nid') {
    const hasNid = profileData.nidNo && profileData.nidNo.trim() !== '';
    const valueToSet = hasNid ? '1' : '0';
    const option = Array.from(element.options).find(opt => opt.value === valueToSet);
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // Birth Registration select: set to "No" if no birthRegNo (always "No" in sample)
  if (name === 'breg' || id === 'breg') {
    const hasBreg = profileData.birthRegNo && profileData.birthRegNo.trim() !== '';
    const valueToSet = hasBreg ? '1' : '0';
    const option = Array.from(element.options).find(opt => opt.value === valueToSet);
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // Passport select: set to "No" if no passportNo
  if (name === 'passport' || id === 'passport') {
    const hasPassport = profileData.passportNo && profileData.passportNo.trim() !== '';
    const valueToSet = hasPassport ? '1' : '0';
    const option = Array.from(element.options).find(opt => opt.value === valueToSet);
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // "Same as present address" checkbox
  if (name === 'same_as_present' || id === 'same_as_present') {
    if (profileData.sameAsPresent) {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // "If Applicable" checkbox for Graduation
  if (name === 'if_applicable_gra' || id === 'if_applicable_gra') {
    if (profileData.bachelor && profileData.bachelor.trim() !== '') {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // "If Applicable" checkbox for Masters
  if (name === 'if_applicable_mas' || id === 'if_applicable_mas') {
    if (profileData.master && profileData.master.trim() !== '') {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // "I declare" checkbox (agree)
  if (name === 'agree' || id === 'agree') {
    element.checked = true;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
}

/**
 * Fills all matchable form fields on the page using the given profile.
 */
function fillForm(profileData) {
  let filledCount = 0;
  const seenRadioNames = new Set();

  const formElements = document.querySelectorAll('input, select, textarea');

  for (const element of formElements) {
    const type = (element.getAttribute('type') || '').toLowerCase();

    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'file' || element.disabled) {
      continue;
    }

    // Special handling for specific fields
    if (handleSpecialFields(element, profileData)) {
      filledCount++;
      continue;
    }

    if (type === 'radio') {
      const name = element.getAttribute('name');
      if (!name || seenRadioNames.has(name)) {
        continue;
      }
      const fieldKey = resolveFieldKey(element) || matchFieldKey(name.toLowerCase());
      const profileValue = fieldKey ? profileData[fieldKey] : undefined;
      if (profileValue && setRadioValue(name, profileValue)) {
        filledCount += 1;
        seenRadioNames.add(name);
      }
      continue;
    }

    if (type === 'checkbox') {
      // Skip other checkboxes (handled above)
      continue;
    }

    const fieldKey = resolveFieldKey(element);
    if (!fieldKey) {
      continue;
    }

    const profileValue = profileData[fieldKey];
    if (profileValue === undefined || profileValue === null || profileValue === '') {
      continue;
    }

    if (element.tagName === 'SELECT') {
      if (setSelectValue(element, profileValue)) {
        filledCount += 1;
      }
      continue;
    }

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      setTextValue(element, profileValue);
      filledCount += 1;
    }
  }

  return filledCount;
}

// Handle ping to check if content script is ready
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'PING') {
    sendResponse({ ok: true });
    return true;
  }

  if (!message || message.type !== 'AUTOFILL_PAGE') {
    return false;
  }

  try {
    const filledCount = fillForm(message.payload || {});
    sendResponse({ ok: true, data: { filledCount } });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }

  return false;
});}

/**
 * Sets a value on a text-like input/textarea and dispatches events so
 * frameworks (React/Vue/vanilla listeners) observe the change.
 * @param {HTMLInputElement|HTMLTextAreaElement} element
 * @param {string} value
 */
function setTextValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Selects a matching <option> in a <select> element by visible text or value.
 * Uses fuzzy matching: removes dots, spaces, etc., and compares.
 * @param {HTMLSelectElement} element
 * @param {string} value
 * @returns {boolean} whether a match was applied
 */
function setSelectValue(element, value) {
  const target = normalize(value);
  for (const option of element.options) {
    if (target === normalize(option.textContent) || target === normalize(option.value)) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  // Fallback: contains match
  for (const option of element.options) {
    const optText = normalize(option.textContent);
    if (optText.includes(target) && target.length > 0) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

/**
 * Checks a radio button whose value or label matches the given value.
 * @param {string} name
 * @param {string} value
 * @returns {boolean} whether a match was applied
 */
function setRadioValue(name, value) {
  const target = normalize(value);
  const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
  for (const radio of radios) {
    const description = describeElement(radio);
    if (description.includes(target) || normalize(radio.value) === target) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

/**
 * Resolves a profile field key for a form element: tries the Teletalk exact
 * name/id map first (when the active hostname qualifies), then falls back
 * to generic label-text matching so unmapped/new fields are still attempted.
 * @param {HTMLElement} element
 * @returns {string|null}
 */
function resolveFieldKey(element) {
  if (typeof isTeletalkHostname === 'function' && isTeletalkHostname(window.location.hostname)) {
    const exactKey = resolveTeletalkFieldKey(element.getAttribute('name'), element.getAttribute('id'));
    if (exactKey) {
      return exactKey;
    }
  }
  return matchFieldKey(describeElement(element));
}

/**
 * Special handling for specific form fields that need extra logic.
 * @param {HTMLElement} element
 * @param {object} profileData
 * @returns {boolean} whether the field was handled and filled
 */
function handleSpecialFields(element, profileData) {
  const name = element.getAttribute('name');
  const id = element.getAttribute('id');

  // NID select: set to "Yes" if nidNo exists, else "No"
  if (name === 'nid' || id === 'nid') {
    const hasNid = profileData.nidNo && profileData.nidNo.trim() !== '';
    const valueToSet = hasNid ? '1' : '0';
    const option = Array.from(element.options).find(opt => opt.value === valueToSet);
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // Birth Registration select: set to "No" if no birthRegNo (always "No" in sample)
  if (name === 'breg' || id === 'breg') {
    const hasBreg = profileData.birthRegNo && profileData.birthRegNo.trim() !== '';
    const valueToSet = hasBreg ? '1' : '0';
    const option = Array.from(element.options).find(opt => opt.value === valueToSet);
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // Passport select: set to "No" if no passportNo
  if (name === 'passport' || id === 'passport') {
    const hasPassport = profileData.passportNo && profileData.passportNo.trim() !== '';
    const valueToSet = hasPassport ? '1' : '0';
    const option = Array.from(element.options).find(opt => opt.value === valueToSet);
    if (option) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // "Same as present address" checkbox
  if (name === 'same_as_present' || id === 'same_as_present') {
    if (profileData.sameAsPresent) {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // "If Applicable" checkbox for Graduation
  if (name === 'if_applicable_gra' || id === 'if_applicable_gra') {
    if (profileData.bachelor && profileData.bachelor.trim() !== '') {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // "If Applicable" checkbox for Masters
  if (name === 'if_applicable_mas' || id === 'if_applicable_mas') {
    if (profileData.master && profileData.master.trim() !== '') {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // "I declare" checkbox (agree)
  if (name === 'agree' || id === 'agree') {
    element.checked = true;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
}

/**
 * Fills all matchable form fields on the page using the given profile.
 * @param {Record<string, string>} profileData
 * @returns {number} count of fields successfully filled
 */
function fillForm(profileData) {
  let filledCount = 0;
  const seenRadioNames = new Set();

  const formElements = document.querySelectorAll('input, select, textarea');

  for (const element of formElements) {
    const type = (element.getAttribute('type') || '').toLowerCase();

    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'file' || element.disabled) {
      continue;
    }

    // Special handling for specific fields
    if (handleSpecialFields(element, profileData)) {
      filledCount++;
      continue;
    }

    if (type === 'radio') {
      const name = element.getAttribute('name');
      if (!name || seenRadioNames.has(name)) {
        continue;
      }
      const fieldKey = resolveFieldKey(element) || matchFieldKey(name.toLowerCase());
      const profileValue = fieldKey ? profileData[fieldKey] : undefined;
      if (profileValue && setRadioValue(name, profileValue)) {
        filledCount += 1;
        seenRadioNames.add(name);
      }
      continue;
    }

    if (type === 'checkbox') {
      // Skip other checkboxes (handled above)
      continue;
    }

    const fieldKey = resolveFieldKey(element);
    if (!fieldKey) {
      continue;
    }

    const profileValue = profileData[fieldKey];
    if (profileValue === undefined || profileValue === null || profileValue === '') {
      continue;
    }

    if (element.tagName === 'SELECT') {
      if (setSelectValue(element, profileValue)) {
        filledCount += 1;
      }
      continue;
    }

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      // For text inputs, we set the value
      setTextValue(element, profileValue);
      filledCount += 1;
    }
  }

  return filledCount;
}

// Handle ping to check if content script is ready
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'PING') {
    sendResponse({ ok: true });
    return true;
  }

  if (!message || message.type !== 'AUTOFILL_PAGE') {
    return false;
  }

  try {
    const filledCount = fillForm(message.payload || {});
    sendResponse({ ok: true, data: { filledCount } });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }

  return false;
});
