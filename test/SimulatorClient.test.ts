import { SimulatorClient } from "../src/client/SimulatorClient";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { SimulationDataManager } from "../src/interface/SimulationDataManager";
import { SQLiteSimulationDataManager } from "../src/manager/SQLiteSimulationDataManager";
import { FeeAmount } from "../src/enum/FeeAmount";
import { PoolConfig } from "../src/model/PoolConfig";
import { ConfigurableCorePool as IConfigurableCorePool } from "../src/interface/ConfigurableCorePool";
import { ConfigurableCorePool } from "../src/core/ConfigurableCorePool";
import JSBI from "jsbi";
import { EndBlockTypeWhenRecover } from "../src/entity/EndBlockType";
import { exists, get10pow, TickMath, toBN } from "../src";
import { ZERO } from "../src/enum/InternalConstants";
import fs from "fs";
import { BigNumber as BN } from "ethers";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Test SimulatorClient v2", function () {
  it.only("can download or update events and build the core pool at any block tag", async function () {
    let simulationDataManager: SimulationDataManager =
      await SQLiteSimulationDataManager.buildInstance();
    let clientInstance = new SimulatorClient(simulationDataManager);

    let poolName = "events0119";
    // case 1
    // 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8
    // 12374077
    // case 2
    // 0x92560C178cE069CC014138eD3C2F5221Ba71f58a
    // 13578943

    // lowercase
    let poolAddress = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";
    let endBlock: EndBlockTypeWhenRecover = "latestOnChain";
    // Your customed RPCProviderUrl, or use config in tuner.config.js
    let RPCProviderUrl: string | undefined = undefined;

    if (!exists(`${poolName}_${poolAddress}.db`)) {
      await clientInstance.initCorePoolFromMainnet(
        poolName,
        poolAddress,
        "afterDeployment",
        RPCProviderUrl
      );
    }

    let configurableCorePool =
      await clientInstance.recoverFromMainnetEventDBFile(
        `${poolName}_${poolAddress}.db`,
        endBlock,
        RPCProviderUrl
      );
    console.log(`tick: ${configurableCorePool.getCorePool().tickCurrent}`);
    console.log(
      `sqrtPriceX96: ${configurableCorePool
        .getCorePool()
        .sqrtPriceX96.toString()}`
    );

    // let ticks = configurableCorePool.getCorePool().tickManager.sortedTicks;

    // // count: 29475 of legal available tick index between MIN_TICK and MAX_TICK
    // function findAvailableTicks(): number[] {
    //   let minTick = -887220; //-887220;
    //   let maxTick = 887220; //887220;
    //   let ticks: number[] = [];
    //   let currTick = minTick;
    //   while (currTick <= maxTick) {
    //     ticks.push(currTick);
    //     currTick += 60;
    //   }
    //   return ticks;
    // }
    // function sqrtPriceToView(sqrtPriceX96: BN): BN {
    //   return get10pow(12).div(sqrtPriceX96.pow(2).shr(96 * 2));
    // }

    // let availableTicks = findAvailableTicks();
    // let currentLiquidityNet = ZERO;
    // let dataPath = "ticksLiquidityNet.data";
    // let dataFile = fs.createWriteStream(dataPath, { flags: "w" });
    // for (let tickIndex of availableTicks) {
    //   if (ticks.has(tickIndex))
    //     currentLiquidityNet = JSBI.add(
    //       currentLiquidityNet,
    //       ticks.get(tickIndex)!.liquidityNet
    //     );
    //   console.log(TickMath.getSqrtRatioAtTick(tickIndex).toString());
    //   let currPrice = sqrtPriceToView(
    //     toBN(TickMath.getSqrtRatioAtTick(tickIndex))
    //   );
    //   console.log(currPrice.toString());

    //   dataFile.write(tickIndex + "\t" + currentLiquidityNet.toString() + "\n");
    // }

    await clientInstance.shutdown();
  });
});

describe("Test SimulatorClient static method", function () {
  it("can build instance", async function () {
    let simulationDataManager: SimulationDataManager =
      await SQLiteSimulationDataManager.buildInstance();
    let clientInstance = new SimulatorClient(simulationDataManager);
    expect(clientInstance).to.be.an.instanceOf(SimulatorClient);
    return expect(clientInstance.shutdown()).to.eventually.be.fulfilled;
  });

  it("can build PoolConfig", async function () {
    expect(
      new PoolConfig(60, "USDC", "ETH", FeeAmount.MEDIUM)
    ).to.be.an.instanceOf(PoolConfig);
  });
});

describe("Test SimulatorClient public method", function () {
  let clientInstance: SimulatorClient;

  beforeEach(async function () {
    let simulationDataManager: SimulationDataManager =
      await SQLiteSimulationDataManager.buildInstance();
    clientInstance = new SimulatorClient(simulationDataManager);
  });

  afterEach(async function () {
    await clientInstance.shutdown();
  });

  it("can build ConfigurableCorePool instance", async function () {
    let configurableCorePool: IConfigurableCorePool =
      clientInstance.initCorePoolFromConfig(
        new PoolConfig(60, "USDC", "ETH", FeeAmount.MEDIUM)
      );
    expect(configurableCorePool).to.be.an.instanceOf(ConfigurableCorePool);
  });

  describe("during simulation", function () {
    let configurableCorePool: IConfigurableCorePool;
    let sqrtPriceX96ForInitialization = JSBI.BigInt("4295128739");
    beforeEach(async function () {
      configurableCorePool = clientInstance.initCorePoolFromConfig(
        new PoolConfig(60, "USDC", "ETH", FeeAmount.MEDIUM)
      );
      await configurableCorePool.initialize(sqrtPriceX96ForInitialization);
    });

    it("can recover ConfigurableCorePool from a snapshot in persistence", async function () {
      let snapshotId = await configurableCorePool.persistSnapshot();
      let recoveredConfigurableCorePool =
        await clientInstance.recoverCorePoolFromSnapshot(snapshotId);
      expect(recoveredConfigurableCorePool).to.be.an.instanceOf(
        ConfigurableCorePool
      );
      expect(recoveredConfigurableCorePool.getCorePool().sqrtPriceX96).to.eql(
        sqrtPriceX96ForInitialization
      );
    });

    it("can list snapshot profiles", async function () {
      await configurableCorePool.persistSnapshot();
      return expect(
        clientInstance.listSnapshotProfiles()
      ).to.eventually.have.lengthOf(1);
    });
  });
});
