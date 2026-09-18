import { useCallback, useEffect, useState } from "react";
import type { ProjectAnalytics } from "../types/index";
import { request } from "../utils/api";

export function useProjectAnalytics(token: string, projectId: number | null) {
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [trigger, setTrigger] = useState(0);

  const reload = useCallback(() => {
    setTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setAnalytics(null);
      return;
    }

    let cancelled = false;
    void request<ProjectAnalytics>(
      `/projects/${projectId}/analytics`,
      {},
      token,
    ).then((data) => {
      if (!cancelled) {
        setAnalytics(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, token, trigger]);

  return { analytics, reload };
}
