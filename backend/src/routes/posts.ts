import { Router } from "express";
import { getPostBySlug, getPublicPosts } from "../services/postStore.js";

const router = Router();

router.get("/", async (req, res) => {
  const search = String(req.query.search ?? "").trim().toLowerCase();
  const category = String(req.query.category ?? "").trim().toLowerCase();
  const posts = await getPublicPosts();

  const filtered = posts.filter((post) => {
    const matchesSearch =
      !search ||
      post.title.toLowerCase().includes(search) ||
      post.excerpt.toLowerCase().includes(search) ||
      post.primaryKeyword.toLowerCase().includes(search) ||
      post.secondaryKeywords.some((keyword) => keyword.toLowerCase().includes(search));

    const matchesCategory = !category || post.category.toLowerCase() === category;
    return matchesSearch && matchesCategory;
  });

  res.json({
    total: filtered.length,
    items: filtered
  });
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (!q) {
    return res.json({ items: [] });
  }

  const posts = await getPublicPosts();
  const items = posts
    .filter((post) => {
      return (
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q)
      );
    })
    .map((post) => ({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      category: post.category,
      publishedAt: post.publishedAt
    }));

  return res.json({ items });
});

router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  return res.json(post);
});

export default router;
