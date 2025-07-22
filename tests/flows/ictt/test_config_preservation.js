const fs = require('fs');
const path = require('path');

// Test script to verify gasless config preservation
function testConfigPreservation() {
    const configPath = path.join(__dirname, 'gasless_config.json');
    const backupPath = path.join(__dirname, 'gasless_config.backup.json');
    
    console.log('Testing gasless config preservation...');
    
    // Check if config file exists
    if (!fs.existsSync(configPath)) {
        console.log('❌ gasless_config.json not found');
        return false;
    }
    
    // Check if backup file exists
    if (!fs.existsSync(backupPath)) {
        console.log('❌ Backup file not found');
        return false;
    }
    
    // Read both files
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    console.log('✅ Config files found');
    
    // Check required fields in current config
    const requiredFields = [
        'avaCloudRelayerAccount',
        'avaCloudRegistryContract', 
        'avaCloudTeleporterContract',
        'avaCloudForwarder',
        'erc20HomeAddress',
        'erc20RemoteAddress',
        'erc20TokenAddress',
        'avaCloudRpcUrl',
        'avaCloudAuth',
        'avaCloudDomain',
        'avaCloudVersion',
        'avaCloudRequestType',
        'avaCloudRequestSuffix',
        'homeRpcUrl',
        'remoteRpcUrl',
        'cChainBlockchainID',
        'innovomarkBlockchainID',
        'networkConfig',
        'contracts',
        'gaslessConfig',
        'deploymentInfo'
    ];
    
    let allFieldsPresent = true;
    for (const field of requiredFields) {
        if (!(field in config)) {
            console.log(`❌ Missing required field: ${field}`);
            allFieldsPresent = false;
        }
    }
    
    if (allFieldsPresent) {
        console.log('✅ All required fields present in current config');
    }
    
    // Check if contract addresses are not placeholders
    const contractAddresses = [
        config.erc20HomeAddress,
        config.erc20RemoteAddress,
        config.contracts?.home?.erc20Home,
        config.contracts?.remote?.erc20Remote
    ];
    
    let addressesValid = true;
    for (const address of contractAddresses) {
        if (!address || address === 'PLACEHOLDER_HOME_ADDRESS' || address === 'PLACEHOLDER_REMOTE_ADDRESS') {
            console.log(`❌ Invalid contract address: ${address}`);
            addressesValid = false;
        }
    }
    
    if (addressesValid) {
        console.log('✅ Contract addresses are valid (not placeholders)');
    }
    
    // Check deployment info
    if (config.deploymentInfo?.deploymentDate && config.deploymentInfo.deploymentDate !== 'PLACEHOLDER_DATE') {
        console.log('✅ Deployment info is properly set');
    } else {
        console.log('❌ Deployment info not properly set');
    }
    
    console.log('\n📊 Config Summary:');
    console.log(`   Home Contract: ${config.erc20HomeAddress}`);
    console.log(`   Remote Contract: ${config.erc20RemoteAddress}`);
    console.log(`   Token Contract: ${config.erc20TokenAddress}`);
    console.log(`   Forwarder: ${config.avaCloudForwarder}`);
    console.log(`   Relayer Account: ${config.avaCloudRelayerAccount}`);
    console.log(`   Deployment Date: ${config.deploymentInfo?.deploymentDate}`);
    
    return allFieldsPresent && addressesValid;
}

// Run the test
if (require.main === module) {
    const success = testConfigPreservation();
    process.exit(success ? 0 : 1);
}

module.exports = { testConfigPreservation }; 