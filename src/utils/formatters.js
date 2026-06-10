// CNIC format: 00000-0000000-0
export const formatCnic = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

// Mobile format: 0000-0000000
export const formatMobile = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

export const validateCnic = (v) => /^\d{5}-\d{7}-\d{1}$/.test(v);
export const validateMobile = (v) => /^\d{4}-\d{7}$/.test(v);

// Display dates as dd-mm-yyyy (input is yyyy-mm-dd)
export const formatDate = (value) => {
  if (!value) return '-';
  const parts = String(value).split('-');
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return value;
};
