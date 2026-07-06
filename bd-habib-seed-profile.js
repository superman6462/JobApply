/**
 * Project: BD Job Autofill
 * Module: Sample Seed Profile - Habib
 * Purpose: Provides a ready-to-import sample profile object named "Habib",
 *          populated using the Bangladesh district/upazila reference data
 *          (bd-districts-data.js) so the extension's profile store has a
 *          realistic example matching the field schema used by profiles.js
 *          (TEXT_FIELD_KEYS / CHECKBOX_FIELD_KEYS). This file only exports
 *          data - it does not write to storage or mutate any existing file.
 * Author: Lead Engineer
 * Version: 1.0.0
 * Dependencies: bd-districts-data.js (findDistrictByName, findUpazilaByName)
 * Last Updated: 2026-07-06
 */

import { findDistrictByName, findUpazilaByName } from './bd-districts-data.js';

const PRESENT_DISTRICT = findDistrictByName('Bogra');
const PRESENT_UPAZILA = findUpazilaByName(PRESENT_DISTRICT.id, 'Bogra Sadar');

const PERMANENT_DISTRICT = findDistrictByName('Bogra');
const PERMANENT_UPAZILA = findUpazilaByName(PERMANENT_DISTRICT.id, 'Bogra Sadar');

/**
 * Sample seed profile matching the schema consumed by profiles.js
 * (TEXT_FIELD_KEYS and CHECKBOX_FIELD_KEYS). Field values follow the
 * pre-filled example captured from the source reference document
 * (present/permanent district: Bogra, date of birth: 1994-12-20).
 * @type {object}
 */
export const HABIB_SEED_PROFILE = Object.freeze({
  id: 'profile_seed_habib',
  name: 'Habib',
  fullName: 'Md. Habibur Rahman',
  nameBn: 'মোঃ হাবিবুর রহমান',
  fatherName: 'Md. Abdur Rahman',
  fatherBn: 'মোঃ আব্দুর রহমান',
  motherName: 'Mst. Rahima Begum',
  motherBn: 'মোছাঃ রহিমা বেগম',
  dateOfBirth: '1994-12-20',
  gender: 'Male',
  nationality: 'Bangladeshi',
  religion: 'Islam',
  maritalStatus: 'Unmarried',
  spouseName: '',
  bloodGroup: 'B+',
  nidType: 'NID',
  nidNo: '1994123456789',
  birthRegNo: '19941220123456789',
  passportNo: '',
  mobile: '01712345678',
  mobileConfirm: '01712345678',
  email: 'habib.rahman@example.com',
  quota: 'No Quota',
  quotaDetails: '',
  depStatus: '',

  presentCareOf: 'Md. Abdur Rahman',
  presentAddress: 'Vill: Malotinagar, Post: Bogra Sadar',
  presentDistrict: PRESENT_DISTRICT.id,
  presentUpazila: PRESENT_UPAZILA.id,
  presentPost: 'Bogra Sadar',
  presentPostcode: '5800',

  permanentCareOf: 'Md. Abdur Rahman',
  permanentAddress: 'Vill: Malotinagar, Post: Bogra Sadar',
  permanentDistrict: PERMANENT_DISTRICT.id,
  permanentUpazila: PERMANENT_UPAZILA.id,
  permanentPost: 'Bogra Sadar',
  permanentPostcode: '5800',

  fatherOccupation: 'Business',

  sscExam: 'SSC',
  sscRoll: '123456',
  sscGroup: 'Science',
  sscGroupOther: '',
  sscBoard: 'Rajshahi',
  sscBoardOther: '',
  sscResultType: 'GPA',
  sscResult: '5.00',
  sscYear: '2011',

  hscExam: 'HSC',
  hscRoll: '654321',
  hscGroup: 'Science',
  hscGroupOther: '',
  hscBoard: 'Rajshahi',
  hscBoardOther: '',
  hscResultType: 'GPA',
  hscResult: '5.00',
  hscYear: '2013',

  bachelor: 'B.Sc. in Computer Science and Engineering, 2017, CGPA 3.75',
  master: '',

  sameAsPresent: true
});
