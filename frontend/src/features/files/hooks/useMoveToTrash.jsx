import { useMutation, useQueryClient } from "@tanstack/react-query";
import { moveToTrash } from "../services/fileAPI";

const useMoveToTrash = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: moveToTrash,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["files"] });
			queryClient.invalidateQueries({ queryKey: ["sharedWithMe"] });
		},
	});
};

export default useMoveToTrash;
