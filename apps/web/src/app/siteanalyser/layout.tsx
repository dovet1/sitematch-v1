import '@/styles/sitesketcher-v2-tokens.css';
import '@/styles/sitesketcher-v2.css';

export const metadata = {
  title: 'SiteAnalyser | Commercial Directory',
  description: 'Demographics and catchment analysis for UK sites',
};

export default function SiteAnalyserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
