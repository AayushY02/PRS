import { atom } from 'jotai'


export const selectionAtom = atom<{
  regionId?: string; regionCode?: string;
  subareaId?: string; subareaCode?: string;
}>({});