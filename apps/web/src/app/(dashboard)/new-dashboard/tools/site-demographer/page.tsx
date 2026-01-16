import { Suspense } from 'react';
import { SiteDemographerPage } from '@/components/demographics/SiteDemographerPage';

export default function SiteDemographerRoute() {
  return (
    <Suspense fallback={null}>
      <SiteDemographerPage />
    </Suspense>
  );
}
