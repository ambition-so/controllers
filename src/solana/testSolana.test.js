import { useSolana } from '../index';
import { Keypair } from '@solana/web3.js';
import Wallet from '../externals/nodewallet';

test('deploySolana', async () => {
    const keypair = Uint8Array.from([
        88, 82, 242, 103, 248, 198, 203, 230, 4, 231, 160, 48, 61, 3, 22, 255,
        61, 53, 1, 91, 193, 27, 97, 182, 168, 226, 189, 49, 39, 68, 251, 10,
        220, 161, 8, 219, 156, 30, 136, 176, 146, 208, 149, 125, 20, 165, 119,
        103, 60, 196, 135, 60, 112, 223, 65, 171, 175, 123, 182, 7, 57, 56, 147,
        10,
    ]);

    const payer = Keypair.fromSecretKey(Uint8Array.from(keypair));
    console.log(payer.publicKey);

    const { deploySolanaContract, generateKeypair } = useSolana();

    // expect( await deploySolanaContract("/root/ambition/devnet.json ")).toBeDefined();
    expect(await deploySolanaContract(keypair)).toBeDefined();
});

// test('createCandy', async () => {
//     const keypair = [88,82,242,103,248,198,203,230,4,231,160,48,61,3,22,255,61,53,1,91,193,27,97,182,168,226,189,49,39,68,251,10,220,161,8,219,156,30,136,176,146,208,149,125,20,165,119,103,60,196,135,60,112,223,65,171,175,123,182,7,57,56,147,10];

//     const payerWallet =  Keypair.fromSecretKey(Uint8Array.from(keypair));
//     console.log(payer.publicKey);

//     const anchorProgram = await loadCandyProgramV2(payerWallet, env);

//     const res = await createCandyMachineV2(
//         anchorProgram,
//         payerWallet,		// Need this -- payer wallet
//         payerWallet.publicKey,		// treasuryWallet
//         null,		// splToken
//         {
//             itemsAvailable: new BN(100),
//             uuid: null,
//             retainAuthority: true,
// //			symbol,
// //			sellerFeeBasisPoints, //: firstAssetManifest.seller_fee_basis_points,
// //			isMutable: mutable,
//             maxSupply: new BN(0),
// //			gatekeeper,
// //			goLiveDate,
// //			price,
// //			endSettings,
// //			whitelistMintSettings,
// //			hiddenSettings,
//             creators:[{address: "FrF7aE45tLUjTcJ7aCvTSJqN9NBG9FGZWWhuHK7Hm8z5", verified: true, share: 100}]
//         },
//     );
//     // expect( await useSolana().deploySolanaContract(payer)).toBeDefined();

// });
