import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from './providers';

export const metadata: Metadata = {
  title: 'VEIL — Programmable Secret Capsules & Conditional Disclosure',
  description:
    'Enterprise conditional-disclosure protocol combining reversible steganography, threshold cryptography, and onchain smart contracts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#171A10] text-[#F3F0E4] antialiased selection:bg-[#858C50] selection:text-[#12150D]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
