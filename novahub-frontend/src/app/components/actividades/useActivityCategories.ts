import { useMemo } from 'react';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { activityCategoriesService } from '../../services/actividades.service';
import type { ActivityCategoryItem } from '../../types';
import { ACTIVITY_CATEGORIES } from './actividades.constants';

/**
 * Categorías de tareas de la empresa. Mientras cargan (o si falla la carga) se muestran las cinco originales
 * para que los nombres de las tareas existentes nunca queden vacíos.
 */
export function useActivityCategories(enabled = true) {
  const query = useTenantQuery<ActivityCategoryItem[]>(
    ['activities', 'categories'],
    (signal) => activityCategoriesService.list(signal),
    { enabled },
  );
  const loaded = asList(query.data) as ActivityCategoryItem[];

  return useMemo(() => {
    const fallback: ActivityCategoryItem[] = ACTIVITY_CATEGORIES.map((category, index) => ({
      id: category.value, key: category.value, name: category.label, description: null, icon: null, color: null,
      position: index, isArchived: false, isDefault: true,
    }));
    const categories = loaded.length > 0 ? loaded : fallback;
    const active = categories.filter((category) => !category.isArchived);
    const byKey = new Map(categories.map((category) => [category.key, category]));
    const labelOf = (key?: string | null) => {
      const clean = String(key || '').trim().toUpperCase();
      if (!clean) return '—';
      return byKey.get(clean)?.name ?? '—';
    };
    return {
      categories,
      active,
      byKey,
      labelOf,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: query.refetch,
    };
  }, [query.data, query.isLoading, query.isError, query.refetch]);
}
