"use client";

import { FormEvent, useState } from "react";
import { subscribe } from "../lib/api";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      const message = await subscribe(email);
      setStatus(message);
      setEmail("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to subscribe";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="newsletter" className="newsletter">
      <h2>Newsletter: Weekly Health Market Brief</h2>
      <p>Get practical upgrades, product ratings, and research snapshots in your inbox.</p>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
        />
        <button disabled={loading} type="submit">
          {loading ? "Submitting..." : "Subscribe via SMTP"}
        </button>
      </form>
      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}
