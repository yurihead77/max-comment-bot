import { env } from "../../config/env";
import { parseAndVerifyMaxInitData } from "./max-initdata-verify";

export type { MaxAuthPayload } from "./max-initdata-verify";
export { MaxInitDataValidationError } from "./max-initdata-verify";

export function validateAndParseInitData(initData: string) {
  return parseAndVerifyMaxInitData(initData, env.MAX_BOT_TOKEN);
}
