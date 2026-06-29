"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminSettings, BlogPost } from "../lib/types";

type DraftPost = Omit<BlogPost, "secondaryKeywords"> & {
  secondaryKeywords: string;
};

const emptyDraft: DraftPost = {
  id: "",
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  author: "Maria Iordanova",
  publishedAt: new Date().toISOString().slice(0, 10),
  readTimeMinutes: 6,
  primaryKeyword: "",
  secondaryKeywords: "",
  category: "Admin",
  rating: "B",
  status: "draft"
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function AdminPanel() {
  const [accessToken, setAccessToken] = useState("");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [draft, setDraft] = useState<DraftPost>(emptyDraft);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [activePanel, setActivePanel] = useState<"articles" | "generation">("articles");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(selectedSlug);

  useEffect(() => {
    refreshAccessToken().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (accessToken) {
      Promise.all([loadPosts(accessToken), loadSettings(accessToken)]).catch((error) => setStatus(error.message));
    }
  }, [accessToken]);

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [posts]
  );

  function getCookie(name: string): string | null {
    if (typeof document === "undefined") {
      return null;
    }

    const prefix = `${name}=`;
    const cookie = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(prefix));

    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
  }

  async function request<T>(path: string, init: RequestInit = {}, token = accessToken): Promise<T> {
    const csrfToken = path === "/api/auth/refresh" || path === "/api/auth/logout"
      ? getCookie("hs_csrf_token")
      : null;

    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers
      }
    });

    if (res.status === 401 && path !== "/api/auth/refresh") {
      const nextToken = await refreshAccessToken();
      return request<T>(path, init, nextToken);
    }

    const data = (await res.json()) as T & { message?: string };
    if (!res.ok) {
      throw new Error(data.message ?? "Request failed");
    }

    return data;
  }

  async function refreshAccessToken() {
    const data = await request<{ accessToken: string }>("/api/auth/refresh", { method: "POST" }, "");
    setAccessToken(data.accessToken);
    return data.accessToken;
  }

  async function loadPosts(token = accessToken) {
    const data = await request<{ items: BlogPost[] }>("/api/admin/posts", {}, token);
    setPosts(data.items);
  }

  async function loadSettings(token = accessToken) {
    const data = await request<AdminSettings>("/api/admin/settings", {}, token);
    setSettings(data);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      const data = await request<{ accessToken: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      }, "");
      setAccessToken(data.accessToken);
      setCredentials({ username: "", password: "" });
      setStatus("Signed in");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken("");
    setPosts([]);
    setSettings(null);
    setSelectedSlug("");
    setDraft(emptyDraft);
    setStatus("Signed out");
  }

  function selectPost(post: BlogPost) {
    setSelectedSlug(post.slug);
    setDraft({
      ...post,
      coverImage: post.coverImage ?? "",
      secondaryKeywords: post.secondaryKeywords.join(", ")
    });
    setStatus("");
  }

  function newPost() {
    setSelectedSlug("");
    setDraft({ ...emptyDraft, publishedAt: new Date().toISOString().slice(0, 10) });
    setStatus("");
  }

  async function savePost(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const payload = {
      ...draft,
      secondaryKeywords: draft.secondaryKeywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    };

    try {
      const saved = await request<BlogPost>(isEditing ? `/api/admin/posts/${selectedSlug}` : "/api/admin/posts", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      setSelectedSlug(saved.slug);
      setDraft({ ...saved, coverImage: saved.coverImage ?? "", secondaryKeywords: saved.secondaryKeywords.join(", ") });
      await loadPosts();
      setStatus("Article saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelectedPost() {
    if (!selectedSlug || !window.confirm("Delete this saved article? Sample articles can only be overridden, not deleted.")) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await request(`/api/admin/posts/${selectedSlug}`, { method: "DELETE" });
      setSelectedSlug("");
      setDraft(emptyDraft);
      await loadPosts();
      setStatus("Article deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const saved = await request<AdminSettings>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings)
      });
      setSettings(saved);
      setStatus("Generation settings saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Settings save failed");
    } finally {
      setLoading(false);
    }
  }

  if (!accessToken) {
    return (
      <section className="admin-auth container">
        <form onSubmit={login}>
          <h1>Admin</h1>
          <label>
            Username
            <input
              value={credentials.username}
              onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          {status ? <p className="status">{status}</p> : null}
        </form>
      </section>
    );
  }

  return (
    <section className="admin-page container">
      <header className="admin-toolbar">
        <div>
          <h1>Articles</h1>
          <p>{posts.length} posts available</p>
        </div>
        <div>
          <button
            type="button"
            className={activePanel === "articles" ? "" : "btn-secondary"}
            onClick={() => setActivePanel("articles")}
          >
            Articles
          </button>
          <button
            type="button"
            className={activePanel === "generation" ? "" : "btn-secondary"}
            onClick={() => setActivePanel("generation")}
          >
            Generation
          </button>
          <button type="button" onClick={newPost}>
            New article
          </button>
          <button type="button" onClick={logout} className="btn-secondary">
            Logout
          </button>
        </div>
      </header>

      {activePanel === "articles" ? (
      <div className="admin-layout">
        <aside className="admin-list">
          {sortedPosts.map((post) => (
            <button
              type="button"
              key={post.slug}
              className={post.slug === selectedSlug ? "is-active" : ""}
              onClick={() => selectPost(post)}
            >
              <span>{post.title}</span>
              <small>{post.publishedAt} · {post.rating} · {post.status ?? "published"}</small>
            </button>
          ))}
        </aside>

        <form className="admin-editor" onSubmit={savePost}>
          <div className="admin-grid">
            <label>
              Title
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
            </label>
            <label>
              Slug
              <input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} />
            </label>
            <label>
              Author
              <input value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} required />
            </label>
            <label>
              Published
              <input
                type="date"
                value={draft.publishedAt}
                onChange={(event) => setDraft({ ...draft, publishedAt: event.target.value })}
                required
              />
            </label>
            <label>
              Read minutes
              <input
                type="number"
                min="1"
                value={draft.readTimeMinutes}
                onChange={(event) => setDraft({ ...draft, readTimeMinutes: Number(event.target.value) })}
                required
              />
            </label>
            <label>
              Rating
              <select
                value={draft.rating}
                onChange={(event) => setDraft({ ...draft, rating: event.target.value as BlogPost["rating"] })}
              >
                {["A+", "A", "B", "C", "D", "F"].map((rating) => (
                  <option key={rating} value={rating}>{rating}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={draft.status ?? "published"}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as BlogPost["status"] })}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label>
              Category
              <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required />
            </label>
            <label>
              Primary keyword
              <input
                value={draft.primaryKeyword}
                onChange={(event) => setDraft({ ...draft, primaryKeyword: event.target.value })}
                required
              />
            </label>
          </div>

          <label>
            Excerpt
            <textarea value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} required />
          </label>
          <label>
            Secondary keywords
            <input
              value={draft.secondaryKeywords}
              onChange={(event) => setDraft({ ...draft, secondaryKeywords: event.target.value })}
              placeholder="fiber, blood sugar, longevity"
            />
          </label>
          <label>
            Cover image URL
            <input value={draft.coverImage} onChange={(event) => setDraft({ ...draft, coverImage: event.target.value })} />
          </label>
          <label>
            Article HTML
            <textarea
              className="content-editor"
              value={draft.content}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              required
            />
          </label>

          <footer className="admin-actions">
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEditing ? "Save changes" : "Create article"}
            </button>
            {isEditing ? (
              <button type="button" className="danger-button" disabled={loading} onClick={deleteSelectedPost}>
                Delete
              </button>
            ) : null}
            {status ? <p className="status">{status}</p> : null}
          </footer>
        </form>
      </div>
      ) : null}

      {activePanel === "generation" && settings ? (
        <form className="admin-editor generation-editor" onSubmit={saveSettings}>
          <div className="admin-grid">
            <label>
              Auto generation
              <select
                value={settings.autoGenerationEnabled ? "enabled" : "disabled"}
                onChange={(event) =>
                  setSettings({ ...settings, autoGenerationEnabled: event.target.value === "enabled" })
                }
              >
                <option value="disabled">Disabled</option>
                <option value="enabled">Enabled</option>
              </select>
            </label>
            <label>
              Frequency
              <select
                value={settings.generationFrequency}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    generationFrequency: event.target.value as AdminSettings["generationFrequency"]
                  })
                }
              >
                <option value="manual">Manual only</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label>
              Generation time
              <input
                type="time"
                value={settings.generationTime}
                onChange={(event) => setSettings({ ...settings, generationTime: event.target.value })}
              />
            </label>
            <label>
              Topic seed
              <input
                value={settings.generationTopic}
                onChange={(event) => setSettings({ ...settings, generationTopic: event.target.value })}
              />
            </label>
          </div>

          <label>
            Master prompt
            <textarea
              className="prompt-editor"
              value={settings.masterPrompt}
              onChange={(event) => setSettings({ ...settings, masterPrompt: event.target.value })}
            />
          </label>

          <div className="settings-summary">
            <p>
              Last run: <strong>{settings.lastGeneratedAt ? new Date(settings.lastGeneratedAt).toLocaleString() : "Never"}</strong>
            </p>
            <p>
              Status: <strong>{settings.lastGenerationStatus ?? "No scheduled generation yet"}</strong>
            </p>
          </div>

          <footer className="admin-actions">
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save generation settings"}
            </button>
            {status ? <p className="status">{status}</p> : null}
          </footer>
        </form>
      ) : null}
    </section>
  );
}
