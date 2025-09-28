import { useEffect, useMemo, useState } from "react";
import type { FhevmInstance } from "./internal/types";
import { createMockInstance } from "./internal/mock";

export function useFhevm(params: {
  provider: string;
  chainId: number;
  initialMockChains?: Readonly<Record<number, string>>;
  enabled?: boolean;
}) {
  const [instance, setInstance] = useState<FhevmInstance | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!params.enabled) return;
    let aborted = false;
    setStatus("loading");
    setError(undefined);

    (async () => {
      try {
        const inst = await createMockInstance(params.provider);
        if (aborted) return;
        setInstance(inst);
        setStatus("ready");
      } catch (e) {
        if (aborted) return;
        setError(e as Error);
        setStatus("error");
      }
    })();

    return () => {
      aborted = true;
    };
  }, [params.provider, params.chainId, params.enabled]);

  return { instance, status, error } as const;
}




