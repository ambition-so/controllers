import { BinaryReader, BinaryWriter, deserializeUnchecked } from 'borsh';
import base58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

import { BN } from '@project-serum/anchor';

export const MetadataKey = {
    Uninitialized: 0,
    MetadataV1: 4,
    EditionV1: 1,
    MasterEditionV1: 2,
    MasterEditionV2: 6,
    EditionMarker: 7,
};
export class Creator {
    constructor(args) {
        this.address = args.address;
        this.verified = args.verified;
        this.share = args.share;
    }
}

export class Data {
    constructor(args) {
        this.name = args.name;
        this.symbol = args.symbol;
        this.uri = args.uri;
        this.sellerFeeBasisPoints = args.sellerFeeBasisPoints;
        this.creators = args.creators;
    }
}

export class CreateMetadataArgs {
    instruction = 0;
    constructor(args) {
        this.data = args.data;
        this.isMutable = args.isMutable;
    }
}

export class UpdateMetadataArgs {
    instruction = 1;
    data = null;
    // Not used by this app, just required for instruction
    updateAuthority = null;
    primarySaleHappened = null;
    constructor(args) {
        this.data = args.data ? args.data : null;
        this.updateAuthority = args.updateAuthority
            ? args.updateAuthority
            : null;
        this.primarySaleHappened = args.primarySaleHappened;
    }
}

export class CreateMasterEditionArgs {
    instruction = 10;
    maxSupply = null;
    constructor(args) {
        this.maxSupply = args.maxSupply;
    }
}

export class Metadata {
    constructor(args) {
        this.key = MetadataKey.MetadataV1;
        this.updateAuthority = args.updateAuthority;
        this.mint = args.mint;
        this.data = args.data;
        this.primarySaleHappened = args.primarySaleHappened;
        this.isMutable = args.isMutable;
        this.editionNonce = args.editionNonce ?? null;
    }
}

export const METADATA_SCHEMA = new Map([
    [
        CreateMetadataArgs,
        {
            kind: 'struct',
            fields: [
                ['instruction', 'u8'],
                ['data', Data],
                ['isMutable', 'u8'], // bool
            ],
        },
    ],
    [
        CreateMasterEditionArgs,
        {
            kind: 'struct',
            fields: [
                ['instruction', 'u8'],
                ['maxSupply', { kind: 'option', type: 'u64' }],
            ],
        },
    ],
    [
        UpdateMetadataArgs,
        {
            kind: 'struct',
            fields: [
                ['instruction', 'u8'],
                ['data', { kind: 'option', type: Data }],
                ['updateAuthority', { kind: 'option', type: 'pubkeyAsString' }],
                ['primarySaleHappened', { kind: 'option', type: 'u8' }],
            ],
        },
    ],
    [
        Data,
        {
            kind: 'struct',
            fields: [
                ['name', 'string'],
                ['symbol', 'string'],
                ['uri', 'string'],
                ['sellerFeeBasisPoints', 'u16'],
                ['creators', { kind: 'option', type: [Creator] }],
            ],
        },
    ],
    [
        Creator,
        {
            kind: 'struct',
            fields: [
                ['address', 'pubkeyAsString'],
                ['verified', 'u8'],
                ['share', 'u8'],
            ],
        },
    ],
    [
        Metadata,
        {
            kind: 'struct',
            fields: [
                ['key', 'u8'],
                ['updateAuthority', 'pubkeyAsString'],
                ['mint', 'pubkeyAsString'],
                ['data', Data],
                ['primarySaleHappened', 'u8'], // bool
                ['isMutable', 'u8'], // bool
                ['editionNonce', { kind: 'option', type: 'u8' }],
            ],
        },
    ],
]);

// eslint-disable-next-line no-control-regex
const METADATA_REPLACE = new RegExp('\u0000', 'g');

export const decodeMetadata = (buffer) => {
    const metadata = deserializeUnchecked(METADATA_SCHEMA, Metadata, buffer);
    metadata.data.name = metadata.data.name.replace(METADATA_REPLACE, '');
    metadata.data.uri = metadata.data.uri.replace(METADATA_REPLACE, '');
    metadata.data.symbol = metadata.data.symbol.replace(METADATA_REPLACE, '');
    return metadata;
};

export const extendBorsh = () => {
    BinaryReader.prototype.readPubkey = function () {
        const reader = this;
        const array = reader.readFixedArray(32);
        return new PublicKey(array);
    };

    BinaryWriter.prototype.writePubkey = function (value) {
        const writer = this;
        writer.writeFixedArray(value.toBuffer());
    };

    BinaryReader.prototype.readPubkeyAsString = function () {
        const reader = this;
        const array = reader.readFixedArray(32);
        return base58.encode(array);
    };

    BinaryWriter.prototype.writePubkeyAsString = function (value) {
        const writer = this;
        writer.writeFixedArray(base58.decode(value));
    };
};

extendBorsh();
