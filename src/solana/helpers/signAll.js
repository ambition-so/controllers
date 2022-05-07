import {
    AccountInfo,
    Connection,
    Keypair,
    PublicKey,
    TransactionInstruction,
} from '@solana/web3.js';
import {
    MAX_CREATOR_LEN,
    MAX_NAME_LENGTH,
    MAX_SYMBOL_LENGTH,
    MAX_URI_LENGTH,
    TOKEN_METADATA_PROGRAM_ID,
} from '../helpers/constants';
import * as borsh from 'borsh';
import { Metadata, METADATA_SCHEMA } from './types';

async function getProgramAccounts(connection, programId, configOrCommitment) {
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
    const data = unsafeRes.result.map((item) => {
        return {
            account: {
                // TODO: possible delay parsing could be added here
                data: Buffer.from(item.account.data[0], 'base64'),
                executable: item.account.executable,
                lamports: item.account.lamports,
                // TODO: maybe we can do it in lazy way? or just use string
                owner: item.account.owner,
            },
            pubkey: item.pubkey,
        };
    });

    return data;
}

export async function getAccountsByCreatorAddress(creatorAddress, connection) {
    const metadataAccounts = await getProgramAccounts(
        connection,
        TOKEN_METADATA_PROGRAM_ID.toBase58(),
        {
            filters: [
                {
                    memcmp: {
                        offset:
                            1 + // key
                            32 + // update auth
                            32 + // mint
                            4 + // name string length
                            MAX_NAME_LENGTH + // name
                            4 + // uri string length
                            MAX_URI_LENGTH + // uri*
                            4 + // symbol string length
                            MAX_SYMBOL_LENGTH + // symbol
                            2 + // seller fee basis points
                            1 + // whether or not there is a creators vec
                            4 + // creators vec length
                            0 * MAX_CREATOR_LEN,
                        bytes: creatorAddress,
                    },
                },
            ],
        }
    );
    const decodedAccounts = [];
    for (let i = 0; i < metadataAccounts.length; i++) {
        const e = metadataAccounts[i];
        const decoded = await decodeMetadata(e.account.data);
        const accountPubkey = e.pubkey;
        const store = [decoded, accountPubkey];
        decodedAccounts.push(store);
    }
    return decodedAccounts;
}

const METADATA_REPLACE = new RegExp('\u0000', 'g');
async function decodeMetadata(buffer) {
    const metadata = borsh.deserializeUnchecked(
        METADATA_SCHEMA,
        Metadata,
        buffer
    );
    metadata.data.name = metadata.data.name.replace(METADATA_REPLACE, '');
    metadata.data.uri = metadata.data.uri.replace(METADATA_REPLACE, '');
    metadata.data.symbol = metadata.data.symbol.replace(METADATA_REPLACE, '');
    return metadata;
}
