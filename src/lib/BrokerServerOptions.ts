/*
Author: Ing. Luca Gian Scaringella
GitHub: LucaCode
Copyright(c) Ing. Luca Gian Scaringella
 */

import { LogLevel } from "./Logger";

export default interface BrokerServerOptions {
  join?: string | null;
  logLevel?: LogLevel;
  port?: number;
  path?: string;
}
