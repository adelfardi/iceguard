import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CatalogStore {
  activeCatalogId: number | null;
  setActiveCatalog: (id: number | null) => void;
}

export const useCatalogStore = create<CatalogStore>()(
  persist(
    (set) => ({
      activeCatalogId: null,
      setActiveCatalog: (id) => set({ activeCatalogId: id }),
    }),
    { name: 'iceguard-active-catalog' },
  ),
);
