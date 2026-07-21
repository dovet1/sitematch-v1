// Shared brand read helpers used by the admin brand hub and the public brand info modal.
// Store-estate logic mirrors /api/public/requirements/[id]/store-estate, keyed on brand_id.

const STORE_POINT_CAP = 5000;

export interface BrandLatestStore {
  name: string | null;
  town: string | null;
  date: string | null;
  dateIsProxy: boolean;
}

export interface BrandStoreEstate {
  storeCount: number;
  // `openDate` drives the directory estate map's "opened in last 12 months" legend series.
  // Often null — many imported stores have no open_date.
  stores: { id: string; name: string | null; town: string | null; lat: number; lon: number; openDate: string | null }[];
  latestStore: BrandLatestStore | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchBrandStoreEstate(supabase: any, brandId: string): Promise<BrandStoreEstate> {
  const [{ count }, { data: stores }] = await Promise.all([
    supabase.from('stores').select('*', { count: 'exact', head: true }).eq('brand_id', brandId),
    supabase.from('stores').select('id, name, town, lat, lon, open_date').eq('brand_id', brandId).limit(STORE_POINT_CAP),
  ]);

  // Latest store — two explicit steps so a recently-imported row (null open_date) never
  // outranks a real opening date.
  let latestStore: BrandLatestStore | null = null;
  const { data: openedRows } = await supabase
    .from('stores')
    .select('name, town, open_date')
    .eq('brand_id', brandId)
    .not('open_date', 'is', null)
    .order('open_date', { ascending: false })
    .limit(1);

  if (openedRows && openedRows.length > 0) {
    const row = openedRows[0];
    latestStore = { name: row.name, town: row.town, date: row.open_date, dateIsProxy: false };
  } else {
    const { data: createdRows } = await supabase
      .from('stores')
      .select('name, town, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (createdRows && createdRows.length > 0) {
      const row = createdRows[0];
      latestStore = { name: row.name, town: row.town, date: row.created_at, dateIsProxy: true };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedStores = ((stores || []) as any[]).map((s) => ({
    id: s.id,
    name: s.name,
    town: s.town,
    lat: s.lat,
    lon: s.lon,
    openDate: s.open_date ?? null,
  }));

  return { storeCount: count ?? 0, stores: mappedStores, latestStore };
}

// Dominant primary category via the brand_primary_category SQL function. Rendered as
// "PARENT · CHILD" (or just child when there is no parent).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchBrandCategory(supabase: any, brandId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('brand_primary_category', { p_brand_id: brandId });
  if (error || !data || data.length === 0) return null;
  const row = data[0] as { child: string | null; parent: string | null };
  if (!row.child) return null;
  return row.parent ? `${row.parent} · ${row.child}` : row.child;
}
