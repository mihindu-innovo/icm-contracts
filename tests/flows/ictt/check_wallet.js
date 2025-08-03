const { ethers } = require('ethers');

async function checkWallet() {
    const privateKey = '0x8a22131111b07684e5df85ef89ffd5350ce106115207c818a3bba12470744eb4';
    const wallet = new ethers.Wallet(privateKey);
    
    console.log(`Private key: ${privateKey}`);
    console.log(`Wallet address: ${wallet.address}`);
    
    // Check if this matches the signatory
    console.log(`Expected signatory: 0xD5b7DE57f5a0c6674E81Db906ccC1dDEC56d38e8`);
    console.log(`Do they match? ${wallet.address.toLowerCase() === '0xd5b7de57f5a0c6674e81db906ccc1ddec56d38e8'.toLowerCase()}`);
}

checkWallet(); 