# Inter Protocol Adapter

Run with this command, from the root directory:
```
node test.js projects/inter-protocol/index.js 
```

I'm exploring two ways to calculate the Total Value Locked (TVL) for Inter-Protocol (IST) on Agoric. One method uses the total supply of IST, and the other converts it to USD using CoinGecko prices.

## Configuration and Helper Function:

```javascript
const sdk = require("@defillama/sdk");
const axios = require("axios");

// note: added agoric to projects/helper/chains.json
const agoric = {
  chainId: "agoric-3",
  denom: "uist",
  coinGeckoId: "agoric",
};

/*
@name getCoinDecimals
@description returns the number of decimals for the given denomination
@param denom - the denomintion to get decimals for
*/
function getCoinDecimals(denom) {
  return 1e6; // IST uses 1e6
}
```

## Approach 1: Total Supply Based Calculation
This method calculates TVL based on the total supply of IST.

```javascript
/*
@name fetchISTData
@description fetches the total supply of IST and returns it in a format compatible with defillama
*/
async function fetchISTData() {
  // from https://github.com/DefiLlama/peggedassets-server/pull/292
  const url = "https://rest.cosmos.directory/agoric/cosmos/bank/v1beta1/supply/by_denom?denom=uist";
  const response = await axios.get(url);
  const assetBalance = response.data.amount.amount;
  const coinDecimals = getCoinDecimals(agoric.denom);
  const amount = assetBalance / coinDecimals;

  const balances = {};
  sdk.util.sumSingleBalance(balances, agoric.coinGeckoId, amount);

  return balances;
}
```

### Example Output for fetchISTData:

```
node test.js projects/inter-protocol/index.js
--- agoric ---
BLD                       136.79 k
Total: 136.79 k 

--- tvl ---
BLD                       136.79 k
Total: 136.79 k 

------ TVL ------
agoric                    136.79 k

total                    136.79 k
```

## Approach 2: USD Value Based Calculation

This method calculates TVL by converting the total supply of IST to its USD value using the price from CoinGeko.

```javascript
/*
@name fetchISTDataWithUSD
@description fetches the total supply of IST, converts it to USD value and returns it in a format compatible with defillama
@note wantd to explore another calculation, although this is dependent on external cg call
*/
async function fetchISTDataWithUSD() {
  // fetch total supply of ist
  const url = "https://rest.cosmos.directory/agoric/cosmos/bank/v1beta1/supply/by_denom?denom=uist";
  const response = await axios.get(url);
  const assetBalance = response.data.amount.amount;
  const coinDecimals = getCoinDecimals(agoric.denom);
  const amount = assetBalance / coinDecimals;

  // fetch ist price in usd from coingecko
  const priceUrl = "https://api.coingecko.com/api/v3/simple/price?ids=agoric&vs_currencies=usd";
  const priceResponse = await axios.get(priceUrl);
  const price = priceResponse.data.agoric.usd;

  // calculate tvl in usd
  const tvl = amount * price;

  const balances = {};
  sdk.util.sumSingleBalance(balances, agoric.coinGeckoId, tvl);

  return balances;
}
```

### Updated Example Output
Taking into account reserve, vaults, and psm

```
IST Data: { agoric: 1334769.86126 }
Reserve Data: 155816555
PSM Data: 30010011
Vault Data: 31960.240000000005
--- ist ---
BLD                       18.09 M
Total: 18.09 M 

--- tvl ---
BLD                       18.09 M
Total: 18.09 M 

------ TVL ------
ist                       18.09 M

total                    18.09 M 
```