import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { ClientProviders } from '@/components/ClientProviders';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Secret Auction - Privacy-Preserving Blockchain Auctions',
  description: 'The first truly private auction platform powered by Fully Homomorphic Encryption (FHE). Bid with confidence, knowing your amounts remain encrypted on-chain.',
  keywords: 'blockchain, auction, privacy, FHE, encryption, FHEVM, Web3',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Load FHEVM Relayer SDK v0.3.0-5 */}
        <Script
          src="https://cdn.zama.org/relayer-sdk-js/0.3.0-5/relayer-sdk-js.umd.cjs"
          strategy="beforeInteractive"
        />
      </head>
      <body className={inter.className}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}

