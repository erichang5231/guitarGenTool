/**
 * T2: up in one position, down in the adjacent one, plus the A-position coda.
 */
import { t2, t2Pairs } from '../core/sequences.mjs';

export const label = '相邻把位上下行';

export const slots = (chain) => t2Pairs(chain).map(([a, b]) => ({ id: `${a}_${b}`, from: [a, b] }));

export const name = (key, mode, interval, slotId) => `${key}-${mode}-i${interval}-${slotId}-T2`;

export const notes = (byPos, slot, interval) =>
  t2(byPos.get(slot.from[0]), byPos.get(slot.from[1]), interval);
