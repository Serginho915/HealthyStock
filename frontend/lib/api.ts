import { BlogPost, HealthIndex } from "./types";

function getApiUrl() {
  if (typeof window === "undefined") {
    return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  }

  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export async function getPosts(search = ""): Promise<BlogPost[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`${getApiUrl()}/api/posts${q}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch posts");
  }
  const data = (await res.json()) as { items: BlogPost[] };
  return data.items;
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const res = await fetch(`${getApiUrl()}/api/posts/${slug}`, { cache: "no-store" });
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as BlogPost;
}

export async function getHealthIndex(): Promise<HealthIndex> {
  const res = await fetch(`${getApiUrl()}/api/health-index`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch health index");
  }
  return (await res.json()) as HealthIndex;
}

export async function subscribe(email: string): Promise<string> {
  const res = await fetch(`${getApiUrl()}/api/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, source: "homepage-newsletter" })
  });

  const data = (await res.json()) as { message: string };
  if (!res.ok) {
    throw new Error(data.message || "Subscription failed");
  }

  return data.message;
}
