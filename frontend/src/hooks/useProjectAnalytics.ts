import { useCallback, useEffect, useState } from "react";
import type { ProjectAnalytics } from "../types/index";
import { request } from "../utils/api";

export function useProjectAnalytics(token: string, projectId: number | null) {
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const reload = useCallback(() => {
    setTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setAnalytics(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void request<ProjectAnalytics>(
      `/projects/${projectId}/analytics`,
      {},
      token,
    )
      .then((data) => {
        if (!cancelled) {
          setAnalytics(data);
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
  }, [projectId, token, trigger]);

  return { analytics, loading, error, reload };
}
