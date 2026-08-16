/*
 * CNIC helpers — the family's identity key.
 *
 * A CNIC is unique to one Pakistani citizen, so the app treats it as the
 * natural identifier of a family: a CNIC that is already on file always means
 * the SAME parent record, never a second copy of it. That is what keeps
 * siblings joined together and makes "update once, applies to all children"
 * work reliably.
 *
 * Everything is compared on digits only, so 35201-1234567-1 and 3520112345671
 * are recognised as the same person no matter how they were typed or imported.
 */

export const cnicDigits = (v) => String(v || '').replace(/\D/g, '');

// Only a full 13-digit CNIC identifies a person; a half-typed one matches nothing.
export const isCompleteCnic = (v) => cnicDigits(v).length === 13;

export const sameCnic = (a, b) => {
  const x = cnicDigits(a);
  return x.length === 13 && x === cnicDigits(b);
};

/*
 * Find the parent record that owns any of the given CNICs.
 *
 * Both stored columns are checked against both values on purpose: most
 * families are on file by the father's CNIC, but a widowed or divorced mother
 * may have only her own — and older imported rows sometimes carry hers in the
 * father column. Matching either way finds the family instead of duplicating it.
 */
export const findParentByCnic = (parents, ...cnics) => {
  const wanted = cnics.map(cnicDigits).filter(d => d.length === 13);
  if (wanted.length === 0) return null;
  return (parents || []).find(p =>
    wanted.includes(cnicDigits(p.father_cnic)) || wanted.includes(cnicDigits(p.mother_cnic))
  ) || null;
};

// The fields that belong to the family record, not to one child. Every sibling
// reads them from the same parent row, so editing them anywhere edits them
// everywhere.
export const PARENT_FIELDS = [
  'father_cnic', 'father_name', 'father_contact', 'father_occupation',
  'mother_cnic', 'mother_name', 'mother_contact', 'mother_occupation',
];

// A short, human way to name a family in prompts and warnings.
export const describeParent = (p) => {
  if (!p) return 'this family';
  const who = p.father_name || p.mother_name || 'Unnamed parent';
  const cnic = p.father_cnic || p.mother_cnic;
  return cnic ? `${who} (CNIC ${cnic})` : who;
};
