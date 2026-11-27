/**
 * alphaTex emission for one exercise (SPEC 6).
 * The type's Chinese label arrives as data, so no type branching lives here.
 */

export const INTERVAL_NAMES = {
  2: '二度模进', 3: '三度模进', 4: '四度模进', 5: '五度模进',
  6: '六度模进', 7: '七度模进', 8: '八度模进',
};

export function noteToken(note) {
  return note.fret + '.' + note.string;
}

/**
 * @param {object} p
 * @param {string} p.keyName
 * @param {string} p.modeName
 * @param {string} p.id
 * @param {number} p.interval
 * @param {string} p.typeLabel
 * @param {{fret:number,string:number}[]} p.notes
 * @param {string} p.positionLabel
 * @param {string} p.keySignatureName
 * @returns {string}
 */
export function renderAlphaTex({
  keyName, modeName, id, interval, typeLabel, notes, positionLabel, keySignatureName,
}) {
  const title = `${keyName} ${modeName} · i${interval} · ${positionLabel} · ${id.split('-').at(-1)}`;
  const subtitle = `${INTERVAL_NAMES[interval]} · ${typeLabel}`;

  const bars = [];
  for (let i = 0; i < notes.length; i += 8) {
    const chunk = notes.slice(i, i + 8).map(noteToken);
    while (chunk.length < 8) chunk.push('r');
    bars.push(chunk.join(' '));
  }

  return [
    '\\title "' + title + '"',
    '\\subtitle "' + subtitle + '"',
    '\\tempo 70',
    '\\track "Guitar" { instrument acousticguitarsteel }',
    '\\staff { score tabs }',
    '\\tuning (E4 B3 G3 D3 A2 E2)',
    '\\ts 4 4',
    '\\ks ' + keySignatureName,
    '\\section "' + id + '"',
    ':8 ' + bars.join(' |\n') + ' |',
    '',
  ].join('\n');
}
