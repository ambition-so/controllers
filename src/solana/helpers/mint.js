import {
    PublicKey,
    Keypair,
    createAccount,
    LAMPORTS_PER_SOL,
    SystemProgram,
    Transaction,
    sendAndConfirmRawTransaction,
} from '@solana/web3.js';
import { sendTransactionWithRetryWithKeypair } from './transactions';
import {
    loadWalletKey,
    loadCandyProgramV2,
    getTokenWallet,
    getMetadata,
    getMasterEdition,
    getCandyMachineCreator,
} from './accounts';
import { MintLayout, Token } from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';
import bs58 from 'bs58';
import { TOKEN_METADATA_PROGRAM_ID, TOKEN_PROGRAM_ID } from './constants';
import { createAssociatedTokenAccountInstruction } from './instructions';
// import { sendTransactionWithRetryWithKeypair } from '../helpers/transactions';
const nacl = require('tweetnacl');

export async function mintV2(
    env,
    candyMachineAddress,
    payerWalletAddress,
    rpcUrl
) {
    const mint = Keypair.generate();

    //		rpcUrl = 'https://'

    // const userKeyPair = loadWalletKey(null, env);
    const anchorProgram = await loadCandyProgramV2(null, env);
    console.log(anchorProgram);

    console.log(env);
    console.log(candyMachineAddress);
    const userTokenAccountAddress = await getTokenWallet(
        payerWalletAddress,
        mint.publicKey
    );

    const sol = await window.solana.connect();
    const payerPublicAddress = new PublicKey(
        sol.publicKey.toString().toBuffer()
    );

    const candyMachine = await anchorProgram.account.candyMachine.fetch(
        candyMachineAddress
    );

    let transferAuthority;
    let whitelistBurnAuthority;
    const remainingAccounts = [];
    const signers = [mint];
    const cleanupInstructions = [];
    const instructions = [
        anchor.web3.SystemProgram.createAccount({
            fromPubkey: payerPublicAddress,
            newAccountPubkey: mint.publicKey,
            space: MintLayout.span,
            lamports:
                await anchorProgram.provider.connection.getMinimumBalanceForRentExemption(
                    MintLayout.span
                ),
            programId: TOKEN_PROGRAM_ID,
        }),
        Token.createInitMintInstruction(
            TOKEN_PROGRAM_ID,
            mint.publicKey,
            0,
            payerPublicAddress,
            payerPublicAddress
        ),
        createAssociatedTokenAccountInstruction(
            userTokenAccountAddress,
            payerPublicAddress,
            payerPublicAddress,
            mint.publicKey
        ),
        Token.createMintToInstruction(
            TOKEN_PROGRAM_ID,
            mint.publicKey,
            userTokenAccountAddress,
            payerPublicAddress,
            [],
            1
        ),
    ];

    if (candyMachine.data.whitelistMintSettings) {
        const mint = new anchor.web3.PublicKey(
            candyMachine.data.whitelistMintSettings.mint
        );

        const whitelistToken = (
            await getAtaForMint(mint, payerPublicAddress)
        )[0];
        remainingAccounts.push({
            pubkey: whitelistToken,
            isWritable: true,
            isSigner: false,
        });

        if (candyMachine.data.whitelistMintSettings.mode.burnEveryTime) {
            whitelistBurnAuthority = anchor.web3.Keypair.generate();

            remainingAccounts.push({
                pubkey: mint,
                isWritable: true,
                isSigner: false,
            });
            remainingAccounts.push({
                pubkey: whitelistBurnAuthority.publicKey,
                isWritable: false,
                isSigner: true,
            });
            signers.push(whitelistBurnAuthority);
            const exists =
                await anchorProgram.provider.connection.getAccountInfo(
                    whitelistToken
                );
            if (exists) {
                instructions.push(
                    Token.createApproveInstruction(
                        TOKEN_PROGRAM_ID,
                        whitelistToken,
                        whitelistBurnAuthority.publicKey,
                        payerPublicAddress,
                        [],
                        1
                    )
                );
                cleanupInstructions.push(
                    Token.createRevokeInstruction(
                        TOKEN_PROGRAM_ID,
                        whitelistToken,
                        payerPublicAddress,
                        []
                    )
                );
            }
        }
    }

    let tokenAccount;
    if (candyMachine.tokenMint) {
        transferAuthority = anchor.web3.Keypair.generate();

        tokenAccount = await getTokenWallet(
            payerPublicAddress,
            candyMachine.tokenMint
        );

        remainingAccounts.push({
            pubkey: tokenAccount,
            isWritable: true,
            isSigner: false,
        });
        remainingAccounts.push({
            pubkey: transferAuthority.publicKey,
            isWritable: false,
            isSigner: true,
        });

        instructions.push(
            Token.createApproveInstruction(
                TOKEN_PROGRAM_ID,
                tokenAccount,
                transferAuthority.publicKey,
                payerPublicAddress,
                [],
                candyMachine.data.price.toNumber()
            )
        );
        signers.push(transferAuthority);
        cleanupInstructions.push(
            Token.createRevokeInstruction(
                TOKEN_PROGRAM_ID,
                tokenAccount,
                payerPublicAddress,
                []
            )
        );
    }
    const metadataAddress = await getMetadata(mint.publicKey);
    const masterEdition = await getMasterEdition(mint.publicKey);

    const [candyMachineCreator, creatorBump] = await getCandyMachineCreator(
        candyMachineAddress
    );

    console.log({
        candyMachine: candyMachineAddress,
        candyMachineCreator,
        payer: payerPublicAddress,
        //@ts-ignore
        wallet: candyMachine.wallet,
        mint: mint.publicKey,
        metadata: metadataAddress,
        masterEdition,
        mintAuthority: payerPublicAddress,
        updateAuthority: payerPublicAddress,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        recentBlockhashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
        instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
    });

    instructions.push(
        await anchorProgram.instruction.mintNft(creatorBump, {
            accounts: {
                candyMachine: candyMachineAddress,
                candyMachineCreator,
                payer: payerPublicAddress,
                //@ts-ignore
                wallet: candyMachine.wallet,
                mint: mint.publicKey,
                metadata: metadataAddress,
                masterEdition,
                mintAuthority: payerPublicAddress,
                updateAuthority: payerPublicAddress,
                tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
                recentBlockhashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
                instructionSysvarAccount:
                    anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            },
            remainingAccounts:
                remainingAccounts.length > 0 ? remainingAccounts : undefined,
        })
    );

    console.log('minting');
    let recentBlockhash =
        await anchorProgram.provider.connection.getRecentBlockhash();
    const transaction = new Transaction({
        recentBlockhash: recentBlockhash.blockhash,
        feePayer: payerPublicAddress,
    });

    for (let i = 0; i < instructions.length; i++) {
        transaction.add(instructions[i]);
    }

    let transactionBuffer = transaction.serializeMessage();

    const payerSignature = await window.solana.request({
        method: 'signTransaction',
        params: {
            message: bs58.encode(transactionBuffer),
        },
    });

    let mintSignature = nacl.sign.detached(transactionBuffer, mint.secretKey);

    transaction.addSignature(
        payerPublicAddress,
        bs58.decode(payerSignature.signature)
    );

    console.log(mintSignature, mint.publicKey);
    transaction.addSignature(mint.publicKey, mintSignature);

    console.log(payerPublicAddress.toString());
    // if(transferAuthority){
    // const transferSignature = nacl.sign.detached(transactionBuffer, transferAuthority.secretKey);
    // transaction.addSignature(transferAuthority.publicKey, (transferSignature));
    // }

    // if(whitelistBurnAuthority){
    // const whiteListSignature = nacl.sign.detached(transactionBuffer, whitelistBurnAuthority.secretKey);
    // transaction.addSignature(whitelistBurnAuthority.publicKey, (whiteListSignature));
    // }

    let isVerifiedSignature = transaction.verifySignatures();
    console.log(`The signatures were verifed: ${isVerifiedSignature}`);

    let rawTransaction = transaction.serialize();

    const asd = await sendAndConfirmRawTransaction(
        anchorProgram.provider.connection,
        rawTransaction,
        {
            commitment: 'finalized',
            skipPreflight: true,
        }
    );
    console.log(asd);

    return 0;
}
