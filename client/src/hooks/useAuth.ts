import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface UseAuthResult {
  isAuthenticated: boolean | undefined;
  isLoading: boolean;
}

/**
 * Standardized auth hook for all admin pages.
 * Handles auth check and redirects to /auth if not authenticated.
 * Uses wouter's useLocation for navigation.
 */
export function useAuth(): UseAuthResult {
  const [, setLocation] = useLocation();

  const { data: isAuthenticated, isLoading } = useQuery({
    queryKey: ["/api/auth-check"],
    queryFn: async () => {
      const response = await fetch("/api/auth-check", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Unauthorized");
      }
      return true;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/auth");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  return { isAuthenticated, isLoading };
}