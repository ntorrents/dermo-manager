import { useQuery } from "@tanstack/react-query";
import {
	listSignedConsentsByClient,
	getSignedConsentDownloadUrl,
} from "../services/signedConsentStorage";

export const useSignedConsents = (clientId) => {
	const {
		data: signedConsents = [],
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["signedConsents", clientId],
		queryFn: () => listSignedConsentsByClient(clientId),
		enabled: !!clientId,
	});

	const getDownloadUrl = (storagePath) =>
		getSignedConsentDownloadUrl(storagePath);

	return { signedConsents, loading: isLoading, refetch, getDownloadUrl };
};
