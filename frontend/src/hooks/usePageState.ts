/**
 * Hook to determine the appropriate page state based on query results
 * Mutualizes the logic for handling loading, error, and empty states across all pages
 */
export const usePageState = <T>(query: { data?: T[]; isLoading: boolean; error: Error | null }) => {
  const { data = [], isLoading, error } = query;

  return {
    data,
    isLoading,
    error,
    isEmpty: data.length === 0,
    shouldShowLoading: isLoading,
    shouldShowError: !!error,
    shouldShowEmpty: !isLoading && !error && data.length === 0,
  };
};

/**
 * Props for page components that need consistent loading/error/empty state handling
 */
export interface PageStateProps<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
  shouldShowLoading: boolean;
  shouldShowError: boolean;
  shouldShowEmpty: boolean;
}