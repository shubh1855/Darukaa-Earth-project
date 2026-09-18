import { useCallback, useEffect, useState } from "react";
import type { Site } from "../types/index";
import { request } from "../utils/api";

export function useSites(token: string, projectId: number | null) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSites = useCallback(async () => {
    if (!projectId) {
      setSites([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await request<Site[]>(
        `/projects/${projectId}/sites`,
        {},
        token,
      );
      setSites(data);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  return { sites, setSites, loading, error, reload: loadSites };
}
