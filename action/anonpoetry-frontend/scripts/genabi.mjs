import fs from "fs";
import path from "path";

const HARDHAT_DEPLOY = path.resolve(
  process.cwd(),
  "../anonpoetry-hardhat/deployments/localhost/AnonPoetry.json"
);
const OUT_ABI = path.resolve(process.cwd(), "./abi/AnonPoetry.ts");

function main() {
  const json = JSON.parse(fs.readFileSync(HARDHAT_DEPLOY, "utf8"));
  const abi = json.abi;
  const addr = json.address;
  const code = `export const ABI = ${JSON.stringify(abi, null, 2)} as const;\nexport const ADDR = "${addr}";\n`;
  fs.writeFileSync(OUT_ABI, code, "utf8");
  console.log("Generated ABI & address at:", OUT_ABI);
}

main();




