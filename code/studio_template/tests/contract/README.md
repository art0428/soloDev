# 契約測試

三層，由快到慢：

| 層 | 工具 | 什麼時候跑 | 指令 |
|---|---|---|---|
| 格式 | Redocly CLI | 改契約就跑；pre-commit、check.yml | `pnpm openapi:lint` |
| 回應符合契約 | openapi-response-validator（在後端測試裡） | 後端整套測試的一部分 | `pnpm --filter backend run test`（`src/test/contract.test.ts`） |
| 模糊測試 | schemathesis | 步 4、夜間守衛、上線前 | `bash tests/contract/run-schemathesis.sh <API 網址>` |

新端點要做三件事：寫進 `api/openapi.yaml`；在 `backend/src/test/contract.test.ts` 的 CASES 加至少一列；有路徑參數的在 `st-prepare-data.ts` 補一行（給個固定值讓端點穩定回 404 即可，否則 schemathesis 會用「Too many generated examples are filtered out」這種看起來無關的錯誤擋下來）。

schemathesis 需要 Python。沒裝就用 `pipx install schemathesis` 或 `uv tool install schemathesis`。
