// Browser-based encryption utilities using Web Crypto API
// Uses AES-256-GCM with PBKDF2 key derivation

const PBKDF2_ITERATIONS = 100000;
const IV_LENGTH = 12;  // 96 bits for GCM

export function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export async function deriveKeyFromPassword(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );
}

export async function decryptData(encryptedData, key) {
    // First 12 bytes are IV, rest is ciphertext + auth tag
    const dataArray = new Uint8Array(encryptedData);
    const iv = dataArray.slice(0, IV_LENGTH);
    const ciphertext = dataArray.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
    );

    return decrypted;
}

export async function decryptImageToObjectURL(encryptedArrayBuffer, key) {
    const decrypted = await decryptData(encryptedArrayBuffer, key);
    const blob = new Blob([decrypted], { type: 'image/jpeg' });
    return URL.createObjectURL(blob);
}

export async function decryptText(encryptedBase64, ivBase64, key) {
    const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
    const ciphertext = new Uint8Array(base64ToArrayBuffer(encryptedBase64));

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}
