import type { Metadata } from "next";
import { siteUrl } from "@/lib/geo";
import "./globals.css";

const absoluteSiteUrl = siteUrl || undefined;

export const metadata: Metadata = {
  title: "GEO — AI Discoverability Toolkit",
  description: "Audit your product AI discoverability score. Fix missing signals with one command. Free, open source.",
  ...(absoluteSiteUrl ? { metadataBase: new URL(absoluteSiteUrl) } : {}),
  openGraph: {
    title: "GEO — AI Discoverability Toolkit",
    description: "Audit your product AI discoverability score. Fix missing signals with one command.",
    ...(absoluteSiteUrl ? { url: absoluteSiteUrl } : {}),
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
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appJsonLdUrl = absoluteSiteUrl || "/";

  return (
    <html lang="en">
      <body className="antialiased">
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
                  "url": appJsonLdUrl,
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
