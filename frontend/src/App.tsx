import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiUrl, getHealthIndex, getPostBySlug, getPosts, subscribe } from "./api";
import type { AdminSettings, BlogPost, HealthIndex } from "./domain";

type DraftPost = Omit<BlogPost, "secondaryKeywords"> & { secondaryKeywords: string };
type AdminView = "articles" | "generation";
type PendingAction = "auth" | "sync" | "save-post" | "delete-post" | "save-settings" | "generate" | null;
type StatusTone = "success" | "error" | "info";

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

const coverPool = [
  "/covers/cover1.png",
  "/covers/cover2.png",
  "/covers/cover3.png",
  "/covers/cover4.png"
];

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("app:navigate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function ShareBar({ title }: { title: string }) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const targets = [
    { label: "X", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    { label: "Threads", href: `https://www.threads.net/intent/post?text=${encodedTitle}%20${encodedUrl}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
  ];

  return (
    <aside className="share-bar" aria-label="Share this post">
      <span>Share</span>
      {targets.map((target) => (
        <a key={target.label} href={target.href} target="_blank" rel="noreferrer">{target.label}</a>
      ))}
    </aside>
  );
}

function getStableCover(post: BlogPost) {
  if (post.coverImage) return post.coverImage;
  let hash = 0;
  for (const char of post.slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return coverPool[hash % coverPool.length];
}

function getCookie(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <button className="logo logo-button" onClick={() => navigate("/")}>
          Healthy<span>Stock</span>
        </button>
        <nav className="site-nav">
          <button onClick={() => navigate("/blog")}>Blog</button>
        </nav>
        <div className="tagline">Food ratings, blood sugar notes, practical health signals</div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        HealthyStock publishes educational nutrition content. It is not medical advice.
      </div>
    </footer>
  );
}

function MedicalDisclaimer() {
  return (
    <aside className="medical-disclaimer">
      <strong>Educational content only</strong>
      <p>
        This article is not medical advice, diagnosis, or treatment. If you have a health condition,
        take medication, are pregnant, or plan major diet changes, speak with your doctor or qualified clinician.
      </p>
    </aside>
  );
}

function Newsletter() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setMessage(await subscribe(email));
      setEmail("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Subscription failed");
    }
  }

  return (
    <section className="newsletter container">
      <h2>Get the weekly food signal</h2>
      <p>Short practical notes on nutrition, product ratings, and healthy defaults.</p>
      <form onSubmit={submit}>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
        <button type="submit">Subscribe</button>
      </form>
      {message ? <p className="status">{message}</p> : null}
    </section>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="post-card" role="link" tabIndex={0} onClick={() => navigate(`/blog/${post.slug}`)} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        navigate(`/blog/${post.slug}`);
      }
    }}>
      <img src={getStableCover(post)} alt="" />
      <div className="post-card-content">
        <div className="meta">
          <span>{post.category}</span>
          <span>{post.rating}</span>
          <span>{post.readTimeMinutes} min</span>
        </div>
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
        <button className="read-link">Read analysis</button>
      </div>
    </article>
  );
}

function SearchAndFeed({ posts }: { posts: BlogPost[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) =>
      [post.title, post.excerpt, post.primaryKeyword, post.category, ...post.secondaryKeywords]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [posts, query]);

  return (
    <section className="feed container">
      <div className="feed-head">
        <div>
          <h2>Latest health stock reports</h2>
          <p>Food decisions scored for everyday energy, fiber, and metabolic steadiness.</p>
        </div>
        <label className="search-bar">
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="chia, protein, blood sugar..." />
        </label>
      </div>
      <div className="posts-grid">
        {filtered.map((post) => <PostCard key={post.slug} post={post} />)}
      </div>
    </section>
  );
}

function HomePage({ posts, healthIndex }: { posts: BlogPost[]; healthIndex: HealthIndex | null }) {
  return (
    <>
      <section className="hero">
        <div className="hero-glow" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-kicker">Food intelligence for everyday decisions</div>
            <h1>Healthier defaults, scored like a stock watchlist.</h1>
            <p>
              HealthyStock turns nutrition research into readable food ratings, risk notes, and
              practical swaps for busy people who want better daily choices.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => navigate("/blog")}>Read the blog</button>
              <button className="btn" onClick={() => navigate("/blog")}>Browse ratings</button>
            </div>
          </div>
          <aside className="hero-card">
            <h2>Live Health Index</h2>
            <ul>
              {(healthIndex?.metrics ?? []).slice(0, 3).map((metric) => (
                <li key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value} / 100</strong>
                </li>
              ))}
            </ul>
            <p><em>Signal:</em> {healthIndex?.signal ?? "Shift breakfast portfolio toward protein + fiber."}</p>
            <small>Educational signal, not medical advice.</small>
          </aside>
        </div>
      </section>
      <Ticker items={healthIndex?.tickerItems ?? []} />
      <SearchAndFeed posts={posts} />
      <Newsletter />
    </>
  );
}

function Ticker({ items }: { items: string[] }) {
  const content = items.length ? items : ["Protein + fiber improves breakfast stability", "Ultra-processed snacks remain a downside risk"];
  return (
    <div className="ticker">
      <div className="ticker-track">
        {[...content, ...content].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
      </div>
    </div>
  );
}

function BlogPage({ posts }: { posts: BlogPost[] }) {
  return (
    <>
      <section className="blog-index-hero">
        <div className="container blog-index-hero-inner">
          <div>
            <div className="hero-kicker">HealthyStock archive</div>
            <h1>Food ratings and practical nutrition notes.</h1>
            <p>Search the archive for product signals, breakfast swaps, fiber ideas, and blood sugar-friendly choices.</p>
          </div>
          <aside className="blog-index-panel">
            <span>Editorial rule</span>
            <strong>Useful, cautious, practical.</strong>
            <p>No medical promises, no hype. Just clear food analysis.</p>
          </aside>
        </div>
      </section>
      <SearchAndFeed posts={posts} />
    </>
  );
}

function ArticlePage({ post }: { post?: BlogPost | null }) {
  if (!post) {
    return (
      <main className="container article-page">
        <p className="breadcrumb">404</p>
        <h1>Article not found</h1>
        <button className="btn btn-primary" onClick={() => navigate("/blog")}>Back to blog</button>
      </main>
    );
  }

  return (
    <main className="container article-page">
      <button className="breadcrumb link-button" onClick={() => navigate("/blog")}>Back to blog</button>
      <h1>{post.title}</h1>
      <p className="article-meta">
        {post.author} · {post.publishedAt} · {post.readTimeMinutes} min · Rating {post.rating}
      </p>
      <img className="article-cover" src={getStableCover(post)} alt="" />
      <MedicalDisclaimer />
      <ShareBar title={post.title} />
      <section dangerouslySetInnerHTML={{ __html: post.content }} />
    </main>
  );
}

function AdminPanel() {
  const [accessToken, setAccessToken] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [draft, setDraft] = useState<DraftPost>(emptyDraft);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [credentials, setCredentials] = useState({ login: "", password: "" });
  const [activePanel, setActivePanel] = useState<AdminView>("articles");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [status, setStatus] = useState<{ tone: StatusTone; text: string } | null>(null);

  const isEditing = Boolean(selectedSlug);
  const isBusy = pendingAction !== null;

  useEffect(() => {
    refreshAccessToken().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (accessToken) {
      Promise.all([loadPosts(accessToken), loadSettings(accessToken)]).catch((error) => {
        setStatus({ tone: "error", text: error instanceof Error ? error.message : "Failed to load admin data" });
      });
    }
  }, [accessToken]);

  const sortedPosts = useMemo(() => [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), [posts]);
  const filteredPosts = useMemo(() => {
    return sortedPosts.filter((post) => {
      const normalizedStatus = post.status ?? "published";
      const passesStatus = statusFilter === "all" || normalizedStatus === statusFilter;
      const haystack = `${post.title} ${post.slug} ${post.primaryKeyword} ${post.category}`.toLowerCase();
      const passesSearch = search.trim().length === 0 || haystack.includes(search.trim().toLowerCase());
      return passesStatus && passesSearch;
    });
  }, [search, sortedPosts, statusFilter]);

  const stats = useMemo(() => {
    const draftCount = posts.filter((post) => (post.status ?? "published") === "draft").length;
    return { total: posts.length, drafts: draftCount, published: posts.length - draftCount };
  }, [posts]);

  function setSuccess(text: string) { setStatus({ tone: "success", text }); }
  function setError(text: string) { setStatus({ tone: "error", text }); }
  function setInfo(text: string) { setStatus({ tone: "info", text }); }
  function createNewDraft(): DraftPost { return { ...emptyDraft, publishedAt: new Date().toISOString().slice(0, 10) }; }
  function toDraftPost(post: BlogPost): DraftPost { return { ...post, coverImage: post.coverImage ?? "", secondaryKeywords: post.secondaryKeywords.join(", ") }; }
  function toPostPayload(currentDraft: DraftPost) {
    return {
      ...currentDraft,
      secondaryKeywords: currentDraft.secondaryKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean)
    };
  }

  async function request<T>(path: string, init: RequestInit = {}, token = accessToken): Promise<T> {
    const csrfHeaderToken = path === "/api/auth/refresh" || path === "/api/auth/logout"
      ? csrfToken || getCookie("hs_csrf_token")
      : null;
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfHeaderToken ? { "x-csrf-token": csrfHeaderToken } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers
      }
    });

    if (response.status === 401 && path !== "/api/auth/refresh") {
      try {
        const refreshedToken = await refreshAccessToken();
        return request<T>(path, init, refreshedToken);
      } catch {
        setAccessToken("");
        throw new Error("Session expired. Sign in again.");
      }
    }

    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) : {};
    if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
    return data as T;
  }

  async function refreshAccessToken() {
    const data = await request<{ accessToken: string; csrfToken?: string }>("/api/auth/refresh", { method: "POST" }, "");
    setAccessToken(data.accessToken);
    if (data.csrfToken) setCsrfToken(data.csrfToken);
    return data.accessToken;
  }

  async function loadPosts(token = accessToken) {
    setPendingAction("sync");
    const data = await request<{ items: BlogPost[] }>("/api/admin/posts", {}, token);
    setPosts(data.items);
    setPendingAction(null);
  }

  async function loadSettings(token = accessToken) {
    setSettings(await request<AdminSettings>("/api/admin/settings", {}, token));
  }

  async function refreshAdminData() {
    try {
      setPendingAction("sync");
      await Promise.all([loadPosts(), loadSettings()]);
      setSuccess("Admin data refreshed");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setPendingAction("auth");
    setStatus(null);
    try {
      const data = await request<{ accessToken: string; csrfToken?: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: credentials.login, password: credentials.password })
      }, "");
      setAccessToken(data.accessToken);
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      setCredentials({ login: "", password: "" });
      setSuccess("Signed in");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function logout() {
    setPendingAction("auth");
    await request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken("");
    setCsrfToken("");
    setPosts([]);
    setSettings(null);
    setSelectedSlug("");
    setDraft(createNewDraft());
    setSuccess("Signed out");
    setPendingAction(null);
  }

  function selectPost(post: BlogPost) {
    setSelectedSlug(post.slug);
    setDraft(toDraftPost(post));
    setStatus(null);
  }

  function newPost() {
    setActivePanel("articles");
    setSearch("");
    setStatusFilter("all");
    setSelectedSlug("");
    setDraft(createNewDraft());
    setStatus(null);
  }

  function duplicatePost() {
    setSelectedSlug("");
    setDraft((current) => ({
      ...current,
      title: `${current.title} (copy)`,
      slug: "",
      status: "draft",
      publishedAt: new Date().toISOString().slice(0, 10)
    }));
    setInfo("Copy created in editor as a new draft");
  }

  async function savePost(event: FormEvent) {
    event.preventDefault();
    setPendingAction("save-post");
    setStatus(null);
    try {
      const saved = await request<BlogPost>(isEditing ? `/api/admin/posts/${selectedSlug}` : "/api/admin/posts", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(toPostPayload(draft))
      });
      setSelectedSlug(saved.slug);
      setDraft(toDraftPost(saved));
      await loadPosts();
      setSuccess("Article saved");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteSelectedPost() {
    if (!selectedSlug || !window.confirm("Delete this saved article? Sample articles can only be overridden, not deleted.")) return;
    setPendingAction("delete-post");
    try {
      await request(`/api/admin/posts/${selectedSlug}`, { method: "DELETE" });
      setSelectedSlug("");
      setDraft(createNewDraft());
      await loadPosts();
      setSuccess("Article deleted");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setPendingAction("save-settings");
    try {
      setSettings(await request<AdminSettings>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings)
      }));
      setSuccess("Generation settings saved");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Settings save failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function generateNow() {
    if (!settings) return;
    setPendingAction("generate");
    setInfo("Generating article...");
    try {
      const savedSettings = await request<AdminSettings>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings)
      });
      setSettings(savedSettings);
      const generated = await request<{ post: BlogPost }>("/api/ai/generate-article", {
        method: "POST",
        body: JSON.stringify({ topic: savedSettings.generationTopic })
      });
      await Promise.all([loadPosts(), loadSettings()]);
      selectPost(generated.post);
      setActivePanel("articles");
      setSuccess(`Generated article: ${generated.post.title}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setPendingAction(null);
    }
  }

  if (!accessToken) {
    return (
      <section className="admin-auth container">
        <form onSubmit={login}>
          <h1>Admin</h1>
          <p>Sign in with superadmin email and password</p>
          <label>Email<input type="email" value={credentials.login} onChange={(event) => setCredentials((current) => ({ ...current, login: event.target.value }))} autoComplete="username" required /></label>
          <label>Password<input type="password" value={credentials.password} onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))} autoComplete="current-password" required /></label>
          <button type="submit" disabled={pendingAction === "auth"}>{pendingAction === "auth" ? "Signing in..." : "Sign in"}</button>
          {status ? <p className={`status ${status.tone === "error" ? "status-error" : ""}`}>{status.text}</p> : null}
        </form>
      </section>
    );
  }

  return (
    <section className="admin-page container">
      <header className="admin-toolbar">
        <div>
          <h1>Control Room</h1>
          <p>Content ops, generation, and publishing workflow</p>
        </div>
        <div>
          <button type="button" className={activePanel === "articles" ? "" : "btn-secondary"} onClick={() => setActivePanel("articles")}>Articles</button>
          <button type="button" className={activePanel === "generation" ? "" : "btn-secondary"} onClick={() => setActivePanel("generation")}>Generation</button>
          <button type="button" className="btn-secondary" onClick={refreshAdminData} disabled={pendingAction === "sync"}>{pendingAction === "sync" ? "Refreshing..." : "Refresh"}</button>
          <button type="button" onClick={logout} className="btn-secondary" disabled={pendingAction === "auth"}>Logout</button>
        </div>
      </header>

      <div className="admin-kpis">
        <article className="admin-kpi"><span>Total posts</span><strong>{stats.total}</strong></article>
        <article className="admin-kpi"><span>Drafts</span><strong>{stats.drafts}</strong></article>
        <article className="admin-kpi"><span>Published</span><strong>{stats.published}</strong></article>
      </div>

      {activePanel === "articles" ? (
        <div className="admin-layout">
          <aside className="admin-list">
            <div className="admin-list-head">
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, slug, keyword" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "draft" | "published")}>
                <option value="all">All statuses</option>
                <option value="draft">Drafts</option>
                <option value="published">Published</option>
              </select>
            </div>
            {filteredPosts.length === 0 ? <p className="empty-list">No posts match the current filter.</p> : null}
            {filteredPosts.map((post) => (
              <button type="button" key={post.slug} className={post.slug === selectedSlug ? "is-active" : ""} onClick={() => selectPost(post)}>
                <span>{post.title}</span>
                <small>{post.publishedAt} · {post.rating} · {post.status ?? "published"}</small>
              </button>
            ))}
          </aside>

          <form className="admin-editor" onSubmit={savePost}>
            <div className="admin-meta-bar">
              <span>{isEditing ? `Editing: ${selectedSlug}` : "Creating new article"}</span>
              {draft.status ? <span className={`status-chip status-${draft.status}`}>{draft.status}</span> : null}
            </div>
            <div className="admin-grid">
              <label>Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
              <label>Slug<input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} /></label>
              <label>Author<input value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} required /></label>
              <label>Published<input type="date" value={draft.publishedAt} onChange={(event) => setDraft({ ...draft, publishedAt: event.target.value })} required /></label>
              <label>Read minutes<input type="number" min="1" value={draft.readTimeMinutes} onChange={(event) => setDraft({ ...draft, readTimeMinutes: Number(event.target.value) })} required /></label>
              <label>Rating<select value={draft.rating} onChange={(event) => setDraft({ ...draft, rating: event.target.value as BlogPost["rating"] })}>{["A+", "A", "B", "C", "D", "F"].map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select></label>
              <label>Status<select value={draft.status ?? "published"} onChange={(event) => setDraft({ ...draft, status: event.target.value as BlogPost["status"] })}><option value="draft">Draft</option><option value="published">Published</option></select></label>
              <label>Category<input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required /></label>
              <label>Primary keyword<input value={draft.primaryKeyword} onChange={(event) => setDraft({ ...draft, primaryKeyword: event.target.value })} required /></label>
            </div>
            <label>Excerpt<textarea value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} required /></label>
            <label>Secondary keywords<input value={draft.secondaryKeywords} onChange={(event) => setDraft({ ...draft, secondaryKeywords: event.target.value })} placeholder="fiber, blood sugar, longevity" /></label>
            <label>Cover image URL<input value={draft.coverImage} onChange={(event) => setDraft({ ...draft, coverImage: event.target.value })} /></label>
            <label>Article HTML<textarea className="content-editor" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} required /></label>
            <footer className="admin-actions">
              <button type="submit" disabled={isBusy}>{pendingAction === "save-post" ? "Saving..." : isEditing ? "Save changes" : "Create article"}</button>
              <button type="button" className="btn-secondary" disabled={isBusy} onClick={duplicatePost}>Duplicate as draft</button>
              <button type="button" className="btn-secondary" disabled={isBusy} onClick={newPost}>Reset editor</button>
              {isEditing ? <button type="button" className="danger-button" disabled={isBusy} onClick={deleteSelectedPost}>Delete</button> : null}
              {status ? <p className={`status ${status.tone === "error" ? "status-error" : ""}`}>{status.text}</p> : null}
            </footer>
          </form>
        </div>
      ) : null}

      {activePanel === "generation" && settings ? (
        <form className="admin-editor generation-editor" onSubmit={saveSettings}>
          <div className="admin-grid">
            <label>Auto generation<select value={settings.autoGenerationEnabled ? "enabled" : "disabled"} onChange={(event) => setSettings({ ...settings, autoGenerationEnabled: event.target.value === "enabled" })}><option value="disabled">Disabled</option><option value="enabled">Enabled</option></select></label>
            <label>Frequency<select value={settings.generationFrequency} onChange={(event) => setSettings({ ...settings, generationFrequency: event.target.value as AdminSettings["generationFrequency"] })}><option value="manual">Manual only</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
            <label>Generation time<input type="time" value={settings.generationTime} onChange={(event) => setSettings({ ...settings, generationTime: event.target.value })} /></label>
            <label>Topic seed<input value={settings.generationTopic} onChange={(event) => setSettings({ ...settings, generationTopic: event.target.value })} /></label>
          </div>
          <label>Master prompt<textarea className="prompt-editor" value={settings.masterPrompt} onChange={(event) => setSettings({ ...settings, masterPrompt: event.target.value })} /></label>
          <div className="settings-summary">
            <p>Last run: <strong>{settings.lastGeneratedAt ? new Date(settings.lastGeneratedAt).toLocaleString() : "Never"}</strong></p>
            <p>Status: <strong>{settings.lastGenerationStatus ?? "No scheduled generation yet"}</strong></p>
          </div>
          <footer className="admin-actions">
            <button type="submit" disabled={isBusy}>{pendingAction === "save-settings" ? "Saving..." : "Save generation settings"}</button>
            <button type="button" className="btn-secondary" disabled={isBusy || settings.generationTopic.trim().length < 5} onClick={generateNow}>{pendingAction === "generate" ? "Working..." : "Generate now"}</button>
            {status ? <p className={`status ${status.tone === "error" ? "status-error" : ""}`}>{status.text}</p> : null}
          </footer>
        </form>
      ) : null}
    </section>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => window.location.pathname);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [healthIndex, setHealthIndex] = useState<HealthIndex | null>(null);
  const [activePost, setActivePost] = useState<BlogPost | null | undefined>(undefined);

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("app:navigate", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("app:navigate", syncRoute);
    };
  }, []);

  useEffect(() => {
    getPosts().then(setPosts).catch(() => setPosts([]));
    getHealthIndex().then(setHealthIndex).catch(() => setHealthIndex(null));
  }, []);

  const slug = route.startsWith("/blog/") ? decodeURIComponent(route.replace("/blog/", "")) : "";

  useEffect(() => {
    if (!slug) {
      setActivePost(undefined);
      return;
    }
    const existing = posts.find((post) => post.slug === slug);
    if (existing) {
      setActivePost(existing);
      return;
    }
    getPostBySlug(slug).then(setActivePost).catch(() => setActivePost(null));
  }, [slug, posts]);

  return (
    <>
      <Header />
      {route === "/admin" ? (
        <AdminPanel />
      ) : route === "/blog" ? (
        <BlogPage posts={posts} />
      ) : slug ? (
        <ArticlePage post={activePost} />
      ) : (
        <HomePage posts={posts} healthIndex={healthIndex} />
      )}
      {route !== "/admin" ? <Footer /> : null}
    </>
  );
}
