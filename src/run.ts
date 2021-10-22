/*
Author: Ing. Luca Gian Scaringella
GitHub: LucaCode
Copyright(c) Ing. Luca Gian Scaringella
 */

import { BrokerServer } from "./lib/BrokerServer";
import { secrets } from "docker-secret";
import { LogLevel } from "./lib/Logger";

const variables = Object.assign({}, process.env, secrets);

process.title = `Ziron Broker`;

new BrokerServer({
  join:
    variables.JOIN != null
      ? variables.JOIN
      : `${variables.SECRET || ""}@${variables.STATE || ""}`,
  port: parseInt(variables.PORT) || 8888,
  path: variables.SERVER_PATH || "/",
  logLevel: parseInt(variables.LOG_LEVEL) || LogLevel.Everything,
})
  .joinAndListen()
  .catch(() => process.exit(1));
