import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, siteUrl } from "../lib/site";
import "./globals.scss";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "HealthyStock | Bloomberg for Healthy Stocks",
  description:
    "HealthyStock by Maria Iordanova: evidence-based analysis of foods, nutrients, and products through a market-style health lens.",
  openGraph: {
    title: "HealthyStock | Bloomberg for Healthy Stocks",
    description: "Every meal is a portfolio decision. Build your health returns with evidence-based guidance.",
    url: absoluteUrl("/"),
    siteName: "HealthyStock",
    images: [
      {
        url: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "HealthyStock | Bloomberg for Healthy Stocks",
    description: "Every meal is a portfolio decision. Build your health returns with evidence-based guidance.",
    images: [
      "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80"
    ]
  },
  alternates: {
    canonical: "/"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HealthyStock",
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: absoluteUrl("/?q={search_term_string}"),
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <div className="site-shell">
          <header className="site-header">
            <div className="container header-inner">
              <Link href="/" className="logo">
                Healthy<span>Stock</span>
              </Link>
              <nav className="site-nav" aria-label="Primary navigation">
                <Link href="/blog">Blog</Link>
              </nav>
              <p className="tagline">Bloomberg for Healthy Stocks</p>
            </div>
          </header>
          <main>{children}</main>
          <footer className="site-footer">
            <div className="container">
              <p>© {new Date().getFullYear()} HealthyStock. Evidence-first health intelligence.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
