import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";

type TokenResponse = { access_token: string; token_type: string };
type Project = {
  id: number;
  name: string;
  description: string;
  created_at: string;
};

type ApiError = { detail?: string };

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as ApiError;
      if (data.detail) {
        errorMessage = data.detail;
      }
    } catch {
      // ignore non-json errors
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

function AuthScreen({ onAuth }: { onAuth: (token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const data = await request<TokenResponse>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onAuth(data.access_token);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="card auth-card">
        <h1>Darukaa.Earth</h1>
        <p>Carbon and biodiversity project workspace</p>

        <form onSubmit={submit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          <button disabled={pending} type="submit">
            {pending
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}

        <button
          className="link"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "Need account? Register"
            : "Have account? Sign in"}
        </button>
      </section>
    </main>
  );
}

function Dashboard({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<Project[]>("/projects", {}, token);
      setProjects(data);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const project = await request<Project>(
        "/projects",
        {
          method: "POST",
          body: JSON.stringify({ name, description }),
        },
        token,
      );

      setProjects((current) => [project, ...current]);
      setName("");
      setDescription("");
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  const projectCountLabel = useMemo(
    () => `${projects.length} project${projects.length === 1 ? "" : "s"}`,
    [projects.length],
  );

  return (
    <main className="dashboard-layout">
      <header>
        <div>
          <h1>Darukaa.Earth</h1>
          <p>{projectCountLabel}</p>
        </div>
        <button className="link" onClick={onLogout}>
          Logout
        </button>
      </header>

      <section className="card">
        <h2>Create project</h2>
        <form onSubmit={createProject} className="project-form">
          <label>
            Project name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </label>

          <button type="submit">Add project</button>
        </form>
      </section>

      <section className="card">
        <h2>Projects</h2>
        {loading ? <p>Loading...</p> : null}
        {!loading && projects.length === 0 ? (
          <p>No projects yet. Create first project.</p>
        ) : null}
        {!loading && projects.length > 0 ? (
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <strong>{project.name}</strong>
                <p>{project.description || "No description"}</p>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}

function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("darukaa_token"),
  );

  function handleAuth(nextToken: string) {
    localStorage.setItem("darukaa_token", nextToken);
    setToken(nextToken);
  }

  function handleLogout() {
    localStorage.removeItem("darukaa_token");
    setToken(null);
  }

  if (!token) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return <Dashboard token={token} onLogout={handleLogout} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
