import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: unknown };

/** Lee todas las filas de una query Supabase (evita el límite default de 1000). */
export async function fetchAllRows<T>(
  runPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await runPage(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

export async function fetchAllFromTable<T>(
  client: SupabaseClient,
  table: string,
  select: string,
  orderBy?: { column: string; ascending?: boolean },
): Promise<T[]> {
  return fetchAllRows<T>((from, to) => {
    let q = client.from(table).select(select).range(from, to);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    return q as unknown as PromiseLike<PageResult<T>>;
  });
}
