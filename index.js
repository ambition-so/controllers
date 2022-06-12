export * from './src/controllers/contract/ContractController';
export * from './src/controllers/wallet/WalletController';

// @type: 'ethereum' | 'solana'
export const windowInstance = (type) => {
    if (type === 'ethereum') {
        return (window?.ethereum && window?.web3) ? window : parent.window;
    }
    return window?.solana ? window : parent.window;
}