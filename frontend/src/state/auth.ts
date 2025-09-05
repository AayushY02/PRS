import { atom } from 'jotai';

export type AuthUser = {id: string | null; email?: string | null}

export const authAtom = atom<AuthUser>({id: null , email: null})