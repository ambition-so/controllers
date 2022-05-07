import {
    Keypair,
    PublicKey,
    SystemProgram,
    AccountInfo,
    Transaction,
    sendAndConfirmTransaction,
    sendAndConfirmRawTransaction,
} from '@solana/web3.js';
const nacl = require('tweetnacl');
import {
    CANDY_MACHINE,
    CANDY_MACHINE_PROGRAM_ID,
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_METADATA_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    FAIR_LAUNCH_PROGRAM_ID,
    AUCTION_HOUSE_PROGRAM_ID,
    AUCTION_HOUSE,
    FEE_PAYER,
    TREASURY,
    WRAPPED_SOL_MINT,
    TOKEN_ENTANGLEMENT_PROGRAM_ID,
    TOKEN_ENTANGLER,
    ESCROW,
    B,
    A,
    CANDY_MACHINE_PROGRAM_V2_ID,
} from './constants';
import { CLUSTERS, DEFAULT_CLUSTER } from './constants';
import * as anchor from '@project-serum/anchor';
//import fs from 'fs';
import {
    createCandyMachineV2Account,
    createConfigAccount,
} from './instructions';
import { web3 } from '@project-serum/anchor';
import log from 'loglevel';
import { AccountLayout, u64 } from '@solana/spl-token';
import Wallet from '../externals/nodewallet';
import bs58 from 'bs58';
import { throws } from 'assert';

import { BN, Program } from '@project-serum/anchor';

import { sendTransactionWithRetryWithKeypair } from './transactions';
/*
  export type AccountAndPubkey = {
    pubkey: string;
    account: AccountInfo<Buffer>;
  };
  //export type StringPublicKey = string;
  */

// global prototype function

// toBuffer for address
//   Object.prototype.addressToBuffer = function(fn) {

//     const decoded = bs58.decode(this);
//     return decoded;

//   };

export function getCluster(name) {
    for (const cluster of CLUSTERS) {
        if (cluster.name === name) {
            return cluster.url;
        }
    }
    return DEFAULT_CLUSTER.url;
}

// TODO: expose in spl package
export const deserializeAccount = (data) => {
    const accountInfo = AccountLayout.decode(data);
    accountInfo.mint = new PublicKey(accountInfo.mint);
    accountInfo.owner = new PublicKey(accountInfo.owner);
    accountInfo.amount = u64.fromBuffer(accountInfo.amount);

    if (accountInfo.delegateOption === 0) {
        accountInfo.delegate = null;
        accountInfo.delegatedAmount = new u64(0);
    } else {
        accountInfo.delegate = new PublicKey(accountInfo.delegate);
        accountInfo.delegatedAmount = u64.fromBuffer(
            accountInfo.delegatedAmount
        );
    }

    accountInfo.isInitialized = accountInfo.state !== 0;
    accountInfo.isFrozen = accountInfo.state === 2;

    if (accountInfo.isNativeOption === 1) {
        accountInfo.rentExemptReserve = u64.fromBuffer(accountInfo.isNative);
        accountInfo.isNative = true;
    } else {
        accountInfo.rentExemptReserve = null;
        accountInfo.isNative = false;
    }

    if (accountInfo.closeAuthorityOption === 0) {
        accountInfo.closeAuthority = null;
    } else {
        accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority);
    }

    return accountInfo;
};

export const createCandyMachineV2 = async function (
    anchorProgram,
    treasuryWallet,
    splToken,
    candyData
) {
    const candyAccount = Keypair.generate();
    candyData.uuid = uuidFromConfigPubkey(candyAccount.publicKey);
    const sol = await window.solana.connect();
    const payerPublicAddress = new PublicKey(
        sol.publicKey.toString().toBuffer()
    );

    if (!candyData.creators || candyData.creators.length === 0) {
        throw new Error(`Invalid config, there must be at least one creator.`);
    }

    const totalShare = (candyData.creators || []).reduce(
        (acc, curr) => acc + curr.share,
        0
    );

    if (totalShare !== 100) {
        throw new Error(`Invalid config, creators shares must add up to 100`);
    }

    const remainingAccounts = [];
    if (splToken) {
        remainingAccounts.push({
            pubkey: splToken,
            isSigner: false,
            isWritable: false,
        });
    }

    console.log('initializing candy machine from anchor program');

    const r = {
        candyMachine: candyAccount.publicKey,
        uuid: candyData.uuid,
        txId: await anchorProgram.instruction.initializeCandyMachine(
            candyData,
            {
                accounts: {
                    candyMachine: candyAccount.publicKey,
                    wallet: payerPublicAddress,
                    authority: payerPublicAddress,
                    payer: payerPublicAddress,
                    systemProgram: SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                },
            }
        ),
    };

    let instructions = [
        await createCandyMachineV2Account(
            anchorProgram,
            candyData,
            payerPublicAddress,
            candyAccount.publicKey
        ),
        r.txId,
    ];

    // Sign transaction
    let recentBlockhash =
        await anchorProgram.provider.connection.getRecentBlockhash();
    const transaction = new Transaction({
        recentBlockhash: recentBlockhash.blockhash,
        feePayer: payerPublicAddress,
    });
    transaction.add(instructions[0]);
    transaction.add(instructions[1]);

    let transactionBuffer = transaction.serializeMessage();

    // Request client wallet to sign request
    const signature1 = await window.solana.request({
        method: 'signTransaction',
        params: {
            message: bs58.encode(transactionBuffer),
        },
    });
    // In addition, sign request with candyAccount
    let signature2 = nacl.sign.detached(
        transactionBuffer,
        candyAccount.secretKey
    );
    transaction.addSignature(
        payerPublicAddress,
        bs58.decode(signature1.signature)
    );
    transaction.addSignature(candyAccount.publicKey, signature2);

    // Verify signatures and send transaction
    let isVerifiedSignature = transaction.verifySignatures();
    console.log(`The signatures were verifed: ${isVerifiedSignature}`);
    let rawTransaction = transaction.serialize();

    console.log(anchorProgram.provider.connection);

    const asd = await sendAndConfirmRawTransaction(
        anchorProgram.provider.connection,
        rawTransaction
    );
    console.log(asd);

    return {
        uuid: candyData.uuid,
        candyMachineAddress: candyAccount.publicKey,
    };
};

export const createConfig = async function (
    anchorProgram,
    payerWallet,
    configData
) {
    const configAccount = Keypair.generate();
    const uuid = uuidFromConfigPubkey(configAccount.publicKey);

    if (!configData.creators || configData.creators.length === 0) {
        throw new Error(`Invalid config, there must be at least one creator.`);
    }

    const totalShare = (configData.creators || []).reduce(
        (acc, curr) => acc + curr.share,
        0
    );

    if (totalShare !== 100) {
        throw new Error(`Invalid config, creators shares must add up to 100`);
    }

    return {
        config: configAccount.publicKey,
        uuid,
        txId: await anchorProgram.rpc.initializeConfig(
            {
                uuid,
                ...configData,
            },
            {
                accounts: {
                    config: configAccount.publicKey,
                    authority: payerWallet.publicKey,
                    payer: payerWallet.publicKey,
                    systemProgram: SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                },
                signers: [payerWallet, configAccount],
                instructions: [
                    await createConfigAccount(
                        anchorProgram,
                        configData,
                        payerWallet.publicKey,
                        configAccount.publicKey
                    ),
                ],
            }
        ),
    };
};

export function uuidFromConfigPubkey(configAccount) {
    return configAccount.toBase58().slice(0, 6);
}

export const getTokenWallet = async function (wallet, mint) {
    return (
        await PublicKey.findProgramAddress(
            [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
        )
    )[0];
};

export const getCandyMachineAddress = async (config, uuid) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(CANDY_MACHINE), config.toBuffer(), Buffer.from(uuid)],
        CANDY_MACHINE_PROGRAM_ID
    );
};

export const deriveCandyMachineV2ProgramAddress = async (candyMachineId) => {
    return await PublicKey.findProgramAddress(
        [Buffer.from(CANDY_MACHINE), candyMachineId.toBuffer()],
        CANDY_MACHINE_PROGRAM_V2_ID
    );
};

export const getConfig = async (authority, uuid) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(CANDY_MACHINE), authority.toBuffer(), Buffer.from(uuid)],
        CANDY_MACHINE_PROGRAM_ID
    );
};

export const getTokenMint = async (authority, uuid) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from('fair_launch'),
            authority.toBuffer(),
            Buffer.from('mint'),
            Buffer.from(uuid),
        ],
        FAIR_LAUNCH_PROGRAM_ID
    );
};

export const getFairLaunch = async (tokenMint) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from('fair_launch'), tokenMint.toBuffer()],
        FAIR_LAUNCH_PROGRAM_ID
    );
};

export const getCandyMachineCreator = async (candyMachine) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from('candy_machine'), candyMachine.toBuffer()],
        CANDY_MACHINE_PROGRAM_V2_ID
    );
};

export const getFairLaunchTicket = async (tokenMint, buyer) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from('fair_launch'), tokenMint.toBuffer(), buyer.toBuffer()],
        FAIR_LAUNCH_PROGRAM_ID
    );
};

export const getFairLaunchLotteryBitmap = async (tokenMint) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from('fair_launch'),
            tokenMint.toBuffer(),
            Buffer.from('lottery'),
        ],
        FAIR_LAUNCH_PROGRAM_ID
    );
};

export const getFairLaunchTicketSeqLookup = async (tokenMint, seq) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from('fair_launch'),
            tokenMint.toBuffer(),
            seq.toBuffer('le', 8),
        ],
        FAIR_LAUNCH_PROGRAM_ID
    );
};

export const getAtaForMint = async (mint, buyer) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [buyer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    );
};

export const getParticipationMint = async (authority, uuid) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from('fair_launch'),
            authority.toBuffer(),
            Buffer.from('mint'),
            Buffer.from(uuid),
            Buffer.from('participation'),
        ],
        FAIR_LAUNCH_PROGRAM_ID
    );
};

export const getParticipationToken = async (authority, uuid) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from('fair_launch'),
            authority.toBuffer(),
            Buffer.from('mint'),
            Buffer.from(uuid),
            Buffer.from('participation'),
            Buffer.from('account'),
        ],
        FAIR_LAUNCH_PROGRAM_ID
    );
};

export const getTreasury = async (tokenMint) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from('fair_launch'),
            tokenMint.toBuffer(),
            Buffer.from('treasury'),
        ],
        FAIR_LAUNCH_PROGRAM_ID
    );
};

export const getMetadata = async (mint) => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        )
    )[0];
};

export const getMasterEdition = async (mint) => {
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
                Buffer.from('edition'),
            ],
            TOKEN_METADATA_PROGRAM_ID
        )
    )[0];
};

export const getEditionMarkPda = async (mint, edition) => {
    const editionNumber = Math.floor(edition / 248);
    return (
        await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
                Buffer.from('edition'),
                Buffer.from(editionNumber.toString()),
            ],
            TOKEN_METADATA_PROGRAM_ID
        )
    )[0];
};

export const getAuctionHouse = async (creator, treasuryMint) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from(AUCTION_HOUSE),
            creator.toBuffer(),
            treasuryMint.toBuffer(),
        ],
        AUCTION_HOUSE_PROGRAM_ID
    );
};

export const getAuctionHouseProgramAsSigner = async () => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(AUCTION_HOUSE), Buffer.from('signer')],
        AUCTION_HOUSE_PROGRAM_ID
    );
};

export const getAuctionHouseFeeAcct = async (auctionHouse) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from(AUCTION_HOUSE),
            auctionHouse.toBuffer(),
            Buffer.from(FEE_PAYER),
        ],
        AUCTION_HOUSE_PROGRAM_ID
    );
};

export const getAuctionHouseTreasuryAcct = async (auctionHouse) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from(AUCTION_HOUSE),
            auctionHouse.toBuffer(),
            Buffer.from(TREASURY),
        ],
        AUCTION_HOUSE_PROGRAM_ID
    );
};

export const getAuctionHouseBuyerEscrow = async (auctionHouse, wallet) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from(AUCTION_HOUSE),
            auctionHouse.toBuffer(),
            wallet.toBuffer(),
        ],
        AUCTION_HOUSE_PROGRAM_ID
    );
};

export const getAuctionHouseTradeState = async (
    auctionHouse,
    wallet,
    tokenAccount,
    treasuryMint,
    tokenMint,
    tokenSize,
    buyPrice
) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [
            Buffer.from(AUCTION_HOUSE),
            wallet.toBuffer(),
            auctionHouse.toBuffer(),
            tokenAccount.toBuffer(),
            treasuryMint.toBuffer(),
            tokenMint.toBuffer(),
            buyPrice.toBuffer('le', 8),
            tokenSize.toBuffer('le', 8),
        ],
        AUCTION_HOUSE_PROGRAM_ID
    );
};

export const getTokenEntanglement = async (mintA, mintB) => {
    return await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(TOKEN_ENTANGLER), mintA.toBuffer(), mintB.toBuffer()],
        TOKEN_ENTANGLEMENT_PROGRAM_ID
    );
};

export const getTokenEntanglementEscrows = async (mintA, mintB) => {
    return [
        ...(await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(TOKEN_ENTANGLER),
                mintA.toBuffer(),
                mintB.toBuffer(),
                Buffer.from(ESCROW),
                Buffer.from(A),
            ],
            TOKEN_ENTANGLEMENT_PROGRAM_ID
        )),
        ...(await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(TOKEN_ENTANGLER),
                mintA.toBuffer(),
                mintB.toBuffer(),
                Buffer.from(ESCROW),
                Buffer.from(B),
            ],
            TOKEN_ENTANGLEMENT_PROGRAM_ID
        )),
    ];
};

export function loadWalletKey(keypair) {
    if (!keypair || keypair == '') {
        throw new Error('Keypair is required!');
    }
    const loaded = Keypair.fromSecretKey(
        //    new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString())),

        new Uint8Array(keypair)
    );
    console.log(`wallet public key: ${loaded.publicKey}`);
    return loaded;
}

export async function loadCandyProgramV2(walletKeyPair, env, customRpcUrl) {
    if (customRpcUrl) console.log('USING CUSTOM URL', customRpcUrl);

    let url;
    if (env == 'devnet') {
        url = 'https://api.devnet.solana.com';
    } else if (env == 'mainnet') {
        url = 'https://api.mainnet-beta.solana.com';
    }

    // @ts-ignore
    const solConnection = new anchor.web3.Connection(
        //@ts-ignore
        //		customRpcUrl || getCluster(env)
        url
    );

    const walletWrapper = new Wallet(walletKeyPair);
    console.log('wallet wrapper', walletWrapper);

    console.log('null wallet');
    const provider = new anchor.Provider(solConnection, null, {
        preflightCommitment: 'recent',
    });

    console.log(provider);
    //	const solProvider = window.solana;
    //	console.log(solProvider)

    const idl = await anchor.Program.fetchIdl(
        CANDY_MACHINE_PROGRAM_V2_ID,
        provider
    );
    console.log('Fetched IDL', idl);

    const program = new anchor.Program(
        idl,
        CANDY_MACHINE_PROGRAM_V2_ID,
        provider
    );
    console.log('program id from anchor', program.programId.toBase58());
    return program;
}

export async function loadFairLaunchProgram(walletKeyPair, env, customRpcUrl) {
    if (customRpcUrl) console.log('USING CUSTOM URL', customRpcUrl);

    // @ts-ignore
    const solConnection = new anchor.web3.Connection(
        //@ts-ignore
        customRpcUrl || getCluster(env)
    );
    const walletWrapper = {}; // new anchor.Wallet(walletKeyPair);
    const provider = new anchor.Provider(solConnection, walletWrapper, {
        preflightCommitment: 'recent',
    });
    const idl = await anchor.Program.fetchIdl(FAIR_LAUNCH_PROGRAM_ID, provider);

    return new anchor.Program(idl, FAIR_LAUNCH_PROGRAM_ID, provider);
}

export async function loadAuctionHouseProgram(
    walletKeyPair,
    env,
    customRpcUrl
) {
    if (customRpcUrl) console.log('USING CUSTOM URL', customRpcUrl);

    // @ts-ignore
    const solConnection = new anchor.web3.Connection(
        //@ts-ignore
        customRpcUrl || getCluster(env)
    );
    const walletWrapper = {}; // new anchor.Wallet(walletKeyPair);
    const provider = new anchor.Provider(solConnection, walletWrapper, {
        preflightCommitment: 'recent',
    });
    const idl = await anchor.Program.fetchIdl(
        AUCTION_HOUSE_PROGRAM_ID,
        provider
    );

    return new anchor.Program(idl, AUCTION_HOUSE_PROGRAM_ID, provider);
}

export async function loadTokenEntanglementProgream(
    walletKeyPair,
    env,
    customRpcUrl
) {
    if (customRpcUrl) console.log('USING CUSTOM URL', customRpcUrl);

    // @ts-ignore
    const solConnection = new anchor.web3.Connection(
        //@ts-ignore
        customRpcUrl || getCluster(env)
    );
    const walletWrapper = {}; // new anchor.Wallet(walletKeyPair);
    const provider = new anchor.Provider(solConnection, walletWrapper, {
        preflightCommitment: 'recent',
    });
    const idl = await anchor.Program.fetchIdl(
        TOKEN_ENTANGLEMENT_PROGRAM_ID,
        provider
    );

    return new anchor.Program(idl, TOKEN_ENTANGLEMENT_PROGRAM_ID, provider);
}

export async function getTokenAmount(anchorProgram, account, mint) {
    let amount = 0;
    if (!mint.equals(WRAPPED_SOL_MINT)) {
        try {
            const token =
                await anchorProgram.provider.connection.getTokenAccountBalance(
                    account
                );
            amount = token.value.uiAmount * Math.pow(10, token.value.decimals);
        } catch (e) {
            log.error(e);
            log.info(
                'Account ',
                account.toBase58(),
                'didnt return value. Assuming 0 tokens.'
            );
        }
    } else {
        amount = await anchorProgram.provider.connection.getBalance(account);
    }
    return amount;
}

export const getBalance = async (account, env, customRpcUrl) => {
    if (customRpcUrl) console.log('USING CUSTOM URL', customRpcUrl);
    const connection = new anchor.web3.Connection(
        //@ts-ignore
        customRpcUrl || getCluster(env)
    );
    return await connection.getBalance(account);
};

export async function getProgramAccounts(
    connection,
    programId,
    configOrCommitment
) {
    const extra = {};
    let commitment;
    //let encoding;

    if (configOrCommitment) {
        if (typeof configOrCommitment === 'string') {
            commitment = configOrCommitment;
        } else {
            commitment = configOrCommitment.commitment;
            //encoding = configOrCommitment.encoding;

            if (configOrCommitment.dataSlice) {
                extra.dataSlice = configOrCommitment.dataSlice;
            }

            if (configOrCommitment.filters) {
                extra.filters = configOrCommitment.filters;
            }
        }
    }

    const args = connection._buildArgs(
        [programId],
        commitment,
        'base64',
        extra
    );
    const unsafeRes = await connection._rpcRequest('getProgramAccounts', args);

    return unsafeResAccounts(unsafeRes.result);
}

function unsafeAccount(account) {
    return {
        // TODO: possible delay parsing could be added here
        data: Buffer.from(account.data[0], 'base64'),
        executable: account.executable,
        lamports: account.lamports,
        // TODO: maybe we can do it in lazy way? or just use string
        owner: account.owner,
    };
}

function unsafeResAccounts(data) {
    return data.map((item) => ({
        account: unsafeAccount(item.account),
        pubkey: item.pubkey,
    }));
}
