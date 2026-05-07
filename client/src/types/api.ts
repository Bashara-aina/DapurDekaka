export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: Record<string, unknown>;
}

export interface HomepageContent {
  carousel: {
    images: string[];
    title?: string;
    subtitle?: string;
  };
  logo: string;
  content: {
    hero: { title: string; subtitle: string };
    carousel: { title: string; subtitle: string };
    featuredProducts: { title: string; subtitle: string };
    latestArticles: { title: string; subtitle: string };
    customers: {
      title: string;
      subtitle: string;
      logos: string[];
    };
  };
  timestamp?: number;
}

export interface ContactPageContent {
  title: string;
  description: string;
  mainImage: string;
  contactInfo: {
    address: string;
    phone: string;
    email: string;
    openingHours: string;
    mapEmbedUrl: string;
  };
  socialLinks: {
    id: string;
    label: string;
    url: string;
    icon: string;
  }[];
  quickOrderUrl: string;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  image: string;
}

export interface AboutContent {
  title: string;
  description: string;
  mainImage: string;
  mainDescription: string;
  sections: {
    title: string;
    description: string;
  }[];
  features: Feature[];
}

export interface FooterContent {
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  socialLinks: Array<{
    id: string;
    platform: string;
    url: string;
    icon: string;
  }>;
  copyright: string;
  logoUrl?: string;
}

export interface MenuItemData {
  id: number;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  orderIndex: number | null;
  createdAt: Date | null;
}

export interface SauceData {
  id: number;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  orderIndex: number | null;
  createdAt: Date | null;
}
