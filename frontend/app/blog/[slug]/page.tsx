import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MedicalDisclaimer } from "../../../components/MedicalDisclaimer";
import { getPostBySlug } from "../../../lib/api";
import { absoluteUrl } from "../../../lib/site";

export const dynamic = "force-dynamic";

interface PostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) {
    return {
      title: "Article not found | HealthyStock"
    };
  }

  const openGraph: Metadata["openGraph"] = {
    title: `${post.title} | HealthyStock`,
    description: post.excerpt,
    type: "article",
    url: absoluteUrl(`/blog/${post.slug}`)
  };

  if (post.coverImage) {
    openGraph.images = [{ url: post.coverImage }];
  }

  return {
    title: `${post.title} | HealthyStock`,
    description: post.excerpt,
    alternates: {
      canonical: `/blog/${post.slug}`
    },
    openGraph
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    author: {
      "@type": "Person",
      name: post.author
    },
    datePublished: post.publishedAt,
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    ...(post.coverImage ? { image: post.coverImage } : {})
  };

  return (
    <article className="container article-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <p className="breadcrumb">
        <Link href="/">Home</Link> / <Link href="/blog">Blog</Link> / {post.category}
      </p>
      <h1>{post.title}</h1>
      <p className="article-meta">
        By {post.author} · {new Date(post.publishedAt).toLocaleDateString()} · {post.readTimeMinutes} min read
      </p>
      <MedicalDisclaimer />
      {post.coverImage ? (
        <Image src={post.coverImage} alt={post.title} width={1400} height={760} className="article-cover" />
      ) : null}

      <section dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}
