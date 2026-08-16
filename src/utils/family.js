/*
 * "Is this the same family?" — the softer matching that CNIC alone cannot do.
 *
 * A CNIC only joins two records when BOTH of them carry it. That leaves one
 * real gap: a child admitted with only the mother's CNIC on file, and a brother
 * admitted later with only the father's. The two records then share no CNIC at
 * all, so nothing links them and nothing auto-fills — they simply look like two
 * different families.
 *
 * What such records DO repeat is the things a family shares anyway: a phone
 * number, the father's name, the mother's name. This module looks for those and
 * offers the family as a SUGGESTION. It never links anything by itself — the
 * operator confirms, because a shared phone or a common name is a hint, not
 * proof, the way a CNIC is.
 */

import { cnicDigits, PARENT_FIELDS } from './cnic';


const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
const phoneDigits = (v) => String(v || '').replace(/\D/g, '');

/*
 * Two records that each carry a CNIC in the same slot, and those CNICs differ,
 * are NOT one family — whatever else they have in common. This is what keeps
 * two genuinely separate households that share a phone number from ever being
 * suggested as duplicates of each other.
 */
export const hasCnicConflict = (a, b) => ['father_cnic', 'mother_cnic'].some(k => {
  const x = cnicDigits(a?.[k]);
  const y = cnicDigits(b?.[k]);
  return x && y && x !== y;
});

/*
 * Families that plausibly match `details` (a parent record or admission-form
 * state). Returns [{ parent, reason }], phone matches first because a shared
 * number is far stronger evidence than a shared name.
 */
export const findLikelyFamilies = (parents, details, { excludeId } = {}) => {
  const phones = [details?.father_contact, details?.mother_contact]
    .map(phoneDigits).filter(p => p.length >= 10);
  const father = norm(details?.father_name);
  const mother = norm(details?.mother_name);
  if (!phones.length && !father && !mother) return [];

  const out = [];
  for (const p of parents || []) {
    if (excludeId && p.id === excludeId) continue;
    if (hasCnicConflict(details, p)) continue;

    const theirPhones = [phoneDigits(p.father_contact), phoneDigits(p.mother_contact)].filter(Boolean);
    const phoneHit = phones.some(x => theirPhones.includes(x));
    const reasons = [];
    if (phoneHit) reasons.push('same phone number');
    if (father && norm(p.father_name) === father) reasons.push("same father's name");
    if (mother && norm(p.mother_name) === mother) reasons.push("same mother's name");

    if (reasons.length) out.push({ parent: p, reason: reasons.join(' + '), phoneHit });
  }
  return out.sort((a, b) => (b.phoneHit ? 1 : 0) - (a.phoneHit ? 1 : 0));
};

/*
 * Merge two family records into one set of details: the record being kept wins
 * every field it actually has, and each field it is missing is taken from the
 * other. That is what finally puts BOTH parents' CNICs on one record, so the
 * family can never come apart again.
 */
export const mergeParentDetails = (keep, other) => {
  const merged = {};
  PARENT_FIELDS.forEach(k => {
    merged[k] = String(keep?.[k] || '').trim() ? keep[k] : (other?.[k] || '');
  });
  return merged;
};

// How complete a family record is — used to decide which of two duplicates is
// the better one to keep.
export const parentDetailScore = (p) =>
  PARENT_FIELDS.filter(k => String(p?.[k] || '').trim()).length;

/*
 * Every pair of family records on file that are, or may be, the same household.
 *
 * Two kinds, and the difference matters:
 *
 *   certain — the two records carry the SAME CNIC. One person cannot be two
 *     families, so this is a duplicate, full stop. It is also the only shape a
 *     duplicate can take once every family has the father's CNIC on file, and
 *     it is the dangerous one: a new sibling silently attaches to whichever of
 *     the two the lookup happens to reach first.
 *
 *   likely — no shared CNIC, but a shared phone or parent name (see
 *     findLikelyFamilies). A hint for the operator to judge, not a fact.
 */
export const findDuplicateFamilies = (parents = []) => {
  const pairs = [];
  const seen = new Set();
  const add = (a, b, reason, certain) => {
    const key = [a.id, b.id].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ a, b, reason, certain });
  };

  // Same CNIC → the same person → the same family. Checked first so a pair is
  // never downgraded to a mere "hint" by the softer pass below.
  const byCnic = new Map();
  for (const p of parents) {
    for (const value of [p.father_cnic, p.mother_cnic]) {
      const d = cnicDigits(value);
      if (d.length !== 13) continue;
      const first = byCnic.get(d);
      if (first && first.id !== p.id) add(first, p, `the same CNIC (${value}) is on both records`, true);
      else if (!first) byCnic.set(d, p);
    }
  }

  for (const p of parents) {
    for (const { parent: other, reason } of findLikelyFamilies(parents, p, { excludeId: p.id })) {
      add(p, other, reason, false);
    }
  }

  // Certain duplicates first — those are the ones to act on.
  return pairs.sort((x, y) => (y.certain ? 1 : 0) - (x.certain ? 1 : 0));
};
