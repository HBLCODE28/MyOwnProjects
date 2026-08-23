import { useEffect, useState } from "react";

import { getHealth, type HealthResponse } from "../../api/client";

export function HealthBadge() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getHealth(controller.signal)
      .then(setHealth)
      .catch((value: unknown) => {
        if (value instanceof Error && value.name !== "AbortError") {
          setError(value.message);
        }
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return <span className="health-badge error">Backend unavailable</span>;
  }

  if (!health) {
    return <span className="health-badge pending">Checking local service...</span>;
  }

  return (
    <span className={health.database.status === "ok" ? "health-badge ok" : "health-badge error"}>
      Local service {health.database.status === "ok" ? "ready" : "degraded"}
    </span>
  );
}
