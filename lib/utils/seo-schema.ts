/**
 * Extracts FAQ items from HTML content for JSON-LD FAQPage schema.
 * Parses <h3> tags inside a <div id="faq"> section paired with <p> answer tags.
 */
export function extractFaqFromHtml(
  html: string,
): Array<{ question: string; answer: string }> {
  if (!html) return [];

  const faqMatch = html.match(
    /<h2[^>]*>[^<]*FAQ[^<]*<\/h2>([\s\S]*?)(?:<h2|$)/i,
  );
  if (!faqMatch) return [];

  const faqHtml = faqMatch[1]!;
  const items: Array<{ question: string; answer: string }> = [];

  const h3Regex =
    /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = h3Regex.exec(faqHtml)) !== null) {
    const question = match[1]!.replace(/<[^>]*>/g, '').trim();
    const answer = match[2]!.replace(/<[^>]*>/g, '').trim();
    if (question && answer) {
      items.push({ question, answer });
    }
  }

  return items;
}

/**
 * Extracts step-by-step instructions from HTML content for JSON-LD HowTo schema.
 * Parses <ol> lists inside sections with "Cara Membuat" or similar heading.
 */
export function extractStepsFromHtml(
  html: string,
): Array<{ '@type': 'HowToStep'; text: string }> {
  if (!html) return [];

  const stepMatch = html.match(
    /<(?:h2|h3)[^>]*>[^<]*(?:cara|memasak|langkah|resep)[^<]*<\/(?:h2|h3)>([\s\S]*?)(?:<(?:h2|h3)|$)/i,
  );
  if (!stepMatch) return [];

  const stepHtml = stepMatch[1]!;
  const steps: Array<{ '@type': 'HowToStep'; text: string }> = [];

  const olRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
  let match;

  while ((match = olRegex.exec(stepHtml)) !== null) {
    const olContent = match[1]!;
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;

    while ((liMatch = liRegex.exec(olContent)) !== null) {
      const text = liMatch[1]!.replace(/<[^>]*>/g, '').trim();
      if (text) {
        steps.push({ '@type': 'HowToStep', text });
      }
    }
  }

  return steps;
}