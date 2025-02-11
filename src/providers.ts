declare global {
    interface WindowEventMap {
        "eip6963:announceProvider": CustomEvent;
    }
}

interface EIP6963ProviderInfo {
    uuid: string;
    name: string;
    icon: string;
    provider: any;
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
    detail: {
        info: EIP6963ProviderInfo;
        provider: any;
    };
}

let selectedProvider: any = null;
let selectedAddress: string | null = null;

// Connect to the selected provider using eth_requestAccounts
const connectWithProvider = async (
    wallet: EIP6963AnnounceProviderEvent["detail"]
) => {
    try {
        selectedProvider = wallet.provider;

        // Request accounts
        const accounts = await wallet.provider.request({
            method: "eth_requestAccounts",
        });
        selectedAddress = accounts[0];

        // Pass the raw provider, not the wrapped one
        const event = new CustomEvent("wallet:connected", {
            detail: {
                provider: selectedProvider, // Pass the raw provider
                address: selectedAddress,
            },
        });
        window.dispatchEvent(event);
    } catch (error) {
        console.error("Failed to connect to provider:", error);
        selectedProvider = null;
        selectedAddress = null;
    }
};

// Display detected providers as connect buttons
export function listProviders(element: HTMLDivElement) {
    const providerButtons: string[] = [];

    window.addEventListener(
        "eip6963:announceProvider",
        (event: EIP6963AnnounceProviderEvent) => {
            // Prevent duplicate providers
            if (providerButtons.includes(event.detail.info.uuid)) return;

            const button = document.createElement("button");
            button.innerHTML = `
        <img src="${event.detail.info.icon}" alt="${event.detail.info.name}" style="width: 24px; height: 24px;" />
        <div>${event.detail.info.name}</div>
      `;

            // Call connectWithProvider when a user selects the button
            button.onclick = () => connectWithProvider(event.detail);

            element.appendChild(button);
            providerButtons.push(event.detail.info.uuid);
        }
    );

    // Notify event listeners and other parts of the dapp that a provider is requested
    window.dispatchEvent(new Event("eip6963:requestProvider"));
}

// Expose selected provider and address for use in other parts of the application
export function getSelectedProvider() {
    return selectedProvider;
}

export function getSelectedAddress() {
    return selectedAddress;
}
