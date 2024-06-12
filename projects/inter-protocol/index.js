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


/*
@name fetchVstorageData
@description fetches data from vstorage using RPC
@param path - the vstorage path to query
*/
async function fetchVstorageData(path) {
  const url = "http://localhost:26657/";
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "abci_query",
    params: {
      path: path,
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.data.result.response.value) {
      const decodedValue = Buffer.from(response.data.result.response.value, 'base64').toString('utf8');
      return JSON.parse(decodedValue);
    } else {
      throw new Error('No value found in response');
    }
  } catch (error) {
    // console.error("Error fetching vstorage data:", error);
    throw error;
  }
}


/*
@name fetchReserveData
@description fetches reserve data from agoric storage using RPC utils
*/
async function fetchReserveData() {
  const reserveData = await fetchVstorageData('/custom/vstorage/data/published.reserve.metrics');
  console.log("reserveData");
  console.log(reserveData);
  const firstParsedReserveData = JSON.parse(reserveData.value);
  console.log("firstParsedReserveData");
  console.log(firstParsedReserveData);
  const secondParsedReserveData = JSON.parse(firstParsedReserveData.values[0]);
  console.log("secondParsedReserveData");
  console.log(secondParsedReserveData);
  const thirdParsedReserveData = JSON.parse(secondParsedReserveData.body.substring(1));
  console.log(4);
  console.log(thirdParsedReserveData);
  console.log(thirdParsedReserveData.allocations);
  const reserve = parseFloat(thirdParsedReserveData.allocations.Fee.value.replace('+', ''));
  console.log("RESERVE")
  console.log(reserve)
  return reserve;
}

/*
@name fetchPSMData
@description fetches PSM data from agoric storage using RPC utils for all asset types
*/
async function fetchPSMData() {
  const assetTypes = ['DAI_axl', 'DAI_grv', 'USDC_axl', 'USDC_grv', 'USDT_axl', 'USDT_grv'];
  let totalPsm = 0;

  for (const assetType of assetTypes) {
    console.log("assetType", assetType)
    const psmData = await fetchVstorageData(`/custom/vstorage/data/published.psm.IST.${assetType}.metrics`);
    console.log("fetchPSMData iteration");
    console.log(psmData);
    const firstParsedPsmData = JSON.parse(psmData.value);
    console.log("firstParsedPsmData");
    console.log(firstParsedPsmData);
    const secondParsedPsmData = JSON.parse(firstParsedPsmData.values[0]);
    console.log("secondParsedPsmData");
    console.log(secondParsedPsmData);
    const cleanedBody = secondParsedPsmData.body.substring(1); 
    const thirdParsedPsmData = JSON.parse(cleanedBody);
    console.log("thirdParsedPsmData");
    console.log(thirdParsedPsmData);
    const psm = parseFloat(thirdParsedPsmData.anchorPoolBalance.value.replace('+', ''));
    console.log("PSM")
    console.log(psm)
    totalPsm += psm;
  }

  return totalPsm;
}


/*
@name fetchVaultData
@description fetches vault data from vstorage using RPC utils
*/
async function fetchVaultData() {
  const managerIds = [0, 1]; // list of manager IDs to check, ideally we can fetch these ahead of time too so we can iterate deteministically without hardcoding....
  let totalLocked = 0;

  for (const managerId of managerIds) {
    console.log("Fetching vaults for ManagerID: ", managerId)
    let vaultId = 0;
    while (true) { // TODO: this is naive approach for testing, ideally we should fetch the amount of vaults concretely, and iterate...
      try {
        const vaultData = await fetchVstorageData(`/custom/vstorage/data/published.vaultFactory.managers.manager${managerId}.vaults.vault${vaultId}`);
        const firstParsed = JSON.parse(vaultData.value);
        const secondParsed = JSON.parse(firstParsed.values[0]);
        const cleanedBody = secondParsed.body.substring(1); // remove the first character "#"
        const thirdParsed = JSON.parse(cleanedBody);
        console.log("fetch vault: ", vaultId, " with manager id: ", managerId)
        console.log(thirdParsed)
        const locked = parseFloat(thirdParsed.locked.value.replace('+', ''));
        totalLocked += locked;
        vaultId += 1;
      } catch (error) {
        if (error.message.includes('No value found in response')) {
          console.log(`No more vaults found for manager ${managerId}, vaultId ${vaultId}`);
          break;
        } else {
          console.error("Error fetching vault data:", error);
          break;
        }
      }
    }
  }

  return totalLocked;
}

/*
@name fetchTotalTVL
@description calculates total TVL including reserves, PSM, vaultsl, (and IST supply?)
*/
async function fetchTotalTVL() {
  const istData = await fetchISTData();
  const reserveData = await fetchReserveData();
  const psmData = await fetchPSMData();
  const vaultData = await fetchVaultData();


  console.log("IST Data:", istData);
  console.log("Reserve Data:", reserveData);
  console.log("PSM Data:", psmData);
  console.log("Vault Data:", vaultData);


  const totalIST = parseFloat(Object.values(istData)[0]);
  // const totalTVL = totalIST + reserveData + psmData;
  // const totalTVL = reserveData + psmData; // remove total supply from calc?
  const totalTVL = totalIST + reserveData + psmData + vaultData; //try vaut data

  const balances = {};
  sdk.util.sumSingleBalance(balances, agoric.coinGeckoId, totalTVL);

  return balances;
}


module.exports = {
  timetravel: false,
  methodology: "Sum of IST TVL on Agoric",
  ist: {
    // tvl: fetchISTData, // use fetchISTData for now
    // tvl: fetchISTDataWithUSD, // uncomment to use usd calculation
    tvl: fetchTotalTVL, //debug: total tvl
  },
};
