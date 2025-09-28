import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, getOrNull } = hre.deployments;

  const existing = await getOrNull("AnonPoetry");
  if (!existing) {
    const deployed = await deploy("AnonPoetry", {
      from: deployer,
      log: true,
    });
    console.log(`AnonPoetry deployed at: ${deployed.address}`);
  } else {
    console.log(`AnonPoetry already deployed at: ${existing.address}`);
  }
};

export default func;
func.id = "deploy_anonpoetry";
func.tags = ["AnonPoetry"];




