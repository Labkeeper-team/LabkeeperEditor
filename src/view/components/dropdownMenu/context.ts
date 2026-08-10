import { createContext, useContext } from 'react';

export const DropdownCloseContext = createContext<(() => void) | null>(null);

export const useDropdownClose = () => useContext(DropdownCloseContext);
