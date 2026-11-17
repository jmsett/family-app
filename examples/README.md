# Fictional chart data

[demo-household.json](demo-household.json) is a schema-7 household containing **fictional** Alex and Sam, January 2025–November 2026: 247 expense/movement entries and 91 fund confirmations. It includes rent, seasonal utilities, groceries, transit, leisure, health, trips, savings withdrawals, an operating-to-savings transfer, pay rises and a change to income-based funding. The last month's second savings confirmation is pending. Two sample travel goals show joint-savings earmarks, one dated and one flexible. All amounts are integer euro cents.

Use **Settings → Sample household → Open sample household**, or append `?demo=1` to the app URL. Sample mode loads this file in memory, mounts no GitHub sync panel, does not access the household database or saved token, and resets on reload. The lazy sample chunk is precached for offline use. Return to your household using the banner link. Appearance remains a device preference; calculator scenarios in sample mode have a separate device key.

Do not upload this file to the real `family-data` repository. It is test data, not a backup to restore over your household. To use it in automated checks, load it with `upgradeHousehold`/`decodeHousehold`, then call `validateHousehold` before deriving reports.

Regenerate deterministically:

```sh
bash scripts/npm.sh exec -- tsx scripts/generate-demo.ts
```

Names, dates, amounts, IDs and descriptions are invented; no personal records or credentials are included.
