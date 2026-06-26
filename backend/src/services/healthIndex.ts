import { BlogPost } from "../types.js";
import { getPublicPosts } from "./postStore.js";

const ratingScores: Record<BlogPost["rating"], number> = {
  "A+": 96,
  A: 88,
  B: 74,
  C: 58,
  D: 38,
  F: 18
};

const energyTerms = ["energy", "protein", "breakfast", "magnesium", "fiber", "blood sugar", "metabolism"];
const inflammationTerms = ["inflammation", "processed", "sugar", "omega", "olive oil", "longevity", "heart"];
const sleepTerms = ["sleep", "stress", "magnesium", "caffeine", "evening", "recovery"];

export interface HealthIndex {
  updatedAt: string;
  sourcePostCount: number;
  metrics: Array<{
    label: string;
    value: number;
    trend: string;
  }>;
  tickerItems: string[];
  signal: string;
}

export async function getHealthIndex(): Promise<HealthIndex> {
  const posts = (await getPublicPosts()).slice(0, 8);
  const baseScore = average(posts.map((post) => ratingScores[post.rating] ?? 60), 65);

  const energy = metricScore(posts, energyTerms, baseScore + 2);
  const inflammation = 100 - metricScore(posts, inflammationTerms, 100 - baseScore + 10);
  const sleep = metricScore(posts, sleepTerms, baseScore - 4);
  const topPost = posts[0];

  return {
    updatedAt: new Date().toISOString(),
    sourcePostCount: posts.length,
    metrics: [
      {
        label: "Energy Yield",
        value: clampScore(energy),
        trend: trendLabel(energy - baseScore)
      },
      {
        label: "Inflammation Risk",
        value: clampScore(inflammation),
        trend: trendLabel(50 - inflammation, true)
      },
      {
        label: "Sleep Liquidity",
        value: clampScore(sleep),
        trend: trendLabel(sleep - baseScore)
      }
    ],
    tickerItems: buildTickerItems(posts),
    signal: topPost
      ? `Signal: latest research tilts toward ${topPost.primaryKeyword.toLowerCase()}.`
      : "Signal: add more research reports to build a stronger index."
  };
}

function buildTickerItems(posts: BlogPost[]): string[] {
  const items = posts.slice(0, 6).map((post) => {
    const score = ratingScores[post.rating] ?? 60;
    const delta = Math.round((score - 60) / 4);
    const sign = delta >= 0 ? "+" : "";
    const label = post.primaryKeyword || post.title;
    return `${label.toUpperCase()} ${sign}${delta}% ${tickerSignal(post)}`;
  });

  if (items.length > 0) {
    return items;
  }

  return ["NEW RESEARCH 0% awaiting reports"];
}

function tickerSignal(post: BlogPost): string {
  const text = searchableText(post);

  if (text.includes("sleep") || text.includes("magnesium")) {
    return "sleep outlook";
  }
  if (text.includes("blood sugar") || text.includes("sugar")) {
    return "blood volatility";
  }
  if (text.includes("protein") || text.includes("energy") || text.includes("breakfast")) {
    return "energy yield";
  }
  if (text.includes("inflammation") || text.includes("processed")) {
    return "inflammation risk";
  }
  if (text.includes("longevity") || text.includes("heart")) {
    return "longevity portfolio";
  }

  return "health return";
}

function metricScore(posts: BlogPost[], terms: string[], fallback: number): number {
  if (posts.length === 0) {
    return fallback;
  }

  const weightedScores = posts.map((post, index) => {
    const recencyWeight = Math.max(0.45, 1 - index * 0.08);
    const text = searchableText(post);
    const termHits = terms.filter((term) => text.includes(term)).length;
    const termBoost = Math.min(14, termHits * 4);
    return (ratingScores[post.rating] + termBoost) * recencyWeight;
  });

  const weights = posts.map((_, index) => Math.max(0.45, 1 - index * 0.08));
  return weightedScores.reduce((sum, score) => sum + score, 0) / weights.reduce((sum, weight) => sum + weight, 0);
}

function searchableText(post: BlogPost): string {
  return [
    post.title,
    post.excerpt,
    post.primaryKeyword,
    post.secondaryKeywords.join(" "),
    post.category,
    post.content
  ]
    .join(" ")
    .toLowerCase();
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampScore(value: number): number {
  return Math.round(Math.min(99, Math.max(1, value)));
}

function trendLabel(delta: number, inverse = false): string {
  const normalized = inverse ? -delta : delta;
  if (normalized >= 8) {
    return "up";
  }
  if (normalized <= -8) {
    return "down";
  }
  return "steady";
}
