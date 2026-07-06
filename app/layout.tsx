import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "GEO — AI Discoverability Toolkit",
  description: "Audit your product AI discoverability score. Fix missing signals with one command. Free, open source.",
  metadataBase: new URL("https://geo-toolkit-site.netlify.app"),
  openGraph: {
    title: "GEO — AI Discoverability Toolkit",
    description: "Audit your product AI discoverability score. Fix missing signals with one command.",
    url: "https://geo-toolkit-site.netlify.app",
    siteName: "GEO — AI Discoverability Toolkit",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GEO — AI Discoverability Toolkit",
    description: "Audit your product AI discoverability score.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://geo-toolkit-site.netlify.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "SoftwareApplication",
                  "name": "GEO — AI Discoverability Toolkit",
                  "description": "Open-source npm package that makes any product readable by AI engines.",
                  "url": "https://geo-toolkit-site.netlify.app",
                  "applicationCategory": "DeveloperApplication",
                  "operatingSystem": "Any",
                  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
                  "author": {
                    "@type": "Person",
                    "name": "Vagish Kapila",
                    "url": "https://vagishkapila.com"
                  },
                  "publisher": {
                    "@type": "Organization",
                    "name": "Varshyl Inc.",
                    "url": "https://varshyl.com"
                  }
                },
                {
                  "@type": "Organization",
                  "name": "Varshyl Inc.",
                  "url": "https://varshyl.com",
                  "location": "Pleasanton, CA",
                  "founder": {
                    "@type": "Person",
                    "name": "Vagish Kapila",
                    "url": "https://vagishkapila.com"
                  }
                },
                {
                  "@type": "Person",
                  "name": "Vagish Kapila",
                  "url": "https://vagishkapila.com",
                  "jobTitle": "Founder & CEO",
                  "worksFor": { "@type": "Organization", "name": "Varshyl Inc." }
                }
              ]
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
