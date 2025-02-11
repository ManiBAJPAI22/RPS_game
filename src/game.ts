import {
    BrowserProvider,
    Contract,
    ContractFactory,
    formatEther,
    parseEther,
    Signer,
} from "ethers";
import { HASHER_ABI } from "../artifacts/abi/Hasher";
import { RPS_ABI } from "../artifacts/abi/RPS";
import { HASHER_BYTECODE } from "../artifacts/bytecode/Hasher";
import { RPS_BYTECODE } from "../artifacts/bytecode/RPS";
import { handleError } from "./utils";
import { GameUI } from "./ui";
import { GameState } from "./types";
import { GAME_LOGIC } from "./constants";

export class GameManager {
    private provider: BrowserProvider;
    private signer!: Signer;
    private gameInterval: NodeJS.Timeout | null = null;
    private readonly MAX_STAKE = parseEther("1"); 
    private readonly MIN_STAKE = parseEther("0.001"); 
    private hasherContract: Contract | null = null;

    constructor(provider: any, signerAddress: string) {
        this.provider = new BrowserProvider(provider);
        this.initializeSigner();
    }

    private async initializeSigner() {
        try {
            this.signer = await this.provider.getSigner();
        } catch (error) {
            throw new Error(handleError("Signer Initialization", error));
        }
    }

    private async ensureSigner(): Promise<Signer> {
        if (!this.signer) {
            await this.initializeSigner();
        }
        return this.signer;
    }

    private async deployHasher(): Promise<Contract> {
        if (this.hasherContract) {
            return this.hasherContract;
        }

        const signer = await this.ensureSigner();
        const hasherFactory = new ContractFactory(
            HASHER_ABI,
            HASHER_BYTECODE,
            signer
        );
        const hasher = await hasherFactory.deploy();
        this.hasherContract = await hasher.waitForDeployment() as Contract;
        return this.hasherContract;
    }

    private async generateSalt(): Promise<bigint> {
        // Use crypto.getRandomValues for cryptographically secure randomness
        const saltBytes = crypto.getRandomValues(new Uint8Array(32));
        const saltHex = Array.from(saltBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        return BigInt("0x" + saltHex);
    }

    private validateMove(move: string): boolean {
        const validMoves = ["1", "2", "3", "4", "5"];
        return validMoves.includes(move);
    }

    private validateStake(stake: string): boolean {
        try {
            const stakeAmount = parseEther(stake);
            return stakeAmount >= this.MIN_STAKE && stakeAmount <= this.MAX_STAKE;
        } catch {
            return false;
        }
    }

    private validateAddress(address: string): boolean {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    async generateHash(move: string): Promise<string> {
        try {
            if (!this.validateMove(move)) {
                throw new Error("Invalid move selected");
            }

            const signer = await this.ensureSigner();
            const salt = await this.generateSalt();

      
            const hasher = await this.deployHasher();
            const hash = await hasher.hash(move, salt);

            // Store encrypted versions of move and salt
            const encryptedMove = await this.encryptData(move);
            const encryptedSalt = await this.encryptData(salt.toString());

            localStorage.setItem("rpsMove", encryptedMove);
            localStorage.setItem("rpsSalt", encryptedSalt);
            localStorage.setItem("rpsHash", hash);

            return hash;
        } catch (error) {
            throw new Error(handleError("Hash Generation", error));
        }
    }

    private async encryptData(data: string): Promise<string> {
        // Simple XOR encryption with a random key (in production, use a proper encryption method)
        const key = crypto.getRandomValues(new Uint8Array(data.length));
        const encrypted = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            encrypted[i] = data.charCodeAt(i) ^ key[i];
        }
        return JSON.stringify({ data: Array.from(encrypted), key: Array.from(key) });
    }

    private async decryptData(encryptedData: string): Promise<string> {
        const { data, key } = JSON.parse(encryptedData);
        const decrypted = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            decrypted[i] = data[i] ^ key[i];
        }
        return String.fromCharCode(...decrypted);
    }

    async createGame(opponent: string, stake: string): Promise<string> {
        try {
            if (!this.validateAddress(opponent)) {
                throw new Error("Invalid opponent address");
            }

            if (!this.validateStake(stake)) {
                throw new Error("Invalid stake amount");
            }

            const signer = await this.ensureSigner();
            const hash = localStorage.getItem("rpsHash");
            if (!hash) throw new Error("Please generate a hash first");

            const currentAddress = await signer.getAddress();
            if (opponent.toLowerCase() === currentAddress.toLowerCase()) {
                throw new Error("Cannot play against yourself");
            }

            const rpsFactory = new ContractFactory(
                RPS_ABI,
                RPS_BYTECODE,
                signer
            );

            const rps = await rpsFactory.deploy(hash, opponent, {
                value: parseEther(stake),
            });

            const contract = await rps.waitForDeployment();
            const gameAddress = await contract.getAddress();

            localStorage.setItem("currentGame", gameAddress);
            return gameAddress;
        } catch (error) {
            throw new Error(handleError("Game Creation", error));
        }
    }

    async checkAndJoinGame(gameAddress: string, move: string): Promise<void> {
        try {
            if (!this.validateMove(move)) {
                throw new Error("Invalid move selected");
            }

            const rps = new Contract(gameAddress, RPS_ABI, this.signer);
            const stake = await rps.stake();

            if (stake > this.MAX_STAKE || stake < this.MIN_STAKE) {
                throw new Error("Invalid stake amount");
            }

            await rps.play(move, { value: stake });
        } catch (error) {
            throw new Error(handleError("Game Joining", error));
        }
    }

    async startGameStateMonitoring(
        gameAddress: string,
        currentRole: string,
        gameUI: typeof GameUI
    ): Promise<void> {
        if (this.gameInterval) clearInterval(this.gameInterval);

        const rps = new Contract(gameAddress, RPS_ABI, this.provider);
        const checkState = async () => {
            try {
                const state = await this.getGameState(rps);
                await this.handleGameState(state, currentRole, rps, gameUI);
            } catch (error) {
                console.error("Game state check error:", error);
            }
        };

        await checkState();
        this.gameInterval = setInterval(checkState, 3000);
    }

    private async getGameState(rps: Contract): Promise<GameState> {
        const [currentC2, currentStake, lastActionTime] = await Promise.all([
            rps.c2(),
            rps.stake(),
            rps.lastAction(),
        ]);
        return { currentC2, currentStake, lastActionTime };
    }

    private async handleGameState(
        state: GameState,
        currentRole: string,
        rps: Contract,
        gameUI: typeof GameUI
    ): Promise<void> {
        const { currentC2, currentStake, lastActionTime } = state;

        if (currentRole === "player1" && Number(currentC2) !== 0) {
            gameUI.toggleSection("revealSection", true);
            gameUI.updateStatus(
                "Player 2 has moved! Please reveal your move.",
                "success"
            );

            const timeElapsed = Math.floor(
                Date.now() / 1000 - Number(lastActionTime)
            );
            if (timeElapsed > (await rps.TIMEOUT())) {
                gameUI.updateStatus(
                    "Player 2 has timed out. You can claim your funds.",
                    "error"
                );
            }
        }

        if (currentStake === 0n) {
            if (this.gameInterval) clearInterval(this.gameInterval);
            await this.showFinalResult(rps, gameUI);
        }
    }

    private async showFinalResult(
        rps: Contract,
        gameUI: typeof GameUI
    ): Promise<void> {
        try {
            const encryptedMove = localStorage.getItem("rpsMove");
            const move1 = encryptedMove ? await this.decryptData(encryptedMove) : null;
            const [move2, j1Address, j2Address] = await Promise.all([
                rps.c2(),
                rps.j1(),
                rps.j2(),
            ]);

            if (!move1) {
                throw new Error("Move data not found");
            }

            const result = this.determineWinner(
                move1,
                move2.toString(),
                j1Address,
                j2Address
            );
            gameUI.updateStatus(result, "success");

            // Clean up sensitive data
            this.cleanup();
        } catch (error) {
            console.error("Error showing final result:", error);
            gameUI.updateStatus("Error retrieving game result", "error");
        }
    }

    private determineWinner(
        move1: string,
        move2: string,
        j1Address: string,
        j2Address: string
    ): string {
        if (move1 === move2) return "Draw!";
        return GAME_LOGIC[
            Number(move1) as keyof typeof GAME_LOGIC
        ].wins.includes(Number(move2))
            ? `Winner: ${j1Address}`
            : `Winner: ${j2Address}`;
    }

    async revealMove(gameAddress: string): Promise<void> {
        try {
            const signer = await this.ensureSigner();
            const encryptedMove = localStorage.getItem("rpsMove");
            const encryptedSalt = localStorage.getItem("rpsSalt");

            if (!encryptedMove || !encryptedSalt) {
                throw new Error("Missing move or salt - cannot reveal");
            }

            const move = await this.decryptData(encryptedMove);
            const salt = await this.decryptData(encryptedSalt);

            const moveNumber = parseInt(move);
            const saltBigInt = BigInt(salt);

            const rps = new Contract(gameAddress, RPS_ABI, signer);

            const [currentStake, currentC2] = await Promise.all([
                rps.stake(),
                rps.c2(),
            ]);

            if (currentStake === 0n) {
                throw new Error("Game already resolved");
            }

            if (currentC2 === 0n) {
                throw new Error("Player 2 has not moved yet");
            }

            const tx = await rps.solve(moveNumber, saltBigInt, {
                gasLimit: 100000,
            });

            await tx.wait();
        } catch (error) {
            throw new Error(handleError("Move Revelation", error));
        }
    }

    async displayStakeAmount(gameAddress: string): Promise<void> {
        try {
            const rps = new Contract(gameAddress, RPS_ABI, this.provider);
            const [stake, currentMove] = await Promise.all([
                rps.stake(),
                rps.c2(),
            ]);

            const moveValue = Number(currentMove);
            const stakeInEther = formatEther(stake);

            GameUI.updateStatus(
                `
                Required Stake: ${stakeInEther} ETH
                ${
                    moveValue !== 0
                        ? '<p class="error">⚠️ Player 2 has already played</p>'
                        : '<p class="success">✅ Ready for your move</p>'
                }
            `,
                "success"
            );

            const joinButton = document.querySelector(
                "#joinGameSection button"
            );
            if (joinButton) {
                (joinButton as HTMLButtonElement).disabled = moveValue !== 0;
            }
        } catch (error) {
            GameUI.updateStatus(
                `Failed to load game: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
                "error"
            );
        }
    }

    private cleanup(): void {
        localStorage.removeItem("currentGame");
        localStorage.removeItem("rpsMove");
        localStorage.removeItem("rpsSalt");
        localStorage.removeItem("rpsHash");
        
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
            this.gameInterval = null;
        }
    }
}