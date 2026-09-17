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
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import FreehandMode from "mapbox-gl-draw-freehand-mode";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
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
  name: string;
  geometry: PolygonGeometry;
  area_hectares: number;
  created_at: string;
};

type DrawMode =
  "draw_polygon" | "draw_freehand" | "direct_select" | "simple_select";

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

const drawModes = {
  ...MapboxDraw.modes,
  draw_freehand: FreehandMode as unknown as MapboxDraw.DrawCustomMode,
} as unknown as { [modeKey: string]: MapboxDraw.DrawCustomMode };

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
  const siteNameInputRef = useRef<HTMLInputElement | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [loadingSites, setLoadingSites] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [siteGeometryInput, setSiteGeometryInput] = useState("");
  const [coordinateInput, setCoordinateInput] = useState(
    "77.58, 12.97\n77.60, 12.97\n77.60, 12.99\n77.58, 12.99",
  );
  const [siteEntryMode, setSiteEntryMode] = useState<"draw" | "coordinates">(
    "draw",
  );
  const [drawUnavailable, setDrawUnavailable] = useState(false);
  const [activeDrawMode, setActiveDrawMode] = useState<DrawMode | null>(null);
  const [drawStats, setDrawStats] = useState<{
    area: number;
    x: number;
    y: number;
  } | null>(null);
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

    if (!siteName.trim()) {
      setCreateSiteError("Site name is required.");
      siteNameInputRef.current?.focus();
      return;
    }

    let geometry: PolygonGeometry;
    try {
      if (siteEntryMode === "coordinates") {
        const coordinates = coordinateInput
          .split("\n")
          .map((line) => line.split(",").map((value) => Number(value.trim())))
          .filter(
            (point) => point.length === 2 && point.every(Number.isFinite),
          );

        if (coordinates.length < 3) {
          throw new Error("at least three coordinate pairs are required");
        }

        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coordinates.push([...first]);
        }

        geometry = { type: "Polygon", coordinates: [coordinates] };
      } else {
        const parsedGeometry = JSON.parse(siteGeometryInput) as PolygonGeometry;
        if (
          parsedGeometry.type !== "Polygon" ||
          !Array.isArray(parsedGeometry.coordinates) ||
          parsedGeometry.coordinates.length === 0
        ) {
          throw new Error("not a polygon");
        }
        geometry = parsedGeometry;
      }
    } catch {
      setCreateSiteError("Draw a polygon or enter valid Polygon GeoJSON.");
      return;
    }

    setCreatingSite(true);
    try {
      await request<Site>(
        `/projects/${selectedProjectId}/sites`,
        {
          method: "POST",
          body: JSON.stringify({ name: siteName.trim(), geometry }),
        },
        token,
      );
      setSiteName("");
      setSiteGeometryInput("");
      setDrawStats(null);
      drawRef.current?.deleteAll();
      changeDrawMode("simple_select");
      setActiveDrawMode("simple_select");
      await loadSites();
    } catch (requestError) {
      setCreateSiteError((requestError as Error).message);
    } finally {
      setCreatingSite(false);
    }
  }

  function calculateDrawArea(feature: GeoJSON.Feature): number | null {
    if (feature.geometry.type !== "Polygon") {
      return null;
    }

    const ring = feature.geometry.coordinates[0] as number[][];
    if (ring.length < 3) {
      return null;
    }

    let area = 0;
    for (let index = 0; index < ring.length - 1; index += 1) {
      const [longitudeA, latitudeA] = ring[index];
      const [longitudeB, latitudeB] = ring[index + 1];
      area += longitudeA * latitudeB - longitudeB * latitudeA;
    }

    return Math.abs(area) * 0.5 * 12364;
  }

  function updateDrawStats(point?: { x: number; y: number }) {
    if (!drawRef.current || !mapRef.current) {
      return;
    }

    const feature = drawRef.current.getAll().features[0];
    const area = feature ? calculateDrawArea(feature) : null;
    if (area === null) {
      setDrawStats(null);
      return;
    }

    setDrawStats({
      area,
      x: point?.x ?? 20,
      y: point?.y ?? 20,
    });
  }

  function handleDrawCreate(event: MapboxDraw.DrawCreateEvent) {
    const feature = event.features[0];
    if (!feature || feature.geometry.type !== "Polygon") {
      setCreateSiteError("Only polygon sites are supported.");
      return;
    }

    setCreateSiteError(null);
    setSiteEntryMode("draw");
    setSiteGeometryInput(JSON.stringify(feature.geometry, null, 2));
    changeDrawMode("direct_select", { featureId: feature.id });
    setActiveDrawMode("direct_select");
    setDrawStats(null);
    siteNameInputRef.current?.focus();
  }

  function finishDrawing() {
    const draw = drawRef.current;
    const feature = draw
      ?.getAll()
      .features.find((candidate) => candidate.geometry.type === "Polygon");

    if (!draw || !feature || feature.geometry.type !== "Polygon") {
      setCreateSiteError("Add at least three points before finishing.");
      return;
    }

    const ring = [...(feature.geometry.coordinates[0] as number[][])];
    if (ring.length < 3) {
      setCreateSiteError("Add at least three points before finishing.");
      return;
    }

    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first]);
    }

    draw.delete(feature.id as string);
    const [newFeatureId] = draw.add({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [ring] },
    });
    const completedFeature = draw.get(newFeatureId);
    if (completedFeature) {
      handleDrawCreate({
        features: [completedFeature],
      } as MapboxDraw.DrawCreateEvent);
    }
  }

  function changeDrawMode(mode: string, options?: object) {
    const draw = drawRef.current as unknown as {
      changeMode: (nextMode: string, nextOptions?: object) => void;
    } | null;
    draw?.changeMode(mode, options);
  }

  function startDrawMode(mode: "draw_polygon" | "draw_freehand") {
    changeDrawMode(mode);
    setActiveDrawMode(mode);
    setDrawStats(null);
  }

  function handleMapLoad() {
    if (!mapRef.current || drawRef.current) {
      return;
    }

    try {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        modes: drawModes,
        controls: { polygon: true, trash: true },
      });
      const map = mapRef.current.getMap();
      map.addControl(draw, "top-left");
      map.on("draw.create", handleDrawCreate);
      map.on("draw.modechange", (event: { mode: string }) => {
        const mode = event.mode as DrawMode;
        setActiveDrawMode(mode);
        if (mode !== "draw_polygon" && mode !== "draw_freehand") {
          setDrawStats(null);
        }
      });
      map.on("mousemove", (event) => {
        const mode = drawRef.current?.getMode();
        if (mode === "draw_polygon" || mode === "draw_freehand") {
          updateDrawStats(event.point);
        }
      });
      drawRef.current = draw;
    } catch {
      setDrawUnavailable(true);
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
            <ul className="project-list">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className={
                    project.id === selectedProjectId ? "selected-item" : ""
                  }
                >
                  <button
                    className="project-item"
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <strong>{project.name}</strong>
                    <span>{project.description || "No description"}</span>
                  </button>
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
                  <strong>{site.name}</strong>
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
              onLoad={handleMapLoad}
            >
              <Source id="sites" type="geojson" data={siteGeoJson}>
                <Layer {...siteFillLayer} />
                <Layer {...siteOutlineLayer} />
              </Source>
            </Map>
            {activeDrawMode === "draw_polygon" ||
            activeDrawMode === "draw_freehand" ? (
              <div className="draw-toolbar">
                <button
                  type="button"
                  onClick={() => startDrawMode("draw_polygon")}
                >
                  Polygon
                </button>
                <button
                  type="button"
                  onClick={() => startDrawMode("draw_freehand")}
                >
                  Freehand
                </button>
                <button type="button" onClick={finishDrawing}>
                  Finish polygon
                </button>
              </div>
            ) : null}
            {drawStats ? (
              <div
                className="draw-stats"
                style={{ left: drawStats.x + 12, top: drawStats.y + 12 }}
              >
                {drawStats.area.toFixed(2)} hectares
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Create site</h2>
        {!MAPBOX_TOKEN || drawUnavailable ? (
          <p>
            {MAPBOX_TOKEN
              ? "Map drawing is unavailable. Enter a Polygon GeoJSON manually."
              : "Set VITE_MAPBOX_TOKEN to draw on the map, or enter a Polygon GeoJSON manually."}
          </p>
        ) : (
          <p>Use the polygon tool on the map, then enter a name below.</p>
        )}
        <div
          className="entry-mode"
          role="group"
          aria-label="Site boundary input method"
        >
          <button
            type="button"
            className={siteEntryMode === "draw" ? "mode-active" : "mode-button"}
            onClick={() => setSiteEntryMode("draw")}
            disabled={!MAPBOX_TOKEN || drawUnavailable}
          >
            Draw on map
          </button>
          <button
            type="button"
            className={
              siteEntryMode === "coordinates" ? "mode-active" : "mode-button"
            }
            onClick={() => setSiteEntryMode("coordinates")}
          >
            Enter coordinates
          </button>
        </div>
        <form onSubmit={createSite} className="project-form">
          <label>
            Site name
            <input
              ref={siteNameInputRef}
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              minLength={1}
              maxLength={120}
              required
            />
          </label>

          {siteEntryMode === "coordinates" ? (
            <label>
              Coordinates (one longitude, latitude pair per line)
              <textarea
                value={coordinateInput}
                onChange={(event) => setCoordinateInput(event.target.value)}
                rows={5}
                spellCheck={false}
                placeholder={
                  "77.58, 12.97\\n77.60, 12.97\\n77.60, 12.99\\n77.58, 12.99"
                }
              />
              <small>
                The first point closes automatically. Use at least three points.
              </small>
            </label>
          ) : null}
          {siteEntryMode === "draw" && (!MAPBOX_TOKEN || drawUnavailable) ? (
            <label>
              GeoJSON Polygon fallback
              <textarea
                value={siteGeometryInput || SAMPLE_POLYGON}
                onChange={(event) => setSiteGeometryInput(event.target.value)}
                rows={8}
                spellCheck={false}
              />
            </label>
          ) : null}

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
