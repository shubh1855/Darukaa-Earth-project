import { useCallback, useEffect, useState } from "react";
import type { Project } from "../types/index";
import { request } from "../utils/api";

export function useProjects(token: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<Project[]>("/projects", {}, token);
      setProjects(data);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  return { projects, setProjects, loading, error, reload: loadProjects };
}
