import { Contract } from "ethers";

export interface MoveLogic {
    [key: number]: {
        wins: number[];
    };
}

export interface GameState {
    currentC2: bigint;
    currentStake: bigint;
    lastActionTime: bigint;
}

export interface ContractInfo {
    address: string;
    contract: Contract;
}

export type MoveMap = {
    [key: number]: string;
};

