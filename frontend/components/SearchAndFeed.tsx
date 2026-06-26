"use client";

import { useMemo, useState } from "react";
import { BlogPost } from "../lib/types";
import { PostCard } from "./PostCard";

interface SearchAndFeedProps {
  posts: BlogPost[];
}

export function SearchAndFeed({ posts }: SearchAndFeedProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return posts;
    }

    return posts.filter((post) => {
      return (
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.primaryKeyword.toLowerCase().includes(q) ||
        post.secondaryKeywords.some((keyword) => keyword.toLowerCase().includes(q))
      );
    });
  }, [posts, query]);

  return (
    <section className="container feed" id="blog-feed">
      <div className="feed-head">
        <h2>Latest Health Asset Reports</h2>
        <label className="search-bar" aria-label="Search blog articles">
          <span>Search by topic, nutrient, or risk factor</span>
          <input
            type="search"
            placeholder="Try: magnesium, blood sugar, longevity..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p>No reports found for this search. Try a nutrient, food group, or risk phrase.</p>
      ) : null}

      <div className="posts-grid">
        {filtered.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
