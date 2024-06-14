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
@name fetchSubqueryData
@description fetches data from the Agoric Subquery Indexer
@param query - the GraphQL query to execute
*/
const fetchSubqueryData = async (query) => {
  const url = 'https://api.subquery.network/sq/agoric-labs/agoric-mainnet-v2';
  try {
    const response = await axios.post(url, { query }, {
      headers: { "Content-Type": "application/json" }
    });

    if (response.data.errors) {
      throw new Error(response.data.errors.map(e => e.message).join(", "));
    }

    return response.data.data;
  } catch (error) {
    console.error('Error fetching data from Subquery:', error);
    throw error;
  }
}

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
@name fetchReserveData
@description fetches reserve data from subquery
*/
const fetchReserveData = async () => {
  const query = `
  query {
    reserveMetrics {
      nodes {
        shortfallBalance
        allocations {
          nodes {
            id
            denom
            value
          }
        }
      }
    }
  }`;
  const data = await fetchSubqueryData(query);
  const allocations = data.reserveMetrics.nodes[0].allocations.nodes;
  let totalReserve = 0;
  allocations.forEach(allocation => {
    totalReserve += parseFloat(allocation.value);
  });
  const reserve = totalReserve / getCoinDecimals('uist');
  return reserve;
}

/*
@name fetchPSMData
@description fetches PSM data from subquery for all asset types
*/
const fetchPSMData = async () => {
  const query = `
  query {
    psmMetrics {
      nodes {
        mintedPoolBalance
      }
    }
  }`;
  const data = await fetchSubqueryData(query);
  let totalPsm = 0;
  data.psmMetrics.nodes.forEach(psm => {
    totalPsm += parseFloat(psm.mintedPoolBalance);
  });
  return totalPsm / getCoinDecimals('uist');
}

/*
@name fetchVaultData
@description fetches vault data from subquery and calculates the total locked value in IST
*/
const fetchVaultData = async () => {
  const query = `
  query {
    vaultManagerMetrics {
      nodes {
        totalCollateral
      }
    }
  }`;
  const data = await fetchSubqueryData(query);
  let totalCollateral = 0;
  data.vaultManagerMetrics.nodes.forEach(vault => {
    totalCollateral += parseFloat(vault.totalCollateral);
  });
  return totalCollateral / getCoinDecimals('uist');
}

/*
@name fetchTotalCollateral
@description fetches total collateral and calculates its USD value
*/
const fetchTotalCollateral = async () => {
  const query = `
  query {
    vaultManagerMetrics {
      nodes {
        totalCollateral
        liquidatingCollateralBrand
      }
    }
    oraclePrices {
      nodes {
        priceFeedName
        typeOutAmount
        typeInAmount
      }
    }
    boardAuxes {
      nodes {
        allegedName
        decimalPlaces
      }
    }
  }`;

  const data = await fetchSubqueryData(query);
  console.log(data);
  const collateralPrices = {};
  const collateralDecimals = {};
  const collateralMap = {};

  data.vaultManagerMetrics.nodes.forEach(vault => {
    console.log("vault");
    console.log(vault);
    const collateralType = vault.liquidatingCollateralBrand;
    const collateralValue = parseFloat(vault.totalCollateral);
    if (!collateralMap[collateralType]) {
      collateralMap[collateralType] = 0;
    }
    collateralMap[collateralType] += collateralValue;
  });

  data.oraclePrices.nodes.forEach(price => {
    console.log("price");
    console.log(price);
    collateralPrices[price.priceFeedName] = parseFloat(price.typeOutAmount) / parseFloat(price.typeInAmount);
  });

  data.boardAuxes.nodes.forEach(aux => {
    console.log("aux")
    console.log(aux)
    collateralDecimals[aux.allegedName.toLowerCase()] = Math.pow(10, aux.decimalPlaces);
  });

  let totalCollateralUSD = 0;
  Object.keys(collateralMap).forEach(collateral => {
    const collatKey = `${collateral}-USD`;
    const price = collateralPrices[collatKey];
    const decimals = collateralDecimals[collateral.toLowerCase()] || 1;
    const collateralAmount = collateralMap[collateral] / decimals;
    console.log("decimals: ", decimals);
    if (price) {
      console.log(`[${collatKey}]collat price: `, price);
      console.log(`[${collatKey}]collat amount: `, collateralAmount);
      console.log(`[${collatKey}]collat price USD: `, collateralAmount * price);
      totalCollateralUSD += collateralAmount * price;
    } else {
      console.error(`Price not found for collateral: ${collateral}`);
    }
  });

  return totalCollateralUSD / getCoinDecimals('uist');
};

/*
@name fetchTotalTVL
@description calculates total TVL including reserves, PSM, vaultsl, (and IST supply?)
*/
const fetchTotalTVL = async () => { 
  const istData = await fetchISTData();
  const reserveData = await fetchReserveData();
  const psmData = await fetchPSMData();
  const vaultData = await fetchVaultData();
  const totalCollateral = await fetchTotalCollateral();

  console.log("IST Data:", istData); // do we need the supply? would it be redundant?
  console.log("Reserve Data:", reserveData);
  console.log("PSM Data:", psmData);
  console.log("Vault Data:", vaultData);
  console.log("Total Collat: ", totalCollateral)

  const totalIST = parseFloat(Object.values(istData)[0]);

  // TODO: decide on which one....
  // const totalTVL = totalIST + reserveData + psmData + vaultData;
  const totalTVL = totalCollateral
  const balances = {};
  sdk.util.sumSingleBalance(balances, agoric.coinGeckoId, totalTVL);

  return balances;
}

module.exports = {
  timetravel: false,
  methodology: "sum of ist tvl on agoric",
  ist: {
    tvl: fetchTotalTVL,
  },
};