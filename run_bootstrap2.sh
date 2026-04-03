#!/bin/bash
export PATH="/mnt/d/medchain-v2-with-network/fabric-samples/bin:$PATH"
export FABRIC_CFG_PATH="/mnt/d/medchain-v2-with-network/fabric-samples/config"
cd /mnt/d/medchain-v2-with-network/blockchain
rm -f ~/.docker/config.json
echo '{"credsStore":""}' > ~/.docker/config.json
bash ./scripts/bootstrap.sh
