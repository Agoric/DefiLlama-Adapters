const sdk = require("@defillama/sdk");
const axios = require("axios");

// note: added agoric to projects/helper/chains.json
const agoric = {
  chainId: "agoric-3",
  denom: "uist",
  coinGeckoId: "inter-stable-token",
};

/*
@name delay
@description throttle rpc calls
@param ms - milliseconds to delay
*/
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/*
@name getCoinDecimals
@description returns the number of decimals for the given denomination
@param denom - the denomination to get decimals for
*/
const getCoinDecimals = (denom) => 1e6; // IST uses 1e6


/*
@name fetchISTData
@description fetches the total supply of IST and returns it in a format compatble with defillama
*/
const fetchISTData = async () => {
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
const fetchISTDataWithUSD = async () => {
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
let CALL_COUNTER = 0
const fetchVstorageData = (() => {
  const cache = new Map();

  return async (path) => {
    if (cache.has(path)) {
      return cache.get(path);
    }
    
    CALL_COUNTER += 1;
    // const url = "http://localhost:26657/";
    // const url = "https://main.rpc.agoric.net:443";
    const url = "https://agoric-rpc.polkachu.com/"
    // const url = "https://agoric-testnet-rpc.polkachu.com/"
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "abci_query",
      params: { path },
    };

    try {
      await delay(5000); // 3-second delay
      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.result.response.value) {
        const decodedValue = Buffer.from(response.data.result.response.value, 'base64').toString('utf8');
        const result = JSON.parse(decodedValue);
        console.log("vstorage result:")
        console.log(result)
        cache.set(path, result);
        return result;
      } else {
        throw new Error('No value found in response');
      }
    } catch (error) {
      throw error;
    }
  };
})();


/*
@name fetchReserveData
@description fetches reserve data from vstorage 
*/
const fetchReserveData = async () => {
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
      // const psm = parseFloat(cleanedParsedMetrics.anchorPoolBalance.value.replace('+', ''));
      const psm = parseFloat(cleanedParsedMetrics.mintedPoolBalance.value.replace('+', '')); // anchor pool would be the coll, but we want the IST yes?
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
CALL_COUNTER: 578 - first attempt
CALL_COUNTER: 573 - second attempt - with vault cache
CALL_COUNTER: 293 - third attempt - with price cache
*/
// only calculating based on IST price
let VAULT_COUNT = 0

const fetchVaultData = async () => {
  const managerData = await fetchVstorageData('/custom/vstorage/children/published.vaultFactory.managers');
  let totalLockedUSD = 0;
  const collateralSet = new Set(); // no dups
  const vaultDataCache = new Map(); // cache for vault data
  const priceCache = new Map(); // cache for prices

  // collect unique collateral types...
  await Promise.all(managerData.children.map(async (managerId) => {
    if (!vaultDataCache.has(managerId)) {
      const vaultDataList = await fetchVstorageData(`/custom/vstorage/children/published.vaultFactory.managers.${managerId}.vaults`);
      vaultDataCache.set(managerId, vaultDataList); // cache the vault data list
    }
    const vaultDataList = vaultDataCache.get(managerId);
    await Promise.all(vaultDataList.children.map(async (vaultId) => {
      try {
        if (!vaultDataCache.has(vaultId)) {
          const vaultData = await fetchVstorageData(`/custom/vstorage/data/published.vaultFactory.managers.${managerId}.vaults.${vaultId}`);
          vaultDataCache.set(vaultId, vaultData);
        }
        const vaultData = vaultDataCache.get(vaultId);
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
  const fetchPrice = async (collateral) => {
    console.log("coll: ", collateral);
    let collateralToFetch;
    switch (collateral) {
      case "atom":
        collateralToFetch = "cosmos";
        break;
      case "statom":
        collateralToFetch = "stride-staked-atom";
        break;
      case "stosmo":
        collateralToFetch = "stride-staked-osmo";
        break;
      case "sttia":
        collateralToFetch = "stride-staked-tia";
        break;
      // case "stkatom":
      //   collateralToFetch = "pstake-staked-atom-2";
        break;
      default:
        collateralToFetch = collateral;
    }

    const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${collateralToFetch}&vs_currencies=usd`;
    console.log("priceUrl:", priceUrl);
    try {
      await delay(3000); // 3-second delay
      const priceResponse = await axios.get(priceUrl);
      console.log("priceResponse.data")
      // console.log(priceResponse.data)
      if (priceResponse.data[collateralToFetch]) {
        // console.log("Got Price: ", priceResponse);
        return priceResponse.data[collateralToFetch].usd;
      } else {
        console.error(`Price data not found for: ${collateral}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching price for ${collateral}:`, error);
      return null;
    }
  };

  const pricePromises = {};
  await Promise.all([...collateralSet].map(async (collateral) => {
    // console.log("priceCache")
    // console.log(priceCache)
    if (!priceCache.has(collateral)) {
      if (!pricePromises[collateral]) {
        pricePromises[collateral] = fetchPrice(collateral);
      }
      const price = await pricePromises[collateral];
      if (price !== null) {
        priceCache.set(collateral, price);
      }
    }
  }));

  // calculate total locked value in USD...
  await Promise.all(managerData.children.map(async (managerId) => {
    const vaultDataList = vaultDataCache.get(managerId); // retrieve from cache
    console.log("vaultDataList");
    // console.log(vaultDataList);
    await Promise.all(vaultDataList.children.map(async (vaultId) => {
      try {
        const vaultData = vaultDataCache.get(vaultId); // retrieve from cache
        const parsedVaultData = JSON.parse(vaultData.value);
        parsedVaultData.values.forEach((value) => {
          const vaultMetrics = JSON.parse(value);
          const cleanedMetricsBody = vaultMetrics.body.substring(1);
          const cleanedParsedMetrics = JSON.parse(cleanedMetricsBody);
          const locked = parseFloat(cleanedParsedMetrics.locked.value.replace('+', ''));
          const lockedBrand = cleanedParsedMetrics.locked.brand.split(" ")[1].toLowerCase();
          console.log("lockedBrand: ", lockedBrand);
          // console.log(priceCache);
          const price = priceCache.get(lockedBrand);
          // console.log("coll price: ", price);
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
};



// first attempt - VAULT_COUNT:  512 should not be as high:
// second attempt - VAULT_COUNT:  225
/*
test:
Reserve Data: 69625972760
PSM Data: 5475886243
Vault Data: 1532786.3758959998


example:
vstorage result:
{
  value: '{"blockHeight":"13092169","values":["{\\"body\\":\\"#{\\\\\\"debtSnapshot\\\\\\":{\\\\\\"debt\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0.Alleged: IST brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"interest\\\\\\":{\\\\\\"denominator\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+100000000000000000000\\\\\\"},\\\\\\"numerator\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$0\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+100452870470097742390\\\\\\"}}},\\\\\\"locked\\\\\\":{\\\\\\"brand\\\\\\":\\\\\\"$1.Alleged: stATOM brand\\\\\\",\\\\\\"value\\\\\\":\\\\\\"+0\\\\\\"},\\\\\\"vaultState\\\\\\":\\\\\\"closed\\\\\\"}\\",\\"slots\\":[\\"board0257\\",\\"board037112\\"]}"]}'
}
IST brand amount:    100000000000000000000 ? this isn't 6 decimals... does it need to be...
statom brand amount: 100452870470097742390

from inter ui (seems wrong):

Total Reserve Assets
$106.51K

Total Locked Collateral Value
$4.14M


*/
// const fetchVaultData = async () => {
//   const managerData = await fetchVstorageData('/custom/vstorage/children/published.vaultFactory.managers');
//   let totalLockedIST = 0;
//   const vaultDataCache = new Map(); // cache for vault data

//   // helper function to process vault data
//   const processVaultData = async (managerId, vaultId) => {
//     if (!vaultDataCache.has(vaultId)) {
//       try {
//         const vaultData = await fetchVstorageData(`/custom/vstorage/data/published.vaultFactory.managers.${managerId}.vaults.${vaultId}`);
//         vaultDataCache.set(vaultId, vaultData);
//         VAULT_COUNT += 1; // increment only when a new vault data is fetched
//       } catch (error) {
//         console.error("Error fetching vault data:", error);
//         return;
//       }
//     }

//     const vaultData = vaultDataCache.get(vaultId);
//     const parsedVaultData = JSON.parse(vaultData.value);
//     parsedVaultData.values.forEach((value) => {
//       const vaultMetrics = JSON.parse(value);
//       const cleanedMetricsBody = vaultMetrics.body.substring(1);
//       const cleanedParsedMetrics = JSON.parse(cleanedMetricsBody);
//       const lockedIST = parseFloat(cleanedParsedMetrics.locked.value.replace('+', ''));
//       totalLockedIST += lockedIST / getCoinDecimals('uist');
//     });
//   };

//   // collect IST values from vaults...
//   const vaultIdsToProcess = [];
//   for (const managerId of managerData.children) {
//     if (!vaultDataCache.has(managerId)) {
//       try {
//         const vaultDataList = await fetchVstorageData(`/custom/vstorage/children/published.vaultFactory.managers.${managerId}.vaults`);
//         vaultDataCache.set(managerId, vaultDataList); // Cache the vault data list
//         vaultIdsToProcess.push(...vaultDataList.children.map(vaultId => ({ managerId, vaultId })));
//       } catch (error) {
//         console.error("Error fetching vault list:", error);
//         continue;
//       }
//     }
//   }

//   // process all collected vault IDs
//   await Promise.all(vaultIdsToProcess.map(({ managerId, vaultId }) => processVaultData(managerId, vaultId)));

//   console.log("VAULT_COUNT: ", VAULT_COUNT);
//   return totalLockedIST;
// };




/*
@name fetchTotalTVL
@description calculates total TVL including reserves, PSM, vaultsl, (and IST supply?)
*/
const fetchTotalTVL = async () => { 
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

  console.log("CALL_COUNTER: ", CALL_COUNTER)
  console.log("VAULT_COUNT: ", VAULT_COUNT)
  return balances;
}


module.exports = {
  timetravel: false,
  methodology: "Sum of IST TVL on Agoric",
  ist: {
    tvl: fetchTotalTVL, //debug: total tvl
  },
};
