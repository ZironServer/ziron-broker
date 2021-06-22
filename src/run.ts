/*
Author: Luca Scaringella
GitHub: LucaCode
Copyright(c) Luca Scaringella
 */

import {BrokerServer} from "./lib/BrokerServer";
import { secrets } from "docker-secret";

process.title = `Ziron Broker`;
new BrokerServer({
    join: secrets.JOIN || process.env.JOIN
});