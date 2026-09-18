export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export const ENABLE_DEMO_SEED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_SEED === "true";

export const SAMPLE_POLYGON = JSON.stringify(
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

export const siteFillLayer = {
  id: "site-fill",
  type: "fill",
  paint: {
    "fill-color": "#1d976c",
    "fill-opacity": 0.3,
  },
} as const;

export const sitePointLayer = {
  id: "site-points",
  type: "circle",
  paint: {
    "circle-color": "#126149",
    "circle-radius": 5,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
  },
} as const;

export const draftLineLayer = {
  id: "draft-line",
  type: "line",
  paint: {
    "line-color": "#0f8a62",
    "line-width": 2,
    "line-dasharray": [2, 1] as number[],
  },
} as const;

export const draftPointLayer = {
  id: "draft-points",
  type: "circle",
  paint: {
    "circle-color": "#ffffff",
    "circle-stroke-color": "#0f8a62",
    "circle-stroke-width": 2,
    "circle-radius": 5,
  },
} as const;

export const siteOutlineLayer = {
  id: "site-outline",
  type: "line",
  paint: {
    "line-color": "#126149",
    "line-width": 2,
  },
} as const;
