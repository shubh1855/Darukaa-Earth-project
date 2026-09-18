import {
  FormEvent,
  MouseEvent,
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

import { formatMonthLabel, linearForecast } from "./mockData.js";

// Component imports
import { Sparkline } from "./components/Sparkline";
import { ThemeToggle } from "./components/ThemeToggle";

// Hook imports
import { useProjects } from "./hooks/useProjects";
import { useSites } from "./hooks/useSites";
import { useProjectAnalytics } from "./hooks/useProjectAnalytics";
import { useSiteAnalytics } from "./hooks/useSiteAnalytics";

// Type imports
import type {
  TokenResponse,
  Project,
  PolygonGeometry,
  Site,
  SiteMetric,
  ProjectSiteAnalytics,
  SitePointFeatureCollection,
  SiteFeatureCollection,
} from "./types/index";

// Utility imports
import { request } from "./utils/api";
import {
  deltaLabel,
  deltaTone,
  getThumbnailPolygonPoints,
  getSitePoint,
  calculateAreaFromRing,
} from "./utils/helpers";
import {
  MAPBOX_TOKEN,
  ENABLE_DEMO_SEED,
  SAMPLE_POLYGON,
  siteFillLayer,
  sitePointLayer,
  draftLineLayer,
  draftPointLayer,
  siteOutlineLayer,
} from "./utils/constants";
import {
  carbonChartOptions,
  biodiversityChartOptions,
  deltaBarOptions,
  createCarbonDataset,
  createForecastDataset,
  createBiodiversityDataset,
} from "./utils/chartConfig";

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

const drawModes = {
  ...MapboxDraw.modes,
  draw_freehand: FreehandMode as unknown as MapboxDraw.DrawCustomMode,
} as unknown as { [modeKey: string]: MapboxDraw.DrawCustomMode };

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
  // Project management
  const {
    projects,
    setProjects,
    loading: loadingProjects,
  } = useProjects(token);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createProjectError, setCreateProjectError] = useState<string | null>(
    null,
  );

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );

  // Site management
  const {
    sites,
    loading: loadingSites,
    error: sitesError,
    reload: reloadSites,
  } = useSites(token, selectedProjectId);

  // Analytics
  const { analytics: projectAnalytics, reload: reloadProjectAnalytics } =
    useProjectAnalytics(token, selectedProjectId);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const {
    analytics: siteAnalytics,
    loading: analyticsLoading,
    error: analyticsError,
    reload: reloadSiteAnalytics,
  } = useSiteAnalytics(token, selectedSiteId);

  const [seedingMetrics, setSeedingMetrics] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [analyticsChartMode, setAnalyticsChartMode] = useState<
    "all" | "carbon" | "biodiversity"
  >("all");
  const [analyticsRange, setAnalyticsRange] = useState<
    "3M" | "6M" | "12M" | "All"
  >("6M");
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [analyticsScrolling, setAnalyticsScrolling] = useState(false);

  const mapRef = useRef<MapRef | null>(null);
  const siteNameInputRef = useRef<HTMLInputElement | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const analyticsScrollTimerRef = useRef<number | null>(null);
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
  const [darkMode, setDarkMode] = useState(true);
  const [creatingSite, setCreatingSite] = useState(false);
  const [createSiteError, setCreateSiteError] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  useEffect(() => {
    setThumbnailFailed(false);
  }, [selectedSiteId]);

  // Close analytics drawer with Escape key
  useEffect(() => {
    if (!selectedSiteId) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedSiteId(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedSiteId]);

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
    setDrawStats(null);
    setHoverSiteInfo(null);
    setSiteGeometryInput("");
    setDraftPoints([]);
    setCreateSiteError(null);
    drawRef.current?.deleteAll();
    changeDrawMode("simple_select");
  }, [selectedProjectId]);

  function handleAnalyticsScroll() {
    setAnalyticsScrolling(true);
    if (analyticsScrollTimerRef.current !== null) {
      window.clearTimeout(analyticsScrollTimerRef.current);
    }
    analyticsScrollTimerRef.current = window.setTimeout(() => {
      setAnalyticsScrolling(false);
      analyticsScrollTimerRef.current = null;
    }, 700);
  }

  async function seedProjectMetrics() {
    if (!selectedProjectId) return;

    setSeedingMetrics(true);
    setSeedMessage(null);
    try {
      const result = await request<{ created_count: number }>(
        `/projects/${selectedProjectId}/analytics/seed`,
        { method: "POST" },
        token,
      );
      setSeedMessage(
        result.created_count === 0
          ? "Demo metrics already exist."
          : `Created ${result.created_count} demo metric rows.`,
      );
      reloadProjectAnalytics();
      if (selectedSiteId) {
        reloadSiteAnalytics();
      }
    } catch {
      setSeedMessage("Failed to seed metrics.");
    } finally {
      setSeedingMetrics(false);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateProjectError(null);

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
      setCreateProjectError((requestError as Error).message);
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
      await reloadSites();
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

  const visibleMetrics = useMemo<SiteMetric[]>(() => {
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
  const visibleLabels = visibleMetrics.map((metric: SiteMetric) =>
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
      createCarbonDataset(carbonValues, carbonForecast.length),
      createForecastDataset(carbonValues, carbonForecast),
    ],
  };

  const biodiversityChartData = {
    labels: visibleLabels,
    datasets: [createBiodiversityDataset(biodiversityValues)],
  };

  const deltaBarData = {
    labels: visibleLabels,
    datasets: [
      {
        label: "Carbon change (tCO₂e)",
        data: visibleMetrics.map((metric: SiteMetric, index: number) => {
          if (index === 0) return null;
          return (
            (metric.carbon_tonnes_co2e ?? 0) -
            (visibleMetrics[index - 1].carbon_tonnes_co2e ?? 0)
          );
        }),
        backgroundColor: visibleMetrics.map(
          (metric: SiteMetric, index: number) => {
            if (index === 0) return "transparent";
            const delta =
              (metric.carbon_tonnes_co2e ?? 0) -
              (visibleMetrics[index - 1].carbon_tonnes_co2e ?? 0);
            return delta <= 0 ? "#10b981" : "#ef4444";
          },
        ),
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
      ...visibleMetrics.map((metric: SiteMetric, index: number) => {
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

  function fitAllSites() {
    if (!mapRef.current || sites.length === 0) return;

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const site of sites) {
      const ring = site.geometry.coordinates[0];
      if (!ring) continue;
      for (const [lon, lat] of ring as number[][]) {
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
        { padding: 72, maxZoom: 12, duration: 600 },
      );
    }
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
      const ring = site.geometry.coordinates[0];
      if (!ring) continue;
      for (const [lon, lat] of ring as number[][]) {
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
        { padding: 48, maxZoom: 12, duration: 500 },
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
      <header>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h1>Darukaa.Earth</h1>
          {selectedProject ? (
            <span
              style={{
                color: "var(--muted)",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              / {selectedProject.name}
            </span>
          ) : null}
        </div>
        <div className="header-actions">
          <ThemeToggle darkMode={darkMode} onToggle={setDarkMode} />
          <button className="link" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {projectAnalytics ? (
        <section className="project-summary-strip">
          <div className="summary-stat">
            <strong>{projectAnalytics.total_area_hectares.toFixed(1)}</strong>
            <span>Total area (ha)</span>
          </div>
          <div className="summary-stat">
            <strong>
              {projectAnalytics.total_latest_carbon_tonnes_co2e !== null
                ? projectAnalytics.total_latest_carbon_tonnes_co2e.toFixed(1)
                : "—"}
            </strong>
            <span>Latest carbon (tCO₂e)</span>
          </div>
          <div className="summary-stat">
            <strong>
              {projectAnalytics.average_latest_biodiversity_score !== null
                ? projectAnalytics.average_latest_biodiversity_score.toFixed(2)
                : "—"}
            </strong>
            <span>Avg biodiversity</span>
          </div>
          <div className="summary-stat">
            <strong>{projectAnalytics.sites_with_metrics}</strong>
            <span>Sites with data</span>
          </div>
        </section>
      ) : null}

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
        {createProjectError ? (
          <p className="error">{createProjectError}</p>
        ) : null}
      </section>

      <section className="card projects-card">
        <h2>Projects</h2>
        {loadingProjects ? (
          <div className="loading-indicator" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>Loading projects…</span>
          </div>
        ) : null}
        {!loadingProjects && projects.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No projects yet</p>
            <p className="empty-state-hint">
              Create your first project using the form above to start tracking
              carbon and biodiversity sites.
            </p>
          </div>
        ) : null}
        {!loadingProjects && projects.length > 0 ? (
          <>
            <div className="search-wrap">
              <input
                className="search-input"
                type="search"
                placeholder="Search projects…"
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                aria-label="Search projects"
              />
            </div>
            <ul className="project-list">
              {projects
                .filter((project) =>
                  project.name
                    .toLowerCase()
                    .includes(projectSearch.toLowerCase()),
                )
                .map((project) => (
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
              {projects.filter((project) =>
                project.name
                  .toLowerCase()
                  .includes(projectSearch.toLowerCase()),
              ).length === 0 ? (
                <li>
                  <p className="search-no-results">
                    No projects match &ldquo;{projectSearch}&rdquo;
                  </p>
                </li>
              ) : null}
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

        {loadingSites ? (
          <div className="loading-indicator" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>Loading sites…</span>
          </div>
        ) : null}
        {sitesError ? <p className="error">{sitesError}</p> : null}

        {!loadingSites &&
        !sitesError &&
        selectedProject &&
        sites.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No sites yet</p>
            <p className="empty-state-hint">
              Use the map or coordinate entry below to draw your first site
              boundary for this project.
            </p>
          </div>
        ) : null}

        {!loadingSites && !sitesError && sites.length > 0 ? (
          <>
            <div className="search-wrap">
              <input
                className="search-input"
                type="search"
                placeholder="Search sites…"
                value={siteSearch}
                onChange={(event) => setSiteSearch(event.target.value)}
                aria-label="Search sites"
              />
            </div>
            <ul className="site-list">
              {sites
                .filter((site) =>
                  site.name.toLowerCase().includes(siteSearch.toLowerCase()),
                )
                .map((site) => {
                  const siteAnalyticsData = projectAnalytics?.sites.find(
                    (summary: ProjectSiteAnalytics) =>
                      summary.site_id === site.id,
                  );
                  return (
                    <li
                      key={site.id}
                      className={
                        site.id === selectedSiteId ? "selected-site-card" : ""
                      }
                    >
                      <button
                        className="site-card-button"
                        type="button"
                        onClick={() =>
                          selectedSiteId === site.id
                            ? setSelectedSiteId(null)
                            : focusSite(site)
                        }
                      >
                        <div className="site-card-header">
                          <h3>{site.name}</h3>
                          <span className="site-card-area">
                            {site.area_hectares.toFixed(2)} ha
                          </span>
                        </div>

                        <div className="site-card-metrics">
                          <div className="site-card-metric">
                            <span className="metric-label">Carbon</span>
                            <span className="metric-value">
                              {siteAnalyticsData?.latest_carbon_tonnes_co2e !==
                                null &&
                              siteAnalyticsData?.latest_carbon_tonnes_co2e !==
                                undefined
                                ? `${siteAnalyticsData.latest_carbon_tonnes_co2e.toFixed(1)} t`
                                : "—"}
                            </span>
                          </div>
                          <div className="site-card-metric">
                            <span className="metric-label">Biodiversity</span>
                            <span className="metric-value">
                              {siteAnalyticsData?.latest_biodiversity_score !==
                                null &&
                              siteAnalyticsData?.latest_biodiversity_score !==
                                undefined
                                ? siteAnalyticsData.latest_biodiversity_score.toFixed(
                                    2,
                                  )
                                : "—"}
                            </span>
                          </div>
                        </div>

                        {siteAnalyticsData?.carbon_history &&
                        siteAnalyticsData.carbon_history.length > 0 ? (
                          <div className="site-trend">
                            <Sparkline
                              values={siteAnalyticsData.carbon_history}
                            />
                          </div>
                        ) : null}

                        <div className="site-card-cta">
                          <span className="site-analytics-cta">
                            View analytics →
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              {sites.filter((site) =>
                site.name.toLowerCase().includes(siteSearch.toLowerCase()),
              ).length === 0 ? (
                <li>
                  <p className="search-no-results">
                    No sites match &ldquo;{siteSearch}&rdquo;
                  </p>
                </li>
              ) : null}
            </ul>
          </>
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
              <button
                type="button"
                className="mode-button"
                onClick={() => {
                  drawRef.current?.deleteAll();
                  changeDrawMode("simple_select");
                  setDrawTool(null);
                  setDraftPoints([]);
                  setSiteGeometryInput("");
                  setDrawStats(null);
                  setCreateSiteError(null);
                }}
                disabled={!drawTool && siteGeometryInput === ""}
                title="Clear drawn polygon"
              >
                Clear
              </button>
              <button
                type="button"
                className="mode-button"
                onClick={fitAllSites}
                disabled={sites.length === 0}
                title="Fit map to all sites"
              >
                Fit All
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
                  "77.58, 12.97\n77.60, 12.97\n77.60, 12.99\n77.58, 12.99"
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

      {selectedSiteId ? (
        <button
          className="analytics-backdrop"
          type="button"
          aria-label="Close analytics"
          onClick={() => setSelectedSiteId(null)}
        />
      ) : null}
      <section
        className={`card analytics-card ${selectedSiteId ? "analytics-open" : ""} ${analyticsScrolling ? "is-scrolling" : ""}`}
        onScroll={handleAnalyticsScroll}
      >
        <div className="analytics-heading">
          <div>
            <div className="analytics-breadcrumb">
              Projects / {selectedProject?.name ?? "Project"} /{" "}
              {siteAnalytics?.site_name ?? "Site"}
            </div>
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
            {ENABLE_DEMO_SEED && selectedSite ? (
              <button
                className="mode-button"
                type="button"
                onClick={() => void seedProjectMetrics()}
                disabled={seedingMetrics}
              >
                {seedingMetrics ? "Seeding metrics..." : "Seed demo metrics"}
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
            {seedMessage ? <small>{seedMessage}</small> : null}
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

        {analyticsLoading ? (
          <div
            className="loading-indicator loading-indicator--lg"
            aria-live="polite"
          >
            <span className="spinner" aria-hidden="true" />
            <span>Loading analytics…</span>
          </div>
        ) : null}
        {analyticsError ? <p className="error">{analyticsError}</p> : null}
        {!analyticsLoading && !analyticsError && !selectedSiteId ? (
          <div className="analytics-empty">
            <p className="empty-state-title">No site selected</p>
            <p className="empty-state-hint">
              Click a site card or a polygon on the map to open its analytics
              panel.
            </p>
          </div>
        ) : null}
        {!analyticsLoading &&
        !analyticsError &&
        selectedSiteId &&
        siteAnalytics &&
        siteAnalytics.metrics.length === 0 ? (
          <div className="analytics-empty">
            <p className="empty-state-title">No metrics yet</p>
            <p className="empty-state-hint">
              This site has no performance data. Seed demo metrics to explore
              the carbon and biodiversity charts.
            </p>
            {seedMessage ? <small>{seedMessage}</small> : null}
          </div>
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
              <div className="kpi-card">
                <small className="kpi-label">
                  Latest carbon
                  <span
                    className="tooltip-trigger"
                    tabIndex={0}
                    role="img"
                    aria-label="Estimated carbon indicator for latest period."
                  >
                    i
                  </span>
                </small>
                <strong>
                  {siteAnalytics.latest_carbon_tonnes_co2e?.toFixed(2) ?? "—"}
                </strong>
                <span>tonnes CO2e</span>
                <em
                  className={`trend-badge ${deltaTone(
                    latestMetric?.carbon_tonnes_co2e ?? null,
                    previousMetric?.carbon_tonnes_co2e ?? null,
                    "decrease",
                  )}`}
                >
                  {carbonDelta}
                </em>
              </div>
              <div className="kpi-card">
                <small className="kpi-label">
                  Latest biodiversity
                  <span
                    className="tooltip-trigger"
                    tabIndex={0}
                    role="img"
                    aria-label="Demo biodiversity health score from 0 to 100."
                  >
                    i
                  </span>
                </small>
                <strong>
                  {siteAnalytics.latest_biodiversity_score?.toFixed(1) ?? "—"}
                </strong>
                <span>score / 100</span>
                <em
                  className={`trend-badge ${deltaTone(
                    latestMetric?.biodiversity_score ?? null,
                    previousMetric?.biodiversity_score ?? null,
                    "increase",
                  )}`}
                >
                  {biodiversityDelta}
                </em>
              </div>
              <div className="kpi-card">
                <small className="kpi-label">
                  Carbon intensity
                  <span
                    className="tooltip-trigger"
                    tabIndex={0}
                    role="img"
                    aria-label="Latest carbon divided by site area."
                  >
                    i
                  </span>
                </small>
                <strong>{carbonPerHectare?.toFixed(2) ?? "—"}</strong>
                <span>tCO2e / hectare</span>
                <em
                  className={`trend-badge ${deltaTone(
                    carbonPerHectare,
                    previousCarbonPerHectare,
                    "decrease",
                  )}`}
                >
                  {carbonIntensityDelta}
                </em>
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
            <div className="trend-charts">
              {analyticsChartMode === "all" ||
              analyticsChartMode === "carbon" ? (
                <div className="analytics-chart chart-block">
                  <h3>Carbon trend · tCO2e</h3>
                  <Line data={carbonChartData} options={carbonChartOptions} />
                </div>
              ) : null}
              {analyticsChartMode === "all" ||
              analyticsChartMode === "biodiversity" ? (
                <div className="analytics-chart chart-block">
                  <h3>Biodiversity trend · /100 · historical only</h3>
                  <Line
                    data={biodiversityChartData}
                    options={biodiversityChartOptions}
                  />
                </div>
              ) : null}
            </div>
            <div className="analytics-chart delta-chart chart-block">
              <h3>Month-over-month carbon change</h3>
              <Bar data={deltaBarData} options={deltaBarOptions} />
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
