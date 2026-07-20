/*
 * Data layer router.
 *
 * Every screen imports from this one file, so the app has no idea whether it is
 * talking to the cloud or to the browser. That keeps a single codebase: a
 * feature or fix written once shows up in both the real app and the demo.
 *
 *   Real app  -> db.cloud.js  (Supabase: shared, permanent, per-school)
 *   Demo      -> db.local.js  (this browser only, private sandbox)
 *
 * The demo build carries no Supabase credentials at all, so it cannot reach a
 * real school's data even in principle.
 */

import { IS_DEMO } from './demo';
import * as cloud from './db.cloud';
import * as local from './db.local';

const impl = IS_DEMO ? local : cloud;

// Give a demo visitor something to look at on their first visit.
if (IS_DEMO) local.seedDemo();

export const loadSchoolContext  = impl.loadSchoolContext;
export const getSchoolId        = impl.getSchoolId;
export const clearSchoolContext = impl.clearSchoolContext;

export const ADMISSION_HEADS    = impl.ADMISSION_HEADS;
export const peekNextStudentId  = impl.peekNextStudentId;

export const uploadStudentPhoto = impl.uploadStudentPhoto;
export const deleteStudentPhoto = impl.deleteStudentPhoto;

export const apiClasses         = impl.apiClasses;
export const apiSections        = impl.apiSections;
export const apiParents         = impl.apiParents;
export const apiStudents        = impl.apiStudents;
export const apiStudentHistory  = impl.apiStudentHistory;
export const apiFees            = impl.apiFees;
export const apiCustomCharges   = impl.apiCustomCharges;
export const apiReceipts        = impl.apiReceipts;

export const defaultSettings    = impl.defaultSettings;
export const getSettings        = impl.getSettings;
export const saveSettings       = impl.saveSettings;
export const getImportantFields = impl.getImportantFields;

// Demo-only helper, exported so the demo banner can offer a reset.
export const resetDemoData      = local.resetDemoData;
