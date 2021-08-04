/*
Author: Luca Scaringella
GitHub: LucaCode
Copyright(c) Luca Scaringella
 */

import { LogLevel } from "./Logger";

export default interface BrokerServerOptions {
  join?: string | null;
  logLevel?: LogLevel;
  port?: number;
  path?: string;
}
