import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Redos - Semantic Reddit Search Engine',
  description: 'Search Reddit discussions by intent and concepts locally using vector embedding search and sentiment analysis.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
