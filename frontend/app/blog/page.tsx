import type { Metadata } from "next";
import { BlogIndexHeader } from "../../components/BlogIndexHeader";
import { NewsletterForm } from "../../components/NewsletterForm";
import { SearchAndFeed } from "../../components/SearchAndFeed";
import { getPosts } from "../../lib/api";
import { absoluteUrl } from "../../lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | HealthyStock",
  description:
    "Browse HealthyStock blog reports on nutrients, foods, product comparisons, and evidence-based health decisions.",
  alternates: {
    canonical: "/blog"
  },
  openGraph: {
    title: "Blog | HealthyStock",
    description: "Evidence-first health asset reports from HealthyStock.",
    url: absoluteUrl("/blog"),
    type: "website"
  }
};

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <>
      <BlogIndexHeader />
      <SearchAndFeed posts={posts} />
      <div className="container">
        <NewsletterForm />
      </div>
    </>
  );
}
