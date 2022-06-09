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

const walletDefaultState = {
	wallet: null, // 'phantom' | 'metamask'  
	address: null,
	network: null
}

/**
 * Controller responsible for handling wallet state
 */
export class WalletController {

	/**
	 * Creates a WalletController instance
	 */
	constructor() {
		this.state = walletDefaultState;
	}

	/**
	 * Compare current network with target network and switches if it doesn't match
	 *
	 * @param targetNetwork - Network name to switch to
	 * @param callback - callback function
	 *
	 * @TODO currently only works for ethereum
	 */
	async compareNetwork(targetNetwork, callback) {
		try {
			if (targetNetwork.indexOf('solana') !== -1) {
				callback();
				return;
			}

			let target = targetNetwork;
			if (targetNetwork.indexOf('x') === -1) {
				if (targetNetwork === 'ethereum') target = '0x1';
				else if (targetNetwork === 'rinkeby') target = '0x4';
				else if (targetNetwork === 'polygon') target = '0x89';
				else if (targetNetwork === 'mumbai') target = '0x13881';
			}

			const walletType = getWalletType(targetNetwork);
			const curNetwork = this.getNetworkID(walletType);
			
			if (curNetwork !== target) {
				const status = await this.setNetwork(target);
				if (status === 'prompt_successful') callback();
				else if (status === 'prompt_canceled') {
					callback(new Error('User canceled switching networks'));
				}
			} else {
				callback();
			}
		} catch (e) {
			callback(e);
		}
	};

	/**
	 * Get current network. Returns hex chain ID
	 */
	getNetworkID(walletType = this.state.wallet) {
		console.log(walletType, 'getNetworkID');
		switch (walletType) {
			case 'phantom':
				return 'solana';
			case 'metamask':
				return `0x${parseInt(parent.window.ethereum.networkVersion).toString(16)}`;
			default:
				this.handleError(new Error('Wallet not supported'));
				return null;
		}
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
		return parent.window.ethereum
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

					await parent.window.ethereum.request({
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
		console.log(walletType, 'loadWalletProvider DUDE!');

		try {
			switch (walletType) {
				case 'phantom': {
					const provider = parent.window.solana;
					if (!provider?.isPhantom) {
						throw new Error('Phantom is not installed');
					}
					const sol = await parent.window.solana.connect();
					const walletAddress = sol.publicKey.toString();

					// Return and set address
					this.state.address = walletAddress;
					this.state.wallet = walletType;

					console.log(this.state);
					return walletAddress;
				}
				case 'metamask': {
					if (typeof parent.window.ethereum === 'undefined' || typeof parent.window.web3 === 'undefined') {
						throw new Error('Metamask is not installed');
					}

					parent.window.web3 = new Web3(parent.window.ethereum) || new Web3(parent.window.web3.currentProvider);
					const accounts = await parent.window.web3.eth.getAccounts();
					const walletAddress = accounts[0];

					if (parent.window.ethereum) {
						parent.window.ethereum.on("accountsChanged", (accounts => {
							this.state.address = accounts[0];
						}));
						await parent.window.ethereum.enable();
					}

					// Return and set address
					this.state.address = walletAddress;
					this.state.wallet = walletType;
					console.log(this.state);
					return walletAddress;
				}
				default:
					throw new Error('Wallet not supported');
			}
		} catch (e) {
			this.handleError(e);
		}
	};

	async signNonce(walletType, nonce, address = '') {
		try {
			const message = `I am signing my one-time nonce: ${nonce}`;

			switch (walletType) {
				case 'metamask':
					return parent.window.web3.eth.personal.sign(parent.window.web3.utils.fromUtf8(message), address);
				case 'phantom':
					const encodedMessage = new TextEncoder().encode(message);
					return parent.window.solana.request({ method: 'signMessage', params: { message: encodedMessage } });
				default:
					throw new Error('Wallet not supported');
			}
		} catch (e) {
			this.handleError(e);
		}
	};

	getState() {
		return this.state;
	}

	handleError(error) {
		console.log("Wallet controller Error!", error);
		this.state = walletDefaultState;
	}
}