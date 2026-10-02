import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QUERY_STALE } from "./queryStale";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: QUERY_STALE.operational,
			gcTime: 15 * 60_000,
			retry: 1,
			refetchOnWindowFocus: false,
			refetchOnReconnect: true,
		},
	},
});

export const QueryProvider = ({ children }) => (
	<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
