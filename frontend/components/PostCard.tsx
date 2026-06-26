import Image from "next/image";
import Link from "next/link";
import { BlogPost } from "../lib/types";

interface PostCardProps {
  post: BlogPost;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="post-card">
      {post.coverImage ? (
        <Image src={post.coverImage} alt={post.title} width={1200} height={700} />
      ) : (
        <div className="post-card-placeholder" aria-hidden="true">
          <span>{post.category}</span>
        </div>
      )}
      <div className="post-card-content">
        <p className="meta">
          <span>{post.category}</span>
          <span>|</span>
          <span>{post.readTimeMinutes} min read</span>
          <span>|</span>
          <span>Rating {post.rating}</span>
        </p>
        <h3>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        <p>{post.excerpt}</p>
        <Link href={`/blog/${post.slug}`} className="read-link">
          Read analysis
        </Link>
      </div>
    </article>
  );
}
