/*
Author: Luca Scaringella
GitHub: LucaCode
Copyright(c) Luca Scaringella
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
  path: variables.PATH || "/",
  logLevel: parseInt(variables.LOG_LEVEL) || LogLevel.Everything,
}).joinAndListen();
