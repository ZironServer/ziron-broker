/*
Author: Luca Scaringella
GitHub: LucaCode
Copyright(c) Luca Scaringella
 */

import { BrokerServer } from "./lib/BrokerServer";
import { secrets } from "docker-secret";

const variables = Object.assign({}, process.env, secrets);

process.title = `Ziron Broker`;

new BrokerServer({
  join:
    variables.JOIN != null
      ? variables.JOIN
      : `${variables.SECRET || ""}@${variables.STATE || ""}`,
}).joinAndListen();
