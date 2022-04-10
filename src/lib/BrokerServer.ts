/*
Author: Ing. Luca Gian Scaringella
GitHub: LucaCode
Copyright(c) Ing. Luca Gian Scaringella
 */

import BrokerServerOptions from "./BrokerServerOptions";
import Logger, { LogLevel } from "./Logger";
import * as Http from "http";
import { Block, Server } from "ziron-server";
import { Socket } from "ziron-client";
import { address } from "ip";
import { buildOptions } from "./Object";

const CLUSTER_VERSION = 1;

export class BrokerServer {
  private readonly _options: Required<BrokerServerOptions> = {
    join: null,
    logLevel: LogLevel.Everything,
    port: 8888,
    path: "/",
  };

  private readonly _logger: Logger;
  private readonly _joinSecret: string;
  private readonly _joinUri: string;

  private readonly _httpServer: Http.Server;
  private readonly _server: Server;
  private _stateSocket: Socket;

  constructor(options: BrokerServerOptions = {}) {
    this._options = buildOptions(this._options, options);

    this._logger = new Logger(this._options.logLevel);
    this._logger.logBusy("Launching broker server...");

    const joinToken = this._options.join || "";
    const joinTokenIndexOfAt = joinToken.indexOf("@");
    if (joinTokenIndexOfAt === -1) {
      this._joinSecret = "";
      this._joinUri = joinToken;
    } else {
      this._joinSecret = joinToken.substring(0, joinTokenIndexOfAt);
      this._joinUri = joinToken.substring(joinTokenIndexOfAt + 1);
    }

    this._options.path =
      this._options.path === "" || this._options.path === "/"
        ? ""
        : !this._options.path.startsWith("/")
        ? "/" + this._options.path
        : this._options.path;

    this._httpServer = Http.createServer();
    this._server = new Server({
      port: this._options.port,
      pingInterval: 4000,
      allowClientPublish: true,
      socketChannelLimit: null,
      publishToPublisher: false,
    });
    this._initServer();
  }

  public async joinAndListen() {
    try {
      await this._server.listen();
      await this.joinCluster();
      this._logger.logActive(
        `The Broker server launched successfully on the port: ${this._options.port} and joined the cluster.`
      );
    } catch (err) {
      this._logger.logError("The broker could not launch: " + err.message);
      throw err;
    }
  }

  private _initServer() {
    this._server.upgradeMiddleware = (req) => {
      const attachment = req.attachment;

      if (typeof attachment !== "object")
        throw new Block(400, "Invalid attachment structure");

      if (attachment.secret !== this._joinSecret)
        throw new Block(403, "Permission denied");

      if (attachment.clusterVersion !== CLUSTER_VERSION)
        throw new Block(412, "Incompatible cluster versions");
    };
  }

  private async joinCluster() {
    this._stateSocket = new Socket(this._joinUri, {
      responseTimeout: 3000,
      connectTimeout: 3000,
      autoReconnect: {
        active: true,
        initialDelay: 1000,
        randomness: 1000,
        multiplier: 1,
        maxDelay: 2000,
      },
      handshakeAttachment: {
        secret: this._joinSecret,
        clusterVersion: CLUSTER_VERSION,
        node: {
          id: this._server.id,
          type: 1,
          ip: address(),
          port: this._options.port,
          path: this._options.path,
        },
      },
    });
    this._stateSocket.on("error", (err) => {
      this._logger.logError("Error in state socket: " + err.stack);
    });

    let invokeJoinRetryTicker;
    const invokeJoin = async () => {
      try {
        await this._stateSocket.invoke("#join");
      } catch (e) {
        if (!this._stateSocket.isConnected()) return;
        invokeJoinRetryTicker = setTimeout(invokeJoin, 2000);
      }
    };
    this._stateSocket.on("connect", () => {
      clearTimeout(invokeJoinRetryTicker);
      invokeJoin();
    });
    await this._stateSocket.connect();
  }

  /**
   * Terminates the broker.
   * After termination, you should not use this instance anymore
   * or anything else from the broker.
   * [Use this method only when you know what you do.]
   */
  terminate() {
    this._server.terminate();
    this._stateSocket?.disconnect();
  }
}
