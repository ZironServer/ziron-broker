/*
Author: Ing. Luca Gian Scaringella
GitHub: LucaCode
Copyright(c) Ing. Luca Gian Scaringella
 */

export type Writable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * Ensures that any catched value is an instance of Error.
 * @param err 
 * @returns 
 */
export function ensureError(err: any): Error {
    if (err instanceof Error) return err;
    if (typeof err === 'string') return new Error(err);
    try {
        return new Error(String(err));
    } catch {
        return new Error('Unknown error');
    }
}