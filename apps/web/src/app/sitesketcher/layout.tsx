import { JetBrains_Mono } from 'next/font/google';
import '@/styles/sitesketcher-v2-tokens.css';
import '@/styles/sitesketcher-v2.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata = {
  title: 'SiteSketcher | Commercial Directory',
  description: 'Advanced site planning and visualization tool',
};

export default function SiteSketcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={jetbrainsMono.variable}>{children}</div>;
}
