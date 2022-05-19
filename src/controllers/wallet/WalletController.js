import Web3 from 'web3/dist/web3.min';

export const getWalletType = (blockchain) => {
	switch (blockchain) {
		case 'rinkeby':
		case 'ethereum':
		case 'mumbai':
		case 'polygon':
			return 'metamask';
		case 'solanadevnet':
		case 'solana':
			return 'phantom';
		default:
			throw new Error('Blockchain tye not supported!');
	}
};

/**
 *
 * @property wallet - Wallet type, can be phantom or metamask
 * @property network - hex chain ID of network. Currently only for Metamask
 */

/**
 * Controller responsible for handling wallet state
 */
export class WalletController {

	/**
	 * Creates a WalletController instance
	 */
	constructor() {
		const walletState = {
			wallet: '',
			network: '',
			address: ''
		};

		this.state = walletState;
	}

	/**
	 * Compare current network with target network and switches if it doesn't match
	 *
	 * @param targetNetwork - Network name to switch to
	 * @param callback - callback function
	 *
	 * @TODO currently only works for ethereum
	 */
	async compareNetwork(targetNetwork, callback = null) {
		const { setNetwork, getNetworkID } = this;

		if (targetNetwork.indexOf('solana') != -1) {
			if (callback != null) callback();
			return;
		}
		let target = targetNetwork;
		if (targetNetwork.indexOf('x') === -1) {
			if (targetNetwork === 'ethereum') target = '0x1';
			else if (targetNetwork === 'rinkeby') target = '0x4';
			else if (targetNetwork === 'polygon') target = '0x89';
			else if (targetNetwork === 'mumbai') target = '0x13881';
		}
		const curNetwork = getNetworkID();
		if (curNetwork !== target) {
			const status = await setNetwork(target);
			if (status === 'prompt_successful' && callback != null) callback();
			else if (status === 'prompt_canceled') {
				throw new Error('User canceled switching networks');
			}
		} else {
			if (callback != null) callback();
		}
	};

	/**
	 * Get current network. Returns hex chain ID
	 */
	async getNetworkID() {
		console.log(this)
		if (this.state.wallet == 'phantom') return 'solana';
		return `0x${parseInt(window.ethereum.networkVersion).toString(16)}`;
	};

	/**
	 * Set current network based on ID
	 *
	 * @param networkID - Ethereum hex chain ID according to metamask docs
	 * https://docs.metamask.io/guide/ethereum-provider.html#basic-usage
	 *
	 * This function only supports Ethereum
	 */
	async setNetwork(networkID) {
		return window.ethereum
			.request({
				method: 'wallet_switchEthereumChain',
				params: [{ chainId: networkID }],
			})
			.then(() => {
				return 'prompt_successful';
			})
			.catch(async (err) => {
				if (err.code === 4001) {
					// User canceled prompt
					return 'prompt_canceled';
				} else if (err.code === 4902) {
					// Unrecognized chain ID
					let networkData = {
						chainId: '',
						chainName: '',
						nativeCurrency: {
							name: '',
							symbol: '',
							decimals: -1,
						},
						rpcUrls: [],
						blockExplorerUrls: [],
					};

					networkData.chainId = networkID;

					if (networkID === '0x89') {
						// Polygon
						networkData.rpcUrls.push('https://polygon-rpc.com');
						networkData.chainName = 'Polygon Mainnet (Matic)';
						networkData.nativeCurrency.name = 'Polygon';
						networkData.nativeCurrency.symbol = 'MATIC';
						networkData.nativeCurrency.decimals = 18;
						networkData.blockExplorerUrls.push(
							'https://polygonscan.com'
						);
					} else if (networkID === '0x13881') {
						// Polygon Mumbai Testnet
						networkData.rpcUrls.push(
							'https://rpc-mumbai.maticvigil.com'
						);
						networkData.chainName = 'Polygon Mumbai Testnet';
						networkData.nativeCurrency.name = 'Mumbai';
						networkData.nativeCurrency.symbol = 'MATIC';
						networkData.nativeCurrency.decimals = 18;
						networkData.blockExplorerUrls.push(
							'https://mumbai.polygonscan.com'
						);
					}

					await window.ethereum.request({
						method: 'wallet_addEthereumChain',
						params: [networkData],
					});

					return 'prompt_successful';
				}
				return 'prompt_canceled';
			});
	};

	/**
	 * Initializes connection to Metamask or Phantom
	 *
	 * @param walletType - Wallet provider to load, can be either metamask or phantom
	 */
	async loadWalletProvider(walletType) {
		try {
			if (walletType === 'metamask') {
				if (
					typeof window.ethereum === 'undefined' ||
					typeof window.web3 === 'undefined'
				) {
					throw new Error('Metamask is not installed');
				}

				window.web3 = new Web3(window.ethereum) || new Web3(window.web3.currentProvider);
				const accounts = await window.web3.eth.getAccounts();

				// Return and set address
				this.state.address = accounts[0];
				return accounts[0];
			} else if (walletType === 'phantom') {
				const provider = window.solana;
				if (!provider?.isPhantom) {
					throw new Error('Phantom is not installed');
				}
				const sol = await window.solana.connect();

				// Return and set address
				this.state.address = sol.publicKey.toString();
				return sol.publicKey.toString();
			} else {
				throw new Error('Wallet not supported')
			}
		} catch (err) {
			throw new Error(err.message)
		}
	};
}
