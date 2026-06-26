import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container">
      <h1>404</h1>
      <p>Page not found in this health market terminal.</p>
      <Link href="/">Back to main dashboard</Link>
    </section>
  );
}
