/**
 * Exercise type registry.
 *
 * A type is a data record, not a branch: `label` (subtitle text), `slots`
 * (which position combinations produce exercises), `name` (file/ID) and
 * `notes` (the sequence). Adding T3 means adding a module here and one line
 * below — nothing in plan/generate/validate/manifest/render changes.
 */
import * as t1 from './t1.mjs';
import * as t2 from './t2.mjs';

export const TYPES = { T1: t1, T2: t2 };

export const TYPE_NAMES = Object.keys(TYPES);
