import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
}

export function SEOHead({
  title,
  description,
  keywords,
  canonicalUrl,
  ogImage = "/logo/logo.png",
  ogType = "website",
  twitterCard = "summary_large_image",
}: SEOProps) {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const fullCanonicalUrl = canonicalUrl ? `${siteUrl}${canonicalUrl}` : typeof window !== 'undefined' ? window.location.href : '';
  
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={fullCanonicalUrl} />
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullCanonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={`${siteUrl}${ogImage}`} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${siteUrl}${ogImage}`} />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Restaurant",
          "name": "Dapur Dekaka",
          "description": description,
          "image": `${siteUrl}${ogImage}`,
          "url": fullCanonicalUrl,
          "servesCuisine": "Halal Dim Sum",
          "priceRange": "$$",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "ID"
          }
        })}
      </script>
    </Helmet>
  );
}