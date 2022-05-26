/*
Author: Ing. Luca Gian Scaringella
GitHub: LucaCode
Copyright(c) Ing. Luca Gian Scaringella
 */

import BrokerServerOptions from "./BrokerServerOptions";
import Logger, { LogLevel } from "./Logger";
import {
  applyStandaloneProcedures, applyStandaloneReceivers,
  Block, FailedToListenError,
  Server,
} from "ziron-server";
import { Socket as ClientSocket } from "ziron-client";
import { address } from "ip";
import { buildOptions } from "./Object";
import {StandaloneProcedures} from "ziron-server/dist/lib/Procedure";
import {StandaloneReceivers} from "ziron-server/dist/lib/Receiver";
import {Writable} from "./Utils";

const CLUSTER_VERSION = 1;

export class BrokerServer {

  get id() {return this.server.id;}

  readonly stateId?: string;

  private readonly _options: Required<BrokerServerOptions> = {
    join: null,
    logLevel: LogLevel.Everything,
    port: 8888,
    path: "/",
  };

  private readonly _logger: Logger;
  private readonly _joinSecret: string;
  private readonly _joinUri: string;

  /**
   * @description
   * Use the server object carefully.
   * Never change properties on the server; use it only to access state information.
   * @protected
   */
  readonly server: Server;
  private _stateSocket: ClientSocket;
  
  public readonly procedures: StandaloneProcedures = {};
  public readonly receivers: StandaloneReceivers = {};

  constructor(options: BrokerServerOptions = {}) {
    this._options = buildOptions(this._options, options);

    this._logger = new Logger(this._options.logLevel);

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

    this.server = new Server({
      port: this._options.port,
      pingInterval: 4000,
      allowClientPublish: true,
      socketChannelLimit: null,
      publishToPublisher: false,
    });
    this._initServer();
  }

  isConnectedToState(): boolean {
    return this._stateSocket?.isConnected();
  }

  protected async listen() {
    if(this.server.isListening()) return;
    try {
      this._logger.logBusy("Launching broker server...");
      await this.server.listen();
      this._logger.logActive(`Broker server launched successfully on port: ${this._options.port}.`);
    }
    catch (err) {
      if(err instanceof FailedToListenError)
        this._logger.logFailed(`Failed to listen on port: ${this._options.port}. Maybe the port is already in use.`);
      throw err;
    }
  }

  public async listenAndJoin() {
    await this.listen();
    await this.join();
  }

  private _initServer() {
    this.server.upgradeMiddleware = (req) => {
      const attachment = req.attachment;

      if (typeof attachment !== "object")
        throw new Block(400, "Invalid attachment structure");

      if (attachment.secret !== this._joinSecret)
        throw new Block(403, "Permission denied");

      if (attachment.clusterVersion !== CLUSTER_VERSION)
        throw new Block(412, "Incompatible cluster versions");
    };
    this.server.connectionHandler = socket => {
      applyStandaloneProcedures(socket,this.procedures);
      applyStandaloneReceivers(socket,this.receivers);
      return this.id;
    };
  }

  /**
   * Starts joining the cluster.
   * Returns a promise that will be fulfilled when the broker has joined for the first time.
   * Notice that the broker will automatically retry rejoining in case of disconnections.
   * @protected
   */
  protected async join() {
    if(!this.server.isListening()) throw new Error("The broker needs to listen before joining a cluster.");
    if(this._stateSocket) throw new Error("Join should only be invoked once. " +
        "The server will automatically retry to rejoin the cluster in case of disconnection.");

    let initJoined = false;

    let initJoinResolve: () => void;
    let initJoinReject: (err: Error) => void;
    const initJoin: Promise<void> = new Promise((res, rej) => {
      initJoinResolve = res;
      initJoinReject = rej;
    });

    this._stateSocket = new ClientSocket(this._joinUri, {
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
          id: this.server.id,
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
        this._logger.logInfo(`Broker has ${initJoined? "re" : ""}joined the cluster.`);
        initJoined = true;
        initJoinResolve();
      } catch (e) {
        if(e) {
          initJoinReject!(e);
          if(e.name === "IdAlreadyUsedInClusterError")
            this._logger.logWarning(`Attempt to join the cluster failed, the server-id: "${this.server.id}" already exists in the cluster.`);
          else if(e.stack) this._logger.logError(`Attempt to join the cluster failed: ${e.stack}.`);
        }
        if (!this._stateSocket.isConnected()) return;
        invokeJoinRetryTicker = setTimeout(invokeJoin, 2000);
      }
    };
    this._stateSocket.on("disconnect", () => {
      (this as Writable<BrokerServer>).stateId = undefined;
    });
    this._stateSocket.on("connect", (stateId: string) => {
      if(stateId) (this as Writable<BrokerServer>).stateId = stateId;
      clearTimeout(invokeJoinRetryTicker);
      invokeJoin();
    });
    this._stateSocket.connect().catch((err) => {
      initJoinReject!(err);
      this._logger.logError(`Attempt to join the cluster failed: ${err.stack}.`);
    })
    return initJoin;
  }

  /**
   * Terminates the broker.
   * After termination, you should not use this instance anymore
   * or anything else from the broker.
   * [Use this method only when you know what you do.]
   */
  terminate() {
    this.server.terminate();
    this._stateSocket?.disconnect();
  }
}
