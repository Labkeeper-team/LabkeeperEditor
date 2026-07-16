export const normalizeEmail = (email: string): string => email.trim();

export const isValidEmail = (email: string): boolean => {
    const normalizedEmail = normalizeEmail(email);
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail);
};
