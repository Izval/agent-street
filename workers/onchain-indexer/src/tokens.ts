// tokens.ts — lista curada de ~25 tokens BSC (chainId 56) líquidos y bien conocidos.
// Direcciones checksum reales de BSC mainnet. `decimals` para des-escalar balances.
// Se leen sus balances via balanceOf(wallet) y su precio USD via DexScreener.

export interface TokenMeta {
  symbol: string;
  name: string;
  address: string; // lowercase
  decimals: number;
}

// Nativo BNB se maneja aparte (eth_getBalance); su precio USD = precio de WBNB.
export const WBNB_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

export const TOKENS: TokenMeta[] = [
  { symbol: "WBNB", name: "Wrapped BNB", address: WBNB_ADDRESS, decimals: 18 },
  { symbol: "USDT", name: "Tether USD", address: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
  { symbol: "USDC", name: "USD Coin", address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18 },
  { symbol: "BUSD", name: "Binance USD", address: "0xe9e7cea3dedca5984780bafc599bd69add087d56", decimals: 18 },
  { symbol: "FDUSD", name: "First Digital USD", address: "0xc5f0f7b66764f6ec8c8dff7ba683102295e16409", decimals: 18 },
  { symbol: "CAKE", name: "PancakeSwap Token", address: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", decimals: 18 },
  { symbol: "BTCB", name: "Bitcoin BEP20", address: "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", decimals: 18 },
  { symbol: "ETH", name: "Ethereum Token", address: "0x2170ed0880ac9a755fd29b2688956bd959f933f8", decimals: 18 },
  { symbol: "XVS", name: "Venus", address: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63", decimals: 18 },
  { symbol: "DAI", name: "Dai Token", address: "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3", decimals: 18 },
  { symbol: "TUSD", name: "TrueUSD", address: "0x14016e85a25aeb13065688cafb43044c2ef86784", decimals: 18 },
  { symbol: "LINK", name: "ChainLink Token", address: "0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd", decimals: 18 },
  { symbol: "ADA", name: "Cardano Token", address: "0x3ee2200efb3400fabb9aacf31297cbdd1d435d47", decimals: 18 },
  { symbol: "DOT", name: "Polkadot Token", address: "0x7083609fce4d1d8dc0c979aab8c869ea2c873402", decimals: 18 },
  { symbol: "MATIC", name: "Matic Token", address: "0xcc42724c6683b7e57334c4e856f4c9965ed682bd", decimals: 18 },
  { symbol: "LTC", name: "Litecoin Token", address: "0x4338665cbb7b2485a8855a139b75d5e34ab0db94", decimals: 18 },
  { symbol: "UNI", name: "Uniswap", address: "0xbf5140a22578168fd562dccf235e5d43a02ce9b1", decimals: 18 },
  { symbol: "AVAX", name: "Avalanche", address: "0x1ce0c2827e2ef14d5c4f29a091d735a204794041", decimals: 18 },
  { symbol: "INJ", name: "Injective", address: "0xa2b726b1145a4773f68593cf171187d8ebe4d495", decimals: 18 },
  { symbol: "TWT", name: "Trust Wallet Token", address: "0x4b0f1812e5df2a09796481ff14017e6005508003", decimals: 18 },
  { symbol: "ALPACA", name: "AlpacaToken", address: "0x8f0528ce5ef7b51152a59745befdd91d97091d2f", decimals: 18 },
  { symbol: "WOO", name: "Wootrade Network", address: "0x4691937a7508860f876c9c0a2a617e7d9e945d4b", decimals: 18 },
  { symbol: "SHIB", name: "SHIBA INU", address: "0x2859e4544c4bb03966803b044a93563bd2d0dd4d", decimals: 18 },
  { symbol: "FLOKI", name: "FLOKI", address: "0xfb5b838b6cfeedc2873ab27866079ac55363d37e", decimals: 9 },
  { symbol: "BABYDOGE", name: "Baby Doge Coin", address: "0xc748673057861a797275cd8a068abb95a902e8de", decimals: 9 },
];
