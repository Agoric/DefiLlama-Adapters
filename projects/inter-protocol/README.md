# Inter Protocol Adapter

Run with this command, from the root directory:
```
node test.js projects/inter-protocol/index.js 
```

## functions overview
- getCoinDecimals: returns the numbr of decimals for a givn denomination. IST uses 1e6 decimals.
- fetchISTData: fetches the total supply of IST and returns it in a format compatble with defillama. uses the cosmos directory api to get the supply data and processes it.
- fetchISTDataWithUSD: fetches the total suply of IST, converts it to usd value using coingecko api, and returns it in a format compatible with defillama. note: this function is not used by default.
- fetchVstorageData: fetches data from vstorage using rpc. sends a request to the local vstorage endpoint and processes the response.
- fetchReserveData: fetches reserve data from vstorage. parses the reserve metrics from the response to get the reserve allocation fee value.
- fetchPSMData: fetches psm data from vstorage for all asset types. iterates over each asset type, fetches their metrics, and sums up the psm values.
- fetchVaultData: fetches vault data from vstorage and calculates the total locked value in usd. collects unique collateral types, fetches their prices from coingecko, and calculates the total usd value of the locked collateral.
- fetchTotalTVL: calculates total tvl (total value locked) including reserves, psm, vaults, and IST supply. sums up the values fetched by the other functions to get the total tvl.


## Updated Example Output
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