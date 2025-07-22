const fs = require('fs');
const path = require('path');

// Test script to verify deploy script preserves gasless config
function testDeployPreservation() {
    const configPath = path.join(__dirname, 'gasless_config.json');
    
    console.log('Testing deploy script config preservation...');
    
    // Check if config file exists
    if (!fs.existsSync(configPath)) {
        console.log('❌ gasless_config.json not found');
        return false;
    }
    
    // Read the config
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('✅ Config file found');
    
    // Check all required relayer fields
    const relayerFields = [
        'avaCloudRpcUrl',
        'avaCloudAuth',
        'avaCloudDomain', 
        'avaCloudVersion',
        'avaCloudRequestType',
        'avaCloudRequestSuffix'
    ];
    
    let allRelayerFieldsPresent = true;
    for (const field of relayerFields) {
        if (!(field in config)) {
            console.log(`❌ Missing relayer field: ${field}`);
            allRelayerFieldsPresent = false;
        }
    }
    
    if (allRelayerFieldsPresent) {
        console.log('✅ All relayer fields present');
    }
    
    // Check network configuration
    const networkFields = [
        'homeRpcUrl',
        'remoteRpcUrl', 
        'networkConfig',
        'cChainBlockchainID',
        'innovomarkBlockchainID'
    ];
    
    let allNetworkFieldsPresent = true;
    for (const field of networkFields) {
        if (!(field in config)) {
            console.log(`❌ Missing network field: ${field}`);
            allNetworkFieldsPresent = false;
        }
    }
    
    if (allNetworkFieldsPresent) {
        console.log('✅ All network fields present');
    }
    
    // Check contract addresses
    const contractFields = [
        'erc20HomeAddress',
        'erc20RemoteAddress',
        'erc20TokenAddress',
        'avaCloudForwarder',
        'avaCloudRelayerAccount',
        'avaCloudRegistryContract',
        'avaCloudTeleporterContract'
    ];
    
    let allContractFieldsPresent = true;
    for (const field of contractFields) {
        if (!(field in config)) {
            console.log(`❌ Missing contract field: ${field}`);
            allContractFieldsPresent = false;
        }
    }
    
    if (allContractFieldsPresent) {
        console.log('✅ All contract fields present');
    }
    
    // Check nested structures
    const nestedStructures = [
        'contracts.home',
        'contracts.remote',
        'networkConfig.home',
        'networkConfig.remote',
        'gaslessConfig',
        'deploymentInfo'
    ];
    
    let allNestedStructuresPresent = true;
    for (const structure of nestedStructures) {
        const parts = structure.split('.');
        let current = config;
        let exists = true;
        
        for (const part of parts) {
            if (!(part in current)) {
                console.log(`❌ Missing nested structure: ${structure}`);
                allNestedStructuresPresent = false;
                exists = false;
                break;
            }
            current = current[part];
        }
        
        if (exists && typeof current !== 'object') {
            console.log(`❌ Invalid nested structure: ${structure} (not an object)`);
            allNestedStructuresPresent = false;
        }
    }
    
    if (allNestedStructuresPresent) {
        console.log('✅ All nested structures present');
    }
    
    // Check for placeholder values
    const placeholderFields = [
        'erc20HomeAddress',
        'erc20RemoteAddress'
    ];
    
    let noPlaceholders = true;
    for (const field of placeholderFields) {
        const value = config[field];
        if (value && (value.includes('PLACEHOLDER') || value === '0x0000000000000000000000000000000000000000')) {
            console.log(`❌ Field still has placeholder value: ${field} = ${value}`);
            noPlaceholders = false;
        }
    }
    
    if (noPlaceholders) {
        console.log('✅ No placeholder values found');
    }
    
    console.log('\n📊 Config Summary:');
    console.log(`   Relayer URL: ${config.avaCloudRpcUrl}`);
    console.log(`   Domain: ${config.avaCloudDomain}`);
    console.log(`   Version: ${config.avaCloudVersion}`);
    console.log(`   Request Type: ${config.avaCloudRequestType}`);
    console.log(`   Request Suffix: ${config.avaCloudRequestSuffix}`);
    console.log(`   Home RPC: ${config.homeRpcUrl}`);
    console.log(`   Remote RPC: ${config.remoteRpcUrl}`);
    console.log(`   Home Contract: ${config.erc20HomeAddress}`);
    console.log(`   Remote Contract: ${config.erc20RemoteAddress}`);
    console.log(`   Forwarder: ${config.avaCloudForwarder}`);
    
    const success = allRelayerFieldsPresent && allNetworkFieldsPresent && allContractFieldsPresent && allNestedStructuresPresent && noPlaceholders;
    
    if (success) {
        console.log('\n✅ All tests passed - config is complete and properly preserved');
    } else {
        console.log('\n❌ Some tests failed - config may be incomplete');
    }
    
    return success;
}

// Run the test
if (require.main === module) {
    const success = testDeployPreservation();
    process.exit(success ? 0 : 1);
}

module.exports = { testDeployPreservation }; 