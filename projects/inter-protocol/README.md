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

### Example Output for fetchISTDataWithUSD:

```
node test.js projects/inter-protocol/index.js
--- agoric ---
BLD                       13.93 k
Total: 13.93 k 

--- tvl ---
BLD                       13.93 k
Total: 13.93 k 

------ TVL ------
agoric                    13.93 k

total                    13.93 k
```

# fetchISTData by default
By default, the module exports the fetchISTDta method. To use the USD value calculation, uncomment the respective line.

# Things to discuss with team
- Accuracy: The total supply approach doesn’t consider the market value, while the USD approach gives a real-time value.
- Dependency: The USD approach relies on external data from CoinGecko.
- Implementtion: Decide if the extra accuracy is worth the reliance on an external service.


----------------------------

### vault/PSD/reserve debug
Most updated run for sharing
```
node test.js projects/inter-protocol/index.js                                 
reserveData
{
  value: '{"blockHeight":"3650","values":["{\\"body\\":\\"#{\\\\\\"allocations\\\\\\":{\\\\\\"Fee\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+155159308\\\\\\"}},\\\\\\"shortfallBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalFeeBurned\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalFeeMinted\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}}\\",\\"slots\\":[\\"board0257\\"]}"]}'
}
firstParsedReserveData
{
  blockHeight: '3650',
  values: [
    '{"body":"#{\\"allocations\\":{\\"Fee\\":{\\"brand\\":\\"$0.Alleged: IST brand\\",\\"value\\":\\"+155159308\\"}},\\"shortfallBalance\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalFeeBurned\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalFeeMinted\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"}}","slots":["board0257"]}'
  ]
}
secondParsedReserveData
{
  body: '#{"allocations":{"Fee":{"brand":"$0.Alleged: IST brand","value":"+155159308"}},"shortfallBalance":{"brand":"$0","value":"+0"},"totalFeeBurned":{"brand":"$0","value":"+0"},"totalFeeMinted":{"brand":"$0","value":"+0"}}',
  slots: [ 'board0257' ]
}
4
{
  allocations: { Fee: { brand: '$0.Alleged: IST brand', value: '+155159308' } },
  shortfallBalance: { brand: '$0', value: '+0' },
  totalFeeBurned: { brand: '$0', value: '+0' },
  totalFeeMinted: { brand: '$0', value: '+0' }
}
{ Fee: { brand: '$0.Alleged: IST brand', value: '+155159308' } }
RESERVE
155159308
assetType DAI_axl
fetchPSMData iteration
{
  value: '{"blockHeight":"226","values":["{\\"body\\":\\"#{\\\\\\"anchorPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: DAI_axl brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"feePoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"mintedPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalAnchorProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalMintedProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}}\\",\\"slots\\":[\\"board05736\\",\\"board0257\\"]}"]}'
}
firstParsedPsmData
{
  blockHeight: '226',
  values: [
    '{"body":"#{\\"anchorPoolBalance\\":{\\"brand\\":\\"$0.Alleged: DAI_axl brand\\",\\"value\\":\\"+0\\"},\\"feePoolBalance\\":{\\"brand\\":\\"$1.Alleged: IST brand\\",\\"value\\":\\"+0\\"},\\"mintedPoolBalance\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"},\\"totalAnchorProvided\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalMintedProvided\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"}}","slots":["board05736","board0257"]}'
  ]
}
secondParsedPsmData
{
  body: '#{"anchorPoolBalance":{"brand":"$0.Alleged: DAI_axl brand","value":"+0"},"feePoolBalance":{"brand":"$1.Alleged: IST brand","value":"+0"},"mintedPoolBalance":{"brand":"$1","value":"+0"},"totalAnchorProvided":{"brand":"$0","value":"+0"},"totalMintedProvided":{"brand":"$1","value":"+0"}}',
  slots: [ 'board05736', 'board0257' ]
}
thirdParsedPsmData
{
  anchorPoolBalance: { brand: '$0.Alleged: DAI_axl brand', value: '+0' },
  feePoolBalance: { brand: '$1.Alleged: IST brand', value: '+0' },
  mintedPoolBalance: { brand: '$1', value: '+0' },
  totalAnchorProvided: { brand: '$0', value: '+0' },
  totalMintedProvided: { brand: '$1', value: '+0' }
}
PSM
0
assetType DAI_grv
fetchPSMData iteration
{
  value: '{"blockHeight":"226","values":["{\\"body\\":\\"#{\\\\\\"anchorPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: DAI_grv brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"feePoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"mintedPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalAnchorProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalMintedProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}}\\",\\"slots\\":[\\"board03138\\",\\"board0257\\"]}"]}'
}
firstParsedPsmData
{
  blockHeight: '226',
  values: [
    '{"body":"#{\\"anchorPoolBalance\\":{\\"brand\\":\\"$0.Alleged: DAI_grv brand\\",\\"value\\":\\"+0\\"},\\"feePoolBalance\\":{\\"brand\\":\\"$1.Alleged: IST brand\\",\\"value\\":\\"+0\\"},\\"mintedPoolBalance\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"},\\"totalAnchorProvided\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalMintedProvided\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"}}","slots":["board03138","board0257"]}'
  ]
}
secondParsedPsmData
{
  body: '#{"anchorPoolBalance":{"brand":"$0.Alleged: DAI_grv brand","value":"+0"},"feePoolBalance":{"brand":"$1.Alleged: IST brand","value":"+0"},"mintedPoolBalance":{"brand":"$1","value":"+0"},"totalAnchorProvided":{"brand":"$0","value":"+0"},"totalMintedProvided":{"brand":"$1","value":"+0"}}',
  slots: [ 'board03138', 'board0257' ]
}
thirdParsedPsmData
{
  anchorPoolBalance: { brand: '$0.Alleged: DAI_grv brand', value: '+0' },
  feePoolBalance: { brand: '$1.Alleged: IST brand', value: '+0' },
  mintedPoolBalance: { brand: '$1', value: '+0' },
  totalAnchorProvided: { brand: '$0', value: '+0' },
  totalMintedProvided: { brand: '$1', value: '+0' }
}
PSM
0
assetType USDC_axl
fetchPSMData iteration
{
  value: '{"blockHeight":"226","values":["{\\"body\\":\\"#{\\\\\\"anchorPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: USDC_axl brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"feePoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"mintedPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalAnchorProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalMintedProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}}\\",\\"slots\\":[\\"board03040\\",\\"board0257\\"]}","{\\"body\\":\\"#{\\\\\\"anchorPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: USDC_axl brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+30010011\\\\\\"},\\\\\\"feePoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"mintedPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+30010011\\\\\\"},\\\\\\"totalAnchorProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalMintedProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+30010011\\\\\\"}}\\",\\"slots\\":[\\"board03040\\",\\"board0257\\"]}"]}'
}
firstParsedPsmData
{
  blockHeight: '226',
  values: [
    '{"body":"#{\\"anchorPoolBalance\\":{\\"brand\\":\\"$0.Alleged: USDC_axl brand\\",\\"value\\":\\"+0\\"},\\"feePoolBalance\\":{\\"brand\\":\\"$1.Alleged: IST brand\\",\\"value\\":\\"+0\\"},\\"mintedPoolBalance\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"},\\"totalAnchorProvided\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalMintedProvided\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"}}","slots":["board03040","board0257"]}',
    '{"body":"#{\\"anchorPoolBalance\\":{\\"brand\\":\\"$0.Alleged: USDC_axl brand\\",\\"value\\":\\"+30010011\\"},\\"feePoolBalance\\":{\\"brand\\":\\"$1.Alleged: IST brand\\",\\"value\\":\\"+0\\"},\\"mintedPoolBalance\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+30010011\\"},\\"totalAnchorProvided\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalMintedProvided\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+30010011\\"}}","slots":["board03040","board0257"]}'
  ]
}
secondParsedPsmData
{
  body: '#{"anchorPoolBalance":{"brand":"$0.Alleged: USDC_axl brand","value":"+0"},"feePoolBalance":{"brand":"$1.Alleged: IST brand","value":"+0"},"mintedPoolBalance":{"brand":"$1","value":"+0"},"totalAnchorProvided":{"brand":"$0","value":"+0"},"totalMintedProvided":{"brand":"$1","value":"+0"}}',
  slots: [ 'board03040', 'board0257' ]
}
thirdParsedPsmData
{
  anchorPoolBalance: { brand: '$0.Alleged: USDC_axl brand', value: '+0' },
  feePoolBalance: { brand: '$1.Alleged: IST brand', value: '+0' },
  mintedPoolBalance: { brand: '$1', value: '+0' },
  totalAnchorProvided: { brand: '$0', value: '+0' },
  totalMintedProvided: { brand: '$1', value: '+0' }
}
PSM
0
assetType USDC_grv
fetchPSMData iteration
{
  value: '{"blockHeight":"226","values":["{\\"body\\":\\"#{\\\\\\"anchorPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: USDC_grv brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"feePoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"mintedPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalAnchorProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalMintedProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}}\\",\\"slots\\":[\\"board04542\\",\\"board0257\\"]}","{\\"body\\":\\"#{\\\\\\"anchorPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: USDC_grv brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"feePoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"mintedPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalAnchorProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalMintedProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}}\\",\\"slots\\":[\\"board04542\\",\\"board0257\\"]}"]}'
}
firstParsedPsmData
{
  blockHeight: '226',
  values: [
    '{"body":"#{\\"anchorPoolBalance\\":{\\"brand\\":\\"$0.Alleged: USDC_grv brand\\",\\"value\\":\\"+0\\"},\\"feePoolBalance\\":{\\"brand\\":\\"$1.Alleged: IST brand\\",\\"value\\":\\"+0\\"},\\"mintedPoolBalance\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"},\\"totalAnchorProvided\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalMintedProvided\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"}}","slots":["board04542","board0257"]}',
    '{"body":"#{\\"anchorPoolBalance\\":{\\"brand\\":\\"$0.Alleged: USDC_grv brand\\",\\"value\\":\\"+0\\"},\\"feePoolBalance\\":{\\"brand\\":\\"$1.Alleged: IST brand\\",\\"value\\":\\"+0\\"},\\"mintedPoolBalance\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"},\\"totalAnchorProvided\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalMintedProvided\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"}}","slots":["board04542","board0257"]}'
  ]
}
secondParsedPsmData
{
  body: '#{"anchorPoolBalance":{"brand":"$0.Alleged: USDC_grv brand","value":"+0"},"feePoolBalance":{"brand":"$1.Alleged: IST brand","value":"+0"},"mintedPoolBalance":{"brand":"$1","value":"+0"},"totalAnchorProvided":{"brand":"$0","value":"+0"},"totalMintedProvided":{"brand":"$1","value":"+0"}}',
  slots: [ 'board04542', 'board0257' ]
}
thirdParsedPsmData
{
  anchorPoolBalance: { brand: '$0.Alleged: USDC_grv brand', value: '+0' },
  feePoolBalance: { brand: '$1.Alleged: IST brand', value: '+0' },
  mintedPoolBalance: { brand: '$1', value: '+0' },
  totalAnchorProvided: { brand: '$0', value: '+0' },
  totalMintedProvided: { brand: '$1', value: '+0' }
}
PSM
0
assetType USDT_axl
fetchPSMData iteration
{
  value: '{"blockHeight":"226","values":["{\\"body\\":\\"#{\\\\\\"anchorPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: USDT_axl brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"feePoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"mintedPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalAnchorProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalMintedProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}}\\",\\"slots\\":[\\"board01744\\",\\"board0257\\"]}","{\\"body\\":\\"#{\\\\\\"anchorPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: USDT_axl brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"feePoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"mintedPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalAnchorProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalMintedProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}}\\",\\"slots\\":[\\"board01744\\",\\"board0257\\"]}"]}'
}
firstParsedPsmData
{
  blockHeight: '226',
  values: [
    '{"body":"#{\\"anchorPoolBalance\\":{\\"brand\\":\\"$0.Alleged: USDT_axl brand\\",\\"value\\":\\"+0\\"},\\"feePoolBalance\\":{\\"brand\\":\\"$1.Alleged: IST brand\\",\\"value\\":\\"+0\\"},\\"mintedPoolBalance\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"},\\"totalAnchorProvided\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalMintedProvided\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"}}","slots":["board01744","board0257"]}',
    '{"body":"#{\\"anchorPoolBalance\\":{\\"brand\\":\\"$0.Alleged: USDT_axl brand\\",\\"value\\":\\"+0\\"},\\"feePoolBalance\\":{\\"brand\\":\\"$1.Alleged: IST brand\\",\\"value\\":\\"+0\\"},\\"mintedPoolBalance\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"},\\"totalAnchorProvided\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalMintedProvided\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"}}","slots":["board01744","board0257"]}'
  ]
}
secondParsedPsmData
{
  body: '#{"anchorPoolBalance":{"brand":"$0.Alleged: USDT_axl brand","value":"+0"},"feePoolBalance":{"brand":"$1.Alleged: IST brand","value":"+0"},"mintedPoolBalance":{"brand":"$1","value":"+0"},"totalAnchorProvided":{"brand":"$0","value":"+0"},"totalMintedProvided":{"brand":"$1","value":"+0"}}',
  slots: [ 'board01744', 'board0257' ]
}
thirdParsedPsmData
{
  anchorPoolBalance: { brand: '$0.Alleged: USDT_axl brand', value: '+0' },
  feePoolBalance: { brand: '$1.Alleged: IST brand', value: '+0' },
  mintedPoolBalance: { brand: '$1', value: '+0' },
  totalAnchorProvided: { brand: '$0', value: '+0' },
  totalMintedProvided: { brand: '$1', value: '+0' }
}
PSM
0
assetType USDT_grv
fetchPSMData iteration
{
  value: '{"blockHeight":"226","values":["{\\"body\\":\\"#{\\\\\\"anchorPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: USDT_grv brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"feePoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"mintedPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalAnchorProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalMintedProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}}\\",\\"slots\\":[\\"board03446\\",\\"board0257\\"]}","{\\"body\\":\\"#{\\\\\\"anchorPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: USDT_grv brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"feePoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"mintedPoolBalance\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalAnchorProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"totalMintedProvided\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"}}\\",\\"slots\\":[\\"board03446\\",\\"board0257\\"]}"]}'
}
firstParsedPsmData
{
  blockHeight: '226',
  values: [
    '{"body":"#{\\"anchorPoolBalance\\":{\\"brand\\":\\"$0.Alleged: USDT_grv brand\\",\\"value\\":\\"+0\\"},\\"feePoolBalance\\":{\\"brand\\":\\"$1.Alleged: IST brand\\",\\"value\\":\\"+0\\"},\\"mintedPoolBalance\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"},\\"totalAnchorProvided\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalMintedProvided\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"}}","slots":["board03446","board0257"]}',
    '{"body":"#{\\"anchorPoolBalance\\":{\\"brand\\":\\"$0.Alleged: USDT_grv brand\\",\\"value\\":\\"+0\\"},\\"feePoolBalance\\":{\\"brand\\":\\"$1.Alleged: IST brand\\",\\"value\\":\\"+0\\"},\\"mintedPoolBalance\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"},\\"totalAnchorProvided\\":{\\"brand\\":\\"$0\\",\\"value\\":\\"+0\\"},\\"totalMintedProvided\\":{\\"brand\\":\\"$1\\",\\"value\\":\\"+0\\"}}","slots":["board03446","board0257"]}'
  ]
}
secondParsedPsmData
{
  body: '#{"anchorPoolBalance":{"brand":"$0.Alleged: USDT_grv brand","value":"+0"},"feePoolBalance":{"brand":"$1.Alleged: IST brand","value":"+0"},"mintedPoolBalance":{"brand":"$1","value":"+0"},"totalAnchorProvided":{"brand":"$0","value":"+0"},"totalMintedProvided":{"brand":"$1","value":"+0"}}',
  slots: [ 'board03446', 'board0257' ]
}
thirdParsedPsmData
{
  anchorPoolBalance: { brand: '$0.Alleged: USDT_grv brand', value: '+0' },
  feePoolBalance: { brand: '$1.Alleged: IST brand', value: '+0' },
  mintedPoolBalance: { brand: '$1', value: '+0' },
  totalAnchorProvided: { brand: '$0', value: '+0' },
  totalMintedProvided: { brand: '$1', value: '+0' }
}
PSM
0
Fetching vaults for ManagerID:  0
fetch vault:  0  with manager id:  0
{
  debtSnapshot: {
    debt: { brand: '$0.Alleged: IST brand', value: '+6030000' },
    interest: { denominator: [Object], numerator: [Object] }
  },
  locked: { brand: '$1.Alleged: ATOM brand', value: '+8000000' },
  vaultState: 'active'
}
fetch vault:  1  with manager id:  0
{
  debtSnapshot: {
    debt: { brand: '$0.Alleged: IST brand', value: '+0' },
    interest: { denominator: [Object], numerator: [Object] }
  },
  locked: { brand: '$1.Alleged: ATOM brand', value: '+0' },
  vaultState: 'closed'
}
fetch vault:  2  with manager id:  0
{
  debtSnapshot: {
    debt: { brand: '$0.Alleged: IST brand', value: '+0' },
    interest: { denominator: [Object], numerator: [Object] }
  },
  locked: { brand: '$1.Alleged: ATOM brand', value: '+0' },
  vaultState: 'closed'
}
fetch vault:  3  with manager id:  0
{
  debtSnapshot: {
    debt: { brand: '$0.Alleged: IST brand', value: '+0' },
    interest: { denominator: [Object], numerator: [Object] }
  },
  locked: { brand: '$1.Alleged: ATOM brand', value: '+0' },
  vaultState: 'closed'
}
fetch vault:  4  with manager id:  0
{
  debtSnapshot: {
    debt: { brand: '$0.Alleged: IST brand', value: '+3506445000' },
    interest: { denominator: [Object], numerator: [Object] }
  },
  locked: { brand: '$1.Alleged: ATOM brand', value: '+583000000' },
  vaultState: 'active'
}
fetch vault:  5  with manager id:  0
{
  debtSnapshot: {
    debt: { brand: '$0.Alleged: IST brand', value: '+10203765000' },
    interest: { denominator: [Object], numerator: [Object] }
  },
  locked: { brand: '$1.Alleged: ATOM brand', value: '+1693000000' },
  vaultState: 'active'
}
fetch vault:  6  with manager id:  0
{
  debtSnapshot: {
    debt: { brand: '$0.Alleged: IST brand', value: '+4745610000' },
    interest: { denominator: [Object], numerator: [Object] }
  },
  locked: { brand: '$1.Alleged: ATOM brand', value: '+788000000' },
  vaultState: 'active'
}
fetch vault:  7  with manager id:  0
{
  debtSnapshot: {
    debt: { brand: '$0.Alleged: IST brand', value: '+5637045000' },
    interest: { denominator: [Object], numerator: [Object] }
  },
  locked: { brand: '$1.Alleged: ATOM brand', value: '+936000000' },
  vaultState: 'active'
}
fetch vault:  8  with manager id:  0
{
  debtSnapshot: {
    debt: { brand: '$0.Alleged: IST brand', value: '+100500000' },
    interest: { denominator: [Object], numerator: [Object] }
  },
  locked: { brand: '$1.Alleged: ATOM brand', value: '+100000000' },
  vaultState: 'active'
}
No more vaults found for manager 0, vaultId 9
Fetching vaults for ManagerID:  1
No more vaults found for manager 1, vaultId 0
IST Data: { agoric: 1334429.86126 }
Reserve Data: 155159308
PSM Data: 0
Vault Data: 4108000000
-------------------
Warning: 
Token coingecko:agoric has more than 100M in value (404.947796373004 M) , price data:  {
  price: 0.094958,
  symbol: 'BLD',
  timestamp: 1718171444,
  confidence: 0.99
}
-------------------
--- ist ---
BLD                       404.95 M
Total: 404.95 M 

--- tvl ---
BLD                       404.95 M
Total: 404.95 M 

------ TVL ------
ist                       404.95 M

total                    404.95 M 
```