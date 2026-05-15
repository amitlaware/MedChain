import { getContract } from "./gateway.js";

function parseTransactionResult(buffer) {
  const text = buffer.toString("utf8");

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function submitTransaction(functionName, ...args) {
  const { gateway, contract } = await getContract();

  try {
    const result = await contract.submitTransaction(functionName, ...args.map(String));
    return parseTransactionResult(result);
  } catch (error) {
    console.error(`Error in submitTransaction (${functionName}):`, error.message);
    if (error.responses) {
      console.error("Peer responses:", JSON.stringify(error.responses));
    }
    throw error;
  } finally {
    gateway.disconnect();
  }
}

export async function evaluateTransaction(functionName, ...args) {
  const { gateway, contract } = await getContract();

  try {
    const result = await contract.evaluateTransaction(functionName, ...args.map(String));
    return parseTransactionResult(result);
  } finally {
    gateway.disconnect();
  }
}
