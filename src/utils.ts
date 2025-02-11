export function validateEthereumAddress(address: string): boolean {
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(address)) {
        throw new Error("Invalid Ethereum address format");
    }
    return true;
}

export function validateStake(stake: string): boolean {
    const stakeAmount = parseFloat(stake);
    if (isNaN(stakeAmount) || stakeAmount <= 0) {
        throw new Error("Invalid stake amount. Must be a positive number.");
    }
    return true;
}

export function handleError(context: string, error: any): string {
    console.error(`${context} Error:`, error);

    switch (error.code) {
        case 4001:
            return "Transaction rejected by user";
        case "INSUFFICIENT_FUNDS":
            return "Insufficient ETH balance";
        case "INVALID_ARGUMENT":
            return "Invalid input provided";
        default:
            return error.message || "An unknown error occurred";
    }
}

