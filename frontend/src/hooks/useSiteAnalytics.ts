import { useCallback, useEffect, useState } from "react";
import type { SiteAnalytics } from "../types/index";
import { request } from "../utils/api";
import { ensureMockHistory } from "../mockData";

export function useSiteAnalytics(token: string, siteId: number | null) {
  const [analytics, setAnalytics] = useState<SiteAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const reload = useCallback(() => {
    setTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!siteId) {
      setAnalytics(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void request<SiteAnalytics>(`/sites/${siteId}/analytics`, {}, token)
      .then((data) => {
        if (!cancelled) {
          setAnalytics(ensureMockHistory(data));
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setAnalytics(null);
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
  }, [siteId, token, trigger]);

  return { analytics, setAnalytics, loading, error, reload };
}
