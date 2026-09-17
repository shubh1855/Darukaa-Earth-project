import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Map, { Layer, MapRef, Source } from "react-map-gl";

import "mapbox-gl/dist/mapbox-gl.css";
import "./styles.css";

type TokenResponse = { access_token: string; token_type: string };
type Project = {
  id: number;
  name: string;
  description: string;
  created_at: string;
};

type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

type Site = {
  id: number;
  project_id: number;
  geometry: PolygonGeometry;
  area_hectares: number;
  created_at: string;
};

type SiteFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      siteId: number;
      areaHectares: number;
    };
    geometry: PolygonGeometry;
  }>;
};

type ApiError = { detail?: string };

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const SAMPLE_POLYGON = JSON.stringify(
  {
    type: "Polygon",
    coordinates: [
      [
        [0.0, 0.0],
        [1.0, 0.0],
        [1.0, 1.0],
        [0.0, 1.0],
        [0.0, 0.0],
      ],
    ],
  },
  null,
  2,
);

const siteFillLayer = {
  id: "site-fill",
  type: "fill",
  paint: {
    "fill-color": "#1d976c",
    "fill-opacity": 0.3,
  },
} as const;

const siteOutlineLayer = {
  id: "site-outline",
  type: "line",
  paint: {
    "line-color": "#126149",
    "line-width": 2,
  },
} as const;

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
  const [projectError, setProjectError] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [sites, setSites] = useState<Site[]>([]);
  const mapRef = useRef<MapRef | null>(null);
  const [loadingSites, setLoadingSites] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [siteGeometryInput, setSiteGeometryInput] = useState(SAMPLE_POLYGON);
  const [creatingSite, setCreatingSite] = useState(false);
  const [createSiteError, setCreateSiteError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    setProjectError(null);
    try {
      const data = await request<Project[]>("/projects", {}, token);
      setProjects(data);
    } catch (requestError) {
      setProjectError((requestError as Error).message);
    } finally {
      setLoadingProjects(false);
    }
  }, [token]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    setSelectedProjectId((current) => {
      if (current && projects.some((project) => project.id === current)) {
        return current;
      }
      return projects[0].id;
    });
  }, [projects]);

  const loadSites = useCallback(async () => {
    if (!selectedProjectId) {
      setSites([]);
      setSitesError(null);
      return;
    }

    setLoadingSites(true);
    setSitesError(null);

    try {
      const data = await request<Site[]>(
        `/projects/${selectedProjectId}/sites`,
        {},
        token,
      );
      setSites(data);
    } catch (requestError) {
      setSitesError((requestError as Error).message);
    } finally {
      setLoadingSites(false);
    }
  }, [selectedProjectId, token]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProjectError(null);

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
      setProjectError((requestError as Error).message);
    }
  }

  async function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateSiteError(null);

    if (!selectedProjectId) {
      setCreateSiteError("Select a project first.");
      return;
    }

    let geometry: PolygonGeometry;
    try {
      geometry = JSON.parse(siteGeometryInput) as PolygonGeometry;
    } catch {
      setCreateSiteError("Geometry must be valid JSON.");
      return;
    }

    setCreatingSite(true);
    try {
      const createdSite = await request<Site>(
        `/projects/${selectedProjectId}/sites`,
        {
          method: "POST",
          body: JSON.stringify({ geometry }),
        },
        token,
      );
      setSites((current) => [createdSite, ...current]);
    } catch (requestError) {
      setCreateSiteError((requestError as Error).message);
    } finally {
      setCreatingSite(false);
    }
  }

  const projectCountLabel = useMemo(
    () => `${projects.length} project${projects.length === 1 ? "" : "s"}`,
    [projects.length],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const siteGeoJson = useMemo<SiteFeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: sites.map((site) => ({
        type: "Feature",
        properties: {
          siteId: site.id,
          areaHectares: site.area_hectares,
        },
        geometry: site.geometry,
      })),
    }),
    [sites],
  );

  const siteCountLabel = `${sites.length} site${sites.length === 1 ? "" : "s"}`;

  function focusSite(site: Site) {
    const ring = site.geometry.coordinates[0];
    const longitudes = ring.map(([longitude]) => longitude);
    const latitudes = ring.map(([, latitude]) => latitude);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);

    mapRef.current?.fitBounds(
      [
        [minLongitude, minLatitude],
        [maxLongitude, maxLatitude],
      ],
      { padding: 72, maxZoom: 12, duration: 500 },
    );
  }

  useEffect(() => {
    if (!mapRef.current || sites.length === 0) {
      return;
    }

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const site of sites) {
      for (const [lon, lat] of site.geometry.coordinates[0]) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }

    if (
      Number.isFinite(minLon) &&
      Number.isFinite(maxLon) &&
      Number.isFinite(minLat) &&
      Number.isFinite(maxLat)
    ) {
      mapRef.current.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 48, duration: 500 },
      );
    }
  }, [sites]);

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
        {projectError ? <p className="error">{projectError}</p> : null}
      </section>

      <section className="card">
        <h2>Projects</h2>
        {loadingProjects ? <p>Loading projects...</p> : null}
        {!loadingProjects && projects.length === 0 ? (
          <p>No projects yet. Create first project.</p>
        ) : null}
        {!loadingProjects && projects.length > 0 ? (
          <>
            <label>
              Selected project
              <select
                value={selectedProjectId ?? ""}
                onChange={(event) =>
                  setSelectedProjectId(Number(event.target.value))
                }
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <ul className="project-list">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className={
                    project.id === selectedProjectId ? "selected-item" : ""
                  }
                >
                  <strong>{project.name}</strong>
                  <p>{project.description || "No description"}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className="card">
        <h2>Sites {selectedProject ? `for ${selectedProject.name}` : ""}</h2>
        {selectedProject ? (
          <p>{siteCountLabel}</p>
        ) : (
          <p>Select a project to load sites.</p>
        )}

        {loadingSites ? <p>Loading sites...</p> : null}
        {sitesError ? <p className="error">{sitesError}</p> : null}

        {!loadingSites &&
        !sitesError &&
        selectedProject &&
        sites.length === 0 ? (
          <p>No sites yet for this project.</p>
        ) : null}

        {!loadingSites && !sitesError && sites.length > 0 ? (
          <ul className="site-list">
            {sites.map((site) => (
              <li key={site.id}>
                <button
                  className="site-item"
                  type="button"
                  onClick={() => focusSite(site)}
                >
                  <strong>Site #{site.id}</strong>
                  <span>
                    Area: {site.area_hectares.toFixed(2)} ha · Show on map
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card">
        <h2>Site map</h2>
        {!MAPBOX_TOKEN ? (
          <p className="error">
            Map unavailable. Set <code>VITE_MAPBOX_TOKEN</code> to view
            polygons.
          </p>
        ) : (
          <div className="map-wrap">
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                longitude: 78.9629,
                latitude: 20.5937,
                zoom: 3.2,
              }}
              mapStyle="mapbox://styles/mapbox/light-v11"
            >
              <Source id="sites" type="geojson" data={siteGeoJson}>
                <Layer {...siteFillLayer} />
                <Layer {...siteOutlineLayer} />
              </Source>
            </Map>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Create site</h2>
        <form onSubmit={createSite} className="project-form">
          <label>
            GeoJSON Polygon
            <textarea
              value={siteGeometryInput}
              onChange={(event) => setSiteGeometryInput(event.target.value)}
              rows={10}
              spellCheck={false}
            />
          </label>
          <button type="submit" disabled={creatingSite || !selectedProjectId}>
            {creatingSite ? "Creating site..." : "Create site"}
          </button>
        </form>
        {createSiteError ? <p className="error">{createSiteError}</p> : null}
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
