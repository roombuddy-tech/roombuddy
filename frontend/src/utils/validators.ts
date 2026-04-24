export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s|-/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}

export function isValidOTP(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidName(name: string): boolean {
  return name.trim().length >= 2;
}