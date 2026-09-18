export type TokenResponse = { access_token: string; token_type: string };

export type Project = {
  id: number;
  name: string;
  description: string;
  created_at: string;
};

export type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

export type Site = {
  id: number;
  project_id: number;
  name: string;
  geometry: PolygonGeometry;
  area_hectares: number;
  created_at: string;
};

export type SiteMetric = {
  period: string;
  carbon_tonnes_co2e: number | null;
  biodiversity_score: number | null;
};

export type SiteAnalytics = {
  site_id: number;
  site_name: string;
  area_hectares: number;
  latest_carbon_tonnes_co2e: number | null;
  latest_biodiversity_score: number | null;
  metrics: SiteMetric[];
};

export type ProjectSiteAnalytics = {
  site_id: number;
  site_name: string;
  area_hectares: number;
  latest_carbon_tonnes_co2e: number | null;
  latest_biodiversity_score: number | null;
  carbon_history: Array<number | null>;
};

export type ProjectAnalytics = {
  project_id: number;
  site_count: number;
  total_area_hectares: number;
  total_latest_carbon_tonnes_co2e: number | null;
  average_latest_biodiversity_score: number | null;
  sites_with_metrics: number;
  sites: ProjectSiteAnalytics[];
};

export type SitePointFeatureCollection = {
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

export type SiteFeatureCollection = {
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

export type ApiError = { detail?: string };
