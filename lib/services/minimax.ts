/**
 * Minimax AI Service for caption and blog content generation
 * Used for superadmin-only AI content features
 */

import { withRetry } from '@/lib/utils/integration-helpers';

const MINIMAX_API_URL = 'https://api.minimax.chat/v1';

interface MinimaxStreamResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GenerateCaptionParams {
  productName: string;
  productDescription: string;
  language?: 'id' | 'en';
  tone?: 'professional' | 'playful' | 'luxurious' | 'warm';
}

interface GenerateBlogParams {
  topic: string;
  targetAudience: string;
  language?: 'id' | 'en';
  tone?: 'professional' | 'playful' | 'luxurious' | 'warm';
  wordCount?: number;
}

function getMinimaxApiKey(): string {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY is not configured');
  }
  return apiKey;
}

function getMinimaxGroupId(): string {
  const groupId = process.env.MINIMAX_GROUP_ID;
  if (!groupId) {
    throw new Error('MINIMAX_GROUP_ID is not configured');
  }
  return groupId;
}

function buildCaptionSystemPrompt(language: 'id' | 'en'): string {
  const prompts = {
    id: `Anda adalah copywriter profesional untuk brand makanan beku Indonesia-Chinese premium "Dapur Dekaka" (德卡).
Tulis caption produk yang menarik untuk media sosial dengan ketentuan:
- Cantumkan nama produk dengan jelas
- Tonjolkan keunikan dan cita rasa
- Gunakan bahasa Indonesia yang modern dan engaging
- Sertakan sedikit backstory heritage jika relevan
- Panjang caption: 100-150 kata
- Akhiri dengan call-to-action yang natural
- Jangan gunakan emoji berlebihan
- Tulis seperti seseorang yang bangga dengan warisan kuliner keluarga`,
    en: `You are a professional copywriter for premium Indonesian-Chinese frozen food brand "Dapur Dekaka" (德卡).
Write engaging social media product captions with the following guidelines:
- Mention the product name clearly
- Highlight uniqueness and taste
- Use modern, engaging English
- Include heritage backstory if relevant
- Caption length: 100-150 words
- End with a natural call-to-action
- Don't overuse emojis
- Write like someone who is proud of family culinary heritage`,
  };
  return prompts[language];
}

function buildBlogSystemPrompt(language: 'id' | 'en'): string {
  const prompts = {
    id: `Anda adalah content writer profesional untuk brand makanan beku Indonesia-Chinese premium "Dapur Dekaka" (德卡).
Tulis artikel blog yang informatif dan engaging dengan ketentuan:
- Topik: tentang produk, resep, tips memasak, atau cerita brand
- Audiens: keluarga Indonesia yang menghargai makanan berkualitas
- Bahasa Indonesia formal yang mudah dipahami
- Sertakan heading dan subheading
- Panjang artikel: ${400} kata
- Tonjolkan kualitas bahan dan warisan keluarga
- Sertakan tips praktis yang bisa langsung diterapkan
- Jangan gunakan emoji`,
    en: `You are a professional content writer for premium Indonesian-Chinese frozen food brand "Dapur Dekaka" (德卡).
Write informative and engaging blog articles with the following guidelines:
- Topic: about products, recipes, cooking tips, or brand stories
- Audience: Indonesian families who appreciate quality food
- Formal but accessible English
- Include headings and subheadings
- Article length: ${400} words
- Highlight ingredient quality and family heritage
- Include practical tips that can be applied immediately
- Don't use emojis`,
  };
  return prompts[language];
}

export async function generateProductCaption(
  params: GenerateCaptionParams
): Promise<string> {
  const { productName, productDescription, language = 'id', tone = 'warm' } = params;

  const systemPrompt = buildCaptionSystemPrompt(language);
  const userPrompt = `Nama Produk: ${productName}\nDeskripsi: ${productDescription}\nTone: ${tone}`;

  const makeRequest = (): Promise<string> =>
    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      let response: Response;
      try {
        response = await fetch(`${MINIMAX_API_URL}/text/chatcompletion_pro`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getMinimaxApiKey()}`,
          },
          body: JSON.stringify({
            model: 'abab6.5s-chat',
            stream: false,
            tokens_to_generate: 512,
            temperature: 0.7,
            top_p: 0.95,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Minimax API Error]', response.status, errorText);
        throw new Error(`Minimax API error: ${response.status}`);
      }

      const data: MinimaxStreamResponse = await response.json();
      const content = data.choices?.[0]?.delta?.content;

      if (!content) {
        throw new Error('No content generated from Minimax');
      }

      return content.trim();
    })();

  const result = await withRetry(makeRequest, {
    maxRetries: 2,
    retryableStatuses: [429, 500, 502, 503, 504],
    context: 'Minimax.generateProductCaption',
  });

  return result;
}

export async function generateBlogContent(
  params: GenerateBlogParams
): Promise<{ title: string; content: string; excerpt: string }> {
  const { topic, targetAudience, language = 'id', tone = 'professional', wordCount = 400 } = params;

  const systemPrompt = buildBlogSystemPrompt(language).replace('${400}', String(wordCount));
  const userPrompt = `Topik: ${topic}\nAudiens: ${targetAudience}\nTone: ${tone}`;

  const makeRequest = (): Promise<{ title: string; content: string; excerpt: string }> =>
    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      let response: Response;
      try {
        response = await fetch(`${MINIMAX_API_URL}/text/chatcompletion_pro`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getMinimaxApiKey()}`,
          },
          body: JSON.stringify({
            model: 'abab6.5s-chat',
            stream: false,
            tokens_to_generate: 1024,
            temperature: 0.7,
            top_p: 0.95,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Minimax API Error]', response.status, errorText);
        throw new Error(`Minimax API error: ${response.status}`);
      }

      const data: MinimaxStreamResponse = await response.json();
      const rawContent = data.choices?.[0]?.delta?.content;

      if (!rawContent) {
        throw new Error('No content generated from Minimax');
      }

      const content = rawContent.trim();

      // Extract title from first line (assuming it's H1 or bold)
      const lines = content.split('\n');
      const titleLine = lines.find((l) => l.startsWith('# ') || l.startsWith('**'));
      const title = titleLine
        ? titleLine.replace(/^#\s*/, '').replace(/\*\*/g, '')
        : topic;

      // Remove title from content and create excerpt
      const contentWithoutTitle = lines
        .filter((l) => !l.startsWith('# ') && !l.startsWith('**'))
        .join('\n')
        .trim();

      const excerpt = contentWithoutTitle.slice(0, 200) + (contentWithoutTitle.length > 200 ? '...' : '');

      return { title, content: contentWithoutTitle, excerpt };
    })();

  const result = await withRetry(makeRequest, {
    maxRetries: 2,
    retryableStatuses: [429, 500, 502, 503, 504],
    context: 'Minimax.generateBlogContent',
  });

  return result;
}