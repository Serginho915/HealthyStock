import { Hero } from "../components/Hero";
import { NewsletterForm } from "../components/NewsletterForm";
import { SearchAndFeed } from "../components/SearchAndFeed";
import { getHealthIndex, getPosts } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [posts, healthIndex] = await Promise.all([getPosts(), getHealthIndex()]);

  return (
    <>
      <Hero healthIndex={healthIndex} />
      <SearchAndFeed posts={posts} />
      <div className="container">
        <NewsletterForm />
      </div>
    </>
  );
}
