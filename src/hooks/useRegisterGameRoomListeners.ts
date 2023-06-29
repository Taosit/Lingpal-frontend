import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSocketListener } from "./useRegisterSocketListener";
import { useGameStore } from "@/stores/GameStore";
import { shallow } from "zustand/shallow";
import { emitSocketEvent } from "@/utils/helpers";
import { useUpdateStats } from "@/components/GameRoom/useUpdateStats";
import { useSettingStore } from "@/stores/SettingStore";
import { useRouter } from "next/router";
import { useAuthStore } from "@/stores/AuthStore";
import { useSocketContext } from "@/contexts/SocketContext";

export const useRegisterGameRoomListeners = ({
    startTimer, endTurn,
}: {
    startTimer: () => void;
    endTurn: () => void;
}) => {
    const { socket } = useSocketContext();

    const {
        storePlayers,
        playerChangeEE,
        setPlayers,
        round,
        setRound,
        describerOrder,
        setDescriberOrder,
    } = useGameStore(store => ({
        storePlayers: store.players,
        playerChangeEE: store.playerChangeEE,
        setPlayers: store.setPlayers,
        round: store.round,
        setRound: store.setRound,
        describerOrder: store.describerOrder,
        setDescriberOrder: store.setDescriberOrder,
    }), shallow);

    const user = useAuthStore(store => store.user);

    const { mode, level } = useSettingStore(store => ({
        mode: store.settings.mode,
        level: store.settings.level,
    }), shallow);

    const handlePlayerChange = useCallback((players: Record<string, Player>) => {
        const isFirstDescriber = user && players[user.id]?.order === describerOrder;
        if (!isFirstDescriber) {
            return;
        }

        startTimer();
        emitSocketEvent(socket, "start-round");
    }, [describerOrder, socket, startTimer, user]);

    const initialPlayerChangeHandled = useRef(false);
    useEffect(() => {
        if (initialPlayerChangeHandled.current) {
            return;
        }
        initialPlayerChangeHandled.current = true;
        handlePlayerChange(storePlayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        playerChangeEE.on("player-change", handlePlayerChange);

        return () => {
            playerChangeEE.off("player-change", handlePlayerChange);
        }
    }, [describerOrder, handlePlayerChange, playerChangeEE, socket, startTimer, user]);

    const updateStats = useUpdateStats();

    const router = useRouter();
    const updateRoundAndDescriber = useCallback((
        nextDesc: number, nextRound: number
    ) => {
        if (nextRound === round) {
            setDescriberOrder(nextDesc);
            startTimer();
        } else {
            setRound(nextRound);
            setDescriberOrder(nextDesc);
            router.push("/notes-room");
        }
    }, [round, router, setDescriberOrder, setRound, startTimer]);

    const correctAnswerListener = useCallback(
        (players: SocketEvent["correct-answer"]) => {
            setPlayers(players);
            endTurn();
        },
        [endTurn, setPlayers]
    );
    useRegisterSocketListener("correct-answer", correctAnswerListener);

    const turnUpdatedListener = useCallback(
        ({ nextRound, nextDesc }: SocketEvent["turn-updated"]) => {
            updateRoundAndDescriber(nextDesc, nextRound);
        },
        [updateRoundAndDescriber]
    );
    useRegisterSocketListener("turn-updated", turnUpdatedListener);

    const playerLeftListener = useCallback(
        ({ nextDesc, nextRound, remainingPlayers }: SocketEvent["player-left"]) => {
            if (nextDesc !== undefined && nextRound !== undefined) {
                updateRoundAndDescriber(nextDesc, nextRound);
            }
            setPlayers(remainingPlayers);
        },
        [setPlayers, updateRoundAndDescriber]
    );
    useRegisterSocketListener("player-left", playerLeftListener);

    const gameOverListener = useCallback(
        (players: SocketEvent["game-over"]) => {
            const win = players[user!.id].rank <= Object.keys(players).length / 2;
            const advanced = level === "hard";
            const data = { win, advanced };

            if (mode === "standard") {
                updateStats(data);
            }
            setTimeout(() => {
                router.push("/dashboard");
            }, 3000);
        },
        [level, mode, router, updateStats, user]
    );
    useRegisterSocketListener("game-over", gameOverListener);
};