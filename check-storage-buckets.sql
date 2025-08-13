-- Query to check existing storage buckets
SELECT 
  name,
  id,
  public,
  created_at
FROM storage.buckets 
ORDER BY name;