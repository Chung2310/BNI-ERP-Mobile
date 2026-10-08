import { useCallback, useEffect, useRef, useState } from "react";
import { friendlyErrorMessage } from "@/utils/userFacingError";

export function useAsyncData<T>(loader: () => Promise<T>, key = "default") {
  const loaderRef = useRef(loader);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setData(await loaderRef.current());
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Chưa tải được dữ liệu. Hãy kiểm tra mạng rồi thử lại."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loaderRef.current = loader; }, [loader]);
  useEffect(() => {
    const timer = setTimeout(() => { void key; void reload(); }, 0);
    return () => clearTimeout(timer);
  }, [key, reload]);
  return { data, setData, error, isLoading, reload };
}
