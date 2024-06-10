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
@param denom - the denomination to get decimals for
*/
function getCoinDecimals(denom) {
  return 1e6; // IST uses 1e6
}

/*
@name fetchISTData
@description fetches the total supply of IST and returns it in a format compatble with defillama
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

/*
@name fetchISTDataWithUSD - NOT USED BY DEFAULT
@description fetches the total supply of IST, converts it to USD value and returns it in a format compatible with defillama
@note wanted to explore another calculation, although this is dependent on external cg call
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

module.exports = {
  timetravel: false,
  methodology: "Sum of all the tokens in the IST supply on Agoric.",
  agoric: {
    tvl: fetchISTData, // use fetchISTData for now
    // tvl: fetchISTDataWithUSD, // uncomment to use usd calculation
  },
};

// TODO: discuss which approach to take, and verify calculation results

/*

CALCULATION RESULTS



1) Result for fetchISTData:

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




2) Result for fetchISTDataWithUSD:

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
*/