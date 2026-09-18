import {
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import Map, { Layer, MapRef, Source } from "react-map-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import FreehandMode from "mapbox-gl-draw-freehand-mode";

import {
  ensureMockHistory,
  formatMonthLabel,
  linearForecast,
} from "./mockData.js";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "./styles.css";

ChartJS.register(
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

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

type SiteMetric = {
  period: string;
  carbon_tonnes_co2e: number | null;
  biodiversity_score: number | null;
};

type SiteAnalytics = {
  site_id: number;
  site_name: string;
  area_hectares: number;
  latest_carbon_tonnes_co2e: number | null;
  latest_biodiversity_score: number | null;
  metrics: SiteMetric[];
};

type ProjectSiteAnalytics = {
  site_id: number;
  site_name: string;
  area_hectares: number;
  latest_carbon_tonnes_co2e: number | null;
  latest_biodiversity_score: number | null;
  carbon_history: Array<number | null>;
};

type ProjectAnalytics = {
  project_id: number;
  site_count: number;
  total_area_hectares: number;
  total_latest_carbon_tonnes_co2e: number | null;
  average_latest_biodiversity_score: number | null;
  sites_with_metrics: number;
  sites: ProjectSiteAnalytics[];
};

type SitePointFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      siteId: number;
      siteName: string;
      areaHectares: number;
    };
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
  }>;
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

const drawModes = {
  ...MapboxDraw.modes,
  draw_freehand: FreehandMode as unknown as MapboxDraw.DrawCustomMode,
} as unknown as { [modeKey: string]: MapboxDraw.DrawCustomMode };

const sitePointLayer = {
  id: "site-points",
  type: "circle",
  paint: {
    "circle-color": "#126149",
    "circle-radius": 5,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
  },
} as const;

const draftLineLayer = {
  id: "draft-line",
  type: "line",
  paint: {
    "line-color": "#0f8a62",
    "line-width": 2,
    "line-dasharray": [2, 1] as number[],
  },
} as const;

const draftPointLayer = {
  id: "draft-points",
  type: "circle",
  paint: {
    "circle-color": "#ffffff",
    "circle-stroke-color": "#0f8a62",
    "circle-stroke-width": 2,
    "circle-radius": 5,
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

function deltaLabel(
  current: number | null,
  previous: number | null,
  unit: string,
): string {
  if (current === null || previous === null) {
    return "No prior period";
  }
  const delta = current - previous;
  const percentage = previous === 0 ? 0 : (delta / previous) * 100;
  const precision = unit.includes("/") ? 3 : 1;
  return `${delta <= 0 ? "▼" : "▲"} ${Math.abs(delta).toFixed(precision)} ${unit} (${delta >= 0 ? "+" : ""}${percentage.toFixed(1)}% vs prior)`;
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

function getThumbnailPolygonPoints(geometry: PolygonGeometry): string {
  const ring = geometry.coordinates[0] ?? [];
  const longitudes = ring.map(([longitude]) => longitude);
  const latitudes = ring.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeRange = maxLongitude - minLongitude || 1;
  const latitudeRange = maxLatitude - minLatitude || 1;

  return ring
    .map(([longitude, latitude]) => {
      const x = 12 + ((longitude - minLongitude) / longitudeRange) * 76;
      const y = 50 - ((latitude - minLatitude) / latitudeRange) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function Sparkline({ values }: { values: Array<number | null> }) {
  const points = values.filter((value): value is number => value !== null);
  if (points.length < 2) {
    return <span className="sparkline-empty">No trend</span>;
  }

  const minimum = Math.min(...points);
  const maximum = Math.max(...points);
  const range = maximum - minimum || 1;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - (((value ?? minimum) - minimum) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="sparkline"
      viewBox="0 0 100 30"
      role="img"
      aria-label="Carbon trend"
    >
      <polyline points={path} />
    </svg>
  );
}

function ThemeIcon({ kind }: { kind: "sun" | "moon" }) {
  return kind === "sun" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />
    </svg>
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
  const [projectAnalytics, setProjectAnalytics] =
    useState<ProjectAnalytics | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [siteAnalytics, setSiteAnalytics] = useState<SiteAnalytics | null>(
    null,
  );
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsChartMode, setAnalyticsChartMode] = useState<
    "all" | "carbon" | "biodiversity"
  >("all");
  const [analyticsRange, setAnalyticsRange] = useState<
    "3M" | "6M" | "12M" | "All"
  >("6M");
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [seedingMetrics, setSeedingMetrics] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
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
  const [drawTool, setDrawTool] = useState<"point" | "freehand" | null>(
    "point",
  );
  const [draftPoints, setDraftPoints] = useState<Array<[number, number]>>([]);
  const [drawStats, setDrawStats] = useState<{
    area: number;
    x: number;
    y: number;
  } | null>(null);
  const [hoverSiteInfo, setHoverSiteInfo] = useState<{
    siteName: string;
    areaHectares: number;
    x: number;
    y: number;
  } | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [creatingSite, setCreatingSite] = useState(false);
  const [createSiteError, setCreateSiteError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  useEffect(() => {
    setThumbnailFailed(false);
  }, [selectedSiteId]);

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

  useEffect(() => {
    setSelectedSiteId(null);
    setThumbnailFailed(false);
    setSiteAnalytics(null);
    setAnalyticsError(null);
    setDrawStats(null);
    setHoverSiteInfo(null);
    setSiteGeometryInput("");
    setDraftPoints([]);
    setCreateSiteError(null);
    drawRef.current?.deleteAll();
    changeDrawMode("simple_select");
  }, [selectedProjectId]);

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

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectAnalytics(null);
      return;
    }

    let cancelled = false;
    void request<ProjectAnalytics>(
      `/projects/${selectedProjectId}/analytics`,
      {},
      token,
    ).then((data) => {
      if (!cancelled) {
        setProjectAnalytics(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, token]);

  useEffect(() => {
    if (!selectedSiteId) {
      setSiteAnalytics(null);
      setAnalyticsError(null);
      setAnalyticsLoading(false);
      return;
    }

    let cancelled = false;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    void request<SiteAnalytics>(`/sites/${selectedSiteId}/analytics`, {}, token)
      .then((data) => {
        if (!cancelled) {
          setSiteAnalytics(ensureMockHistory(data));
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setSiteAnalytics(null);
          setAnalyticsError((requestError as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAnalyticsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSiteId, token]);

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

  async function seedProjectMetrics() {
    if (!selectedProjectId) {
      return;
    }

    setSeedingMetrics(true);
    setSeedMessage(null);
    setAnalyticsError(null);
    try {
      const result = await request<{ created_count: number }>(
        `/projects/${selectedProjectId}/analytics/seed`,
        { method: "POST" },
        token,
      );
      setSeedMessage(
        result.created_count === 0
          ? "Demo metrics already exist for this project."
          : `Created ${result.created_count} demo metric rows.`,
      );
      const projectData = await request<ProjectAnalytics>(
        `/projects/${selectedProjectId}/analytics`,
        {},
        token,
      );
      setProjectAnalytics(projectData);
      if (selectedSiteId) {
        setSiteAnalytics(
          ensureMockHistory(
            await request<SiteAnalytics>(
              `/sites/${selectedSiteId}/analytics`,
              {},
              token,
            ),
          ),
        );
      }
    } catch (requestError) {
      setAnalyticsError((requestError as Error).message);
    } finally {
      setSeedingMetrics(false);
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
      await loadSites();
    } catch (requestError) {
      setCreateSiteError((requestError as Error).message);
    } finally {
      setCreatingSite(false);
    }
  }

  function calculateAreaFromRing(ring: number[][]): number | null {
    if (ring.length < 4) {
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

  function calculateDrawArea(feature: GeoJSON.Feature): number | null {
    if (feature.geometry.type !== "Polygon") {
      return null;
    }

    const ring = feature.geometry.coordinates[0] as number[][];
    return calculateAreaFromRing(ring);
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
    setDrawTool(null);
    setDrawStats(null);
    siteNameInputRef.current?.focus();
  }

  function finishPointByPointDrawing(
    closePoint: [number, number],
    point: { x: number; y: number },
  ) {
    if (draftPoints.length < 3) {
      setCreateSiteError("Add at least three points before closing polygon.");
      return;
    }

    const ring = [...draftPoints, closePoint] as number[][];
    const geometry: PolygonGeometry = {
      type: "Polygon",
      coordinates: [ring],
    };
    setSiteEntryMode("draw");
    setSiteGeometryInput(JSON.stringify(geometry, null, 2));
    setDraftPoints([]);
    setDrawTool(null);

    const draw = drawRef.current;
    if (draw) {
      draw.deleteAll();
      const [featureId] = draw.add({
        type: "Feature",
        properties: {},
        geometry,
      });
      changeDrawMode("direct_select", { featureId });
    }

    const area = calculateAreaFromRing(ring);
    if (area !== null) {
      setDrawStats({ area, x: point.x, y: point.y });
    }
    siteNameInputRef.current?.focus();
  }

  function handlePointByPointClick(event: {
    lngLat: { lng: number; lat: number };
    point: { x: number; y: number };
  }) {
    if (siteEntryMode !== "draw" || drawTool !== "point") {
      return false;
    }

    const map = mapRef.current?.getMap();
    if (!map) {
      return false;
    }

    const closingThresholdPixels = 10;
    if (draftPoints.length >= 3) {
      for (const vertex of draftPoints) {
        const pixel = map.project({ lng: vertex[0], lat: vertex[1] });
        const distance = Math.hypot(
          pixel.x - event.point.x,
          pixel.y - event.point.y,
        );
        if (distance <= closingThresholdPixels) {
          finishPointByPointDrawing(vertex, event.point);
          return true;
        }
      }
    }

    setCreateSiteError(null);
    setSiteGeometryInput("");
    setDraftPoints((current) => [
      ...current,
      [event.lngLat.lng, event.lngLat.lat],
    ]);
    return true;
  }

  function changeDrawMode(mode: string, options?: object) {
    const draw = drawRef.current as unknown as {
      changeMode: (nextMode: string, nextOptions?: object) => void;
    } | null;
    draw?.changeMode(mode, options);
  }

  function startDrawMode(mode: "point" | "draw_freehand") {
    setDrawStats(null);
    setCreateSiteError(null);

    if (
      (mode === "point" && drawTool === "point") ||
      (mode === "draw_freehand" && drawTool === "freehand")
    ) {
      drawRef.current?.deleteAll();
      changeDrawMode("simple_select");
      setDrawTool(null);
      setDraftPoints([]);
      setSiteGeometryInput("");
      return;
    }

    if (mode === "point") {
      drawRef.current?.deleteAll();
      changeDrawMode("simple_select");
      setDrawTool("point");
      setDraftPoints([]);
      return;
    }

    setDrawTool("freehand");
    setDraftPoints([]);
    setSiteGeometryInput("");
    drawRef.current?.deleteAll();
    changeDrawMode("draw_freehand");
  }

  function handleDashboardClick(event: MouseEvent<HTMLElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (
      target.closest(
        ".map-wrap, .draw-toolbar, .entry-mode, button, input, textarea, select, form",
      )
    ) {
      return;
    }

    if (drawTool !== null) {
      drawRef.current?.deleteAll();
      changeDrawMode("simple_select");
      setDrawTool(null);
      setDraftPoints([]);
      setDrawStats(null);
    }
  }

  function handleMapLoad() {
    if (!mapRef.current || drawRef.current) {
      return;
    }

    try {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        modes: drawModes,
        controls: { trash: true },
      });
      const map = mapRef.current.getMap();
      map.addControl(draw, "top-left");
      map.on("draw.create", handleDrawCreate);
      map.on("draw.update", (event: MapboxDraw.DrawUpdateEvent) => {
        const feature = event.features[0];
        if (feature && feature.geometry.type === "Polygon") {
          setSiteGeometryInput(JSON.stringify(feature.geometry, null, 2));
        }
        updateDrawStats();
      });
      map.on("draw.render", () => updateDrawStats());

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

  function getSitePoint(site: Site): [number, number] {
    const ring = site.geometry.coordinates[0];
    if (ring.length === 0) {
      return [0, 0];
    }

    const uniqueRing = ring.length > 1 ? ring.slice(0, -1) : ring;
    const longitude =
      uniqueRing.reduce((sum, [value]) => sum + value, 0) / uniqueRing.length;
    const latitude =
      uniqueRing.reduce((sum, [, value]) => sum + value, 0) / uniqueRing.length;
    return [longitude, latitude];
  }

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

  const sitePointGeoJson = useMemo<SitePointFeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: sites.map((site) => ({
        type: "Feature",
        properties: {
          siteId: site.id,
          siteName: site.name,
          areaHectares: site.area_hectares,
        },
        geometry: {
          type: "Point",
          coordinates: getSitePoint(site),
        },
      })),
    }),
    [sites],
  );

  const draftPointGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: draftPoints.map((point, index) => ({
        type: "Feature" as const,
        properties: { index },
        geometry: { type: "Point" as const, coordinates: point },
      })),
    }),
    [draftPoints],
  );

  const draftLineGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features:
        draftPoints.length > 1
          ? [
              {
                type: "Feature" as const,
                properties: {},
                geometry: {
                  type: "LineString" as const,
                  coordinates: draftPoints,
                },
              },
            ]
          : [],
    }),
    [draftPoints],
  );

  const siteCountLabel = `${sites.length} site${sites.length === 1 ? "" : "s"}`;

  const visibleMetrics = useMemo(() => {
    if (!siteAnalytics) {
      return [];
    }
    if (analyticsRange === "All") {
      return siteAnalytics.metrics;
    }
    return siteAnalytics.metrics.slice(-Number.parseInt(analyticsRange, 10));
  }, [analyticsRange, siteAnalytics]);

  const carbonForecast = siteAnalytics
    ? linearForecast(siteAnalytics.metrics, 3)
    : [];
  const visibleLabels = visibleMetrics.map((metric) =>
    formatMonthLabel(metric.period),
  );
  const forecastLabels = carbonForecast.map((point) =>
    formatMonthLabel(point.period),
  );
  const chartLabels = [...visibleLabels, ...forecastLabels];
  const carbonValues = visibleMetrics.map(
    (metric) => metric.carbon_tonnes_co2e,
  );
  const biodiversityValues = visibleMetrics.map(
    (metric) => metric.biodiversity_score,
  );

  const carbonChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Carbon (tCO2e)",
        data: [
          ...carbonValues,
          ...Array.from({ length: carbonForecast.length }, () => null),
        ],
        borderColor: "#00e5a0",
        backgroundColor: "#00e5a026",
        fill: true,
        tension: 0.3,
      },
      {
        label: "Forecast",
        data: [
          ...Array.from(
            { length: Math.max(0, visibleMetrics.length - 1) },
            () => null,
          ),
          carbonValues[carbonValues.length - 1] ?? null,
          ...carbonForecast.map((point) => point.value),
        ],
        borderColor: "#f59e0b",
        backgroundColor: "transparent",
        borderDash: [6, 5],
        pointRadius: 2,
        fill: false,
        tension: 0.3,
      },
    ],
  };

  const biodiversityChartData = {
    labels: visibleLabels,
    datasets: [
      {
        label: "Biodiversity (/100)",
        data: biodiversityValues,
        borderColor: "#f59e0b",
        backgroundColor: "#f59e0b26",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const deltaBarData = {
    labels: visibleLabels,
    datasets: [
      {
        label: "Carbon change (tCO2e)",
        data: visibleMetrics.map((metric, index) => {
          if (index === 0) return null;
          return (
            (metric.carbon_tonnes_co2e ?? 0) -
            (visibleMetrics[index - 1].carbon_tonnes_co2e ?? 0)
          );
        }),
        backgroundColor: visibleMetrics.map((metric, index) => {
          if (index === 0) return "transparent";
          const delta =
            (metric.carbon_tonnes_co2e ?? 0) -
            (visibleMetrics[index - 1].carbon_tonnes_co2e ?? 0);
          return delta <= 0 ? "#00e5a0" : "#ef4444";
        }),
        borderRadius: 5,
        barPercentage: 0.85,
        categoryPercentage: 0.82,
      },
    ],
  };

  const latestMetric =
    siteAnalytics?.metrics[siteAnalytics.metrics.length - 1] ?? null;
  const previousMetric =
    siteAnalytics?.metrics[siteAnalytics.metrics.length - 2] ?? null;
  const latestPeriod = latestMetric?.period ?? null;
  const carbonDelta = deltaLabel(
    latestMetric?.carbon_tonnes_co2e ?? null,
    previousMetric?.carbon_tonnes_co2e ?? null,
    "tCO2e",
  );
  const biodiversityDelta = deltaLabel(
    latestMetric?.biodiversity_score ?? null,
    previousMetric?.biodiversity_score ?? null,
    "pts",
  );
  const carbonPerHectare =
    siteAnalytics &&
    latestMetric?.carbon_tonnes_co2e !== null &&
    latestMetric?.carbon_tonnes_co2e !== undefined
      ? latestMetric.carbon_tonnes_co2e / siteAnalytics.area_hectares
      : null;
  const previousCarbonPerHectare =
    siteAnalytics &&
    previousMetric?.carbon_tonnes_co2e !== null &&
    previousMetric?.carbon_tonnes_co2e !== undefined
      ? previousMetric.carbon_tonnes_co2e / siteAnalytics.area_hectares
      : null;
  const carbonIntensityDelta = deltaLabel(
    carbonPerHectare,
    previousCarbonPerHectare,
    "tCO2e/ha",
  );
  const carbonOnTrack =
    latestMetric?.carbon_tonnes_co2e !== null &&
    latestMetric?.carbon_tonnes_co2e !== undefined &&
    previousMetric?.carbon_tonnes_co2e !== null &&
    previousMetric?.carbon_tonnes_co2e !== undefined &&
    latestMetric.carbon_tonnes_co2e < previousMetric.carbon_tonnes_co2e;
  const biodiversityOnTrack =
    latestMetric?.biodiversity_score !== null &&
    latestMetric?.biodiversity_score !== undefined &&
    latestMetric.biodiversity_score >= 72;
  const biodiversityStatusClass =
    latestMetric?.biodiversity_score === null ||
    latestMetric?.biodiversity_score === undefined
      ? "status-danger"
      : latestMetric.biodiversity_score >= 72
        ? "status-good"
        : latestMetric.biodiversity_score >= 65
          ? "status-warning"
          : "status-danger";
  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const siteThumbnailUrl =
    selectedSite && MAPBOX_TOKEN && !thumbnailFailed
      ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/geojson(${encodeURIComponent(JSON.stringify({ type: "Feature", geometry: selectedSite.geometry }))})/auto/320x180?padding=24&access_token=${MAPBOX_TOKEN}`
      : null;

  function exportAnalyticsCsv() {
    if (!siteAnalytics) return;
    const rows = [
      ["period", "carbon_tonnes_co2e", "biodiversity_score", "carbon_delta"],
      ...visibleMetrics.map((metric, index) => {
        const previous = visibleMetrics[index - 1];
        const delta =
          index === 0 || !previous
            ? ""
            : (metric.carbon_tonnes_co2e ?? 0) -
              (previous.carbon_tonnes_co2e ?? 0);
        return [
          metric.period,
          metric.carbon_tonnes_co2e ?? "",
          metric.biodiversity_score ?? "",
          delta,
        ];
      }),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${siteAnalytics.site_name.replace(/\s+/g, "-").toLowerCase()}-analytics.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function focusSite(site: Site) {
    setSelectedSiteId(site.id);
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

  function handleMapClick(event: {
    lngLat: { lng: number; lat: number };
    point: { x: number; y: number };
    features?: Array<{
      layer?: { id?: string };
      properties?: Record<string, unknown> | null;
    }>;
  }) {
    if (handlePointByPointClick(event)) {
      return;
    }

    const clickedPoint = event.features?.find(
      (feature) =>
        feature.layer?.id === "site-points" ||
        feature.layer?.id === "site-fill" ||
        feature.layer?.id === "site-outline",
    );
    const siteId = Number(clickedPoint?.properties?.["siteId"]);
    if (!Number.isFinite(siteId)) {
      setSelectedSiteId(null);
      return;
    }

    const site = sites.find((candidate) => candidate.id === siteId);
    if (site) {
      if (selectedSiteId === site.id) {
        setSelectedSiteId(null);
      } else {
        focusSite(site);
      }
    }
  }

  function handleMapMouseMove(event: {
    lngLat: { lng: number; lat: number };
    point: { x: number; y: number };
    features?: Array<{
      layer?: { id?: string };
      properties?: Record<string, unknown> | null;
    }>;
  }) {
    if (
      siteEntryMode === "draw" &&
      drawTool === "point" &&
      draftPoints.length >= 2
    ) {
      const provisionalRing = [
        ...draftPoints,
        [event.lngLat.lng, event.lngLat.lat],
        draftPoints[0],
      ] as number[][];
      const area = calculateAreaFromRing(provisionalRing);
      if (area !== null) {
        setDrawStats({ area, x: event.point.x, y: event.point.y });
      }
    } else {
      const mode = drawRef.current?.getMode();
      if (mode === "draw_polygon" || mode === "draw_freehand") {
        updateDrawStats(event.point);
      }
    }

    const hovered = event.features?.find(
      (feature) =>
        feature.layer?.id === "site-points" ||
        feature.layer?.id === "site-fill" ||
        feature.layer?.id === "site-outline",
    );

    const hoveredSiteId = Number(hovered?.properties?.["siteId"]);
    if (Number.isFinite(hoveredSiteId)) {
      const site = sites.find((candidate) => candidate.id === hoveredSiteId);
      if (site) {
        setHoverSiteInfo({
          siteName: site.name,
          areaHectares: site.area_hectares,
          x: event.point.x,
          y: event.point.y,
        });
      }
    } else {
      setHoverSiteInfo(null);
    }

    const onSitePointer =
      event.features?.some(
        (feature) =>
          feature.layer?.id === "site-points" ||
          feature.layer?.id === "site-fill" ||
          feature.layer?.id === "site-outline",
      ) ?? false;
    const canvas = mapRef.current?.getMap().getCanvas();
    if (canvas) {
      if (siteEntryMode === "draw" && drawTool === "point") {
        canvas.style.cursor = "crosshair";
      } else {
        canvas.style.cursor = onSitePointer ? "pointer" : "";
      }
    }
  }

  function handleMapLeave() {
    setHoverSiteInfo(null);
    if (siteEntryMode !== "draw" || drawTool !== "point") {
      setDrawStats(null);
    }
    const canvas = mapRef.current?.getMap().getCanvas();
    if (canvas) {
      canvas.style.cursor = "";
    }
  }

  return (
    <main
      className={`dashboard-layout ${darkMode ? "theme-dark" : ""}`}
      onClick={handleDashboardClick}
    >
      <aside className="theme-switcher" aria-label="Colour theme">
        <button
          type="button"
          className={
            !darkMode ? "theme-button theme-button-active" : "theme-button"
          }
          onClick={() => setDarkMode(false)}
          aria-label="Use light theme"
          title="Light theme"
        >
          <ThemeIcon kind="sun" />
        </button>
        <button
          type="button"
          className={
            darkMode ? "theme-button theme-button-active" : "theme-button"
          }
          onClick={() => setDarkMode(true)}
          aria-label="Use dark theme"
          title="Dark theme"
        >
          <ThemeIcon kind="moon" />
        </button>
      </aside>
      <header>
        <div>
          <h1>Darukaa.Earth</h1>
          <p>{projectCountLabel}</p>
        </div>
        <div className="header-actions">
          <button className="link" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="card project-create-card">
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

      <section className="card projects-card">
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
                    onClick={() =>
                      setSelectedProjectId((current) =>
                        current === project.id ? null : project.id,
                      )
                    }
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

      <section className="card sites-card">
        <h2>Sites {selectedProject ? `for ${selectedProject.name}` : ""}</h2>
        {selectedProject ? (
          <p>{siteCountLabel}</p>
        ) : (
          <p>Select a project to load sites.</p>
        )}
        {projectAnalytics ? (
          <div className="project-summary-grid">
            <div>
              <strong>{projectAnalytics.total_area_hectares.toFixed(2)}</strong>
              <span>Total hectares</span>
            </div>
            <div>
              <strong>
                {projectAnalytics.total_latest_carbon_tonnes_co2e?.toFixed(2) ??
                  "—"}
              </strong>
              <span>Latest tonnes CO2e</span>
            </div>
            <div>
              <strong>
                {projectAnalytics.average_latest_biodiversity_score?.toFixed(
                  1,
                ) ?? "—"}
              </strong>
              <span>Average biodiversity</span>
            </div>
            <div>
              <strong>
                {projectAnalytics.sites_with_metrics}/
                {projectAnalytics.site_count}
              </strong>
              <span>Sites with metrics</span>
            </div>
          </div>
        ) : null}
        {selectedProject && sites.length > 0 ? (
          <div className="seed-action">
            <button
              type="button"
              className="mode-button"
              onClick={() => void seedProjectMetrics()}
              disabled={seedingMetrics}
            >
              {seedingMetrics ? "Seeding metrics..." : "Seed demo metrics"}
            </button>
            {seedMessage ? <small>{seedMessage}</small> : null}
          </div>
        ) : null}

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
              <li
                key={site.id}
                className={site.id === selectedSiteId ? "selected-item" : ""}
              >
                <button
                  className="site-item"
                  type="button"
                  onClick={() =>
                    selectedSiteId === site.id
                      ? setSelectedSiteId(null)
                      : focusSite(site)
                  }
                >
                  <strong>{site.name}</strong>
                  <span>
                    Area: {site.area_hectares.toFixed(2)} ha · Show on map
                  </span>
                  {projectAnalytics ? (
                    <span className="site-trend">
                      <Sparkline
                        values={
                          projectAnalytics.sites.find(
                            (summary) => summary.site_id === site.id,
                          )?.carbon_history ?? []
                        }
                      />
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card map-card">
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
              mapStyle={
                darkMode
                  ? "mapbox://styles/mapbox/dark-v11"
                  : "mapbox://styles/mapbox/light-v11"
              }
              onLoad={handleMapLoad}
              interactiveLayerIds={["site-points", "site-fill", "site-outline"]}
              onClick={handleMapClick}
              onMouseMove={handleMapMouseMove}
              onMouseLeave={handleMapLeave}
            >
              <Source id="sites" type="geojson" data={siteGeoJson}>
                <Layer {...siteFillLayer} />
                <Layer {...siteOutlineLayer} />
              </Source>
              <Source
                id="site-points-source"
                type="geojson"
                data={sitePointGeoJson}
              >
                <Layer {...sitePointLayer} />
              </Source>
              {siteEntryMode === "draw" && drawTool === "point" ? (
                <>
                  <Source
                    id="draft-line-source"
                    type="geojson"
                    data={draftLineGeoJson}
                  >
                    <Layer {...draftLineLayer} />
                  </Source>
                  <Source
                    id="draft-points-source"
                    type="geojson"
                    data={draftPointGeoJson}
                  >
                    <Layer {...draftPointLayer} />
                  </Source>
                </>
              ) : null}
            </Map>
            <div className="draw-toolbar">
              <button
                type="button"
                className={drawTool === "point" ? "mode-active" : "mode-button"}
                onClick={() => startDrawMode("point")}
              >
                Point by point
              </button>
              <button
                type="button"
                className={
                  drawTool === "freehand" ? "mode-active" : "mode-button"
                }
                onClick={() => startDrawMode("draw_freehand")}
              >
                Freehand
              </button>
            </div>
            {drawStats ? (
              <div
                className="draw-stats"
                style={{ left: drawStats.x + 12, top: drawStats.y + 12 }}
              >
                Live area: {drawStats.area.toFixed(2)} ha
              </div>
            ) : null}
            {hoverSiteInfo ? (
              <div
                className="hover-site-info"
                style={{
                  left: hoverSiteInfo.x + 12,
                  top: hoverSiteInfo.y + 12,
                }}
              >
                {hoverSiteInfo.siteName} ·{" "}
                {hoverSiteInfo.areaHectares.toFixed(2)} ha
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="card create-site-card">
        <h2>Create site</h2>
        {!MAPBOX_TOKEN || drawUnavailable ? (
          <p>
            {MAPBOX_TOKEN
              ? "Map drawing is unavailable. Enter a Polygon GeoJSON manually."
              : "Set VITE_MAPBOX_TOKEN to draw on the map, or enter a Polygon GeoJSON manually."}
          </p>
        ) : (
          <p>
            Pick a draw mode, click points to form boundary, and click first
            point to close polygon. Live area updates while drawing.
          </p>
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

      <section className="card analytics-card">
        <div className="analytics-heading">
          <div>
            <h2>Site analytics</h2>
            <p>
              {siteAnalytics
                ? `${siteAnalytics.site_name} · ${siteAnalytics.area_hectares.toFixed(2)} ha`
                : "Select a site to view performance"}
            </p>
          </div>
          <div className="analytics-header-actions">
            {siteAnalytics ? (
              <button
                className="mode-button"
                type="button"
                onClick={exportAnalyticsCsv}
              >
                Export CSV
              </button>
            ) : null}
            {siteAnalytics ? (
              <button
                className="mode-button"
                type="button"
                onClick={() => setSelectedSiteId(null)}
              >
                Close
              </button>
            ) : null}
          </div>
          {selectedSite ? (
            siteThumbnailUrl ? (
              <img
                className="site-thumbnail"
                src={siteThumbnailUrl}
                alt="Selected site boundary map"
                onError={() => setThumbnailFailed(true)}
              />
            ) : (
              <div className="site-thumbnail site-thumbnail-fallback">
                <span>Site boundary</span>
                <svg viewBox="0 0 100 60" aria-hidden="true">
                  <polygon
                    points={getThumbnailPolygonPoints(selectedSite.geometry)}
                  />
                </svg>
              </div>
            )
          ) : null}
        </div>

        {analyticsLoading ? <p>Loading analytics...</p> : null}
        {analyticsError ? <p className="error">{analyticsError}</p> : null}
        {!analyticsLoading && !analyticsError && !selectedSiteId ? (
          <p className="analytics-empty">Select a site from the list or map.</p>
        ) : null}
        {!analyticsLoading &&
        !analyticsError &&
        selectedSiteId &&
        siteAnalytics &&
        siteAnalytics.metrics.length === 0 ? (
          <p className="analytics-empty">
            No metrics available for this site yet. Seed demo metrics to view
            trends.
          </p>
        ) : null}
        {!analyticsLoading &&
        !analyticsError &&
        siteAnalytics &&
        siteAnalytics.metrics.length > 0 ? (
          <>
            <p className="analytics-period">
              Latest period: {latestPeriod ?? "No period"}. Demo indicators
              only; not scientific measurements.
            </p>
            <div className="kpi-grid">
              <div
                className="kpi-card"
                title="Estimated carbon indicator for latest period."
              >
                <small>Latest carbon ⓘ</small>
                <strong>
                  {siteAnalytics.latest_carbon_tonnes_co2e?.toFixed(2) ?? "—"}
                </strong>
                <span>tonnes CO2e</span>
                <em className="trend-badge">{carbonDelta}</em>
              </div>
              <div
                className="kpi-card"
                title="Demo biodiversity health score from 0 to 100."
              >
                <small>Latest biodiversity ⓘ</small>
                <strong>
                  {siteAnalytics.latest_biodiversity_score?.toFixed(1) ?? "—"}
                </strong>
                <span>score / 100</span>
                <em className="trend-badge">{biodiversityDelta}</em>
              </div>
              <div
                className="kpi-card"
                title="Latest carbon divided by site area."
              >
                <small>Carbon intensity ⓘ</small>
                <strong>{carbonPerHectare?.toFixed(2) ?? "—"}</strong>
                <span>tCO2e / hectare</span>
                <em className="trend-badge">{carbonIntensityDelta}</em>
              </div>
            </div>
            <div className="status-row">
              <span className="status-message">
                <span
                  className={`status-dot ${carbonOnTrack ? "status-good" : "status-danger"}`}
                  aria-hidden="true"
                />
                Carbon {carbonOnTrack ? "reducing on track" : "not reducing"}
              </span>
              <span className="status-message">
                <span
                  className={`status-dot ${biodiversityStatusClass}`}
                  aria-hidden="true"
                />
                Biodiversity{" "}
                {biodiversityOnTrack
                  ? "within target range"
                  : "below target range"}
              </span>
            </div>
            <div
              className="chart-toolbar"
              role="group"
              aria-label="Chart metric"
            >
              <span>Trend view</span>
              {(["all", "carbon", "biodiversity"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    analyticsChartMode === mode ? "mode-active" : "mode-button"
                  }
                  onClick={() => setAnalyticsChartMode(mode)}
                >
                  {mode === "all"
                    ? "All metrics"
                    : mode === "carbon"
                      ? "Carbon"
                      : "Biodiversity"}
                </button>
              ))}
            </div>
            <div className="range-toolbar" role="group" aria-label="Date range">
              <span>Date range</span>
              {(["3M", "6M", "12M", "All"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  className={
                    analyticsRange === range ? "mode-active" : "mode-button"
                  }
                  onClick={() => setAnalyticsRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
            {analyticsChartMode === "all" || analyticsChartMode === "carbon" ? (
              <div className="analytics-chart chart-block">
                <h3>Carbon trend · tCO2e</h3>
                <Line
                  data={carbonChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: "index", intersect: false },
                    scales: { y: { suggestedMin: 900 } },
                  }}
                />
              </div>
            ) : null}
            {analyticsChartMode === "all" ||
            analyticsChartMode === "biodiversity" ? (
              <div className="analytics-chart chart-block">
                <h3>Biodiversity trend · /100 · historical only</h3>
                <Line
                  data={biodiversityChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: "index", intersect: false },
                    scales: { y: { suggestedMin: 72, max: 100 } },
                  }}
                />
              </div>
            ) : null}
            <div className="analytics-chart delta-chart chart-block">
              <h3>Month-over-month carbon change</h3>
              <Bar
                data={deltaBarData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          </>
        ) : null}
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
