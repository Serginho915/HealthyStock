export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  author: string;
  publishedAt: string;
  readTimeMinutes: number;
  primaryKeyword: string;
  secondaryKeywords: string[];
  category: string;
  rating: "A+" | "A" | "B" | "C" | "D" | "F";
  status?: "draft" | "published";
}

export interface Subscriber {
  email: string;
  createdAt: string;
  source: string;
}
