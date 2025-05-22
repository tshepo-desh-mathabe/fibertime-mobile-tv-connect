/**
 * Generates an alphanumeric code of specified length
 */
export function generateAlphanumericCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
}

/**
 * Calculates expiry time from now
 */
export function calculateExpiryTime(minutes: number): Date {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + minutes);
    return expiry;
}