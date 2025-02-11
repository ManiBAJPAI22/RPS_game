export const SEPOLIA_CHAIN_ID = "0xaa36a7";

export const MOVE_MAP = {
    1: "Rock",
    2: "Paper",
    3: "Scissors",
    4: "Spock",
    5: "Lizard",
} as const;

export const GAME_LOGIC = {
    1: { wins: [3, 5] },
    2: { wins: [1, 4] },
    3: { wins: [2, 5] },
    4: { wins: [3, 1] },
    5: { wins: [4, 2] },
};

