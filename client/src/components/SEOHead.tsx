import { Helmet } from "react-helmet-async";

type SchemaType = "Restaurant" | "WebSite" | "Blog" | "Article" | "BreadcrumbList";

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
  schemaType?: SchemaType;
  schemaData?: Record<string, unknown>;
  articlePublishedTime?: string;
  articleAuthor?: string;
  articleSection?: string;
}

export function SEOHead({
  title,
  description,
  keywords,
  canonicalUrl,
  ogImage = "/logo/logo.png",
  ogType = "website",
  twitterCard = "summary_large_image",
  schemaType,
  schemaData,
  articlePublishedTime,
  articleAuthor,
  articleSection,
}: SEOProps) {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const fullCanonicalUrl = canonicalUrl ? `${siteUrl}${canonicalUrl}` : typeof window !== 'undefined' ? window.location.href : '';

  const buildSchema = (): Record<string, unknown> | null => {
    if (schemaData) return schemaData;

    switch (schemaType) {
      case "WebSite":
        return {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Dapur Dekaka",
          "url": siteUrl,
          "description": description,
          "potentialAction": {
            "@type": "SearchAction",
            "target": `${siteUrl}/articles?search={search_term_string}`,
            "query-input": "required name=search_term_string"
          }
        };
      case "Restaurant":
        return {
          "@context": "https://schema.org",
          "@type": "Restaurant",
          "name": "Dapur Dekaka",
          "description": description,
          "image": `${siteUrl}${ogImage}`,
          "url": siteUrl,
          "servesCuisine": "Halal Dim Sum",
          "priceRange": "$$",
          "address": { "@type": "PostalAddress", "addressCountry": "ID" }
        };
      default:
        return null;
    }
  };

  const schema = buildSchema();

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

      {/* Article-specific Open Graph */}
      {ogType === "article" && articlePublishedTime && (
        <meta property="article:published_time" content={articlePublishedTime} />
      )}
      {ogType === "article" && articleAuthor && (
        <meta property="article:author" content={articleAuthor} />
      )}
      {ogType === "article" && articleSection && (
        <meta property="article:section" content={articleSection} />
      )}

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${siteUrl}${ogImage}`} />

      {/* Page-specific or custom Structured Data */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
}