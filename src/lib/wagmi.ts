import { createConfig, http } from "wagmi";
import { mainnet, sepolia, localhost } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [sepolia, mainnet, localhost],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [localhost.id]: http("http://127.0.0.1:8545"),
  },
});
