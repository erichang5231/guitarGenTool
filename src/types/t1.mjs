/**
 * T1: both directions inside one position.
 */
import { t1 } from '../core/sequences.mjs';

export const label = '同把位上下行';

export const slots = (chain) => chain.map((p) => ({ id: p.id, from: [p.id] }));

export const name = (key, mode, interval, slotId) => `${key}-${mode}-i${interval}-${slotId}-T1`;

export const notes = (byPos, slot, interval) => t1(byPos.get(slot.from[0]), interval);
