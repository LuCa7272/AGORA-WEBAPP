// FILE: client/src/hooks/use-user.ts (NUOVO FILE)

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

// Schema di validazione per il form di modifica nickname
export const nicknameSchema = z.object({
    nickname: z.string()
        .min(3, "Il nickname deve avere almeno 3 caratteri.")
        .max(8, "Il nickname non può superare gli 8 caratteri."),
});

type NicknameInput = z.infer<typeof nicknameSchema>;

export function useUser() {
    const queryClient = useQueryClient();

    // useMutation per la funzione di aggiornamento del nickname
    const updateNicknameMutation = useMutation({
        mutationFn: async (data: NicknameInput) => {
            const response = await apiRequest("PUT", "/api/user/nickname", data);
            return response.json();
        },
        onSuccess: () => {
            // Dopo un aggiornamento riuscito, invalida la query 'currentUser'
            // per forzare un refetch e aggiornare il nickname in tutta l'app.
            queryClient.invalidateQueries({ queryKey: ["currentUser"] });
        },
    });

    return {
        updateNickname: updateNicknameMutation.mutateAsync,
        isUpdatingNickname: updateNicknameMutation.isPending,
    };
}