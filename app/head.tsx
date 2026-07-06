import { GEOMeta } from '@varshylinc/geo/react';
import { geoConfig } from '@/lib/geo';

export default function Head(): JSX.Element {
  return (
    <>
      <GEOMeta
        config={geoConfig}
        pageTitle="GEO — AI Discoverability Toolkit by Varshyl"
        pageDescription="Make your product readable by every AI engine. Audit your site, fix what's missing, and reach 100/100 in minutes."
      />
    </>
  );
}
