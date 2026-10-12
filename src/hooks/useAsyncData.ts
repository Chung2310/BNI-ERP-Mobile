import { useCallback, useEffect, useRef, useState } from "react";
import { friendlyErrorMessage } from "@/utils/userFacingError";

const LOAD_TIMEOUT_MS = 20000;

export function useAsyncData<T>(loader: () => Promise<T>, key = "default") {
  const loaderRef = useRef(loader);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError("");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Kết nối quá thời gian. Vui lòng thử lại.")),
          LOAD_TIMEOUT_MS,
        );
      });
      setData(await Promise.race([loaderRef.current(), timeoutPromise]));
    } catch (cause) {
      setError(friendlyErrorMessage(cause, "Chưa tải được dữ liệu. Hãy kiểm tra mạng rồi thử lại."));
    } finally {
      if (timeout) clearTimeout(timeout);
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
