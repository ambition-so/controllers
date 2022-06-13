import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { mintV2 } from '../../solana/helpers/mint';
import ERC721 from '../../abis/ambitionNFTPresale.json';
import ERC721a from '../../abis/AmbitionCreatorImpl.json';
import ProxyERC721aTestnet from '../../abis/AmbitionERC721ATestnet.json';
import ProxyERC721a from '../../abis/AmbitionERC721A.json';

import { windowInstance } from '../../../index';

export const getResolvedImageUrl = async (metadataUrl) => {
	try {
		const ipfsUrl = getIpfsUrl(undefined, true);
		let metadataUrlHash = null;

		if (metadataUrl?.indexOf('ipfs://') !== -1) {
			metadataUrlHash = `${ipfsUrl}${metadataUrl?.split('ipfs://')[1]}/1.json`;
		} else {
			metadataUrlHash = `${metadataUrl}/1.json`;
		}

		if (!metadataUrlHash) {
			throw new Error('Invalid metadataurl');
		}

		if (metadataUrlHash.indexOf('//1.json') !== -1) {
			metadataUrlHash = metadataUrlHash.replace('//1.json', '/1.json');
		}

		const fetchResponse = await fetch(metadataUrlHash);
		const json = await fetchResponse.json();

		if (!json?.image) {
			throw new Error('image field missing!');
		}

		const baseUri = json?.image?.indexOf('ipfs://') !== -1 ? json?.image?.split('ipfs://') : null;
		const imageSrc = baseUri && ipfsUrl && `${ipfsUrl}${baseUri[1]}` || json?.image;

		return imageSrc;
	} catch (e) {
		console.log('Error fetchImageSrc:', e);
		return null;
	}
}

export const getIpfsUrl = (blockchain, getCloudGatewayUrl) => (blockchain === 'solana' || blockchain === 'solanadevnet' || getCloudGatewayUrl) && `https://gateway.pinata.cloud/ipfs/` || `ipfs://`;

export const getMerkleTreeRoot = (addresses) => {
	const leafNodes = addresses.map((addr) => keccak256(addr));
	const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
	const root = merkleTree.getRoot();
	return root;
}

/**
 * Determine Blockchain Currency
 */
export const getBlockchainChainId = (blockchain) => {
	switch (blockchain) {
		case 'rinkeby':
			return '0x4';
		case 'ethereum':
			return '0x1';
		case 'mumbai':
			return '0x13881';
		case 'polygon':
			return '0x89';
		case 'solanadevnet':
			return 'solanadevnet';
		case 'solana':
			return 'solana';
		default:
			throw new Error('Blockchain tye not supported!');
	}
}

/**
 * Determine Blockchain Currency
 */
export const getBlockchainCurrencyByChainId = (chainId) => {
	switch (chainId) {
		case '0x89':
		case '0x13881':
		case '89':
		case '13881':
			return 'MATIC';
		case '0x1':
		case '0x4':
		case '1':
		case '4':
			return 'ETH';
		case 'solana':
		case 'solanadevnet':
			return 'SOL';
		default:
			throw new Error('Blockchain tye not supported!');
	}
}

/**
 * Determine Blockchain 
 */
export const getBlockchainByChainId = (chainId) => {
	switch (chainId) {
		case '0x89':
		case '89':
			return 'polygon';
		case '0x13881':
		case '13881':
			return 'mumbai';
		case '0x1':
		case '1':
			return 'ethereum';
		case '0x4':
		case '4':
			return 'rinkeby';
		case 'solana':
			return 'solana';
		case 'solanadevnet':
			return 'solanadevnet';
		default:
			throw new Error('Blockchain tye not supported!');
	}
}

/**
 * Determine Blockchain Currency
 * 
 * @ input: 
 */
export const getBlockchainCurrency = (blockchain) => {
	switch (blockchain) {
		case 'rinkeby':
		case 'ethereum':
			return 'ETH';
		case 'mumbai':
		case 'polygon':
			return 'MATIC';
		case 'solanadevnet':
		case 'solana':
			return 'SOL';
		default:
			throw new Error('Blockchain tye not supported!');
	}
}

/**
 * Determine Blockchain Type is testnet
 */
export const isTestnetBlockchain = (blockchain) => {
	switch (blockchain) {
		case 'rinkeby':
		case 'mumbai':
		case 'solanadevnet':
			return true;
		default:
			return false;
	}
}

/**
 * Determine Blockchain Type if testnet is enabled
 */
export const getBlockchainType = (blockchain, isTestnet = false) => {
	switch (blockchain) {
		case 'ethereum':
			return isTestnet && 'rinkeby' || 'ethereum';
		case 'polygon':
			return isTestnet && 'mumbai' || 'polygon';
		case 'solana':
			return isTestnet && 'solanadevnet' || 'solana';
		default:
			throw new Error('Blockchain tye not supported!');
	}
}

/**
 * Determine Blockchain Type
 */
export const getMainnetBlockchainType = (blockchain) => {
	switch (blockchain) {
		case 'ethereum':
		case 'rinkeby':
			return 'ethereum';
		case 'polygon':
		case 'mumbai':
			return 'polygon';
		case 'solana':
		case 'solanadevnet':
			return 'solana';
		default:
			throw new Error('Blockchain tye not supported!');
	}
}

/**
 * Compare array buffers
 */
const compare = (a, b) => {
	for (let i = a.length; -1 < i; i -= 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/**
 * Determine if contract is ERC or CandyMachine
 */
const getContractType = (blockchain) => {
	switch (blockchain) {
		case 'ethereum':
		case 'polygon':
		case 'rinkeby':
		case 'mumbai':
			return 'ethereum';
		case 'solana':
		case 'solanadevnet':
			return 'solana';
		default:
			throw new Error('Blockchain tye not supported!');
	}
};

/**
 * Determine blockchain of contract based on its address
 */
const deriveBlockchain = (contractAddress) => {

};

/**
 * Initial contract state.
 * Sets all the variables used by controller functions.
 *
 * @property balance - Balance of smart contract //@TODO wiring pending
 * @property metadataUrl - Target URL of baseUri //@TODO wiring pending
 * @property price - Cost of minting a single NFT
 * @property collectionSize - Size of NFT collection
 * @property amountSold - Number of NFTs sold
 * @property maxPerMint - Number of NFTs that can be minted at a time
 * @property maxPerWallet - Number of NFTs a minter's wallet can hold
 * @property isPresaleOpen - Presale state
 * @property isPublicSaleOpen - Public sale state
 * @property symbol - Symbol associated to NFT
 * 
 * @TODO turn into type.
 */
const ContractState = {
	owner: null,
	symbol: null,
	balance: '',
	balanceInEth: '',
	metadataUrl: '',
	price: 1,
	collectionSize: '',
	amountSold: '',
	maxPerMint: '',
	maxPerWallet: '',
	isPresaleOpen: false,
	isPublicSaleOpen: true,
	isRevealed: false
};

/**
 * Controller responsible for submitting 
 * and managing contract transactions
 */
export class ContractController {
	/**
	 * smart contract version constant. Corresponds to contract.type
	 * in mongoDB. Current options are 'whitelist' & 'erc721a'
	 *
	 */
	version = 'erc721a';

	/**
	 * Creates a ContractController instance
	 */
	constructor(contractAddress, blockchain, version) {
		// Set contract methods (only needed for ethereum contracts)
		if (getContractType(blockchain) == 'ethereum') {
			this.contract = this.retrieveEthereumContract(contractAddress);
		} else {
			this.contract = {};
		}

		this.contract.contractAddress = contractAddress;
		this.contract.type = getContractType(blockchain);
		this.blockchain = blockchain;

		// if contract is on chain
		// populate these values
		this.state = ContractState;
		this.version = version;
	}

	/**
	 * Generates runnable "method" functions for 
	 * interacting with smart contract
	 */
	retrieveEthereumContract(contractAddress) {
		const { version } = this;
		const w = windowInstance('ethereum');
		const web3 = w.web3;

		if (web3.eth) {
			if (version == 'erc721') {
				return new web3.eth.Contract(ERC721.abi, contractAddress);
			}
			if (version == 'erc721a') {
				return new web3.eth.Contract(ERC721a.abi, contractAddress);
			}
		}
	};

	/**
	 * Ethereum sendTransaction
	 * 
	 * @returns Promise
	 */
	async sendTransaction(from, to, data, value) {
		const w = windowInstance('ethereum');
		const web3 = w.web3;

		// Send transaction
		// @TODO no info
		try {
			const response = await web3.eth.sendTransaction({ from, to, data, value });
			return response;
		} catch (e) {
			console.error(e);
			throw new Error(`Error! while sending transaction.`);
		}
	}

	/**
	 * Retrieves all public variables of a smart contract
	 *
	 * @TODO add support for ERC-721
	 */
	async populateContractInfo() {
		try {
			const { contract, version } = this;

			if (contract.type === 'ethereum') {
				if (version === 'erc721') {
					// @TODO add support
					return null;
				}

				if (version === 'erc721a') {
					const w = windowInstance('ethereum');

					const maxPerMint = await contract.methods.maxPerMint().call();

					const cost = await contract.methods.cost().call();
					const costInEth = w.web3.utils.fromWei(cost);

					console.log({ cost, costInEth });

					const amountSold = await contract.methods.supply().call();
					const collectionSize = await contract.methods.totalSupply().call();

					const isPresaleOpen = await contract.methods.presaleOpen().call();
					const maxPerWallet = await contract.methods.maxPerWallet().call();
					const isPublicSaleOpen = await contract.methods.open().call();

					// try {
					// 	const tokenURI = await contract.methods.tokenURI(0).call();
					// 	console.log({ tokenURI }, 'populateContractInfo');
					// } catch (e) {
					// 	console.log(e);
					// }

					const symbol = await contract.methods.symbol().call();

					const balance = await w.web3.eth.getBalance(contract.contractAddress);
					const balanceInEth = w.web3.utils.fromWei(balance);

					const isRevealed = await contract.methods.revealed().call();
					console.log({ isRevealed });

					const owner = await contract.methods.owner().call();

					const state = {
						...this.state,
						collectionSize,
						amountSold,
						maxPerMint,
						maxPerWallet,
						isPresaleOpen,
						isPublicSaleOpen,
						isRevealed,
						// metadataUrl,
						// tokenURI,
						price: costInEth,
						balance,
						balanceInEth,
						symbol,
						owner
					};
					this.state = state;
					return state;
				}
			}

			if (contract.type == 'solana') {
				// @TODO needs support
				return null;
			}
		} catch (e) {
			console.log('Error: populateContractInfo', e);
			return null;
		}
	};

	/**
	 * Deploys new proxy contract
	 *
	 * @param deployerAddress - wallet address of the user deploying the contract
	 * @param name - Name of the smart contract
	 * @param symbol - Token symbol. Shown in Etherscan, Opensea, etc
	 * @param totalSupply - Size of the NFT collection
	 *
	 * @TODO Support solana
	 */
	async deployContract(deployerAddress, name, symbol, totalSupply, onError) {
		const { blockchain, contract: { type } } = this;

		// Proxy contract
		const compiledProxy = (blockchain === 'ethereum' || blockchain === 'polygon') && ProxyERC721a
			|| (blockchain === 'rinkeby' || blockchain === 'mumbai') && ProxyERC721aTestnet
			|| null;

		const proxyContract = new web3.eth.Contract(compiledProxy.abi);

		if (type == 'ethereum') {
			const options = {
				data: compiledProxy.bytecode,
				arguments: [name, symbol, parseInt(totalSupply)],
			};

			const senderInfo = { from: deployerAddress };

			return proxyContract.deploy(options).send(senderInfo, (err, txnhash) => {
				if (err) {
					onError(err);
					return;
				}
				console.log('Deploying contract... should take a couple of seconds');
			}).on('error', function (error) {
				onError(error);
			});
		}

		if (type == 'solana') {
			// @TODO solana contract deploy
		}
	};

	/**
	 * Mints NFT. Supports Ethereum & Solana, mainnet + testnets
	 *
	 * @param walletAddress - Address of minter
	 * @param count - Amount of NFT to mint
	 * @param whitelist - Optional. List of addresses used to construct proof for whitelist.
	 * 
	 * @returns updated contract state
	 */
	async mint(walletAddress, count, whitelist) {
		const { blockchain, contract: { contractAddress, type }, state: { price, isPresaleOpen, isPublicSaleOpen }, } = this;

		// Solana minting
		// @TODO test
		if (type === 'solana') {
			await mintV2(blockchain === 'solanadevnet' && 'devnet' || 'mainnet', contractAddress, walletAddress);
			return;
		}

		//  Ethereum minting
		if (type === 'ethereum') {
			const { contract: { methods: { presaleMint, mint } } } = this;
			let txnData;

			if (isPresaleOpen == false && isPublicSaleOpen == false) {
				throw new Error('Sales are not open');
			}

			// Presale mint
			if (isPresaleOpen) {
				if (!whitelist || !whitelist.length) {
					throw new Error('Whitelist not available! Pre Sale miniting not possible.');
				}

				// Find merkleroot
				const leafNodes = whitelist.map((addr) => keccak256(addr));
				const claimingAddress = (await leafNodes.find((node) => compare(keccak256(walletAddress), node))) || '';
				const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
				const hexProof = merkleTree.getHexProof(claimingAddress);
				txnData = presaleMint(count, hexProof).encodeABI();
			}

			// Public sale mint
			if (isPublicSaleOpen) {
				txnData = mint(count).encodeABI();
			}
			
			const w = windowInstance('ethereum');
			const web3 = w.web3;
			const priceInWei = web3.utils.toWei(`${price}`);

			await this.sendTransaction(walletAddress, contractAddress, txnData, priceInWei * count);

			// update the contract state
			const state = await this.populateContractInfo();
			return state;
		}

		throw new Error('Blockchain not supported');
	}

	/**
	 * Send NFTs to a list of wallet addresses.
	 *
	 * @param walletAddress - Owner of smart contract
	 * @param recipients - Array of wallet addresses to receive NFTs
	 * @param amount - Array of NFTs to airdrop per address, with index corresponding to address index
	 */
	async airdrop(walletAddress, recipients, amount) {
		const { version, contract: { contractAddress, methods: { airdrop } } } = this;
		let txnData;

		// ERC-721 doesn't have ability to set specific amount of tokens to airdrop per address
		// like 721a does
		if (version == 'erc721') {
			txnData = airdrop(recipients).encodeABI();
		}

		if (version == 'erc721a') {
			txnData = airdrop(recipients, amount).encodeABI();
		}

		await this.sendTransaction(walletAddress, contractAddress, txnData, 0);

		// update the contract state
		const state = await this.populateContractInfo();
		return state;
	}

	/**
	 * Updates sale-related states in smart contract
	 *
	 * @param walletAddress - Owner of smart contract
	 * @param open - Smart contract boolean public sale state
	 * @param cost - Price of single NFT in wei?
	 * @param maxW - Max per wallet
	 * @param maxM - Max per mint
	 */
	async updateSale(walletAddress, open, cost, maxW, maxM) {
		const { version, contract: { contractAddress, methods: { updateSale } } } = this;
		let txnData;

		// @TODO load current states for non updating values

		if (version == 'erc721') {
			throw new Error("Function not supported in this version")
		}

		if (version == 'erc721a') {
			txnData = updateSale(open, cost, maxW, maxM).encodeABI();
		}

		await this.sendTransaction(walletAddress, contractAddress, txnData, 0);

		// update the contract state
		const state = await this.populateContractInfo();
		return state;
	}

	/**
	 * Updates presale in smart contract
	 *
	 * @param walletAddress - Owner of smart contract
	 * @param open - Boolean presale state
	 * @param root - Merkleroot of all addresses on the whitelist. Used to verify address for presale mint,
	 */
	async updatePresale(walletAddress, open, root) {
		const { version, contract: { contractAddress, methods: { updatePresale } } } = this;
		let txnData;

		// @TODO load current states for non updating values

		if (version == 'erc721') {
			throw new Error("Function not supported in this version")
		}
		if (version == 'erc721a') {
			txnData = updatePresale(open, root).encodeABI();
		}

		await this.sendTransaction(walletAddress, contractAddress, txnData, 0);

		// update the contract state
		const state = await this.populateContractInfo();
		return state;
	}

	/**
	 * Updates contract baseUri (metadata destination)
	 * depending on @param revealed boolean. Our smart contracts now
	 * host 2 uri states - for pre-reveal and post-reveal
	 *
	 * @param walletAddress - Owner of smart contract
	 * @param revealed - Uri to update. Also functions as a toggle for which uri to display.
	 * @param uri - Metadata uri
	 */
	async updateReveal(walletAddress, revealed, uri) {
		const { version, contract: { contractAddress, methods: { updateReveal } } } = this;
		let txnData;

		if (version == 'erc721') {
			throw new Error("Function not supported in this version");
		}

		if (version == 'erc721a') {
			txnData = updateReveal(revealed, uri).encodeABI();
		}

		await this.sendTransaction(walletAddress, contractAddress, txnData, 0);

		// update the contract state
		const state = await this.populateContractInfo();
		return state;
	}

	/**
	 * Withdraws funds from smart contract. In the case of Solana,
	 * also shuts down contract.
	 * Supports ERC-721 & ERC-721a
	 * 
	 * @TODO support solana
	 */
	async withdraw(walletAddress) {
		const { version, contract: { contractAddress, type, methods: { withdraw } } } = this;
		let txnData;

		if (type === 'ethereum') {
			txnData = withdraw().encodeABI();
			await this.sendTransaction(walletAddress, contractAddress, txnData, 0);

			// update the contract state
			const state = await this.populateContractInfo();
			return state;
		}

		if (type === 'solana') {
			// @TODO Solana withdraw
			// await withdrawV2(env, contractAddress);
		}
	}

	/**
	 * Returns https image url from json metadata.
	 * Resolves IPFS url.
	 *
	 * @param metadata - parsed json metadata
	 */
	async getResolvedImageUrl(metadata) {

		// parse metadata.image url to pinata gateway

		// return link
	}

	/**
	 * Retrieves parsed json metadata from token id
	 * 
	 * @param tokenId - parsed json metadata
	 */
	async getTokenMetadata(tokenId) {
		const { contract: { contractAddress } } = this;

		// Retrieve token URI from smart contract

		// Parse IPFS url into pinata gateway

		// Parse raw text into json
		// return {
		//		name: '',
		//		description: '',
		//		image: '',
		//		traits: {...}
		// }

	}
}


