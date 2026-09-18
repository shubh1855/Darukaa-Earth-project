import { useCallback, useEffect, useState } from "react";
import type { Site } from "../types/index";
import { request } from "../utils/api";

export function useSites(token: string, projectId: number | null) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const reload = useCallback(() => {
    setTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setSites([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void request<Site[]>(`/projects/${projectId}/sites`, {}, token)
      .then((data) => {
        if (!cancelled) {
          setSites(data);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError((requestError as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, token, trigger]);

  return { sites, setSites, loading, error, reload };
}
