const sdk = require("@defillama/sdk");
const axios = require("axios");

// note: added agoric to projects/helper/chains.json
const agoric = {
  chainId: "agoric-3",
  denom: "uist",
  coinGeckoId: "inter-stable-token",
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
  const priceUrl = "https://api.coingecko.com/api/v3/simple/price?ids=inter-stable-token&vs_currencies=usd";
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
@description fetches data from vstorage
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
@description fetches reserve data from vstorage 
*/
async function fetchReserveData() {
  const reserveData = await fetchVstorageData('/custom/vstorage/data/published.reserve.metrics'); // "+"" means is marshalled bigint
  const parsedValue = JSON.parse(reserveData.value);
  const parsedMetrics = JSON.parse(parsedValue.values[0]);
  const cleanedMetricsBody = JSON.parse(parsedMetrics.body.substring(1));
  // TODO: look at marshaler, fromCapData UPDATE: cannot add dep to repo 
  const reserve = parseFloat(cleanedMetricsBody.allocations.Fee.value.replace('+', ''));
  console.log("RESERVE");
  console.log(reserve);
  return reserve;
}

/*
@name fetchPSMData
@description fetches PSM data from vstorage for all asset types
*/
const fetchPSMData = async () => {
  const psmTypes = await fetchVstorageData('/custom/vstorage/children/published.psm.IST');
  let totalPsm = 0;

  await Promise.all(psmTypes.children.map(async (assetType) => {
    console.log("assetType", assetType);
    const psmData = await fetchVstorageData(`/custom/vstorage/data/published.psm.IST.${assetType}.metrics`);
    console.log("fetchPSMData iteration");
    console.log(psmData);
    const parsedPsmValue = JSON.parse(psmData.value);
    console.log("parsedPsmValue");
    console.log(parsedPsmValue);

    parsedPsmValue.values.forEach((value) => {
      const parsedMetrics = JSON.parse(value);
      console.log("parsedMetrics");
      console.log(parsedMetrics);
      const cleanedMetricsBody = parsedMetrics.body.substring(1);
      const cleanedParsedMetrics = JSON.parse(cleanedMetricsBody);
      console.log("cleanedParsedMetrics");
      console.log(cleanedParsedMetrics);
      const psm = parseFloat(cleanedParsedMetrics.anchorPoolBalance.value.replace('+', ''));
      console.log("PSM")
      console.log(psm)
      totalPsm += psm;
    });
  }));

  return totalPsm;
};



/*
@name fetchVaultData
@description fetches vault data from vstorage and calculates the total locked value in USD
*/
async function fetchVaultData() {
  const managerData = await fetchVstorageData('/custom/vstorage/children/published.vaultFactory.managers');
  let totalLockedUSD = 0;
  const collateralSet = new Set(); // no dups

  // collect unique collateral types...
  await Promise.all(managerData.children.map(async (managerId) => {
    const vaultDataList = await fetchVstorageData(`/custom/vstorage/children/published.vaultFactory.managers.${managerId}.vaults`);
    await Promise.all(vaultDataList.children.map(async (vaultId) => {
      try {
        const vaultData = await fetchVstorageData(`/custom/vstorage/data/published.vaultFactory.managers.${managerId}.vaults.${vaultId}`);
        const parsedVaultData = JSON.parse(vaultData.value);
        parsedVaultData.values.forEach((value) => {
          const vaultMetrics = JSON.parse(value);
          const cleanedMetricsBody = vaultMetrics.body.substring(1);
          const cleanedParsedMetrics = JSON.parse(cleanedMetricsBody);
          const lockedBrand = cleanedParsedMetrics.locked.brand.split(" ")[1].toLowerCase();
          collateralSet.add(lockedBrand);
        });
      } catch (error) {
        console.error("Error fetching vault data:", error);
      }
    }));
  }));

  // fetch prices for unique collateral types...
  const collateralPrices = {};
  await Promise.all([...collateralSet].map(async (collateral) => {
    console.log("coll: ", collateral);
    const collateralToFetch = (collateral === "atom") ? "cosmos" : collateral;
    const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${collateralToFetch}&vs_currencies=usd`;
    console.log("priceUrl:", priceUrl);
    try {
      const priceResponse = await axios.get(priceUrl);
      if (priceResponse.data[collateralToFetch]) {
        console.log("Got Price: ", priceResponse);
        collateralPrices[collateral] = priceResponse.data[collateralToFetch].usd;
      } else {
        console.error(`Price data not found for: ${collateral}`);
      }
    } catch (error) {
      console.error(`Error fetching price for ${collateral}:`, error);
    }
  }));

  // calculate total locked value in USD...
  await Promise.all(managerData.children.map(async (managerId) => {
    const vaultDataList = await fetchVstorageData(`/custom/vstorage/children/published.vaultFactory.managers.${managerId}.vaults`);
    console.log("vaultDataList");
    console.log(vaultDataList);
    await Promise.all(vaultDataList.children.map(async (vaultId) => {
      try {
        const vaultData = await fetchVstorageData(`/custom/vstorage/data/published.vaultFactory.managers.${managerId}.vaults.${vaultId}`);
        const parsedVaultData = JSON.parse(vaultData.value);
        parsedVaultData.values.forEach((value) => {
          const vaultMetrics = JSON.parse(value);
          const cleanedMetricsBody = vaultMetrics.body.substring(1);
          const cleanedParsedMetrics = JSON.parse(cleanedMetricsBody);
          const locked = parseFloat(cleanedParsedMetrics.locked.value.replace('+', ''));
          const lockedBrand = cleanedParsedMetrics.locked.brand.split(" ")[1].toLowerCase();
          console.log("lockedBrand: ", lockedBrand);
          console.log(collateralPrices);
          const price = collateralPrices[lockedBrand];
          console.log("coll price: ", price);
          if (price) {
            const lockedUSD = locked * price / getCoinDecimals(lockedBrand);
            totalLockedUSD += lockedUSD;
          } else {
            console.error(`Price not available for collateral: ${lockedBrand}`);
          }
        });
      } catch (error) {
        console.error("Error fetching vault data:", error);
      }
    }));
  }));

  return totalLockedUSD;
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


  console.log("IST Data:", istData); // do we need the supply? would it be redundant?
  console.log("Reserve Data:", reserveData);
  console.log("PSM Data:", psmData);
  console.log("Vault Data:", vaultData);


  const totalIST = parseFloat(Object.values(istData)[0]);
  // const totalTVL = totalIST + reserveData + psmData;
  // const totalTVL = reserveData + psmData; // remove total supply from calc?
  // const totalTVL = totalIST + reserveData + psmData + vaultData; //TODO: try vaut data
  const totalTVL =  reserveData + psmData + vaultData; 

  const balances = {};
  sdk.util.sumSingleBalance(balances, agoric.coinGeckoId, totalTVL);

  return balances;
}


module.exports = {
  timetravel: false,
  methodology: "Sum of IST TVL on Agoric",
  ist: {
    tvl: fetchTotalTVL, //debug: total tvl
  },
};
