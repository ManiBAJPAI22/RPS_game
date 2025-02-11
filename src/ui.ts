export class GameUI {
    static updateStatus(
        message: string,
        type: "success" | "error" = "success"
    ): void {
        const statusElement = document.getElementById("status");
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="${type}">
                    ${message}
                </div>
            `;
        }
    }

    static showGameResult(result: string): void {
        const resultElement = document.getElementById("gameResult");
        if (resultElement) {
            resultElement.innerHTML = `
                <div class="success">
                    <p><strong>Game created successfully!</strong></p>
                    ${result}
                </div>
            `;
        }
    }

    static toggleSection(sectionId: string, show: boolean): void {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.toggle("hidden", !show);
        }
    }

    static showGameAddress(gameAddress: string): void {
        const resultElement = document.getElementById("gameResult");
        if (resultElement) {
            resultElement.innerHTML = `
                <div class="success">
                    <p><strong>Game created successfully! 🎮</strong></p>
                    <p><span class="important">Game Address:</span> ${gameAddress}</p>
                    <p>Share this address with Player 2 to start the game</p>
                </div>
            `;
        }
    }
}

